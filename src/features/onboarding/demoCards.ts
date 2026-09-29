/**
 * Welcome demo cards, drawn in code: two neutral gradient placeholders for the before/after
 * wipe. No faces, no hair, no numbers — the caption says it is an illustration. Real previews
 * only ever come from the user's own photo.
 */
import { colors, palettes } from '@/theme/tokens';

function svg(from: string, to: string, glow: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">',
    '<defs>',
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`,
    `<radialGradient id="r" cx="50%" cy="34%" r="62%"><stop offset="0" stop-color="${glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>`,
    '</defs>',
    '<rect width="600" height="800" fill="url(#g)"/>',
    '<rect width="600" height="800" fill="url(#r)"/>',
    '</svg>',
  ].join('');
}

function toDataUri(markup: string): string {
  const encoded =
    typeof btoa === 'function' ? `;base64,${btoa(markup)}` : `;utf8,${encodeURIComponent(markup)}`;
  return `data:image/svg+xml${encoded}`;
}

const [copperLight, copperDark] = palettes.copper;

export const DEMO_BEFORE = toDataUri(svg(colors.surfaceHigh, colors.bgElevated, colors.textTertiary));
export const DEMO_AFTER = toDataUri(svg(copperDark, colors.surface, copperLight));
