/**
 * Pure plan math for the paywall. Every number comes from store price objects (never
 * literals); derived values are floored so we never overstate a saving (App Review 3.1.2).
 */
import { annualSavingsPercent, formatCurrency, perWeek } from '@/services/purchases/format';
import type { PlanOption } from '@/services/purchases/types';

const ORDER = ['annual', 'monthly', 'weekly'] as const;

/** Annual first, then monthly, then weekly — whatever order the store returned. */
export function orderPlans<T extends { id: string }>(plans: readonly T[]): T[] {
  const rank = (id: string) => {
    const index = (ORDER as readonly string[]).indexOf(id);
    return index === -1 ? ORDER.length : index;
  };
  return [...plans].sort((a, b) => rank(a.id) - rank(b.id));
}

/** Annual is pre-selected when it exists; otherwise the first plan. */
export function defaultPlanId<T extends { id: string }>(plans: readonly T[]): string | null {
  if (plans.some((p) => p.id === 'annual')) return 'annual';
  return orderPlans(plans)[0]?.id ?? null;
}

/** The amount actually billed first: the intro price when the plan has one. */
export function billedPrice(plan: Pick<PlanOption, 'price' | 'introPrice'>): number {
  return plan.introPrice ?? plan.price;
}

export function billedPriceString(plan: Pick<PlanOption, 'priceString' | 'introPriceString'>): string {
  return plan.introPriceString ?? plan.priceString;
}

/** Floored per-week price of a yearly plan; null for other periods. */
export function perWeekPrice(plan: Pick<PlanOption, 'period' | 'price' | 'introPrice'>): number | null {
  return plan.period === 'year' ? perWeek(billedPrice(plan)) : null;
}

export function perWeekString(
  plan: Pick<PlanOption, 'period' | 'price' | 'introPrice' | 'currencyCode'>,
  locale: string,
): string | null {
  const amount = perWeekPrice(plan);
  return amount === null ? null : formatCurrency(amount, plan.currencyCode, locale);
}

/** Floored % the yearly plan saves versus paying weekly for 52 weeks; 0 without both plans. */
export function yearlySavingsPercent(
  plans: readonly Pick<PlanOption, 'period' | 'price' | 'introPrice'>[],
): number {
  const weekly = plans.find((p) => p.period === 'week');
  const yearly = plans.find((p) => p.period === 'year');
  if (!weekly || !yearly) return 0;
  return annualSavingsPercent(weekly.price, billedPrice(yearly));
}

export type DisclosureKind = 'intro' | 'annual' | 'monthly' | 'weekly';

/** Which subscription disclosure sentence sits next to the CTA for this plan. */
export function disclosureKind(plan: Pick<PlanOption, 'period' | 'introPriceString'>): DisclosureKind {
  if (plan.introPriceString) return 'intro';
  if (plan.period === 'year') return 'annual';
  if (plan.period === 'month') return 'monthly';
  return 'weekly';
}
