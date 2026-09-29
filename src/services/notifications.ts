/**
 * Notifications: legitimate value moments only (PRODUCT.md) — a finished video,
 * a won gift about to expire (once), and reminders the user explicitly set.
 * Local notifications via expo-notifications; remote "video ready" pushes are sent
 * by the falWebhook Function to the FCM token registered here.
 */
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n, { currentLanguage } from '@/lib/i18n';
import { useSession } from '@/stores/session';

import { track } from './analytics';
import { getBackend } from './backend';
import { breadcrumb } from './crash';

export type NotificationType = 'render_ready' | 'gift_expiring' | 'birthday_reminder' | 'offer';

export const CHANNELS = { renders: 'renders', offers: 'offers', reminders: 'reminders' } as const;

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

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNELS.renders, {
    name: i18n.t('notifications.channels.renders'),
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.offers, {
    name: i18n.t('notifications.channels.offers'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
    name: i18n.t('notifications.channels.reminders'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!supported) return 'denied';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

/** Call only after the custom priming screen (never two system dialogs in a row). */
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
  if (result.granted) void registerPushToken();
  return result.granted;
}

/** Registers the FCM token under users/{uid}/devices so the server can push "video ready". */
export async function registerPushToken(): Promise<void> {
  if (!supported || !Device.isDevice) return;
  const backend = getBackend();
  const token = await backend.push.getToken();
  const uid = backend.auth.currentUid();
  if (!token || !uid) return;
  const prefs = useSession.getState().preferences;
  const topics = prefs.notifyOffers ? ['drops'] : [];
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

async function schedule(
  type: NotificationType,
  content: { title: string; body: string },
  trigger: Notifications.NotificationTriggerInput,
  data: Record<string, string> = {},
): Promise<string | null> {
  if (!supported) return null;
  if ((await getPermissionState()) !== 'granted') return null;
  const channelId = type === 'render_ready' ? CHANNELS.renders : type === 'gift_expiring' ? CHANNELS.offers : CHANNELS.reminders;
  return Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, data: { type, ...data } },
    trigger: trigger && Platform.OS === 'android' ? { ...trigger, channelId } : trigger,
  });
}

/** Local fallback used by the mock/emulator backend (live pushes come from the server). */
export async function notifyRenderReady(renderId: string): Promise<void> {
  if (!useSession.getState().preferences.notifyRenders) return;
  await schedule(
    'render_ready',
    { title: i18n.t('notifications.renderReady.title'), body: i18n.t('notifications.renderReady.body') },
    null,
    { renderId },
  );
}

export async function scheduleGiftReminder(expiresAt: number, prizeTitle: string): Promise<string | null> {
  if (!useSession.getState().preferences.notifyOffers) return null;
  const at = expiresAt - 24 * 60 * 60 * 1000;
  if (at <= Date.now() + 60_000) return null;
  return schedule(
    'gift_expiring',
    {
      title: i18n.t('notifications.giftExpiring.title'),
      body: i18n.t('notifications.giftExpiring.body', { prize: prizeTitle }),
    },
    { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  );
}

export async function scheduleBirthdayReminder(at: Date): Promise<string | null> {
  if (!useSession.getState().preferences.notifyReminders) return null;
  return schedule(
    'birthday_reminder',
    { title: i18n.t('notifications.birthday.title'), body: i18n.t('notifications.birthday.body') },
    { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  );
}

export async function cancelScheduled(id: string | null): Promise<void> {
  if (!supported || !id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

export interface NotificationTap {
  type: NotificationType;
  renderId?: string;
}

const TAP_TYPES: readonly NotificationType[] = ['render_ready', 'gift_expiring', 'birthday_reminder', 'offer'];

/** Subscribes to notification taps (deep links into the right screen). */
export function onNotificationTap(listener: (tap: NotificationTap) => void): () => void {
  if (!supported) return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const type = data?.type;
    // `offer` = campaign pushes sent from the Firebase console (custom data type=offer).
    if (!TAP_TYPES.includes(type as NotificationType)) return;
    track('notification_open', { type: type as NotificationType });
    listener({ type: type as NotificationType, renderId: typeof data?.renderId === 'string' ? data.renderId : undefined });
  });
  return () => subscription.remove();
}
