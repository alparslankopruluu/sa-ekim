/**
 * Selection and grouping for the clinic report: which photos go in and the shed summary.
 * Pure; no I/O and no translation.
 */
import { ANGLES, type Angle } from '@shared/catalog';
import { dayIndex, type IsoDate, weekIndex } from '@shared/timeline';

import type { JourneyPhoto, ShedEntry } from '@/stores/journey';

export interface AnglePick {
  angle: Angle;
  first: JourneyPhoto;
  /** The latest photo of the angle; `null` when there is only one. */
  last: JourneyPhoto | null;
}

/** First and latest photo per angle, in the canonical angle order. */
export function pickReportPhotos(photos: readonly JourneyPhoto[]): AnglePick[] {
  const picks: AnglePick[] = [];
  for (const angle of ANGLES) {
    const series = photos.filter((p) => p.angle === angle).sort((a, b) => a.takenAt - b.takenAt);
    const first = series[0];
    if (!first) continue;
    const last = series.length > 1 ? (series[series.length - 1] ?? null) : null;
    picks.push({ angle, first, last });
  }
  return picks;
}

export interface ShedWeekRow {
  /** 1-based week since the operation; `null` for the single overall row. */
  week: number | null;
  days: number;
  average: number;
  max: number;
}

function summarize(week: number | null, counts: number[]): ShedWeekRow {
  return {
    week,
    days: counts.length,
    average: Math.round(counts.reduce((sum, c) => sum + c, 0) / counts.length),
    max: Math.max(...counts),
  };
}

/**
 * Shed counts per week since the operation. Entries before the operation day are left out.
 * Without an operation date there is one overall row.
 */
export function shedWeekRows(entries: readonly ShedEntry[], procedureDate: IsoDate | null): ShedWeekRow[] {
  if (entries.length === 0) return [];
  if (!procedureDate) return [summarize(null, entries.map((e) => e.count))];

  const byWeek = new Map<number, number[]>();
  for (const entry of entries) {
    const day = dayIndex(procedureDate, new Date(`${entry.date}T12:00:00`));
    if (day < 0) continue;
    const week = weekIndex(day);
    byWeek.set(week, [...(byWeek.get(week) ?? []), entry.count]);
  }
  return [...byWeek.entries()].sort(([a], [b]) => a - b).map(([week, counts]) => summarize(week, counts));
}
