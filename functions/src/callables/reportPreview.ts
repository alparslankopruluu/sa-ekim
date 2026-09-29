/**
 * Files a content report for human review within 48 hours (App Review 1.2, TAKE IT DOWN Act) into
 * `reports/{autoId}`. Only a fixed reason code is stored; a repeat report for the same preview by the
 * same user is acknowledged without creating another document.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { fail } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { docPaths } from '../lib/paths.js';
import { parseReportPreview } from '../lib/validate.js';

export const reportPreview = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 5, timeoutSeconds: 15, memory: '256MiB' },
  handleCallable('reportPreview', async (request, uid) => {
    const { previewId, reason } = parseReportPreview(request.data);
    const preview = await db().doc(docPaths.preview(uid, previewId)).get();
    if (!preview.exists) fail('not_found');
    const existing = await db()
      .collection(docPaths.reports())
      .where('uid', '==', uid)
      .where('previewId', '==', previewId)
      .limit(1)
      .get();
    if (existing.empty) {
      await db()
        .collection(docPaths.reports())
        .doc()
        .set({ uid, previewId, reason, status: 'open', createdAt: FieldValue.serverTimestamp() });
    }
    log.info('preview.reported', { uid, previewId, reason });
    return { reported: true as const };
  }),
);
