/**
 * RevenueCat webhook → wallet/entitlement plan (pure). The HTTP handler only
 * authenticates, calls `planRcEvent`, and applies the plan in one idempotent
 * transaction keyed by the RevenueCat event id.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { WEEK_MS } from '../config.js';
import { creditsForPack, PLAN_ALLOWANCE } from '../shared/pricing.js';
import { ENTITLEMENT_PRO, PRODUCT_SUFFIXES, packForProductId, type PlanId, planForProductId } from '../shared/products.js';
import { UID_PATTERN } from './paths.js';

/** `Authorization: Bearer <secret>`, compared in constant time (both sides hashed to 32 bytes). */
export function isAuthorizedRevenueCat(header: unknown, secret: string): boolean {
  if (!secret || typeof header !== 'string') return false;
  // RevenueCat sends the dashboard "Authorization header value" verbatim; accept it
  // with or without a single "Bearer " prefix.
  const token = header.trim().replace(/^Bearer /, '');
  const expected = createHash('sha256').update(secret, 'utf8').digest();
  const given = createHash('sha256').update(token, 'utf8').digest();
  return timingSafeEqual(expected, given);
}

export interface RcEvent {
  id: string;
  type: string;
  /** Firebase uid resolved from app_user_id / original_app_user_id / aliases. */
  uid: string | null;
  productId: string | null;
  newProductId: string | null;
  entitlementIds: string[] | null;
  periodType: string | null;
  purchasedAtMs: number | null;
  expirationAtMs: number | null;
  eventTimestampMs: number | null;
  store: string | null;
  environment: string | null;
  /** TRANSFER events: Firebase uids the purchases moved from / to. */
  transferredFrom: string[];
  transferredTo: string[];
}

const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function str(value: unknown, max = 200): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function uidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is string => typeof id === 'string' && !id.startsWith('$RCAnonymousID') && UID_PATTERN.test(id))
    .slice(0, 10);
}

/** The app calls `Purchases.logIn(firebaseUid)`, so app user ids are Firebase uids. */
export function resolveUid(event: Record<string, unknown>): string | null {
  const aliases = Array.isArray(event.aliases) ? event.aliases : [];
  const candidates = [event.app_user_id, event.original_app_user_id, ...aliases];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.startsWith('$RCAnonymousID')) continue;
    if (UID_PATTERN.test(candidate)) return candidate;
  }
  return null;
}

export function parseRcWebhookBody(body: unknown): RcEvent | null {
  if (!body || typeof body !== 'object') return null;
  const event = (body as { event?: unknown }).event;
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  const id = str(e.id, 128);
  const type = str(e.type, 64);
  if (!id || !EVENT_ID_PATTERN.test(id) || !type) return null;
  const entitlementIds = Array.isArray(e.entitlement_ids)
    ? e.entitlement_ids.filter((x): x is string => typeof x === 'string')
    : typeof e.entitlement_id === 'string'
      ? [e.entitlement_id]
      : null;
  return {
    id,
    type,
    uid: resolveUid(e),
    productId: str(e.product_id),
    newProductId: str(e.new_product_id),
    entitlementIds,
    periodType: str(e.period_type, 32),
    purchasedAtMs: num(e.purchased_at_ms),
    expirationAtMs: num(e.expiration_at_ms),
    eventTimestampMs: num(e.event_timestamp_ms),
    store: str(e.store, 32),
    environment: str(e.environment, 32),
    transferredFrom: uidList(e.transferred_from),
    transferredTo: uidList(e.transferred_to),
  };
}

/** Fields written (merged) onto `users/{uid}/private/entitlement`. */
export interface EntitlementUpdate {
  pro: boolean;
  productId: string | null;
  plan: PlanId | null;
  expiresAt: number | null;
  store: string | null;
  environment: string | null;
  /** Ordering guard: an older event never overwrites a newer mirror. */
  lastEventAt: number;
  /**
   * Annual weekly-allowance schedule. `undefined` keeps the stored schedule;
   * `null` clears it.
   */
  allowance?: { anchorAt: number; week: number; nextAt: number } | null;
}

