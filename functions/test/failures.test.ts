import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../src/lib/errors.js';
import { classifyFailure, classifyWebhookFailure, failureCodeOf, ProviderError } from '../src/lib/failures.js';
import { isErrorCode } from '../src/shared/api.js';

test('content-checker rejections map to content_blocked', () => {
  assert.equal(classifyFailure({ status: 422, detail: 'Image flagged by content checker' }), 'content_blocked');
  assert.equal(classifyFailure({ detail: 'NSFW content detected' }), 'content_blocked');
});

test('timeouts map to timeout', () => {
  assert.equal(classifyFailure({ status: 504 }), 'timeout');
  assert.equal(classifyFailure({ status: 408 }), 'timeout');
  assert.equal(classifyFailure({ detail: 'request timed out' }), 'timeout');
});

test('everything else is provider_failed (never the raw text)', () => {
  assert.equal(classifyFailure({ status: 500, detail: 'internal: secret stack trace at /srv/x' }), 'provider_failed');
  assert.equal(classifyFailure({ status: 429 }), 'provider_failed');
  assert.equal(classifyFailure({}), 'provider_failed');
});

test('webhook ERROR payloads are classified the same way', () => {
  assert.equal(classifyWebhookFailure({ detail: [{ msg: 'content policy violation' }] }, null), 'content_blocked');
  assert.equal(classifyWebhookFailure({ detail: 'boom' }, 'Internal error'), 'provider_failed');
});

test('failureCodeOf only ever returns a public ErrorCode', () => {
  assert.equal(failureCodeOf(new AppError('invalid_input')), 'invalid_input');
  assert.equal(failureCodeOf(new ProviderError('content_blocked', 422)), 'content_blocked');
  const abort = new Error('aborted');
  abort.name = 'TimeoutError';
  assert.equal(failureCodeOf(abort), 'timeout');
  assert.equal(failureCodeOf({ status: 502 }), 'provider_failed');
  for (const thrown of [new Error('x'), 'string', null, 42, { status: 504 }]) assert.ok(isErrorCode(failureCodeOf(thrown)));
});
