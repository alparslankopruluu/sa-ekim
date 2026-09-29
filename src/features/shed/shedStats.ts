/**
 * Pure helpers behind the shed log and its charts. Dates are ISO calendar days as the user
 * knows them; nothing here reads the clock (callers pass `today`).
 */
import { MAX_SHED_COUNT } from '@shared/catalog';
import { dayIndex, type IsoDate, PHASES } from '@shared/timeline';

import type { ShedEntry } from '@/stores/journey';

const shedPhase = PHASES.find((p) => p.id === 'shed');

/** Days since the operation in which shedding is typical (weeks 3–8): the shaded window. */
export const SHED_WINDOW = { from: shedPhase?.fromDay ?? 15, to: shedPhase?.toDay ?? 56 } as const;

export function inShedWindow(day: number): boolean {
  return day >= SHED_WINDOW.from && day <= SHED_WINDOW.to;
}

/** ISO date `delta` calendar days from `iso` (UTC arithmetic, so DST cannot shift it). */
export function addDays(iso: IsoDate, delta: number): IsoDate {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export interface ShedDay {
  date: IsoDate;
  /** `null` = nothing logged that day (not the same as 0). */
  count: number | null;
  isToday: boolean;
  /** Inside the typical shedding window; always false without an operation date. */
  inWindow: boolean;
}

/** The last `span` days ending at `today`, oldest first. */
export function recentDays(
  entries: readonly ShedEntry[],
  today: IsoDate,
  span: number,
  procedureDate: IsoDate | null,
): ShedDay[] {
  const byDate = new Map(entries.map((e) => [e.date, e.count] as const));
  return Array.from({ length: span }, (_, i) => {
    const date = addDays(today, i - (span - 1));
    const offset = span - 1 - i;
    return {
      date,
      count: byDate.get(date) ?? null,
      isToday: offset === 0,
      // Noon local time keeps the calendar date stable across DST changes.
      inWindow: procedureDate ? inShedWindow(dayIndex(procedureDate, new Date(`${date}T12:00:00`))) : false,
    };
  });
}

export function todayCount(entries: readonly ShedEntry[], today: IsoDate): number | null {
  return entries.find((e) => e.date === today)?.count ?? null;
}

/** Mean of the days logged in the last 7 days (today included), rounded; `null` when none. */
export function weeklyAverage(entries: readonly ShedEntry[], today: IsoDate): number | null {
  const from = addDays(today, -6);
  const inRange = entries.filter((e) => e.date >= from && e.date <= today);
  if (inRange.length === 0) return null;
  return Math.round(inRange.reduce((sum, e) => sum + e.count, 0) / inRange.length);
}

/** Chart ceiling: at least 20 (a handful of hairs must not fill the chart), else the max rounded up to 10. */
export function chartMax(days: readonly ShedDay[]): number {
  const max = days.reduce((m, d) => Math.max(m, d.count ?? 0), 0);
  return Math.max(20, Math.ceil(max / 10) * 10);
}

/** Bar height as a 0..1 fraction; any non-zero count keeps a visible sliver. */
export function barFraction(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(1, Math.max(0.04, count / max));
}

/** Quick-entry chips add to what is typed, never above the shared maximum. */
export function clampedAdd(current: number | null, delta: number): number {
  return Math.min(MAX_SHED_COUNT, Math.max(0, (current ?? 0) + delta));
}
