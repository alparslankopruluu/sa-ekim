/**
 * fal queue completion webhook. Two independent checks before any state
 * change: the per-preview HMAC token in the URL, and fal's ED25519 signature
 * over the raw body. Then:
 *   OK    → claim the preview (→ finalizing), store the output URL server-side,
 *           enqueue the `finalizePreview` task (download, quality gate, composite,
 *           watermark, settle, push). Image work runs in the task so this endpoint
 *           answers fal fast.
 *   ERROR → fail the preview and refund the whole reservation.
 * Retries are safe: every transition is status-guarded and the task id is
 * `{previewId}-{attempt}` (Cloud Tasks de-duplicates it; the quality-gate retry is attempt 2).
 */
import { onRequest } from 'firebase-functions/v2/https';

import { FAL_WEBHOOK_TOKEN_SALT, REGION } from '../config.js';
import { functionsAdmin } from '../lib/admin.js';
import { errorName } from '../lib/errors.js';
import { canRefreshJwks, getFalJwks } from '../lib/jwks.js';
import { log } from '../lib/log.js';
import { isAllowedProviderUrl } from '../lib/media.js';
import { UID_PATTERN, UUID_PATTERN } from '../lib/paths.js';
import { classifyWebhookFailure } from '../lib/failures.js';
import { verifyPreviewToken } from '../lib/preview-token.js';
import { firstImageUrl } from '../lib/provider.js';
import { claimPreviewForFinalize, refundPreview } from '../lib/previews.js';
import { type FalVerifyResult, type HeaderBag, verifyFalWebhookSignature } from '../lib/webhook-signature.js';
import { finalizeTaskId, type FinalizePreviewTask } from '../lib/tasks.js';

const MAX_BODY_BYTES = 1024 * 1024;

async function verifySignature(headers: HeaderBag, rawBody: Buffer): Promise<FalVerifyResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const first = verifyFalWebhookSignature({ headers, rawBody, keys: await getFalJwks(), nowSeconds });
  if (first.ok || first.reason !== 'bad_signature' || !canRefreshJwks()) return first;
  // fal may have rotated keys since we cached them.
  return verifyFalWebhookSignature({ headers, rawBody, keys: await getFalJwks({ forceRefresh: true }), nowSeconds });
}

async function enqueueFinalize(task: FinalizePreviewTask, attempt: number): Promise<void> {
  const queue = functionsAdmin().taskQueue<FinalizePreviewTask>(`locations/${REGION}/functions/finalizePreview`);
  try {
    await queue.enqueue(task, { id: finalizeTaskId(task.previewId, attempt), dispatchDeadlineSeconds: 600 });
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
    const previewId = typeof req.query.previewId === 'string' ? req.query.previewId.toLowerCase() : '';
    if (
      !UID_PATTERN.test(uid) ||
      !UUID_PATTERN.test(previewId) ||
      !verifyPreviewToken(FAL_WEBHOOK_TOKEN_SALT.value(), uid, previewId, req.query.t)
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
      log.error('fal_webhook.jwks_unavailable', { previewId, errorName: errorName(error) });
      res.status(503).end(); // fal retries
      return;
    }
    if (!verification.ok) {
      log.warn('fal_webhook.bad_signature', { uid, previewId, reason: verification.reason });
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
        const imageUrl = firstImageUrl(body.payload);
        if (!isAllowedProviderUrl(imageUrl)) {
          // A completed job without a usable image (e.g. a content-checker rejection): refund in full.
          const code = classifyWebhookFailure(body.payload, body.error);
          const outcome = await refundPreview(uid, previewId, {
            fromStatuses: ['queued', 'processing'],
            to: 'failed',
            errorCode: code,
            expectedRequestId: requestId,
          });
          log.warn('fal_webhook.missing_output', { uid, previewId, code, reason: outcome.changed ? 'refunded' : 'unchanged' });
          res.status(200).json({ ok: true });
          return;
        }
        const claim = await claimPreviewForFinalize(uid, previewId, requestId, imageUrl);
        if (claim.outcome === 'claimed' || claim.outcome === 'already_finalizing') {
          await enqueueFinalize({ uid, previewId }, claim.attempt);
        }
        log.info('fal_webhook.completed', { uid, previewId, status: claim.outcome });
      } else if (body.status === 'ERROR') {
        const code = classifyWebhookFailure(body.payload, body.error);
        const outcome = await refundPreview(uid, previewId, {
          fromStatuses: ['queued', 'processing'],
          to: 'failed',
          errorCode: code,
          expectedRequestId: requestId,
        });
        log.warn('fal_webhook.failed', { uid, previewId, code, reason: outcome.changed ? 'refunded' : 'unchanged' });
      } else {
        log.warn('fal_webhook.unknown_status', { uid, previewId });
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      log.error('fal_webhook.processing_error', { uid, previewId, errorName: errorName(error) });
      res.status(500).end(); // fal retries; every step above is idempotent
    }
  },
);
