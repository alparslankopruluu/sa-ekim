/**
 * View-model helpers for the journey screens (Today, Journey tab, guide). Pure: no I/O, no
 * clock reads (callers pass `now`), no React. The timeline rules themselves live in
 * `@shared/timeline`; this file only reshapes them for display so every screen agrees on
 * what "day 23 · week 4" and "the next task" mean.
 */
import type { Angle, Goal, JourneyKind } from '@shared/catalog';
import { ANGLES_BY_GOAL, maturationMonthsFor } from '@shared/catalog';
import {
  BAND_ANCHORS,
  bandAt,
  dayIndex,
  daysUntilNextPhase,
  DAY_MS,
  type IsoDate,
  isPhotoDue,
  maturationProgress,
  monthIndex,
  type PhaseDef,
  type PhaseId,
  PHASE_IDS,
  PHASES,
  phaseForDay,
  photoCadenceDays,
  PRP_DEFAULTS,
  prpSessionOffsets,
  toIsoDate,
  weekIndex,
} from '@shared/timeline';

/* ------------------------------------------------------------------ dates */

function utcMs(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): IsoDate {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar-day arithmetic on ISO dates (no time zones, no DST surprises). */
export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtcMs(utcMs(iso) + Math.round(days) * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

/** Adds calendar months, clamping to the end of a shorter month (Aug 31 + 6 → Feb 28). */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fromUtcMs(Date.UTC(year, month, Math.min(d, last)));
}

/** Locale-formatted calendar date without a time-zone shift. */
export function formatIsoDate(iso: IsoDate, locale: string, style: 'short' | 'long' = 'short'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' };
  try {
    return new Date(utcMs(iso)).toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function partOfDay(now: Date): PartOfDay {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/* ------------------------------------------------------------------ clock */

export type JourneyClock =
  | { status: 'unset' }
  | { status: 'upcoming'; daysUntil: number }
  | {
      status: 'active';
      day: number;
      week: number;
      month: number;
      phase: PhaseDef;
      next: PhaseDef | null;
      daysToNext: number;
      progress: number;
    }
  | { status: 'complete'; day: number; week: number; month: number; progress: 1 };

export function isPhaseId(value: unknown): value is PhaseId {
  return typeof value === 'string' && (PHASE_IDS as readonly string[]).includes(value);
}

/** Last day (inclusive) of the tracked window for a goal: 18 months, or ~15 for the rest. */
export function endDayFor(goal: Goal): number {
  return maturationMonthsFor(goal) === 18 ? 548 : 456;
}

export function journeyClock(procedureDate: IsoDate | null, now: Date, goal: Goal): JourneyClock {
  if (!procedureDate) return { status: 'unset' };
  const day = dayIndex(procedureDate, now);
  if (day < 0) return { status: 'upcoming', daysUntil: -day };
  const lookup = phaseForDay(day, goal);
  if (lookup.kind !== 'phase') {
    return { status: 'complete', day, week: weekIndex(day), month: monthIndex(day), progress: 1 };
  }
  const phase = lookup.phase;
  const following = PHASES[PHASES.findIndex((p) => p.id === phase.id) + 1] ?? null;
  return {
    status: 'active',
    day,
    week: weekIndex(day),
    month: monthIndex(day),
    phase,
    next: following,
    daysToNext: daysUntilNextPhase(day, phase),
    progress: maturationProgress(day, goal),
  };
}

/* --------------------------------------------------------------- schedule */

export interface PhaseRow {
  id: PhaseId;
  fromDay: number;
  toDay: number;
  anxious: boolean;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
}

/** Every phase with its calendar dates (null before the operation date is set). */
export function phaseSchedule(procedureDate: IsoDate | null, goal: Goal): PhaseRow[] {
  const end = endDayFor(goal);
  return PHASES.filter((p) => p.fromDay <= end).map((p) => {
    const toDay = Math.min(p.toDay, end);
    return {
      id: p.id,
      fromDay: p.fromDay,
      toDay,
      anxious: p.anxious,
      startDate: procedureDate ? addDays(procedureDate, p.fromDay) : null,
      endDate: procedureDate ? addDays(procedureDate, toDay) : null,
    };
  });
}

/** The three day-ranges of the care accordion (days 0–3, 4–7, 8–14). */
export type CareRange = 'd0_3' | 'd4_7' | 'd8_14';
export const CARE_RANGES: readonly CareRange[] = ['d0_3', 'd4_7', 'd8_14'];

export function careRangeFor(day: number): CareRange | null {
  if (day < 0 || day > 14) return null;
  if (day <= 3) return 'd0_3';
  if (day <= 7) return 'd4_7';
  return 'd8_14';
}

/* ------------------------------------------------------------- band chart */

export interface Point {
  x: number;
  y: number;
}

/** Catmull-Rom → cubic Bézier segments (`C…`), no leading move command. */
function curveSegments(points: readonly Point[]): string {
  const n = (v: number) => String(Number(v.toFixed(2)));
  const parts: string[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)] as Point;
    const p1 = points[i] as Point;
    const p2 = points[i + 1] as Point;
    const p3 = points[Math.min(points.length - 1, i + 2)] as Point;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    parts.push(`C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p2.x)} ${n(p2.y)}`);
  }
  return parts.join(' ');
}

/** A smooth open path through `points` (empty string for no points). */
export function smoothPath(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return '';
  const n = (v: number) => String(Number(v.toFixed(2)));
  return `M${n(first.x)} ${n(first.y)} ${curveSegments(points)}`.trim();
}

export interface BandGeometryInput {
  width: number;
  height: number;
  padX?: number;
  padY?: number;
  goal: Goal;
  samples?: number;
}

export interface BandSample {
  day: number;
  x: number;
  yLow: number;
  yHigh: number;
}

export interface BandGeometry {
  width: number;
  height: number;
  domainDays: number;
  points: BandSample[];
  areaPath: string;
  /** Smooth centre line of the band. */
  midPath: string;
  /** X positions of every phase start after the first (faint separators, unlabeled). */
  boundaries: number[];
  xForDay(day: number): number;
  yForValue(value: number): number;
}

export function bandGeometry({ width, height, padX = 12, padY = 14, goal, samples = 56 }: BandGeometryInput): BandGeometry {
  const domainDays = endDayFor(goal);
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  const xForDay = (day: number) => padX + (Math.min(domainDays, Math.max(0, day)) / domainDays) * innerW;
  const yForValue = (value: number) => padY + (1 - Math.min(1, Math.max(0, value))) * innerH;

  // Sample evenly, and always include the anchor days so the shape keeps its kinks honest.
  const days = new Set<number>();
  for (let i = 0; i <= samples; i++) days.add(Math.round((i / samples) * domainDays));
  for (const anchor of BAND_ANCHORS) if (anchor.day <= domainDays) days.add(anchor.day);
  const points: BandSample[] = [...days]
    .sort((a, b) => a - b)
    .map((day) => {
      const band = bandAt(day);
      return { day, x: xForDay(day), yLow: yForValue(band.low), yHigh: yForValue(band.high) };
    });

  const high = points.map((p) => ({ x: p.x, y: p.yHigh }));
  const low = points.map((p) => ({ x: p.x, y: p.yLow }));
  const mid = points.map((p) => ({ x: p.x, y: (p.yLow + p.yHigh) / 2 }));
  const n = (v: number) => String(Number(v.toFixed(2)));
  const firstHigh = high[0] as Point;
  const lastLow = low[low.length - 1] as Point;
  const areaPath = `M${n(firstHigh.x)} ${n(firstHigh.y)} ${curveSegments(high)} L${n(lastLow.x)} ${n(lastLow.y)} ${curveSegments(
    [...low].reverse(),
  )} Z`;

  return {
    width,
    height,
    domainDays,
    points,
    areaPath,
    midPath: smoothPath(mid),
    boundaries: PHASES.slice(1)
      .filter((p) => p.fromDay <= domainDays)
      .map((p) => xForDay(p.fromDay)),
    xForDay,
    yForValue,
  };
}

/** The "you are here" dot: on the middle of the typical band at `day` (clamped to the chart). */
export function dotPosition(geometry: BandGeometry, day: number): Point {
  const clamped = Math.min(geometry.domainDays, Math.max(0, day));
  const band = bandAt(clamped);
  return { x: geometry.xForDay(clamped), y: geometry.yForValue((band.low + band.high) / 2) };
}

/* ------------------------------------------------------------------ photos */

export interface PhotoLike {
  id: string;
  uri: string;
  takenAt: number;
  angle: Angle;
}

/** Day index of a photo relative to the operation date (negative = before). */
export function photoDay(photo: Pick<PhotoLike, 'takenAt'>, procedureDate: IsoDate): number {
  return dayIndex(procedureDate, new Date(photo.takenAt));
}

export function lastPhotoDay(photos: readonly PhotoLike[], procedureDate: IsoDate | null): number | null {
  if (!procedureDate || photos.length === 0) return null;
  const latest = photos.reduce((a, b) => (b.takenAt > a.takenAt ? b : a));
  return photoDay(latest, procedureDate);
}

export type PhotoGroupKind = 'week' | 'before' | 'undated';

export interface PhotoGroup {
  key: string;
  kind: PhotoGroupKind;
  /** 1-based week for `week` groups. */
  week?: number;
  /** `YYYY-MM` for `undated` groups (no operation date yet). */
  month?: string;
  photos: PhotoLike[];
}

/** Photos grouped by week since the operation (newest week first; "before" photos last). */
export function groupPhotosByWeek(
  photos: readonly PhotoLike[],
  procedureDate: IsoDate | null,
  angle?: Angle | null,
): PhotoGroup[] {
  const source = (angle ? photos.filter((p) => p.angle === angle) : [...photos]).sort((a, b) => a.takenAt - b.takenAt);
  const groups = new Map<string, PhotoGroup>();
  for (const photo of source) {
    let key: string;
    let base: Omit<PhotoGroup, 'photos' | 'key'>;
    if (!procedureDate) {
      const month = toIsoDate(new Date(photo.takenAt)).slice(0, 7);
      key = `m-${month}`;
      base = { kind: 'undated', month };
    } else {
      const day = photoDay(photo, procedureDate);
      if (day < 0) {
        key = 'before';
        base = { kind: 'before' };
      } else {
        const week = weekIndex(day);
        key = `w-${week}`;
        base = { kind: 'week', week };
      }
    }
    const group = groups.get(key);
    if (group) group.photos.push(photo);
    else groups.set(key, { key, ...base, photos: [photo] });
  }
  const rank = (g: PhotoGroup) => (g.kind === 'before' ? -1 : g.kind === 'week' ? (g.week ?? 0) : 0);
  return [...groups.values()].sort((a, b) => {
    if (a.kind === 'undated' && b.kind === 'undated') return (b.month ?? '').localeCompare(a.month ?? '');
    return rank(b) - rank(a);
  });
}

/* ------------------------------------------------------------- checkpoints */

export type CheckpointStatus = 'done' | 'due' | 'upcoming' | 'missed';

export interface Checkpoint {
  month: number;
  targetDay: number;
  date: IsoDate | null;
  status: CheckpointStatus;
}

const CHECKPOINT_BEFORE = 7;
const CHECKPOINT_AFTER = 14;

/** Maturation photo goals: 3/6/9/12 months, plus 18 for crown and parting. */
export function checkpointsFor(
  goal: Goal,
  procedureDate: IsoDate | null,
  photoDays: readonly number[],
  day: number,
): Checkpoint[] {
  const months = maturationMonthsFor(goal) === 18 ? [3, 6, 9, 12, 18] : [3, 6, 9, 12];
  return months.map((month) => {
    const targetDay = month * 30;
    const from = targetDay - CHECKPOINT_BEFORE;
    const to = targetDay + CHECKPOINT_AFTER;
    let status: CheckpointStatus;
    if (photoDays.some((d) => d >= from && d <= to)) status = 'done';
    else if (!procedureDate || day < from) status = 'upcoming';
    else if (day <= to) status = 'due';
    else status = 'missed';
    return { month, targetDay, date: procedureDate ? addDays(procedureDate, targetDay) : null, status };
  });
}

/* --------------------------------------------------------------------- PRP */

export interface PrpSessionLike {
  id: string;
  date: IsoDate;
  done: boolean;
}

export function buildPrpSessions(
  firstDate: IsoDate,
  makeId: () => string,
  sessions: number = PRP_DEFAULTS.sessions,
  intervalWeeks: number = PRP_DEFAULTS.intervalWeeks,
): PrpSessionLike[] {
  return prpSessionOffsets(sessions, intervalWeeks).map((offset) => ({
    id: makeId(),
    date: addDays(firstDate, offset),
    done: false,
  }));
}

export interface PrpSummary {
  total: number;
  done: number;
  /** 1-based number of the session in progress (the total once everything is done). */
  current: number;
  allDone: boolean;
  next: PrpSessionLike | null;
  daysToNext: number | null;
  /** Days the next session is late (0 on the day itself). */
  daysOverdue: number;
  dueNow: boolean;
}

export function prpSummary(sessions: readonly PrpSessionLike[], today: IsoDate): PrpSummary {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const done = sorted.filter((s) => s.done).length;
  const nextIndex = sorted.findIndex((s) => !s.done);
  const next = nextIndex >= 0 ? (sorted[nextIndex] as PrpSessionLike) : null;
  const total = sorted.length;
  return {
    total,
    done,
    current: next ? nextIndex + 1 : total,
    allDone: total > 0 && !next,
    next,
    daysToNext: next ? Math.max(0, diffDays(today, next.date)) : null,
    daysOverdue: next ? Math.max(0, diffDays(next.date, today)) : 0,
    dueNow: next ? next.date <= today : false,
  };
}

/** Date of the maintenance session (months after the last planned session). */
export function maintenanceDate(sessions: readonly PrpSessionLike[], months: number): IsoDate | null {
  if (sessions.length === 0) return null;
  const last = [...sessions].sort((a, b) => a.date.localeCompare(b.date)).at(-1) as PrpSessionLike;
  return addMonths(last.date, months);
}

/* --------------------------------------------------------------- next task */

export type NextTask =
  | { kind: 'none' }
  | { kind: 'baseline_photo'; angle: Angle }
  | { kind: 'care' }
  | { kind: 'photo'; cadence: 'weekly' | 'monthly'; first: boolean; angle: Angle }
  | { kind: 'shed' }
  | { kind: 'prp_due'; sessionId: string; daysOverdue: number; angle: Angle }
  | { kind: 'caught_up'; nextPhotoInDays?: number | null; nextSessionInDays?: number | null };

export interface NextTaskInput {
  kind: JourneyKind;
  goal: Goal;
  clock: JourneyClock;
  hasPhotos: boolean;
  lastPhotoDay: number | null;
  /** The first-fortnight checklist still has open items (or was completed in this visit). */
  carePending: boolean;
  shedLoggedToday: boolean;
  prp: PrpSummary | null;
}

/** ONE task for the Today card, in this order: care → photo → shed → PRP → all caught up. */
export function chooseNextTask(input: NextTaskInput): NextTask {
  const { clock, goal } = input;
  const angle = (ANGLES_BY_GOAL[goal][0] ?? 'front') as Angle;
  if (clock.status === 'unset') return { kind: 'none' };

  if (input.kind === 'prp') {
    const prp = input.prp;
    if (prp?.dueNow && prp.next) {
      return { kind: 'prp_due', sessionId: prp.next.id, daysOverdue: prp.daysOverdue, angle };
    }
    return { kind: 'caught_up', nextSessionInDays: prp?.daysToNext ?? null };
  }

  if (clock.status === 'upcoming') {
    return input.hasPhotos ? { kind: 'none' } : { kind: 'baseline_photo', angle };
  }

  const day = clock.day;
  if (clock.status === 'active' && day <= 14 && input.carePending) return { kind: 'care' };

  if (isPhotoDue(day, input.lastPhotoDay)) {
    return { kind: 'photo', cadence: photoCadenceDays(day) === 7 ? 'weekly' : 'monthly', first: input.lastPhotoDay === null, angle };
  }

  if (clock.status === 'active' && day >= 15 && day <= 56 && !input.shedLoggedToday) return { kind: 'shed' };

  const nextPhotoInDays =
    input.lastPhotoDay === null ? null : Math.max(0, photoCadenceDays(day) - (day - input.lastPhotoDay));
  return { kind: 'caught_up', nextPhotoInDays };
}
