/**
 * A tiny 5×7 pixel font for burned-in labels. The bundled ffmpeg build has no
 * `drawtext` filter (FFmpeg 7 requires harfbuzz for it) and Cloud Functions
 * images do not guarantee system fonts, so labels are rasterized here and
 * composited with ffmpeg's `overlay` filter instead. Pure and deterministic.
 *
 * Each glyph is 7 rows; bit 4 (0x10) is the leftmost of 5 columns.
 */

const GLYPHS: Record<string, readonly number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  d: [0x01, 0x01, 0x0d, 0x13, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  h: [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  t: [0x08, 0x08, 0x1c, 0x08, 0x08, 0x09, 0x06],
  w: [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  '·': [0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00],
};

export const GLYPH_HEIGHT = 7;
const GLYPH_WIDTH = 5;
const SPACE_WIDTH = 3;
const LETTER_SPACING = 1;

export function hasGlyphs(text: string): boolean {
  return [...text].every((ch) => ch === ' ' || ch in GLYPHS);
}

function advance(ch: string): number {
  return ch === ' ' ? SPACE_WIDTH : GLYPH_WIDTH;
}

/** Width of `text` in font units (no trailing letter spacing). */
export function textWidthUnits(text: string): number {
  const chars = [...text];
  if (chars.length === 0) return 0;
  return chars.reduce((sum, ch) => sum + advance(ch), 0) + LETTER_SPACING * (chars.length - 1);
}

/** Font-unit coordinates of every lit pixel. Unknown characters render blank. */
export function textPixels(text: string): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  let cursor = 0;
  for (const ch of text) {
    const rows = GLYPHS[ch];
    if (rows) {
      rows.forEach((bits, y) => {
        for (let col = 0; col < GLYPH_WIDTH; col += 1) {
          if (bits & (0x10 >> col)) out.push({ x: cursor + col, y });
        }
      });
    }
    cursor += advance(ch) + LETTER_SPACING;
  }
  return out;
}
