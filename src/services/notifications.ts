/**
 * Notifications: legitimate value moments only (PRODUCT.md) — a finished preview, a won gift
 * about to expire (once), and the journey reminders the user opted into (care, shed log,
 * phase changes, same-angle photos, PRP sessions). Everything scheduled here is LOCAL
 * (expo-notifications); "preview ready" pushes in live mode are sent by the server to the FCM
 * token registered here. Reminder text is translated (`notifications` namespace) and never
 * makes a medical claim.
 */
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { PHASE_IDS, type PhaseId } from '@shared/timeline';

import i18n, { currentLanguage } from '@/lib/i18n';
import {
  buildJourneyReminders,
  type BuildRemindersInput,
  JOURNEY_NOTIFICATION_PREFIX,
} from '@/lib/journeyReminders';
import { useAccount } from '@/stores/account';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';

import { track } from './analytics';
import { getBackend } from './backend';
import { breadcrumb } from './crash';

/** What a tapped notification asks the app to open (see `onNotificationTap`). */
export type NotificationTap =
  | { type: 'preview_ready'; previewId: string }
  | { type: 'offer' }
  | { type: 'gift_expiring' }
  | { type: 'phase'; phase: PhaseId }
  | { type: 'photo_due' }
  | { type: 'shed' };

export type NotificationTapType = NotificationTap['type'];

/** Android notification channels; names come from `notifications.channels.*`. */
export const CHANNELS = { previews: 'previews', offers: 'offers', reminders: 'reminders' } as const;

