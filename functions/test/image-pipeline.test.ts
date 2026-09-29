import assert from 'node:assert/strict';
import test from 'node:test';

import sharp from 'sharp';

import { AppError } from '../src/lib/errors.js';
import { finishEdit, prepareEditInputs } from '../src/lib/image-pipeline.js';
import { watermarkLayout } from '../src/lib/watermark.js';

const W = 320;
const H = 480;

async function selfie(): Promise<Buffer> {
  // A gradient so every pixel differs.
  const rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) rgb.set([x % 256, y % 256, (x + y) % 256], (y * W + x) * 3);
  return sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

const hint = { points: [{ x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.3 }] };

async function providerOutput(canvas: { width: number; height: number }, paint: (x: number, y: number) => [number, number, number]): Promise<Buffer> {
  const rgb = Buffer.alloc(canvas.width * canvas.height * 3);
  for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) rgb.set(paint(x, y), (y * canvas.width + x) * 3);
  return sharp(rgb, { raw: { width: canvas.width, height: canvas.height, channels: 3 } }).png().toBuffer();
}

test('masked edit: outside-mask pixels come back from the original; inside adopts the edit', async () => {
  const bytes = await selfie();
  const inputs = await prepareEditInputs(bytes, hint);
  assert.equal(inputs.kind, 'masked');
  if (inputs.kind !== 'masked') return;
  // Deterministic: the finalize task rebuilds identical geometry and mask.
  const again = await prepareEditInputs(bytes, hint);
  assert.ok(again.kind === 'masked' && again.maskBytes.equals(inputs.maskBytes));
  // The "provider" repaints the WHOLE canvas red (a global re-render).
  const red = await providerOutput(inputs.canvas, () => [255, 0, 0]);
  const outcome = await finishEdit({ inputs, providerBytes: red, alreadyRetried: false, watermark: false });
  assert.equal(outcome.action, 'done');
  if (outcome.action !== 'done') return;
  const { data, info } = await sharp(outcome.jpeg).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, W);
  assert.equal(info.height, H);
  const px = (x: number, y: number) => [...data.subarray((y * W + x) * 3, (y * W + x) * 3 + 3)];
  // Far outside the mask: original (within JPEG tolerance).
  const [r, g, b] = px(10, 400) as [number, number, number];
  assert.ok(Math.abs(r - 10) < 12 && Math.abs(g - (400 % 256)) < 12 && Math.abs(b - (410 % 256)) < 12, `${r},${g},${b}`);
  // Deep inside the mask: the edit.
  const [ir, ig, ib] = px(160, 96) as [number, number, number];
  assert.ok(ir > 230 && ig < 30 && ib < 30, `${ir},${ig},${ib}`);
  assert.ok(outcome.stats && outcome.stats.changedFraction > 0.9);
});

test('an invisible edit triggers exactly one retry; after the retry the result is kept, never refunded', async () => {
  const inputs = await prepareEditInputs(await selfie(), hint);
  if (inputs.kind !== 'masked') throw new Error('expected mask');
  const unchanged = await sharp(inputs.canvasRgb, { raw: { width: inputs.canvas.width, height: inputs.canvas.height, channels: 3 } }).png().toBuffer();
  const first = await finishEdit({ inputs, providerBytes: unchanged, alreadyRetried: false, watermark: false });
  assert.equal(first.action, 'retry');
  const second = await finishEdit({ inputs, providerBytes: unchanged, alreadyRetried: true, watermark: false });
  assert.equal(second.action, 'done');
});

test('a provider image with a different aspect ratio cannot be aligned and fails (refund path)', async () => {
  const inputs = await prepareEditInputs(await selfie(), hint);
  if (inputs.kind !== 'masked') throw new Error('expected mask');
  const square = await providerOutput({ width: 512, height: 512 }, () => [0, 0, 0]);
  await assert.rejects(finishEdit({ inputs, providerBytes: square, alreadyRetried: false, watermark: false }), (e) => e instanceof AppError && e.code === 'provider_failed');
  await assert.rejects(finishEdit({ inputs, providerBytes: Buffer.from('not an image'), alreadyRetried: false, watermark: false }), AppError);
});

test('without a hint the provider image is stored as-is, watermarked only when asked', async () => {
  const inputs = await prepareEditInputs(await selfie(), null);
  assert.equal(inputs.kind, 'plain');
  const white = await providerOutput({ width: W, height: H }, () => [255, 255, 255]);
  const clean = await finishEdit({ inputs, providerBytes: white, alreadyRetried: false, watermark: false });
  const marked = await finishEdit({ inputs, providerBytes: white, alreadyRetried: false, watermark: true });
  assert.ok(clean.action === 'done' && marked.action === 'done');
  if (clean.action !== 'done' || marked.action !== 'done') return;
  const a = await sharp(clean.jpeg).raw().toBuffer();
  const b = await sharp(marked.jpeg).raw().toBuffer();
  // Top-left identical, bottom-right corner darkened by the pill.
  assert.ok(Math.abs((a[0] as number) - (b[0] as number)) < 4);
  const layout = watermarkLayout({ width: W, height: H });
  // A pill-background pixel (left padding, vertical middle), not a text pixel.
  const corner = ((layout.y + Math.floor(layout.height / 2)) * W + layout.x + 2) * 3;
  assert.ok((b[corner] as number) < (a[corner] as number) - 40);
});
