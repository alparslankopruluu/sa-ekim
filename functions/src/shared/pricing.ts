/**
 * Credit economics shared by the app (display) and Cloud Functions (authority).
 * The server is the only party that charges credits; the app imports these tables to show
 * the number that will be charged before the user taps "Create preview".
 *
 * Provider cost basis (fal `gpt-image-2` edit, measured for the sibling Simetra app in
 * 2026-07, re-verify before launch): ≈ $0.05 per preview at medium quality, ≈ $0.19 at
 * high. Fee assumption for every net figure in these docs: 30% store commission (the
 * conservative case; 15% applies to small-business/renewal years). At 30% the packs net
 * $0.35 / $0.28 / $0.23 per credit. The ≥ 70% gross-margin target applies to EXPECTED
 * usage (assumed ≤ 40% of the allowance spent); the worst case (every credit spent on the
 * high tier) is bounded, not targeted — see PLAN_ALLOWANCE.
 */
import type { Quality } from './catalog.js';

/** Credits per preview by quality tier. */
export const PREVIEW_COST: Record<Quality, number> = { standard: 1, high: 3 };

/** Provider cost estimate in USD, for margin reporting only. */
export const PREVIEW_PROVIDER_USD: Record<Quality, number> = { standard: 0.05, high: 0.19 };

/** The high tier renders without watermark and needs no entitlement, only credits. */
export function previewCost(quality: Quality): number {
  return PREVIEW_COST[quality];
}

/**
 * Free onboarding preview: one standard, watermarked preview per account. It does not touch
 * the wallet; `WalletDoc.previewUsed` records it (server-side, once).
 */
export const FREE_PREVIEW = { quality: 'standard' as Quality, watermarked: true } as const;

/**
 * Subscription allowances granted by the RevenueCat webhook (server) and the weekly cron.
 * Worst case = every credit spent on the high tier (3 credits ≈ $0.19):
 *   weekly  12/wk → 4 high ≈ $0.76 vs ≈ $5.59 net;  monthly 24/mo → 8 high ≈ $1.52 vs ≈ $9.09;
 *   annual  10 + 6/wk·52 = 322 credits → ≈ 107 high ≈ $20.4 vs ≈ $27.99 net (gift annual
 *   $23.99 nets ≈ $16.79 — worst case is a loss, so the gift is capped by expected use).
 * Remote-Config tunable on the server; changing these numbers requires a docs/decisions.md line.
 */
export const PLAN_ALLOWANCE = {
  weekly: { credits: 12, period: 'week' },
  monthly: { credits: 24, period: 'month' },
  /** Annual: `initial` at purchase, then `credits` every week while the year is active. */
  annual: { credits: 6, period: 'week', initial: 10 },
} as const;

/** Consumable credit packs (Model B top-ups). Store product ids live in products.ts. */
export const CREDIT_PACKS = [
  { id: 'credits_10', credits: 10 },
  { id: 'credits_25', credits: 25 },
  { id: 'credits_60', credits: 60 },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

export function creditsForPack(id: string): number | null {
  const pack = CREDIT_PACKS.find((p) => p.id === id);
  return pack ? pack.credits : null;
}

/** Free-tier limits enforced by the app (Pro lifts them). */
export const FREE_LIMITS = {
  /** Progress photos a free journey may keep. */
  journeyPhotos: 3,
  /** Days of the care guide that stay free. */
  freeGuideDays: 14,
} as const;
