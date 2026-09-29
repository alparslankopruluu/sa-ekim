/**
 * In-app account deletion (App Review 5.1.1(v)): every Storage prefix of the uid (selfies and
 * results), the cohort membership, reports the user filed, every Firestore document under
 * `users/{uid}` (previews, wallet, gift, consent, ledger, requests, devices…), then the Auth user.
 * Each step tolerates already-deleted data, so a retry completes the job. The RevenueCat customer
 * record is not touched here (it needs RevenueCat's own API key and is owner-side; see docs).
 */
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { auth, db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { log } from '../lib/log.js';
import { deletePrefix } from '../lib/media.js';
import { docPaths, userMediaPrefixes } from '../lib/paths.js';

export const deleteAccount = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 5, timeoutSeconds: 300, memory: '512MiB' },
  handleCallable('deleteAccount', async (_request, uid) => {
    await Promise.all(userMediaPrefixes(uid).map((prefix) => deletePrefix(prefix)));
    await db().doc(docPaths.cohortMember(uid)).delete();
    const reports = await db().collection(docPaths.reports()).where('uid', '==', uid).get();
    await Promise.all(reports.docs.map((doc) => doc.ref.delete()));
    await db().recursiveDelete(db().doc(docPaths.user(uid)));
    try {
      await auth().deleteUser(uid);
    } catch (error) {
      const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
      if (code !== 'auth/user-not-found') throw error;
    }
    log.info('account.deleted', { uid });
    return { deleted: true as const };
  }),
);
