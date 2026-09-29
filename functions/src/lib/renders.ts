/**
 * Render state machine (Firestore side). Every transition is a transaction
 * guarded by the current status, which makes webhook retries, task retries,
 * cancel races and maintenance sweeps safe to repeat:
 *
 *   queued ──submit──▶ queued(progress) ──webhook OK──▶ finalizing ──task──▶ succeeded
 *      │                    │                               │
 *      └──cancel──▶ canceled└──webhook ERROR / stuck──▶ failed ◀──task gave up
 */
import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type { ErrorCode, RenderDoc, RenderStatus } from '../shared/api.js';
import { RESOLUTIONS, type Resolution } from '../shared/pricing.js';
import { db } from './admin.js';
import { normalizeCharge, settleRender, type WalletCharge } from './ledger.js';
import { docPaths } from './paths.js';
import {
  creditChange,
  giftRef,
  refundChange,
  requestRef,
  walletRef,
  writeGiftRedemption,
  writeLedger,
  writeWalletChange,
} from './wallet.js';

export const ACTIVE_RENDER_STATUSES: readonly RenderStatus[] = ['queued', 'processing', 'finalizing'];
export const TERMINAL_RENDER_STATUSES: readonly RenderStatus[] = ['succeeded', 'failed', 'canceled'];

/** `users/{uid}/renders_private/{renderId}` — server-only (no client rules). */
export interface RenderPrivateDoc {
  /** fal queue request id (never copied to the client-readable RenderDoc). */
  requestId: string | null;
  billingResolution: Resolution;
  /** Everything reserved from the wallet (credits, hdBoost token, preview slot). */
  charge: WalletCharge;
  /** Storage object sent to the provider as audio. */
  audioPath: string;
  /** Catalog/claimed seconds, used only if the output duration can't be measured. */
  expectedSeconds: number;
  transcription: boolean;
  idempotencyKey: string;
  /** Provider output URL, stored between webhook and finalize; cleared on settle. */
  outputVideoUrl: string | null;
  createdAt: number;
  submittedAt: number | null;
  completedAt: number | null;
  settledAt: number | null;
  refundedAt: number | null;
}

export const renderRef = (uid: string, renderId: string) => db().doc(docPaths.render(uid, renderId));
export const renderPrivateRef = (uid: string, renderId: string) => db().doc(docPaths.renderPrivate(uid, renderId));

export function parseRenderPrivate(data: unknown): RenderPrivateDoc | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    requestId: typeof d.requestId === 'string' ? d.requestId : null,
    billingResolution: RESOLUTIONS.includes(d.billingResolution as Resolution)
      ? (d.billingResolution as Resolution)
      : '480p',
    charge: normalizeCharge(d.charge),
    audioPath: typeof d.audioPath === 'string' ? d.audioPath : '',
    expectedSeconds: num(d.expectedSeconds) ?? 15,
    transcription: d.transcription === true,
    idempotencyKey: typeof d.idempotencyKey === 'string' ? d.idempotencyKey : '',
    outputVideoUrl: typeof d.outputVideoUrl === 'string' ? d.outputVideoUrl : null,
    createdAt: num(d.createdAt) ?? 0,
    submittedAt: num(d.submittedAt),
    completedAt: num(d.completedAt),
    settledAt: num(d.settledAt),
    refundedAt: num(d.refundedAt),
  };
}

function statusOf(snapshot: DocumentSnapshot | undefined): RenderStatus | null {
  const status = snapshot?.exists ? snapshot.get('status') : null;
  return typeof status === 'string' ? (status as RenderStatus) : null;
}

/** After fal accepted the job: remember its id; report whether the user canceled meanwhile. */
export async function markRenderSubmitted(
  uid: string,
  renderId: string,
  idempotencyKey: string,
  requestId: string,
): Promise<'ok' | 'canceled'> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [renderSnap, privateSnap, requestSnap] = await tx.getAll(
      renderRef(uid, renderId),
      renderPrivateRef(uid, renderId),
      requestRef(uid, idempotencyKey),
    );
    const status = statusOf(renderSnap);
    if (privateSnap?.exists) tx.update(privateSnap.ref, { requestId, submittedAt: now });
    if (requestSnap?.exists && requestSnap.get('status') === 'pending') {
      tx.update(requestSnap.ref, { status: 'done', updatedAt: now });
    }
    if (status === 'queued') tx.update(renderRef(uid, renderId), { progress: 0.1, updatedAt: now });
    return status === 'canceled' ? 'canceled' : 'ok';
  });
}

export interface RefundOutcome {
  changed: boolean;
  previousStatus: RenderStatus | null;
  requestId: string | null;
  balance: number | null;
}

/**
 * Moves a render from one of `fromStatuses` to failed/canceled and returns its
 * whole reservation (credits, hdBoost token, preview slot). Idempotent.
 */
