/**
 * Files a content report for human review within 48 hours (App Review 1.2,
 * TAKE IT DOWN Act). One report per user + render; only a fixed reason code is stored.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { fail } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { docPaths } from '../lib/paths.js';
import { parseReportRender } from '../lib/validate.js';

export const reportRender = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 5, timeoutSeconds: 15, memory: '256MiB' },
  handleCallable('reportRender', async (request, uid) => {
    const { renderId, reason } = parseReportRender(request.data);
    const render = await db().doc(docPaths.render(uid, renderId)).get();
    if (!render.exists) fail('not_found');
    await db()
      .doc(docPaths.report(uid, renderId))
      .set({ uid, renderId, reason, status: 'open', createdAt: FieldValue.serverTimestamp() }, { merge: true });
    log.info('render.reported', { uid, renderId, reason });
    return { reported: true as const };
  }),
);
