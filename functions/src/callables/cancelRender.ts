/** Owner cancels a render that is still queued: full refund, best-effort provider cancel. */
import { onCall } from 'firebase-functions/v2/https';

import { FAL_KEY, REGION } from '../config.js';
import { handleCallable } from '../lib/callable.js';
import { errorName, fail } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { mediaProvider } from '../lib/provider.js';
import { refundRender } from '../lib/renders.js';
import { parseCancelRender } from '../lib/validate.js';
import { readBalance } from '../lib/wallet.js';

export const cancelRender = onCall(
  { region: REGION, enforceAppCheck: true, secrets: [FAL_KEY], maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' },
  handleCallable('cancelRender', async (request, uid) => {
    const { renderId } = parseCancelRender(request.data);
    // The path is scoped to the caller's uid, so only the owner can reach it.
    const outcome = await refundRender(uid, renderId, { fromStatuses: ['queued'], to: 'canceled', errorCode: null });
    if (!outcome.changed) fail(outcome.previousStatus === null ? 'not_found' : 'invalid_input');
    if (outcome.requestId) {
      try {
        await mediaProvider(FAL_KEY.value()).cancelLipSync(outcome.requestId);
      } catch (error) {
        // Best effort: a late webhook for a canceled render is ignored.
        log.warn('render.provider_cancel_failed', { uid, renderId, errorName: errorName(error) });
      }
    }
    log.info('render.canceled', { uid, renderId });
    return { renderId, status: 'canceled' as const, balance: outcome.balance ?? (await readBalance(uid)) };
  }),
);