export type RcAction =
  | { kind: 'ignore'; reason: 'test' | 'unsupported_type' | 'unknown_user' | 'unknown_product' }
  | {
      /**
       * Restore on a new (e.g. reinstalled, anonymous) account: RevenueCat moved
       * the purchases, so the entitlement mirror moves with them. Credits stay
       * in the wallet they were granted to.
       */
      kind: 'transfer';
      eventId: string;
      fromUids: string[];
      toUid: string;
      eventAt: number;
    }
  | {
      kind: 'apply';
      eventId: string;
      uid: string;
      eventType: string;
      grant: { credits: number; reason: 'plan_allowance' | 'credit_pack'; refId: string } | null;
      entitlement: EntitlementUpdate | null;
      /** The wheel-prize offering (annual gift discount) was purchased. */
      giftOfferingRedeemed: boolean;
    };

/**
 * Only a new purchase or a renewal grants the allowance. PRODUCT_CHANGE just mirrors
 * the new plan: the store follows it with a RENEWAL of the new product, which grants
 * (granting on both would double-count).
 */
const GRANT_PLAN_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL']);
const MIRROR_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_EXTENDED',
  'SUBSCRIPTION_PAUSED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
]);

/** Whole-week addition (weeks are 7 × 24 h; the schedule is computed from the anchor, so it never drifts). */
export function addWeeks(ms: number, weeks: number): number {
  return ms + weeks * WEEK_MS;
}

function isGiftOfferingProduct(productId: string): boolean {
  return productId.toLowerCase().includes(PRODUCT_SUFFIXES.annualGiftDiscount);
}

/**
 * Credits a plan purchase or renewal grants. There is no trial anywhere: an annual purchase (and its
 * yearly renewal) grants `initial`, the weekly top-ups follow from `hourlyMaintenance`.
 */
export function planGrantCredits(plan: PlanId): number {
  return plan === 'annual' ? PLAN_ALLOWANCE.annual.initial : PLAN_ALLOWANCE[plan].credits;
}

export function planRcEvent(event: RcEvent, now: number): RcAction {
  if (event.type === 'TEST') return { kind: 'ignore', reason: 'test' };
  if (event.type === 'TRANSFER') {
    const toUid = event.transferredTo[0] ?? null;
    const fromUids = event.transferredFrom.filter((uid) => uid !== toUid);
    if (!toUid || fromUids.length === 0) return { kind: 'ignore', reason: 'unknown_user' };
    return { kind: 'transfer', eventId: event.id, fromUids, toUid, eventAt: event.eventTimestampMs ?? now };
  }
  const handled = MIRROR_TYPES.has(event.type) || event.type === 'NON_RENEWING_PURCHASE';
  if (!handled) return { kind: 'ignore', reason: 'unsupported_type' };
  if (!event.uid) return { kind: 'ignore', reason: 'unknown_user' };

  const productId = event.type === 'PRODUCT_CHANGE' ? (event.newProductId ?? event.productId) : event.productId;
  if (!productId) return { kind: 'ignore', reason: 'unknown_product' };
  const plan = planForProductId(productId);
  const pack = packForProductId(productId);
  if (!plan && !pack) return { kind: 'ignore', reason: 'unknown_product' };

  let grant: Extract<RcAction, { kind: 'apply' }>['grant'] = null;
  if (plan && GRANT_PLAN_TYPES.has(event.type)) {
    grant = { credits: planGrantCredits(plan), reason: 'plan_allowance', refId: `rc:${event.id}` };
  } else if (!plan && pack && event.type === 'NON_RENEWING_PURCHASE') {
    const credits = creditsForPack(pack);
    if (credits) grant = { credits, reason: 'credit_pack', refId: `rc:${event.id}` };
  }

  let entitlement: EntitlementUpdate | null = null;
  const grantsPro = event.entitlementIds === null || event.entitlementIds.includes(ENTITLEMENT_PRO);
  if (plan && grantsPro && MIRROR_TYPES.has(event.type)) {
    const pro =
      event.type !== 'EXPIRATION' && (event.expirationAtMs === null || event.expirationAtMs > now);
    let allowance: EntitlementUpdate['allowance'];
    if (!pro || plan !== 'annual') {
      allowance = null;
    } else if (GRANT_PLAN_TYPES.has(event.type)) {
      // Annual plans get a weekly top-up: this purchase/renewal grants the initial amount;
      // hourlyMaintenance grants weeks 1..51 on this schedule while the year is active.
      const anchorAt = event.purchasedAtMs ?? event.eventTimestampMs ?? now;
      allowance = { anchorAt, week: 1, nextAt: addWeeks(anchorAt, 1) };
    }
    entitlement = {
      pro,
      productId,
      plan,
      expiresAt: event.expirationAtMs,
      store: event.store,
      environment: event.environment,
      lastEventAt: event.eventTimestampMs ?? now,
      ...(allowance !== undefined ? { allowance } : {}),
    };
  }

  if (!grant && !entitlement) return { kind: 'ignore', reason: 'unsupported_type' };
  return {
    kind: 'apply',
    eventId: event.id,
    uid: event.uid,
    eventType: event.type,
    grant,
    entitlement,
    giftOfferingRedeemed: event.type === 'INITIAL_PURCHASE' && isGiftOfferingProduct(productId),
  };
}

