/**
 * Pure logic of the before-op preview flow (picker → rendering → result → tab). No React,
 * no I/O: the screens under `src/app/preview/**` and `src/features/preview/**` call these so
 * the rules (what it costs, what the CTA says, how an error is handled) are tested once.
 *
 * The server is the only party that charges credits; `quotePreview` mirrors its rules only
 * to show the user the number before they tap.
 */
import { type CreatePreviewRequest, type ErrorCode, isRetryable, type PreviewDoc, type PreviewStatus } from '@shared/api';
import {
  type Angle,
  type Density,
  type Goal,
  getStyle,
  type Quality,
  type RegionHint,
  type StyleDef,
  type StyleId,
  STYLES,
  stylesForGoal,
} from '@shared/catalog';
import { previewCost } from '@shared/pricing';

/** Goal used when the session has none yet (onboarding not finished / deep link). */
const FALLBACK_GOAL: Goal = 'hairline';

/** The bits of `usePreviewDraft` the flow reads (the store state is assignable to it). */
export interface DraftSnapshot {
  goal: Goal | null;
  styleId: StyleId | null;
  density: Density;
  quality: Quality;
  photo: { localUri: string; storagePath: string | null; regionHint?: RegionHint } | null;
  useFreeHigh: boolean;
  onboarding: boolean;
}

// ---------------------------------------------------------------------------------------------
// Defaults and selection
// ---------------------------------------------------------------------------------------------

export function defaultGoal(sessionGoal: Goal | null | undefined): Goal {
  return sessionGoal ?? FALLBACK_GOAL;
}

export function defaultStyleFor(goal: Goal): StyleDef {
  const style = stylesForGoal(goal)[0] ?? STYLES[0];
  if (!style) throw new Error('style catalog is empty');
  return style;
}

/** Densities in the catalog are ordered lowest first; start at the most restrained one. */
export function defaultDensityFor(style: StyleDef): Density {
  return style.densities[0] ?? 'natural';
}

/** Keeps `density` when the style can show it honestly, else the style's default. */
export function coerceDensity(style: StyleDef, density: Density): Density {
  return style.densities.includes(density) ? density : defaultDensityFor(style);
}

export interface Selection {
  goal: Goal;
  styleId: StyleId;
  density: Density;
}

export function initialSelection(goal: Goal): Selection {
  const style = defaultStyleFor(goal);
  return { goal, styleId: style.id, density: defaultDensityFor(style) };
}

/** A region tab was tapped: the previous style belongs to another goal, so start over. */
export function selectionForGoalChange(goal: Goal): Selection {
  return initialSelection(goal);
}

