import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCharge,
  applyRefund,
  EMPTY_WALLET,
  isTokenUsable,
  NO_CHARGE,
  normalizeCharge,
  normalizeWallet,
  planPreviewCharge,
} from '../src/lib/ledger.js';
import type { WalletDoc } from '../src/shared/api.js';
import { previewCost } from '../src/shared/pricing.js';

const wallet = (patch: Partial<WalletDoc> = {}): WalletDoc => ({ ...EMPTY_WALLET, ...patch });
const base = { onboarding: false, useFreeHighToken: false, tokenUsable: true };

test('a standard preview reserves previewCost(standard), a high one previewCost(high)', () => {
  const standard = planPreviewCharge(wallet({ balance: 10 }), { ...base, quality: 'standard' });
  assert.deepEqual(standard, { ok: true, charge: { ...NO_CHARGE, credits: previewCost('standard') }, quality: 'standard' });
  const high = planPreviewCharge(wallet({ balance: 10 }), { ...base, quality: 'high' });
  assert.deepEqual(high, { ok: true, charge: { ...NO_CHARGE, credits: previewCost('high') }, quality: 'high' });
});

test('not enough credits is insufficient_credits and nothing is planned', () => {
  const need = previewCost('high');
  assert.deepEqual(planPreviewCharge(wallet({ balance: need - 1 }), { ...base, quality: 'high' }), {
    ok: false,
    code: 'insufficient_credits',
  });
  assert.equal(planPreviewCharge(wallet({ balance: need }), { ...base, quality: 'high' }).ok, true);
});

test('the onboarding preview is free, standard-only and once per account', () => {
  const first = planPreviewCharge(wallet(), { ...base, onboarding: true, quality: 'high' });
  assert.deepEqual(first, { ok: true, charge: { ...NO_CHARGE, previewSlot: true }, quality: 'standard' });
  assert.deepEqual(planPreviewCharge(wallet({ previewUsed: true, balance: 99 }), { ...base, onboarding: true, quality: 'standard' }), {
    ok: false,
    code: 'already_claimed',
  });
  // Never debits the wallet, even a rich one.
  const rich = wallet({ balance: 50 });
  const planned = planPreviewCharge(rich, { ...base, onboarding: true, quality: 'standard' });
  assert.ok(planned.ok);
  assert.equal(applyCharge(rich, planned.charge).balance, 50);
  assert.equal(applyCharge(rich, planned.charge).previewUsed, true);
});

test('the onboarding preview cannot also spend a free-high token', () => {
  assert.deepEqual(
    planPreviewCharge(wallet({ freeHighTokens: 1 }), { ...base, onboarding: true, useFreeHighToken: true, quality: 'high' }),
    { ok: false, code: 'invalid_input' },
  );
});

test('a free-high token pays for one high preview and only a high one', () => {
  const planned = planPreviewCharge(wallet({ freeHighTokens: 1 }), { ...base, useFreeHighToken: true, quality: 'high' });
  assert.deepEqual(planned, { ok: true, charge: { ...NO_CHARGE, freeHighTokens: 1 }, quality: 'high' });
  assert.deepEqual(planPreviewCharge(wallet({ freeHighTokens: 1 }), { ...base, useFreeHighToken: true, quality: 'standard' }), {
    ok: false,
    code: 'invalid_input',
  });
  assert.deepEqual(planPreviewCharge(wallet({ freeHighTokens: 0 }), { ...base, useFreeHighToken: true, quality: 'high' }), {
    ok: false,
    code: 'invalid_input',
  });
  assert.deepEqual(
    planPreviewCharge(wallet({ freeHighTokens: 1 }), { ...base, useFreeHighToken: true, quality: 'high', tokenUsable: false }),
    { ok: false, code: 'invalid_input' },
  );
});

test('a token preview leaves the credit balance untouched', () => {
  const w = wallet({ balance: 4, freeHighTokens: 1 });
  const planned = planPreviewCharge(w, { ...base, useFreeHighToken: true, quality: 'high' });
  assert.ok(planned.ok);
  const after = applyCharge(w, planned.charge);
  assert.equal(after.balance, 4);
  assert.equal(after.freeHighTokens, 0);
});

test('charge then refund restores the wallet exactly (credits, token and onboarding slot)', () => {
  const start = wallet({ balance: 7, freeHighTokens: 1, previewUsed: false });
  for (const charge of [
    { ...NO_CHARGE, credits: 3 },
    { ...NO_CHARGE, freeHighTokens: 1 },
    { ...NO_CHARGE, previewSlot: true },
  ]) {
    assert.deepEqual(applyRefund(applyCharge(start, charge), charge), start);
  }
});

test('refunding a charge that never used the onboarding slot keeps previewUsed', () => {
  const used = wallet({ previewUsed: true });
  assert.equal(applyRefund(used, { ...NO_CHARGE, credits: 1 }).previewUsed, true);
});

test('normalizeWallet and normalizeCharge tolerate missing, partial and hostile data', () => {
  assert.deepEqual(normalizeWallet(undefined), EMPTY_WALLET);
  assert.deepEqual(normalizeWallet({ balance: -5, freeHighTokens: 'x', previewUsed: 'yes', updatedAt: 3.9 }), {
    balance: 0,
    freeHighTokens: 0,
    previewUsed: false,
    updatedAt: 3,
  });
  assert.deepEqual(normalizeCharge({ credits: 2.7, freeHighTokens: -1, previewSlot: true }), {
    credits: 2,
    freeHighTokens: 0,
    previewSlot: true,
  });
});

test('a won free-high token is usable until its prize expires; other gifts do not gate it', () => {
  const now = 1_000_000;
  assert.equal(isTokenUsable({ prizeId: 'freeHigh', expiresAt: now + 1 }, now), true);
  assert.equal(isTokenUsable({ prizeId: 'freeHigh', expiresAt: now }, now), false);
  assert.equal(isTokenUsable({ prizeId: 'freeHigh', expiresAt: now - 5 }, now), false);
  assert.equal(isTokenUsable({ prizeId: 'credits5', expiresAt: now - 5 }, now), true);
  assert.equal(isTokenUsable(undefined, now), true);
});
