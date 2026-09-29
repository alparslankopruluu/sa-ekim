/**
 * Hourly housekeeping, each sweep bounded and independent:
 *  1. Stuck previews (non-terminal > 30 min): best-effort provider cancel, fail + refund.
 *  2. Stale reservations (createPreview died before fal accepted the job, > 15 min): refund.
 *  3. Retention (privacy promise): after `expiresAt` (30 days) delete the preview's result image, its
 *     selfie (unless another live preview still uses it) and the PreviewDoc; and delete any upload
 *     older than 30 days, so a selfie never outlives the promise even if its preview is gone.
 *  4. Annual subscribers: weekly top-up while the year is active.
 *  5. Gifts: an unredeemed free-high token whose 3-day window passed leaves the wallet.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';

import {
  FAL_KEY,
  REGION,
  SELFIE_TTL_MS,
  STALE_REQUEST_MS,
  STUCK_FINALIZING_MS,
  STUCK_PREVIEW_MS,
} from '../config.js';
import { PLAN_ALLOWANCE } from '../shared/pricing.js';
import type { PreviewStatus } from '../shared/api.js';
import { isProActive } from '../lib/access.js';
import { bucket, db } from '../lib/admin.js';
import { errorName } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { deleteObject } from '../lib/media.js';
import { docPaths, storagePaths, uidFromUserDocPath } from '../lib/paths.js';
import { ACTIVE_PREVIEW_STATUSES, refundPreview, TERMINAL_PREVIEW_STATUSES } from '../lib/previews.js';
import { imageProvider } from '../lib/provider.js';
import { isExpiredMedia, isGiftTokenExpired, isStuckPreview } from '../lib/retention.js';
import { advanceAllowance, isAllowanceDue } from '../lib/revenuecat.js';
import { normalizeWallet } from '../lib/ledger.js';
import { creditChange, giftRef, markRequestFailed, walletRef, writeLedger, writeWalletChange } from '../lib/wallet.js';

const MAX_PAGES_PER_ROOT = 20;
const MAX_DELETES_PER_RUN = 5000;
const DELETE_CONCURRENCY = 16;
const QUERY_LIMIT = 200;

async function inBatches<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(work));
  }
}

/** Uploads older than the retention window (selfies of any origin). */
async function sweepOldUploads(now: number): Promise<number> {
  let deleted = 0;
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES_PER_ROOT && deleted < MAX_DELETES_PER_RUN; page += 1) {
    const [files, next] = await bucket().getFiles({
      prefix: 'uploads/',
      maxResults: 1000,
      autoPaginate: false,
      fields: 'items(name,timeCreated),nextPageToken',
      ...(pageToken ? { pageToken } : {}),
    });
    const expired = files
      .filter((file) => isExpiredMedia(file.metadata.timeCreated, now, SELFIE_TTL_MS))
      .slice(0, MAX_DELETES_PER_RUN - deleted);
    await inBatches(expired, DELETE_CONCURRENCY, async (file) => {
      await file.delete({ ignoreNotFound: true });
    });
    deleted += expired.length;
    pageToken = next && 'pageToken' in next ? next.pageToken : undefined;
    if (!pageToken) break;
  }
  return deleted;
}

/** After `expiresAt`: result image + selfie (if unshared) + PreviewDoc + private doc. */
async function sweepExpiredPreviews(now: number): Promise<number> {
  const snapshot = await db().collectionGroup('previews').where('expiresAt', '<=', now).limit(QUERY_LIMIT).get();
  let removed = 0;
  for (const doc of snapshot.docs) {
    const uid = uidFromUserDocPath(doc.ref.path);
    if (!uid) continue;
    if (!TERMINAL_PREVIEW_STATUSES.includes(doc.get('status') as PreviewStatus)) continue; // the stuck sweep settles it first
    const previewId = doc.id;
    await deleteObject(storagePaths.previewResult(uid, previewId));
    const photoPath: unknown = doc.get('photoPath');
    if (typeof photoPath === 'string' && photoPath.startsWith(`uploads/${uid}/`)) {
      const sharing = await db().collection(docPaths.previews(uid)).where('photoPath', '==', photoPath).get();
      const stillNeeded = sharing.docs.some((other) => {
        const expiresAt: unknown = other.get('expiresAt');
        return other.id !== previewId && (typeof expiresAt !== 'number' || expiresAt > now);
      });
      if (!stillNeeded) await deleteObject(photoPath);
    }
    const batch = db().batch();
    batch.delete(doc.ref);
    batch.delete(db().doc(docPaths.previewPrivate(uid, previewId)));
    await batch.commit();
    removed += 1;
  }
  return removed;
}

