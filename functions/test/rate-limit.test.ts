import assert from 'node:assert/strict';
import test from 'node:test';

import { decideRenderRateLimit, decideStepRateLimit, RENDER_LIMITS, STEP_LIMITS } from '../src/lib/rate-limit.js';

test('renders: at most 3 concurrent non-terminal renders', () => {
  assert.equal(RENDER_LIMITS.maxActive, 3);
  assert.equal(decideRenderRateLimit({ active: 2, recent: 2 }), 'ok');
  assert.equal(decideRenderRateLimit({ active: 3, recent: 3 }), 'rate_limited');
});

test('renders: at most 30 per rolling 24 h', () => {
  assert.equal(RENDER_LIMITS.maxPerWindow, 30);
  assert.equal(RENDER_LIMITS.windowMs, 24 * 60 * 60 * 1000);
  assert.equal(decideRenderRateLimit({ active: 0, recent: 29 }), 'ok');
  assert.equal(decideRenderRateLimit({ active: 0, recent: 30 }), 'rate_limited');
});

test('paid steps have hourly caps', () => {
  assert.equal(decideStepRateLimit(STEP_LIMITS.createPoster.max - 1, STEP_LIMITS.createPoster), 'ok');
  assert.equal(decideStepRateLimit(STEP_LIMITS.createPoster.max, STEP_LIMITS.createPoster), 'rate_limited');
  assert.equal(decideStepRateLimit(0, STEP_LIMITS.composeSong), 'ok');
});
