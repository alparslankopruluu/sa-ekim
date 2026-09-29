/**
 * The core action: a selfie + a style → an AI hair preview.
 *
 * 1. Validate (shared validators + stored-object check) — nothing charged yet.
 * 2. One transaction: idempotent replay, consent, kill switch, rate limits, then reserve the price
 *    (or take the one free onboarding preview / a free-high token) and create the PreviewDoc
 *    (queued), the server-only record and the idempotency record.
 * 3. Prepare the padded canvas + mask, upload to fal and queue the edit with a per-preview HMAC
 *    webhook URL.
 * 4. Any failure before fal accepted the job refunds the whole reservation.
 */
import { randomUUID } from 'node:crypto';

import { onCall } from 'firebase-functions/v2/https';

import { FAL_KEY, FAL_WEBHOOK_TOKEN_SALT, MAX_IMAGE_BYTES, REGION } from '../config.js';
import type { CreatePreviewResponse } from '../shared/api.js';
import { AppError, errorName, fail } from '../lib/errors.js';
import { handleCallable } from '../lib/callable.js';
import { failureCodeOf, httpStatusOf } from '../lib/failures.js';
import { prepareEditInputs } from '../lib/image-pipeline.js';
import { log } from '../lib/log.js';
import { downloadObjectBuffer } from '../lib/media.js';
import { assertUsableImage } from '../lib/objects.js';
import { submitEditJob } from '../lib/pipeline.js';
import { markPreviewSubmitted, beginPreview, refundPreview } from '../lib/previews.js';
import { PROMPT_VERSION } from '../lib/prompts.js';
import { imageProvider } from '../lib/provider.js';
import { currentRuntimeConfig } from '../lib/runtime.js';
import { parseCreatePreview } from '../lib/validate.js';
import { markRequestFailed } from '../lib/wallet.js';

export const createPreview = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    secrets: [FAL_KEY, FAL_WEBHOOK_TOKEN_SALT],
    maxInstances: 20,
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  handleCallable('createPreview', async (request, uid): Promise<CreatePreviewResponse> => {
    const plan = parseCreatePreview(request.data, uid);
    await assertUsableImage(plan.photoPath);
    const runtime = await currentRuntimeConfig();

    const previewId = randomUUID();
    const started = await beginPreview({
      uid,
      plan,
      previewId,
      generationEnabled: runtime.generationEnabled,
      promptVersion: PROMPT_VERSION,
      modelId: runtime.imageModel.modelId,
    });
    if (started.kind === 'replay') return started.response;

    const provider = imageProvider(FAL_KEY.value());
    let submitted: { requestId: string; cancelUrl: string | null } | null = null;
    try {
      let inputs;
      try {
        const selfie = await downloadObjectBuffer(plan.photoPath, MAX_IMAGE_BYTES);
        inputs = await prepareEditInputs(selfie, plan.regionHint);
      } catch {
        throw new AppError('invalid_input'); // unreadable or undecodable photo
      }
      const preview = { goal: plan.goal, styleId: plan.styleId, density: plan.density };
      submitted = await submitEditJob({
        provider,
        model: runtime.imageModel,
        uid,
        previewId,
        tokenSalt: FAL_WEBHOOK_TOKEN_SALT.value(),
        inputs,
        ...preview,
        quality: started.quality,
      });
      const outcome = await markPreviewSubmitted(uid, previewId, plan.idempotencyKey, submitted);
      if (outcome === 'canceled' && submitted.cancelUrl) await provider.cancel(submitted.cancelUrl);
      log.info('preview.submitted', { uid, previewId, kind: plan.onboarding ? 'onboarding' : plan.quality, credits: started.response.reservedCredits });
      return started.response;
    } catch (error) {
      const code = failureCodeOf(error);
      log.warn('preview.submit_failed', { uid, previewId, code, errorName: errorName(error), httpStatus: httpStatusOf(error) });
      if (submitted?.cancelUrl) await provider.cancel(submitted.cancelUrl);
      await refundPreview(uid, previewId, { fromStatuses: ['queued', 'processing'], to: 'failed', errorCode: code });
      await markRequestFailed(uid, plan.idempotencyKey, code);
      return fail(code);
    }
  }),
);
