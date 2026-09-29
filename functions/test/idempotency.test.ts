import assert from 'node:assert/strict';
import test from 'node:test';

import { decideReplay, parseRequestRecord } from '../src/lib/idempotency.js';

const record = (patch: Record<string, unknown> = {}) => ({
  kind: 'createPreview',
  status: 'done',
  refId: 'p1',
  response: { previewId: 'p1', reservedCredits: 1 },
  errorCode: null,
  createdAt: 1,
  updatedAt: 2,
  ...patch,
});

test('no record means proceed', () => {
  assert.deepEqual(decideReplay(undefined), { action: 'proceed' });
  assert.deepEqual(decideReplay(null), { action: 'proceed' });
});

test('a done record replays the stored response (never charges twice)', () => {
  const decision = decideReplay(record());
  assert.equal(decision.action, 'replay');
  if (decision.action === 'replay') assert.deepEqual(decision.record.response, { previewId: 'p1', reservedCredits: 1 });
});

test('a pending record whose preview exists also replays', () => {
  assert.equal(decideReplay(record({ status: 'pending' })).action, 'replay');
});

test('a failed record repeats the same failure code; a new key is needed to retry', () => {
  assert.deepEqual(decideReplay(record({ status: 'failed', errorCode: 'provider_failed', response: null })), {
    action: 'reject',
    code: 'provider_failed',
  });
  assert.deepEqual(decideReplay(record({ status: 'failed', errorCode: 'not-a-code' })), { action: 'reject', code: 'unknown' });
});

test('a record for another action or a garbage record is invalid input', () => {
  assert.deepEqual(decideReplay(record({ kind: 'createPoster' })), { action: 'reject', code: 'invalid_input' });
  assert.deepEqual(decideReplay('nope'), { action: 'reject', code: 'invalid_input' });
});

test('a done record without a stored response is unknown, never a silent second charge', () => {
  assert.deepEqual(decideReplay(record({ response: null })), { action: 'reject', code: 'unknown' });
});

test('parseRequestRecord rejects unknown statuses and tolerates missing fields', () => {
  assert.equal(parseRequestRecord(record({ status: 'weird' })), null);
  const parsed = parseRequestRecord({ kind: 'createPreview', status: 'pending' });
  assert.deepEqual(parsed, {
    kind: 'createPreview',
    status: 'pending',
    refId: '',
    response: null,
    errorCode: null,
    createdAt: 0,
    updatedAt: 0,
  });
});
