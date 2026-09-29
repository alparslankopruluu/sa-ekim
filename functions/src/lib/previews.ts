/**
 * Preview state machine (Firestore side). Every transition is a transaction guarded by the current
 * status, which makes webhook retries, task retries, cancel races and maintenance sweeps safe to
 * repeat:
 *
 *   queued ─submit→ processing ─webhook OK→ finalizing ─task→ succeeded
 *      │                │  ▲                    │  │
 *      │                │  └──── one retry ─────┘  └─task gave up→ failed (refund)
 *      └─cancel→ canceled └─webhook ERROR / stuck→ failed (refund)
 *
 * Money rule: the whole reservation is taken when the preview is queued and returned in full by any
 * path that ends without a result (failed, canceled, stuck, provider error). A finished preview keeps
 * exactly what was reserved — the quality gate can trigger one retry but never a refund or a partial
 * charge.
 */
import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type { CreatePreviewResponse, ErrorCode, PreviewDoc, PreviewStatus } from '../shared/api.js';
import type { Quality, RegionHint } from '../shared/catalog.js';
import { isValidRegionHint } from '../shared/catalog.js';
import { PREVIEW_RETENTION_MS } from '../config.js';
import { hasConsent } from './access.js';
import { db } from './admin.js';
import { fail } from './errors.js';
import { decideReplay } from './idempotency.js';
import { isTokenUsable, normalizeCharge, normalizeWallet, planPreviewCharge, type WalletCharge } from './ledger.js';
import { docPaths } from './paths.js';
import { decidePreviewRateLimit, PREVIEW_LIMITS } from './rate-limit.js';
import type { PreviewPlan } from './validate.js';
import {
  chargeChange,
  giftRef,
  newRequestRecord,
  refundChange,
  requestRef,
  walletRef,
  writeGiftRedemption,
  writeLedger,
  writeWalletChange,
} from './wallet.js';
import { shouldWatermark } from './watermark.js';

export const ACTIVE_PREVIEW_STATUSES: readonly PreviewStatus[] = ['queued', 'processing', 'finalizing'];
export const TERMINAL_PREVIEW_STATUSES: readonly PreviewStatus[] = ['succeeded', 'failed', 'canceled'];

/** `users/{uid}/previews_private/{previewId}` — server-only (no client rules). */
export interface PreviewPrivateDoc {
  /** fal queue request id (never copied to the client-readable PreviewDoc). */
  requestId: string | null;
  cancelUrl: string | null;
  /** Everything reserved from the wallet (credits, free-high token, onboarding slot). */
  charge: WalletCharge;
  idempotencyKey: string;
  regionHint: RegionHint | null;
  promptVersion: string;
  modelId: string;
  /** 1 for the first submit, 2 after the single quality-gate retry. */
  attempt: number;
  retried: boolean;
  /** Changed-pixel fraction inside the mask from the last measurement (null when unmasked). */
  changedFraction: number | null;
  /** Provider output URL, stored between webhook and finalize; cleared on settle. */
  outputUrl: string | null;
  createdAt: number;
  submittedAt: number | null;
  completedAt: number | null;
  settledAt: number | null;
  refundedAt: number | null;
}

export const previewRef = (uid: string, previewId: string) => db().doc(docPaths.preview(uid, previewId));
export const previewPrivateRef = (uid: string, previewId: string) => db().doc(docPaths.previewPrivate(uid, previewId));

export function parsePreviewPrivate(data: unknown): PreviewPrivateDoc | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    requestId: typeof d.requestId === 'string' ? d.requestId : null,
    cancelUrl: typeof d.cancelUrl === 'string' ? d.cancelUrl : null,
    charge: normalizeCharge(d.charge),
    idempotencyKey: typeof d.idempotencyKey === 'string' ? d.idempotencyKey : '',
    regionHint: isValidRegionHint(d.regionHint) ? d.regionHint : null,
    promptVersion: typeof d.promptVersion === 'string' ? d.promptVersion : '',
    modelId: typeof d.modelId === 'string' ? d.modelId : '',
    attempt: num(d.attempt) ?? 1,
    retried: d.retried === true,
    changedFraction: num(d.changedFraction),
    outputUrl: typeof d.outputUrl === 'string' ? d.outputUrl : null,
    createdAt: num(d.createdAt) ?? 0,
    submittedAt: num(d.submittedAt),
    completedAt: num(d.completedAt),
    settledAt: num(d.settledAt),
    refundedAt: num(d.refundedAt),
  };
}

