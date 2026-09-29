import type { Angle } from '@shared/catalog';
import { PHASES } from '@shared/timeline';

import {
  addDays,
  bandGeometry,
  buildPrpSessions,
  careRangeFor,
  checkpointsFor,
  chooseNextTask,
  dotPosition,
  endDayFor,
  groupPhotosByWeek,
  isPhaseId,
  journeyClock,
  lastPhotoDay,
  maintenanceDate,
  partOfDay,
  phaseSchedule,
  prpSummary,
  smoothPath,
} from '../phaseView';

const at = (iso: string, hour = 12) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00`);

describe('addDays', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('partOfDay', () => {
  it('splits the day into four calm parts', () => {
    expect(partOfDay(at('2026-09-29', 6))).toBe('morning');
    expect(partOfDay(at('2026-09-29', 13))).toBe('afternoon');
    expect(partOfDay(at('2026-09-29', 19))).toBe('evening');
    expect(partOfDay(at('2026-09-29', 2))).toBe('night');
  });
});

describe('journeyClock', () => {
  it('is unset without a date', () => {
    expect(journeyClock(null, at('2026-09-29'), 'hairline')).toEqual({ status: 'unset' });
  });

  it('counts days until a future operation', () => {
    expect(journeyClock('2026-10-09', at('2026-09-29'), 'hairline')).toEqual({ status: 'upcoming', daysUntil: 10 });
  });

  it('gives day, week, phase and progress on an active journey', () => {
    const clock = journeyClock('2026-09-01', at('2026-09-29'), 'hairline');
    expect(clock.status).toBe('active');
    if (clock.status !== 'active') return;
    expect(clock.day).toBe(28);
    expect(clock.week).toBe(5);
    expect(clock.phase.id).toBe('shed');
    expect(clock.next?.id).toBe('quiet');
    expect(clock.daysToNext).toBe(57 - 28);
    expect(clock.month).toBe(1);
    expect(clock.progress).toBeCloseTo(28 / 360, 5);
  });

  it('treats the operation day as day 0 in the care phase', () => {
    const clock = journeyClock('2026-09-29', at('2026-09-29'), 'hairline');
    expect(clock.status === 'active' && clock.day).toBe(0);
    expect(clock.status === 'active' && clock.phase.id).toBe('care');
  });

  it('completes after the window for the goal', () => {
    expect(journeyClock('2025-01-01', at('2026-09-29'), 'hairline').status).toBe('complete');
    // crown keeps going up to 18 months
    expect(journeyClock('2025-06-01', at('2026-09-29'), 'crown').status).toBe('active');
  });
});

describe('phaseSchedule', () => {
  it('computes dates from the operation date', () => {
    const rows = phaseSchedule('2026-09-01', 'hairline');
    expect(rows.map((r) => r.id)).toEqual(PHASES.map((p) => p.id));
    expect(rows[0]).toMatchObject({ id: 'care', startDate: '2026-09-01', endDate: '2026-09-15' });
    expect(rows[1]).toMatchObject({ id: 'shed', startDate: '2026-09-16' });
    expect(rows[1]?.anxious).toBe(true);
  });

  it('has no dates before the operation date is set', () => {
    const rows = phaseSchedule(null, 'hairline');
    expect(rows[0]?.startDate).toBeNull();
    expect(rows[0]?.fromDay).toBe(0);
  });

  it('clips the last phase to the goal window', () => {
    expect(endDayFor('hairline')).toBe(456);
    expect(endDayFor('crown')).toBe(548);
    expect(phaseSchedule(null, 'hairline').at(-1)?.toDay).toBe(456);
    expect(phaseSchedule(null, 'part').at(-1)?.toDay).toBe(548);
  });
});

describe('band geometry', () => {
  const geo = bandGeometry({ width: 300, height: 120, padX: 10, padY: 10, goal: 'hairline' });

  it('maps days across the padded width', () => {
    expect(geo.xForDay(0)).toBe(10);
    expect(geo.xForDay(endDayFor('hairline'))).toBe(290);
    expect(geo.xForDay(-30)).toBe(10);
    expect(geo.xForDay(9999)).toBe(290);
  });

  it('keeps every sampled point inside the drawing area with low below high', () => {
    for (const p of geo.points) {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(290);
      expect(p.yHigh).toBeGreaterThanOrEqual(10);
      expect(p.yLow).toBeLessThanOrEqual(110);
      expect(p.yLow).toBeGreaterThanOrEqual(p.yHigh);
    }
  });

  it('builds a closed area path and one boundary per later phase', () => {
    expect(geo.areaPath.startsWith('M')).toBe(true);
    expect(geo.areaPath.endsWith('Z')).toBe(true);
    expect(geo.boundaries).toHaveLength(PHASES.length - 1);
  });

  it('places the dot on the middle of the band and clamps the day', () => {
    const early = dotPosition(geo, 0);
    const late = dotPosition(geo, 400);
    expect(early.x).toBe(10);
    expect(late.x).toBeGreaterThan(early.x);
    // the band rises: a later dot sits higher on screen (smaller y)
    expect(late.y).toBeLessThan(dotPosition(geo, 56).y);
    expect(dotPosition(geo, 99999).x).toBe(290);
  });

  it('smooths through points with cubic segments', () => {
    const path = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ]);
    expect(path.startsWith('M0 0')).toBe(true);
    expect(path.match(/C/g)).toHaveLength(2);
    expect(smoothPath([])).toBe('');
  });
});

describe('careRangeFor', () => {
  it('maps the first fortnight onto the three care ranges', () => {
    expect(careRangeFor(0)).toBe('d0_3');
    expect(careRangeFor(3)).toBe('d0_3');
    expect(careRangeFor(4)).toBe('d4_7');
    expect(careRangeFor(7)).toBe('d4_7');
    expect(careRangeFor(8)).toBe('d8_14');
    expect(careRangeFor(14)).toBe('d8_14');
    expect(careRangeFor(15)).toBeNull();
    expect(careRangeFor(-1)).toBeNull();
  });
});

describe('isPhaseId', () => {
  it('accepts only known phases', () => {
    expect(isPhaseId('shed')).toBe(true);
    expect(isPhaseId('nope')).toBe(false);
    expect(isPhaseId(undefined)).toBe(false);
  });
});

describe('lastPhotoDay and groupPhotosByWeek', () => {
  const photo = (id: string, iso: string, angle: Angle = 'front') => ({ id, uri: `file://${id}.jpg`, takenAt: at(iso).getTime(), angle });

  it('returns the day index of the latest photo', () => {
    expect(lastPhotoDay([], '2026-09-01')).toBeNull();
    expect(lastPhotoDay([photo('a', '2026-09-08'), photo('b', '2026-09-15')], '2026-09-01')).toBe(14);
    expect(lastPhotoDay([photo('a', '2026-09-08')], null)).toBeNull();
  });

  it('groups by week, newest week first, before-operation photos last', () => {
    const groups = groupPhotosByWeek(
      [photo('pre', '2026-08-30'), photo('a', '2026-09-02'), photo('b', '2026-09-04', 'top'), photo('c', '2026-09-10')],
      '2026-09-01',
    );
    expect(groups.map((g) => g.kind)).toEqual(['week', 'week', 'before']);
    expect(groups[0]).toMatchObject({ week: 2 });
    expect(groups[1]?.photos.map((p) => p.id)).toEqual(['a', 'b']);
    expect(groups[2]?.photos.map((p) => p.id)).toEqual(['pre']);
  });

  it('groups by calendar month when no date is set', () => {
    const groups = groupPhotosByWeek([photo('a', '2026-09-02'), photo('b', '2026-08-02')], null);
    expect(groups.map((g) => g.kind)).toEqual(['undated', 'undated']);
    expect(groups[0]?.key).toBe('m-2026-09');
  });

  it('filters by angle', () => {
    const groups = groupPhotosByWeek([photo('a', '2026-09-02'), photo('b', '2026-09-04', 'top')], '2026-09-01', 'top');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.photos.map((p) => p.id)).toEqual(['b']);
  });
});

