/** ffmpeg (bundled via ffmpeg-static) process runner, probe, and audio trim. */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import { type ProbeResult, parseFfmpegProbe } from './watermark.js';

// ffmpeg-static is CommonJS (`module.exports = <binary path>`); its typings
// declare a default export, which NodeNext types as the namespace object.
const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;

const MAX_STDERR_CHARS = 64 * 1024;

export class FfmpegError extends Error {
  constructor(readonly exitCode: number | null) {
    super(`ffmpeg exited with ${exitCode}`);
    this.name = 'FfmpegError';
  }
}

export async function runFfmpeg(args: string[], timeoutMs: number): Promise<{ code: number | null; stderr: string }> {
  if (!ffmpegPath) throw new Error('ffmpeg binary unavailable');
  const binary = ffmpegPath;
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < MAX_STDERR_CHARS) stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/** Duration and frame size. `ffmpeg -i` with no output exits non-zero by design. */
export async function probeMedia(file: string): Promise<ProbeResult> {
  const { stderr } = await runFfmpeg(['-hide_banner', '-nostdin', '-i', file], 20_000);
  return parseFfmpegProbe(stderr);
}

/** Cuts audio to `seconds` (with a short fade-out) and encodes MP3. Returns the input duration. */
export async function trimAudioToMp3(input: string, output: string, seconds: number): Promise<ProbeResult> {
  const fadeStart = Math.max(0, seconds - 0.4);
  const { code, stderr } = await runFfmpeg(
    [
      '-hide_banner',
      '-nostdin',
      '-y',
      '-i',
      input,
      '-vn',
      '-t',
      String(seconds),
      '-af',
      `afade=t=out:st=${fadeStart}:d=0.4`,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-map_metadata',
      '-1',
      output,
    ],
    60_000,
  );
  if (code !== 0) throw new FfmpegError(code);
  return parseFfmpegProbe(stderr);
}

/** Stream-copies at most `seconds` of an MP3 (no re-encode). Returns the input duration. */
export async function capMp3Length(input: string, output: string, seconds: number): Promise<ProbeResult> {
  const { code, stderr } = await runFfmpeg(
    ['-hide_banner', '-nostdin', '-y', '-i', input, '-vn', '-t', String(seconds), '-c:a', 'copy', '-map_metadata', '-1', output],
    60_000,
  );
  if (code !== 0) throw new FfmpegError(code);
  return parseFfmpegProbe(stderr);
}
