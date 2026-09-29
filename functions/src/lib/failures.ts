/** Public error code for a failure inside a paid provider flow. */
import type { ErrorCode } from '../shared/api.js';
import { AppError } from './errors.js';
import { classifyProviderError } from './provider.js';

export function failureCodeOf(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  return classifyProviderError(error);
}

/** HTTP status of a provider API error, for logs only. */
export function httpStatusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
  const status = (error as { status: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}
