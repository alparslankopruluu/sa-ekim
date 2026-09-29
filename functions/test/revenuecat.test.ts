import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMonthsUtc,
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
import { PLAN_ALLOWANCE, TRIAL_ALLOWANCE_CREDITS } from '../src/shared/pricing.js';

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
      product_id: 'app.belto.ios.pro.weekly',
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

test('annual purchase/renewal grants now and schedules the monthly allowance', () => {
  for (const type of ['INITIAL_PURCHASE', 'RENEWAL']) {
    const a = applied(
      planRcEvent(event({ type, product_id: 'app.belto.ios.pro.annual', expiration_at_ms: NOW + 365 * DAY }), NOW),
    );
    assert.equal(a.grant?.credits, PLAN_ALLOWANCE.annual.credits);
    assert.equal(a.entitlement?.plan, 'annual');
    assert.deepEqual(a.entitlement?.allowance, {
      anchorAt: NOW - 1000,
      month: 1,
      nextAt: addMonthsUtc(NOW - 1000, 1),
    });
  }
});

test('product change mirrors the new plan without granting (the following RENEWAL grants)', () => {
  const a = applied(
    planRcEvent(event({ type: 'PRODUCT_CHANGE', product_id: 'app.belto.ios.pro.weekly', new_product_id: 'app.belto.ios.pro.annual' }), NOW),
  );
  assert.equal(a.entitlement?.plan, 'annual');
  assert.equal(a.grant, null);
});

test('a free-trial start grants only the trial allowance; the first paid renewal grants the plan allowance', () => {
  const trial = applied(
    planRcEvent(event({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL', product_id: 'app.belto.ios.pro.annual', expiration_at_ms: NOW + 3 * DAY }), NOW),
  );
  assert.equal(trial.grant?.credits, TRIAL_ALLOWANCE_CREDITS);
  assert.equal(trial.entitlement?.pro, true);
  const paid = applied(
    planRcEvent(event({ id: 'evt-0002', type: 'RENEWAL', period_type: 'NORMAL', product_id: 'app.belto.ios.pro.annual', expiration_at_ms: NOW + 365 * DAY }), NOW),
  );
  assert.equal(paid.grant?.credits, PLAN_ALLOWANCE.annual.credits);
});

test('credit packs grant their credits and leave the entitlement alone', () => {
  for (const [product, credits] of [
    ['app.belto.ios.credits_100', 100],
    ['credits_300', 300],
    ['app.belto.ios.credits_800', 800],
  ] as const) {
    const a = applied(planRcEvent(event({ type: 'NON_RENEWING_PURCHASE', product_id: product, entitlement_ids: [] }), NOW));
    assert.deepEqual(a.grant, { credits, reason: 'credit_pack', refId: 'rc:evt-0001' });
    assert.equal(a.entitlement, null);
  }
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
  assert.deepEqual(planRcEvent(event({ product_id: 'app.belto.ios.sticker_pack' }), NOW), {
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
  assert.equal(applied(planRcEvent(event({ product_id: 'app.belto.ios.pro.annual.gift' }), NOW)).giftOfferingRedeemed, true);
  assert.equal(applied(planRcEvent(event({ product_id: 'app.belto.ios.pro.annual.trial7' }), NOW)).giftOfferingRedeemed, true);
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

test('calendar months clamp to the end of shorter months without drifting', () => {
  const jan31 = Date.UTC(2026, 0, 31, 9, 30);
  assert.equal(new Date(addMonthsUtc(jan31, 1)).toISOString(), '2026-02-28T09:30:00.000Z');
  assert.equal(new Date(addMonthsUtc(jan31, 2)).toISOString(), '2026-03-31T09:30:00.000Z');
  assert.equal(new Date(addMonthsUtc(jan31, 12)).toISOString(), '2027-01-31T09:30:00.000Z');
  assert.equal(new Date(addMonthsUtc(Date.UTC(2027, 10, 15), 3)).toISOString(), '2028-02-15T00:00:00.000Z');
});

test('monthly allowance is due inside the paid period and skips the renewal month', () => {
  const anchor = Date.UTC(2026, 0, 31);
  const entitlement = {
    pro: true,
    plan: 'annual',
    expiresAt: addMonthsUtc(anchor, 12),
    allowanceAnchorAt: anchor,
    allowanceMonth: 1,
    nextAllowanceAt: addMonthsUtc(anchor, 1),
  };
  assert.equal(isAllowanceDue(entitlement, addMonthsUtc(anchor, 1) - 1), false);
  assert.equal(isAllowanceDue(entitlement, addMonthsUtc(anchor, 1) + 1), true);
  const next = advanceAllowance(entitlement);
  assert.deepEqual(next, { allowanceMonth: 2, nextAllowanceAt: addMonthsUtc(anchor, 2) });
  // Month 12 coincides with the yearly renewal, which grants instead.
  const month12 = { ...entitlement, allowanceMonth: 12, nextAllowanceAt: addMonthsUtc(anchor, 12) };
  assert.equal(isAllowanceDue(month12, addMonthsUtc(anchor, 12) - 1000), false);
  assert.equal(isAllowanceDue({ ...entitlement, pro: false }, NOW), false);
  assert.equal(isAllowanceDue({ ...entitlement, plan: 'weekly' }, NOW), false);
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
  const annual = { pro: true, plan: 'annual', productId: 'a', expiresAt: NOW + 300 * DAY, allowanceMonth: 3 };
  const expired = { pro: true, plan: 'annual', productId: 'x', expiresAt: NOW - 1 };
  assert.deepEqual(pickTransferredEntitlement([weekly, annual, expired, undefined], NOW), {
    pro: true,
    plan: 'annual',
    productId: 'a',
    expiresAt: NOW + 300 * DAY,
    allowanceMonth: 3,
  });
  assert.equal(pickTransferredEntitlement([expired, { pro: false }], NOW), null);
  // Bookkeeping fields never move.
  assert.equal('lastEventAt' in (pickTransferredEntitlement([weekly], NOW) ?? {}), false);
});