async function sweepStuckPreviews(now: number): Promise<number> {
  const snapshot = await db()
    .collectionGroup('previews')
    .where('status', 'in', [...ACTIVE_PREVIEW_STATUSES])
    .where('createdAt', '<', now - STUCK_PREVIEW_MS)
    .limit(QUERY_LIMIT)
    .get();
  let failed = 0;
  const provider = imageProvider(FAL_KEY.value());
  for (const doc of snapshot.docs) {
    const uid = uidFromUserDocPath(doc.ref.path);
    if (!uid) continue;
    const preview = { status: doc.get('status'), createdAt: doc.get('createdAt'), updatedAt: doc.get('updatedAt') };
    if (!isStuckPreview(preview, now, { stuckMs: STUCK_PREVIEW_MS, finalizingMs: STUCK_FINALIZING_MS })) continue;
    const status = preview.status as PreviewStatus;
    const outcome = await refundPreview(uid, doc.id, { fromStatuses: [status], to: 'failed', errorCode: 'timeout' });
    if (!outcome.changed) continue;
    failed += 1;
    log.warn('preview.stuck_refunded', { uid, previewId: doc.id, status });
    if (outcome.cancelUrl && status !== 'finalizing') await provider.cancel(outcome.cancelUrl);
  }
  return failed;
}

/** A pending idempotency record means createPreview never got fal to accept the job: refund now. */
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
    const refId: unknown = doc.get('refId');
    if (!uid || typeof refId !== 'string') continue;
    const outcome = await refundPreview(uid, refId, {
      fromStatuses: ['queued'],
      to: 'failed',
      errorCode: 'timeout',
      onlyIfUnsubmitted: true,
    });
    if (outcome.changed) log.warn('preview.stale_refunded', { uid, previewId: refId });
    await markRequestFailed(uid, doc.id, 'timeout');
    healed += 1;
  }
  return healed;
}

async function grantAnnualAllowances(now: number): Promise<number> {
  const snapshot = await db().collectionGroup('private').where('nextAllowanceAt', '<=', now).limit(QUERY_LIMIT).get();
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
      const week = entitlementSnap.get('allowanceWeek') as number;
      const credits = PLAN_ALLOWANCE.annual.credits;
      writeWalletChange(tx, walletRef(uid), walletSnap, creditChange(credits), now);
      writeLedger(tx, uid, { delta: credits, reason: 'plan_allowance', refId: `annual:${anchor}:${week}` }, now);
      const next = advanceAllowance({ allowanceAnchorAt: anchor, allowanceWeek: week });
      tx.update(entitlementRef, { ...next, updatedAt: now });
      return true;
    });
    if (didGrant) granted += 1;
  }
  return granted;
}

/** Unredeemed free-high tokens whose window passed leave the wallet (the gift keeps its history). */
async function expireGiftTokens(now: number): Promise<number> {
  const snapshot = await db().collectionGroup('private').where('tokenExpiresAt', '<=', now).limit(QUERY_LIMIT).get();
  let expired = 0;
  for (const doc of snapshot.docs) {
    const uid = uidFromUserDocPath(doc.ref.path);
    if (!uid || doc.id !== 'gift') continue;
    const done = await db().runTransaction(async (tx) => {
      const [giftSnap, walletSnap] = await tx.getAll(giftRef(uid), walletRef(uid));
      if (!giftSnap?.exists || !walletSnap) return false;
      if (!isGiftTokenExpired(giftSnap.data() ?? {}, now)) return false;
      if (walletSnap.exists && normalizeWallet(walletSnap.data()).freeHighTokens > 0) {
        writeWalletChange(tx, walletRef(uid), walletSnap, { credits: 0, freeHighTokens: -1 }, now);
      }
      tx.update(giftRef(uid), { tokenExpiresAt: null });
      return true;
    });
    if (done) expired += 1;
  }
  return expired;
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
      ['stuck_previews', sweepStuckPreviews],
      ['stale_requests', sweepStaleRequests],
      ['expired_previews', sweepExpiredPreviews],
      ['old_uploads', sweepOldUploads],
      ['annual_allowance', grantAnnualAllowances],
      ['gift_tokens', expireGiftTokens],
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
