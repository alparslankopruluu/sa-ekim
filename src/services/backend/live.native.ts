/**
 * Live/emulator backend on iOS and Android: React Native Firebase (modular API).
 * This is the ONLY module that imports Firebase SDKs (docs/stack.md).
 * Web resolves `./live` to live.ts instead and never bundles these modules.
 */
import {
  getAnalytics,
  getAppInstanceId,
  logEvent,
  logScreenView,
  setUserId as setAnalyticsUserId,
  setUserProperty,
} from '@react-native-firebase/analytics';
import { getApp } from '@react-native-firebase/app';
import { initializeAppCheck } from '@react-native-firebase/app-check';
import { connectAuthEmulator, getAuth, signInAnonymously, signOut } from '@react-native-firebase/auth';
import {
  crash,
  getCrashlytics,
  log as crashLog,
  recordError,
  setAttributes,
  setUserId as setCrashUserId,
} from '@react-native-firebase/crashlytics';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getMessaging, getToken, onTokenRefresh } from '@react-native-firebase/messaging';
import { getPerformance, trace } from '@react-native-firebase/perf';
import {
  fetchAndActivate,
  getBoolean,
  getNumber,
  getRemoteConfig,
  getString,
} from '@react-native-firebase/remote-config';
import { connectStorageEmulator, getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { toBackendError, withTimeout } from './errors';
import { firebaseRegion } from './mode';
import { parseGift, parsePreview, parseWallet } from './parsers';
import type { AnalyticsParams, Backend, BackendMode, RemoteValue } from './types';

const EMULATOR_HOST =
  process.env.EXPO_PUBLIC_EMULATOR_HOST ?? (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');
const APP_CHECK_DEBUG_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || undefined;

/** Firebase calls return `void` or a Promise depending on the method; never let either throw. */
function fireAndForget(result: unknown): void {
  if (result && typeof (result as Promise<unknown>).catch === 'function') {
    (result as Promise<unknown>).catch(() => undefined);
  }
}

function cleanParams(params?: AnalyticsParams): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) out[key] = typeof value === 'string' ? value.slice(0, 100) : value;
  }
  return out;
}

