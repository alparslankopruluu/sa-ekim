import { clampIso, dateFieldOrder, daysInMonth, monthLabels, parseIso, toIso, yearRange } from '../dateWheel';

describe('dateWheel helpers', () => {
  it('knows month lengths including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('clamps the day when the month is shorter', () => {
    expect(toIso(2026, 2, 31)).toBe('2026-02-28');
    expect(toIso(2026, 9, 5)).toBe('2026-09-05');
    expect(parseIso('2026-09-05')).toEqual({ year: 2026, month: 9, day: 5 });
  });

  it('builds an inclusive year range', () => {
    expect(yearRange(2026, 2, 1)).toEqual([2024, 2025, 2026, 2027]);
  });

  it('clamps into a min/max window', () => {
    expect(clampIso('2026-01-01', '2026-03-01', '2026-06-01')).toBe('2026-03-01');
    expect(clampIso('2026-09-01', '2026-03-01', '2026-06-01')).toBe('2026-06-01');
    expect(clampIso('2026-04-01', '2026-03-01', '2026-06-01')).toBe('2026-04-01');
    expect(clampIso('2026-04-01')).toBe('2026-04-01');
  });

  it('follows the locale field order', () => {
    expect(dateFieldOrder('en-US')).toEqual(['month', 'day', 'year']);
    expect(dateFieldOrder('tr')).toEqual(['day', 'month', 'year']);
    expect(dateFieldOrder('not-a-locale-🙂')).toEqual(['day', 'month', 'year']);
  });

  it('lists twelve month names', () => {
    const months = monthLabels('en');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('January');
  });
});
