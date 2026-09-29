import {
  cameraFacingFor,
  FLAT_TOLERANCE_DEG,
  type Gravity,
  gateModeFor,
  isPlausibleReading,
  isUpright,
  levelIndicator,
  nextGateState,
  normalizeGravity,
  smoothGravity,
  tiltFor,
  toleranceFor,
  UPRIGHT_TOLERANCE_DEG,
} from '../captureGate';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Portrait phone (iOS convention: upright = y -1, screen-up flat = z -1) leaning back by `p` degrees. */
const uprightLean = (p: number, r = 0): Gravity => ({
  x: Math.sin(rad(r)),
  y: -Math.cos(rad(p)) * Math.cos(rad(r)),
  z: -Math.sin(rad(p)),
});

/** Phone flat with the screen up, one edge raised by `p` (top) and `r` (side) degrees. */
const flatLean = (p: number, r = 0): Gravity => ({
  x: Math.sin(rad(r)),
  y: -Math.sin(rad(p)),
  z: -Math.cos(rad(p)) * Math.cos(rad(r)),
});

describe('gate mode and camera', () => {
  it('uses upright for front/left/right and flat for top/crown', () => {
    expect(gateModeFor('front')).toBe('upright');
    expect(gateModeFor('left')).toBe('upright');
    expect(gateModeFor('right')).toBe('upright');
    expect(gateModeFor('top')).toBe('flat');
    expect(gateModeFor('crown')).toBe('flat');
  });

  it('allows ±7° upright and ±10° flat', () => {
    expect(UPRIGHT_TOLERANCE_DEG).toBe(7);
    expect(FLAT_TOLERANCE_DEG).toBe(10);
    expect(toleranceFor('front')).toBe(7);
    expect(toleranceFor('crown')).toBe(10);
  });

  it('chooses the front camera for face angles and the back camera for top/crown', () => {
    expect(cameraFacingFor('front')).toBe('front');
    expect(cameraFacingFor('left')).toBe('front');
    expect(cameraFacingFor('right')).toBe('front');
    expect(cameraFacingFor('top')).toBe('back');
    expect(cameraFacingFor('crown')).toBe('back');
  });
});

describe('normalizeGravity', () => {
  it('keeps iOS readings as they are', () => {
    expect(normalizeGravity({ x: 0.1, y: -0.9, z: 0.2 }, 'ios')).toEqual({ x: 0.1, y: -0.9, z: 0.2 });
  });

  it('flips the Android sign so upright is y = -1 like iOS', () => {
    const g = normalizeGravity({ x: 0.1, y: 0.9, z: -0.2 }, 'android');
    expect(g.x).toBeCloseTo(-0.1);
    expect(g.y).toBeCloseTo(-0.9);
    expect(g.z).toBeCloseTo(0.2);
    expect(isUpright('front', normalizeGravity({ x: 0, y: 1, z: 0 }, 'android'))).toBe(true);
  });
});

describe('isPlausibleReading', () => {
  it('accepts about 1 g and rejects zero, NaN and hard shaking', () => {
    expect(isPlausibleReading({ x: 0, y: -1, z: 0 })).toBe(true);
    expect(isPlausibleReading({ x: 0, y: 0, z: 0 })).toBe(false);
    expect(isPlausibleReading({ x: Number.NaN, y: -1, z: 0 })).toBe(false);
    expect(isPlausibleReading({ x: 1.5, y: -1.5, z: 0 })).toBe(false);
  });
});

describe('tiltFor', () => {
  it('is zero when the phone is perfectly upright', () => {
    const t = tiltFor('front', { x: 0, y: -1, z: 0 });
    expect(t.pitch).toBeCloseTo(0);
    expect(t.roll).toBeCloseTo(0);
  });

  it('reads the lean back as positive pitch and the side lean as roll', () => {
    expect(tiltFor('front', uprightLean(12)).pitch).toBeCloseTo(12);
    expect(tiltFor('front', uprightLean(-9)).pitch).toBeCloseTo(-9);
    expect(tiltFor('front', uprightLean(0, 5)).roll).toBeCloseTo(5);
  });

  it('is zero when flat with the screen up', () => {
    const t = tiltFor('top', { x: 0, y: 0, z: -1 });
    expect(t.pitch).toBeCloseTo(0);
    expect(t.roll).toBeCloseTo(0);
    expect(tiltFor('top', flatLean(8)).pitch).toBeCloseTo(8);
    expect(tiltFor('top', flatLean(0, -6)).roll).toBeCloseTo(-6);
  });
});

