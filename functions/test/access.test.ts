import assert from 'node:assert/strict';
import test from 'node:test';

import { hasConsent, isProActive } from '../src/lib/access.js';

test('consent and entitlement gates', () => {
  assert.equal(hasConsent({ version: 1, acceptedAt: 1 }), true);
  assert.equal(hasConsent({ version: 0 }), false);
  assert.equal(hasConsent(undefined), false);
  const now = 1_000;
  assert.equal(isProActive({ pro: true, expiresAt: now + 1 }, now), true);
  assert.equal(isProActive({ pro: true, expiresAt: now - 1 }, now), false);
  assert.equal(isProActive({ pro: true, expiresAt: null }, now), true);
  assert.equal(isProActive({ pro: 'true' }, now), false);
  assert.equal(isProActive(undefined, now), false);
});
