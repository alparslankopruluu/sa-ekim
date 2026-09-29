import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFalWebhookUrl, createRenderToken, verifyRenderToken } from '../src/lib/render-token.js';

const SALT = 'unit-test-salt-not-a-real-secret';
const UID = 'uidABC123';
const RENDER = '3f0e8a52-1a7b-4f7e-9f55-0f1f5e1c2d3a';

test('a token verifies only for its own salt, uid and render', () => {
  const token = createRenderToken(SALT, UID, RENDER);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(verifyRenderToken(SALT, UID, RENDER, token), true);
  assert.equal(verifyRenderToken('other-salt', UID, RENDER, token), false);
  assert.equal(verifyRenderToken(SALT, 'someoneElse', RENDER, token), false);
  assert.equal(verifyRenderToken(SALT, UID, '00000000-0000-4000-8000-000000000000', token), false);
});

test('malformed or missing tokens are rejected without throwing', () => {
  for (const bad of [undefined, null, 42, '', 'short', `${createRenderToken(SALT, UID, RENDER)}x`, ['a']]) {
    assert.equal(verifyRenderToken(SALT, UID, RENDER, bad), false);
  }
  assert.equal(verifyRenderToken('', UID, RENDER, createRenderToken(SALT, UID, RENDER)), false);
});

test('webhook URL carries uid, renderId and token as query parameters', () => {
  const token = createRenderToken(SALT, UID, RENDER);
  const url = new URL(buildFalWebhookUrl('https://us-central1-belto-dev.cloudfunctions.net/falWebhook', UID, RENDER, token));
  assert.equal(url.origin + url.pathname, 'https://us-central1-belto-dev.cloudfunctions.net/falWebhook');
  assert.equal(url.searchParams.get('uid'), UID);
  assert.equal(url.searchParams.get('renderId'), RENDER);
  assert.equal(verifyRenderToken(SALT, UID, RENDER, url.searchParams.get('t')), true);
});
