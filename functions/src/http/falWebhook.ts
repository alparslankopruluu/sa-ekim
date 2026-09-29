/**
 * fal queue completion webhook. Two independent checks before any state
 * change: the per-render HMAC token in the URL, and fal's ED25519 signature
 * over the raw body. Then:
 *   OK    → claim the render (→ finalizing), store the output URL server-side,
 *           enqueue the `finalizeRender` task (download, watermark, settle, push).
 *           Heavy encoding runs in the task so this endpoint answers fal fast.
 *   ERROR → fail the render and refund the whole reservation.
 * Retries are safe: every transition is status-guarded and the task id is the
 * renderId (Cloud Tasks de-duplicates it).
 */
import { onRequest } from 'firebase-functions/v2/https';

import { FAL_WEBHOOK_TOKEN_SALT, REGION } from '../config.js';
import { functionsAdmin } from '../lib/admin.js';
import { errorName } from '../lib/errors.js';
import { canRefreshJwks, getFalJwks } from '../lib/jwks.js';
import { log } from '../lib/log.js';
import { isAllowedProviderUrl } from '../lib/media.js';
import { UID_PATTERN, UUID_PATTERN } from '../lib/paths.js';
import { classifyWebhookFailure, videoUrlOf } from '../lib/provider.js';
import { verifyRenderToken } from '../lib/render-token.js';
import { claimRenderForFinalize, refundRender } from '../lib/renders.js';
import { type FalVerifyResult, type HeaderBag, verifyFalWebhookSignature } from '../lib/webhook-signature.js';
import type { FinalizeRenderTask } from '../tasks/finalizeRender.js';

const MAX_BODY_BYTES = 1024 * 1024;

async function verifySignature(headers: HeaderBag, rawBody: Buffer): Promise<FalVerifyResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const first = verifyFalWebhookSignature({ headers, rawBody, keys: await getFalJwks(), nowSeconds });
  if (first.ok || first.reason !== 'bad_signature' || !canRefreshJwks()) return first;
  // fal may have rotated keys since we cached them.
  return verifyFalWebhookSignature({ headers, rawBody, keys: await getFalJwks({ forceRefresh: true }), nowSeconds });
}

async function enqueueFinalize(task: FinalizeRenderTask): Promise<void> {
  const queue = functionsAdmin().taskQueue<FinalizeRenderTask>(`locations/${REGION}/functions/finalizeRender`);
  try {
    await queue.enqueue(task, { id: task.renderId, dispatchDeadlineSeconds: 600 });
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
    if (code === 'functions/task-already-exists') return;
    throw error;
  }
}

export const falWebhook = onRequest(
  {
    region: REGION,
    secrets: [FAL_WEBHOOK_TOKEN_SALT],
    invoker: 'public',
    maxInstances: 20,
    concurrency: 40,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST').status(405).end();
      return;
    }
    const uid = typeof req.query.uid === 'string' ? req.query.uid : '';
    const renderId = typeof req.query.renderId === 'string' ? req.query.renderId.toLowerCase() : '';
    if (
      !UID_PATTERN.test(uid) ||
      !UUID_PATTERN.test(renderId) ||
      !verifyRenderToken(FAL_WEBHOOK_TOKEN_SALT.value(), uid, renderId, req.query.t)
    ) {
      res.status(401).end();
      return;
    }
    const rawBody = req.rawBody;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
      res.status(400).end();
      return;
    }

    let verification: FalVerifyResult;
    try {
      verification = await verifySignature(req.headers, rawBody);
    } catch (error) {
      log.error('fal_webhook.jwks_unavailable', { renderId, errorName: errorName(error) });
      res.status(503).end(); // fal retries
      return;
    }
    if (!verification.ok) {
      log.warn('fal_webhook.bad_signature', { uid, renderId, reason: verification.reason });
      res.status(401).end();
      return;
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      res.status(400).end();
      return;
    }
    const requestId = verification.requestId;
    if (typeof body.request_id === 'string' && body.request_id !== requestId) {
      res.status(400).end();
      return;
    }

    try {
      if (body.status === 'OK') {
        const videoUrl = videoUrlOf(body.payload);
        if (!isAllowedProviderUrl(videoUrl)) {
          const outcome = await refundRender(uid, renderId, {
            fromStatuses: ['queued', 'processing'],
            to: 'failed',
            errorCode: 'provider_failed',
            expectedRequestId: requestId,
          });
          log.warn('fal_webhook.missing_output', { uid, renderId, reason: outcome.changed ? 'refunded' : 'unchanged' });
          res.status(200).json({ ok: true });
          return;
        }
        const claim = await claimRenderForFinalize(uid, renderId, requestId, videoUrl);
        if (claim === 'claimed' || claim === 'already_finalizing') {
          await enqueueFinalize({ uid, renderId });
        }
        log.info('fal_webhook.completed', { uid, renderId, status: claim });
      } else if (body.status === 'ERROR') {
        const code = classifyWebhookFailure(body.payload, body.error);
        const outcome = await refundRender(uid, renderId, {
          fromStatuses: ['queued', 'processing'],
          to: 'failed',
          errorCode: code,
          expectedRequestId: requestId,
        });
        log.warn('fal_webhook.failed', { uid, renderId, code, reason: outcome.changed ? 'refunded' : 'unchanged' });
      } else {
        log.warn('fal_webhook.unknown_status', { uid, renderId });
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      log.error('fal_webhook.processing_error', { uid, renderId, errorName: errorName(error) });
      res.status(500).end(); // fal retries; every step above is idempotent
    }
  },
);
