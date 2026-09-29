/**
 * Cohort counts for the caller, from real data only, using Firestore count queries (no documents are
 * read into memory). Never returns identities. The app shows the number only when
 * `sameWeek >= COHORT_MIN_VISIBLE`, so a small count can never point at a person.
 *   sameWeek  members whose operation day falls in the same calendar week (Monday–Sunday) as the caller's;
 *   sameGoal  members with the same goal whose operation day is within ±14 days of the caller's.
 * The caller must have joined (`not_found` otherwise), so they are always part of both counts.
 */
import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import type { CohortStats } from '../shared/api.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { dateWindow, SAME_GOAL_WINDOW_DAYS, weekBounds } from '../lib/cohort.js';
import { fail } from '../lib/errors.js';
import { docPaths } from '../lib/paths.js';
import { isGoal } from '../shared/catalog.js';
import { isIsoDate } from '../shared/timeline.js';

export const getCohort = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 10, timeoutSeconds: 20, memory: '256MiB' },
  handleCallable('getCohort', async (_request, uid): Promise<CohortStats> => {
    const me = await db().doc(docPaths.cohortMember(uid)).get();
    const procedureDate: unknown = me.get('procedureDate');
    const goal: unknown = me.get('goal');
    if (!me.exists || !isIsoDate(procedureDate) || !isGoal(goal)) fail('not_found');

    const members = db().collection(docPaths.cohortMembers());
    const week = weekBounds(procedureDate);
    const window = dateWindow(procedureDate, SAME_GOAL_WINDOW_DAYS);
    const [sameWeek, sameGoal] = await Promise.all([
      members.where('procedureDate', '>=', week.start).where('procedureDate', '<=', week.end).count().get(),
      members
        .where('goal', '==', goal)
        .where('procedureDate', '>=', window.start)
        .where('procedureDate', '<=', window.end)
        .count()
        .get(),
    ]);
    return { sameWeek: sameWeek.data().count, sameGoal: sameGoal.data().count };
  }),
);
