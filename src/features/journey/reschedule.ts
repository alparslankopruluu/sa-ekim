/**
 * Rebuilds the journey's local reminders from the current stores. Called after anything that
 * changes what the reminders should say: the operation date, kind, PRP sessions.
 * Failures are swallowed on purpose — reminders are a convenience, never a reason to block a save.
 */
import { currentLocaleTag } from '@/lib/i18n';
import { scheduleJourneyReminders } from '@/services/notifications';
import { useAccount } from '@/stores/account';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';

export function rescheduleJourneyReminders(): void {
  const journey = useJourney.getState();
  const session = useSession.getState();
  void Promise.resolve(
    scheduleJourneyReminders({
      procedureDate: journey.procedureDate,
      goal: session.goal,
      kind: journey.kind,
      prpSessions: journey.prpSessions,
      prefs: session.preferences,
      isPro: useAccount.getState().entitlement.isPro,
      now: new Date(),
      locale: currentLocaleTag(),
    }),
  ).catch(() => undefined);
}
