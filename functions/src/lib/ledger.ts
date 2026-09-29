/**
 * Pure credit math. Every Firestore transaction in this codebase derives its
 * wallet writes from these functions, and the unit tests pin their behavior:
 * reserve the maximum up front, settle on the actual seconds, refund the rest.
 */
import type { WalletDoc } from '../shared/api.js';
import {
  clampSeconds,
  MAX_PERFORMANCE_SECONDS,
  type Resolution,
  renderCost,
} from '../shared/pricing.js';

export type LedgerReason =
  | 'poster'
  | 'voice'
  | 'song'
  | 'step_refund'
  | 'render_reserve'
  | 'render_settle_refund'
  | 'render_refund'
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
  freePosterTokens: 0,
  hdBoostTokens: 0,
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
    freePosterTokens: nonNegativeInt(d.freePosterTokens),
    hdBoostTokens: nonNegativeInt(d.hdBoostTokens),
    previewUsed: d.previewUsed === true,
    updatedAt: nonNegativeInt(d.updatedAt),
  };
}

/** What one operation takes from (and on failure returns to) the wallet. */
export interface WalletCharge {
  credits: number;
  freePosterTokens: number;
  hdBoostTokens: number;
  /** The one free onboarding preview was consumed. */
  previewSlot: boolean;
}

export const NO_CHARGE: WalletCharge = { credits: 0, freePosterTokens: 0, hdBoostTokens: 0, previewSlot: false };

export function normalizeCharge(data: unknown): WalletCharge {
  if (!data || typeof data !== 'object') return { ...NO_CHARGE };
  const d = data as Record<string, unknown>;
  return {
    credits: nonNegativeInt(d.credits),
    freePosterTokens: nonNegativeInt(d.freePosterTokens),
    hdBoostTokens: nonNegativeInt(d.hdBoostTokens),
    previewSlot: d.previewSlot === true,
  };
}

export type ChargeDecision =
  | { ok: true; charge: WalletCharge }
  | { ok: false; code: 'insufficient_credits' | 'invalid_input' | 'already_claimed' };

/** Poster / voice line / personal song: flat credits, or a won free-poster token. */
export function planStepCharge(
  wallet: WalletDoc,
  input: { cost: number; useFreePosterToken: boolean; tokenUsable: boolean },
): ChargeDecision {
  if (input.useFreePosterToken) {
    if (wallet.freePosterTokens < 1 || !input.tokenUsable) return { ok: false, code: 'invalid_input' };
    return { ok: true, charge: { ...NO_CHARGE, freePosterTokens: 1 } };
  }
  if (wallet.balance < input.cost) return { ok: false, code: 'insufficient_credits' };
  return { ok: true, charge: { ...NO_CHARGE, credits: input.cost } };
}

/**
 * Credits reserved when a render is queued. Full renders reserve the price of
 * the longest possible performance, so audio that turns out longer than the
 * client claimed can never be under-charged; settlement refunds the rest.
 */
export function renderReservation(purpose: 'preview' | 'full', billingResolution: Resolution): number {
  return purpose === 'preview' ? 0 : renderCost(billingResolution, MAX_PERFORMANCE_SECONDS);
}

export function planRenderCharge(
  wallet: WalletDoc,
  input: {
    purpose: 'preview' | 'full';
    billingResolution: Resolution;
    useHdBoostToken: boolean;
    hdTokenUsable: boolean;
  },
): ChargeDecision {
  if (input.purpose === 'preview') {
    if (wallet.previewUsed) return { ok: false, code: 'already_claimed' };
    return { ok: true, charge: { ...NO_CHARGE, previewSlot: true } };
  }
  const reserve = renderReservation('full', input.billingResolution);
  if (input.useHdBoostToken && (wallet.hdBoostTokens < 1 || !input.hdTokenUsable)) {
    return { ok: false, code: 'invalid_input' };
  }
  if (wallet.balance < reserve) return { ok: false, code: 'insufficient_credits' };
  return {
    ok: true,
    charge: { ...NO_CHARGE, credits: reserve, hdBoostTokens: input.useHdBoostToken ? 1 : 0 },
  };
}

/** The wallet after a charge (mirrors the FieldValue.increment writes). */
export function applyCharge(wallet: WalletDoc, charge: WalletCharge): WalletDoc {
  return {
    ...wallet,
    balance: wallet.balance - charge.credits,
    freePosterTokens: wallet.freePosterTokens - charge.freePosterTokens,
    hdBoostTokens: wallet.hdBoostTokens - charge.hdBoostTokens,
    previewUsed: wallet.previewUsed || charge.previewSlot,
  };
}

/** The wallet after returning a charge in full (failed or canceled work). */
export function applyRefund(wallet: WalletDoc, charge: WalletCharge): WalletDoc {
  return {
    ...wallet,
    balance: wallet.balance + charge.credits,
    freePosterTokens: wallet.freePosterTokens + charge.freePosterTokens,
    hdBoostTokens: wallet.hdBoostTokens + charge.hdBoostTokens,
    previewUsed: charge.previewSlot ? false : wallet.previewUsed,
  };
}

export interface Settlement {
  /** Credits finally kept for the render. */
  chargedCredits: number;
  /** Unused part of the reservation returned to the wallet. */
  refundCredits: number;
  /** Seconds the charge is based on (whole seconds, 2..15). */
  billedSeconds: number;
}

/**
 * Settles a successful render: charge `renderCost(billingResolution, actual)`
 * but never more than was reserved, and refund the remainder. When the
 * duration could not be measured, the catalog/claimed length is used.
 */
export function settleRender(input: {
  purpose: 'preview' | 'full';
  billingResolution: Resolution;
  reservedCredits: number;
  actualSeconds: number | null;
  fallbackSeconds: number;
}): Settlement {
  const measured =
    input.actualSeconds !== null && Number.isFinite(input.actualSeconds) && input.actualSeconds > 0
      ? input.actualSeconds
      : input.fallbackSeconds;
  const billedSeconds = clampSeconds(measured);
  const reserved = Math.max(0, Math.floor(input.reservedCredits));
  if (input.purpose === 'preview') {
    return { chargedCredits: 0, refundCredits: reserved, billedSeconds };
  }
  const cost = renderCost(input.billingResolution, billedSeconds);
  const chargedCredits = Math.min(cost, reserved);
  return { chargedCredits, refundCredits: reserved - chargedCredits, billedSeconds };
}

/**
 * A won token is usable while its prize has not expired. Tokens that did not
 * come from the wheel (no matching gift document) never expire.
 */
export function isTokenUsable(gift: unknown, prize: 'freePoster' | 'hdBoost', now: number): boolean {
  if (!gift || typeof gift !== 'object') return true;
  const g = gift as Record<string, unknown>;
  if (g.prizeId !== prize) return true;
  return typeof g.expiresAt === 'number' && g.expiresAt > now;
}
