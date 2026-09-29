/**
 * The post-operation timeline. Pure functions only (no I/O, no clock reads) so the app,
 * notifications, tests and the cohort code all agree on what "week 3" means.
 *
 * Source: clinic-published timelines (shock loss weeks 2–8, quiet months 2–4, first growth
 * months 3–4, maturation 9–12, evaluation at 12 months, crown and women up to ~18).
 * This is education, not a diagnosis or a promise: individual results vary, and every
 * screen that shows the band says so.
 */
import type { Goal } from './catalog.js';
import { maturationMonthsFor } from './catalog.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const PHASE_IDS = ['care', 'shed', 'quiet', 'sprout', 'grow', 'mature', 'final'] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

export interface PhaseDef {
  id: PhaseId;
  /** First day (inclusive) counted from the procedure day (day 0). */
  fromDay: number;
  /** Last day (inclusive). `final` extends to the end of the maturation window. */
  toDay: number;
  /** `true` when the phase is the classic "worried user" moment (shed, quiet). */
  anxious: boolean;
}

export const PHASES: readonly PhaseDef[] = [
  { id: 'care', fromDay: 0, toDay: 14, anxious: false },
  { id: 'shed', fromDay: 15, toDay: 56, anxious: true },
  { id: 'quiet', fromDay: 57, toDay: 120, anxious: true },
  { id: 'sprout', fromDay: 121, toDay: 180, anxious: false },
  { id: 'grow', fromDay: 181, toDay: 270, anxious: false },
  { id: 'mature', fromDay: 271, toDay: 365, anxious: false },
  { id: 'final', fromDay: 366, toDay: 548, anxious: false },
];

/** ISO calendar date `YYYY-MM-DD` (no time zone: the operation day as the user knows it). */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Local calendar date of `now` as `YYYY-MM-DD`. */
export function toIsoDate(now: Date): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function utcDay(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Whole calendar days from the operation day (day 0) to `now` (local date). Negative = before. */
export function dayIndex(procedureDate: IsoDate, now: Date): number {
  return utcDay(toIsoDate(now)) - utcDay(procedureDate);
}

/** Week number, 1-based (days 0–6 → week 1). Never below 1. */
export function weekIndex(day: number): number {
  return Math.max(1, Math.floor(Math.max(0, day) / 7) + 1);
}

/** Month number, 1-based, using 30-day months (days 0–29 → month 1). */
export function monthIndex(day: number): number {
  return Math.max(1, Math.floor(Math.max(0, day) / 30) + 1);
}

export type PhaseLookup = { kind: 'before' } | { kind: 'phase'; phase: PhaseDef } | { kind: 'beyond' };

/** The phase a given day falls in, or `before`/`beyond` outside the window for `goal`. */
export function phaseForDay(day: number, goal: Goal): PhaseLookup {
  if (day < 0) return { kind: 'before' };
  const endDay = maturationMonthsFor(goal) === 18 ? 548 : 456; // 18 months / ~15 months
  if (day > endDay) return { kind: 'beyond' };
  const phase = PHASES.find((p) => day >= p.fromDay && day <= p.toDay);
  return phase ? { kind: 'phase', phase } : { kind: 'beyond' };
}

/** The phase after `current`, or null on the last one. */
export function nextPhase(current: PhaseId): PhaseDef | null {
  const index = PHASES.findIndex((p) => p.id === current);
  return PHASES[index + 1] ?? null;
}

/** Days until the next phase starts (0 if there is none). */
export function daysUntilNextPhase(day: number, phase: PhaseDef): number {
  const next = nextPhase(phase.id);
  return next ? Math.max(0, next.fromDay - Math.max(day, 0)) : 0;
}

/** Fraction 0..1 of the maturation window that has elapsed (for the progress ring). */
export function maturationProgress(day: number, goal: Goal): number {
  const total = maturationMonthsFor(goal) * 30;
  return Math.min(1, Math.max(0, day) / total);
}

/**
 * Photo cadence: weekly for the first three months, then monthly. Returns the number of
 * days that should pass between two photos at `day`.
 */
export function photoCadenceDays(day: number): number {
  return day <= 90 ? 7 : 30;
}

/** `true` when the last photo is older than the cadence for `day` (or there is none). */
export function isPhotoDue(day: number, lastPhotoDay: number | null): boolean {
  if (day < 0) return false;
  if (lastPhotoDay === null) return true;
  return day - lastPhotoDay >= photoCadenceDays(day);
}

export interface BandPoint {
  day: number;
  low: number;
  high: number;
}

/**
 * ILLUSTRATIVE typical range of apparent density relative to the eventual result
 * (0 = nothing visible, 1 = fully matured). It is a shape for orientation, drawn without
 * numbers on the axis, and never a prediction for one person. Anchor days follow the
 * clinic timeline above; values are deliberately wide.
 */
export const BAND_ANCHORS: readonly BandPoint[] = [
  { day: 0, low: 0.2, high: 0.35 },
  { day: 14, low: 0.15, high: 0.3 },
  { day: 30, low: 0.02, high: 0.15 },
  { day: 56, low: 0.0, high: 0.1 },
  { day: 90, low: 0.02, high: 0.15 },
  { day: 120, low: 0.08, high: 0.25 },
  { day: 180, low: 0.35, high: 0.6 },
  { day: 270, low: 0.65, high: 0.85 },
  { day: 365, low: 0.85, high: 1.0 },
  { day: 548, low: 0.95, high: 1.0 },
];

/** Linear interpolation of the illustrative band at `day` (clamped to the anchors). */
export function bandAt(day: number): { low: number; high: number } {
  const first = BAND_ANCHORS[0] as BandPoint;
  const last = BAND_ANCHORS[BAND_ANCHORS.length - 1] as BandPoint;
  if (day <= first.day) return { low: first.low, high: first.high };
  if (day >= last.day) return { low: last.low, high: last.high };
  for (let i = 1; i < BAND_ANCHORS.length; i++) {
    const a = BAND_ANCHORS[i - 1] as BandPoint;
    const b = BAND_ANCHORS[i] as BandPoint;
    if (day <= b.day) {
      const t = (day - a.day) / (b.day - a.day);
      return { low: a.low + (b.low - a.low) * t, high: a.high + (b.high - a.high) * t };
    }
  }
  return { low: last.low, high: last.high };
}

/** Days of the first-fortnight care plan on which a daily reminder is sent. */
export const CARE_REMINDER_DAYS = 14;

/** Week numbers (1-based) on which phase-change notifications fire, mapped to their phase. */
export function phaseStartDays(goal: Goal): { phase: PhaseId; day: number }[] {
  return PHASES.filter((p) => p.fromDay > 0 && phaseForDay(p.fromDay, goal).kind === 'phase').map((p) => ({
    phase: p.id,
    day: p.fromDay,
  }));
}

/** PRP / mesotherapy course defaults: sessions and spacing (weeks), then maintenance. */
export const PRP_DEFAULTS = { sessions: 3, intervalWeeks: 4, maintenanceMonths: 6 } as const;

/** Day offsets (from the first session) for each planned PRP session. */
export function prpSessionOffsets(sessions: number, intervalWeeks: number): number[] {
  return Array.from({ length: Math.max(1, sessions) }, (_, i) => i * intervalWeeks * 7);
}
