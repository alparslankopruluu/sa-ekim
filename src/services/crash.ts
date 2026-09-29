/**
 * Crashlytics façade. Only sanitized operation names and codes are recorded —
 * never prompts, typed text, names, media URLs, tokens or provider payloads
 * (docs/playbooks/analytics.md, security checklist S9).
 */
import Constants from 'expo-constants';

import { getBackend } from './backend';
import { BackendError } from './backend/types';

export function breadcrumb(operation: string): void {
  getBackend().crash.log(operation);
}

/** Records a non-fatal with a sanitized error name (BackendError code or JS error class). */
export function recordNonFatal(error: unknown, operation: string): void {
  const name =
    error instanceof BackendError ? `BackendError:${error.code}` : error instanceof Error ? error.name : 'UnknownError';
  const sanitized = new Error(operation);
  sanitized.name = name;
  getBackend().crash.recordError(sanitized, operation);
}

export function identifyCrashUser(uid: string): void {
  const backend = getBackend();
  backend.crash.setUserId(uid);
  backend.crash.setAttributes({
    app_version: Constants.expoConfig?.version ?? 'unknown',
    backend_mode: backend.mode,
  });
}

/** Developer screen only (dev builds / TestFlight), per docs/playbooks/analytics.md. */
export function triggerTestCrash(): void {
  getBackend().crash.testCrash();
}
