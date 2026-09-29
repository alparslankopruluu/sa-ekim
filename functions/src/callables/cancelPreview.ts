/** Owner cancels a preview that is still in progress: full refund, best-effort provider cancel. */
import { onCall } from 'firebase-functions/v2/https';

import { FAL_KEY, REGION } from '../config.js';
import { handleCallable } from '../lib/callable.js';
import { fail } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { refundPreview } from '../lib/previews.js';
import { imageProvider } from '../lib/provider.js';
import { parseCancelPreview } from '../lib/validate.js';

export const cancelPreview = onCall(
  { region: REGION, enforceAppCheck: true, secrets: [FAL_KEY], maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' },
  handleCallable('cancelPreview', async (request, uid) => {
    const { previewId } = parseCancelPreview(request.data);
    // The path is scoped to the caller's uid, so only the owner can reach it.
    const outcome = await refundPreview(uid, previewId, {
      fromStatuses: ['queued', 'processing'],
      to: 'canceled',
      errorCode: null,
    });
    if (!outcome.changed) fail(outcome.previousStatus === null ? 'not_found' : 'invalid_input');
    if (outcome.cancelUrl) await imageProvider(FAL_KEY.value()).cancel(outcome.cancelUrl); // best effort, never throws
    log.info('preview.canceled', { uid, previewId });
    return { canceled: true as const };
  }),
);