describe('checkpointsFor', () => {
  it('lists 3/6/9/12 months for a hairline and adds 18 for crown', () => {
    expect(checkpointsFor('hairline', '2026-01-01', [], 10).map((c) => c.month)).toEqual([3, 6, 9, 12]);
    expect(checkpointsFor('crown', '2026-01-01', [], 10).map((c) => c.month)).toEqual([3, 6, 9, 12, 18]);
  });

  it('marks a checkpoint done when a photo exists near it, due inside the window, upcoming before', () => {
    const list = checkpointsFor('hairline', '2026-01-01', [92, 200], 185);
    expect(list.find((c) => c.month === 3)?.status).toBe('done');
    expect(list.find((c) => c.month === 6)?.status).toBe('due');
    expect(list.find((c) => c.month === 9)?.status).toBe('upcoming');
    expect(list.find((c) => c.month === 3)?.date).toBe('2026-04-01');
  });

  it('marks a missed checkpoint as missed once its window has passed', () => {
    const list = checkpointsFor('hairline', '2026-01-01', [], 200);
    expect(list.find((c) => c.month === 3)?.status).toBe('missed');
  });

  it('has no dates without an operation date', () => {
    expect(checkpointsFor('hairline', null, [], 0)[0]?.date).toBeNull();
  });
});

