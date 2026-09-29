import assert from 'node:assert/strict';
import test from 'node:test';

import { decidePreviewRateLimit, PREVIEW_LIMITS } from '../src/lib/rate-limit.js';

test('limits are 10 previews per hour and at most 2 active', () => {
  assert.equal(PREVIEW_LIMITS.maxPerWindow, 10);
  assert.equal(PREVIEW_LIMITS.maxActive, 2);
  assert.equal(PREVIEW_LIMITS.windowMs, 60 * 60 * 1000);
});

test('below both limits is ok', () => {
  assert.equal(decidePreviewRateLimit({ active: 0, recent: 0 }), 'ok');
  assert.equal(decidePreviewRateLimit({ active: 1, recent: 9 }), 'ok');
});

test('a third simultaneous preview is rate limited', () => {
  assert.equal(decidePreviewRateLimit({ active: 2, recent: 2 }), 'rate_limited');
});

test('the eleventh preview inside an hour is rate limited', () => {
  assert.equal(decidePreviewRateLimit({ active: 0, recent: 10 }), 'rate_limited');
  assert.equal(decidePreviewRateLimit({ active: 0, recent: 11 }), 'rate_limited');
});
