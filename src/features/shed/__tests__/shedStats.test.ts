import {
  addDays,
  barFraction,
  chartMax,
  clampedAdd,
  inShedWindow,
  recentDays,
  SHED_WINDOW,
  todayCount,
  weeklyAverage,
} from '../shedStats';

const TODAY = '2026-09-29';

describe('addDays', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-09-29', -29)).toBe('2026-08-31');
    expect(addDays('2026-01-02', -3)).toBe('2025-12-30');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('SHED_WINDOW / inShedWindow', () => {
  it('is days 15–56, the shed phase of the timeline', () => {
    expect(SHED_WINDOW).toEqual({ from: 15, to: 56 });
    expect(inShedWindow(14)).toBe(false);
    expect(inShedWindow(15)).toBe(true);
    expect(inShedWindow(56)).toBe(true);
    expect(inShedWindow(57)).toBe(false);
    expect(inShedWindow(-3)).toBe(false);
  });
});

describe('recentDays', () => {
  const entries = [
    { date: '2026-09-27', count: 40 },
    { date: '2026-09-29', count: 25 },
    { date: '2026-07-01', count: 99 },
  ];

  it('returns `span` days, oldest first, ending today', () => {
    const days = recentDays(entries, TODAY, 30, null);
    expect(days).toHaveLength(30);
    expect(days[0]?.date).toBe('2026-08-31');
    expect(days[29]?.date).toBe(TODAY);
    expect(days[29]?.isToday).toBe(true);
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it('fills logged counts and leaves missing days as null (not zero)', () => {
    const days = recentDays(entries, TODAY, 30, null);
    expect(days[29]?.count).toBe(25);
    expect(days[27]?.count).toBe(40);
    expect(days[28]?.count).toBeNull();
    expect(days.some((d) => d.count === 99)).toBe(false);
  });

  it('marks the shed window from the operation date, and nothing without one', () => {
    // Operation on 2026-09-01 -> today is day 28, the 30-day window starts on day -1.
    const days = recentDays(entries, TODAY, 30, '2026-09-01');
    expect(days.find((d) => d.date === '2026-08-31')?.inWindow).toBe(false); // day -1
    expect(days.find((d) => d.date === '2026-09-15')?.inWindow).toBe(false); // day 14
    expect(days.find((d) => d.date === '2026-09-16')?.inWindow).toBe(true); // day 15
    expect(days[29]?.inWindow).toBe(true); // day 28
    expect(recentDays(entries, TODAY, 30, null).every((d) => !d.inWindow)).toBe(true);
  });

  it('supports the compact 14-day span', () => {
    expect(recentDays(entries, TODAY, 14, null)).toHaveLength(14);
  });
});

describe('todayCount', () => {
  it('returns today or null', () => {
    expect(todayCount([{ date: TODAY, count: 12 }], TODAY)).toBe(12);
    expect(todayCount([{ date: '2026-09-28', count: 12 }], TODAY)).toBeNull();
    expect(todayCount([], TODAY)).toBeNull();
  });
});

describe('weeklyAverage', () => {
  it('averages the days logged in the last 7 days (today included), rounded', () => {
    const entries = [
      { date: '2026-09-29', count: 30 },
      { date: '2026-09-27', count: 21 },
      { date: '2026-09-23', count: 12 }, // 6 days ago: inside
      { date: '2026-09-22', count: 300 }, // 7 days ago: outside
    ];
    expect(weeklyAverage(entries, TODAY)).toBe(21);
  });

  it('is null when nothing was logged this week', () => {
    expect(weeklyAverage([], TODAY)).toBeNull();
    expect(weeklyAverage([{ date: '2026-09-01', count: 10 }], TODAY)).toBeNull();
  });
});

describe('chart scaling', () => {
  it('uses at least 20 so a few hairs do not fill the chart', () => {
    expect(chartMax([{ date: TODAY, count: 3, isToday: true, inWindow: false }])).toBe(20);
    expect(chartMax([])).toBe(20);
  });

  it('rounds the largest count up to the next 10', () => {
    expect(chartMax([{ date: TODAY, count: 47, isToday: true, inWindow: false }])).toBe(50);
    expect(chartMax([{ date: TODAY, count: 120, isToday: true, inWindow: false }])).toBe(120);
  });

  it('turns a count into a 0..1 bar fraction, with a visible sliver for small counts', () => {
    expect(barFraction(0, 50)).toBe(0);
    expect(barFraction(50, 50)).toBe(1);
    expect(barFraction(25, 50)).toBe(0.5);
    expect(barFraction(1, 1000)).toBeGreaterThan(0.02);
    expect(barFraction(999, 50)).toBe(1);
  });
});

describe('clampedAdd', () => {
  it('adds a quick step to the current value and caps at the maximum', () => {
    expect(clampedAdd(null, 10)).toBe(10);
    expect(clampedAdd(15, 25)).toBe(40);
    expect(clampedAdd(990, 25)).toBe(999);
  });
});