export function createLiveBackend(mode: Exclude<BackendMode, 'mock'>): Backend {
  const app = getApp();

  // App Check first, so every callable carries a token (App Attest / Play Integrity; debug in dev builds).
  initializeAppCheck(app, {
    provider: {
      providerOptions: {
        apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback', debugToken: APP_CHECK_DEBUG_TOKEN },
        android: { provider: __DEV__ ? 'debug' : 'playIntegrity', debugToken: APP_CHECK_DEBUG_TOKEN },
      },
    },
    isTokenAutoRefreshEnabled: true,
  });

  const analytics = getAnalytics(app);
  const crashlytics = getCrashlytics();
  const performance = getPerformance(app);
  const remoteConfig = getRemoteConfig(app);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app, firebaseRegion);
  const storage = getStorage(app);
  const messaging = getMessaging(app);

  if (mode === 'emulator') {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`);
    connectFirestoreEmulator(firestore, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  }

  return {
    mode,
    analytics: {
      logEvent(name, params) {
        fireAndForget(logEvent(analytics, name, cleanParams(params)));
      },
      logScreen(name) {
        fireAndForget(logScreenView(analytics, { screen_name: name, screen_class: name }));
      },
      setUserId(id) {
        fireAndForget(setAnalyticsUserId(analytics, id));
      },
      setUserProperty(name, value) {
        fireAndForget(setUserProperty(analytics, name, value));
      },
      async getAppInstanceId() {
        try {
          return (await getAppInstanceId(analytics)) ?? null;
        } catch {
          return null;
        }
      },
    },
    crash: {
      log(message) {
        crashLog(crashlytics, message);
      },
      recordError(error, context) {
        const sanitized = new Error(context);
        sanitized.name = error.name;
        recordError(crashlytics, sanitized, context);
      },
      setUserId(id) {
        fireAndForget(setCrashUserId(crashlytics, id));
      },
      setAttributes(attributes) {
        fireAndForget(setAttributes(crashlytics, attributes));
      },
      testCrash() {
        crash(crashlytics);
      },
    },
    perf: {
      startTrace(name) {
        const handle = trace(performance, name);
        fireAndForget(handle.start());
        return {
          putAttribute(key, value) {
            handle.putAttribute(key, value);
          },
          stop() {
            fireAndForget(handle.stop());
          },
        };
      },
    },
    remoteConfig: {
      async init(defaults: Record<string, RemoteValue>) {
        remoteConfig.defaultConfig = defaults;
        remoteConfig.settings = {
          minimumFetchIntervalMillis: __DEV__ ? 0 : 12 * 60 * 60 * 1000,
          fetchTimeoutMillis: 8000,
        };
        // Never block cold start: activate in the background.
        fireAndForget(fetchAndActivate(remoteConfig));
      },
      getString(key) {
        return getString(remoteConfig, key);
      },
      getNumber(key) {
        return getNumber(remoteConfig, key);
      },
      getBoolean(key) {
        return getBoolean(remoteConfig, key);
      },
    },
    auth: {
      async ensureSignedIn() {
        if (auth.currentUser) return auth.currentUser.uid;
        try {
          const credential = await withTimeout(signInAnonymously(auth), 15000);
          return credential.user.uid;
        } catch (error) {
          throw toBackendError(error);
        }
      },
      currentUid() {
        return auth.currentUser?.uid ?? null;
      },
      async signOutLocal() {
        await signOut(auth);
      },
    },
    storage: {
      async uploadUserFile(uid, localUri, _kind, contentType) {
        // Only selfies for previews are ever uploaded (journey photos never leave the device).
        const path = `uploads/${uid}/${Crypto.randomUUID()}.jpg`;
        try {
          await withTimeout(
            Promise.resolve(putFile(ref(storage, path), localUri.replace('file://', ''), { contentType })),
            60000,
          );
          return path;
        } catch (error) {
          throw toBackendError(error);
        }
      },
      async resolveUrl(storagePath) {
        try {
          return await withTimeout(getDownloadURL(ref(storage, storagePath)), 15000);
        } catch (error) {
          throw toBackendError(error);
        }
      },
    },
    functions: {
      async call<Req, Res>(name: string, data: Req, timeoutMs: number): Promise<Res> {
        try {
          const callable = httpsCallable<Req, Res>(functions, name, { timeout: timeoutMs });
          const result = await withTimeout(callable(data), timeoutMs + 2000);
          return result.data;
        } catch (error) {
          throw toBackendError(error);
        }
      },
    },
    data: {
      watchPreviews(uid, onChange, onError) {
        const previewsQuery = query(
          collection(firestore, 'users', uid, 'previews'),
          orderBy('createdAt', 'desc'),
          limit(60),
        );
        return onSnapshot(
          previewsQuery,
          (snapshot) => {
            const previews = snapshot.docs
              .map((d) => parsePreview(d.id, d.data()))
              .filter((p): p is NonNullable<typeof p> => p !== null);
            onChange(previews);
          },
          (error) => onError(toBackendError(error)),
        );
      },
      watchWallet(uid, onChange, onError) {
        return onSnapshot(
          doc(firestore, 'users', uid, 'private', 'wallet'),
          (snapshot) => onChange(parseWallet(snapshot.data())),
          (error) => onError(toBackendError(error)),
        );
      },
      async getGift(uid) {
        try {
          const snapshot = await withTimeout(getDoc(doc(firestore, 'users', uid, 'private', 'gift')), 10000);
          return parseGift(snapshot.data());
        } catch (error) {
          throw toBackendError(error);
        }
      },
      async saveProfile(uid, profile) {
        await setDoc(
          doc(firestore, 'users', uid),
          {
            locale: profile.locale,
            goal: profile.goal,
            stage: profile.stage,
            onboardingVariant: profile.onboardingVariant,
          },
          { merge: true },
        );
      },
      async registerDevice(uid, device) {
        await setDoc(
          doc(firestore, 'users', uid, 'devices', device.deviceId),
          {
            token: device.token,
            platform: device.platform,
            topics: device.topics,
            locale: device.locale,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      },
    },
    push: {
      async getToken() {
        try {
          return await withTimeout(getToken(messaging), 10000);
        } catch {
          return null;
        }
      },
      onTokenRefresh(listener) {
        return onTokenRefresh(messaging, listener);
      },
    },
  };
}
