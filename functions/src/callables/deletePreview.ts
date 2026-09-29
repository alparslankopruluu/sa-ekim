/**
 * Owner deletes one finished (or failed/canceled) preview: document, private state and the result
 * image. The selfie is deleted too when no other live preview of the same user still uses it.
 */
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { fail } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { deleteObject } from '../lib/media.js';
import { docPaths, storagePaths } from '../lib/paths.js';
import { TERMINAL_PREVIEW_STATUSES } from '../lib/previews.js';
import { parseDeletePreview } from '../lib/validate.js';
import type { PreviewStatus } from '../shared/api.js';

export const deletePreview = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' },
  handleCallable('deletePreview', async (request, uid) => {
    const { previewId } = parseDeletePreview(request.data);
    // Owner-scoped path: another uid's preview id simply does not exist here.
    const ref = db().doc(docPaths.preview(uid, previewId));
    const snap = await ref.get();
    if (!snap.exists) fail('not_found');
    const status = snap.get('status') as PreviewStatus;
    if (!TERMINAL_PREVIEW_STATUSES.includes(status)) fail('invalid_input');
    await deleteObject(storagePaths.previewResult(uid, previewId));
    const photoPath = snap.get('photoPath');
    if (typeof photoPath === 'string' && photoPath.startsWith(`uploads/${uid}/`)) {
      const others = await db().collection(docPaths.previews(uid)).where('photoPath', '==', photoPath).limit(2).get();
      if (others.docs.every((doc) => doc.id === previewId)) await deleteObject(photoPath);
    }
    const batch = db().batch();
    batch.delete(ref);
    batch.delete(db().doc(docPaths.previewPrivate(uid, previewId)));
    await batch.commit();
    log.info('preview.deleted', { uid, previewId });
    return { deleted: true as const };
  }),
);
