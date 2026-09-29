/**
 * Typed, sanitized failures. Clients only ever see an `HttpsError` whose
 * `details` is `{ code: ErrorCode }` plus a fixed generic message — never a
 * provider payload, stack trace, URL, prompt or user text (security S9).
 */
import { type FunctionsErrorCode, HttpsError } from 'firebase-functions/v2/https';

import { type ErrorCode, isErrorCode } from '../shared/api.js';

/** Internal failure carrying only a public error code. */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}

export function fail(code: ErrorCode): never {
  throw new AppError(code);
}

const HTTPS_CODES: Record<ErrorCode, FunctionsErrorCode> = {
  unauthenticated: 'unauthenticated',
  consent_required: 'failed-precondition',
  invalid_input: 'invalid-argument',
  content_blocked: 'invalid-argument',
  insufficient_credits: 'failed-precondition',
  pro_required: 'permission-denied',
  rate_limited: 'resource-exhausted',
  already_claimed: 'already-exists',
  not_found: 'not-found',
  previews_disabled: 'unavailable',
  provider_failed: 'unavailable',
  timeout: 'deadline-exceeded',
  offline: 'unavailable',
  unknown: 'internal',
};

/** Fixed English messages for logs/debugging; the app localizes by `details.code`. */
const MESSAGES: Record<ErrorCode, string> = {
  unauthenticated: 'Sign-in required.',
  consent_required: 'AI processing consent is required.',
  invalid_input: 'The request is invalid.',
  content_blocked: 'This content is not allowed.',
  insufficient_credits: 'Not enough credits.',
  pro_required: 'Kök Pro is required.',
  rate_limited: 'Too many requests. Try again shortly.',
  already_claimed: 'Already claimed.',
  not_found: 'Not found.',
  previews_disabled: 'Previews are temporarily unavailable.',
  provider_failed: 'Generation failed. Credits were refunded.',
  timeout: 'Generation timed out. Credits were refunded.',
  offline: 'Service unavailable.',
  unknown: 'Something went wrong.',
};

export function httpsErrorFor(code: ErrorCode): HttpsError {
  return new HttpsError(HTTPS_CODES[code], MESSAGES[code], { code });
}

export function httpsCodeFor(code: ErrorCode): FunctionsErrorCode {
  return HTTPS_CODES[code];
}

/** Extracts our public code from anything thrown; unknown errors become `unknown`. */
export function errorCodeOf(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  if (error instanceof HttpsError) {
    const details: unknown = error.details;
    if (details && typeof details === 'object' && 'code' in details) {
      const code = (details as { code: unknown }).code;
      if (isErrorCode(code)) return code;
    }
    return 'unknown';
  }
  return 'unknown';
}

/** Safe description of an unexpected error for logs: its class name only. */
export function errorName(error: unknown): string {
  if (error instanceof Error) return error.name.slice(0, 60);
  return typeof error;
}
