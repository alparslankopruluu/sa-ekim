import assert from 'node:assert/strict';
import test from 'node:test';

import { hasGlyphs, textWidthUnits } from '../src/lib/pixel-font.js';
import {
  AI_LABEL_TEXT,
  AI_METADATA_COMMENT,
  BRAND_WATERMARK_TEXT,
  buildFinalizeArgs,
  decideFinish,
  labelUnits,
  overlayLayout,
  parseFfmpegProbe,
  renderLabelBitmap,
} from '../src/lib/watermark.js';

test('preview/free renders get the brand watermark; paid renders the AI label', () => {
  assert.deepEqual(decideFinish({ purpose: 'preview', reservedCredits: 0 }), { overlay: 'brand', watermarked: true });
  assert.deepEqual(decideFinish({ purpose: 'full', reservedCredits: 0 }), { overlay: 'brand', watermarked: true });
  assert.deepEqual(decideFinish({ purpose: 'full', reservedCredits: 60 }), { overlay: 'ai_label', watermarked: false });
});

test('every label character has a glyph', () => {
  assert.equal(hasGlyphs(BRAND_WATERMARK_TEXT), true);
  assert.equal(hasGlyphs(AI_LABEL_TEXT), true);
  assert.equal(textWidthUnits('AI'), 11);
});

test('label bitmap: exact size, transparent corners, opaque white type', () => {
  const scale = 3;
  const bitmap = renderLabelBitmap(AI_LABEL_TEXT, scale);
  const units = labelUnits(AI_LABEL_TEXT);
  assert.equal(bitmap.width, units.width * scale);
  assert.equal(bitmap.height, units.height * scale);
  assert.equal(bitmap.rgba.length, bitmap.width * bitmap.height * 4);
  // Rounded pill: the very corner pixel is fully transparent.
  assert.equal(bitmap.rgba[3], 0);
  // Somewhere there is white text on top of the pill.
  let white = 0;
  for (let i = 0; i < bitmap.rgba.length; i += 4) {
    if (bitmap.rgba[i] === 255 && (bitmap.rgba[i + 3] ?? 0) > 200) white += 1;
  }
  assert.ok(white > 0);
});

test('layout keeps the label inside the frame and scales with it', () => {
  for (const frame of [
    { width: 480, height: 848 },
    { width: 1080, height: 1920 },
    { width: 1920, height: 1080 },
  ]) {
    for (const kind of ['brand', 'ai_label'] as const) {
      const layout = overlayLayout(kind, frame);
      const units = labelUnits(layout.text);
      assert.ok(layout.x >= 0 && layout.y >= 0);
      assert.ok(layout.x + units.width * layout.scale <= frame.width);
      assert.ok(layout.y + units.height * layout.scale <= frame.height);
    }
  }
  assert.ok(overlayLayout('brand', { width: 1080, height: 1920 }).scale > overlayLayout('brand', { width: 480, height: 848 }).scale);
});

test('ffmpeg args composite the label, keep audio, strip provider metadata and tag AI', () => {
  const args = buildFinalizeArgs({
    inputFile: '/tmp/in.mp4',
    overlayFile: '/tmp/label.rgba',
    overlayWidth: 120,
    overlayHeight: 39,
    x: 10,
    y: 20,
    outputFile: '/tmp/out.mp4',
  });
  const joined = args.join(' ');
  assert.match(joined, /-f rawvideo -pix_fmt rgba -s 120x39 -i \/tmp\/label\.rgba/);
  assert.match(joined, /overlay=x=10:y=20/);
  assert.match(joined, /-map 0:a\? /);
  assert.match(joined, /-map_metadata -1/);
  assert.ok(args.includes(`comment=${AI_METADATA_COMMENT}`));
  assert.equal(args.at(-1), '/tmp/out.mp4');
});

test('probe parsing reads duration and frame size', () => {
  const stderr = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'in.mp4':",
    '  Duration: 00:00:12.04, start: 0.000000, bitrate: 1834 kb/s',
    '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 480x848 [SAR 1:1 DAR 30:53], 1700 kb/s, 24 fps',
    '  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s',
  ].join('\n');
  assert.deepEqual(parseFfmpegProbe(stderr), { durationSeconds: 12.04, width: 480, height: 848 });
  assert.deepEqual(parseFfmpegProbe('garbage'), { durationSeconds: null, width: null, height: null });
  assert.equal(parseFfmpegProbe('  Duration: 00:01:02.50, start').durationSeconds, 62.5);
});
