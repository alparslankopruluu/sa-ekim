import {
  DENSITIES,
  GOALS,
  getStyle,
  isValidRegionHint,
  STYLE_IDS,
  STYLES,
  stylesForGoal,
} from '@shared/catalog';
import { previewCost } from '@shared/pricing';
import { PACKAGES, packForProductId, planForProductId } from '@shared/products';
import { checkFreeText, isValidIdempotencyKey, parseShedCount } from '@shared/validation';

describe('style catalog', () => {
  it('declares every style id exactly once with valid densities', () => {
    expect(STYLES.map((s) => s.id).sort()).toEqual([...STYLE_IDS].sort());
    for (const style of STYLES) {
      expect(style.densities.length).toBeGreaterThan(0);
      for (const density of style.densities) expect(DENSITIES).toContain(density);
    }
  });

  it('gives every goal at least three styles and resolves ids', () => {
    for (const goal of GOALS) expect(stylesForGoal(goal).length).toBeGreaterThanOrEqual(3);
    expect(getStyle('hairline_soft')?.goal).toBe('hairline');
    expect(getStyle('nope')).toBeUndefined();
  });
});

describe('region hint', () => {
  const square = [
    { x: 0.2, y: 0.1 },
    { x: 0.8, y: 0.1 },
    { x: 0.8, y: 0.4 },
    { x: 0.2, y: 0.4 },
  ];

  it('accepts a normalized polygon and rejects malformed ones', () => {
    expect(isValidRegionHint({ points: square })).toBe(true);
    expect(isValidRegionHint({ points: square.slice(0, 2) })).toBe(false);
    expect(isValidRegionHint({ points: [...square, { x: 1.2, y: 0.5 }] })).toBe(false);
    expect(isValidRegionHint({ points: Array.from({ length: 40 }, () => ({ x: 0.5, y: 0.5 })) })).toBe(false);
    expect(isValidRegionHint(null)).toBe(false);
    expect(isValidRegionHint({ points: 'x' })).toBe(false);
  });
});

describe('pricing and products', () => {
  it('charges 1 credit standard and 3 high', () => {
    expect(previewCost('standard')).toBe(1);
    expect(previewCost('high')).toBe(3);
  });

  it('maps store product ids to plans and packs across both stores', () => {
    expect(planForProductId('com.techtactoe.kok.pro.weekly')).toBe('weekly');
    expect(planForProductId('com.techtactoe.kok.pro.monthly')).toBe('monthly');
    expect(planForProductId('com.techtactoe.kok.pro.annual.gift')).toBe('annual');
    expect(planForProductId('pro:yearly')).toBe('annual');
    expect(planForProductId('com.techtactoe.kok.credits_10')).toBeNull();
    expect(packForProductId('com.techtactoe.kok.credits_25')).toBe('credits_25');
    expect(packForProductId('credits_60')).toBe('credits_60');
    expect(packForProductId('credits_600')).toBeNull();
    expect(PACKAGES.monthly).toBe('$rc_monthly');
  });
});

describe('validation', () => {
  it('parses shed counts strictly', () => {
    expect(parseShedCount('0')).toBe(0);
    expect(parseShedCount(' 42 ')).toBe(42);
    expect(parseShedCount('999')).toBe(999);
    expect(parseShedCount('1000')).toBeNull();
    expect(parseShedCount('-1')).toBeNull();
    expect(parseShedCount('4.5')).toBeNull();
    expect(parseShedCount('')).toBeNull();
  });

  it('bounds free text and blocks abuse', () => {
    expect(checkFreeText('Istanbul Hair Clinic', 60)).toBe('ok');
    expect(checkFreeText('   ', 60)).toBe('too_short');
    expect(checkFreeText('x'.repeat(61), 60)).toBe('too_long');
    expect(checkFreeText('bad\u0007text', 60)).toBe('blocked');
  });

  it('accepts only safe idempotency keys', () => {
    expect(isValidIdempotencyKey('3f2b8c1e-9d7a-4c55-a1b2-0123456789ab')).toBe(true);
    expect(isValidIdempotencyKey('short')).toBe(false);
    expect(isValidIdempotencyKey('../../etc/passwd')).toBe(false);
    expect(isValidIdempotencyKey(42)).toBe(false);
  });
});
