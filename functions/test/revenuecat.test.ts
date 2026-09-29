import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addWeeks,
  planGrantCredits,
  pickTransferredEntitlement,
  advanceAllowance,
  decideRcProcessing,
  isAllowanceDue,
  isAuthorizedRevenueCat,
  parseRcWebhookBody,
  planRcEvent,
  type RcAction,
  shouldMirrorEvent,
} from '../src/lib/revenuecat.js';
import { WEEK_MS } from '../src/config.js';
import { CREDIT_PACKS, PLAN_ALLOWANCE } from '../src/shared/pricing.js';

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function event(patch: Record<string, unknown>) {
  const parsed = parseRcWebhookBody({
    api_version: '1.0',
    event: {
      id: 'evt-0001',
      type: 'INITIAL_PURCHASE',
      app_user_id: 'firebaseUid123',
      original_app_user_id: 'firebaseUid123',
      product_id: 'com.techtactoe.kok.pro.weekly',
      entitlement_ids: ['pro'],
      period_type: 'NORMAL',
      purchased_at_ms: NOW - 1000,
      expiration_at_ms: NOW + 7 * DAY,
      event_timestamp_ms: NOW,
      store: 'APP_STORE',
      environment: 'SANDBOX',
      ...patch,
    },
  });
  assert.ok(parsed);
  return parsed;
}

function applied(action: RcAction): Extract<RcAction, { kind: 'apply' }> {
  assert.equal(action.kind, 'apply');
  return action as Extract<RcAction, { kind: 'apply' }>;
}

test('authorization is an exact Bearer match', () => {
  assert.equal(isAuthorizedRevenueCat('Bearer s3cret-value', 's3cret-value'), true);
  assert.equal(isAuthorizedRevenueCat('Bearer wrong', 's3cret-value'), false);
  // RevenueCat sends the dashboard value verbatim, so a bare secret is valid too.
  assert.equal(isAuthorizedRevenueCat('s3cret-value', 's3cret-value'), true);
  assert.equal(isAuthorizedRevenueCat('  s3cret-value  ', 's3cret-value'), true);
  assert.equal(isAuthorizedRevenueCat('wrong', 's3cret-value'), false);
  assert.equal(isAuthorizedRevenueCat('Bearer Bearer s3cret-value', 's3cret-value'), false);
  assert.equal(isAuthorizedRevenueCat(undefined, 's3cret-value'), false);
  assert.equal(isAuthorizedRevenueCat('Bearer ', ''), false);
});

test('weekly purchase grants the weekly allowance and mirrors pro', () => {
  const a = applied(planRcEvent(event({}), NOW));
  assert.equal(a.uid, 'firebaseUid123');
  assert.deepEqual(a.grant, { credits: PLAN_ALLOWANCE.weekly.credits, reason: 'plan_allowance', refId: 'rc:evt-0001' });
  assert.equal(a.entitlement?.pro, true);
  assert.equal(a.entitlement?.plan, 'weekly');
  assert.equal(a.entitlement?.expiresAt, NOW + 7 * DAY);
  assert.equal(a.entitlement?.allowance, null);
});

test('monthly purchase grants the monthly allowance', () => {
  const a = applied(planRcEvent(event({ product_id: 'com.techtactoe.kok.pro.monthly', expiration_at_ms: NOW + 30 * DAY }), NOW));
  assert.equal(a.grant?.credits, PLAN_ALLOWANCE.monthly.credits);
  assert.equal(a.entitlement?.plan, 'monthly');
  assert.equal(a.entitlement?.allowance, null);
});

test('annual purchase/renewal grants the initial amount and schedules the weekly top-up', () => {
  for (const type of ['INITIAL_PURCHASE', 'RENEWAL']) {
    const a = applied(
      planRcEvent(event({ type, product_id: 'com.techtactoe.kok.pro.annual', expiration_at_ms: NOW + 365 * DAY }), NOW),
    );
    assert.equal(a.grant?.credits, PLAN_ALLOWANCE.annual.initial);
    assert.equal(a.entitlement?.plan, 'annual');
    assert.deepEqual(a.entitlement?.allowance, { anchorAt: NOW - 1000, week: 1, nextAt: NOW - 1000 + WEEK_MS });
  }
});

