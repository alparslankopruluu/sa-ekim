import {
  checkProcedureDate,
  clampParts,
  dateFieldOrder,
  daysInMonth,
  describeDay,
  initialParts,
  isoToParts,
  monthLabel,
  partsToIso,
  yearRange,
} from '../procedureDate';

const now = new Date(2026, 8, 29, 12, 0, 0); // 29 Sep 2026, local

describe('procedureDate parts', () => {
  it('knows month lengths including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('round-trips ISO strings', () => {
    expect(partsToIso({ year: 2026, month: 3, day: 7 })).toBe('2026-03-07');
    expect(isoToParts('2026-03-07')).toEqual({ year: 2026, month: 3, day: 7 });
    expect(isoToParts('2026-02-31')).toBeNull();
    expect(isoToParts('nope')).toBeNull();
  });

  it('clamps the day when the month changes', () => {
    expect(clampParts({ year: 2026, month: 2, day: 31 })).toEqual({ year: 2026, month: 2, day: 28 });
    expect(clampParts({ year: 2026, month: 5, day: 31 })).toEqual({ year: 2026, month: 5, day: 31 });
    expect(clampParts({ year: 2026, month: 5, day: 0 })).toEqual({ year: 2026, month: 5, day: 1 });
  });

  it('starts on today', () => {
    expect(initialParts(now)).toEqual({ year: 2026, month: 9, day: 29 });
  });
});

describe('checkProcedureDate', () => {
  it('accepts a future date for planned and a past date for done', () => {
    const future = checkProcedureDate({ year: 2026, month: 11, day: 3 }, 'planned', now);
    expect(future).toMatchObject({ ok: true, iso: '2026-11-03' });
    const past = checkProcedureDate({ year: 2026, month: 8, day: 1 }, 'done', now);
    expect(past).toMatchObject({ ok: true, iso: '2026-08-01' });
  });

  it('accepts today for both', () => {
    expect(checkProcedureDate({ year: 2026, month: 9, day: 29 }, 'planned', now)).toMatchObject({ ok: true });
    expect(checkProcedureDate({ year: 2026, month: 9, day: 29 }, 'done', now)).toMatchObject({ ok: true });
  });

  it('rejects a past date for planned and a future date for done', () => {
    expect(checkProcedureDate({ year: 2026, month: 9, day: 1 }, 'planned', now)).toEqual({ ok: false, reason: 'must_be_future' });
    expect(checkProcedureDate({ year: 2026, month: 10, day: 1 }, 'done', now)).toEqual({ ok: false, reason: 'must_be_past' });
  });

  it('rejects impossible dates', () => {
    expect(checkProcedureDate({ year: 2026, month: 2, day: 30 }, 'done', now)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects dates far outside the useful window', () => {
    expect(checkProcedureDate({ year: 2015, month: 1, day: 1 }, 'done', now)).toEqual({ ok: false, reason: 'too_far' });
    expect(checkProcedureDate({ year: 2031, month: 1, day: 1 }, 'planned', now)).toEqual({ ok: false, reason: 'too_far' });
  });

  it('reports the day index from the shared timeline', () => {
    const result = checkProcedureDate({ year: 2026, month: 9, day: 8 }, 'done', now);
    expect(result).toMatchObject({ ok: true, dayIndex: 21 });
  });
});

describe('describeDay', () => {
  it('describes past, today and future days', () => {
    expect(describeDay(21)).toEqual({ kind: 'past', day: 21, week: 4 });
    expect(describeDay(0)).toEqual({ kind: 'today', day: 0, week: 1 });
    expect(describeDay(-12)).toEqual({ kind: 'future', days: 12 });
  });
});

describe('yearRange', () => {
  it('lists the selectable years per stage', () => {
    expect(yearRange('done', now)).toEqual([2023, 2024, 2025, 2026]);
    expect(yearRange('planned', now)).toEqual([2026, 2027, 2028]);
  });
});

describe('locale helpers', () => {
  it('orders the wheels by locale', () => {
    expect(dateFieldOrder('en-US')).toEqual(['month', 'day', 'year']);
    expect(dateFieldOrder('tr')).toEqual(['day', 'month', 'year']);
    expect(dateFieldOrder('ja')).toEqual(['year', 'month', 'day']);
    expect(dateFieldOrder('xx-not-a-locale-!!')).toEqual(['day', 'month', 'year']);
  });

  it('labels months in the locale', () => {
    expect(monthLabel('en', 1)).toBe('January');
    expect(monthLabel('tr', 1)).toBe('Ocak');
  });
});
