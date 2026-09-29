import { ANGLES, GOALS, isValidRegionHint, REGION_HINT_MAX_POINTS } from '@shared/catalog';

import { browLineY, fitFrame, FRAME_ASPECT, guideOval, regionHintFor } from '../guide';

describe('guideOval', () => {
  it('stays inside the frame for every angle', () => {
    for (const angle of ANGLES) {
      const o = guideOval(angle);
      expect(o.cx - o.rx).toBeGreaterThan(0);
      expect(o.cx + o.rx).toBeLessThan(1);
      expect(o.cy - o.ry).toBeGreaterThan(0);
      expect(o.cy + o.ry).toBeLessThan(1);
    }
  });

  it('draws a face oval that is taller than wide in pixels for face angles', () => {
    const o = guideOval('front');
    // normalized ry is relative to the frame height: convert to pixels of a 3:4 frame
    expect(o.ry / FRAME_ASPECT).toBeGreaterThan(o.rx);
  });

  it('draws a roughly round scalp guide for top and crown', () => {
    const o = guideOval('crown');
    expect(Math.abs(o.ry / FRAME_ASPECT - o.rx)).toBeLessThan(0.03);
  });
});

describe('regionHintFor', () => {
  it('is a valid normalized polygon for every angle and goal', () => {
    for (const angle of ANGLES) {
      expect(isValidRegionHint(regionHintFor(angle))).toBe(true);
      for (const goal of GOALS) {
        const hint = regionHintFor(angle, goal);
        expect(isValidRegionHint(hint)).toBe(true);
        expect(hint.points.length).toBeLessThanOrEqual(REGION_HINT_MAX_POINTS);
      }
    }
  });

  it('covers the hairline zone above the brow line for the front angle', () => {
    const hint = regionHintFor('front', 'hairline');
    const brow = browLineY(guideOval('front'));
    const ys = hint.points.map((p) => p.y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(brow + 1e-3);
    expect(Math.min(...ys)).toBeLessThan(guideOval('front').cy - guideOval('front').ry);
    const xs = hint.points.map((p) => p.x);
    expect(Math.min(...xs)).toBeLessThan(0.5);
    expect(Math.max(...xs)).toBeGreaterThan(0.5);
  });

  it('is symmetric around the frame center line for the front angle', () => {
    const hint = regionHintFor('front');
    const mean = hint.points.reduce((sum, p) => sum + p.x, 0) / hint.points.length;
    expect(mean).toBeCloseTo(0.5, 5);
  });

  it('covers the scalp disc for top and crown', () => {
    for (const angle of ['top', 'crown'] as const) {
      const hint = regionHintFor(angle, 'crown');
      const cx = hint.points.reduce((s, p) => s + p.x, 0) / hint.points.length;
      const cy = hint.points.reduce((s, p) => s + p.y, 0) / hint.points.length;
      expect(cx).toBeCloseTo(0.5, 2);
      expect(cy).toBeCloseTo(guideOval(angle).cy, 2);
      expect(Math.min(...hint.points.map((p) => p.y))).toBeLessThan(cy);
      expect(Math.max(...hint.points.map((p) => p.y))).toBeGreaterThan(cy);
    }
  });

  it('puts a brows hint around the brow line and a beard hint below the mouth line', () => {
    const oval = guideOval('front');
    const brow = browLineY(oval);
    const brows = regionHintFor('front', 'brows');
    const ys = brows.points.map((p) => p.y);
    expect(Math.min(...ys)).toBeLessThan(brow);
    expect(Math.max(...ys)).toBeGreaterThan(brow);
    const beard = regionHintFor('front', 'beard');
    expect(Math.min(...beard.points.map((p) => p.y))).toBeGreaterThan(oval.cy);
  });
});

describe('fitFrame', () => {
  it('fills the width when the space is tall enough', () => {
    expect(fitFrame(300, 900)).toEqual({ width: 300, height: 400 });
  });

  it('fits by height when the space is short', () => {
    const f = fitFrame(400, 300);
    expect(f.height).toBe(300);
    expect(f.width).toBeCloseTo(225);
  });

  it('never returns a negative size', () => {
    expect(fitFrame(-1, -1)).toEqual({ width: 0, height: 0 });
  });
});
