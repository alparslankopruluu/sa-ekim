import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCharge,
  applyRefund,
  EMPTY_WALLET,
  isTokenUsable,
  NO_CHARGE,
  normalizeWallet,
  planRenderCharge,
  planStepCharge,
  renderReservation,
  settleRender,
} from '../src/lib/ledger.js';
import type { WalletDoc } from '../src/shared/api.js';
import { renderCost } from '../src/shared/pricing.js';

const wallet = (patch: Partial<WalletDoc> = {}): WalletDoc => ({ ...EMPTY_WALLET, ...patch });

test('full renders reserve the 15 s price up front; previews reserve nothing', () => {
  assert.equal(renderReservation('full', '768p'), 15 * 4);
  assert.equal(renderReservation('full', '480p'), 15 * 2);
  assert.equal(renderReservation('full', '2k'), 15 * 13);
  assert.equal(renderReservation('preview', '480p'), 0);
});

test('settlement charges the actual seconds and refunds the rest of the reservation', () => {
  const reserved = renderReservation('full', '768p'); // 60
  const s = settleRender({
    purpose: 'full',
    billingResolution: '768p',
    reservedCredits: reserved,
    actualSeconds: 11.2,
    fallbackSeconds: 15,
  });
  assert.equal(s.billedSeconds, 12); // started seconds round up
  assert.equal(s.chargedCredits, renderCost('768p', 12));
  assert.equal(s.chargedCredits, 48);
  assert.equal(s.refundCredits, 12);
  assert.equal(s.chargedCredits + s.refundCredits, reserved);
});

test('settlement never charges more than was reserved (audio longer than 15 s)', () => {
  const reserved = renderReservation('full', '1080p');
  const s = settleRender({
    purpose: 'full',
    billingResolution: '1080p',
    reservedCredits: reserved,
    actualSeconds: 42,
    fallbackSeconds: 15,
  });
  assert.equal(s.billedSeconds, 15);
  assert.equal(s.chargedCredits, reserved);
  assert.equal(s.refundCredits, 0);
});

test('settlement clamps very short output to the 2 s minimum', () => {
  const s = settleRender({
    purpose: 'full',
    billingResolution: '480p',
    reservedCredits: 30,
    actualSeconds: 0.4,
    fallbackSeconds: 15,
  });
  assert.equal(s.billedSeconds, 2);
  assert.equal(s.chargedCredits, 4);
  assert.equal(s.refundCredits, 26);
});

test('settlement falls back to the expected length when the duration is unknown', () => {
  const s = settleRender({
    purpose: 'full',
    billingResolution: '768p',
    reservedCredits: 60,
    actualSeconds: null,
    fallbackSeconds: 10,
  });
  assert.equal(s.billedSeconds, 10);
  assert.equal(s.chargedCredits, 40);
  assert.equal(s.refundCredits, 20);
});

test('hdBoost renders settle at the 768p billing price', () => {
  const s = settleRender({
    purpose: 'full',
    billingResolution: '768p',
    reservedCredits: renderReservation('full', '768p'),
    actualSeconds: 12,
    fallbackSeconds: 15,
  });
  assert.equal(s.chargedCredits, 12 * 4);
});

test('previews are always free', () => {
  const s = settleRender({
    purpose: 'preview',
    billingResolution: '480p',
    reservedCredits: 0,
    actualSeconds: 5,
    fallbackSeconds: 5,
  });
  assert.deepEqual([s.chargedCredits, s.refundCredits], [0, 0]);
});

test('step charges: credits, won token, insufficient balance', () => {
  assert.deepEqual(planStepCharge(wallet({ balance: 5 }), { cost: 3, useFreePosterToken: false, tokenUsable: true }), {
    ok: true,
    charge: { ...NO_CHARGE, credits: 3 },
  });
  assert.deepEqual(planStepCharge(wallet({ balance: 2 }), { cost: 3, useFreePosterToken: false, tokenUsable: true }), {
    ok: false,
    code: 'insufficient_credits',
  });
  assert.deepEqual(
    planStepCharge(wallet({ freePosterTokens: 1 }), { cost: 3, useFreePosterToken: true, tokenUsable: true }),
    { ok: true, charge: { ...NO_CHARGE, freePosterTokens: 1 } },
  );
  assert.deepEqual(planStepCharge(wallet(), { cost: 3, useFreePosterToken: true, tokenUsable: true }), {
    ok: false,
    code: 'invalid_input',
  });
  assert.deepEqual(
    planStepCharge(wallet({ freePosterTokens: 1 }), { cost: 3, useFreePosterToken: true, tokenUsable: false }),
    { ok: false, code: 'invalid_input' },
  );
});

test('render charges: preview once, hdBoost token, balance check', () => {
  const base = { billingResolution: '768p' as const, useHdBoostToken: false, hdTokenUsable: true };
  assert.deepEqual(planRenderCharge(wallet(), { ...base, purpose: 'preview' }), {
    ok: true,
    charge: { ...NO_CHARGE, previewSlot: true },
  });
  assert.deepEqual(planRenderCharge(wallet({ previewUsed: true }), { ...base, purpose: 'preview' }), {
    ok: false,
    code: 'already_claimed',
  });
  assert.deepEqual(planRenderCharge(wallet({ balance: 59 }), { ...base, purpose: 'full' }), {
    ok: false,
    code: 'insufficient_credits',
  });
  assert.deepEqual(planRenderCharge(wallet({ balance: 60, hdBoostTokens: 1 }), { ...base, purpose: 'full', useHdBoostToken: true }), {
    ok: true,
    charge: { ...NO_CHARGE, credits: 60, hdBoostTokens: 1 },
  });
  assert.deepEqual(planRenderCharge(wallet({ balance: 60 }), { ...base, purpose: 'full', useHdBoostToken: true }), {
    ok: false,
    code: 'invalid_input',
  });
});

test('a refund returns exactly what a charge took (credits, tokens, preview slot)', () => {
  const start = wallet({ balance: 100, freePosterTokens: 1, hdBoostTokens: 1 });
  const charge = { credits: 60, freePosterTokens: 0, hdBoostTokens: 1, previewSlot: false };
  const charged = applyCharge(start, charge);
  assert.equal(charged.balance, 40);
  assert.equal(charged.hdBoostTokens, 0);
  assert.deepEqual(applyRefund(charged, charge), start);

  const previewCharge = { ...NO_CHARGE, previewSlot: true };
  const afterPreview = applyCharge(start, previewCharge);
  assert.equal(afterPreview.previewUsed, true);
  assert.equal(applyRefund(afterPreview, previewCharge).previewUsed, false);
});

test('won tokens expire with their prize; other tokens never do', () => {
  const now = 1_000_000;
  assert.equal(isTokenUsable({ prizeId: 'hdBoost', expiresAt: now + 1 }, 'hdBoost', now), true);
  assert.equal(isTokenUsable({ prizeId: 'hdBoost', expiresAt: now - 1 }, 'hdBoost', now), false);
  assert.equal(isTokenUsable({ prizeId: 'credits20', expiresAt: now - 1 }, 'hdBoost', now), true);
  assert.equal(isTokenUsable(undefined, 'freePoster', now), true);
});

test('wallet normalization tolerates missing or malformed fields', () => {
  assert.deepEqual(normalizeWallet(undefined), EMPTY_WALLET);
  assert.deepEqual(normalizeWallet({ balance: 12.9, freePosterTokens: -1, previewUsed: 'yes' }), {
    ...EMPTY_WALLET,
    balance: 12,
  });
});