export function selectionForStyle(styleId: StyleId, currentDensity: Density): { styleId: StyleId; density: Density } {
  const style = getStyle(styleId);
  return { styleId, density: style ? coerceDensity(style, currentDensity) : currentDensity };
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

export type DraftIssue = 'goal' | 'style' | 'style_goal_mismatch' | 'density' | 'photo';

export function validateDraft(draft: DraftSnapshot): { ok: boolean; issues: DraftIssue[] } {
  const issues: DraftIssue[] = [];
  if (!draft.goal) issues.push('goal');
  const style = draft.styleId ? getStyle(draft.styleId) : undefined;
  if (!style) {
    issues.push('style');
  } else {
    if (draft.goal && style.goal !== draft.goal) issues.push('style_goal_mismatch');
    if (!style.densities.includes(draft.density)) issues.push('density');
  }
  if (!draft.photo || draft.photo.localUri.trim() === '') issues.push('photo');
  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------------------------
// Price and call to action
// ---------------------------------------------------------------------------------------------

export interface PricingContext {
  /** The picker was opened from onboarding (free, watermarked, once per account). */
  onboardingEntry: boolean;
  /** `WalletDoc.previewUsed`. */
  previewUsed: boolean;
  balance: number;
  freeHighTokens: number;
}

export type PriceKind = 'free' | 'free_token' | 'credits';

export interface PriceQuote {
  kind: PriceKind;
  /** Credits taken from the wallet (0 for a free preview and for a free HD token). */
  credits: number;
  /** Send `onboarding: true` — only when the free preview really applies. */
  sendOnboarding: boolean;
  useFreeHighToken: boolean;
}

export function quotePreview(quality: Quality, useFreeHigh: boolean, ctx: PricingContext): PriceQuote {
  if (quality === 'standard' && ctx.onboardingEntry && !ctx.previewUsed) {
    return { kind: 'free', credits: 0, sendOnboarding: true, useFreeHighToken: false };
  }
  if (quality === 'high' && useFreeHigh && ctx.freeHighTokens > 0) {
    return { kind: 'free_token', credits: 0, sendOnboarding: false, useFreeHighToken: true };
  }
  return { kind: 'credits', credits: previewCost(quality), sendOnboarding: false, useFreeHighToken: false };
}

export type CtaState = 'free' | 'paid' | 'needs_credits' | 'needs_consent' | 'needs_photo' | 'needs_style';

/**
 * Order matters: a photo/style comes first (nothing to send), then consent (nothing may be
 * uploaded without it, even for a free preview), then credits.
 */
export function ctaState(input: {
  issues: readonly DraftIssue[];
  hasConsent: boolean;
  quote: PriceQuote;
  balance: number;
}): CtaState {
  if (input.issues.includes('photo')) return 'needs_photo';
  if (input.issues.length > 0) return 'needs_style';
  if (!input.hasConsent) return 'needs_consent';
  if (input.quote.credits > input.balance) return 'needs_credits';
  return input.quote.credits === 0 ? 'free' : 'paid';
}

export type CreditsAction = { kind: 'credits' } | { kind: 'paywall'; source: 'insufficient_credits' };

/**
 * Not enough credits. A user with no subscription and an empty wallet has not paid for
 * anything yet: the paywall (which has a credits shortcut and shows the monthly allowance) is
 * the honest place to explain the options. Everyone else just needs a top-up.
 */
export function creditsAction(input: { isPro: boolean; balance: number }): CreditsAction {
  if (!input.isPro && input.balance <= 0) return { kind: 'paywall', source: 'insufficient_credits' };
  return { kind: 'credits' };
}

export type UpgradeAction =
  | { kind: 'try_high' }
  | { kind: 'credits' }
  | { kind: 'paywall'; source: 'result_upgrade' };

/**
 * "Create an HD preview (3 credits)" after a watermarked result. HD needs credits (or a free
 * HD token) and no entitlement: pay for it when the wallet covers it, otherwise the credit
 * store, and the paywall (which has a credits shortcut) only for a user with nothing at all.
 */
export function upgradeAction(input: { isPro: boolean; balance: number; freeHighTokens: number }): UpgradeAction {
  if (input.freeHighTokens > 0 || input.balance >= previewCost('high')) return { kind: 'try_high' };
  if (!input.isPro && input.balance <= 0) return { kind: 'paywall', source: 'result_upgrade' };
  return { kind: 'credits' };
}

// ---------------------------------------------------------------------------------------------
// Request and idempotency
// ---------------------------------------------------------------------------------------------

export type CreatePreviewPayload = Omit<CreatePreviewRequest, 'idempotencyKey'>;

export function buildCreateRequest(draft: DraftSnapshot, quote: PriceQuote, photoPath: string): CreatePreviewPayload {
  if (!validateDraft(draft).ok || !draft.goal || !draft.styleId) throw new Error('preview draft is incomplete');
  const request: CreatePreviewPayload = {
    photoPath,
    goal: draft.goal,
    styleId: draft.styleId,
    density: draft.density,
    quality: draft.quality,
  };
  if (draft.photo?.regionHint) request.regionHint = draft.photo.regionHint;
  if (quote.useFreeHighToken) request.useFreeHighToken = true;
  if (quote.sendOnboarding) request.onboarding = true;
  return request;
}

export type SubmitPhase = 'idle' | 'uploading' | 'creating' | 'submitted' | 'error';

export interface PreviousAttempt {
  key: string;
  signature: string;
  phase: SubmitPhase;
  failedStage: 'upload' | 'create' | null;
}

/** Identifies "the same request" (photo + selection + price mode) across attempts. */
export function attemptSignature(draft: DraftSnapshot, quote: PriceQuote): string {
  return [
    draft.photo?.localUri ?? '',
    draft.styleId ?? '',
    draft.density,
    draft.quality,
    quote.kind,
    quote.sendOnboarding ? 'o' : '',
  ].join('|');
}

/**
 * The create call may have reached the server even when the client saw a timeout, so the
 * SAME request retried after a create-stage failure reuses its key (the server replays
 * instead of charging twice). Anything else is a new intent and gets a new key.
 */
export function resolveIdempotencyKey(
  previous: PreviousAttempt | null,
  signature: string,
  newKey: () => string,
): string {
  if (previous && previous.phase === 'error' && previous.failedStage === 'create' && previous.signature === signature) {
    return previous.key;
  }
  return newKey();
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

export type ErrorAction = 'retry' | 'credits' | 'consent' | 'paywall' | 'change_photo' | 'close';

export interface ErrorUx {
  code: ErrorCode;
  /** Trying the same thing again can help (shared `isRetryable`). */
  retryable: boolean;
  /** The primary way out of the error. */
  action: ErrorAction;
}

export function errorUx(code: ErrorCode): ErrorUx {
  const retryable = isRetryable(code);
  if (retryable) return { code, retryable, action: 'retry' };
  switch (code) {
    case 'insufficient_credits':
      return { code, retryable, action: 'credits' };
    case 'consent_required':
      return { code, retryable, action: 'consent' };
    case 'pro_required':
      return { code, retryable, action: 'paywall' };
    case 'content_blocked':
    case 'invalid_input':
      return { code, retryable, action: 'change_photo' };
    default:
      return { code, retryable, action: 'close' };
  }
}

/** Every failed or canceled preview is refunded by the server; the copy names the amount. */
export function refundedCredits(doc: Pick<PreviewDoc, 'status' | 'reservedCredits'>): number {
  return doc.status === 'failed' || doc.status === 'canceled' ? Math.max(0, doc.reservedCredits) : 0;
}

// ---------------------------------------------------------------------------------------------
// Rendering screen
// ---------------------------------------------------------------------------------------------

export type RenderStage =
  | 'uploading'
  | 'creating'
  | 'waiting'
  | 'queued'
  | 'processing'
  | 'finalizing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'submit_error';

export function renderStage(input: {
  phase: SubmitPhase;
  previewId: string | null;
  doc: { status: PreviewStatus } | undefined;
}): RenderStage {
  if (input.doc) return input.doc.status;
  if (input.previewId) return 'waiting';
  switch (input.phase) {
    case 'creating':
      return 'creating';
    case 'error':
      return 'submit_error';
    default:
      return 'uploading';
  }
}

/** "Usually under a minute": the estimate is only a floor for the ring, never a claim. */
export const EXPECTED_RENDER_MS = 60_000;

const STAGE_FLOOR: Record<RenderStage, number> = {
  uploading: 0.04,
  creating: 0.08,
  waiting: 0.1,
  queued: 0.1,
  processing: 0.2,
  finalizing: 0.9,
  succeeded: 1,
  failed: 0,
  canceled: 0,
  submit_error: 0,
};

const PRE_DOCUMENT: readonly RenderStage[] = ['uploading', 'creating', 'waiting'];

export function displayProgress(stage: RenderStage, docProgress: number, elapsedMs: number): number {
  if (stage === 'succeeded') return 1;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  let estimate = Math.min(0.9, elapsed / EXPECTED_RENDER_MS);
  if (PRE_DOCUMENT.includes(stage)) estimate = Math.min(estimate, 0.25);
  const server = Number.isFinite(docProgress) ? docProgress : 0;
  return Math.min(1, Math.max(0, STAGE_FLOOR[stage], estimate, server));
}

// ---------------------------------------------------------------------------------------------
// Previews tab
// ---------------------------------------------------------------------------------------------

export function isInFlightStatus(status: PreviewStatus): boolean {
  return status === 'queued' || status === 'processing' || status === 'finalizing';
}

export type CardKind = 'ready' | 'inflight' | 'failed' | 'canceled';

export function cardKind(status: PreviewStatus): CardKind {
  if (status === 'succeeded') return 'ready';
  if (isInFlightStatus(status)) return 'inflight';
  return status === 'canceled' ? 'canceled' : 'failed';
}

export function sortPreviews<T extends { createdAt: number }>(previews: readonly T[]): T[] {
  return [...previews].sort((a, b) => b.createdAt - a.createdAt);
}

export function inFlightCount(previews: readonly { status: PreviewStatus }[]): number {
  return previews.filter((p) => isInFlightStatus(p.status)).length;
}

/** Newest journey photo taken at exactly `angle`, or null. */
export function latestPhotoForAngle<T extends { angle: Angle; takenAt: number }>(
  photos: readonly T[],
  angle: Angle,
): T | null {
  let best: T | null = null;
  for (const photo of photos) {
    if (photo.angle === angle && (!best || photo.takenAt > best.takenAt)) best = photo;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Retention: selfie and result are deleted when `expiresAt` passes
// ---------------------------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
/** Show the "save it now" nudge this many days before deletion. */
export const EXPIRY_NUDGE_DAYS = 7;

export function isExpired(expiresAt: number | null | undefined, now: number): boolean {
  return typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt <= now;
}

/** Whole days left, rounded up; 0 when expired, null when the expiry is unknown. */
export function daysUntilExpiry(expiresAt: number | null | undefined, now: number): number | null {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
}

export function expiresSoon(expiresAt: number | null | undefined, now: number): boolean {
  const days = daysUntilExpiry(expiresAt, now);
  return days !== null && days > 0 && days <= EXPIRY_NUDGE_DAYS;
}
