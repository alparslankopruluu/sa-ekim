/**
 * User-facing messages for every `ErrorCode` in @shared/api. Backend and purchase code throw
 * `BackendError` (sanitized code only); screens show `useErrorMessage()` text and never
 * `error.message`.
 *
 *   const message = useErrorMessage();        // (error: unknown) => string
 *   showToast(message(error), 'error');
 *
 *   const text = useErrorMessage('offline');  // string, for a known code
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { type ErrorCode, isErrorCode, isRetryable } from '@shared/api';

/** Extracts a sanitized ErrorCode from a BackendError, a plain code, or anything thrown. */
export function errorCodeOf(error: unknown): ErrorCode {
  if (isErrorCode(error)) return error;
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (isErrorCode(code)) return code;
  }
  return 'unknown';
}

export function errorMessageKey(error: unknown): `errors.${ErrorCode}` {
  return `errors.${errorCodeOf(error)}`;
}

/** `true` when trying again can help (offline, timeout, provider hiccup, rate limit). */
export function isRetryableError(error: unknown): boolean {
  if (error === undefined || error === null) return false;
  return isRetryable(errorCodeOf(error));
}

export function useErrorMessage(): (error: unknown) => string;
export function useErrorMessage(error: unknown): string;
export function useErrorMessage(...args: [] | [unknown]): string | ((error: unknown) => string) {
  const { t } = useTranslation();
  const format = useCallback((error: unknown) => t(errorMessageKey(error)), [t]);
  return args.length === 0 ? format : format(args[0]);
}
