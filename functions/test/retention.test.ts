import assert from 'node:assert/strict';
import test from 'node:test';

import { PREVIEW_RETENTION_MS, SELFIE_TTL_MS } from '../src/config.js';
import { isExpiredMedia, isGiftTokenExpired, isStuckPreview } from '../src/lib/retention.js';
import { PREVIEW_RETENTION_DAYS } from '../src/shared/api.js';

test('the selfie window follows the retention promise (30 days for selfie and result)', () => {
  assert.equal(PREVIEW_RETENTION_DAYS, 30);
  assert.equal(SELFIE_TTL_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(PREVIEW_RETENTION_MS, SELFIE_TTL_MS);
});

test('retention: a selfie older than 30 days expires, a younger one and unknown ages are kept', () => {
  const now = Date.UTC(2026, 8, 26, 12);
  assert.equal(isExpiredMedia(new Date(now - SELFIE_TTL_MS - 1).toISOString(), now, SELFIE_TTL_MS), true);
  assert.equal(isExpiredMedia(new Date(now - SELFIE_TTL_MS + 60_000).toISOString(), now, SELFIE_TTL_MS), false);
  assert.equal(isExpiredMedia(new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString(), now, SELFIE_TTL_MS), false);
  assert.equal(isExpiredMedia(undefined, now, SELFIE_TTL_MS), false);
  assert.equal(isExpiredMedia('not a date', now, SELFIE_TTL_MS), false);
});

test('stuck previews: 30 min for in-flight work, longer once finalizing', () => {
  const now = 10_000_000;
  const limits = { stuckMs: 30 * 60_000, finalizingMs: 45 * 60_000 };
  assert.equal(isStuckPreview({ status: 'queued', createdAt: now - 31 * 60_000, updatedAt: now }, now, limits), true);
  assert.equal(isStuckPreview({ status: 'processing', createdAt: now - 31 * 60_000, updatedAt: now }, now, limits), true);
  assert.equal(isStuckPreview({ status: 'queued', createdAt: now - 29 * 60_000, updatedAt: now }, now, limits), false);
  assert.equal(isStuckPreview({ status: 'finalizing', createdAt: now - 60 * 60_000, updatedAt: now - 10 * 60_000 }, now, limits), false);
  assert.equal(isStuckPreview({ status: 'finalizing', createdAt: now - 60 * 60_000, updatedAt: now - 50 * 60_000 }, now, limits), true);
  assert.equal(isStuckPreview({ status: 'succeeded', createdAt: 0, updatedAt: 0 }, now, limits), false);
  assert.equal(isStuckPreview({ status: 'failed', createdAt: 0, updatedAt: 0 }, now, limits), false);
});

test('gift tokens expire only when unredeemed, freeHigh and past their window', () => {
  const now = 5_000;
  assert.equal(isGiftTokenExpired({ prizeId: 'freeHigh', redeemedAt: null, tokenExpiresAt: now }, now), true);
  assert.equal(isGiftTokenExpired({ prizeId: 'freeHigh', redeemedAt: null, tokenExpiresAt: now + 1 }, now), false);
  assert.equal(isGiftTokenExpired({ prizeId: 'freeHigh', redeemedAt: 4_000, tokenExpiresAt: now - 1 }, now), false);
  assert.equal(isGiftTokenExpired({ prizeId: 'credits5', redeemedAt: null, tokenExpiresAt: now - 1 }, now), false);
  assert.equal(isGiftTokenExpired({ prizeId: 'freeHigh', redeemedAt: null, tokenExpiresAt: null }, now), false);
});
