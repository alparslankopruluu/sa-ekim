/**
 * App-lifecycle orchestration: runs once after the first frame (root layout stays light —
 * docs/checklists/performance.md). Signs in anonymously, mirrors server state into stores,
 * turns preview transitions into analytics + notifications, keeps the journey reminders in
 * step with the journey/prefs/language/entitlement, and keeps the analytics user properties
 * (goal, journey stage) current.
 */
import { AppState } from 'react-native';

import { isRetryable, type PreviewDoc } from '@shared/api';

import i18n, { currentLanguage } from '@/lib/i18n';
import { useAccount } from '@/stores/account';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';

import { identify, setUserProperty, track } from './analytics';
import { getBackend } from './backend';
import { identifyCrashUser, recordNonFatal } from './crash';
import {
  configureNotificationHandling,
  getPermissionState,
  notifyPreviewReady,
  registerPushToken,
  scheduleJourneyReminders,
} from './notifications';
import { purchases } from './purchases';
import { initRemoteConfig, remoteString } from './remoteConfig';
import { maybeAskForReview } from './review';
import { refreshGift } from './rewards';

/** Waits this long for a burst of store changes to settle before rebuilding reminders. */
const REMINDER_DEBOUNCE_MS = 600;

let started: Promise<void> | null = null;
let unsubscribers: (() => void)[] = [];
let watchers: (() => void)[] = [];
const lastStatus = new Map<string, PreviewDoc['status']>();

/**
 * Preview snapshot handler: emits `core_action_preview` / `core_action_failed` once per
 * status transition, records the completion, notifies when backgrounded (mock/emulator only —
 * live pushes come from the server) and offers the review prompt after a paid preview.
 * Exported for tests.
 */
export function processPreviewSnapshot(previews: PreviewDoc[]): void {
  const firstSnapshot = lastStatus.size === 0 && useAccount.getState().previewsState !== 'ready';
  for (const preview of previews) {
    const previous = lastStatus.get(preview.id);
    lastStatus.set(preview.id, preview.status);
    if (firstSnapshot || previous === undefined || previous === preview.status) continue;
    if (preview.status === 'succeeded') {
      track('core_action_preview', {
        quality: preview.quality,
        style: preview.styleId,
        goal: preview.goal,
        onboarding: preview.onboarding,
      });
      useSession.getState().recordPreviewCompleted();
      if (getBackend().mode !== 'live' && AppState.currentState !== 'active') void notifyPreviewReady(preview.id);
      if (!preview.onboarding) void maybeAskForReview('preview');
    } else if (preview.status === 'failed') {
      const reason = preview.errorCode ?? 'unknown';
      track('core_action_failed', { reason, retryable: isRetryable(reason), stage: 'preview' });
    }
  }
  useAccount.getState().setPreviews(previews);
}

function syncUserProperties(): void {
  const { goal, stage } = useSession.getState();
  setUserProperty('goal', goal);
  setUserProperty('journey_stage', stage);
  const { entitlement, entitlementLoaded } = useAccount.getState();
  if (entitlementLoaded) setUserProperty('subscription_status', entitlement.isPro ? 'pro' : 'free');
}

function saveProfile(uid: string): void {
  const { goal, stage } = useSession.getState();
  getBackend()
    .data.saveProfile(uid, {
      locale: currentLanguage(),
      goal,
      stage,
      onboardingVariant: remoteString('onboarding_variant'),
    })
    .catch((e: unknown) => recordNonFatal(e, 'save_profile'));
}

/** Everything the reminder schedule depends on; a change here means a rebuild. */
function reminderSignature(): string {
  const journey = useJourney.getState();
  const session = useSession.getState();
  return JSON.stringify([
    journey.procedureDate,
    journey.kind,
    journey.prpSessions.map((s) => [s.id, s.date, s.done]),
    session.goal,
    session.preferences.notifyReminders,
    useAccount.getState().entitlement.isPro,
    currentLanguage(),
  ]);
}

