/**
 * Rebuilds the journey's local reminders from the current stores (the notifications service
 * reads date, kind, sessions, prefs and entitlement itself). Called after anything that changes
 * what the reminders should say. Failures are swallowed on purpose — reminders are a
 * convenience, never a reason to block a save.
 */
import { scheduleJourneyReminders } from '@/services/notifications';

export function rescheduleJourneyReminders(): void {
  void scheduleJourneyReminders().catch(() => undefined);
}
