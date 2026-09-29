/**
 * Server-side edit mask for the fal `openai/gpt-image-2/edit` call (pure, dependency-free).
 *
 * Alpha convention (OpenAI image-edit mask convention, which fal's schema follows): the mask is an
 * RGBA PNG at EXACTLY the input image's pixel dimensions. Alpha 0 marks the region the model MAY
 * edit; alpha 255 marks the region to leave alone; a soft ramp at the boundary is allowed.
 *
 * A mask only BIASES the edit — these models re-render the whole picture. The guarantee comes from
 * compositing the original pixels back outside the mask after the edit (lib/pixels.ts), which is
 * why the mask and the padded canvas here are fully deterministic: the finalize task rebuilds the
 * exact same geometry from the stored selfie and the stored region hint instead of persisting them.
 *
 * Evidence (Simetra, docs/decisions.md 2026-09-11): unmasked edits on real photos are frequently
 * invisible or re-render the whole photograph; masked + composited edits are visible and keep the
 * rest of the frame pixel-identical.
 */
import { deflateSync } from 'node:zlib';

import type { RegionHint } from '../shared/catalog.js';

export interface Point {
  x: number;
  y: number;
}

/** Hard pixel budget for rasterization, mirrored from the app's own long-edge normalization. */
export const MAX_MASK_EDGE = 2048;
export const MAX_MASK_PIXELS = MAX_MASK_EDGE * MAX_MASK_EDGE;
export const MIN_AREA_FRACTION = 0.005;
export const MAX_AREA_FRACTION = 0.6;

/** Shoelace area of a normalized polygon = its fraction of the whole image (aspect ratio cancels out). */
export function polygonAreaFraction(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Point;
    const b = points[(i + 1) % points.length] as Point;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** A hint (already shape-checked by `isValidRegionHint`) must cover between 0.5% and 60% of the frame. */
export function isUsableRegionArea(hint: RegionHint): boolean {
  const area = polygonAreaFraction(hint.points);
  return area >= MIN_AREA_FRACTION && area <= MAX_AREA_FRACTION;
}

function clampIndex(i: number, max: number): number {
  return i < 0 ? 0 : i > max ? max : i;
}

/** Ray-casting even-odd point-in-polygon test against pixel-space vertices. */
function pointInPolygon(px: number, py: number, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Point;
    const b = poly[j] as Point;
    const crosses = a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function boxBlur1D(src: Float32Array, dst: Float32Array, width: number, height: number, radius: number, horizontal: boolean): void {
  const windowSize = 2 * radius + 1;
  const outerLen = horizontal ? height : width;
  const innerLen = horizontal ? width : height;
  const at = (outer: number, inner: number) => (horizontal ? outer * width + inner : inner * width + outer);
  for (let outer = 0; outer < outerLen; outer += 1) {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) sum += src[at(outer, clampIndex(k, innerLen - 1))] as number;
    dst[at(outer, 0)] = sum / windowSize;
    for (let inner = 1; inner < innerLen; inner += 1) {
      const addIdx = clampIndex(inner + radius, innerLen - 1);
      const remIdx = clampIndex(inner - radius - 1, innerLen - 1);
      sum += (src[at(outer, addIdx)] as number) - (src[at(outer, remIdx)] as number);
      dst[at(outer, inner)] = sum / windowSize;
    }
  }
}

/** Default feather radius: about 1.5% of the short edge, at least 4 px. */
export function defaultFeatherPx(width: number, height: number): number {
  return Math.max(4, Math.round(0.015 * Math.min(width, height)));
}

/**
 * Alpha plane at `width × height`: 0 inside the polygon (editable), 255 outside. The polygon edge is
 * feathered INWARD only — pixels outside the selection stay fully opaque, so no blur can expose a
 * neighbouring feature.
 */
export function rasterizeEditAlpha(points: readonly Point[], width: number, height: number, featherPx?: number): Uint8Array {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Mask dimensions must be positive integers');
  }
  if (width > MAX_MASK_EDGE || height > MAX_MASK_EDGE || width * height > MAX_MASK_PIXELS) {
    throw new Error('Mask exceeds the size budget');
  }
  if (points.length < 3) throw new Error('Mask polygon needs at least three points');
  const radius = featherPx !== undefined ? Math.max(0, Math.round(featherPx)) : defaultFeatherPx(width, height);

  const alpha = new Float32Array(width * height).fill(255);
  const poly = points.map((p) => ({ x: p.x * width, y: p.y * height }));
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const startX = clampIndex(Math.floor(minX), width - 1);
  const endX = clampIndex(Math.ceil(maxX), width - 1);
  const startY = clampIndex(Math.floor(minY), height - 1);
  const endY = clampIndex(Math.ceil(maxY), height - 1);
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, poly)) alpha[y * width + x] = 0;
    }
  }

  const locked = Uint8Array.from(alpha, (v) => (v === 255 ? 1 : 0));
  if (radius >= 1) {
    const scratch = new Float32Array(width * height);
    boxBlur1D(alpha, scratch, width, height, radius, true);
    boxBlur1D(scratch, alpha, width, height, radius, false);
  }
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = locked[i] ? 255 : Math.min(255, Math.max(0, Math.round(alpha[i] as number)));
  }
  return out;
}

export interface CanvasGeometry {
  width: number;
  height: number;
  /** Where the original photo sits inside the padded canvas. */
  left: number;
  top: number;
}

/**
 * The provider canvas uses 16 px multiples and at least 655 360 px with an aspect ratio of at most
 * 3:1. Padding (not resizing) keeps original pixels and mask coordinates exact; the padding is
 * protected in the mask and cropped away after compositing.
 */
export function canvasGeometry(width: number, height: number): CanvasGeometry {
  const multiple = (value: number) => Math.ceil(value / 16) * 16;
  let w = multiple(width);
  let h = multiple(height);
  if (w * h < 655_360) {
    const landscape = w >= h;
    w = Math.max(w, landscape ? 1024 : 768);
    h = Math.max(h, landscape ? 768 : 1024);
  }
  if (w > 3 * h) h = multiple(w / 3);
  if (h > 3 * w) w = multiple(h / 3);
  return { width: w, height: h, left: Math.floor((w - width) / 2), top: Math.floor((h - height) / 2) };
}

/** Places the source-sized alpha plane on the canvas; padding is fully protected (255). */
export function placeAlphaOnCanvas(alpha: Uint8Array, width: number, height: number, canvas: CanvasGeometry): Uint8Array {
  const out = new Uint8Array(canvas.width * canvas.height).fill(255);
  for (let y = 0; y < height; y += 1) {
    const from = y * width;
    out.set(alpha.subarray(from, from + width), (y + canvas.top) * canvas.width + canvas.left);
  }
  return out;
}

// --- Minimal PNG encoder (8-bit RGBA, colour type 6) -------------------------------------------

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = (CRC_TABLE[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(Array.from(type, (ch) => ch.charCodeAt(0)));
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput));
  return out;
}

/** RGBA PNG whose RGB is black and whose alpha channel is `alpha` (0 = editable, 255 = locked). */
export function encodeMaskPng(alpha: Uint8Array, width: number, height: number): Buffer {
  if (alpha.length !== width * height) throw new Error('Alpha plane does not match dimensions');
  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + stride);
    for (let x = 0; x < width; x += 1) raw[rowStart + 1 + x * 4 + 3] = alpha[y * width + x] as number;
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const parts = [
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', new Uint8Array(deflateSync(raw))),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  return Buffer.concat(parts);
}