test('the gift annual product maps to the annual plan and redeems the gift', () => {
  const a = applied(planRcEvent(event({ product_id: 'com.techtactoe.kok.pro.annual.gift', expiration_at_ms: NOW + 365 * DAY }), NOW));
  assert.equal(a.entitlement?.plan, 'annual');
  assert.equal(a.grant?.credits, PLAN_ALLOWANCE.annual.initial);
  assert.equal(a.giftOfferingRedeemed, true);
});

test('plan grants come from PLAN_ALLOWANCE only', () => {
  assert.equal(planGrantCredits('weekly'), PLAN_ALLOWANCE.weekly.credits);
  assert.equal(planGrantCredits('monthly'), PLAN_ALLOWANCE.monthly.credits);
  assert.equal(planGrantCredits('annual'), PLAN_ALLOWANCE.annual.initial);
});

test('a TRIAL period type gets no special handling (there is no trial): the normal plan grant applies', () => {
  const a = applied(planRcEvent(event({ period_type: 'TRIAL' }), NOW));
  assert.equal(a.grant?.credits, PLAN_ALLOWANCE.weekly.credits);
});

test('product change mirrors the new plan without granting (the following RENEWAL grants)', () => {
  const a = applied(
    planRcEvent(event({ type: 'PRODUCT_CHANGE', product_id: 'com.techtactoe.kok.pro.weekly', new_product_id: 'com.techtactoe.kok.pro.annual' }), NOW),
  );
  assert.equal(a.entitlement?.plan, 'annual');
  assert.equal(a.grant, null);
});

test('credit packs grant their credits and leave the entitlement alone', () => {
  for (const pack of CREDIT_PACKS) {
    for (const product of [`com.techtactoe.kok.${pack.id}`, pack.id]) {
      const a = applied(planRcEvent(event({ type: 'NON_RENEWING_PURCHASE', product_id: product, entitlement_ids: [] }), NOW));
      assert.deepEqual(a.grant, { credits: pack.credits, reason: 'credit_pack', refId: 'rc:evt-0001' });
      assert.equal(a.entitlement, null);
    }
  }
  assert.deepEqual(planRcEvent(event({ type: 'NON_RENEWING_PURCHASE', product_id: 'credits_100', entitlement_ids: [] }), NOW), {
    kind: 'ignore',
    reason: 'unknown_product',
  });
});

test('expiration turns pro off; cancellation keeps pro until the period ends', () => {
  const expired = applied(planRcEvent(event({ type: 'EXPIRATION', expiration_at_ms: NOW - 1 }), NOW));
  assert.equal(expired.grant, null);
  assert.equal(expired.entitlement?.pro, false);
  assert.equal(expired.entitlement?.allowance, null);

  const canceled = applied(planRcEvent(event({ type: 'CANCELLATION', expiration_at_ms: NOW + DAY }), NOW));
  assert.equal(canceled.grant, null);
  assert.equal(canceled.entitlement?.pro, true);

  const refunded = applied(planRcEvent(event({ type: 'CANCELLATION', expiration_at_ms: NOW - DAY }), NOW));
  assert.equal(refunded.entitlement?.pro, false);
});

test('ignores test events, anonymous users, unknown products and unsupported types', () => {
  assert.deepEqual(planRcEvent(event({ type: 'TEST' }), NOW), { kind: 'ignore', reason: 'test' });
  assert.deepEqual(
    planRcEvent(event({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: '$RCAnonymousID:abc', aliases: [] }), NOW),
    { kind: 'ignore', reason: 'unknown_user' },
  );
  assert.deepEqual(planRcEvent(event({ product_id: 'com.techtactoe.kok.sticker_pack' }), NOW), {
    kind: 'ignore',
    reason: 'unknown_product',
  });
  assert.deepEqual(planRcEvent(event({ type: 'INVOICE_ISSUANCE' }), NOW), { kind: 'ignore', reason: 'unsupported_type' });
});

test('an anonymous purchaser resolves to the Firebase uid alias', () => {
  const a = applied(
    planRcEvent(
      event({
        app_user_id: '$RCAnonymousID:abc',
        original_app_user_id: '$RCAnonymousID:abc',
        aliases: ['$RCAnonymousID:abc', 'realUid42'],
      }),
      NOW,
    ),
  );
  assert.equal(a.uid, 'realUid42');
});

