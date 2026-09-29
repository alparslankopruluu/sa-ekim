/** Retention decisions for the hourly sweep (pure). */
import { WEEK_MS } from '../config.js';

/** True when an object's `timeCreated` (RFC 3339) is older than `ttlMs`. Unknown ages are kept. */
export function isExpiredMedia(timeCreated: unknown, now: number, ttlMs: number): boolean {
  if (typeof timeCreated !== 'string') return false;
  const created = Date.parse(timeCreated);
  return Number.isFinite(created) && now - created > ttlMs;
}

/**
 * A non-terminal preview is stuck once it is older than `stuckMs`; a preview the finalize task
 * already claimed gets `finalizingMs` since its last update.
 */
export function isStuckPreview(
  preview: { status: unknown; createdAt: unknown; updatedAt: unknown },
  now: number,
  limits: { stuckMs: number; finalizingMs: number },
): boolean {
  const { status, createdAt, updatedAt } = preview;
  if (status !== 'queued' && status !== 'processing' && status !== 'finalizing') return false;
  if (typeof createdAt !== 'number' || now - createdAt <= limits.stuckMs) return false;
  if (status === 'finalizing') return typeof updatedAt !== 'number' || now - updatedAt > limits.finalizingMs;
  return true;
}

/** A gift token that was never redeemed and whose 3-day window has passed. */
export function isGiftTokenExpired(gift: { prizeId?: unknown; redeemedAt?: unknown; tokenExpiresAt?: unknown }, now: number): boolean {
  return (
    gift.prizeId === 'freeHigh' &&
    (gift.redeemedAt === null || gift.redeemedAt === undefined) &&
    typeof gift.tokenExpiresAt === 'number' &&
    gift.tokenExpiresAt <= now
  );
}

export { WEEK_MS };
