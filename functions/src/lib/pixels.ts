/**
 * Pixel math on raw sRGB buffers (3 bytes per pixel), independent of any image library so the
 * guarantees are unit-tested with tiny synthetic images.
 *
 *  - `compositeOutsideMask`: original pixels are kept wherever the mask protects them (alpha 255),
 *    the edit is adopted where the mask allows it (alpha 0), and the feather ramp interpolates once.
 *  - `measureChange` / `passesQualityGate`: how much of the editable area actually changed. This is a
 *    MEASUREMENT used only to trigger one same-charge retry; it is never a refund or reject decision
 *    and never proof of success (a genuinely subtle edit can sit just under the threshold).
 */
import { QUALITY_GATE_MIN_CHANGED_FRACTION } from '../config.js';

/** Per-channel difference below this is compression/resampling noise, not an edit. */
export const CHANGE_THRESHOLD_PER_CHANNEL = 8;

function assertLayout(before: Uint8Array, after: Uint8Array, alpha: Uint8Array): number {
  const pixels = alpha.length;
  if (before.length !== pixels * 3 || after.length !== before.length) {
    throw new Error('Unexpected pixel buffer layout');
  }
  return pixels;
}

/**
 * Returns a NEW buffer: `original` where alpha === 255 (bit-exact), `edited` where alpha === 0, and a
 * single linear interpolation in between.
 */
export function compositeOutsideMask(original: Uint8Array, edited: Uint8Array, alpha: Uint8Array): Buffer {
  const pixels = assertLayout(original, edited, alpha);
  const out = Buffer.from(original);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const protection = alpha[pixel] as number;
    if (protection === 255) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      const offset = pixel * 3 + channel;
      const oldValue = original[offset] as number;
      const newValue = edited[offset] as number;
      out[offset] = Math.round((oldValue * protection + newValue * (255 - protection)) / 255);
    }
  }
  return out;
}

export interface VisibilityStats {
  /** Pixels the mask fully permits editing (alpha === 0); the feather ramp is excluded. */
  editablePixelCount: number;
  changedPixelCount: number;
  /** 0 when there is nothing to measure. */
  changedFraction: number;
}

export function measureChange(before: Uint8Array, after: Uint8Array, alpha: Uint8Array): VisibilityStats {
  const pixels = assertLayout(before, after, alpha);
  let editable = 0;
  let changed = 0;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    if (alpha[pixel] !== 0) continue;
    editable += 1;
    for (let channel = 0; channel < 3; channel += 1) {
      const offset = pixel * 3 + channel;
      if (Math.abs((before[offset] as number) - (after[offset] as number)) > CHANGE_THRESHOLD_PER_CHANNEL) {
        changed += 1;
        break;
      }
    }
  }
  return { editablePixelCount: editable, changedPixelCount: changed, changedFraction: editable > 0 ? changed / editable : 0 };
}

/** True when nothing can be judged (no editable pixels) or enough of the editable area changed. */
export function passesQualityGate(stats: VisibilityStats, threshold = QUALITY_GATE_MIN_CHANGED_FRACTION): boolean {
  if (stats.editablePixelCount === 0) return true;
  return stats.changedFraction >= threshold;
}

/**
 * The single retry rule: retry once, at the same charge, only when a measurable mask exists, the gate
 * failed, and no retry happened yet. Everything else proceeds to composite and settle.
 */
export function shouldRetryForVisibility(input: { gateMeasured: boolean; passed: boolean; alreadyRetried: boolean }): boolean {
  return input.gateMeasured && !input.passed && !input.alreadyRetried;
}

/** Aspect ratios within this relative tolerance are treated as the same canvas (then resized to fit). */
export const ASPECT_TOLERANCE = 0.02;

export function canResizeToCanvas(actual: { width: number; height: number }, expected: { width: number; height: number }): boolean {
  if (actual.width <= 0 || actual.height <= 0) return false;
  const a = actual.width / actual.height;
  const e = expected.width / expected.height;
  return Math.abs(a - e) / e <= ASPECT_TOLERANCE;
}
