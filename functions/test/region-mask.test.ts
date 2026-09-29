import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import test from 'node:test';

import {
  canvasGeometry,
  encodeMaskPng,
  isUsableRegionArea,
  placeAlphaOnCanvas,
  polygonAreaFraction,
  rasterizeEditAlpha,
} from '../src/lib/region-mask.js';

const square = [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }];

test('polygon area is its fraction of the frame', () => {
  assert.equal(polygonAreaFraction(square), 0.25);
  assert.equal(isUsableRegionArea({ points: square }), true);
  assert.equal(isUsableRegionArea({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }), false);
});

test('the mask is 0 inside, 255 outside, and feathering never leaks outside the polygon', () => {
  const w = 40;
  const h = 40;
  const hard = rasterizeEditAlpha(square, w, h, 0);
  assert.equal(hard[20 * w + 20], 0);
  assert.equal(hard[2 * w + 2], 255);
  const soft = rasterizeEditAlpha(square, w, h, 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (hard[y * w + x] === 255) assert.equal(soft[y * w + x], 255, `leak at ${x},${y}`);
    }
  }
  assert.equal(soft[20 * w + 20], 0); // deep inside stays fully editable
  const edge = soft[20 * w + 11] as number; // just inside the left edge is ramped
  assert.ok(edge > 0 && edge < 255, String(edge));
});

test('rasterization refuses oversize or degenerate input', () => {
  assert.throws(() => rasterizeEditAlpha(square, 4096, 10));
  assert.throws(() => rasterizeEditAlpha(square, 0, 10));
  assert.throws(() => rasterizeEditAlpha(square.slice(0, 2), 10, 10));
});

test('the provider canvas is padded to 16 px multiples, >= 655,360 px, and keeps the photo centered', () => {
  const g = canvasGeometry(1000, 1500);
  assert.equal(g.width % 16, 0);
  assert.equal(g.height % 16, 0);
  assert.ok(g.width >= 1000 && g.height >= 1500);
  assert.ok(g.width * g.height >= 655_360);
  assert.equal(g.left, Math.floor((g.width - 1000) / 2));
  const small = canvasGeometry(300, 400);
  assert.ok(small.width * small.height >= 655_360);
  const wide = canvasGeometry(2000, 200);
  assert.ok(wide.width <= 3 * wide.height);
});

test('padding is fully protected on the canvas', () => {
  const alpha = Uint8Array.from([0, 0, 0, 0]);
  const canvas = { width: 4, height: 4, left: 1, top: 1 };
  const placed = placeAlphaOnCanvas(alpha, 2, 2, canvas);
  assert.deepEqual([...placed], [255, 255, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255]);
});

test('the mask PNG is RGBA with black RGB and the alpha plane intact', () => {
  const alpha = Uint8Array.from([0, 128, 255, 7]);
  const png = encodeMaskPng(alpha, 2, 2);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);
  assert.equal(png[25], 6); // colour type RGBA
  const idatLength = png.readUInt32BE(33);
  const raw = inflateSync(png.subarray(41, 41 + idatLength));
  // Two rows of: filter byte + 2 × RGBA.
  assert.deepEqual([...raw], [0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 255, 0, 0, 0, 7]);
  assert.throws(() => encodeMaskPng(alpha, 3, 2));
});
