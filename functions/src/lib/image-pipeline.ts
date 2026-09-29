/**
 * Image side of the preview pipeline. Everything deterministic lives in region-mask.ts / pixels.ts /
 * watermark.ts (pure); this file only decodes and encodes with sharp and orchestrates them:
 *
 *   prepareEditInputs(selfie, hint) ─ same bytes at submit time and at finalize time, so the padded
 *                                     canvas, the mask and the composite geometry never need storing.
 *   finishEdit(inputs, providerBytes) ─ quality gate → (retry | composite → crop → watermark → JPEG).
 */
import sharp from 'sharp';

import type { RegionHint } from '../shared/catalog.js';
import { AppError } from './errors.js';
import { canResizeToCanvas, compositeOutsideMask, measureChange, passesQualityGate, shouldRetryForVisibility, type VisibilityStats } from './pixels.js';
import {
  type CanvasGeometry,
  canvasGeometry,
  encodeMaskPng,
  MAX_MASK_EDGE,
  placeAlphaOnCanvas,
  rasterizeEditAlpha,
} from './region-mask.js';
import { blendLabelOntoRgb, renderLabelBitmap, watermarkLayout, WATERMARK_TEXT } from './watermark.js';

const INPUT_OPTIONS = { limitInputPixels: 100_000_000, failOn: 'error' as const };
const JPEG_QUALITY = 90;

export interface RawImage {
  rgb: Buffer;
  width: number;
  height: number;
}

/**
 * Decodes a selfie into normalized sRGB: EXIF orientation applied (and therefore dropped), long edge
 * at most 2048 px, alpha removed. Throws on anything sharp cannot decode.
 */
export async function decodeSelfie(bytes: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(bytes, INPUT_OPTIONS)
    .rotate()
    .resize({ width: MAX_MASK_EDGE, height: MAX_MASK_EDGE, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgb: data, width: info.width, height: info.height };
}

async function decodeProviderImage(bytes: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(bytes, INPUT_OPTIONS)
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgb: data, width: info.width, height: info.height };
}

