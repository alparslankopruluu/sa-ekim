/**
 * Runs the bundled ffmpeg binary on locally generated media (no network, no
 * emulator) to prove the finalize filter graph and audio trims actually work.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { capMp3Length, probeMedia, runFfmpeg, trimAudioToMp3 } from '../src/lib/ffmpeg.js';
import { finalizeVideo } from '../src/lib/finalize.js';
import { labelUnits, overlayLayout } from '../src/lib/watermark.js';

const binary = createRequire(import.meta.url)('ffmpeg-static') as string | null;
const skip = !binary || !existsSync(binary) ? 'ffmpeg-static binary not installed' : false;

const W = 480;
const H = 848;

async function withDir(work: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'belto-test-'));
  try {
    await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function ffmpeg(args: string[]): Promise<string> {
  const { code, stderr } = await runFfmpeg(['-hide_banner', '-nostdin', '-y', ...args], 120_000);
  assert.equal(code, 0, 'ffmpeg failed');
  return stderr;
}

async function firstFrame(dir: string, video: string, name: string): Promise<Buffer> {
  const file = join(dir, `${name}.rgb`);
  await ffmpeg(['-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', file]);
  return await readFile(file);
}

function meanAbsDiff(a: Buffer, b: Buffer, rect: { x: number; y: number; w: number; h: number }): number {
  let sum = 0;
  let n = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        const i = (y * W + x) * 3 + c;
        sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
        n += 1;
      }
    }
  }
  return sum / n;
}

test('finalize burns the label, keeps audio, and replaces provider metadata', { skip }, async () => {
  await withDir(async (dir) => {
    const input = join(dir, 'provider.mp4');
    await ffmpeg([
      '-f', 'lavfi', '-i', `testsrc=size=${W}x${H}:rate=24:duration=3`,
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      '-metadata', 'comment=provider-internal-id', input,
    ]);
    const before = await firstFrame(dir, input, 'before');

    for (const overlay of ['brand', 'ai_label'] as const) {
      const output = join(dir, `final-${overlay}.mp4`);
      const probe = await finalizeVideo({
        inputFile: input,
        outputFile: output,
        overlayFile: join(dir, `${overlay}.rgba`),
        overlay,
      });
      assert.equal(probe.width, W);
      assert.equal(probe.height, H);
      assert.ok(probe.durationSeconds !== null && probe.durationSeconds > 2.5 && probe.durationSeconds < 3.5);

      const { stderr } = await runFfmpeg(['-hide_banner', '-nostdin', '-i', output], 20_000);
      assert.match(stderr, /comment\s*:\s*AI-generated with Belto/);
      assert.doesNotMatch(stderr, /provider-internal-id/);
      assert.match(stderr, /Audio: aac/);
      assert.match(stderr, /Video: h264/);

      // The label is really burned in: pixels change inside its box, not elsewhere.
      const after = await firstFrame(dir, output, `after-${overlay}`);
      const layout = overlayLayout(overlay, { width: W, height: H });
      const units = labelUnits(layout.text);
      const box = { x: layout.x, y: layout.y, w: units.width * layout.scale, h: units.height * layout.scale };
      const inside = meanAbsDiff(before, after, box);
      const away =
        overlay === 'brand'
          ? meanAbsDiff(before, after, { x: 0, y: 0, w: W, h: 200 })
          : meanAbsDiff(before, after, { x: 0, y: H - 200, w: W, h: 200 });
      assert.ok(inside > 20, `label region barely changed (${inside})`);
      assert.ok(away < 8, `untouched region changed too much (${away})`);
    }
  });
});

test('preview/recording audio is trimmed to MP3; songs are capped by stream copy', { skip }, async () => {
  await withDir(async (dir) => {
    const recording = join(dir, 'recording.m4a');
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=9', '-c:a', 'aac', recording]);
    const preview = join(dir, 'preview.mp3');
    const source = await trimAudioToMp3(recording, preview, 5);
    assert.ok(source.durationSeconds !== null && source.durationSeconds > 8.5);
    const trimmed = await probeMedia(preview);
    assert.ok(trimmed.durationSeconds !== null && trimmed.durationSeconds <= 5.2 && trimmed.durationSeconds >= 4.5);

    const song = join(dir, 'song.mp3');
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=262:duration=22', '-c:a', 'libmp3lame', '-b:a', '128k', song]);
    const capped = join(dir, 'capped.mp3');
    const original = await capMp3Length(song, capped, 15);
    assert.ok(original.durationSeconds !== null && original.durationSeconds > 21);
    const out = await probeMedia(capped);
    assert.ok(out.durationSeconds !== null && out.durationSeconds <= 15.2 && out.durationSeconds >= 14.5);
  });
});
