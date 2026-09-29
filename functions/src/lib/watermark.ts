/**
 * Watermark for the free onboarding preview (pure): a small pixel-type label on a translucent
 * dark pill in the bottom-right corner. Paid previews carry no watermark. The "AI preview"
 * wording keeps the output honest wherever it is shared.
 */
import { GLYPH_HEIGHT, textPixels, textWidthUnits } from './pixel-font.js';

export const WATERMARK_TEXT = 'Kok · AI preview';

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

/** Which output gets a watermark: only the free onboarding preview. */
export function shouldWatermark(input: { onboarding: boolean; reservedCredits: number; freeHighTokens: number }): boolean {
  return input.onboarding && input.reservedCredits <= 0 && input.freeHighTokens <= 0;
}

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

export interface WatermarkLayout {
  text: string;
  scale: number;
  /** Top-left position of the label in image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bottom-right corner, sized to about a third of the image width, never larger than the image. */
export function watermarkLayout(frame: { width: number; height: number }): WatermarkLayout {
  const units = labelUnits(WATERMARK_TEXT);
  const scale = Math.max(1, Math.round((frame.width * 0.34) / units.width));
  const width = units.width * scale;
  const height = units.height * scale;
  const margin = Math.round(Math.min(frame.width, frame.height) * 0.04);
  return {
    text: WATERMARK_TEXT,
    scale,
    x: Math.max(0, frame.width - width - margin),
    y: Math.max(0, frame.height - height - margin),
    width,
    height,
  };
}

/** Alpha-composites `label` onto a raw RGB frame in place (pure; sharp only encodes/decodes). */
export function blendLabelOntoRgb(
  rgb: Uint8Array | Buffer,
  frame: { width: number; height: number },
  label: LabelBitmap,
  origin: { x: number; y: number },
): void {
  for (let ly = 0; ly < label.height; ly += 1) {
    const y = origin.y + ly;
    if (y < 0 || y >= frame.height) continue;
    for (let lx = 0; lx < label.width; lx += 1) {
      const x = origin.x + lx;
      if (x < 0 || x >= frame.width) continue;
      const li = (ly * label.width + lx) * 4;
      const alpha = (label.rgba[li + 3] ?? 0) / 255;
      if (alpha === 0) continue;
      const pi = (y * frame.width + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        const under = rgb[pi + c] ?? 0;
        const over = label.rgba[li + c] ?? 0;
        rgb[pi + c] = Math.round(under * (1 - alpha) + over * alpha);
      }
    }
  }
}
