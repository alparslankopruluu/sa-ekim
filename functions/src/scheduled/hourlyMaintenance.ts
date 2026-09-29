/**
 * Hourly housekeeping, each sweep bounded and independent:
 *  1. Retention: delete source media (face photos, recordings, voice lines,
 *     personal songs, posters, trimmed preview audio) older than 24 h.
 *  2. Stuck renders (non-terminal > 30 min): best-effort provider cancel,
 *     fail + refund.
 *  3. Stale paid steps (function died mid-flight > 15 min): refund.
 *  4. Annual subscribers: grant the monthly allowance when due.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';

import {
  FAL_KEY,
  REGION,
  SOURCE_MEDIA_TTL_MS,
  STALE_REQUEST_MS,
  STUCK_FINALIZING_MS,
  STUCK_RENDER_MS,
} from '../config.js';
import { isProActive } from '../lib/access.js';
import { bucket, db } from '../lib/admin.js';
import { errorName } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { docPaths, EPHEMERAL_MEDIA_ROOTS, uidFromUserDocPath } from '../lib/paths.js';
import { mediaProvider } from '../lib/provider.js';
import { refundRender, ACTIVE_RENDER_STATUSES } from '../lib/renders.js';
import { isExpiredMedia, isStuckRender } from '../lib/retention.js';
import { advanceAllowance, isAllowanceDue } from '../lib/revenuecat.js';
import { refundPaidStep } from '../lib/steps.js';
import { creditChange, markRequestFailed, walletRef, writeLedger, writeWalletChange } from '../lib/wallet.js';
import type { RenderStatus } from '../shared/api.js';
import { PLAN_ALLOWANCE } from '../shared/pricing.js';

const MAX_PAGES_PER_ROOT = 20;
const MAX_DELETES_PER_RUN = 5000;
const DELETE_CONCURRENCY = 16;
const QUERY_LIMIT = 200;

async function inBatches<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(work));
  }
}

async function sweepSourceMedia(now: number): Promise<number> {
  let deleted = 0;
  for (const root of EPHEMERAL_MEDIA_ROOTS) {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES_PER_ROOT && deleted < MAX_DELETES_PER_RUN; page += 1) {
      const [files, next] = await bucket().getFiles({
        prefix: `${root}/`,
        maxResults: 1000,
        autoPaginate: false,
        fields: 'items(name,timeCreated),nextPageToken',
        ...(pageToken ? { pageToken } : {}),
      });
      const expired = files
        .filter((file) => isExpiredMedia(file.metadata.timeCreated, now, SOURCE_MEDIA_TTL_MS))
        .slice(0, MAX_DELETES_PER_RUN - deleted);
      await inBatches(expired, DELETE_CONCURRENCY, async (file) => {
        await file.delete({ ignoreNotFound: true });
      });
      deleted += expired.length;
      pageToken = next && 'pageToken' in next ? next.pageToken : undefined;
      if (!pageToken) break;
    }
  }
  return deleted;
}

async function sweepStuckRenders(now: number): Promise<number> {
  const snapshot = await db()
    .collectionGroup('renders')
    .where('status', 'in', [...ACTIVE_RENDER_STATUSES])
    .where('createdAt', '<', now - STUCK_RENDER_MS)
    .limit(QUERY_LIMIT)
    .get();
  let failed = 0;
  const provider = mediaProvider(FAL_KEY.value());
  for (const doc of snapshot.docs) {
    const uid = uidFromUserDocPath(doc.ref.path);
    if (!uid) continue;
    const render = { status: doc.get('status'), createdAt: doc.get('createdAt'), updatedAt: doc.get('updatedAt') };
    if (!isStuckRender(render, now, { stuckMs: STUCK_RENDER_MS, finalizingMs: STUCK_FINALIZING_MS })) continue;
    const status = render.status as RenderStatus;
    const outcome = await refundRender(uid, doc.id, { fromStatuses: [status], to: 'failed', errorCode: 'timeout' });
    if (!outcome.changed) continue;
    failed += 1;
    log.warn('render.stuck_refunded', { uid, renderId: doc.id, status });
    if (outcome.requestId && status !== 'finalizing') {
      await provider.cancelLipSync(outcome.requestId).catch(() => undefined);
    }
  }
  return failed;
}

async function sweepStaleRequests(now: number): Promise<number> {
  const snapshot = await db()
    .collectionGroup('requests')
    .where('status', '==', 'pending')
    .where('createdAt', '<', now - STALE_REQUEST_MS)
    .limit(QUERY_LIMIT)
    .get();
  let healed = 0;
  for (const doc of snapshot.docs) {
    const uid = uidFromUserDocPath(doc.ref.path);
    if (!uid) continue;
    if (doc.get('kind') === 'createRender') {
      // The reservation follows the render (refunded by the stuck-render sweep).
      await markRequestFailed(uid, doc.id, 'timeout');
    } else if (await refundPaidStep(uid, doc.id, 'timeout')) {
      log.warn('step.stale_refunded', { uid, kind: String(doc.get('kind')) });
    }
    healed += 1;
  }
  return healed;
}

async function grantAnnualAllowances(now: number): Promise<number> {
  const snapshot = await db()
    .collectionGroup('private')
    .where('nextAllowanceAt', '<=', now)
    .limit(QUERY_LIMIT)
    .get();
  let granted = 0;
  for (const doc of snapshot.docs) {
    const uid = uidFromUserDocPath(doc.ref.path);
    if (!uid || doc.id !== 'entitlement') continue;
    const entitlementRef = db().doc(docPaths.entitlement(uid));
    const didGrant = await db().runTransaction(async (tx) => {
      const [entitlementSnap, walletSnap] = await tx.getAll(entitlementRef, walletRef(uid));
      if (!entitlementSnap || !walletSnap) return false;
      const entitlement = entitlementSnap.data();
      if (!isAllowanceDue(entitlement, now)) {
        if (!isProActive(entitlement, now) || entitlementSnap.get('plan') !== 'annual') {
          tx.update(entitlementRef, { nextAllowanceAt: null, updatedAt: now });
        }
        return false;
      }
      const anchor = entitlementSnap.get('allowanceAnchorAt') as number;
      const month = entitlementSnap.get('allowanceMonth') as number;
      const credits = PLAN_ALLOWANCE.annual.credits;
      writeWalletChange(tx, walletRef(uid), walletSnap, creditChange(credits), now);
      writeLedger(tx, uid, { delta: credits, reason: 'plan_allowance', refId: `annual:${anchor}:${month}` }, now);
      const next = advanceAllowance({ allowanceAnchorAt: anchor, allowanceMonth: month });
      tx.update(entitlementRef, { ...next, updatedAt: now });
      return true;
    });
    if (didGrant) granted += 1;
  }
  return granted;
}

export const hourlyMaintenance = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: REGION,
    secrets: [FAL_KEY],
    timeoutSeconds: 540,
    memory: '512MiB',
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    const now = Date.now();
    const sweeps: Array<[string, (now: number) => Promise<number>]> = [
      ['media', sweepSourceMedia],
      ['stuck_renders', sweepStuckRenders],
      ['stale_requests', sweepStaleRequests],
      ['annual_allowance', grantAnnualAllowances],
    ];
    for (const [name, sweep] of sweeps) {
      try {
        const count = await sweep(now);
        log.info('maintenance.sweep', { kind: name, count });
      } catch (error) {
        log.error('maintenance.sweep_failed', { kind: name, errorName: errorName(error) });
      }
    }
  },
);
