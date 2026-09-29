/**
 * Provider ports. `mock`, `emulator` and `live` backends implement the same
 * interfaces, so no screen or store knows which one is running.
 */
import type { GiftDoc, PreviewDoc, WalletDoc } from '@shared/api';
import type { Goal, Stage } from '@shared/catalog';

export type BackendMode = 'mock' | 'emulator' | 'live';

export type AnalyticsValue = string | number | boolean;
export type AnalyticsParams = Record<string, AnalyticsValue | undefined>;

export interface AnalyticsPort {
  logEvent(name: string, params?: AnalyticsParams): void;
  logScreen(name: string): void;
  setUserId(id: string | null): void;
  setUserProperty(name: string, value: string | null): void;
  /** Firebase app instance id (for the RevenueCat → Firebase integration); null when unavailable. */
  getAppInstanceId(): Promise<string | null>;
}

export interface CrashPort {
  log(message: string): void;
  recordError(error: Error, context: string): void;
  setUserId(id: string): void;
  setAttributes(attributes: Record<string, string>): void;
  /** Dev/TestFlight only — never reachable from a production UI path. */
  testCrash(): void;
}

export interface TraceHandle {
  putAttribute(name: 'feature' | 'provider' | 'result', value: string): void;
  stop(): void;
}

export interface PerfPort {
  startTrace(name: string): TraceHandle;
}

export type RemoteValue = string | number | boolean;

export interface RemoteConfigPort {
  init(defaults: Record<string, RemoteValue>): Promise<void>;
  getString(key: string): string;
  getNumber(key: string): number;
  getBoolean(key: string): boolean;
}

export interface AuthPort {
  /** Silent anonymous sign-in; resolves with a stable uid. */
  ensureSignedIn(): Promise<string>;
  currentUid(): string | null;
  signOutLocal(): Promise<void>;
}

export type UploadKind = 'photo';

export interface StoragePort {
  /** Uploads a local file under `uploads/{uid}/…`; returns the storage path. */
  uploadUserFile(uid: string, localUri: string, kind: UploadKind, contentType: string): Promise<string>;
  /** Short-lived displayable URL for a storage path (or a local URI in mock mode). */
  resolveUrl(storagePath: string): Promise<string>;
}

export interface FunctionsPort {
  call<Req, Res>(name: string, data: Req, timeoutMs: number): Promise<Res>;
}

export type Unsubscribe = () => void;

export interface DataPort {
  watchPreviews(uid: string, onChange: (previews: PreviewDoc[]) => void, onError: (e: Error) => void): Unsubscribe;
  watchWallet(uid: string, onChange: (wallet: WalletDoc) => void, onError: (e: Error) => void): Unsubscribe;
  getGift(uid: string): Promise<GiftDoc | null>;
  saveProfile(uid: string, profile: ProfileFields): Promise<void>;
  registerDevice(uid: string, device: DeviceFields): Promise<void>;
  deletePreviewLocally?(uid: string, previewId: string): Promise<void>;
}

export interface ProfileFields {
  locale: string;
  goal: Goal | null;
  stage: Stage | null;
  onboardingVariant: string;
}

export interface DeviceFields {
  deviceId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  topics: string[];
  /** App UI language (e.g. `tr`, `es-ES`): server pushes use it for their copy. */
  locale: string;
}

export interface PushPort {
  /** FCM registration token (null when unavailable, e.g. mock/web or permission denied). */
  getToken(): Promise<string | null>;
  onTokenRefresh(listener: (token: string) => void): Unsubscribe;
}

export interface Backend {
  mode: BackendMode;
  analytics: AnalyticsPort;
  crash: CrashPort;
  perf: PerfPort;
  remoteConfig: RemoteConfigPort;
  auth: AuthPort;
  storage: StoragePort;
  functions: FunctionsPort;
  data: DataPort;
  push: PushPort;
}

/** Error thrown by every port with a sanitized code (see @shared/api ERROR_CODES). */
export class BackendError extends Error {
  readonly code: import('@shared/api').ErrorCode;

  constructor(code: import('@shared/api').ErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'BackendError';
    this.code = code;
  }
}