async function encodeJpeg(image: RawImage): Promise<Buffer> {
  return sharp(image.rgb, { raw: { width: image.width, height: image.height, channels: 3 } })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

async function encodePng(image: RawImage): Promise<Buffer> {
  return sharp(image.rgb, { raw: { width: image.width, height: image.height, channels: 3 } }).png().toBuffer();
}

async function resizeRaw(image: RawImage, width: number, height: number): Promise<RawImage> {
  const { data, info } = await sharp(image.rgb, { raw: { width: image.width, height: image.height, channels: 3 } })
    .resize(width, height, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgb: data, width: info.width, height: info.height };
}

/** Copies the `crop` rectangle of an RGB canvas. */
export function cropRgb(rgb: Uint8Array, canvasWidth: number, crop: { left: number; top: number; width: number; height: number }): Buffer {
  const out = Buffer.alloc(crop.width * crop.height * 3);
  for (let y = 0; y < crop.height; y += 1) {
    const from = ((y + crop.top) * canvasWidth + crop.left) * 3;
    out.set(rgb.subarray(from, from + crop.width * 3), y * crop.width * 3);
  }
  return out;
}

export type EditInputs =
  | {
      kind: 'masked';
      /** Padded canvas (PNG), the image the provider edits. */
      imageBytes: Buffer;
      imageContentType: 'image/png';
      maskBytes: Buffer;
      imageSize: { width: number; height: number };
      outputFormat: 'png';
      source: RawImage;
      canvas: CanvasGeometry;
      canvasRgb: Buffer;
      /** Alpha plane on the canvas (0 editable, 255 protected). */
      canvasAlpha: Uint8Array;
    }
  | {
      kind: 'plain';
      imageBytes: Buffer;
      imageContentType: 'image/jpeg';
      maskBytes: null;
      imageSize: 'auto';
      outputFormat: 'jpeg';
      source: RawImage;
    };

/** Deterministic: the same selfie bytes and hint always produce the same canvas, mask and geometry. */
export async function prepareEditInputs(selfieBytes: Buffer, hint: RegionHint | null): Promise<EditInputs> {
  const source = await decodeSelfie(selfieBytes);
  if (!hint) {
    return {
      kind: 'plain',
      imageBytes: await sharp(source.rgb, { raw: { width: source.width, height: source.height, channels: 3 } })
        .jpeg({ quality: 92 })
        .toBuffer(),
      imageContentType: 'image/jpeg',
      maskBytes: null,
      imageSize: 'auto',
      outputFormat: 'jpeg',
      source,
    };
  }
  const sourceAlpha = rasterizeEditAlpha(hint.points, source.width, source.height);
  const canvas = canvasGeometry(source.width, source.height);
  const canvasAlpha = placeAlphaOnCanvas(sourceAlpha, source.width, source.height, canvas);
  // Pad with neutral grey; the padding is protected in the mask and cropped away after compositing.
  const canvasRgb = Buffer.alloc(canvas.width * canvas.height * 3, 128);
  for (let y = 0; y < source.height; y += 1) {
    const from = y * source.width * 3;
    canvasRgb.set(source.rgb.subarray(from, from + source.width * 3), ((y + canvas.top) * canvas.width + canvas.left) * 3);
  }
  return {
    kind: 'masked',
    imageBytes: await encodePng({ rgb: canvasRgb, width: canvas.width, height: canvas.height }),
    imageContentType: 'image/png',
    maskBytes: encodeMaskPng(canvasAlpha, canvas.width, canvas.height),
    imageSize: { width: canvas.width, height: canvas.height },
    outputFormat: 'png',
    source,
    canvas,
    canvasRgb,
    canvasAlpha,
  };
}

export type FinishOutcome =
  | { action: 'retry'; stats: VisibilityStats }
  | { action: 'done'; jpeg: Buffer; stats: VisibilityStats | null };

async function applyWatermark(image: RawImage): Promise<RawImage> {
  const layout = watermarkLayout(image);
  const label = renderLabelBitmap(WATERMARK_TEXT, layout.scale);
  const rgb = Buffer.from(image.rgb);
  blendLabelOntoRgb(rgb, image, label, { x: layout.x, y: layout.y });
  return { rgb, width: image.width, height: image.height };
}

/**
 * Gate → composite → watermark → JPEG. With a mask the original pixels are restored outside it
 * (feathered) and the changed-pixel fraction inside it decides whether to retry ONCE at the same
 * charge; without a mask the provider image is stored as-is. Throws AppError('provider_failed') when
 * the provider returned an image that cannot be aligned with the request.
 */
export async function finishEdit(input: {
  inputs: EditInputs;
  providerBytes: Buffer;
  alreadyRetried: boolean;
  watermark: boolean;
}): Promise<FinishOutcome> {
  const { inputs } = input;
  let provider: RawImage;
  try {
    provider = await decodeProviderImage(input.providerBytes);
  } catch {
    throw new AppError('provider_failed');
  }

  if (inputs.kind === 'plain') {
    const image = input.watermark ? await applyWatermark(provider) : provider;
    return { action: 'done', jpeg: await encodeJpeg(image), stats: null };
  }

  if (provider.width !== inputs.canvas.width || provider.height !== inputs.canvas.height) {
    if (!canResizeToCanvas(provider, inputs.canvas)) throw new AppError('provider_failed');
    provider = await resizeRaw(provider, inputs.canvas.width, inputs.canvas.height);
  }

  const stats = measureChange(inputs.canvasRgb, provider.rgb, inputs.canvasAlpha);
  const passed = passesQualityGate(stats);
  if (shouldRetryForVisibility({ gateMeasured: stats.editablePixelCount > 0, passed, alreadyRetried: input.alreadyRetried })) {
    return { action: 'retry', stats };
  }

  const composed = compositeOutsideMask(inputs.canvasRgb, provider.rgb, inputs.canvasAlpha);
  const cropped: RawImage = {
    rgb: cropRgb(composed, inputs.canvas.width, {
      left: inputs.canvas.left,
      top: inputs.canvas.top,
      width: inputs.source.width,
      height: inputs.source.height,
    }),
    width: inputs.source.width,
    height: inputs.source.height,
  };
  const image = input.watermark ? await applyWatermark(cropped) : cropped;
  return { action: 'done', jpeg: await encodeJpeg(image), stats };
}
