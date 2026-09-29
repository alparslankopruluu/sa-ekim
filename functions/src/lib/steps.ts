/**
 * Lifecycle of a synchronous paid step (poster, voice line, personal song):
 *
 *   begin    one transaction: replay check → consent → Pro gate → rate limit →
 *            charge (credits or a won token) + ledger + pending request record
 *   complete store the response on the request record (replays return it)
 *   refund   one transaction: return exactly what was charged, mark failed
 *
 * A crash between begin and complete/refund is healed by hourlyMaintenance
 * (stale pending records are refunded).
 */
import { type ErrorCode } from '../shared/api.js';
import { hasConsent, isProActive } from './access.js';
import { db } from './admin.js';
import { fail } from './errors.js';
import { decideReplay, parseRequestRecord, type RequestKind, type RequestRecord } from './idempotency.js';
import { isTokenUsable, type LedgerReason, normalizeWallet, planStepCharge, type WalletCharge } from './ledger.js';
import { log } from './log.js';
import { docPaths } from './paths.js';
import { decideStepRateLimit, STEP_LIMITS } from './rate-limit.js';
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

export type StepKind = Exclude<RequestKind, 'createRender'>;

export type StepStart =
  | { kind: 'replay'; record: RequestRecord; balance: number }
  | { kind: 'charged'; charge: WalletCharge; balance: number };

export async function beginPaidStep(input: {
  uid: string;
  key: string;
  kind: StepKind;
  refId: string;
  cost: number;
  useFreePosterToken: boolean;
  requirePro: boolean;
  ledgerReason: LedgerReason;
}): Promise<StepStart> {
  const { uid, key, kind } = input;
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [requestSnap, consentSnap, walletSnap, entitlementSnap, giftSnap] = await tx.getAll(
      requestRef(uid, key),
      db().doc(docPaths.consent(uid)),
      walletRef(uid),
      db().doc(docPaths.entitlement(uid)),
      giftRef(uid),
    );
    if (!requestSnap || !consentSnap || !walletSnap || !entitlementSnap || !giftSnap) fail('unknown');
    const wallet = normalizeWallet(walletSnap.data());

    const decision = decideReplay(requestSnap.data(), kind);
    if (decision.action === 'replay') return { kind: 'replay', record: decision.record, balance: wallet.balance };
    if (decision.action === 'reject') fail(decision.code);

    if (!hasConsent(consentSnap.data())) fail('consent_required');
    if (input.requirePro && !isProActive(entitlementSnap.data(), now)) fail('pro_required');

    const limit = STEP_LIMITS[kind];
    const recent = await tx.get(
      db()
        .collection(docPaths.requests(uid))
        .where('kind', '==', kind)
        .where('createdAt', '>=', now - limit.windowMs)
        .count(),
    );
    if (decideStepRateLimit(recent.data().count, limit) === 'rate_limited') fail('rate_limited');

    const plan = planStepCharge(wallet, {
      cost: input.cost,
      useFreePosterToken: input.useFreePosterToken,
      tokenUsable: isTokenUsable(giftSnap.data(), 'freePoster', now),
    });
    if (!plan.ok) fail(plan.code);

    const next = writeWalletChange(tx, walletRef(uid), walletSnap, chargeChange(plan.charge), now);
    writeLedger(tx, uid, { delta: -plan.charge.credits, reason: input.ledgerReason, refId: input.refId }, now);
    if (plan.charge.freePosterTokens > 0) writeGiftRedemption(tx, uid, giftSnap, 'freePoster', now);
    tx.create(
      requestRef(uid, key),
      newRequestRecord({ kind, charge: plan.charge, refId: input.refId, response: null, now }),
    );
    return { kind: 'charged', charge: plan.charge, balance: next.balance };
  });
}

export async function completePaidStep(uid: string, key: string, response: Record<string, unknown>): Promise<void> {
  const ref = requestRef(uid, key);
  await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.get('status') !== 'pending') {
      log.warn('step.complete_not_pending', { uid, status: String(snapshot.get('status')) });
      return;
    }
    tx.update(ref, { status: 'done', response, updatedAt: Date.now() });
  });
}

/** Returns the charge of a still-pending step and marks it failed. Idempotent. */
export async function refundPaidStep(uid: string, key: string, code: ErrorCode): Promise<boolean> {
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [requestSnap, walletSnap, giftSnap] = await tx.getAll(requestRef(uid, key), walletRef(uid), giftRef(uid));
    if (!requestSnap || !walletSnap || !giftSnap) return false;
    const record = parseRequestRecord(requestSnap.data());
    if (!record || record.status !== 'pending' || record.kind === 'createRender') return false;
    writeWalletChange(tx, walletRef(uid), walletSnap, refundChange(record.charge), now);
    writeLedger(tx, uid, { delta: record.charge.credits, reason: 'step_refund', refId: record.refId }, now);
    if (record.charge.freePosterTokens > 0) writeGiftRedemption(tx, uid, giftSnap, 'freePoster', null);
    tx.update(requestSnap.ref, { status: 'failed', errorCode: code, updatedAt: now });
    return true;
  });
}
