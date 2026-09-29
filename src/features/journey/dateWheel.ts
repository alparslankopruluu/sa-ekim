/**
 * Pure helpers behind the three-wheel date picker (day · month · year): day counts,
 * clamping when the month changes, the year range and the locale's field order.
 */
import type { IsoDate } from '@shared/timeline';

export type DateField = 'day' | 'month' | 'year';

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number, length = 2) => String(n).padStart(length, '0');

export function toIso(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

export function parseIso(iso: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

/** Inclusive year range for the picker: `back` years before `today`'s year to `forward` after. */
export function yearRange(todayYear: number, back: number, forward: number): number[] {
  return Array.from({ length: back + forward + 1 }, (_, i) => todayYear - back + i);
}

/** Clamps an ISO date into `[min, max]` (both optional). */
export function clampIso(iso: IsoDate, min?: IsoDate, max?: IsoDate): IsoDate {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** The order the locale writes day, month and year in (falls back to day · month · year). */
export function dateFieldOrder(locale: string): DateField[] {
  try {
    const parts = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(
      new Date(Date.UTC(2026, 10, 22)),
    );
    const order = parts
      .map((p) => p.type)
      .filter((type): type is DateField => type === 'day' || type === 'month' || type === 'year');
    return order.length === 3 ? order : ['day', 'month', 'year'];
  } catch {
    return ['day', 'month', 'year'];
  }
}

export function monthLabels(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    try {
      return new Date(Date.UTC(2026, i, 1)).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' });
    } catch {
      return String(i + 1);
    }
  });
}
