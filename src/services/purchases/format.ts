/** Pure price helpers — every number comes from store price objects, never literals. */

/** ISO-8601 period (P3D, P1W, P1M, P1Y) → days. */
export function periodToDays(unit: string, count: number): number {
  const n = Number.isFinite(count) && count > 0 ? count : 1;
  switch (unit.toUpperCase()) {
    case 'DAY':
    case 'D':
      return n;
    case 'WEEK':
    case 'W':
      return n * 7;
    case 'MONTH':
    case 'M':
      return n * 30;
    case 'YEAR':
    case 'Y':
      return n * 365;
    default:
      return n;
  }
}

/** Parses 'P3D' / 'P1W' / 'P1Y' into days. */
export function isoPeriodToDays(period: string | null | undefined): number | null {
  if (!period) return null;
  const match = /^P(\d+)([DWMY])$/i.exec(period.trim());
  if (!match) return null;
  return periodToDays(match[2] ?? 'D', Number(match[1]));
}

/** Percent saved by the annual plan versus paying weekly for 52 weeks (rounded down). */
export function annualSavingsPercent(weeklyPrice: number, annualPrice: number): number {
  if (!(weeklyPrice > 0) || !(annualPrice > 0)) return 0;
  const yearlyAtWeekly = weeklyPrice * 52;
  if (annualPrice >= yearlyAtWeekly) return 0;
  return Math.floor((1 - annualPrice / yearlyAtWeekly) * 100);
}

/** Localized currency string for derived values (e.g. annual price per week). */
export function formatCurrency(amount: number, currencyCode: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

/** Per-week equivalent of an annual price, floored to cents so we never overstate the saving. */
export function perWeek(annualPrice: number): number {
  return Math.floor((annualPrice / 52) * 100) / 100;
}
