/**
 * Shared callable plumbing: every handler gets a verified uid (App Check is
 * enforced by `enforceAppCheck: true` on each onCall), and every failure
 * leaves as `HttpsError(details: { code })` — sanitized, never a raw error.
 */
import type { CallableRequest } from 'firebase-functions/v2/https';

import { errorCodeOf, errorName, httpsErrorFor } from './errors.js';
import { log } from './log.js';

export function handleCallable<T>(
  name: string,
  handler: (request: CallableRequest<unknown>, uid: string) => Promise<T>,
): (request: CallableRequest<unknown>) => Promise<T> {
  return async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw httpsErrorFor('unauthenticated');
    try {
      return await handler(request, uid);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'unknown') log.error(`${name}.unexpected`, { uid, errorName: errorName(error) });
      else log.info(`${name}.rejected`, { uid, code });
      throw httpsErrorFor(code);
    }
  };
}
