import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../src/lib/errors.js';
import {
  isOwnedUploadPath,
  parseCancelPreview,
  parseCreatePreview,
  parseDeletePreview,
  parseJoinCohort,
  parseRecordConsent,
  parseReportPreview,
} from '../src/lib/validate.js';
import type { ErrorCode } from '../src/shared/api.js';

const UID = 'uid_abc123';
const PREVIEW_ID = '8a6f2c1e-4b3d-4e5f-9a7b-1c2d3e4f5a6b';

const request = (patch: Record<string, unknown> = {}) => ({
  idempotencyKey: 'KEY-12345678',
  photoPath: `uploads/${UID}/selfie.jpg`,
  goal: 'hairline',
  styleId: 'hairline_soft',
  density: 'natural',
  quality: 'standard',
  ...patch,
});

function codeOf(fn: () => unknown): ErrorCode | 'ok' {
  try {
    fn();
    return 'ok';
  } catch (error) {
    assert.ok(error instanceof AppError);
    return error.code;
  }
}

const square = { points: [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 }, { x: 0.6, y: 0.5 }, { x: 0.2, y: 0.5 }] };

test('a valid request parses into a plan (idempotency key lower-cased, hint copied)', () => {
  const plan = parseCreatePreview(request({ regionHint: square }), UID);
  assert.equal(plan.idempotencyKey, 'key-12345678');
  assert.equal(plan.goal, 'hairline');
  assert.equal(plan.useFreeHighToken, false);
  assert.equal(plan.onboarding, false);
  assert.deepEqual(plan.regionHint, square);
  assert.notEqual(plan.regionHint, square);
});

test('goal, style and density must match the catalog', () => {
  assert.equal(codeOf(() => parseCreatePreview(request({ goal: 'crown' }), UID)), 'invalid_input'); // style belongs to hairline
  assert.equal(codeOf(() => parseCreatePreview(request({ density: 'full' }), UID)), 'invalid_input'); // hairline_soft: natural|fuller
  assert.equal(codeOf(() => parseCreatePreview(request({ styleId: 'nope' }), UID)), 'invalid_input');
  assert.equal(codeOf(() => parseCreatePreview(request({ quality: 'ultra' }), UID)), 'invalid_input');
  assert.equal(codeOf(() => parseCreatePreview(request({ density: 'fuller' }), UID)), 'ok');
});

test('the photo must be the caller\'s own upload, exactly uploads/{uid}/{file}', () => {
  for (const photoPath of [
    'uploads/other/selfie.jpg',
    `uploads/${UID}/nested/selfie.jpg`,
    `users/${UID}/previews/x.jpg`,
    `uploads/${UID}/selfie.exe`,
    `uploads/${UID}/../other/a.jpg`,
    `uploads/${UID}/sp ace.jpg`,
    42,
    undefined,
  ]) {
    assert.equal(codeOf(() => parseCreatePreview(request({ photoPath }), UID)), 'invalid_input', String(photoPath));
  }
  for (const file of ['a.jpg', 'a.JPEG', 'a.png', 'a.heic', 'a.webp']) {
    assert.equal(isOwnedUploadPath(`uploads/${UID}/${file}`, UID), true, file);
  }
});

test('idempotency keys are bounded and path-safe', () => {
  for (const idempotencyKey of ['short', 'has spaces here', 'x'.repeat(65), '../../etc/passwd', 12345678, undefined]) {
    assert.equal(codeOf(() => parseCreatePreview(request({ idempotencyKey }), UID)), 'invalid_input');
  }
});

test('a region hint must be a valid polygon covering 0.5% to 60% of the frame', () => {
  assert.equal(codeOf(() => parseCreatePreview(request({ regionHint: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } }), UID)), 'invalid_input');
  assert.equal(codeOf(() => parseCreatePreview(request({ regionHint: { points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }] } }), UID)), 'invalid_input');
  assert.equal(codeOf(() => parseCreatePreview(request({ regionHint: 'polygon' }), UID)), 'invalid_input');
  // Too small (a thin sliver) and too large (the whole frame) are rejected before any spend.
  const sliver = { points: [{ x: 0.1, y: 0.1 }, { x: 0.12, y: 0.1 }, { x: 0.12, y: 0.12 }] };
  assert.equal(codeOf(() => parseCreatePreview(request({ regionHint: sliver }), UID)), 'invalid_input');
  const whole = { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] };
  assert.equal(codeOf(() => parseCreatePreview(request({ regionHint: whole }), UID)), 'invalid_input');
  assert.equal(parseCreatePreview(request({ regionHint: null }), UID).regionHint, null);
});

test('booleans must be booleans', () => {
  assert.equal(codeOf(() => parseCreatePreview(request({ onboarding: 'yes' }), UID)), 'invalid_input');
  assert.equal(codeOf(() => parseCreatePreview(request({ useFreeHighToken: 1 }), UID)), 'invalid_input');
  const plan = parseCreatePreview(request({ onboarding: true, useFreeHighToken: true, quality: 'high' }), UID);
  assert.ok(plan.onboarding && plan.useFreeHighToken);
});

test('a request body that is not an object is invalid', () => {
  for (const body of [null, undefined, 'x', 7, []]) assert.equal(codeOf(() => parseCreatePreview(body, UID)), 'invalid_input');
});

test('consent versions are positive integers', () => {
  assert.deepEqual(parseRecordConsent({ version: 1 }), { version: 1 });
  for (const version of [0, -1, 1.5, '1', 1001, undefined]) {
    assert.equal(codeOf(() => parseRecordConsent({ version })), 'invalid_input');
  }
});

test('preview ids are UUIDs for cancel, delete and report', () => {
  assert.deepEqual(parseCancelPreview({ previewId: PREVIEW_ID.toUpperCase() }), { previewId: PREVIEW_ID });
  assert.deepEqual(parseDeletePreview({ previewId: PREVIEW_ID }), { previewId: PREVIEW_ID });
  assert.equal(codeOf(() => parseCancelPreview({ previewId: '../users/x' })), 'invalid_input');
  assert.equal(codeOf(() => parseDeletePreview({})), 'invalid_input');
  assert.deepEqual(parseReportPreview({ previewId: PREVIEW_ID, reason: 'unsafe' }), { previewId: PREVIEW_ID, reason: 'unsafe' });
  assert.equal(codeOf(() => parseReportPreview({ previewId: PREVIEW_ID, reason: 'because' })), 'invalid_input');
});

test('cohort input: a real recent date, a known goal and kind', () => {
  const now = Date.UTC(2026, 8, 29);
  assert.deepEqual(parseJoinCohort({ procedureDate: '2026-09-01', goal: 'crown', kind: 'transplant' }, now), {
    procedureDate: '2026-09-01',
    goal: 'crown',
    kind: 'transplant',
  });
  for (const patch of [
    { procedureDate: '2026-02-30' },
    { procedureDate: 'yesterday' },
    { procedureDate: '2010-01-01' },
    { procedureDate: '2031-01-01' },
    { goal: 'nose' },
    { kind: 'surgery' },
  ]) {
    assert.equal(
      codeOf(() => parseJoinCohort({ procedureDate: '2026-09-01', goal: 'crown', kind: 'prp', ...patch }, now)),
      'invalid_input',
      JSON.stringify(patch),
    );
  }
});