describe('isUpright', () => {
  it('passes inside ±7° for upright angles', () => {
    expect(isUpright('front', uprightLean(0))).toBe(true);
    expect(isUpright('front', uprightLean(6.5))).toBe(true);
    expect(isUpright('left', uprightLean(-6.5))).toBe(true);
    expect(isUpright('right', uprightLean(0, 6.5))).toBe(true);
  });

  it('fails outside ±7° on either axis', () => {
    expect(isUpright('front', uprightLean(7.5))).toBe(false);
    expect(isUpright('front', uprightLean(-8))).toBe(false);
    expect(isUpright('front', uprightLean(0, 8))).toBe(false);
    expect(isUpright('front', uprightLean(5, 5.5))).toBe(true);
    expect(isUpright('front', uprightLean(0, 30))).toBe(false);
  });

  it('fails for a flat phone, a landscape phone and an upside-down phone on upright angles', () => {
    expect(isUpright('front', { x: 0, y: 0, z: -1 })).toBe(false);
    expect(isUpright('front', { x: 1, y: 0, z: 0 })).toBe(false);
    expect(isUpright('front', { x: 0, y: 1, z: 0 })).toBe(false);
  });

  it('passes inside ±10° for flat angles', () => {
    expect(isUpright('top', flatLean(0))).toBe(true);
    expect(isUpright('top', flatLean(9))).toBe(true);
    expect(isUpright('crown', flatLean(-9, 5))).toBe(true);
    expect(isUpright('crown', flatLean(0, -9.5))).toBe(true);
  });

  it('fails outside ±10° for flat angles, and when the screen faces down or the phone is upright', () => {
    expect(isUpright('top', flatLean(11))).toBe(false);
    expect(isUpright('crown', flatLean(0, 12))).toBe(false);
    expect(isUpright('top', { x: 0, y: 0, z: 1 })).toBe(false);
    expect(isUpright('top', { x: 0, y: -1, z: 0 })).toBe(false);
  });
});

describe('nextGateState (hysteresis)', () => {
  it('opens inside the tolerance and stays open a little beyond it', () => {
    expect(nextGateState(false, 'front', uprightLean(6))).toBe(true);
    expect(nextGateState(true, 'front', uprightLean(8))).toBe(true);
    expect(nextGateState(true, 'front', uprightLean(9.5))).toBe(false);
  });

  it('does not open until inside the tolerance', () => {
    expect(nextGateState(false, 'front', uprightLean(8))).toBe(false);
    expect(nextGateState(false, 'top', flatLean(11))).toBe(false);
  });

  it('does not flicker around the boundary', () => {
    let ok = false;
    const flips: boolean[] = [];
    for (const p of [6.5, 7.4, 6.8, 7.6, 7.1, 7.9, 8.4, 9.5, 8, 6.9]) {
      const next = nextGateState(ok, 'front', uprightLean(p));
      if (next !== ok) flips.push(next);
      ok = next;
    }
    // Opens at 6.5, stays open through the band, closes at 9.5, and only reopens inside the tolerance (6.9).
    expect(flips).toEqual([true, false, true]);
  });
});

describe('smoothGravity', () => {
  it('returns the first reading unchanged', () => {
    expect(smoothGravity(null, { x: 0.2, y: -0.9, z: 0.1 })).toEqual({ x: 0.2, y: -0.9, z: 0.1 });
  });

  it('moves part of the way toward a new reading and converges', () => {
    const prev = { x: 0, y: -1, z: 0 };
    const next = { x: 0.5, y: -0.5, z: 0 };
    const once = smoothGravity(prev, next, 0.25);
    expect(once.x).toBeCloseTo(0.125);
    expect(once.y).toBeCloseTo(-0.875);
    let g = prev;
    for (let i = 0; i < 40; i++) g = smoothGravity(g, next, 0.25);
    expect(g.x).toBeCloseTo(0.5, 3);
  });

  it('damps a single spike so the gate does not flip on it', () => {
    let g: Gravity = { x: 0, y: -1, z: 0 };
    for (let i = 0; i < 10; i++) g = smoothGravity(g, { x: 0, y: -1, z: 0 });
    g = smoothGravity(g, uprightLean(25));
    expect(isUpright('front', g)).toBe(true);
  });
});

describe('levelIndicator', () => {
  it('is centered when level', () => {
    const l = levelIndicator('front', { x: 0, y: -1, z: 0 });
    expect(l.x).toBeCloseTo(0);
    expect(l.y).toBeCloseTo(0);
    expect(l.offDeg).toBeCloseTo(0);
  });

  it('moves the bubble to the high side, clamped to -1..1', () => {
    const lean = levelIndicator('front', uprightLean(7));
    expect(lean.y).toBeLessThan(0);
    expect(Math.abs(lean.y)).toBeLessThan(1);
    const side = levelIndicator('front', uprightLean(0, 7));
    expect(side.x).toBeLessThan(0);
    const far = levelIndicator('front', uprightLean(80, -80));
    expect(far.x).toBeGreaterThanOrEqual(-1);
    expect(far.x).toBeLessThanOrEqual(1);
    expect(far.y).toBeGreaterThanOrEqual(-1);
    expect(far.y).toBeLessThanOrEqual(1);
  });

  it('reports the worst axis in degrees', () => {
    expect(levelIndicator('top', flatLean(4, 9)).offDeg).toBeCloseTo(9, 0);
  });
});
