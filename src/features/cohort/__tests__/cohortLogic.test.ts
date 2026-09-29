import { COHORT_MIN_VISIBLE } from '@shared/api';

import { cohortDisplay, effectiveMinVisible, joinErrorKind } from '../cohortLogic';

describe('effectiveMinVisible', () => {
  it('uses the shared constant by default', () => {
    expect(effectiveMinVisible(undefined)).toBe(COHORT_MIN_VISIBLE);
    expect(effectiveMinVisible(null)).toBe(COHORT_MIN_VISIBLE);
    expect(effectiveMinVisible(Number.NaN)).toBe(COHORT_MIN_VISIBLE);
  });

  it('lets a remote value raise the threshold but never lower it below the privacy floor', () => {
    expect(effectiveMinVisible(50)).toBe(50);
    expect(effectiveMinVisible(5)).toBe(COHORT_MIN_VISIBLE);
    expect(effectiveMinVisible(0)).toBe(COHORT_MIN_VISIBLE);
    expect(effectiveMinVisible(-10)).toBe(COHORT_MIN_VISIBLE);
    expect(effectiveMinVisible(30.7)).toBe(30);
  });
});

describe('cohortDisplay', () => {
  it('shows the number only at or above the threshold', () => {
    expect(cohortDisplay({ sameWeek: 20, sameGoal: 90 }, 20)).toEqual({ visible: true, count: 20 });
    expect(cohortDisplay({ sameWeek: 341, sameGoal: 900 }, 20)).toEqual({ visible: true, count: 341 });
  });

  it('never exposes a small number', () => {
    const hidden = cohortDisplay({ sameWeek: 19, sameGoal: 500 }, 20);
    expect(hidden).toEqual({ visible: false });
    expect(JSON.stringify(hidden)).not.toContain('19');
    expect(cohortDisplay({ sameWeek: 0, sameGoal: 0 }, 20)).toEqual({ visible: false });
  });

  it('is hidden when there are no stats yet', () => {
    expect(cohortDisplay(null, 20)).toEqual({ visible: false });
  });

  it('applies a raised remote threshold', () => {
    expect(cohortDisplay({ sameWeek: 25, sameGoal: 25 }, 30)).toEqual({ visible: false });
  });
});

describe('joinErrorKind', () => {
  it('maps error codes to the three messages the card can show', () => {
    expect(joinErrorKind('offline')).toBe('offline');
    expect(joinErrorKind('timeout')).toBe('offline');
    expect(joinErrorKind('rate_limited')).toBe('busy');
    expect(joinErrorKind('pro_required')).toBe('pro');
    expect(joinErrorKind('unknown')).toBe('generic');
    expect(joinErrorKind(undefined)).toBe('generic');
  });
});
