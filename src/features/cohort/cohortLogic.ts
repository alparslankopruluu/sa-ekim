/**
 * Pure rules of the "same week" cohort card. The number of people is shown only when it is
 * large enough that it cannot single anyone out (spec §4), and it is never fabricated: with
 * no stats, or too few people, the display carries no number at all.
 */
import { COHORT_MIN_VISIBLE, type CohortStats, type ErrorCode } from '@shared/api';

/**
 * Threshold to apply. A remote value may only RAISE it: the shared constant is the privacy
 * floor, so a bad remote value can never expose a small group.
 */
export function effectiveMinVisible(remote: number | null | undefined): number {
  if (typeof remote !== 'number' || !Number.isFinite(remote)) return COHORT_MIN_VISIBLE;
  return Math.max(COHORT_MIN_VISIBLE, Math.floor(remote));
}

export type CohortDisplay = { visible: true; count: number } | { visible: false };

export function cohortDisplay(stats: CohortStats | null, minVisible: number): CohortDisplay {
  if (!stats || !Number.isFinite(stats.sameWeek) || stats.sameWeek < minVisible) return { visible: false };
  return { visible: true, count: stats.sameWeek };
}

export type JoinErrorKind = 'offline' | 'busy' | 'pro' | 'generic';

export function joinErrorKind(code: ErrorCode | undefined): JoinErrorKind {
  switch (code) {
    case 'offline':
    case 'timeout':
      return 'offline';
    case 'rate_limited':
      return 'busy';
    case 'pro_required':
      return 'pro';
    default:
      return 'generic';
  }
}
