/**
 * Cloud Tasks worker enqueued by `falWebhook`: download the provider image, run the quality gate
 * (measure the changed pixels inside the edit mask; ONE retry at the same charge if under 2%, never a
 * refund by itself), composite the original pixels back outside the mask (feathered) when a region
 * hint exists, watermark the free onboarding preview only, store `users/{uid}/previews/{id}.jpg`,
 * settle, mark succeeded and push. Transient failures retry; the last attempt (or a permanent image
 * error) fails the preview and refunds the whole reservation. Raw provider payloads are never stored.
 */
import { onTaskDispatched } from 'firebase-functions/v2/tasks';

import {
  FAL_KEY,
  FAL_WEBHOOK_TOKEN_SALT,
  FINALIZE_MAX_ATTEMPTS,
  MAX_IMAGE_BYTES,
  MAX_PROVIDER_IMAGE_BYTES,
  REGION,
} from '../config.js';
import { AppError, errorName } from '../lib/errors.js';
import { failureCodeOf } from '../lib/failures.js';
import { finishEdit, prepareEditInputs } from '../lib/image-pipeline.js';
import { log } from '../lib/log.js';
import { deleteObject, downloadObjectBuffer, fetchProviderMedia, isAllowedProviderUrl, MediaError, saveBuffer } from '../lib/media.js';
import { notifyPreviewReady } from '../lib/notify.js';
import { storagePaths } from '../lib/paths.js';
import { submitEditJob } from '../lib/pipeline.js';
import { loadPreview, markRetrySubmitted, refundPreview, settlePreviewSuccess } from '../lib/previews.js';
import { imageProvider } from '../lib/provider.js';
import { currentRuntimeConfig } from '../lib/runtime.js';
import { parseFinalizeTask } from '../lib/tasks.js';

const IMAGE_TYPES = /^image\/(png|jpeg|webp)$/;

/** Errors a retry cannot fix (bad/oversized output, unalignable image, missing selfie). */
export function isPermanentFinalizeError(error: unknown): boolean {
  if (error instanceof AppError) return true;
  if (error instanceof MediaError) return error.reason !== 'http';
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 404;
}

export const finalizePreview = onTaskDispatched<{ uid: string; previewId: string }>(
  {
    region: REGION,
    retryConfig: { maxAttempts: FINALIZE_MAX_ATTEMPTS, minBackoffSeconds: 30, maxBackoffSeconds: 300 },
    rateLimits: { maxConcurrentDispatches: 10 },
    secrets: [FAL_KEY, FAL_WEBHOOK_TOKEN_SALT],
    memory: '2GiB',
    cpu: 1,
    concurrency: 1,
    maxInstances: 10,
    timeoutSeconds: 300,
  },
  async (request) => {
    const task = parseFinalizeTask(request.data);
    if (!task) {
      log.error('finalize.bad_task');
      return;
    }
    const { uid, previewId } = task;
    const state = await loadPreview(uid, previewId);
    if (!state || state.preview.status !== 'finalizing') return; // already settled, failed, canceled or deleted

    const outputUrl = state.priv.outputUrl;
    if (!isAllowedProviderUrl(outputUrl)) {
      await refundPreview(uid, previewId, { fromStatuses: ['finalizing'], to: 'failed', errorCode: 'provider_failed' });
      log.warn('finalize.no_output', { uid, previewId });
      return;
    }

    try {
      const started = Date.now();
      const [provided, selfie] = await Promise.all([
        fetchProviderMedia(outputUrl, { maxBytes: MAX_PROVIDER_IMAGE_BYTES, timeoutMs: 60_000, typePattern: IMAGE_TYPES }),
        downloadObjectBuffer(state.preview.photoPath, MAX_IMAGE_BYTES),
      ]);
      const inputs = await prepareEditInputs(selfie, state.priv.regionHint);
      const watermark = state.preview.watermarked;
      let outcome = await finishEdit({ inputs, providerBytes: provided.buffer, alreadyRetried: state.priv.retried, watermark });

      if (outcome.action === 'retry') {
        // Under 2% of the editable area changed: one retry at the same charge. If the retry cannot be
        // submitted, keep the first result — the gate is a measurement, never a reason to refund.
        const retried = await submitRetry({ task, state, inputs, fraction: outcome.stats.changedFraction });
        if (retried) return;
        outcome = await finishEdit({ inputs, providerBytes: provided.buffer, alreadyRetried: true, watermark });
      }
      if (outcome.action !== 'done') return;

      const resultPath = storagePaths.previewResult(uid, previewId);
      await saveBuffer(resultPath, outcome.jpeg, 'image/jpeg');
      const changedFraction = outcome.stats ? outcome.stats.changedFraction : null;
      const settled = await settlePreviewSuccess(uid, previewId, { resultPath, changedFraction });
      if (!settled.settled) {
        // The preview vanished or changed (account deleted, refunded): leave no orphan image behind.
        await deleteObject(resultPath).catch(() => undefined);
        return;
      }
      log.info('preview.succeeded', { uid, previewId, credits: settled.chargedCredits, durationMs: Date.now() - started });
      await notifyPreviewReady(uid, previewId);
    } catch (error) {
      const attempt = request.retryCount + 1;
      log.warn('finalize.failed', { uid, previewId, attempt, errorName: errorName(error) });
      if (attempt >= FINALIZE_MAX_ATTEMPTS || isPermanentFinalizeError(error)) {
        await refundPreview(uid, previewId, { fromStatuses: ['finalizing'], to: 'failed', errorCode: 'provider_failed' });
        return;
      }
      throw error; // Cloud Tasks retries with backoff
    }
  },
);

async function submitRetry(input: {
  task: { uid: string; previewId: string };
  state: NonNullable<Awaited<ReturnType<typeof loadPreview>>>;
  inputs: Awaited<ReturnType<typeof prepareEditInputs>>;
  fraction: number;
}): Promise<boolean> {
  const { uid, previewId } = input.task;
  const { preview } = input.state;
  const provider = imageProvider(FAL_KEY.value());
  try {
    const runtime = await currentRuntimeConfig();
    const job = await submitEditJob({
      provider,
      model: runtime.imageModel,
      uid,
      previewId,
      tokenSalt: FAL_WEBHOOK_TOKEN_SALT.value(),
      inputs: input.inputs,
      goal: preview.goal,
      styleId: preview.styleId,
      density: preview.density,
      quality: preview.quality,
    });
    const moved = await markRetrySubmitted(uid, previewId, job, input.fraction);
    if (!moved && job.cancelUrl) await provider.cancel(job.cancelUrl);
    log.info('preview.retry_submitted', { uid, previewId, reason: 'low_visible_change' });
    return moved;
  } catch (error) {
    log.warn('preview.retry_failed', { uid, previewId, code: failureCodeOf(error), errorName: errorName(error) });
    return false;
  }
}
