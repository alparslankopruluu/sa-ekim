/**
 * Public error code for a failure inside the paid provider flow. Raw provider text is used ONLY to
 * classify (never stored, logged or shown); anything unnamed stays generic so the app can show its
 * own localized, honest message ("Credits were refunded").
 */
import type { ErrorCode } from '../shared/api.js';
import { AppError } from './errors.js';

export interface UpstreamFailure {
  /** HTTP status from the provider, when the failure came from a response. */
  status?: number;
  /** Raw body or message text. Used ONLY to classify. */
  detail?: string;
}

/** Failures a provider flow can end in. */
export type ProviderFailure = 'content_blocked' | 'timeout' | 'provider_failed';

export class ProviderError extends Error {
  constructor(
    readonly failure: ProviderFailure,
    readonly httpStatus: number | null = null,
  ) {
    super(`provider ${failure}`);
    this.name = 'ProviderError';
  }
}

const CONTENT_PATTERN =
  /content[_ ]policy|content checker|safety[_ ]?check|nsfw|moderation|flagged|unsafe content|sensitive content|blocked by safety|prohibited content/i;
const TIMEOUT_PATTERN = /timed out|timeout/i;

/** Maps an upstream failure onto a public code. Deliberately conservative. */
export function classifyFailure({ status, detail }: UpstreamFailure): ProviderFailure {
  const text = (detail ?? '').slice(0, 8000);
  if (text && CONTENT_PATTERN.test(text)) return 'content_blocked';
  if (status === 408 || status === 504 || (text && TIMEOUT_PATTERN.test(text))) return 'timeout';
  return 'provider_failed';
}

/** Bounded, never-logged text view of an arbitrary provider payload for pattern checks. */
function payloadText(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 8000);
  try {
    return (JSON.stringify(value) ?? '').slice(0, 8000);
  } catch {
    return '';
  }
}

/** A webhook `status: "ERROR"` (or an OK without an image) → public code. */
export function classifyWebhookFailure(payload: unknown, error: unknown): ProviderFailure {
  return classifyFailure({ detail: payloadText({ payload, error }) });
}

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = (error as { status: unknown }).status;
  return typeof status === 'number' ? status : null;
}

/** Public error code for anything thrown while talking to the provider. */
export function failureCodeOf(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  if (error instanceof ProviderError) return error.failure;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return 'timeout';
  return classifyFailure({ status: statusOf(error) ?? undefined, detail: error instanceof Error ? error.message : undefined });
}

/** HTTP status of a provider API error, for logs only. */
export function httpStatusOf(error: unknown): number | undefined {
  if (error instanceof ProviderError) return error.httpStatus ?? undefined;
  return statusOf(error) ?? undefined;
}