function statusOf(snapshot: DocumentSnapshot | undefined): PreviewStatus | null {
  const status = snapshot?.exists ? snapshot.get('status') : null;
  return typeof status === 'string' ? (status as PreviewStatus) : null;
}

// --- create ------------------------------------------------------------------------------------

export type PreviewStart = {
  kind: 'replay' | 'reserved';
  response: CreatePreviewResponse;
  charge: WalletCharge;
  /** Effective quality (the onboarding preview is always standard). */
  quality: Quality;
};

/**
 * One transaction: idempotent replay → consent → kill switch → rate limits → reserve → create the
 * PreviewDoc (queued), the server-only record and the idempotency record.
 */
export async function beginPreview(input: {
  uid: string;
  plan: PreviewPlan;
  previewId: string;
  generationEnabled: boolean;
  promptVersion: string;
  modelId: string;
}): Promise<PreviewStart> {
  const { uid, plan, previewId } = input;
  return await db().runTransaction(async (tx): Promise<PreviewStart> => {
    const now = Date.now();
    const [requestSnap, consentSnap, walletSnap, giftSnap] = await tx.getAll(
      requestRef(uid, plan.idempotencyKey),
      db().doc(docPaths.consent(uid)),
      walletRef(uid),
      giftRef(uid),
    );
    if (!requestSnap || !consentSnap || !walletSnap || !giftSnap) fail('unknown');
    const wallet = normalizeWallet(walletSnap.data());

    const decision = decideReplay(requestSnap.data());
    if (decision.action === 'replay') {
      const stored = decision.record.response ?? {};
      if (typeof stored.previewId !== 'string' || typeof stored.reservedCredits !== 'number') fail('unknown');
      return {
        kind: 'replay',
        charge: normalizeCharge(null),
        quality: plan.quality,
        response: { previewId: stored.previewId, reservedCredits: stored.reservedCredits, balance: wallet.balance },
      };
    }
    if (decision.action === 'reject') fail(decision.code);

    if (!hasConsent(consentSnap.data())) fail('consent_required');
    if (!input.generationEnabled) fail('previews_disabled');

    const previews = db().collection(docPaths.previews(uid));
    const active = await tx.get(previews.where('status', 'in', [...ACTIVE_PREVIEW_STATUSES]).limit(PREVIEW_LIMITS.maxActive));
    const recent = await tx.get(previews.where('createdAt', '>=', now - PREVIEW_LIMITS.windowMs).count());
    if (decidePreviewRateLimit({ active: active.size, recent: recent.data().count }) === 'rate_limited') fail('rate_limited');

    const planned = planPreviewCharge(wallet, {
      quality: plan.quality,
      onboarding: plan.onboarding,
      useFreeHighToken: plan.useFreeHighToken,
      tokenUsable: isTokenUsable(giftSnap.data(), now),
    });
    if (!planned.ok) fail(planned.code);
    const { charge, quality } = planned;

    const next = writeWalletChange(tx, walletRef(uid), walletSnap, chargeChange(charge), now);
    writeLedger(tx, uid, { delta: -charge.credits, reason: 'preview_reserve', refId: previewId }, now);
    if (charge.freeHighTokens > 0) writeGiftRedemption(tx, uid, giftSnap, now);

    const preview: PreviewDoc = {
      id: previewId,
      status: 'queued',
      goal: plan.goal,
      styleId: plan.styleId,
      density: plan.density,
      quality,
      progress: 0,
      reservedCredits: charge.credits,
      chargedCredits: 0,
      photoPath: plan.photoPath,
      resultPath: null,
      watermarked: shouldWatermark({
        onboarding: plan.onboarding,
        reservedCredits: charge.credits,
        freeHighTokens: charge.freeHighTokens,
      }),
      onboarding: plan.onboarding,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + PREVIEW_RETENTION_MS,
    };
    const priv: PreviewPrivateDoc = {
      requestId: null,
      cancelUrl: null,
      charge,
      idempotencyKey: plan.idempotencyKey,
      regionHint: plan.regionHint,
      promptVersion: input.promptVersion,
      modelId: input.modelId,
      attempt: 1,
      retried: false,
      changedFraction: null,
      outputUrl: null,
      createdAt: now,
      submittedAt: null,
      completedAt: null,
      settledAt: null,
      refundedAt: null,
    };
    tx.create(previewRef(uid, previewId), preview);
    tx.create(previewPrivateRef(uid, previewId), priv);
    tx.create(
      requestRef(uid, plan.idempotencyKey),
      newRequestRecord({ refId: previewId, response: { previewId, reservedCredits: charge.credits }, now }),
    );
    return { kind: 'reserved', charge, quality, response: { previewId, reservedCredits: charge.credits, balance: next.balance } };
  });
}

