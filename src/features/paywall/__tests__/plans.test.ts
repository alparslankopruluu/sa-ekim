import type { PlanOption } from '@/services/purchases/types';

import {
  billedPrice,
  defaultPlanId,
  disclosureKind,
  orderPlans,
  perWeekPrice,
  perWeekString,
  yearlySavingsPercent,
} from '../plans';

const base = { offeringId: 'default', currencyCode: 'USD', introPrice: null, introPriceString: null } as const;

const weekly = { ...base, id: 'weekly', period: 'week', price: 7.99, priceString: '$7.99' } as unknown as PlanOption;
const monthly = { ...base, id: 'monthly', period: 'month', price: 12.99, priceString: '$12.99' } as unknown as PlanOption;
const annual = { ...base, id: 'annual', period: 'year', price: 39.99, priceString: '$39.99' } as unknown as PlanOption;
const gift = {
  ...annual,
  offeringId: 'gift_discount',
  introPrice: 23.99,
  introPriceString: '$23.99',
} as unknown as PlanOption;

describe('orderPlans / defaultPlanId', () => {
  it('orders annual, monthly, weekly regardless of input order', () => {
    expect(orderPlans([weekly, annual, monthly]).map((p) => p.id)).toEqual(['annual', 'monthly', 'weekly']);
    expect(orderPlans([weekly, monthly]).map((p) => p.id)).toEqual(['monthly', 'weekly']);
  });

  it('does not mutate the input', () => {
    const input = [weekly, annual];
    orderPlans(input);
    expect(input[0]).toBe(weekly);
  });

  it('pre-selects annual, else the first plan in display order', () => {
    expect(defaultPlanId([weekly, monthly, annual])).toBe('annual');
    expect(defaultPlanId([weekly, monthly])).toBe('monthly');
    expect(defaultPlanId([])).toBeNull();
  });
});

describe('prices', () => {
  it('bills the intro price first when there is one', () => {
    expect(billedPrice(annual)).toBe(39.99);
    expect(billedPrice(gift)).toBe(23.99);
  });

  it('floors the per-week price of a yearly plan to cents', () => {
    expect(perWeekPrice(annual)).toBe(0.76); // 39.99 / 52 = 0.7690...
    expect(perWeekPrice(gift)).toBe(0.46); // 23.99 / 52 = 0.4613...
    expect(perWeekPrice(weekly)).toBeNull();
    expect(perWeekPrice(monthly)).toBeNull();
  });

  it('formats the per-week price in the plan currency', () => {
    expect(perWeekString(annual, 'en')).toBe('$0.76');
    expect(perWeekString(monthly, 'en')).toBeNull();
  });

  it('floors the yearly saving versus weekly, and returns 0 without both plans', () => {
    // 1 - 39.99 / (7.99 * 52) = 0.9037 -> 90
    expect(yearlySavingsPercent([annual, monthly, weekly])).toBe(90);
    // gift: 1 - 23.99 / 415.48 = 0.9422 -> 94
    expect(yearlySavingsPercent([gift, weekly])).toBe(94);
    expect(yearlySavingsPercent([annual, monthly])).toBe(0);
    expect(yearlySavingsPercent([weekly])).toBe(0);
  });
});

describe('disclosureKind', () => {
  it('picks the sentence that matches what is billed', () => {
    expect(disclosureKind(annual)).toBe('annual');
    expect(disclosureKind(monthly)).toBe('monthly');
    expect(disclosureKind(weekly)).toBe('weekly');
    expect(disclosureKind(gift)).toBe('intro');
  });
});
