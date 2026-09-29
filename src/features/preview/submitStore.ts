/**
 * The preview submission lives OUTSIDE any screen so it survives leaving the rendering
 * screen (upload and create keep running; the server render is independent anyway).
 *
 *   beginAttempt()  — the picker's Create tap: decides the idempotency key
 *   runSubmit()     — uploads the photo, calls createPreview, records the id
 *
 * The idempotency key is fresh per user intent and REUSED when the same request is retried
 * after a create-stage failure, so a create that reached the server but timed out on the
 * client is replayed instead of charged twice.
 */
import { create } from 'zustand';

import { type ErrorCode, isRetryable } from '@shared/api';

import {
  attemptSignature,
  buildCreateRequest,
  type PricingContext,
  quotePreview,
  resolveIdempotencyKey,
  type SubmitPhase,
  validateDraft,
} from '@/lib/previewFlow';
import { errorCodeOf } from '@/lib/errors';
import { track } from '@/services/analytics';
import { createPreview, newIdempotencyKey, uploadPhoto } from '@/services/generation';
import { useAccount } from '@/stores/account';
import { usePreviewDraft } from '@/stores/previewDraft';

interface SubmitState {
  phase: SubmitPhase;
  key: string | null;
  signature: string | null;
  previewId: string | null;
  errorCode: ErrorCode | null;
  failedStage: 'upload' | 'create' | null;
  /** Local epoch ms when the attempt started (drives the progress estimate). */
  startedAt: number | null;
}

const INITIAL: SubmitState = {
  phase: 'idle',
  key: null,
  signature: null,
  previewId: null,
  errorCode: null,
  failedStage: null,
  startedAt: null,
};

export const usePreviewSubmit = create<SubmitState>()(() => INITIAL);

export function pricingContext(): PricingContext {
  const { wallet } = useAccount.getState();
  return {
    onboardingEntry: usePreviewDraft.getState().onboarding,
    previewUsed: wallet.previewUsed,
    balance: wallet.balance,
    freeHighTokens: wallet.freeHighTokens,
  };
}

/** Called right before navigating to the rendering screen. */
export function beginAttempt(): void {
  const draft = usePreviewDraft.getState();
  const quote = quotePreview(draft.quality, draft.useFreeHigh, pricingContext());
  const signature = attemptSignature(draft, quote);
  const previous = usePreviewSubmit.getState();
  const key = resolveIdempotencyKey(
    previous.key
      ? { key: previous.key, signature: previous.signature ?? '', phase: previous.phase, failedStage: previous.failedStage }
      : null,
    signature,
    newIdempotencyKey,
  );
  usePreviewSubmit.setState({
    ...INITIAL,
    key,
    signature,
    startedAt: Date.now(),
  });
}

export function resetSubmit(): void {
  usePreviewSubmit.setState(INITIAL);
}

let running: Promise<void> | null = null;

/** Runs (or resumes) the current attempt. Safe to call twice: only one run is ever active. */
export function runSubmit(): Promise<void> {
  if (running) return running;
  running = submit().finally(() => {
    running = null;
  });
  return running;
}

function fail(code: ErrorCode, stage: 'upload' | 'create'): void {
  track('core_action_failed', { reason: code, retryable: isRetryable(code), stage });
  usePreviewSubmit.setState({ phase: 'error', errorCode: code, failedStage: stage });
}

async function submit(): Promise<void> {
  const current = usePreviewSubmit.getState();
  if (current.phase === 'submitted') return;

  const draft = usePreviewDraft.getState();
  if (!validateDraft(draft).ok || !draft.photo) {
    fail('invalid_input', 'create');
    return;
  }
  const quote = quotePreview(draft.quality, draft.useFreeHigh, pricingContext());
  const key = current.key ?? newIdempotencyKey();
  usePreviewSubmit.setState({ key, errorCode: null, failedStage: null, phase: 'uploading' });

  let stage: 'upload' | 'create' = 'upload';
  try {
    let photoPath = draft.photo.storagePath;
    if (!photoPath) {
      photoPath = await uploadPhoto(draft.photo.localUri);
      usePreviewDraft.getState().setPhotoStoragePath(photoPath);
    }
    stage = 'create';
    usePreviewSubmit.setState({ phase: 'creating' });
    const response = await createPreview(buildCreateRequest(draft, quote, photoPath), key);
    usePreviewSubmit.setState({ phase: 'submitted', previewId: response.previewId });
  } catch (error) {
    fail(errorCodeOf(error), stage);
  }
}
