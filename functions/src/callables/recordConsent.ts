/** Stores the accepted AI-processing disclosure version (required before any generation). */
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { docPaths } from '../lib/paths.js';
import { parseRecordConsent } from '../lib/validate.js';

export const recordConsent = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 20, timeoutSeconds: 20, memory: '256MiB' },
  handleCallable('recordConsent', async (request, uid) => {
    const { version } = parseRecordConsent(request.data);
    const ref = db().doc(docPaths.consent(uid));
    const stored = await db().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const current = snapshot.get('version');
      const currentVersion = typeof current === 'number' ? current : 0;
      if (currentVersion >= version) return currentVersion;
      tx.set(ref, { version, acceptedAt: Date.now() });
      return version;
    });
    return { recorded: true, version: stored };
  }),
);
