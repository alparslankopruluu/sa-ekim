import { FREE_LIMITS } from '@shared/pricing';
import type { PhaseId } from '@shared/timeline';

import { canUse, FEATURES, type Feature } from '../entitlements';

// Literal list: @shared/timeline value imports use `.js` specifiers that jest cannot resolve yet.
const PHASE_IDS: readonly PhaseId[] = ['care', 'shed', 'quiet', 'sprout', 'grow', 'mature', 'final'];

describe('canUse — free user', () => {
  const free = { isPro: false } as const;

  it('allows photos below the free limit and locks the next one', () => {
    for (let count = 0; count < FREE_LIMITS.journeyPhotos; count++) {
      expect(canUse('photos', { ...free, photoCount: count })).toEqual({ allowed: true, paywallSource: null });
    }
    expect(canUse('photos', { ...free, photoCount: FREE_LIMITS.journeyPhotos })).toEqual({
      allowed: false,
      paywallSource: 'locked_photos',
    });
    expect(canUse('photos', { ...free, photoCount: 40 }).allowed).toBe(false);
  });

  it('treats a missing photo count as zero photos', () => {
    expect(canUse('photos', free).allowed).toBe(true);
  });

  it('locks compare, band, report with their own paywall source', () => {
    expect(canUse('compare', free)).toEqual({ allowed: false, paywallSource: 'locked_compare' });
    expect(canUse('band', free)).toEqual({ allowed: false, paywallSource: 'locked_band' });
    expect(canUse('report', free)).toEqual({ allowed: false, paywallSource: 'locked_report' });
  });

  it('locks the cohort card and phase reminders', () => {
    expect(canUse('cohort', free).allowed).toBe(false);
    expect(canUse('cohort', free).paywallSource).not.toBeNull();
    expect(canUse('phaseReminders', free).allowed).toBe(false);
    expect(canUse('phaseReminders', free).paywallSource).not.toBeNull();
  });

  it('keeps only the care phase of the guide free', () => {
    expect(canUse('guide', { ...free, phaseId: 'care' })).toEqual({ allowed: true, paywallSource: null });
    for (const id of PHASE_IDS.filter((p) => p !== 'care')) {
      expect(canUse('guide', { ...free, phaseId: id })).toEqual({ allowed: false, paywallSource: 'locked_guide' });
    }
  });

  it('falls back to the day index when no phase is given', () => {
    expect(canUse('guide', { ...free, day: -3 }).allowed).toBe(true);
    expect(canUse('guide', { ...free, day: 0 }).allowed).toBe(true);
    expect(canUse('guide', { ...free, day: FREE_LIMITS.freeGuideDays }).allowed).toBe(true);
    expect(canUse('guide', { ...free, day: FREE_LIMITS.freeGuideDays + 1 }).allowed).toBe(false);
  });

  it('prefers the phase over the day when both are present', () => {
    expect(canUse('guide', { ...free, phaseId: 'shed', day: 3 }).allowed).toBe(false);
    expect(canUse('guide', { ...free, phaseId: 'care', day: 90 }).allowed).toBe(true);
  });

  it('locks the guide when neither phase nor day is known (fail closed)', () => {
    expect(canUse('guide', free)).toEqual({ allowed: false, paywallSource: 'locked_guide' });
  });

  it('never gates HD behind the entitlement (it is paid with credits)', () => {
    expect(canUse('hd', free)).toEqual({ allowed: true, paywallSource: null });
  });
});

describe('canUse — Pro user', () => {
  const pro = { isPro: true } as const;

  it.each(FEATURES)('allows %s with no paywall', (feature: Feature) => {
    expect(canUse(feature, { ...pro, photoCount: 500, day: 300, phaseId: 'grow' })).toEqual({
      allowed: true,
      paywallSource: null,
    });
  });
});

describe('FEATURES', () => {
  it('lists every gated feature exactly once', () => {
    expect([...FEATURES].sort()).toEqual(
      ['band', 'cohort', 'compare', 'guide', 'hd', 'phaseReminders', 'photos', 'report'].sort(),
    );
  });
});
