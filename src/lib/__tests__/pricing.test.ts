import {
  CREDIT_PACKS,
  creditsForPack,
  FREE_LIMITS,
  FREE_PREVIEW,
  PLAN_ALLOWANCE,
  PREVIEW_COST,
  PREVIEW_PROVIDER_USD,
  previewCost,
} from '@shared/pricing';
import { packForProductId, planForProductId } from '@shared/products';

describe('pricing', () => {
  it('charges 1 credit for standard and 3 for high', () => {
    expect(previewCost('standard')).toBe(1);
    expect(previewCost('high')).toBe(3);
    expect(PREVIEW_COST).toEqual({ standard: 1, high: 3 });
  });

  it('gives the free onboarding preview as standard and watermarked', () => {
    expect(FREE_PREVIEW).toEqual({ quality: 'standard', watermarked: true });
  });

  it('knows exactly the three credit packs', () => {
    expect(CREDIT_PACKS.map((p) => [p.id, p.credits])).toEqual([
      ['credits_10', 10],
      ['credits_25', 25],
      ['credits_60', 60],
    ]);
    for (const pack of CREDIT_PACKS) expect(creditsForPack(pack.id)).toBe(pack.credits);
    expect(creditsForPack('credits_999')).toBeNull();
    expect(creditsForPack('credits_100')).toBeNull();
  });

  it('grants a plan allowance and there is no trial concept in it', () => {
    for (const plan of ['weekly', 'monthly', 'annual'] as const) {
      expect(PLAN_ALLOWANCE[plan].credits).toBeGreaterThan(0);
    }
    expect(PLAN_ALLOWANCE.annual.initial).toBeGreaterThan(0);
    expect(JSON.stringify(PLAN_ALLOWANCE)).not.toMatch(/trial/i);
  });

  it('bounds the worst-case annual allowance below the plan price', () => {
    // Every allowance credit spent on the high tier over a year, at provider cost.
    const credits = PLAN_ALLOWANCE.annual.initial + PLAN_ALLOWANCE.annual.credits * 52;
    const worstCaseUsd = (credits / PREVIEW_COST.high) * PREVIEW_PROVIDER_USD.high;
    expect(worstCaseUsd).toBeLessThan(39.99);
  });

  it('exposes the free limits', () => {
    expect(FREE_LIMITS.journeyPhotos).toBe(3);
    expect(FREE_LIMITS.freeGuideDays).toBe(14);
  });

  it('maps store product ids to plans and packs', () => {
    expect(planForProductId('com.techtactoe.kok.pro.weekly')).toBe('weekly');
    expect(planForProductId('com.techtactoe.kok.pro.monthly')).toBe('monthly');
    expect(planForProductId('com.techtactoe.kok.pro.annual.gift')).toBe('annual');
    expect(planForProductId('com.techtactoe.kok.credits_10')).toBeNull();
    expect(packForProductId('com.techtactoe.kok.credits_25')).toBe('credits_25');
    expect(packForProductId('com.techtactoe.kok.credits_250')).toBeNull();
    expect(packForProductId('com.techtactoe.kok.pro.weekly')).toBeNull();
  });
});
