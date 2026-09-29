/**
 * Wallet + ledger writes, always inside a Firestore transaction. Balances move
 * with FieldValue.increment on an existing wallet (a complete document is
 * written the first time), and every credit delta appends a ledger entry.
 */
import {
  type DocumentReference,
  type DocumentSnapshot,
  FieldValue,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';

import { REQUEST_RECORD_TTL_MS } from '../config.js';
import type { ErrorCode, WalletDoc } from '../shared/api.js';
import { db } from './admin.js';
import type { RequestRecord } from './idempotency.js';
import { type LedgerEntry, type LedgerReason, normalizeWallet, type WalletCharge } from './ledger.js';
import { docPaths } from './paths.js';

export const walletRef = (uid: string) => db().doc(docPaths.wallet(uid));
export const giftRef = (uid: string) => db().doc(docPaths.gift(uid));
export const requestRef = (uid: string, key: string) => db().doc(docPaths.request(uid, key));

export interface WalletChange {
  credits: number;
  freeHighTokens: number;
  /** Set the preview flag (undefined keeps it). */
  previewUsed?: boolean;
}

export function chargeChange(charge: WalletCharge): WalletChange {
  return {
    credits: -charge.credits,
    freeHighTokens: -charge.freeHighTokens,
    ...(charge.previewSlot ? { previewUsed: true } : {}),
  };
}

export function refundChange(charge: WalletCharge): WalletChange {
  return {
    credits: charge.credits,
    freeHighTokens: charge.freeHighTokens,
    ...(charge.previewSlot ? { previewUsed: false } : {}),
  };
}

export function creditChange(credits: number): WalletChange {
  return { credits, freeHighTokens: 0 };
}

/** Applies a change and returns the resulting wallet (valid because the snapshot was read in `tx`). */
export function writeWalletChange(
  tx: Transaction,
  ref: DocumentReference,
  snapshot: DocumentSnapshot,
  change: WalletChange,
  now: number,
): WalletDoc {
  const current = normalizeWallet(snapshot.data());
  const next: WalletDoc = {
    balance: current.balance + change.credits,
    freeHighTokens: Math.max(0, current.freeHighTokens + change.freeHighTokens),
    previewUsed: change.previewUsed ?? current.previewUsed,
    updatedAt: now,
  };
  if (!snapshot.exists) {
    tx.set(ref, next);
    return next;
  }
  const update: Record<string, unknown> = { updatedAt: now };
  if (change.credits !== 0) update.balance = FieldValue.increment(change.credits);
  if (change.freeHighTokens !== 0) update.freeHighTokens = FieldValue.increment(change.freeHighTokens);
  if (change.previewUsed !== undefined) update.previewUsed = change.previewUsed;
  tx.update(ref, update);
  return next;
}

export function writeLedger(
  tx: Transaction,
  uid: string,
  entry: { delta: number; reason: LedgerReason; refId: string },
  now: number,
): void {
  if (entry.delta === 0) return;
  const doc: LedgerEntry = { delta: entry.delta, reason: entry.reason, refId: entry.refId, createdAt: now };
  tx.create(db().collection(docPaths.ledger(uid)).doc(), doc);
}

/**
 * Marks (or un-marks) a won freeHigh token as redeemed on the gift document. The
 * `tokenExpiresAt` field exists only while the token is unredeemed and unexpired: the
 * hourly sweep queries it to take expired tokens out of the wallet.
 */
export function writeGiftRedemption(
  tx: Transaction,
  uid: string,
  giftSnapshot: DocumentSnapshot,
  redeemedAt: number | null,
): void {
  if (!giftSnapshot.exists || giftSnapshot.get('prizeId') !== 'freeHigh') return;
  const expiresAt = giftSnapshot.get('expiresAt');
  tx.update(giftRef(uid), {
    redeemedAt,
    tokenExpiresAt: redeemedAt === null && typeof expiresAt === 'number' ? expiresAt : null,
  });
}

export function newRequestRecord(input: {
  refId: string;
  response: Record<string, unknown> | null;
  now: number;
}): RequestRecord & { expireAt: Timestamp } {
  return {
    kind: 'createPreview',
    status: 'pending',
    refId: input.refId,
    response: input.response,
    errorCode: null,
    createdAt: input.now,
    updatedAt: input.now,
    expireAt: Timestamp.fromMillis(input.now + REQUEST_RECORD_TTL_MS),
  };
}

export async function readBalance(uid: string): Promise<number> {
  const snapshot = await walletRef(uid).get();
  return normalizeWallet(snapshot.data()).balance;
}

/** Marks a still-pending request failed (no wallet change). */
export async function markRequestFailed(uid: string, key: string, code: ErrorCode): Promise<void> {
  const ref = requestRef(uid, key);
  await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || snapshot.get('status') !== 'pending') return;
    tx.update(ref, { status: 'failed', errorCode: code, updatedAt: Date.now() });
  });
}
