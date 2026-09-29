/**
 * Cohort date math (pure). Weeks are calendar weeks, Monday through Sunday, computed on the ISO
 * operation date the user typed (no time zones, no clock reads), so every device agrees.
 * ISO dates sort lexicographically, which is what lets Firestore range queries work on the string.
 */
import { DAY_MS, type IsoDate, isIsoDate } from '../shared/timeline.js';

function utcMs(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  if (!isIsoDate(iso)) throw new Error('not an ISO date');
  return fromUtcMs(utcMs(iso) + days * DAY_MS);
}

/** Monday..Sunday (inclusive) of the calendar week containing `iso`. */
export function weekBounds(iso: IsoDate): { start: IsoDate; end: IsoDate } {
  if (!isIsoDate(iso)) throw new Error('not an ISO date');
  const dow = new Date(utcMs(iso)).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  const start = addDays(iso, -sinceMonday);
  return { start, end: addDays(start, 6) };
}

/** Inclusive date window of `radiusDays` on both sides of `iso`. */
export function dateWindow(iso: IsoDate, radiusDays: number): { start: IsoDate; end: IsoDate } {
  return { start: addDays(iso, -radiusDays), end: addDays(iso, radiusDays) };
}

export const SAME_GOAL_WINDOW_DAYS = 14;
