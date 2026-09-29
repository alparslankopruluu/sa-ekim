/**
 * RevenueCat identifiers. Store product ids are permanent once created in App Store Connect /
 * Google Play, so they are semantic and price-free.
 *
 * App Store:   <bundleId>.<suffix>          e.g. com.techtactoe.kok.pro.weekly
 * Google Play: subscription `pro` with base plans `weekly` / `monthly` / `annual`,
 *              consumables `credits_10|25|60`.
 * RevenueCat maps both stores onto the same entitlement and offerings.
 * Prices (owner-fixed 2026-09-29, USD reference tier; storefronts localize): weekly 7.99,
 * monthly 12.99, annual 39.99, gift annual first year 23.99. No free trial anywhere.
 */

export const ENTITLEMENT_PRO = 'pro';

export const OFFERINGS = {
  /** Main paywall: annual + monthly + weekly. */
  default: 'default',
  /** Wheel prize: first year of annual at a discount (a real promotional/intro price). */
  giftDiscount: 'gift_discount',
  /** Consumable credit packs. */
  credits: 'credits',
} as const;
export type OfferingId = (typeof OFFERINGS)[keyof typeof OFFERINGS];

/** Standard RevenueCat package identifiers used inside the offerings. */
export const PACKAGES = {
  weekly: '$rc_weekly',
  monthly: '$rc_monthly',
  annual: '$rc_annual',
} as const;

export const PRODUCT_SUFFIXES = {
  weekly: 'pro.weekly',
  monthly: 'pro.monthly',
  annual: 'pro.annual',
  annualGiftDiscount: 'pro.annual.gift',
  credits10: 'credits_10',
  credits25: 'credits_25',
  credits60: 'credits_60',
} as const;

export type PlanId = 'weekly' | 'monthly' | 'annual';

/** Maps a store product identifier (either store) to the plan it grants. */
export function planForProductId(productId: string): PlanId | null {
  const id = productId.toLowerCase();
  if (id.includes('weekly')) return 'weekly';
  if (id.includes('monthly')) return 'monthly';
  if (id.includes('annual') || id.includes('yearly')) return 'annual';
  return null;
}

/** Maps a store product identifier to a credit pack id, if it is one. */
export function packForProductId(productId: string): 'credits_10' | 'credits_25' | 'credits_60' | null {
  const match = /credits_(10|25|60)(?![0-9])/.exec(productId.toLowerCase());
  if (!match) return null;
  return `credits_${match[1]}` as 'credits_10' | 'credits_25' | 'credits_60';
}
