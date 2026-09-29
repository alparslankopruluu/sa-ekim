import { ANGLES_BY_GOAL, GOALS, maturationMonthsFor } from '@shared/catalog';
import {
  BAND_ANCHORS,
  bandAt,
  dayIndex,
  daysUntilNextPhase,
  isIsoDate,
  isPhotoDue,
  maturationProgress,
  monthIndex,
  nextPhase,
  PHASES,
  phaseForDay,
  photoCadenceDays,
  phaseStartDays,
  prpSessionOffsets,
  toIsoDate,
  weekIndex,
} from '@shared/timeline';

describe('ISO dates', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-09-29')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('29-09-2026')).toBe(false);
    expect(isIsoDate(20260929)).toBe(false);
  });

  it('formats the local calendar date', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('dayIndex', () => {
  it('counts whole calendar days from the operation day, ignoring the time of day', () => {
    expect(dayIndex('2026-09-01', new Date(2026, 8, 1, 6, 0))).toBe(0);
    expect(dayIndex('2026-09-01', new Date(2026, 8, 1, 23, 59))).toBe(0);
    expect(dayIndex('2026-09-01', new Date(2026, 8, 2, 0, 1))).toBe(1);
    expect(dayIndex('2026-09-01', new Date(2026, 9, 1, 12, 0))).toBe(30);
  });

  it('is negative before the operation and survives DST changes', () => {
    expect(dayIndex('2026-09-10', new Date(2026, 8, 7, 12, 0))).toBe(-3);
    // Spring-forward and fall-back weeks in most northern zones: still exact whole days.
    expect(dayIndex('2026-03-20', new Date(2026, 2, 30, 12, 0))).toBe(10);
    expect(dayIndex('2026-10-20', new Date(2026, 10, 3, 12, 0))).toBe(14);
  });
});

describe('week and month numbering', () => {
  it('is 1-based and never below 1', () => {
    expect(weekIndex(-5)).toBe(1);
    expect(weekIndex(0)).toBe(1);
    expect(weekIndex(6)).toBe(1);
    expect(weekIndex(7)).toBe(2);
    expect(weekIndex(21)).toBe(4);
    expect(monthIndex(0)).toBe(1);
    expect(monthIndex(29)).toBe(1);
    expect(monthIndex(30)).toBe(2);
  });
});

describe('phases', () => {
  it('tile the window without gaps or overlaps', () => {
    for (let i = 1; i < PHASES.length; i++) {
      expect(PHASES[i]!.fromDay).toBe(PHASES[i - 1]!.toDay + 1);
    }
    expect(PHASES[0]!.fromDay).toBe(0);
  });

  it('places the classic worried moments where clinics do', () => {
    const shed = phaseForDay(21, 'hairline');
    expect(shed.kind === 'phase' && shed.phase.id).toBe('shed');
    const quiet = phaseForDay(90, 'hairline');
    expect(quiet.kind === 'phase' && quiet.phase.id).toBe('quiet');
    const first = phaseForDay(0, 'crown');
    expect(first.kind === 'phase' && first.phase.id).toBe('care');
    expect(phaseForDay(-1, 'hairline').kind).toBe('before');
  });

  it('keeps crown and parting open longer than hairline, brows and beard', () => {
    expect(maturationMonthsFor('crown')).toBe(18);
    expect(maturationMonthsFor('part')).toBe(18);
    expect(maturationMonthsFor('hairline')).toBe(12);
    expect(phaseForDay(500, 'crown').kind).toBe('phase');
    expect(phaseForDay(500, 'hairline').kind).toBe('beyond');
  });

  it('knows the next phase and the days until it', () => {
    const phase = PHASES[1]!;
    expect(nextPhase('care')!.id).toBe('shed');
    expect(nextPhase('final')).toBeNull();
    expect(daysUntilNextPhase(20, phase)).toBe(phase.toDay + 1 - 20);
    expect(daysUntilNextPhase(0, PHASES[PHASES.length - 1]!)).toBe(0);
  });

  it('lists phase start days for notifications, skipping day 0', () => {
    const starts = phaseStartDays('hairline');
    expect(starts[0]).toEqual({ phase: 'shed', day: 15 });
    expect(starts.every((s) => s.day > 0)).toBe(true);
  });
});

describe('maturation progress', () => {
  it('runs from 0 to 1 over the goal-specific window', () => {
    expect(maturationProgress(-4, 'hairline')).toBe(0);
    expect(maturationProgress(180, 'hairline')).toBeCloseTo(0.5, 5);
    expect(maturationProgress(270, 'crown')).toBeCloseTo(0.5, 5);
    expect(maturationProgress(9999, 'crown')).toBe(1);
  });
});

describe('photo cadence', () => {
  it('is weekly for the first 90 days and monthly afterwards', () => {
    expect(photoCadenceDays(0)).toBe(7);
    expect(photoCadenceDays(90)).toBe(7);
    expect(photoCadenceDays(91)).toBe(30);
  });

  it('flags a photo as due only once the cadence has elapsed', () => {
    expect(isPhotoDue(-2, null)).toBe(false);
    expect(isPhotoDue(3, null)).toBe(true);
    expect(isPhotoDue(10, 4)).toBe(false);
    expect(isPhotoDue(11, 4)).toBe(true);
    expect(isPhotoDue(100, 80)).toBe(false);
    expect(isPhotoDue(110, 80)).toBe(true);
  });
});

describe('illustrative band', () => {
  it('always has low <= high within 0..1', () => {
    for (let day = 0; day <= 560; day += 5) {
      const { low, high } = bandAt(day);
      expect(low).toBeGreaterThanOrEqual(0);
      expect(high).toBeLessThanOrEqual(1);
      expect(low).toBeLessThanOrEqual(high);
    }
  });

  it('dips during shedding, then rises toward maturity', () => {
    expect(bandAt(56).high).toBeLessThan(bandAt(0).high);
    expect(bandAt(180).low).toBeGreaterThan(bandAt(90).low);
    expect(bandAt(365).high).toBe(1);
    expect(bandAt(9999)).toEqual({ low: BAND_ANCHORS[BAND_ANCHORS.length - 1]!.low, high: 1 });
  });
});

describe('PRP course', () => {
  it('spaces sessions by whole weeks starting at day 0', () => {
    expect(prpSessionOffsets(3, 4)).toEqual([0, 28, 56]);
    expect(prpSessionOffsets(0, 4)).toEqual([0]);
  });
});

describe('capture angles', () => {
  it('asks every goal for at least one angle and starts with its primary one', () => {
    for (const goal of GOALS) {
      expect(ANGLES_BY_GOAL[goal].length).toBeGreaterThan(0);
    }
    expect(ANGLES_BY_GOAL.crown[0]).toBe('crown');
    expect(ANGLES_BY_GOAL.hairline[0]).toBe('front');
  });
});
