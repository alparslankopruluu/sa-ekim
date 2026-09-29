/**
 * RevenueCat webhook: the only writer of the entitlement mirror and of
 * purchase credit grants. Authenticated with a constant-time Bearer check
 * before touching Firestore; idempotent on the RevenueCat event id (stored in
 * `users/{uid}/rc_events/{eventId}` in the same transaction as the grant).
 */
import { onRequest } from 'firebase-functions/v2/https';

import { REGION, REVENUECAT_WEBHOOK_AUTH } from '../config.js';
import { auth, db } from '../lib/admin.js';
import { errorName } from '../lib/errors.js';
import { log } from '../lib/log.js';
import { docPaths } from '../lib/paths.js';
import {
  decideRcProcessing,
  isAuthorizedRevenueCat,
  parseRcWebhookBody,
  pickTransferredEntitlement,
  planRcEvent,
  type RcAction,
  shouldMirrorEvent,
} from '../lib/revenuecat.js';
import { creditChange, giftRef, walletRef, writeLedger, writeWalletChange } from '../lib/wallet.js';

type ApplyAction = Extract<RcAction, { kind: 'apply' }>;
type TransferAction = Extract<RcAction, { kind: 'transfer' }>;

/** Never resurrect data for a deleted (or never-existing) Firebase user. */
async function userExists(uid: string): Promise<boolean> {
  try {
    await auth().getUser(uid);
    return true;
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
    if (code === 'auth/user-not-found') return false;
    throw error;
  }
}

const OFFERING_PRIZES = new Set(['discount40', 'trial7']);

async function applyRcAction(action: ApplyAction): Promise<boolean> {
  const { uid } = action;
  const eventRef = db().doc(docPaths.rcEvent(uid, action.eventId));
  const entitlementRef = db().doc(docPaths.entitlement(uid));
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [eventSnap, walletSnap, entitlementSnap, giftSnap] = await tx.getAll(
      eventRef,
      walletRef(uid),
      entitlementRef,
      giftRef(uid),
    );
    if (!eventSnap || !walletSnap || !entitlementSnap || !giftSnap) throw new Error('snapshot missing');
    if (decideRcProcessing(eventSnap.exists) === 'skip') return false;

    if (action.grant) {
      writeWalletChange(tx, walletRef(uid), walletSnap, creditChange(action.grant.credits), now);
      writeLedger(tx, uid, { delta: action.grant.credits, reason: action.grant.reason, refId: action.grant.refId }, now);
    }

    const ent = action.entitlement;
    if (ent && shouldMirrorEvent(entitlementSnap.get('lastEventAt'), ent.lastEventAt)) {
      const update: Record<string, unknown> = {
        pro: ent.pro,
        productId: ent.productId,
        plan: ent.plan,
        expiresAt: ent.expiresAt,
        store: ent.store,
        environment: ent.environment,
        lastEventAt: ent.lastEventAt,
        updatedAt: now,
      };
      if (ent.allowance === null) {
        Object.assign(update, { allowanceAnchorAt: null, allowanceMonth: 0, nextAllowanceAt: null });
      } else if (ent.allowance) {
        Object.assign(update, {
          allowanceAnchorAt: ent.allowance.anchorAt,
          allowanceMonth: ent.allowance.month,
          nextAllowanceAt: ent.allowance.nextAt,
        });
      }
      tx.set(entitlementRef, update, { merge: true });
    }

    if (
      action.giftOfferingRedeemed &&
      giftSnap.exists &&
      OFFERING_PRIZES.has(String(giftSnap.get('prizeId'))) &&
      giftSnap.get('redeemedAt') == null
    ) {
      tx.update(giftRef(uid), { redeemedAt: now });
    }

    tx.create(eventRef, { type: action.eventType, credits: action.grant?.credits ?? 0, processedAt: now });
    return true;
  });
}

async function applyRcTransfer(action: TransferAction): Promise<boolean> {
  const { toUid } = action;
  const eventRef = db().doc(docPaths.rcEvent(toUid, action.eventId));
  const toRef = db().doc(docPaths.entitlement(toUid));
  const fromRefs = action.fromUids.map((uid) => db().doc(docPaths.entitlement(uid)));
  return await db().runTransaction(async (tx) => {
    const now = Date.now();
    const [eventSnap, toSnap, ...fromSnaps] = await tx.getAll(eventRef, toRef, ...fromRefs);
    if (!eventSnap || !toSnap) throw new Error('snapshot missing');
    if (decideRcProcessing(eventSnap.exists) === 'skip') return false;
    const moved = pickTransferredEntitlement(
      fromSnaps.map((snap) => snap?.data()),
      now,
    );
    if (moved && shouldMirrorEvent(toSnap.get('lastEventAt'), action.eventAt)) {
      tx.set(toRef, { ...moved, lastEventAt: action.eventAt, updatedAt: now }, { merge: true });
      for (const snap of fromSnaps) {
        if (snap?.exists && snap.get('pro') === true) {
          tx.update(snap.ref, { pro: false, nextAllowanceAt: null, lastEventAt: action.eventAt, updatedAt: now });
        }
      }
    }
    tx.create(eventRef, { type: 'TRANSFER', credits: 0, moved: moved !== null, processedAt: now });
    return true;
  });
}

export const revenuecatWebhook = onRequest(
  {
    region: REGION,
    secrets: [REVENUECAT_WEBHOOK_AUTH],
    invoker: 'public',
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST').status(405).end();
      return;
    }
    if (!isAuthorizedRevenueCat(req.get('authorization'), REVENUECAT_WEBHOOK_AUTH.value())) {
      res.status(401).end();
      return;
    }
    const event = parseRcWebhookBody(req.body);
    if (!event) {
      res.status(400).end();
      return;
    }
    const action = planRcEvent(event, Date.now());
    if (action.kind === 'ignore') {
      log.info('rc.ignored', { eventType: event.type, reason: action.reason });
      res.status(200).json({ ok: true });
      return;
    }
    const uid = action.kind === 'apply' ? action.uid : action.toUid;
    try {
      if (!(await userExists(uid))) {
        log.info('rc.ignored', { uid, eventType: event.type, reason: 'no_such_user' });
        res.status(200).json({ ok: true });
        return;
      }
      const applied = action.kind === 'apply' ? await applyRcAction(action) : await applyRcTransfer(action);
      log.info(applied ? 'rc.applied' : 'rc.duplicate', {
        uid,
        eventType: event.type,
        credits: action.kind === 'apply' ? (action.grant?.credits ?? 0) : 0,
      });
      res.status(200).json({ ok: true });
    } catch (error) {
      log.error('rc.failed', { uid, eventType: event.type, errorName: errorName(error) });
      res.status(500).end(); // RevenueCat retries
    }
  },
);