/**
 * Keeps local state in step: rebuilds journey reminders on foreground and when the journey,
 * goal, reminder preference, language or entitlement changes; re-publishes the goal/stage user
 * properties and the profile when they change.
 */
function startWatchers(uid: string): void {
  stopWatchers();
  let reminderSignatureSeen = '';
  let profileSignatureSeen = JSON.stringify([useSession.getState().goal, useSession.getState().stage]);
  let entitlementSeen = useAccount.getState().entitlement.isPro;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const rebuild = (force: boolean) => {
    // Without a known entitlement the Pro reminders cannot be decided: leave the schedule alone.
    if (!useAccount.getState().entitlementLoaded) return;
    const signature = reminderSignature();
    if (!force && signature === reminderSignatureSeen) return;
    reminderSignatureSeen = signature;
    scheduleJourneyReminders().catch((e: unknown) => recordNonFatal(e, 'schedule_reminders'));
  };
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      rebuild(false);
    }, REMINDER_DEBOUNCE_MS);
  };

  watchers = [
    () => {
      if (timer) clearTimeout(timer);
    },
    useJourney.subscribe(debounced),
    useSession.subscribe(() => {
      debounced();
      const profileSignature = JSON.stringify([useSession.getState().goal, useSession.getState().stage]);
      if (profileSignature !== profileSignatureSeen) {
        profileSignatureSeen = profileSignature;
        syncUserProperties();
        saveProfile(uid);
      }
    }),
    useAccount.subscribe((state) => {
      if (state.entitlement.isPro !== entitlementSeen) {
        entitlementSeen = state.entitlement.isPro;
        syncUserProperties();
      }
      debounced();
    }),
    (() => {
      const onLanguage = () => debounced();
      i18n.on('languageChanged', onLanguage);
      return () => i18n.off('languageChanged', onLanguage);
    })(),
    (() => {
      const subscription = AppState.addEventListener('change', (next) => {
        // Time has passed: the nearest reminders and the pending cap window both move.
        if (next === 'active') rebuild(true);
      });
      return () => subscription.remove();
    })(),
  ];
  rebuild(true);
}

function stopWatchers(): void {
  watchers.forEach((stop) => stop());
  watchers = [];
}

async function run(): Promise<void> {
  const backend = getBackend();
  const account = useAccount.getState();
  purchases.configure();
  configureNotificationHandling();
  await initRemoteConfig();
  setUserProperty('backend_mode', backend.mode);
  setUserProperty('onboarding_variant', remoteString('onboarding_variant'));
  setUserProperty('paywall_variant', remoteString('paywall_variant'));
  setUserProperty('app_language', currentLanguage());
  setUserProperty('offers_opt_in', useSession.getState().preferences.notifyOffers ? 'yes' : 'no');
  account.setBackendState('loading');
  try {
    const uid = await backend.auth.ensureSignedIn();
    account.setUid(uid);
    identify(uid);
    identifyCrashUser(uid);

    unsubscribers.forEach((u) => u());
    account.setPreviewsState('loading');
    unsubscribers = [
      backend.data.watchWallet(
        uid,
        (wallet) => useAccount.getState().setWallet(wallet),
        (e) => recordNonFatal(e, 'watch_wallet'),
      ),
      backend.data.watchPreviews(uid, processPreviewSnapshot, (e) => {
        useAccount.getState().setPreviewsState('error');
        recordNonFatal(e, 'watch_previews');
      }),
    ];

    await purchases.logIn(uid);
    syncUserProperties();
    await refreshGift();
    saveProfile(uid);
    useAccount.getState().setBackendState('ready');
    if ((await getPermissionState()) === 'granted') void registerPushToken();
    startWatchers(uid);
  } catch (error) {
    useAccount.getState().setBackendState('error');
    recordNonFatal(error, 'bootstrap');
  }
}

/** Idempotent: safe to call from several screens; retries after a failure. */
export function startSession(): Promise<void> {
  if (!started || useAccount.getState().backendState === 'error') started = run();
  return started;
}

export function stopSession(): void {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  stopWatchers();
  lastStatus.clear();
  started = null;
}
