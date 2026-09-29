/**
 * Output finishing decisions (pure): which label a render gets, the label
 * bitmap, where it goes, and the exact ffmpeg arguments.
 *
 *   preview / free renders → "Made with Belto · AI" watermark (bottom center)
 *   paid renders           → small "AI" disclosure label (top-left corner)
 *   every render           → mp4 `comment` metadata "AI-generated with Belto"
 */
import { GLYPH_HEIGHT, textPixels, textWidthUnits } from './pixel-font.js';

export const BRAND_WATERMARK_TEXT = 'Made with Belto · AI';
export const AI_LABEL_TEXT = 'AI';
export const AI_METADATA_COMMENT = 'AI-generated with Belto';

export type OverlayKind = 'brand' | 'ai_label';

export interface FinishDecision {
  overlay: OverlayKind;
  /** RenderDoc.watermarked — true only for the brand watermark. */
  watermarked: boolean;
}

/** Free output (the onboarding preview, or anything that reserved no credits) carries the brand watermark. */
export function decideFinish(input: { purpose: 'preview' | 'full'; reservedCredits: number }): FinishDecision {
  const free = input.purpose === 'preview' || input.reservedCredits <= 0;
  return free ? { overlay: 'brand', watermarked: true } : { overlay: 'ai_label', watermarked: false };
}

export interface LabelBitmap {
  width: number;
  height: number;
  /** Straight (non-premultiplied) RGBA, row-major. */
  rgba: Buffer;
}

const PAD_X_UNITS = 4;
const PAD_Y_UNITS = 3;
const BACKGROUND_ALPHA = 0.5;
const TEXT_ALPHA = 0.95;

/** Label size in font units (text + padding). */
export function labelUnits(text: string): { width: number; height: number } {
  return { width: textWidthUnits(text) + PAD_X_UNITS * 2, height: GLYPH_HEIGHT + PAD_Y_UNITS * 2 };
}

/** Rasterizes `text` as white pixel type on a translucent dark pill, `scale` pixels per font unit. */
export function renderLabelBitmap(text: string, scale: number): LabelBitmap {
  const s = Math.max(1, Math.floor(scale));
  const units = labelUnits(text);
  const width = units.width * s;
  const height = units.height * s;
  const rgba = Buffer.alloc(width * height * 4);
  const radius = height / 2;

  // Pill background, anti-aliased with 4×4 supersampling on the rounded ends.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let covered = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const px = x + (sx + 0.5) / 4;
          const py = y + (sy + 0.5) / 4;
          const cx = Math.min(Math.max(px, radius), width - radius);
          const dx = px - cx;
          const dy = py - radius;
          if (dx * dx + dy * dy <= radius * radius) covered += 1;
        }
      }
      const alpha = Math.round((covered / 16) * BACKGROUND_ALPHA * 255);
      const i = (y * width + x) * 4;
      rgba[i + 3] = alpha; // RGB stays 0 (black)
    }
  }

  // Text pixels: solid squares (a deliberate pixel-type look).
  const textAlpha = Math.round(TEXT_ALPHA * 255);
  for (const p of textPixels(text)) {
    const x0 = (p.x + PAD_X_UNITS) * s;
    const y0 = (p.y + PAD_Y_UNITS) * s;
    for (let y = y0; y < y0 + s; y += 1) {
      for (let x = x0; x < x0 + s; x += 1) {
        const i = (y * width + x) * 4;
        rgba[i] = 255;
        rgba[i + 1] = 255;
        rgba[i + 2] = 255;
        rgba[i + 3] = textAlpha;
      }
    }
  }
  return { width, height, rgba };
}

export interface OverlayLayout {
  text: string;
  scale: number;
  /** Top-left position of the label in video pixels. */
  x: number;
  y: number;
}

/** Fallback when the probe cannot read the frame size (portrait 720p). */
export const DEFAULT_FRAME = { width: 720, height: 1280 } as const;

export function overlayLayout(kind: OverlayKind, frame: { width: number; height: number }): OverlayLayout {
  const text = kind === 'brand' ? BRAND_WATERMARK_TEXT : AI_LABEL_TEXT;
  const units = labelUnits(text);
  const targetShare = kind === 'brand' ? 0.46 : 0.1;
  const scale = Math.max(1, Math.round((frame.width * targetShare) / units.width));
  const w = units.width * scale;
  const h = units.height * scale;
  const margin = Math.round(Math.min(frame.width, frame.height) * 0.04);
  if (kind === 'brand') {
    return {
      text,
      scale,
      x: Math.max(0, Math.round((frame.width - w) / 2)),
      y: Math.max(0, frame.height - h - Math.round(frame.height * 0.07)),
    };
  }
  return { text, scale, x: margin, y: margin };
}

/** ffmpeg arguments: composite the raw RGBA label, re-encode H.264, copy audio, tag metadata. */
export function buildFinalizeArgs(input: {
  inputFile: string;
  overlayFile: string;
  overlayWidth: number;
  overlayHeight: number;
  x: number;
  y: number;
  outputFile: string;
}): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-i',
    input.inputFile,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${input.overlayWidth}x${input.overlayHeight}`,
    '-i',
    input.overlayFile,
    '-filter_complex',
    `[0:v][1:v]overlay=x=${input.x}:y=${input.y}:eof_action=repeat[v]`,
    '-map',
    '[v]',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'copy',
    '-map_metadata',
    '-1',
    '-metadata',
    `comment=${AI_METADATA_COMMENT}`,
    '-movflags',
    '+faststart',
    input.outputFile,
  ];
}

export interface ProbeResult {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

/** Reads duration and frame size from `ffmpeg -i <file>` stderr. */
export function parseFfmpegProbe(stderr: string): ProbeResult {
  let durationSeconds: number | null = null;
  const duration = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (duration) {
    const total = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
    durationSeconds = Number.isFinite(total) && total > 0 ? total : null;
  }
  let width: number | null = null;
  let height: number | null = null;
  const video = /Stream #\d+:\d+[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/.exec(stderr);
  if (video) {
    width = Number(video[1]);
    height = Number(video[2]);
  }
  return { durationSeconds, width, height };
}
