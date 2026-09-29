import { CARE_REMINDER_DAYS } from '@shared/timeline';

import {
  buildJourneyReminders,
  type BuildRemindersInput,
  IOS_PENDING_LIMIT,
  JOURNEY_NOTIFICATION_PREFIX,
} from '../journeyReminders';

/** Local-time helper: month is 1-based to match the ISO dates used in the app. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

const BASE: BuildRemindersInput = {
  procedureDate: '2026-03-01',
  goal: 'hairline',
  kind: 'transplant',
  prpSessions: [],
  prefs: { notifyReminders: true },
  isPro: false,
  now: local(2026, 3, 1, 12),
  locale: 'en',
};

const build = (overrides: Partial<BuildRemindersInput> = {}) => buildJourneyReminders({ ...BASE, ...overrides });
const byPrefix = (list: ReturnType<typeof build>, kind: string) =>
  list.filter((r) => r.id.startsWith(`${JOURNEY_NOTIFICATION_PREFIX}${kind}.`));

/** Whole local days from the procedure day to `at` (DST-safe: compares calendar dates). */
const dayOf = (at: Date, y = 2026, m = 3, d = 1) =>
  Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - Date.UTC(y, m - 1, d)) / 86_400_000);

describe('buildJourneyReminders', () => {
  describe('gating', () => {
    it('returns nothing when reminders are switched off', () => {
      expect(build({ prefs: { notifyReminders: false }, isPro: true })).toEqual([]);
    });

    it('returns nothing without an operation date or sessions', () => {
      expect(build({ procedureDate: null })).toEqual([]);
    });

    it('ignores a malformed date', () => {
      expect(build({ procedureDate: '2026-13-45' })).toEqual([]);
    });

    it('does not build a transplant timeline for a PRP course', () => {
      expect(build({ kind: 'prp', isPro: true })).toEqual([]);
    });
  });

  describe('free reminders', () => {
    const free = build();

    it('sends the daily care reminder on days 1 to 14 at 20:00', () => {
      const care = byPrefix(free, 'care');
      expect(CARE_REMINDER_DAYS).toBe(14);
      expect(care.map((r) => dayOf(r.at))).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
      for (const r of care) {
        expect(r.at.getHours()).toBe(20);
        expect(r.at.getMinutes()).toBe(0);
        expect(r.channel).toBe('reminders');
        expect(r.data).toEqual({ type: 'phase', phase: 'care' });
        expect(r.titleKey).toBe('notifications.care.title');
        expect(r.bodyKey).toBe('notifications.care.body');
      }
      expect(care[2]?.params).toEqual({ day: 3 });
    });

    it('nudges the shed log every third day during days 15 to 56 at 19:00', () => {
      const shed = byPrefix(free, 'shed');
      const days = shed.map((r) => dayOf(r.at));
      expect(days[0]).toBe(15);
      expect(days.every((d, i) => d === 15 + i * 3)).toBe(true);
      expect(Math.max(...days)).toBeLessThanOrEqual(56);
      expect(days).toHaveLength(14);
      for (const r of shed) {
        expect(r.at.getHours()).toBe(19);
        expect(r.data).toEqual({ type: 'shed' });
      }
    });

    it('leaves the Pro phase and photo reminders out', () => {
      expect(byPrefix(free, 'phase')).toHaveLength(0);
      expect(byPrefix(free, 'photo')).toHaveLength(0);
    });
  });

  describe('Pro reminders', () => {
    it('starts each phase at 09:00 on its first day', () => {
      const early = buildJourneyReminders({ ...BASE, isPro: true, now: local(2026, 3, 3, 12) });
      expect(byPrefix(early, 'phase')[0]?.data).toEqual({ type: 'phase', phase: 'shed' });
      expect(byPrefix(early, 'phase')[0]?.at).toEqual(local(2026, 3, 16, 9));
      expect(byPrefix(early, 'phase')[0]?.titleKey).toBe('notifications.phase.shed.title');

      // Only the nearest reminders survive the pending cap, so probe the later phases separately.
      const later = buildJourneyReminders({ ...BASE, isPro: true, now: local(2026, 3, 16, 12) });
      expect(byPrefix(later, 'phase').map((r) => [dayOf(r.at), r.data])).toEqual([
        [57, { type: 'phase', phase: 'quiet' }],
        [121, { type: 'phase', phase: 'sprout' }],
        [181, { type: 'phase', phase: 'grow' }],
        [271, { type: 'phase', phase: 'mature' }],
        [366, { type: 'phase', phase: 'final' }],
      ]);
      for (const r of byPrefix(later, 'phase')) expect(r.at.getHours()).toBe(9);
    });

    it('reminds for a photo on Sundays at 18:00 for the first 90 days', () => {
      const pro = buildJourneyReminders({ ...BASE, isPro: true, now: local(2026, 3, 1, 19) });
      const photo = byPrefix(pro, 'photo');
      expect(photo.length).toBeGreaterThan(0);
      for (const r of photo.filter((p) => dayOf(p.at) <= 90)) {
        expect(r.at.getDay()).toBe(0);
        expect(r.at.getHours()).toBe(18);
        expect(r.data).toEqual({ type: 'photo_due' });
      }
    });

    it('switches to a monthly photo reminder after day 90', () => {
      const pro = buildJourneyReminders({ ...BASE, isPro: true, now: local(2026, 6, 1, 12) });
      const days = byPrefix(pro, 'photo')
        .map((r) => dayOf(r.at))
        .filter((d) => d > 90);
      expect(days.slice(0, 4)).toEqual([120, 150, 180, 210]);
    });

    it('stops with the last day of the timeline for the goal', () => {
      const late = local(2027, 3, 1, 12);
      const hairline = buildJourneyReminders({ ...BASE, isPro: true, now: late });
      const crown = buildJourneyReminders({ ...BASE, goal: 'crown', isPro: true, now: late });
      const last = (list: typeof hairline) => Math.max(...byPrefix(list, 'photo').map((r) => dayOf(r.at)));
      expect(last(hairline)).toBeLessThanOrEqual(456);
      expect(last(crown)).toBeLessThanOrEqual(548);
      expect(last(crown)).toBeGreaterThan(last(hairline));
    });

    it('treats a missing goal as hairline', () => {
      expect(build({ goal: null, isPro: true })).toEqual(build({ goal: 'hairline', isPro: true }));
    });
  });

  describe('never in the past', () => {
    it('drops reminders whose time has passed', () => {
      const list = build({ now: local(2026, 3, 6, 21) });
      const care = byPrefix(list, 'care').map((r) => dayOf(r.at));
      expect(care[0]).toBe(6); // Mar 6 is day 5; its 20:00 reminder has passed
      expect(list.every((r) => r.at.getTime() > local(2026, 3, 6, 21).getTime())).toBe(true);
    });

    it('keeps a reminder later the same day', () => {
      const list = build({ now: local(2026, 3, 6, 19, 59) });
      expect(byPrefix(list, 'care').map((r) => dayOf(r.at))[0]).toBe(5);
    });

    it('returns an empty list long after the journey ended', () => {
      expect(build({ isPro: true, now: local(2030, 1, 1) })).toEqual([]);
    });
  });

  describe('list shape', () => {
    it('is sorted, unique and capped to the nearest 60 for iOS', () => {
      const list = build({ goal: 'crown', isPro: true, now: local(2026, 3, 1, 8) });
      expect(list).toHaveLength(IOS_PENDING_LIMIT);
      expect(IOS_PENDING_LIMIT).toBe(60);
      const times = list.map((r) => r.at.getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
      for (const r of list) expect(r.id.startsWith(JOURNEY_NOTIFICATION_PREFIX)).toBe(true);
    });

    it('is pure: identical inputs give identical output', () => {
      expect(build({ isPro: true })).toEqual(build({ isPro: true }));
    });
  });

  describe('PRP sessions', () => {
    const sessions = [
      { id: 's1', date: '2026-03-10', done: false },
      { id: 's2', date: '2026-04-07', done: false },
      { id: 's3', date: '2026-05-05', done: true },
    ];

    it('reminds the day before at 10:00 and skips done sessions', () => {
      const list = build({ kind: 'prp', prpSessions: sessions });
      const session = byPrefix(list, 'session');
      expect(session.map((r) => r.at)).toEqual([local(2026, 3, 9, 10), local(2026, 4, 6, 10)]);
      expect(session[0]?.data).toEqual({ type: 'photo_due' });
      expect(session[0]?.titleKey).toBe('notifications.session.title');
      expect(session[0]?.params).toHaveProperty('date');
      expect(list.every((r) => r.id.includes('.session.'))).toBe(true);
    });

    it('is free and does not need a procedure date', () => {
      const list = build({ kind: 'prp', prpSessions: sessions, procedureDate: null, isPro: false });
      expect(list).toHaveLength(2);
    });

    it('skips sessions whose reminder time has passed', () => {
      const list = build({ kind: 'prp', prpSessions: sessions, now: local(2026, 3, 9, 10, 1) });
      expect(byPrefix(list, 'session')).toHaveLength(1);
    });

    it('also works next to a transplant timeline (part goal course)', () => {
      const list = build({ prpSessions: sessions });
      expect(byPrefix(list, 'session')).toHaveLength(2);
      expect(byPrefix(list, 'care')).toHaveLength(14);
    });

    it('ignores sessions with an invalid date and formats dates for any locale', () => {
      const list = build({
        kind: 'prp',
        locale: 'not a locale',
        prpSessions: [
          { id: 'bad', date: 'nope', done: false },
          { id: 's1', date: '2026-03-10', done: false },
        ],
      });
      expect(byPrefix(list, 'session')).toHaveLength(1);
      expect(typeof byPrefix(list, 'session')[0]?.params.date).toBe('string');
    });
  });

  describe('daylight saving time', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    it.each(['America/New_York', 'Europe/London', 'Australia/Sydney', 'Europe/Istanbul'])(
      'keeps every reminder at its wall-clock hour across a clock change in %s',
      (tz) => {
        process.env.TZ = tz;
        // Procedure on the day before the northern-hemisphere spring change and inside Sydney's window.
        for (const procedureDate of ['2026-03-07', '2026-03-27', '2026-10-01', '2026-10-30']) {
          const list = buildJourneyReminders({
            ...BASE,
            procedureDate,
            isPro: true,
            now: new Date(2026, 0, 1),
          });
          for (const r of list) {
            const kind = r.id.split('.')[2];
            const expected = { care: 20, phase: 9, photo: 18, shed: 19 }[kind as 'care' | 'phase' | 'photo' | 'shed'];
            expect(r.at.getHours()).toBe(expected);
            expect(r.at.getMinutes()).toBe(0);
          }
        }
      },
    );

    it('counts calendar days, not 24-hour blocks, when the clocks change', () => {
      process.env.TZ = 'America/New_York';
      const list = buildJourneyReminders({ ...BASE, procedureDate: '2026-03-07', now: new Date(2026, 0, 1) });
      const care = byPrefix(list, 'care');
      expect(care[0]?.at).toEqual(new Date(2026, 2, 8, 20, 0));
      expect(care[1]?.at).toEqual(new Date(2026, 2, 9, 20, 0));
      expect(care).toHaveLength(14);
    });
  });
});