describe('PRP helpers', () => {
  it('builds the default three sessions four weeks apart', () => {
    let n = 0;
    const sessions = buildPrpSessions('2026-10-01', () => `s${++n}`);
    expect(sessions).toEqual([
      { id: 's1', date: '2026-10-01', done: false },
      { id: 's2', date: '2026-10-29', done: false },
      { id: 's3', date: '2026-11-26', done: false },
    ]);
  });

  it('summarises progress', () => {
    const sessions = [
      { id: 'a', date: '2026-09-01', done: true },
      { id: 'b', date: '2026-09-29', done: false },
      { id: 'c', date: '2026-10-27', done: false },
    ];
    const today = prpSummary(sessions, '2026-09-29');
    expect(today).toMatchObject({ total: 3, done: 1, current: 2, allDone: false, dueNow: true });
    expect(today.next?.id).toBe('b');
    expect(today.daysToNext).toBe(0);
    const earlier = prpSummary(sessions, '2026-09-20');
    expect(earlier.dueNow).toBe(false);
    expect(earlier.daysToNext).toBe(9);
    const finished = prpSummary(sessions.map((s) => ({ ...s, done: true })), '2026-11-01');
    expect(finished).toMatchObject({ allDone: true, current: 3, next: null });
  });

  it('places maintenance six months after the last session', () => {
    expect(maintenanceDate([{ id: 'a', date: '2026-10-01', done: false }], 6)).toBe('2027-04-01');
    expect(maintenanceDate([], 6)).toBeNull();
    expect(maintenanceDate([{ id: 'a', date: '2026-08-31', done: false }], 6)).toBe('2027-02-28');
  });
});

describe('chooseNextTask', () => {
  const base = {
    kind: 'transplant' as const,
    goal: 'hairline' as const,
    hasPhotos: true,
    lastPhotoDay: 20 as number | null,
    carePending: false,
    shedLoggedToday: true,
    prp: null,
  };
  const active = (iso: string, from = '2026-09-01') => journeyClock(from, at(iso), 'hairline');

  it('asks for nothing before a date is set', () => {
    expect(chooseNextTask({ ...base, clock: { status: 'unset' } })).toEqual({ kind: 'none' });
  });

  it('suggests a baseline photo before the operation when there is none', () => {
    const clock = journeyClock('2026-10-09', at('2026-09-29'), 'hairline');
    expect(chooseNextTask({ ...base, clock, hasPhotos: false, lastPhotoDay: null })).toEqual({ kind: 'baseline_photo', angle: 'front' });
    expect(chooseNextTask({ ...base, clock, hasPhotos: true })).toEqual({ kind: 'none' });
  });

  it('puts the care checklist first in days 0 to 14', () => {
    expect(chooseNextTask({ ...base, clock: active('2026-09-05'), carePending: true, lastPhotoDay: null })).toEqual({ kind: 'care' });
  });

  it('moves to the photo when the care list is done and a photo is due', () => {
    expect(chooseNextTask({ ...base, clock: active('2026-09-05'), lastPhotoDay: null })).toEqual({
      kind: 'photo',
      cadence: 'weekly',
      first: true,
      angle: 'front',
    });
  });

  it('nudges the shed log in days 15 to 56 when no photo is due', () => {
    const clock = active('2026-09-25'); // day 24
    expect(chooseNextTask({ ...base, clock, lastPhotoDay: 22, shedLoggedToday: false })).toEqual({ kind: 'shed' });
    expect(chooseNextTask({ ...base, clock, lastPhotoDay: 22, shedLoggedToday: true })).toMatchObject({ kind: 'caught_up' });
  });

  it('uses the monthly cadence after day 90 and reports days to the next photo', () => {
    const clock = journeyClock('2026-01-01', at('2026-05-01'), 'hairline'); // day 120
    const task = chooseNextTask({ ...base, clock, lastPhotoDay: 110 });
    expect(task).toEqual({ kind: 'caught_up', nextPhotoInDays: 20 });
    expect(chooseNextTask({ ...base, clock, lastPhotoDay: 80 })).toMatchObject({ kind: 'photo', cadence: 'monthly', first: false });
  });

  it('never recommends a shed log outside the shedding window', () => {
    const clock = journeyClock('2026-01-01', at('2026-05-01'), 'hairline');
    expect(chooseNextTask({ ...base, clock, lastPhotoDay: 118, shedLoggedToday: false }).kind).toBe('caught_up');
  });

  it('handles the PRP course', () => {
    const sessions = [
      { id: 'a', date: '2026-09-29', done: false },
      { id: 'b', date: '2026-10-27', done: false },
    ];
    const clock = journeyClock('2026-09-29', at('2026-09-29'), 'part');
    const due = chooseNextTask({ ...base, kind: 'prp', goal: 'part', clock, prp: prpSummary(sessions, '2026-09-29') });
    expect(due).toEqual({ kind: 'prp_due', sessionId: 'a', daysOverdue: 0, angle: 'top' });
    const later = chooseNextTask({ ...base, kind: 'prp', goal: 'part', clock, prp: prpSummary(sessions, '2026-09-10') });
    expect(later).toMatchObject({ kind: 'caught_up', nextSessionInDays: 19 });
    const done = chooseNextTask({
      ...base,
      kind: 'prp',
      goal: 'part',
      clock,
      prp: prpSummary(sessions.map((s) => ({ ...s, done: true })), '2026-09-29'),
    });
    expect(done).toMatchObject({ kind: 'caught_up' });
  });
});
