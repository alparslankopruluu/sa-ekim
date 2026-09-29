import type { JourneyPhoto } from '@/stores/journey';

import { angleMismatch, defaultPair, resolvePair, sameAngleCount, weekLabelFor } from '../compareLogic';

const day = (n: number) => new Date(2026, 8, 1 + n, 12).getTime();

function photo(id: string, angle: JourneyPhoto['angle'], n: number): JourneyPhoto {
  return { id, uri: `file:///journey/${id}.jpg`, takenAt: day(n), angle };
}

describe('weekLabelFor', () => {
  it('labels photos before the operation day as "before"', () => {
    expect(weekLabelFor(day(-3), '2026-09-01')).toEqual({ kind: 'before' });
  });

  it('labels the operation day and its week as week 1', () => {
    expect(weekLabelFor(day(0), '2026-09-01')).toEqual({ kind: 'week', week: 1 });
    expect(weekLabelFor(day(6), '2026-09-01')).toEqual({ kind: 'week', week: 1 });
  });

  it('counts weeks from the operation date', () => {
    expect(weekLabelFor(day(7), '2026-09-01')).toEqual({ kind: 'week', week: 2 });
    expect(weekLabelFor(day(20), '2026-09-01')).toEqual({ kind: 'week', week: 3 });
    expect(weekLabelFor(day(365), '2026-09-01')).toEqual({ kind: 'week', week: 53 });
  });

  it('has no label without an operation date', () => {
    expect(weekLabelFor(day(10), null)).toEqual({ kind: 'none' });
  });
});

describe('defaultPair', () => {
  it('pairs the first and the latest photo of the same angle', () => {
    const photos = [photo('a', 'front', -2), photo('b', 'front', 10), photo('c', 'front', 40), photo('d', 'top', 5)];
    const pair = defaultPair(photos, 'hairline');
    expect(pair?.a.id).toBe('a');
    expect(pair?.b.id).toBe('c');
  });

  it('prefers the primary angle of the goal, then any angle with two photos', () => {
    const photos = [photo('t1', 'top', 0), photo('t2', 'top', 9), photo('f1', 'front', 3)];
    expect(defaultPair(photos, 'part')?.a.angle).toBe('top');
    expect(defaultPair(photos, 'hairline')?.a.angle).toBe('top');
  });

  it('returns null with fewer than two photos of any single angle', () => {
    expect(defaultPair([], 'hairline')).toBeNull();
    expect(defaultPair([photo('a', 'front', 0)], 'hairline')).toBeNull();
    expect(defaultPair([photo('a', 'front', 0), photo('b', 'top', 4)], 'hairline')).toBeNull();
  });
});

describe('resolvePair', () => {
  const photos = [photo('a', 'front', 0), photo('b', 'front', 14), photo('c', 'front', 28), photo('d', 'top', 30)];

  it('uses both ids when given, older photo first', () => {
    const pair = resolvePair(photos, { a: 'c', b: 'a' }, 'hairline');
    expect(pair?.a.id).toBe('a');
    expect(pair?.b.id).toBe('c');
  });

  it('partners a single id with the latest other photo of the same angle', () => {
    expect(resolvePair(photos, { a: 'a' }, 'hairline')?.b.id).toBe('c');
    // the latest photo itself pairs with the first one of its angle
    const pair = resolvePair(photos, { a: 'c' }, 'hairline');
    expect(pair?.a.id).toBe('a');
    expect(pair?.b.id).toBe('c');
  });

  it('falls back to any other photo when the angle has no partner', () => {
    const pair = resolvePair(photos, { a: 'd' }, 'hairline');
    expect(pair?.a.id).toBe('c');
    expect(pair?.b.id).toBe('d');
  });

  it('ignores unknown ids and falls back to the default pair', () => {
    const pair = resolvePair(photos, { a: 'nope', b: 'also-nope' }, 'hairline');
    expect(pair?.a.id).toBe('a');
    expect(pair?.b.id).toBe('c');
  });

  it('is null with fewer than two photos', () => {
    expect(resolvePair([photo('a', 'front', 0)], { a: 'a' }, 'hairline')).toBeNull();
    expect(resolvePair([], {}, null)).toBeNull();
  });
});

describe('angle helpers', () => {
  it('flags a pair of different angles', () => {
    expect(angleMismatch(photo('a', 'front', 0), photo('b', 'top', 1))).toBe(true);
    expect(angleMismatch(photo('a', 'front', 0), photo('b', 'front', 1))).toBe(false);
  });

  it('counts photos of an angle', () => {
    expect(sameAngleCount([photo('a', 'front', 0), photo('b', 'front', 1), photo('c', 'top', 2)], 'front')).toBe(2);
  });
});
