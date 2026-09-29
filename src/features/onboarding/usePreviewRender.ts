/**
 * The free onboarding preview: one standard, watermarked preview of the user's own photo
 * (spec §6). It starts as soon as consent exists so the render hides behind the notification
 * priming, and everything the crafting screen shows is derived from real state: the upload,
 * the accepted request and the `PreviewDoc` status streamed into `useAccount.previews`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { type ErrorCode, isRetryable, type PreviewDoc } from '@shared/api';
import { type Goal, stylesForGoal } from '@shared/catalog';

import { track } from '@/services/analytics';
import { BackendError } from '@/services/backend';
import { recordNonFatal } from '@/services/crash';
import { createPreview, hasConsent, newIdempotencyKey, uploadPhoto } from '@/services/generation';
import { remoteFlag } from '@/services/remoteConfig';
import { useAccount } from '@/stores/account';
import { type PhotoDraft, usePreviewDraft } from '@/stores/previewDraft';

import type { PreviewStage } from './previewProgress';

export type RenderPhase = 'idle' | 'running' | 'ready' | 'failed' | 'skipped';

/** No document and no result after this long counts as a timeout (retry re-uses the same key). */
export const RENDER_WATCHDOG_MS = 120_000;

interface Internal {
  phase: 'idle' | 'starting' | 'watching' | 'failed' | 'skipped';
  /** While `starting`: which request is in flight. */
  sub: 'uploading' | 'submitting';
  previewId: string | null;
  errorCode: ErrorCode | null;
}

const IDLE: Internal = { phase: 'idle', sub: 'uploading', previewId: null, errorCode: null };

/** `unknown` is what an interrupted upload surfaces as; the user can simply try again. */
export function canRetryPreview(code: ErrorCode | null): boolean {
  return code === null || code === 'unknown' || isRetryable(code);
}

interface StartInput {
  photo: PhotoDraft;
  goal: Goal;
}

export function usePreviewRender() {
  const [internal, setInternal] = useState<Internal>(IDLE);
  const input = useRef<StartInput | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const doc: PreviewDoc | undefined = useAccount((s) =>
    internal.previewId ? s.previews.find((p) => p.id === internal.previewId) : undefined,
  );

  const start = useCallback(async (next?: StartInput) => {
    if (next) input.current = next;
    const current = input.current;
    if (!current || running.current) return;
    const style = stylesForGoal(current.goal)[0];
    if (!style || !remoteFlag('ff_onboarding_preview') || useAccount.getState().wallet.previewUsed || !hasConsent()) {
      setInternal({ ...IDLE, phase: 'skipped' });
      return;
    }
    running.current = true;
    const density = style.densities[0] ?? 'natural';
    idempotencyKey.current ??= newIdempotencyKey();
    const draft = usePreviewDraft.getState();
    draft.setStyle(style.id, density);
    draft.setQuality('standard');
    track('preview_start', { entry: 'onboarding', goal: current.goal });
    setInternal({ phase: 'starting', sub: 'uploading', previewId: null, errorCode: null });
    try {
      const photoPath = current.photo.storagePath ?? (await uploadPhoto(current.photo.localUri));
      usePreviewDraft.getState().setPhotoStoragePath(photoPath);
      if (mounted.current) setInternal((s) => ({ ...s, sub: 'submitting' }));
      track('generate_tap', { quality: 'standard', credits: 0, onboarding: true });
      const response = await createPreview(
        {
          photoPath,
          goal: current.goal,
          styleId: style.id,
          density,
          quality: 'standard',
          regionHint: current.photo.regionHint,
          onboarding: true,
        },
        idempotencyKey.current,
      );
      if (mounted.current) setInternal({ phase: 'watching', sub: 'submitting', previewId: response.previewId, errorCode: null });
    } catch (error) {
      const code: ErrorCode = error instanceof BackendError ? error.code : 'unknown';
      if (code === 'already_claimed' || code === 'previews_disabled') {
        if (mounted.current) setInternal({ ...IDLE, phase: 'skipped' });
        return;
      }
      recordNonFatal(error, 'onboarding_preview');
      // The request may have reached the server: the same key makes a retry idempotent.
      if (mounted.current) setInternal({ phase: 'failed', sub: 'submitting', previewId: null, errorCode: code });
    } finally {
      running.current = false;
    }
  }, []);

  // Derive what the screens may say from the real document.
  let phase: RenderPhase = 'idle';
  let stage: PreviewStage = internal.sub;
  let errorCode: ErrorCode | null = internal.errorCode;
  if (internal.phase === 'skipped') phase = 'skipped';
  else if (internal.phase === 'failed') phase = 'failed';
  else if (internal.phase === 'starting') phase = 'running';
  else if (internal.phase === 'watching') {
    phase = 'running';
    stage = 'queued';
    if (doc) {
      if (doc.status === 'processing') stage = 'processing';
      else if (doc.status === 'finalizing') stage = 'finalizing';
      else if (doc.status === 'succeeded') {
        stage = 'ready';
        phase = 'ready';
      } else if (doc.status === 'failed' || doc.status === 'canceled') {
        phase = 'failed';
        errorCode = doc.errorCode ?? 'provider_failed';
      }
    }
  }

  // Watchdog: a document that never arrives must not leave the user waiting forever.
  const watching = internal.phase === 'watching' && phase === 'running';
  useEffect(() => {
    if (!watching) return;
    const id = setTimeout(() => {
      if (mounted.current) setInternal((s) => (s.phase === 'watching' ? { ...s, phase: 'failed', errorCode: 'timeout' } : s));
    }, RENDER_WATCHDOG_MS);
    return () => clearTimeout(id);
  }, [watching]);

  const failedOnce = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'failed') return;
    const marker = `${internal.previewId ?? 'none'}:${errorCode ?? 'x'}`;
    if (failedOnce.current === marker) return;
    failedOnce.current = marker;
    const code = errorCode ?? 'unknown';
    track('core_action_failed', { reason: code, retryable: canRetryPreview(code), stage: 'onboarding_preview' });
  }, [phase, errorCode, internal.previewId]);

  const readyOnce = useRef(false);
  useEffect(() => {
    if (phase !== 'ready' || readyOnce.current || !doc) return;
    readyOnce.current = true;
    track('core_action_preview', { quality: doc.quality, style: doc.styleId, goal: doc.goal, onboarding: true });
  }, [phase, doc]);

  const retry = useCallback(() => {
    // A finished-but-failed preview is a new attempt (new key); an unknown outcome re-uses the key.
    const failedDoc = internal.previewId ? useAccount.getState().previews.find((p) => p.id === internal.previewId) : undefined;
    if (failedDoc && (failedDoc.status === 'failed' || failedDoc.status === 'canceled')) idempotencyKey.current = null;
    setInternal(IDLE);
    void start();
  }, [internal.previewId, start]);

  return {
    phase,
    stage,
    progress: doc?.progress ?? 0,
    errorCode,
    previewId: internal.previewId,
    preview: doc,
    start,
    retry,
  };
}