/** Idempotency: an event id that was already applied is acknowledged and skipped. */
export function decideRcProcessing(alreadyProcessed: boolean): 'process' | 'skip' {
  return alreadyProcessed ? 'skip' : 'process';
}

/** Whether an entitlement mirror should be overwritten by an event at `eventAt`. */
export function shouldMirrorEvent(existingLastEventAt: unknown, eventAt: number): boolean {
  return typeof existingLastEventAt !== 'number' || eventAt >= existingLastEventAt;
}

/** Slack so a weekly top-up never lands on the same day as the yearly renewal grant. */
const RENEWAL_SLACK_MS = 12 * 60 * 60 * 1000;

/** Annual subscriber whose next weekly top-up is due inside the paid period. */
export function isAllowanceDue(entitlement: unknown, now: number): boolean {
  if (!entitlement || typeof entitlement !== 'object') return false;
  const e = entitlement as Record<string, unknown>;
  if (e.pro !== true || e.plan !== 'annual') return false;
  const next = e.nextAllowanceAt;
  const expiresAt = e.expiresAt;
  if (typeof next !== 'number' || next > now) return false;
  if (typeof expiresAt === 'number' && (expiresAt <= now || next >= expiresAt - RENEWAL_SLACK_MS)) return false;
  return typeof e.allowanceAnchorAt === 'number' && typeof e.allowanceWeek === 'number';
}

/** Next step of the weekly schedule (computed from the anchor). */
export function advanceAllowance(entitlement: { allowanceAnchorAt: number; allowanceWeek: number }): {
  allowanceWeek: number;
  nextAllowanceAt: number;
} {
  const allowanceWeek = entitlement.allowanceWeek + 1;
  return { allowanceWeek, nextAllowanceAt: addWeeks(entitlement.allowanceAnchorAt, allowanceWeek) };
}

/** Mirror fields that move with a TRANSFER (everything but bookkeeping). */
export const TRANSFERABLE_ENTITLEMENT_FIELDS = [
  'pro',
  'productId',
  'plan',
  'expiresAt',
  'store',
  'environment',
  'allowanceAnchorAt',
  'allowanceWeek',
  'nextAllowanceAt',
] as const;

/**
 * Of the source accounts' mirrors, the active one that runs longest (null if
 * none is active — then there is nothing to move).
 */
export function pickTransferredEntitlement(
  mirrors: ReadonlyArray<Record<string, unknown> | undefined>,
  now: number,
): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  for (const mirror of mirrors) {
    if (!mirror || mirror.pro !== true) continue;
    const expiresAt = typeof mirror.expiresAt === 'number' ? mirror.expiresAt : Number.POSITIVE_INFINITY;
    if (expiresAt <= now) continue;
    const bestExpiry =
      best && typeof best.expiresAt === 'number' ? best.expiresAt : best ? Number.POSITIVE_INFINITY : -1;
    if (expiresAt > bestExpiry) best = mirror;
  }
  if (!best) return null;
  const picked: Record<string, unknown> = {};
  for (const field of TRANSFERABLE_ENTITLEMENT_FIELDS) {
    if (field in best) picked[field] = best[field];
  }
  return picked;
}
