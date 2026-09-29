/**
 * Pure helpers behind the onboarding date wheels. Validation reuses the shared timeline
 * (`isIsoDate`, `dayIndex`) so "Day N" means the same here, on Today and in reminders.
 */
import type { Stage } from '@shared/catalog';
import { type IsoDate, dayIndex, isIsoDate, weekIndex } from '@shared/timeline';

export interface DateParts {
  year: number;
  /** 1..12 */
  month: number;
  day: number;
}

export type DateField = 'day' | 'month' | 'year';

export type DateStage = Extract<Stage, 'planned' | 'done'>;

/** A finished operation older than this is outside the 12–18 month window anyway. */
export const PAST_YEARS = 3;
/** A planned operation further out than this is not a plan yet. */
export const FUTURE_YEARS = 2;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function partsToIso(parts: DateParts): IsoDate {
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${mm}-${dd}`;
}

export function isoToParts(iso: string): DateParts | null {
  if (!isIsoDate(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

/** Keeps the day inside the month (Feb 31 → Feb 28/29, day 0 → 1). */
export function clampParts(parts: DateParts): DateParts {
  const max = daysInMonth(parts.year, parts.month);
  return { ...parts, day: Math.min(max, Math.max(1, parts.day)) };
}

export function initialParts(now: Date): DateParts {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export type DateCheck =
  | { ok: true; iso: IsoDate; dayIndex: number }
  | { ok: false; reason: 'invalid' | 'must_be_past' | 'must_be_future' | 'too_far' };

export function checkProcedureDate(parts: DateParts, stage: DateStage, now: Date): DateCheck {
  const iso = partsToIso(parts);
  if (!isIsoDate(iso)) return { ok: false, reason: 'invalid' };
  const day = dayIndex(iso, now);
  if (stage === 'planned') {
    if (day > 0) return { ok: false, reason: 'must_be_future' };
    if (-day > FUTURE_YEARS * 365) return { ok: false, reason: 'too_far' };
  } else {
    if (day < 0) return { ok: false, reason: 'must_be_past' };
    if (day > PAST_YEARS * 365 + 1) return { ok: false, reason: 'too_far' };
  }
  return { ok: true, iso, dayIndex: day };
}

export type DayDescription =
  | { kind: 'past'; day: number; week: number }
  | { kind: 'today'; day: 0; week: 1 }
  | { kind: 'future'; days: number };

/** What the live feedback line says for a day index (negative = the operation is ahead). */
export function describeDay(day: number): DayDescription {
  if (day < 0) return { kind: 'future', days: -day };
  if (day === 0) return { kind: 'today', day: 0, week: 1 };
  return { kind: 'past', day, week: weekIndex(day) };
}

/** Years the wheel offers, ascending. */
export function yearRange(stage: DateStage, now: Date): number[] {
  const current = now.getFullYear();
  const from = stage === 'done' ? current - PAST_YEARS : current;
  const to = stage === 'done' ? current : current + FUTURE_YEARS;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const DEFAULT_ORDER: DateField[] = ['day', 'month', 'year'];

/** Wheel order for a locale (month-day-year in en-US, year-month-day in ja, …). */
export function dateFieldOrder(locale: string): DateField[] {
  try {
    const parts = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(
      new Date(2026, 0, 15),
    );
    const order = parts
      .map((p) => p.type)
      .filter((type): type is DateField => type === 'day' || type === 'month' || type === 'year');
    return order.length === 3 ? order : DEFAULT_ORDER;
  } catch {
    return DEFAULT_ORDER;
  }
}

export function monthLabel(locale: string, month: number): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, month - 1, 1));
  } catch {
    return String(month);
  }
}

/** Numerals in the user's locale (Arabic-Indic digits in ar, etc.). */
export function numberLabel(locale: string, value: number): string {
  try {
    return new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
  } catch {
    return String(value);
  }
}
