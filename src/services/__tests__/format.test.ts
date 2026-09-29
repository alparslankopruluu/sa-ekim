import { annualSavingsPercent, formatCurrency, isoPeriodToDays, periodToDays, perWeek } from '@/services/purchases/format';

describe('purchase formatting', () => {
  it('parses store periods', () => {
    expect(isoPeriodToDays('P3D')).toBe(3);
    expect(isoPeriodToDays('P1W')).toBe(7);
    expect(isoPeriodToDays('P1Y')).toBe(365);
    expect(isoPeriodToDays('P1M')).toBe(30);
    expect(isoPeriodToDays('bogus')).toBeNull();
    expect(isoPeriodToDays(null)).toBeNull();
    expect(periodToDays('WEEK', 0)).toBe(7);
  });

  it('never overstates the annual saving', () => {
    // $7.99 × 52 = $415.48 vs $59.99 → 85.56% → 85
    expect(annualSavingsPercent(7.99, 59.99)).toBe(85);
    expect(annualSavingsPercent(1, 100)).toBe(0);
    expect(annualSavingsPercent(0, 59.99)).toBe(0);
    expect(perWeek(59.99)).toBe(1.15);
  });

  it('formats currency with the locale', () => {
    expect(formatCurrency(1.15, 'USD', 'en-US')).toBe('$1.15');
    expect(formatCurrency(1.15, 'NOT_A_CODE', 'en-US')).toBe('1.15 NOT_A_CODE');
  });
});
