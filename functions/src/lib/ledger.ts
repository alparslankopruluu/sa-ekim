/**
 * Pure credit math. Every Firestore transaction in this codebase derives its
 * wallet writes from these functions, and the unit tests pin their behavior:
 * reserve the whole price up front, keep it on success, return all of it on failure.
 */
import type { Quality } from '../shared/catalog.js';
import type { WalletDoc } from '../shared/api.js';
import { previewCost } from '../shared/pricing.js';

export type LedgerReason =
  | 'preview_reserve'
  | 'preview_refund'
  | 'wheel_prize'
  | 'plan_allowance'
  | 'credit_pack';

/** `users/{uid}/ledger/{autoId}` — append-only audit trail of credit deltas. */
export interface LedgerEntry {
  delta: number;
  reason: LedgerReason;
  refId: string;
  createdAt: number;
}

export const EMPTY_WALLET: WalletDoc = {
  balance: 0,
  freeHighTokens: 0,
  previewUsed: false,
  updatedAt: 0,
};

function nonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Tolerates a missing or partially written wallet document. */
export function normalizeWallet(data: unknown): WalletDoc {
  if (!data || typeof data !== 'object') return { ...EMPTY_WALLET };
  const d = data as Record<string, unknown>;
  return {
    balance: nonNegativeInt(d.balance),
    freeHighTokens: nonNegativeInt(d.freeHighTokens),
    previewUsed: d.previewUsed === true,
    updatedAt: nonNegativeInt(d.updatedAt),
  };
}

/** What one preview takes from (and on failure returns to) the wallet. */
export interface WalletCharge {
  credits: number;
  freeHighTokens: number;
  /** The one free onboarding preview was consumed. */
  previewSlot: boolean;
}

export const NO_CHARGE: WalletCharge = { credits: 0, freeHighTokens: 0, previewSlot: false };

export function normalizeCharge(data: unknown): WalletCharge {
  if (!data || typeof data !== 'object') return { ...NO_CHARGE };
  const d = data as Record<string, unknown>;
  return {
    credits: nonNegativeInt(d.credits),
    freeHighTokens: nonNegativeInt(d.freeHighTokens),
    previewSlot: d.previewSlot === true,
  };
}

export type ChargeDecision =
  | { ok: true; charge: WalletCharge; quality: Quality }
  | { ok: false; code: 'insufficient_credits' | 'invalid_input' | 'already_claimed' };

/**
 * Decides what a preview costs.
 *  - onboarding: free once per account, always standard quality, never debits the wallet;
 *  - a won free-high token pays for one `high` preview (never `standard`);
 *  - otherwise the whole `previewCost(quality)` is reserved from the balance.
 */
export function planPreviewCharge(
  wallet: WalletDoc,
  input: { quality: Quality; onboarding: boolean; useFreeHighToken: boolean; tokenUsable: boolean },
): ChargeDecision {
  if (input.onboarding) {
    if (input.useFreeHighToken) return { ok: false, code: 'invalid_input' };
    if (wallet.previewUsed) return { ok: false, code: 'already_claimed' };
    return { ok: true, charge: { ...NO_CHARGE, previewSlot: true }, quality: 'standard' };
  }
  if (input.useFreeHighToken) {
    if (input.quality !== 'high') return { ok: false, code: 'invalid_input' };
    if (wallet.freeHighTokens < 1 || !input.tokenUsable) return { ok: false, code: 'invalid_input' };
    return { ok: true, charge: { ...NO_CHARGE, freeHighTokens: 1 }, quality: 'high' };
  }
  const cost = previewCost(input.quality);
  if (wallet.balance < cost) return { ok: false, code: 'insufficient_credits' };
  return { ok: true, charge: { ...NO_CHARGE, credits: cost }, quality: input.quality };
}

/** The wallet after a charge (mirrors the FieldValue.increment writes). */
export function applyCharge(wallet: WalletDoc, charge: WalletCharge): WalletDoc {
  return {
    ...wallet,
    balance: wallet.balance - charge.credits,
    freeHighTokens: wallet.freeHighTokens - charge.freeHighTokens,
    previewUsed: wallet.previewUsed || charge.previewSlot,
  };
}

/** The wallet after returning a charge in full (failed, canceled or stuck work). */
export function applyRefund(wallet: WalletDoc, charge: WalletCharge): WalletDoc {
  return {
    ...wallet,
    balance: wallet.balance + charge.credits,
    freeHighTokens: wallet.freeHighTokens + charge.freeHighTokens,
    previewUsed: charge.previewSlot ? false : wallet.previewUsed,
  };
}

/**
 * A won token is usable while its prize has not expired. Tokens that did not
 * come from the wheel (no matching gift document) never expire.
 */
export function isTokenUsable(gift: unknown, now: number): boolean {
  if (!gift || typeof gift !== 'object') return true;
  const g = gift as Record<string, unknown>;
  if (g.prizeId !== 'freeHigh') return true;
  return typeof g.expiresAt === 'number' && g.expiresAt > now;
}
