/**
 * Pure builder for the journey's local notifications (spec §4). No I/O and no clock reads:
 * `now` is an input, so the schedule is deterministic and testable. All date math is on
 * local calendar days (`new Date(y, m, d + n, hour)`), never `+ n * 24h`, so a clock change
 * cannot shift a reminder to the wrong wall-clock hour.
 *
 *  - care:   every evening on days 1–14 at 20:00 (free)
 *  - shed:   every 3rd day on days 15–56 at 19:00 (free)
 *  - phase:  the first day of each later phase at 09:00 (Pro)
 *  - photo:  Sundays 18:00 for the first 90 days, then every 30 days (Pro)
 *  - session: the day before each PRP session at 10:00 (free)
 *
 * Copy is never medical: the keys resolve to translated reminders in the `notifications`
 * namespace (`src/translations/<locale>/notifications.json`).
 */
import type { Goal, JourneyKind } from '@shared/catalog';
import {
  CARE_REMINDER_DAYS,
  type IsoDate,
  isIsoDate,
  type PhaseId,
  phaseForDay,
  phaseStartDays,
  weekIndex,
} from '@shared/timeline';

/** iOS keeps at most 64 pending local notifications; leave headroom for the gift reminder. */
export const IOS_PENDING_LIMIT = 60;

/** Every journey notification id starts with this, so a rebuild can cancel exactly ours. */
export const JOURNEY_NOTIFICATION_PREFIX = 'kok.journey.';

const CARE_HOUR = 20;
const PHASE_HOUR = 9;
const PHOTO_HOUR = 18;
const SHED_HOUR = 19;
const SESSION_HOUR = 10;
const SHED_FIRST_DAY = 15;
const SHED_LAST_DAY = 56;
const SHED_EVERY_DAYS = 3;
const WEEKLY_PHOTO_UNTIL_DAY = 90;
const MONTHLY_PHOTO_EVERY_DAYS = 30;

export interface ReminderPrefs {
  notifyReminders: boolean;
}

export interface ReminderSession {
  id: string;
  date: IsoDate;
  done: boolean;
}

export interface BuildRemindersInput {
  procedureDate: IsoDate | null;
  goal: Goal | null;
  kind: JourneyKind;
  prpSessions: readonly ReminderSession[];
  prefs: ReminderPrefs;
  isPro: boolean;
  now: Date;
  /** BCP-47 tag; only used to format dates inside notification copy. */
  locale: string;
}

export type ReminderData = { type: 'phase'; phase: PhaseId } | { type: 'photo_due' } | { type: 'shed' };

export type ReminderTitleKey =
  | 'notifications.care.title'
  | 'notifications.photo.title'
  | 'notifications.shed.title'
  | 'notifications.session.title'
  | `notifications.phase.${Exclude<PhaseId, 'care'>}.title`;

export type ReminderBodyKey =
  | 'notifications.care.body'
  | 'notifications.photo.body'
  | 'notifications.shed.body'
  | 'notifications.session.body'
  | `notifications.phase.${Exclude<PhaseId, 'care'>}.body`;

export interface JourneyReminder {
  /** Stable id, also used as the OS notification identifier. */
  id: string;
  at: Date;
  titleKey: ReminderTitleKey;
  bodyKey: ReminderBodyKey;
  params: Record<string, string | number>;
  data: ReminderData;
  channel: 'reminders';
}

function parseIso(iso: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

/** Local wall-clock time `hour:00` on `offset` calendar days after `iso`. */
function localAt(iso: IsoDate, offset: number, hour: number): Date {
  const { y, m, d } = parseIso(iso);
  return new Date(y, m - 1, d + offset, hour, 0, 0, 0);
}

function formatDate(at: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long' }).format(at);
  }
}

function timelineReminders(input: BuildRemindersInput, procedureDate: IsoDate): JourneyReminder[] {
  const goal: Goal = input.goal ?? 'hairline';
  const out: JourneyReminder[] = [];
  const id = (kind: string, key: string | number) => `${JOURNEY_NOTIFICATION_PREFIX}${kind}.${key}`;

  for (let day = 1; day <= CARE_REMINDER_DAYS; day += 1) {
    out.push({
      id: id('care', day),
      at: localAt(procedureDate, day, CARE_HOUR),
      titleKey: 'notifications.care.title',
      bodyKey: 'notifications.care.body',
      params: { day },
      data: { type: 'phase', phase: 'care' },
      channel: 'reminders',
    });
  }

  for (let day = SHED_FIRST_DAY; day <= SHED_LAST_DAY; day += SHED_EVERY_DAYS) {
    out.push({
      id: id('shed', day),
      at: localAt(procedureDate, day, SHED_HOUR),
      titleKey: 'notifications.shed.title',
      bodyKey: 'notifications.shed.body',
      params: { week: weekIndex(day) },
      data: { type: 'shed' },
      channel: 'reminders',
    });
  }

  if (input.isPro) {
    for (const { phase, day } of phaseStartDays(goal)) {
      if (phase === 'care') continue;
      out.push({
        id: id('phase', phase),
        at: localAt(procedureDate, day, PHASE_HOUR),
        titleKey: `notifications.phase.${phase}.title`,
        bodyKey: `notifications.phase.${phase}.body`,
        params: { week: weekIndex(day) },
        data: { type: 'phase', phase },
        channel: 'reminders',
      });
    }

    // Weekly on Sundays for the first 90 days, then every 30 days until the timeline ends.
    for (let day = 0; phaseForDay(day, goal).kind === 'phase'; day += 1) {
      const at = localAt(procedureDate, day, PHOTO_HOUR);
      const weekly = day <= WEEKLY_PHOTO_UNTIL_DAY && at.getDay() === 0;
      const monthly = day > WEEKLY_PHOTO_UNTIL_DAY && (day - WEEKLY_PHOTO_UNTIL_DAY) % MONTHLY_PHOTO_EVERY_DAYS === 0;
      if (!weekly && !monthly) continue;
      out.push({
        id: id('photo', day),
        at,
        titleKey: 'notifications.photo.title',
        bodyKey: 'notifications.photo.body',
        params: { week: weekIndex(day) },
        data: { type: 'photo_due' },
        channel: 'reminders',
      });
    }
  }

  return out;
}

function sessionReminders(input: BuildRemindersInput): JourneyReminder[] {
  const out: JourneyReminder[] = [];
  for (const session of input.prpSessions) {
    if (session.done || !isIsoDate(session.date)) continue;
    const at = localAt(session.date, -1, SESSION_HOUR);
    out.push({
      id: `${JOURNEY_NOTIFICATION_PREFIX}session.${session.id}`,
      at,
      titleKey: 'notifications.session.title',
      bodyKey: 'notifications.session.body',
      params: { date: formatDate(localAt(session.date, 0, 12), input.locale) },
      data: { type: 'photo_due' },
      channel: 'reminders',
    });
  }
  return out;
}

/**
 * The reminders to schedule right now: future-only, sorted by time, capped to the nearest
 * {@link IOS_PENDING_LIMIT}. Empty when reminders are off.
 */
export function buildJourneyReminders(input: BuildRemindersInput): JourneyReminder[] {
  if (!input.prefs.notifyReminders) return [];
  const all: JourneyReminder[] = [];
  if (input.kind === 'transplant' && input.procedureDate && isIsoDate(input.procedureDate)) {
    all.push(...timelineReminders(input, input.procedureDate));
  }
  all.push(...sessionReminders(input));

  const nowMs = input.now.getTime();
  return all
    .filter((r) => r.at.getTime() > nowMs)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, IOS_PENDING_LIMIT);
}
