import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFalWebhookUrl, createPreviewToken, verifyPreviewToken } from '../src/lib/preview-token.js';

const SALT = 'test-salt-not-a-secret';
const UID = 'uid123';
const ID = '8a6f2c1e-4b3d-4e5f-9a7b-1c2d3e4f5a6b';

test('a token verifies only for the exact uid + preview it was made for', () => {
  const token = createPreviewToken(SALT, UID, ID);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(verifyPreviewToken(SALT, UID, ID, token), true);
  assert.equal(verifyPreviewToken(SALT, 'other', ID, token), false);
  assert.equal(verifyPreviewToken(SALT, UID, '00000000-0000-4000-8000-000000000000', token), false);
  assert.equal(verifyPreviewToken('other-salt', UID, ID, token), false);
});

test('malformed tokens and an empty salt are rejected', () => {
  for (const token of [undefined, null, 42, '', 'short', `${createPreviewToken(SALT, UID, ID)}x`]) {
    assert.equal(verifyPreviewToken(SALT, UID, ID, token), false);
  }
  assert.equal(verifyPreviewToken('', UID, ID, createPreviewToken(SALT, UID, ID)), false);
  assert.throws(() => createPreviewToken('', UID, ID));
});

test('the webhook URL carries uid, previewId and token as query parameters', () => {
  const token = createPreviewToken(SALT, UID, ID);
  const url = new URL(buildFalWebhookUrl('https://us-central1-kok-dev.cloudfunctions.net/falWebhook', UID, ID, token));
  assert.equal(url.searchParams.get('uid'), UID);
  assert.equal(url.searchParams.get('previewId'), ID);
  assert.equal(url.searchParams.get('t'), token);
});
