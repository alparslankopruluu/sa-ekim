import { type ErrorCode, isErrorCode } from '@shared/api';

import { BackendError } from './types';

/** Maps anything thrown by a provider SDK to a sanitized BackendError. */
export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; details?: unknown; message?: unknown };
    const details = candidate.details as { code?: unknown } | undefined;
    if (details && isErrorCode(details.code)) return new BackendError(details.code);
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    const mapped = mapFirebaseCode(code);
    if (mapped) return new BackendError(mapped);
  }
  return new BackendError('unknown');
}

function mapFirebaseCode(code: string): ErrorCode | null {
  const normalized = code.replace(/^functions\//, '').replace(/^storage\//, '').replace(/^firestore\//, '');
  switch (normalized) {
    case 'unauthenticated':
      return 'unauthenticated';
    case 'unavailable':
    case 'network-request-failed':
    case 'retry-limit-exceeded':
      return 'offline';
    case 'deadline-exceeded':
      return 'timeout';
    case 'resource-exhausted':
      return 'rate_limited';
    case 'not-found':
    case 'object-not-found':
      return 'not_found';
    case 'invalid-argument':
      return 'invalid_input';
    case 'failed-precondition':
      return 'consent_required';
    case 'permission-denied':
    case 'unauthorized':
      return 'unauthenticated';
    default:
      return null;
  }
}

/**
 * Races a promise against a timeout so no screen can spin forever
 * (docs/checklists/engineering-quality.md — the 2.1(b) rejection lesson).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BackendError('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
