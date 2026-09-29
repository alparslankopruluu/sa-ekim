/** Restyles the user's photo into a stage poster (GPT Image edit), charged in credits or a won token. */
import { randomUUID } from 'node:crypto';

import { onCall } from 'firebase-functions/v2/https';

import {
  CLIENT_URL_TTL_MS,
  FAL_KEY,
  MAX_PROVIDER_IMAGE_BYTES,
  PROVIDER_SYNC_URL_TTL_MS,
  REGION,
} from '../config.js';
import { handleCallable } from '../lib/callable.js';
import { errorName, fail } from '../lib/errors.js';
import { failureCodeOf, httpStatusOf } from '../lib/failures.js';
import { log } from '../lib/log.js';
import { fetchProviderMedia, saveBuffer, signedReadUrl } from '../lib/media.js';
import { assertUsableObject } from '../lib/objects.js';
import { storagePaths } from '../lib/paths.js';
import { buildPosterPrompt } from '../lib/prompts.js';
import { mediaProvider } from '../lib/provider.js';
import { beginPaidStep, completePaidStep, refundPaidStep } from '../lib/steps.js';
import { parseCreatePoster } from '../lib/validate.js';
import type { CreatePosterResponse } from '../shared/api.js';
import { STEP_COSTS } from '../shared/pricing.js';

const POSTER_TYPES = /^(image\/(png|jpeg|webp)|application\/octet-stream|binary\/octet-stream)$/;

export const createPoster = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    secrets: [FAL_KEY],
    maxInstances: 20,
    timeoutSeconds: 180,
    memory: '512MiB',
  },
  handleCallable('createPoster', async (request, uid): Promise<CreatePosterResponse> => {
    const input = parseCreatePoster(request.data, uid);
    await assertUsableObject(input.photoPath, 'image');

    const posterId = randomUUID();
    const started = await beginPaidStep({
      uid,
      key: input.idempotencyKey,
      kind: 'createPoster',
      refId: posterId,
      cost: STEP_COSTS.poster,
      useFreePosterToken: input.useFreePosterToken,
      requirePro: input.look.proOnly,
      ledgerReason: 'poster',
    });
    if (started.kind === 'replay') {
      const posterPath = started.record.response?.posterPath;
      if (typeof posterPath !== 'string') fail('unknown');
      return { posterPath, posterUrl: await signedReadUrl(posterPath, CLIENT_URL_TTL_MS), balance: started.balance };
    }

    try {
      const photoUrl = await signedReadUrl(input.photoPath, PROVIDER_SYNC_URL_TTL_MS);
      const result = await mediaProvider(FAL_KEY.value()).editPoster({
        imageUrl: photoUrl,
        prompt: buildPosterPrompt(input.look, input.subject),
      });
      const media = await fetchProviderMedia(result.imageUrl, {
        maxBytes: MAX_PROVIDER_IMAGE_BYTES,
        timeoutMs: 30_000,
        typePattern: POSTER_TYPES,
      });
      const posterPath = storagePaths.poster(uid, posterId);
      const contentType = media.contentType.startsWith('image/') ? media.contentType : 'image/png';
      await saveBuffer(posterPath, media.buffer, contentType);
      await completePaidStep(uid, input.idempotencyKey, { posterPath });
      log.info('poster.created', { uid, credits: started.charge.credits });
      return { posterPath, posterUrl: await signedReadUrl(posterPath, CLIENT_URL_TTL_MS), balance: started.balance };
    } catch (error) {
      const code = failureCodeOf(error);
      log.warn('poster.failed', { uid, code, errorName: errorName(error), httpStatus: httpStatusOf(error) });
      await refundPaidStep(uid, input.idempotencyKey, code);
      return fail(code);
    }
  }),
);