test('wheel-prize offering purchases are flagged for gift redemption', () => {
  assert.equal(applied(planRcEvent(event({ product_id: 'com.techtactoe.kok.pro.annual.gift' }), NOW)).giftOfferingRedeemed, true);
  assert.equal(applied(planRcEvent(event({}), NOW)).giftOfferingRedeemed, false);
});

test('malformed bodies are rejected', () => {
  assert.equal(parseRcWebhookBody(null), null);
  assert.equal(parseRcWebhookBody({ event: { type: 'RENEWAL' } }), null);
  assert.equal(parseRcWebhookBody({ event: { id: '../etc', type: 'RENEWAL' } }), null);
});

test('idempotency: an already-processed event id is skipped', () => {
  assert.equal(decideRcProcessing(false), 'process');
  assert.equal(decideRcProcessing(true), 'skip');
});

test('an older event never overwrites a newer entitlement mirror', () => {
  assert.equal(shouldMirrorEvent(undefined, NOW), true);
  assert.equal(shouldMirrorEvent(NOW - 1, NOW), true);
  assert.equal(shouldMirrorEvent(NOW + 1, NOW), false);
});

test('weekly top-up for annual is due inside the paid period and skips the renewal week', () => {
  const anchor = Date.UTC(2026, 0, 31);
  const entitlement = {
    pro: true,
    plan: 'annual',
    expiresAt: anchor + 365 * DAY,
    allowanceAnchorAt: anchor,
    allowanceWeek: 1,
    nextAllowanceAt: addWeeks(anchor, 1),
  };
  assert.equal(isAllowanceDue(entitlement, addWeeks(anchor, 1) - 1), false);
  assert.equal(isAllowanceDue(entitlement, addWeeks(anchor, 1) + 1), true);
  assert.deepEqual(advanceAllowance(entitlement), { allowanceWeek: 2, nextAllowanceAt: addWeeks(anchor, 2) });
  // A top-up landing within 12 h of the yearly renewal is skipped (the renewal grants instead).
  const last = { ...entitlement, allowanceWeek: 52, nextAllowanceAt: anchor + 365 * DAY - 60_000 };
  assert.equal(isAllowanceDue(last, anchor + 365 * DAY - 30_000), false);
  assert.equal(isAllowanceDue({ ...entitlement, pro: false }, addWeeks(anchor, 2)), false);
  assert.equal(isAllowanceDue({ ...entitlement, plan: 'monthly' }, addWeeks(anchor, 2)), false);
  assert.equal(isAllowanceDue({ ...entitlement, expiresAt: addWeeks(anchor, 1) }, addWeeks(anchor, 1) + 1), false);
});

test('restore on a new account: TRANSFER moves the entitlement to the new uid', () => {
  const transfer = planRcEvent(
    event({
      type: 'TRANSFER',
      app_user_id: undefined,
      product_id: undefined,
      transferred_from: ['$RCAnonymousID:old', 'oldUid1'],
      transferred_to: ['newUid2'],
    }),
    NOW,
  );
  assert.deepEqual(transfer, { kind: 'transfer', eventId: 'evt-0001', fromUids: ['oldUid1'], toUid: 'newUid2', eventAt: NOW });
  assert.deepEqual(
    planRcEvent(event({ type: 'TRANSFER', transferred_from: ['$RCAnonymousID:x'], transferred_to: ['newUid2'] }), NOW),
    { kind: 'ignore', reason: 'unknown_user' },
  );
});

test('the active, longest-running source mirror is the one that moves', () => {
  const weekly = { pro: true, plan: 'weekly', productId: 'w', expiresAt: NOW + DAY, lastEventAt: 5, updatedAt: 6 };
  const annual = { pro: true, plan: 'annual', productId: 'a', expiresAt: NOW + 300 * DAY, allowanceWeek: 3 };
  const expired = { pro: true, plan: 'annual', productId: 'x', expiresAt: NOW - 1 };
  assert.deepEqual(pickTransferredEntitlement([weekly, annual, expired, undefined], NOW), {
    pro: true,
    plan: 'annual',
    productId: 'a',
    expiresAt: NOW + 300 * DAY,
    allowanceWeek: 3,
  });
  assert.equal(pickTransferredEntitlement([expired, { pro: false }], NOW), null);
  // Bookkeeping fields never move.
  assert.equal('lastEventAt' in (pickTransferredEntitlement([weekly], NOW) ?? {}), false);
});
