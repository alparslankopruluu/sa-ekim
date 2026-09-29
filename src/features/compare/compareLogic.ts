/**
 * Pure logic for the compare screen: which two photos to show by default, how to resolve
 * the `?a=&b=` route params, and the week label of a photo. Labels are returned as data so
 * the UI translates them ("Before", "Week 3").
 */
import { ANGLES, ANGLES_BY_GOAL, type Angle, type Goal } from '@shared/catalog';
import { dayIndex, type IsoDate, weekIndex } from '@shared/timeline';

import type { JourneyPhoto } from '@/stores/journey';

export type WeekLabel = { kind: 'before' } | { kind: 'week'; week: number } | { kind: 'none' };

/** "Before" for photos taken before the operation day, "Week N" from day 0 on. */
export function weekLabelFor(takenAt: number, procedureDate: IsoDate | null): WeekLabel {
  if (!procedureDate) return { kind: 'none' };
  const day = dayIndex(procedureDate, new Date(takenAt));
  if (day < 0) return { kind: 'before' };
  return { kind: 'week', week: weekIndex(day) };
}

export interface PhotoPair {
  /** The older photo (left of the wipe, "before"). */
  a: JourneyPhoto;
  /** The newer photo ("after"). */
  b: JourneyPhoto;
}

function ofAngle(photos: readonly JourneyPhoto[], angle: Angle): JourneyPhoto[] {
  return photos.filter((p) => p.angle === angle).sort((x, y) => x.takenAt - y.takenAt);
}

export function sameAngleCount(photos: readonly JourneyPhoto[], angle: Angle): number {
  return ofAngle(photos, angle).length;
}

export function angleMismatch(a: JourneyPhoto, b: JourneyPhoto): boolean {
  return a.angle !== b.angle;
}

function ordered(x: JourneyPhoto, y: JourneyPhoto): PhotoPair {
  return x.takenAt <= y.takenAt ? { a: x, b: y } : { a: y, b: x };
}

/** First vs latest photo of one angle: the goal's own angles first, then any other. */
export function defaultPair(photos: readonly JourneyPhoto[], goal: Goal | null): PhotoPair | null {
  const goalAngles = goal ? ANGLES_BY_GOAL[goal] : [];
  const order = [...goalAngles, ...ANGLES.filter((a) => !goalAngles.includes(a))];
  for (const angle of order) {
    const series = ofAngle(photos, angle);
    const first = series[0];
    const last = series[series.length - 1];
    if (first && last && first.id !== last.id) return { a: first, b: last };
  }
  return null;
}

/**
 * Resolves `/compare?a=&b=`:
 *  - two known ids: that pair, older first;
 *  - one known id: partnered with the latest other photo of the same angle (or the first one
 *    when it is itself the latest), then with any other photo;
 *  - otherwise the default pair.
 */
export function resolvePair(
  photos: readonly JourneyPhoto[],
  params: { a?: string; b?: string },
  goal: Goal | null,
): PhotoPair | null {
  if (photos.length < 2) return null;
  const find = (id?: string) => (id ? photos.find((p) => p.id === id) : undefined);
  const a = find(params.a);
  const b = find(params.b);

  if (a && b && a.id !== b.id) return ordered(a, b);

  const known = a ?? b;
  if (known) {
    const others = ofAngle(photos, known.angle).filter((p) => p.id !== known.id);
    const newest = others[others.length - 1];
    const partner = newest
      ? // the newest photo of its angle pairs with the oldest; any other pairs with the newest
        known.takenAt > newest.takenAt
        ? others[0]
        : newest
      : [...photos].filter((p) => p.id !== known.id).sort((x, y) => y.takenAt - x.takenAt)[0];
    if (partner) return ordered(known, partner);
  }

  return defaultPair(photos, goal);
}
