/**
 * Callable Function contracts. The app's live backend and the mock backend both implement
 * exactly these shapes, so switching modes changes no screen code.
 */
import type { Density, Goal, JourneyKind, Quality, RegionHint, StyleId } from './catalog.js';
import type { IsoDate } from './timeline.js';
import type { PrizeId } from './wheel.js';

export const CALLABLES = {
  createPreview: 'createPreview',
  cancelPreview: 'cancelPreview',
  deletePreview: 'deletePreview',
  reportPreview: 'reportPreview',
  spinGiftWheel: 'spinGiftWheel',
  recordConsent: 'recordConsent',
  joinCohort: 'joinCohort',
  getCohort: 'getCohort',
  deleteAccount: 'deleteAccount',
} as const;

/** Typed, sanitized failure reasons. Never carry provider payloads or stack traces. */
export const ERROR_CODES = [
  'unauthenticated',
  'consent_required',
  'invalid_input',
  'content_blocked',
  'insufficient_credits',
  'pro_required',
  'rate_limited',
  'already_claimed',
  'not_found',
  'previews_disabled',
  'provider_failed',
  'timeout',
  'offline',
  'unknown',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** Codes a user can fix by simply trying again. */
export function isRetryable(code: ErrorCode): boolean {
  return code === 'provider_failed' || code === 'timeout' || code === 'offline' || code === 'rate_limited';
}

export interface RecordConsentRequest {
  /** Version of the AI-processing disclosure the user accepted (names the AI providers). */
  version: number;
}

export interface CreatePreviewRequest {
  idempotencyKey: string;
  /** Uploaded selfie under the caller's own prefix (`uploads/{uid}/…`). */
  photoPath: string;
  goal: Goal;
  styleId: StyleId;
  density: Density;
  quality: Quality;
  /** Optional mask hint from the capture guide (normalized polygon). */
  regionHint?: RegionHint;
  /** Spend a won `freeHigh` token instead of credits (high quality only). */
  useFreeHighToken?: boolean;
  /** Marks the onboarding preview: free, standard, watermarked, once per account. */
  onboarding?: boolean;
}
export interface CreatePreviewResponse {
  previewId: string;
  reservedCredits: number;
  balance: number;
}

export interface CancelPreviewRequest {
  previewId: string;
}

/** Deletes the owner's preview document and its image files (terminal previews only). */
export interface DeletePreviewRequest {
  previewId: string;
}

export const REPORT_REASONS = ['inaccurate', 'unsafe', 'privacy', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Files a report into `reports/{autoId}` for human review within 48 hours. */
export interface ReportPreviewRequest {
  previewId: string;
  reason: ReportReason;
}

export interface SpinGiftWheelResponse {
  prizeId: PrizeId;
  segmentIndex: number;
  /** ISO timestamp. */
  expiresAt: string;
  grantedCredits: number;
  balance: number;
}

/**
 * Opt-in "same week" cohort. Only the operation date and goal are sent — never photos,
 * names or the clinic. `getCohort` returns counts only, and the app shows them only when
 * `sameWeek >= COHORT_MIN_VISIBLE` so a small number can never identify anyone.
 */
export interface JoinCohortRequest {
  procedureDate: IsoDate;
  goal: Goal;
  kind: JourneyKind;
}
export interface CohortStats {
  /** Users whose operation day is within the same calendar week as the caller's. */
  sameWeek: number;
  /** Users with the same goal whose operation day is within ±14 days. */
  sameGoal: number;
}
export const COHORT_MIN_VISIBLE = 20;

/** Selfies and result images are deleted this many days after the preview was created. */
export const PREVIEW_RETENTION_DAYS = 30;

export const PREVIEW_STATUSES = ['queued', 'processing', 'finalizing', 'succeeded', 'failed', 'canceled'] as const;
export type PreviewStatus = (typeof PREVIEW_STATUSES)[number];

/** `users/{uid}/previews/{previewId}` — written only by Functions, read by the owner. */
export interface PreviewDoc {
  id: string;
  status: PreviewStatus;
  goal: Goal;
  styleId: StyleId;
  density: Density;
  quality: Quality;
  /** Progress 0..1 when the provider reports it. */
  progress: number;
  reservedCredits: number;
  chargedCredits: number;
  /** Storage path of the user's selfie (kept for at most 30 days, then deleted). */
  photoPath: string;
  /** Storage path of the result image; null until it succeeds. */
  resultPath: string | null;
  /** The free onboarding preview carries a watermark; paid previews do not. */
  watermarked: boolean;
  onboarding: boolean;
  errorCode: ErrorCode | null;
  /** Epoch milliseconds (server time). */
  createdAt: number;
  updatedAt: number;
  /** Epoch ms after which the selfie and the result are deleted (createdAt + PREVIEW_RETENTION_DAYS). */
  expiresAt: number;
}

/** `users/{uid}/private/wallet` — written only by Functions. */
export interface WalletDoc {
  balance: number;
  freeHighTokens: number;
  previewUsed: boolean;
  updatedAt: number;
}

/** `users/{uid}/private/gift` — written only by Functions. */
export interface GiftDoc {
  prizeId: PrizeId;
  segmentIndex: number;
  spunAt: number;
  expiresAt: number;
  redeemedAt: number | null;
}
