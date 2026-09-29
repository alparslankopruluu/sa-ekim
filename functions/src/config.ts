/**
 * Deployment-wide constants and secret handles. Secrets are Secret Manager
 * values bound per function (`secrets: [...]`) and read only at call time —
 * never at module load, never logged, never written to Firestore.
 */
import { defineSecret } from 'firebase-functions/params';

import { PREVIEW_RETENTION_DAYS } from './shared/api.js';

export const REGION = 'us-central1';

/** fal.ai API key (server-only). Sent only to queue.fal.run / rest.alpha.fal.ai. */
export const FAL_KEY = defineSecret('FAL_KEY');
/** RevenueCat webhook "Authorization header value" (sent verbatim; an optional "Bearer " is accepted). */
export const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');
/** HMAC salt for the per-preview token embedded in each fal webhook URL. */
export const FAL_WEBHOOK_TOKEN_SALT = defineSecret('FAL_WEBHOOK_TOKEN_SALT');

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Selfies and results are kept at most this long (privacy promise: PREVIEW_RETENTION_DAYS); the hourly sweep deletes older ones. */
export const PREVIEW_RETENTION_MS = PREVIEW_RETENTION_DAYS * DAY_MS;
export const SELFIE_TTL_MS = PREVIEW_RETENTION_MS;
/** A preview that is still not terminal after this long is failed and refunded. */
export const STUCK_PREVIEW_MS = 30 * MINUTE_MS;
/** A preview the finalize task claimed gets extra time (task retries + image work). */
export const STUCK_FINALIZING_MS = 45 * MINUTE_MS;
/** A reservation whose createPreview call died before submitting to fal is refunded after this long. */
export const STALE_REQUEST_MS = 15 * MINUTE_MS;
/** Idempotency records expire via a Firestore TTL policy on `expireAt`. */
export const REQUEST_RECORD_TTL_MS = 7 * DAY_MS;

/** Upload limits (mirrors storage.rules). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Provider output download cap. */
export const MAX_PROVIDER_IMAGE_BYTES = 25 * 1024 * 1024;

/** finalizePreview task queue retry budget (also used to detect the last attempt). */
export const FINALIZE_MAX_ATTEMPTS = 3;

/** Default fal image-edit queue endpoint; `config/runtime.imageModelQueueURL` overrides it. */
export const DEFAULT_IMAGE_QUEUE_URL = 'https://queue.fal.run/openai/gpt-image-2/edit';

/** Quality-gate: changed-pixel fraction (inside the edit mask) under which the job is retried once. */
export const QUALITY_GATE_MIN_CHANGED_FRACTION = 0.02;

/** Annual plans get this top-up every week while the year is active. */
export const WEEK_MS = 7 * DAY_MS;