// --- transitions -------------------------------------------------------------------------------

/** After fal accepted the job: remember its id; report whether the user canceled meanwhile. */
export async function markPreviewSubmitted(
  uid: string,
  previewId: string,
  idempotencyKey: string,
  job: { requestId: string; cancelUrl: string | null },
): Promise<'ok' | 'canceled'> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [previewSnap, privateSnap, requestSnap] = await tx.getAll(
      previewRef(uid, previewId),
      previewPrivateRef(uid, previewId),
      requestRef(uid, idempotencyKey),
    );
    const status = statusOf(previewSnap);
    if (privateSnap?.exists) tx.update(privateSnap.ref, { requestId: job.requestId, cancelUrl: job.cancelUrl, submittedAt: now });
    if (requestSnap?.exists && requestSnap.get('status') === 'pending') {
      tx.update(requestSnap.ref, { status: 'done', updatedAt: now });
    }
    if (status === 'queued') tx.update(previewRef(uid, previewId), { status: 'processing', progress: 0.1, updatedAt: now });
    return status === 'canceled' ? 'canceled' : 'ok';
  });
}

export interface RefundOutcome {
  changed: boolean;
  previousStatus: PreviewStatus | null;
  requestId: string | null;
  cancelUrl: string | null;
  balance: number | null;
}

/**
 * Moves a preview from one of `fromStatuses` to failed/canceled and returns its whole reservation
 * (credits, free-high token, onboarding slot). Idempotent: a second call finds a terminal status.
 */
export async function refundPreview(
  uid: string,
  previewId: string,
  options: {
    fromStatuses: readonly PreviewStatus[];
    to: 'failed' | 'canceled';
    errorCode: ErrorCode | null;
    /** Webhook path: only act if the stored fal request id is unset or matches. */
    expectedRequestId?: string;
    /** Stale-reservation path: only act if the job never reached fal. */
    onlyIfUnsubmitted?: boolean;
  },
): Promise<RefundOutcome> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [previewSnap, privateSnap, walletSnap, giftSnap] = await tx.getAll(
      previewRef(uid, previewId),
      previewPrivateRef(uid, previewId),
      walletRef(uid),
      giftRef(uid),
    );
    const status = statusOf(previewSnap);
    const priv = parsePreviewPrivate(privateSnap?.data());
    const requestMismatch =
      options.expectedRequestId !== undefined && !!priv?.requestId && priv.requestId !== options.expectedRequestId;
    const alreadySubmitted = options.onlyIfUnsubmitted === true && !!priv?.requestId;
    const unchanged = {
      changed: false,
      previousStatus: status,
      requestId: priv?.requestId ?? null,
      cancelUrl: priv?.cancelUrl ?? null,
      balance: null,
    };
    // A missing wallet means the account is being deleted: never recreate it.
    if (!status || !options.fromStatuses.includes(status) || requestMismatch || alreadySubmitted || !walletSnap?.exists || !giftSnap) {
      return unchanged;
    }
    const charge = priv?.charge ?? normalizeCharge(null);
    const wallet = writeWalletChange(tx, walletRef(uid), walletSnap, refundChange(charge), now);
    writeLedger(tx, uid, { delta: charge.credits, reason: 'preview_refund', refId: previewId }, now);
    if (charge.freeHighTokens > 0) writeGiftRedemption(tx, uid, giftSnap, null);
    tx.update(previewRef(uid, previewId), { status: options.to, errorCode: options.errorCode, progress: 0, updatedAt: now });
    if (privateSnap?.exists) tx.update(privateSnap.ref, { refundedAt: now, outputUrl: null });
    return { ...unchanged, changed: true, balance: wallet.balance };
  });
}

