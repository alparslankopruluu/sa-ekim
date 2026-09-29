/**
 * Cloud Tasks worker enqueued by `falWebhook` (task id = renderId): download
 * the provider video, burn the watermark / AI label + AI metadata, upload to
 * `renders/{uid}/{renderId}.mp4`, settle credits on the measured length,
 * mark succeeded, and push. Transient failures retry; the last attempt (or a
 * permanent media error) fails the render and refunds the reservation.
 */
import { join } from 'node:path';

import { onTaskDispatched } from 'firebase-functions/v2/tasks';

import { FINALIZE_MAX_ATTEMPTS, MAX_PROVIDER_VIDEO_BYTES, REGION } from '../config.js';
import { errorName } from '../lib/errors.js';
import { finalizeVideo } from '../lib/finalize.js';
import { log } from '../lib/log.js';
import { downloadProviderMediaToFile, isAllowedProviderUrl, MediaError, uploadFile, withTempDir } from '../lib/media.js';
import { notifyRenderReady } from '../lib/notify.js';
import { storagePaths, UID_PATTERN, UUID_PATTERN } from '../lib/paths.js';
import { loadRender, refundRender, settleRenderSuccess } from '../lib/renders.js';
import { decideFinish } from '../lib/watermark.js';

export interface FinalizeRenderTask {
  uid: string;
  renderId: string;
}

const VIDEO_TYPES = /^(video\/(mp4|quicktime)|application\/octet-stream|binary\/octet-stream)$/;

function parseTask(data: unknown): FinalizeRenderTask | null {
  if (!data || typeof data !== 'object') return null;
  const { uid, renderId } = data as Record<string, unknown>;
  if (typeof uid !== 'string' || !UID_PATTERN.test(uid)) return null;
  if (typeof renderId !== 'string' || !UUID_PATTERN.test(renderId)) return null;
  return { uid, renderId };
}

/** Errors a retry cannot fix (bad/oversized/blocked output). */
function isPermanent(error: unknown): boolean {
  return error instanceof MediaError && error.reason !== 'http';
}

export const finalizeRender = onTaskDispatched<FinalizeRenderTask>(
  {
    region: REGION,
    retryConfig: { maxAttempts: FINALIZE_MAX_ATTEMPTS, minBackoffSeconds: 30, maxBackoffSeconds: 300 },
    rateLimits: { maxConcurrentDispatches: 10 },
    memory: '4GiB',
    cpu: 2,
    concurrency: 1,
    maxInstances: 10,
    timeoutSeconds: 540,
  },
  async (request) => {
    const task = parseTask(request.data);
    if (!task) {
      log.error('finalize.bad_task');
      return;
    }
    const { uid, renderId } = task;
    const state = await loadRender(uid, renderId);
    if (!state || state.render.status !== 'finalizing') return; // already settled, failed, canceled or deleted

    const videoUrl = state.priv.outputVideoUrl;
    if (!isAllowedProviderUrl(videoUrl)) {
      await refundRender(uid, renderId, { fromStatuses: ['finalizing'], to: 'failed', errorCode: 'provider_failed' });
      log.warn('finalize.no_output', { uid, renderId });
      return;
    }

    try {
      const decision = decideFinish({ purpose: state.render.purpose, reservedCredits: state.priv.charge.credits });
      const videoPath = storagePaths.render(uid, renderId);
      const started = Date.now();
      const probe = await withTempDir(async (dir) => {
        const input = join(dir, 'provider.mp4');
        const output = join(dir, 'final.mp4');
        await downloadProviderMediaToFile(videoUrl, input, {
          maxBytes: MAX_PROVIDER_VIDEO_BYTES,
          timeoutMs: 120_000,
          typePattern: VIDEO_TYPES,
        });
        const result = await finalizeVideo({
          inputFile: input,
          outputFile: output,
          overlayFile: join(dir, 'label.rgba'),
          overlay: decision.overlay,
        });
        await uploadFile(output, videoPath, 'video/mp4');
        return result;
      });
      const settled = await settleRenderSuccess(uid, renderId, { videoPath, actualSeconds: probe.durationSeconds });
      if (!settled.settled) return;
      log.info('render.succeeded', {
        uid,
        renderId,
        seconds: settled.seconds,
        credits: settled.chargedCredits,
        durationMs: Date.now() - started,
      });
      await notifyRenderReady(uid, renderId);
    } catch (error) {
      const attempt = request.retryCount + 1;
      log.warn('finalize.failed', { uid, renderId, attempt, errorName: errorName(error) });
      if (attempt >= FINALIZE_MAX_ATTEMPTS || isPermanent(error)) {
        await refundRender(uid, renderId, { fromStatuses: ['finalizing'], to: 'failed', errorCode: 'provider_failed' });
        return;
      }
      throw error; // Cloud Tasks retries with backoff
    }
  },
);
