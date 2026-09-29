/** Owner deletes one finished (or failed/canceled) render: document, private state and video file. */
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { fail } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { deletePrefix } from '../lib/media.js';
import { docPaths, storagePaths } from '../lib/paths.js';
import { parseDeleteRender } from '../lib/validate.js';

const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);

export const deleteRender = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' },
  handleCallable('deleteRender', async (request, uid) => {
    const { renderId } = parseDeleteRender(request.data);
    // Owner-scoped path: another uid's render id simply does not exist here.
    const ref = db().doc(docPaths.render(uid, renderId));
    const snap = await ref.get();
    if (!snap.exists) fail('not_found');
    const status = snap.get('status');
    if (typeof status !== 'string' || !TERMINAL.has(status)) fail('invalid_input');
    await deletePrefix(storagePaths.render(uid, renderId));
    const batch = db().batch();
    batch.delete(ref);
    batch.delete(db().doc(docPaths.renderPrivate(uid, renderId)));
    await batch.commit();
    log.info('render.deleted', { uid, renderId });
    return { deleted: true as const };
  }),
);
