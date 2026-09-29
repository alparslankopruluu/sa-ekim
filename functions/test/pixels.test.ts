import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canResizeToCanvas,
  compositeOutsideMask,
  measureChange,
  passesQualityGate,
  shouldRetryForVisibility,
} from '../src/lib/pixels.js';

const rgb = (...values: number[]) => Uint8Array.from(values);

test('composite keeps protected pixels bit-exact, adopts editable ones and blends the feather once', () => {
  const original = rgb(10, 20, 30, 10, 20, 30, 10, 20, 30);
  const edited = rgb(200, 200, 200, 200, 200, 200, 200, 200, 200);
  const alpha = Uint8Array.from([255, 0, 128]);
  const out = compositeOutsideMask(original, edited, alpha);
  assert.deepEqual([...out.subarray(0, 3)], [10, 20, 30]);
  assert.deepEqual([...out.subarray(3, 6)], [200, 200, 200]);
  assert.deepEqual([...out.subarray(6, 9)], [
    Math.round((10 * 128 + 200 * 127) / 255),
    Math.round((20 * 128 + 200 * 127) / 255),
    Math.round((30 * 128 + 200 * 127) / 255),
  ]);
  // Inputs are not mutated.
  assert.deepEqual([...original], [10, 20, 30, 10, 20, 30, 10, 20, 30]);
});

test('composite rejects mismatched buffers', () => {
  assert.throws(() => compositeOutsideMask(rgb(1, 2, 3), rgb(1, 2), Uint8Array.from([0])));
  assert.throws(() => compositeOutsideMask(rgb(1, 2, 3), rgb(1, 2, 3), Uint8Array.from([0, 0])));
});

test('change is measured only on fully editable pixels, above the noise threshold', () => {
  const before = rgb(100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100);
  const after = rgb(100, 100, 108, 100, 100, 109, 50, 50, 50, 0, 0, 0);
  const alpha = Uint8Array.from([0, 0, 0, 255]); // last pixel changed but protected
  const stats = measureChange(before, after, alpha);
  assert.deepEqual(stats, { editablePixelCount: 3, changedPixelCount: 2, changedFraction: 2 / 3 });
});

test('the quality gate passes at 2% of the editable area and when nothing can be measured', () => {
  assert.equal(passesQualityGate({ editablePixelCount: 1000, changedPixelCount: 20, changedFraction: 0.02 }), true);
  assert.equal(passesQualityGate({ editablePixelCount: 1000, changedPixelCount: 19, changedFraction: 0.019 }), false);
  assert.equal(passesQualityGate({ editablePixelCount: 0, changedPixelCount: 0, changedFraction: 0 }), true);
});

test('retry exactly once, and only when the gate measured something and failed', () => {
  assert.equal(shouldRetryForVisibility({ gateMeasured: true, passed: false, alreadyRetried: false }), true);
  assert.equal(shouldRetryForVisibility({ gateMeasured: true, passed: false, alreadyRetried: true }), false);
  assert.equal(shouldRetryForVisibility({ gateMeasured: true, passed: true, alreadyRetried: false }), false);
  assert.equal(shouldRetryForVisibility({ gateMeasured: false, passed: false, alreadyRetried: false }), false);
});

test('a provider image may be resized back only when its aspect ratio matches the canvas', () => {
  assert.equal(canResizeToCanvas({ width: 1024, height: 1536 }, { width: 1024, height: 1536 }), true);
  assert.equal(canResizeToCanvas({ width: 512, height: 768 }, { width: 1024, height: 1536 }), true);
  assert.equal(canResizeToCanvas({ width: 1024, height: 1024 }, { width: 1024, height: 1536 }), false);
  assert.equal(canResizeToCanvas({ width: 0, height: 10 }, { width: 10, height: 10 }), false);
});
