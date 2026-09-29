/**
 * App-lifecycle orchestration: runs once after the first frame (root layout stays
 * light — docs/checklists/performance.md). Signs in anonymously, mirrors server
 * state into stores, and turns render transitions into analytics + notifications.
 */
import { AppState } from 'react-native';

import type { RenderDoc } from '@shared/api';

import { currentLanguage } from '@/lib/i18n';
import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';

import { identify, setUserProperty, track } from './analytics';
import { getBackend } from './backend';
import { identifyCrashUser, recordNonFatal } from './crash';
import { configureNotificationHandling, getPermissionState, notifyRenderReady, registerPushToken } from './notifications';
import { purchases } from './purchases';
import { initRemoteConfig, remoteString } from './remoteConfig';
import { maybeAskForReview } from './review';
import { refreshGift } from './rewards';
import { isRetryable } from '@shared/api';

let started: Promise<void> | null = null;
let unsubscribers: (() => void)[] = [];
const lastStatus = new Map<string, RenderDoc['status']>();

function onRenders(renders: RenderDoc[]): void {
  const firstSnapshot = lastStatus.size === 0 && useAccount.getState().rendersState !== 'ready';
  for (const render of renders) {
    const previous = lastStatus.get(render.id);
    lastStatus.set(render.id, render.status);
    if (firstSnapshot || previous === undefined || previous === render.status) continue;
    if (render.status === 'succeeded') {
      track('core_action_lipsync', {
        resolution: render.resolution,
        seconds: render.seconds ?? 0,
        look: render.lookId,
        sound_kind: render.soundKind,
        purpose: render.purpose,
      });
      useSession.getState().recordRenderCompleted();
      if (getBackend().mode !== 'live' && AppState.currentState !== 'active') void notifyRenderReady(render.id);
      if (render.purpose === 'full') void maybeAskForReview('render');
    } else if (render.status === 'failed' && render.errorCode) {
      track('core_action_failed', {
        reason: render.errorCode,
        retryable: isRetryable(render.errorCode),
        stage: 'render',
      });
    }
  }
  useAccount.getState().setRenders(renders);
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
    account.setRendersState('loading');
    unsubscribers = [
      backend.data.watchWallet(uid, (wallet) => useAccount.getState().setWallet(wallet), (e) => recordNonFatal(e, 'watch_wallet')),
      backend.data.watchRenders(uid, onRenders, (e) => {
        useAccount.getState().setRendersState('error');
        recordNonFatal(e, 'watch_renders');
      }),
    ];

    await purchases.logIn(uid);
    const entitlement = useAccount.getState().entitlement;
    setUserProperty(
      'subscription_status',
      entitlement.isPro ? (entitlement.isTrial ? 'trial' : 'pro') : 'free',
    );
    await refreshGift();
    const session = useSession.getState();
    if (session.goal) setUserProperty('creator_goal', session.goal);
    backend.data
      .saveProfile(uid, {
        locale: currentLanguage(),
        goal: session.goal,
        genres: session.genres,
        onboardingVariant: remoteString('onboarding_variant'),
      })
      .catch((e: unknown) => recordNonFatal(e, 'save_profile'));
    useAccount.getState().setBackendState('ready');
    if ((await getPermissionState()) === 'granted') void registerPushToken();
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
  lastStatus.clear();
  started = null;
}
