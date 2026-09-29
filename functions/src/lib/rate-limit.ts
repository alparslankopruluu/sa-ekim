/**
 * Per-user abuse limits for the paid AI endpoints (security S1/S7). The
 * decisions are pure; the counts come from indexed Firestore queries run
 * inside the charging transaction.
 */
import { DAY_MS, HOUR_MS } from '../config.js';
import type { RequestKind } from './idempotency.js';

export const RENDER_LIMITS = {
  /** Non-terminal renders at once. */
  maxActive: 3,
  /** Renders started in any rolling 24 h. */
  maxPerWindow: 30,
  windowMs: DAY_MS,
} as const;

export type LimitDecision = 'ok' | 'rate_limited';

export function decideRenderRateLimit(
  counts: { active: number; recent: number },
  limits: { maxActive: number; maxPerWindow: number } = RENDER_LIMITS,
): LimitDecision {
  if (counts.active >= limits.maxActive) return 'rate_limited';
  if (counts.recent >= limits.maxPerWindow) return 'rate_limited';
  return 'ok';
}

/** Hourly caps for the synchronous generation steps (credits bound them too). */
export const STEP_LIMITS: Record<Exclude<RequestKind, 'createRender'>, { max: number; windowMs: number }> = {
  createPoster: { max: 20, windowMs: HOUR_MS },
  synthesizeVoice: { max: 60, windowMs: HOUR_MS },
  composeSong: { max: 12, windowMs: HOUR_MS },
};

export function decideStepRateLimit(recentCount: number, limit: { max: number }): LimitDecision {
  return recentCount >= limit.max ? 'rate_limited' : 'ok';
}
