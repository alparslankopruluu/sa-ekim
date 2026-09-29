/** Burns the watermark/AI label into a rendered video and tags its metadata. */
import { writeFile } from 'node:fs/promises';

import { FfmpegError, probeMedia, runFfmpeg } from './ffmpeg.js';
import {
  buildFinalizeArgs,
  DEFAULT_FRAME,
  type OverlayKind,
  overlayLayout,
  type ProbeResult,
  renderLabelBitmap,
} from './watermark.js';

const ENCODE_TIMEOUT_MS = 420_000;

export async function finalizeVideo(input: {
  inputFile: string;
  outputFile: string;
  overlayFile: string;
  overlay: OverlayKind;
}): Promise<ProbeResult> {
  const probe = await probeMedia(input.inputFile);
  const frame = {
    width: probe.width ?? DEFAULT_FRAME.width,
    height: probe.height ?? DEFAULT_FRAME.height,
  };
  const layout = overlayLayout(input.overlay, frame);
  const bitmap = renderLabelBitmap(layout.text, layout.scale);
  await writeFile(input.overlayFile, bitmap.rgba);
  const { code } = await runFfmpeg(
    buildFinalizeArgs({
      inputFile: input.inputFile,
      overlayFile: input.overlayFile,
      overlayWidth: bitmap.width,
      overlayHeight: bitmap.height,
      x: layout.x,
      y: layout.y,
      outputFile: input.outputFile,
    }),
    ENCODE_TIMEOUT_MS,
  );
  if (code !== 0) throw new FfmpegError(code);
  return probe;
}
