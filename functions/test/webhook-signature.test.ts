import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import test from 'node:test';

import {
  buildFalSignedMessage,
  type FalJwk,
  verifyFalWebhookSignature,
} from '../src/lib/webhook-signature.js';

function keyPair(): { jwk: FalJwk; privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const exported = publicKey.export({ format: 'jwk' }) as { kty: string; crv: string; x: string };
  return { jwk: { kty: exported.kty, crv: exported.crv, x: exported.x, kid: 'test' }, privateKey };
}

const NOW = 1_790_000_000;
const body = Buffer.from(JSON.stringify({ request_id: 'req-1', status: 'OK', payload: { video: { url: 'https://v3.fal.media/x.mp4' } } }));

function signedHeaders(privateKey: KeyObject, rawBody: Buffer, timestamp = NOW) {
  const h = { requestId: 'req-1', userId: 'fal-user-9', timestamp: String(timestamp), signature: '' };
  const signature = sign(null, buildFalSignedMessage(h, rawBody), privateKey).toString('hex');
  return {
    'x-fal-webhook-request-id': h.requestId,
    'x-fal-webhook-user-id': h.userId,
    'x-fal-webhook-timestamp': h.timestamp,
    'x-fal-webhook-signature': signature,
  };
}

test('the signed message is request id, user id, timestamp and the body sha256 (hex), newline-joined', () => {
  const message = buildFalSignedMessage({ requestId: 'a', userId: 'b', timestamp: '1', signature: '' }, body).toString();
  assert.equal(message, `a\nb\n1\n${createHash('sha256').update(body).digest('hex')}`);
});

test('accepts a valid signature', () => {
  const { jwk, privateKey } = keyPair();
  const result = verifyFalWebhookSignature({ headers: signedHeaders(privateKey, body), rawBody: body, keys: [jwk], nowSeconds: NOW + 10 });
  assert.deepEqual(result, { ok: true, requestId: 'req-1' });
});

test('accepts when any key in the JWKS matches (rotation)', () => {
  const old = keyPair();
  const current = keyPair();
  const result = verifyFalWebhookSignature({
    headers: signedHeaders(current.privateKey, body),
    rawBody: body,
    keys: [old.jwk, current.jwk],
    nowSeconds: NOW,
  });
  assert.equal(result.ok, true);
});

test('rejects a signature from another key', () => {
  const trusted = keyPair();
  const attacker = keyPair();
  const result = verifyFalWebhookSignature({
    headers: signedHeaders(attacker.privateKey, body),
    rawBody: body,
    keys: [trusted.jwk],
    nowSeconds: NOW,
  });
  assert.deepEqual(result, { ok: false, reason: 'bad_signature' });
});

test('rejects a tampered body', () => {
  const { jwk, privateKey } = keyPair();
  const headers = signedHeaders(privateKey, body);
  const tampered = Buffer.from(body.toString().replace('"OK"', '"ERROR"'));
  const result = verifyFalWebhookSignature({ headers, rawBody: tampered, keys: [jwk], nowSeconds: NOW });
  assert.deepEqual(result, { ok: false, reason: 'bad_signature' });
});

test('rejects stale (> 5 min) and far-future timestamps', () => {
  const { jwk, privateKey } = keyPair();
  const stale = verifyFalWebhookSignature({
    headers: signedHeaders(privateKey, body, NOW - 301),
    rawBody: body,
    keys: [jwk],
    nowSeconds: NOW,
  });
  assert.deepEqual(stale, { ok: false, reason: 'stale_timestamp' });
  const future = verifyFalWebhookSignature({
    headers: signedHeaders(privateKey, body, NOW + 301),
    rawBody: body,
    keys: [jwk],
    nowSeconds: NOW,
  });
  assert.deepEqual(future, { ok: false, reason: 'stale_timestamp' });
  const edge = verifyFalWebhookSignature({
    headers: signedHeaders(privateKey, body, NOW - 300),
    rawBody: body,
    keys: [jwk],
    nowSeconds: NOW,
  });
  assert.equal(edge.ok, true);
});

test('rejects missing headers, malformed signatures and an empty key set', () => {
  const { jwk, privateKey } = keyPair();
  const headers = signedHeaders(privateKey, body);
  const { ['x-fal-webhook-signature']: _omit, ...missing } = headers;
  assert.deepEqual(verifyFalWebhookSignature({ headers: missing, rawBody: body, keys: [jwk], nowSeconds: NOW }), {
    ok: false,
    reason: 'missing_headers',
  });
  assert.deepEqual(
    verifyFalWebhookSignature({
      headers: { ...headers, 'x-fal-webhook-signature': 'zz' },
      rawBody: body,
      keys: [jwk],
      nowSeconds: NOW,
    }),
    { ok: false, reason: 'malformed_signature' },
  );
  assert.deepEqual(verifyFalWebhookSignature({ headers, rawBody: body, keys: [], nowSeconds: NOW }), {
    ok: false,
    reason: 'no_keys',
  });
  assert.deepEqual(
    verifyFalWebhookSignature({ headers, rawBody: body, keys: [{ x: 'not-a-key' }], nowSeconds: NOW }),
    { ok: false, reason: 'no_keys' },
  );
});
