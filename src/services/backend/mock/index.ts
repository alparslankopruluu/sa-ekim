import { Platform } from 'react-native';

import { pushDevLog } from '../devLog';
import { toBackendError, withTimeout } from '../errors';
import { type Backend, BackendError, type RemoteValue } from '../types';

import { makeDemoResult } from './demoResult';
import { mockServer } from './mockServer';

const remoteOverrides = new Map<string, RemoteValue>();

/**
 * Developer screen hook: override a Remote Config value in mock mode. `previews_enabled`
 * also drives the mock server's kill switch, like the live `generationEnabled` config.
 */
export function setMockRemoteValue(key: string, value: RemoteValue): void {
  remoteOverrides.set(key, value);
  if (key === 'previews_enabled') mockServer.flags.generationEnabled = value === true || value === 'true';
}

export function createMockBackend(): Backend {
  let remoteDefaults: Record<string, RemoteValue> = {};
  const remote = (key: string): RemoteValue | undefined => remoteOverrides.get(key) ?? remoteDefaults[key];

  return {
    mode: 'mock',
    analytics: {
      logEvent(name, params) {
        pushDevLog({ kind: 'event', name, detail: params ? JSON.stringify(params) : undefined });
      },
      logScreen(name) {
        pushDevLog({ kind: 'screen', name });
      },
      setUserId(id) {
        pushDevLog({ kind: 'property', name: 'user_id', detail: id ? 'set' : 'cleared' });
      },
      setUserProperty(name, value) {
        pushDevLog({ kind: 'property', name, detail: value ?? 'null' });
      },
      async getAppInstanceId() {
        return null;
      },
    },
    crash: {
      log(message) {
        pushDevLog({ kind: 'breadcrumb', name: message });
      },
      recordError(error, context) {
        pushDevLog({ kind: 'crash', name: context, detail: error.name });
      },
      setUserId() {},
      setAttributes() {},
      testCrash() {
        pushDevLog({ kind: 'crash', name: 'test_crash', detail: 'mock backend does not crash' });
      },
    },
    perf: {
      startTrace(name) {
        const started = Date.now();
        return {
          putAttribute() {},
          stop() {
            pushDevLog({ kind: 'breadcrumb', name: `trace:${name}`, detail: `${Date.now() - started}ms` });
          },
        };
      },
    },
    remoteConfig: {
      async init(defaults) {
        remoteDefaults = defaults;
      },
      getString(key) {
        const value = remote(key);
        return value === undefined ? '' : String(value);
      },
      getNumber(key) {
        const value = remote(key);
        return typeof value === 'number' ? value : Number(value ?? 0);
      },
      getBoolean(key) {
        const value = remote(key);
        return value === true || value === 'true';
      },
    },
    auth: {
      async ensureSignedIn() {
        await mockServer.ready();
        return mockServer.uid;
      },
      currentUid() {
        return mockServer.uid;
      },
      async signOutLocal() {
        await mockServer.reset();
      },
    },
    storage: {
      async uploadUserFile(_uid, localUri, kind) {
        await mockServer.ready();
        return mockServer.putLocalFile(kind, localUri);
      },
      async resolveUrl(storagePath) {
        await mockServer.ready();
        const file = mockServer.resolveFile(storagePath);
        if (!file) throw new BackendError('not_found');
        if (file.kind === 'local') return file.uri;
        // A finished preview: the user's photo run through the labelled demo variation.
        const source = mockServer.resolveFile(file.sourcePath);
        if (source?.kind !== 'local') throw new BackendError('not_found');
        return makeDemoResult(source.uri);
      },
    },
    functions: {
      async call<Req, Res>(name: string, data: Req, timeoutMs: number): Promise<Res> {
        try {
          return (await withTimeout(mockServer.handle(name, data), timeoutMs)) as Res;
        } catch (error) {
          throw toBackendError(error);
        }
      },
    },
    data: {
      watchPreviews(_uid, onChange) {
        return mockServer.watchPreviews(onChange);
      },
      watchWallet(_uid, onChange) {
        return mockServer.watchWallet(onChange);
      },
      async getGift() {
        await mockServer.ready();
        return mockServer.getGift();
      },
      async saveProfile(_uid, profile) {
        mockServer.saveProfile(profile);
      },
      async registerDevice(_uid, device) {
        mockServer.registerDevice({ ...device, platform: Platform.OS === 'android' ? 'android' : device.platform });
      },
    },
    push: {
      async getToken() {
        return null;
      },
      onTokenRefresh() {
        return () => undefined;
      },
    },
  };
}
