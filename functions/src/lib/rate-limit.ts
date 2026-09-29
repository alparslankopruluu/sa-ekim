/**
 * Per-user abuse limits for the paid AI endpoint (security S1/S7). The
 * decision is pure; the counts come from indexed Firestore queries run
 * inside the charging transaction.
 */
import { HOUR_MS } from '../config.js';

export const PREVIEW_LIMITS = {
  /** Non-terminal previews at once. */
  maxActive: 2,
  /** Previews started in any rolling hour. */
  maxPerWindow: 10,
  windowMs: HOUR_MS,
} as const;

export type LimitDecision = 'ok' | 'rate_limited';

export function decidePreviewRateLimit(
  counts: { active: number; recent: number },
  limits: { maxActive: number; maxPerWindow: number } = PREVIEW_LIMITS,
): LimitDecision {
  if (counts.active >= limits.maxActive) return 'rate_limited';
  if (counts.recent >= limits.maxPerWindow) return 'rate_limited';
  return 'ok';
}
