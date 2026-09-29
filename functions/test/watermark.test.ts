import assert from 'node:assert/strict';
import test from 'node:test';

import { hasGlyphs } from '../src/lib/pixel-font.js';
import { blendLabelOntoRgb, renderLabelBitmap, shouldWatermark, WATERMARK_TEXT, watermarkLayout } from '../src/lib/watermark.js';

test('only the free onboarding preview is watermarked', () => {
  assert.equal(shouldWatermark({ onboarding: true, reservedCredits: 0, freeHighTokens: 0 }), true);
  assert.equal(shouldWatermark({ onboarding: false, reservedCredits: 1, freeHighTokens: 0 }), false);
  assert.equal(shouldWatermark({ onboarding: false, reservedCredits: 3, freeHighTokens: 0 }), false);
  assert.equal(shouldWatermark({ onboarding: false, reservedCredits: 0, freeHighTokens: 1 }), false);
});

test('the watermark text renders with the bundled pixel font', () => {
  assert.equal(hasGlyphs(WATERMARK_TEXT), true);
  const label = renderLabelBitmap(WATERMARK_TEXT, 2);
  assert.equal(label.rgba.length, label.width * label.height * 4);
});

test('the layout sits in the bottom-right corner and inside the frame', () => {
  for (const frame of [{ width: 1024, height: 1536 }, { width: 640, height: 480 }, { width: 120, height: 90 }]) {
    const layout = watermarkLayout(frame);
    assert.ok(layout.x >= 0 && layout.y >= 0);
    assert.ok(layout.x + layout.width <= frame.width || layout.x === 0);
    assert.ok(layout.y + layout.height <= frame.height || layout.y === 0);
    if (frame.width >= 320) assert.ok(layout.x > frame.width / 3);
  }
});

test('blending changes only pixels under the label', () => {
  const frame = { width: 10, height: 10 };
  const rgb = Buffer.alloc(10 * 10 * 3, 200);
  const label = { width: 2, height: 1, rgba: Buffer.from([255, 255, 255, 255, 0, 0, 0, 0]) };
  blendLabelOntoRgb(rgb, frame, label, { x: 9, y: 9 }); // second pixel falls outside the frame
  assert.deepEqual([...rgb.subarray((9 * 10 + 9) * 3, (9 * 10 + 9) * 3 + 3)], [255, 255, 255]);
  assert.equal(rgb.subarray(0, (9 * 10 + 9) * 3).every((v) => v === 200), true);
});
