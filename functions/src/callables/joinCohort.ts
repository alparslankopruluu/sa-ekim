/**
 * Opt-in "same week" cohort. Writes ONE minimal document, `cohortMembers/{uid}`: the operation date,
 * goal and kind the user typed, plus joinedAt. No photos, names, clinic or device data. Re-joining
 * replaces the document (the date can be corrected).
 */
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { log } from '../lib/log.js';
import { docPaths } from '../lib/paths.js';
import { parseJoinCohort } from '../lib/validate.js';

export const joinCohort = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 10, timeoutSeconds: 20, memory: '256MiB' },
  handleCallable('joinCohort', async (request, uid) => {
    const input = parseJoinCohort(request.data);
    await db()
      .doc(docPaths.cohortMember(uid))
      .set({ procedureDate: input.procedureDate, goal: input.goal, kind: input.kind, joinedAt: Date.now() });
    log.info('cohort.joined', { uid, kind: input.kind });
    return { joined: true as const };
  }),
);