export async function refundRender(
  uid: string,
  renderId: string,
  options: {
    fromStatuses: readonly RenderStatus[];
    to: 'failed' | 'canceled';
    errorCode: ErrorCode | null;
    /** Webhook path: only act if the stored fal request id is unset or matches. */
    expectedRequestId?: string;
  },
): Promise<RefundOutcome> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [renderSnap, privateSnap, walletSnap, giftSnap] = await tx.getAll(
      renderRef(uid, renderId),
      renderPrivateRef(uid, renderId),
      walletRef(uid),
      giftRef(uid),
    );
    const status = statusOf(renderSnap);
    const priv = parseRenderPrivate(privateSnap?.data());
    const requestMismatch =
      options.expectedRequestId !== undefined && !!priv?.requestId && priv.requestId !== options.expectedRequestId;
    if (!status || !options.fromStatuses.includes(status) || requestMismatch || !walletSnap || !giftSnap) {
      return { changed: false, previousStatus: status, requestId: priv?.requestId ?? null, balance: null };
    }
    const charge = priv?.charge ?? normalizeCharge(null);
    const wallet = writeWalletChange(tx, walletRef(uid), walletSnap, refundChange(charge), now);
    writeLedger(tx, uid, { delta: charge.credits, reason: 'render_refund', refId: renderId }, now);
    if (charge.hdBoostTokens > 0) writeGiftRedemption(tx, uid, giftSnap, 'hdBoost', null);
    tx.update(renderRef(uid, renderId), {
      status: options.to,
      errorCode: options.errorCode,
      progress: 0,
      updatedAt: now,
    });
    if (privateSnap?.exists) tx.update(privateSnap.ref, { refundedAt: now, outputVideoUrl: null });
    return { changed: true, previousStatus: status, requestId: priv?.requestId ?? null, balance: wallet.balance };
  });
}

export type ClaimOutcome = 'claimed' | 'already_finalizing' | 'terminal' | 'missing' | 'mismatch';

/** Webhook OK: queued/processing → finalizing, storing the output URL server-side. */
export async function claimRenderForFinalize(
  uid: string,
  renderId: string,
  providerRequestId: string,
  outputVideoUrl: string,
): Promise<ClaimOutcome> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [renderSnap, privateSnap] = await tx.getAll(renderRef(uid, renderId), renderPrivateRef(uid, renderId));
    const status = statusOf(renderSnap);
    const priv = parseRenderPrivate(privateSnap?.data());
    if (!status || !priv || !privateSnap) return 'missing';
    if (priv.requestId && priv.requestId !== providerRequestId) return 'mismatch';
    if (TERMINAL_RENDER_STATUSES.includes(status)) return 'terminal';
    if (status === 'finalizing') return 'already_finalizing';
    tx.update(renderRef(uid, renderId), { status: 'finalizing', progress: 0.85, updatedAt: now });
    tx.update(privateSnap.ref, { requestId: providerRequestId, outputVideoUrl, completedAt: now });
    return 'claimed';
  });
}

export async function loadRender(
  uid: string,
  renderId: string,
): Promise<{ render: RenderDoc; priv: RenderPrivateDoc } | null> {
  const [renderSnap, privateSnap] = await db().getAll(renderRef(uid, renderId), renderPrivateRef(uid, renderId));
  const priv = parseRenderPrivate(privateSnap?.data());
  if (!renderSnap?.exists || !priv) return null;
  return { render: renderSnap.data() as RenderDoc, priv };
}

/** finalizing → succeeded: charge the actual seconds, refund the rest of the reservation. */
export async function settleRenderSuccess(
  uid: string,
  renderId: string,
  result: { videoPath: string; actualSeconds: number | null },
): Promise<{ settled: boolean; chargedCredits: number; seconds: number }> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [renderSnap, privateSnap, walletSnap] = await tx.getAll(
      renderRef(uid, renderId),
      renderPrivateRef(uid, renderId),
      walletRef(uid),
    );
    const priv = parseRenderPrivate(privateSnap?.data());
    if (statusOf(renderSnap) !== 'finalizing' || !priv || !privateSnap || !walletSnap) {
      return { settled: false, chargedCredits: 0, seconds: 0 };
    }
    const purpose = renderSnap?.get('purpose') === 'preview' ? 'preview' : 'full';
    const settlement = settleRender({
      purpose,
      billingResolution: priv.billingResolution,
      reservedCredits: priv.charge.credits,
      actualSeconds: result.actualSeconds,
      fallbackSeconds: priv.expectedSeconds,
    });
    if (settlement.refundCredits > 0) {
      writeWalletChange(tx, walletRef(uid), walletSnap, creditChange(settlement.refundCredits), now);
      writeLedger(tx, uid, { delta: settlement.refundCredits, reason: 'render_settle_refund', refId: renderId }, now);
    }
    tx.update(renderRef(uid, renderId), {
      status: 'succeeded',
      videoPath: result.videoPath,
      seconds: settlement.billedSeconds,
      chargedCredits: settlement.chargedCredits,
      progress: 1,
      errorCode: null,
      updatedAt: now,
    });
    tx.update(privateSnap.ref, { settledAt: now, outputVideoUrl: null });
    return { settled: true, chargedCredits: settlement.chargedCredits, seconds: settlement.billedSeconds };
  });
}
