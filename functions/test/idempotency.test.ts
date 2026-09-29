import assert from 'node:assert/strict';
import test from 'node:test';

import { decideReplay } from '../src/lib/idempotency.js';
import { NO_CHARGE } from '../src/lib/ledger.js';

const record = (patch: Record<string, unknown>) => ({
  kind: 'createPoster',
  status: 'done',
  charge: { ...NO_CHARGE, credits: 3 },
  refId: 'poster-id',
  response: { posterPath: 'posters/u/p.png' },
  errorCode: null,
  createdAt: 1,
  updatedAt: 2,
  ...patch,
});

test('no record → proceed (charge and run)', () => {
  assert.deepEqual(decideReplay(undefined, 'createPoster'), { action: 'proceed' });
});

test('done → replay the stored response without charging again', () => {
  const decision = decideReplay(record({}), 'createPoster');
  assert.equal(decision.action, 'replay');
  if (decision.action === 'replay') assert.deepEqual(decision.record.response, { posterPath: 'posters/u/p.png' });
});

test('failed → the same error again', () => {
  assert.deepEqual(decideReplay(record({ status: 'failed', errorCode: 'content_blocked', response: null }), 'createPoster'), {
    action: 'reject',
    code: 'content_blocked',
  });
});

test('pending step → retry shortly; pending render with a response → replay', () => {
  assert.deepEqual(decideReplay(record({ status: 'pending', response: null }), 'createPoster'), {
    action: 'reject',
    code: 'rate_limited',
  });
  const render = decideReplay(
    record({ kind: 'createRender', status: 'pending', response: { renderId: 'r', reservedCredits: 60 } }),
    'createRender',
  );
  assert.equal(render.action, 'replay');
});

test('a key reused for a different action is invalid input', () => {
  assert.deepEqual(decideReplay(record({ kind: 'composeSong' }), 'createPoster'), {
    action: 'reject',
    code: 'invalid_input',
  });
  assert.deepEqual(decideReplay({ garbage: true }, 'createPoster'), { action: 'reject', code: 'invalid_input' });
});