const GIFT_NOTIFICATION_ID = 'kok.gift.expiring';
const supported = Platform.OS !== 'web';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export function configureNotificationHandling(): void {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Translates a key that is only known at run time (reminder keys come from the pure builder). */
function translate(key: string, params?: Record<string, string | number>): string {
  return (i18n.t as (k: string, o?: Record<string, unknown>) => string)(key, params);
}

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNELS.previews, {
    name: translate('notifications.channels.previews'),
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.offers, {
    name: translate('notifications.channels.offers'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
    name: translate('notifications.channels.reminders'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!supported) return 'denied';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Call only after the custom priming screen (never two system dialogs in a row). On a grant
 * it registers the push token and (re)builds the journey reminders.
 */
export async function requestPermission(source: string): Promise<boolean> {
  useSession.getState().markNotificationsPrompted();
  if (!supported) {
    track('notification_permission', { granted: false, source });
    return false;
  }
  await ensureAndroidChannels();
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  track('notification_permission', { granted: result.granted, source });
  if (result.granted) {
    void registerPushToken();
    void scheduleJourneyReminders();
  }
  return result.granted;
}

/** Registers the FCM token under users/{uid}/devices so the server can push "preview ready". */
export async function registerPushToken(): Promise<void> {
  if (!supported || !Device.isDevice) return;
  const backend = getBackend();
  const token = await backend.push.getToken();
  const uid = backend.auth.currentUid();
  if (!token || !uid) return;
  const prefs = useSession.getState().preferences;
  const topics = prefs.notifyOffers ? ['offers'] : [];
  // Stable per install without collecting a device identifier: a hash of the FCM token.
  const deviceId = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token)).slice(0, 40);
  await backend.data.registerDevice(uid, {
    deviceId,
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    topics,
    locale: currentLanguage(),
  });
  breadcrumb('push_token_registered');
}

// ------------------------------------------------------------------------ scheduling

type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

async function scheduleLocal(request: {
  identifier?: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channel: Channel;
  date: Date | null;
}): Promise<string | null> {
  if (!supported) return null;
  if ((await getPermissionState()) !== 'granted') return null;
  const isAndroid = Platform.OS === 'android';
  const trigger: Notifications.NotificationTriggerInput = request.date
    ? {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.date,
        ...(isAndroid ? { channelId: request.channel } : {}),
      }
    : isAndroid
      ? { channelId: request.channel }
      : null;
  return Notifications.scheduleNotificationAsync({
    identifier: request.identifier,
    content: { title: request.title, body: request.body, data: request.data },
    trigger,
  });
}

/** Local fallback used by the mock/emulator backend (live pushes come from the server). */
export async function notifyPreviewReady(previewId: string): Promise<void> {
  if (!useSession.getState().preferences.notifyPreviews) return;
  await scheduleLocal({
    title: translate('notifications.previewReady.title'),
    body: translate('notifications.previewReady.body'),
    data: { type: 'preview_ready', previewId },
    channel: CHANNELS.previews,
    date: null,
  });
}

/** One reminder, 24 hours before a won gift offer really expires. Returns the notification id. */
export async function scheduleGiftReminder(expiresAt: number): Promise<string | null> {
  if (!useSession.getState().preferences.notifyOffers) return null;
  const at = expiresAt - 24 * 60 * 60 * 1000;
  if (at <= Date.now() + 60_000) return null;
  const date = new Intl.DateTimeFormat(currentLanguage(), { day: 'numeric', month: 'long' }).format(
    new Date(expiresAt),
  );
  return scheduleLocal({
    identifier: GIFT_NOTIFICATION_ID,
    title: translate('notifications.giftExpiring.title'),
    body: translate('notifications.giftExpiring.body', { date }),
    data: { type: 'gift_expiring' },
    channel: CHANNELS.offers,
    date: new Date(at),
  });
}

export async function cancelGiftReminder(id: string | null): Promise<void> {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(id ?? GIFT_NOTIFICATION_ID).catch(() => undefined);
}

export type JourneyReminderInput = Omit<BuildRemindersInput, 'now' | 'locale'> & {
  /** Test seam; defaults to the current time. */
  now?: Date;
};

/** The journey inputs as they are in the stores right now. */
export function journeyInputFromStores(): JourneyReminderInput {
  const journey = useJourney.getState();
  return {
    procedureDate: journey.procedureDate,
    goal: useSession.getState().goal,
    kind: journey.kind,
    prpSessions: journey.prpSessions,
    prefs: useSession.getState().preferences,
    isPro: useAccount.getState().entitlement.isPro,
  };
}

/** Calls are chained so overlapping triggers (foreground + a store change) never double-schedule. */
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function cancelJourneyNow(): Promise<void> {
  if (!supported) return;
  const stored = useJourney.getState().scheduledNotificationIds;
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const ours = pending.map((n) => n.identifier).filter((id) => id.startsWith(JOURNEY_NOTIFICATION_PREFIX));
  const ids = new Set([...stored, ...ours]);
  await Promise.all([...ids].map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  useJourney.getState().setScheduledNotificationIds([]);
}

/** Cancels every journey reminder (e.g. after "delete all my data"). */
export function cancelJourneyReminders(): Promise<void> {
  return serialize(cancelJourneyNow);
}

/**
 * Cancels and rebuilds the journey reminders from `input` (default: the current stores).
 * Nothing is scheduled without notification permission or with reminders switched off.
 * Resolves with the number of reminders scheduled; ids are kept in
 * `useJourney.scheduledNotificationIds`.
 */
export function scheduleJourneyReminders(input?: Partial<JourneyReminderInput>): Promise<number> {
  return serialize(async () => {
    await cancelJourneyNow();
    if (!supported || (await getPermissionState()) !== 'granted') return 0;
    await ensureAndroidChannels();
    const { now = new Date(), ...rest } = { ...journeyInputFromStores(), ...input };
    const reminders = buildJourneyReminders({ ...rest, now, locale: currentLanguage() });
    const ids: string[] = [];
    for (const reminder of reminders) {
      const id = await scheduleLocal({
        identifier: reminder.id,
        title: translate(reminder.titleKey, reminder.params),
        body: translate(reminder.bodyKey, reminder.params),
        data: reminder.data,
        channel: CHANNELS.reminders,
        date: reminder.at,
      }).catch(() => null);
      if (id) ids.push(id);
    }
    useJourney.getState().setScheduledNotificationIds(ids);
    if (ids.length > 0) track('reminder_set', { kind: 'journey', count: ids.length });
    return ids.length;
  });
}

// ------------------------------------------------------------------------ taps

/** Validates notification `data` from a local schedule or a server push. Unknown types are ignored. */
export function parseNotificationTap(data: unknown): NotificationTap | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, previewId, phase } = data as Record<string, unknown>;
  switch (type) {
    case 'preview_ready':
      return typeof previewId === 'string' && previewId.length > 0 ? { type, previewId } : null;
    case 'phase':
      return (PHASE_IDS as readonly unknown[]).includes(phase) ? { type, phase: phase as PhaseId } : null;
    // `offer` also covers campaign pushes sent from the Firebase console (custom data type=offer).
    case 'offer':
    case 'gift_expiring':
    case 'photo_due':
    case 'shed':
      return { type };
    default:
      return null;
  }
}

/** Subscribes to notification taps (deep links); also delivers the tap that cold-started the app. */
export function onNotificationTap(listener: (tap: NotificationTap) => void): () => void {
  if (!supported) return () => undefined;
  const delivered = new Set<string>();
  const deliver = (response: Notifications.NotificationResponse) => {
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (delivered.has(key)) return;
    delivered.add(key);
    const tap = parseNotificationTap(response.notification.request.content.data);
    if (!tap) return;
    track('notification_open', { type: tap.type });
    listener(tap);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(deliver);
  const launch = Notifications.getLastNotificationResponse?.();
  if (launch) {
    deliver(launch);
    Notifications.clearLastNotificationResponse?.();
  }
  return () => subscription.remove();
}