export type ClaimOutcome = 'claimed' | 'already_finalizing' | 'terminal' | 'missing' | 'mismatch';

/** Webhook OK: queued/processing → finalizing, storing the output URL server-side. */
export async function claimPreviewForFinalize(
  uid: string,
  previewId: string,
  providerRequestId: string,
  outputUrl: string,
): Promise<{ outcome: ClaimOutcome; attempt: number }> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [previewSnap, privateSnap] = await tx.getAll(previewRef(uid, previewId), previewPrivateRef(uid, previewId));
    const status = statusOf(previewSnap);
    const priv = parsePreviewPrivate(privateSnap?.data());
    if (!status || !priv || !privateSnap) return { outcome: 'missing' as const, attempt: 1 };
    if (priv.requestId && priv.requestId !== providerRequestId) return { outcome: 'mismatch' as const, attempt: priv.attempt };
    if (TERMINAL_PREVIEW_STATUSES.includes(status)) return { outcome: 'terminal' as const, attempt: priv.attempt };
    if (status === 'finalizing') return { outcome: 'already_finalizing' as const, attempt: priv.attempt };
    tx.update(previewRef(uid, previewId), { status: 'finalizing', progress: 0.85, updatedAt: now });
    tx.update(privateSnap.ref, { requestId: providerRequestId, outputUrl, completedAt: now });
    return { outcome: 'claimed' as const, attempt: priv.attempt };
  });
}

export async function loadPreview(
  uid: string,
  previewId: string,
): Promise<{ preview: PreviewDoc; priv: PreviewPrivateDoc } | null> {
  const [previewSnap, privateSnap] = await db().getAll(previewRef(uid, previewId), previewPrivateRef(uid, previewId));
  const priv = parsePreviewPrivate(privateSnap?.data());
  if (!previewSnap?.exists || !priv) return null;
  return { preview: previewSnap.data() as PreviewDoc, priv };
}

/** finalizing → processing after the single quality-gate retry was submitted (same charge). */
export async function markRetrySubmitted(
  uid: string,
  previewId: string,
  job: { requestId: string; cancelUrl: string | null },
  changedFraction: number,
): Promise<boolean> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [previewSnap, privateSnap] = await tx.getAll(previewRef(uid, previewId), previewPrivateRef(uid, previewId));
    if (statusOf(previewSnap) !== 'finalizing' || !privateSnap?.exists) return false;
    tx.update(previewRef(uid, previewId), { status: 'processing', progress: 0.3, updatedAt: now });
    tx.update(privateSnap.ref, {
      requestId: job.requestId,
      cancelUrl: job.cancelUrl,
      retried: true,
      attempt: 2,
      changedFraction,
      outputUrl: null,
      completedAt: null,
      submittedAt: now,
    });
    return true;
  });
}

/** finalizing → succeeded. The reservation becomes the final charge; nothing else moves. */
export async function settlePreviewSuccess(
  uid: string,
  previewId: string,
  result: { resultPath: string; changedFraction: number | null },
): Promise<{ settled: boolean; chargedCredits: number }> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [previewSnap, privateSnap] = await tx.getAll(previewRef(uid, previewId), previewPrivateRef(uid, previewId));
    const priv = parsePreviewPrivate(privateSnap?.data());
    if (statusOf(previewSnap) !== 'finalizing' || !priv || !privateSnap) return { settled: false, chargedCredits: 0 };
    tx.update(previewRef(uid, previewId), {
      status: 'succeeded',
      resultPath: result.resultPath,
      chargedCredits: priv.charge.credits,
      progress: 1,
      errorCode: null,
      updatedAt: now,
    });
    tx.update(privateSnap.ref, {
      settledAt: now,
      outputUrl: null,
      ...(result.changedFraction !== null ? { changedFraction: result.changedFraction } : {}),
    });
    return { settled: true, chargedCredits: priv.charge.credits };
  });
}
