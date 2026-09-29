/**
 * Welcome-gift wheel. Honest by construction:
 *  - the SERVER draws the prize (weighted random) and the app only animates to it;
 *  - every segment is a prize that is actually granted exactly as labelled;
 *  - one spin per account, no purchase required, no countdown pressure
 *    (the expiry is a plain date shown once, and reminded at most once).
 */

export type PrizeId = 'credits10' | 'credits5' | 'freeHigh' | 'discount40';

export type PrizeKind = 'credits' | 'token' | 'offering';

export interface PrizeDef {
  id: PrizeId;
  kind: PrizeKind;
  /** Credits granted immediately (kind `credits`). */
  credits?: number;
  /** One-use perk (kind `token`). */
  token?: 'freeHigh';
  /** RevenueCat offering unlocked for this user (kind `offering`). */
  offering?: 'gift_discount';
  /** Relative draw weight; tunable server-side (Remote Config `wheel_weights`). */
  weight: number;
}

export const PRIZES: Record<PrizeId, PrizeDef> = {
  credits10: { id: 'credits10', kind: 'credits', credits: 10, weight: 12.5 },
  credits5: { id: 'credits5', kind: 'credits', credits: 5, weight: 37.5 },
  freeHigh: { id: 'freeHigh', kind: 'token', token: 'freeHigh', weight: 25 },
  discount40: { id: 'discount40', kind: 'offering', offering: 'gift_discount', weight: 25 },
};

/**
 * Visual order of the 8 wheel segments (clockwise from 12 o'clock). Segment counts equal the
 * default weights (credits10 1/8, credits5 3/8, freeHigh 2/8, discount40 2/8) so what the
 * wheel shows is what it pays.
 */
export const WHEEL_SEGMENTS: readonly PrizeId[] = [
  'credits10',
  'discount40',
  'credits5',
  'freeHigh',
  'credits5',
  'discount40',
  'credits5',
  'freeHigh',
];

/** Days a won prize stays redeemable. */
export const PRIZE_TTL_DAYS = 3;

export type WeightTable = Partial<Record<PrizeId, number>>;

/** Validates a remote weight table; falls back to defaults for missing/invalid entries. */
export function resolveWeights(overrides: WeightTable | null | undefined): Record<PrizeId, number> {
  const out = {} as Record<PrizeId, number>;
  for (const id of Object.keys(PRIZES) as PrizeId[]) {
    const candidate = overrides?.[id];
    out[id] =
      typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : PRIZES[id].weight;
  }
  return out;
}

/**
 * Weighted draw. `random` must return a float in [0, 1) — the server passes a
 * crypto-strength source; tests pass fixed values.
 */
export function drawPrize(random: () => number, overrides?: WeightTable | null): PrizeId {
  const weights = resolveWeights(overrides);
  const entries = (Object.keys(weights) as PrizeId[]).filter((id) => weights[id] > 0);
  const total = entries.reduce((sum, id) => sum + weights[id], 0);
  if (total <= 0) return 'credits5';
  let roll = Math.min(Math.max(random(), 0), 0.999999999) * total;
  for (const id of entries) {
    roll -= weights[id];
    if (roll < 0) return id;
  }
  return entries[entries.length - 1] ?? 'credits5';
}

/** Picks which segment (of those showing the prize) the wheel should land on. */
export function segmentForPrize(prize: PrizeId, random: () => number): number {
  const candidates = WHEEL_SEGMENTS.map((id, index) => ({ id, index })).filter((s) => s.id === prize);
  if (candidates.length === 0) return 0;
  const pick = Math.floor(Math.min(Math.max(random(), 0), 0.999999999) * candidates.length);
  return candidates[pick]?.index ?? 0;
}

/**
 * Final wheel rotation (degrees, clockwise) so that segment `index` sits under
 * the top pointer after `turns` full rotations, with a small in-segment jitter
 * (`jitter` in [-0.35, 0.35] of a segment) so it never lands exactly on a line.
 */
export function landingRotation(index: number, turns: number, jitter: number): number {
  const segment = 360 / WHEEL_SEGMENTS.length;
  const safeJitter = Math.max(-0.35, Math.min(0.35, jitter));
  const centerOfSegment = index * segment + segment / 2;
  return turns * 360 + (360 - centerOfSegment) + safeJitter * segment;
}

export function prizeExpiry(from: Date): Date {
  return new Date(from.getTime() + PRIZE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
