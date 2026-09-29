/**
 * Deployment-wide constants and secret handles. Secrets are Secret Manager
 * values bound per function (`secrets: [...]`) and read only at call time —
 * never at module load, never logged, never written to Firestore.
 */
import { defineSecret } from 'firebase-functions/params';

export const REGION = 'us-central1';

/** fal.ai API key (server-only; see docs/playbooks/ai-media.md). */
export const FAL_KEY = defineSecret('FAL_KEY');
/** RevenueCat webhook "Authorization header value" (sent verbatim; an optional "Bearer " is accepted). */
export const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');
/** HMAC salt for the per-render token embedded in each fal webhook URL. */
export const FAL_WEBHOOK_TOKEN_SALT = defineSecret('FAL_WEBHOOK_TOKEN_SALT');

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Source media (face photos, voices) is kept only as long as a creation needs it. */
export const SOURCE_MEDIA_TTL_MS = DAY_MS;
/** A render that is still not terminal after this long is failed and refunded. */
export const STUCK_RENDER_MS = 30 * MINUTE_MS;
/** A render the finalize task claimed gets extra time (task retries + encode). */
export const STUCK_FINALIZING_MS = 45 * MINUTE_MS;
/** A paid step whose function crashed mid-flight is refunded after this long. */
export const STALE_REQUEST_MS = 15 * MINUTE_MS;
/** Idempotency records expire via a Firestore TTL policy on `expireAt`. */
export const REQUEST_RECORD_TTL_MS = 7 * DAY_MS;

/** Signed URL lifetimes. */
export const CLIENT_URL_TTL_MS = HOUR_MS;
export const PROVIDER_SYNC_URL_TTL_MS = 15 * MINUTE_MS;
/** Queued lip-sync jobs may wait before fal fetches their inputs. */
export const PROVIDER_QUEUE_URL_TTL_MS = 3 * HOUR_MS;

/** Upload limits (mirrors storage.rules). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/** Provider output download caps. */
export const MAX_PROVIDER_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_PROVIDER_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_PROVIDER_VIDEO_BYTES = 300 * 1024 * 1024;

/** finalizeRender task queue retry budget (also used to detect the last attempt). */
export const FINALIZE_MAX_ATTEMPTS = 3;
