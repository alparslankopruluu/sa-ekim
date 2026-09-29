#!/usr/bin/env node
/**
 * Renders Belto's brand PNGs from vector sources with headless Chromium (Playwright):
 *   assets/images/icon.png                    1024×1024 opaque iOS/store icon (system masks corners)
 *   assets/images/android-icon-{foreground,background,monochrome}.png  adaptive icon layers
 *   assets/images/splash-icon.png             transparent splash mark
 *   assets/images/notification-icon.png       96×96 white-on-transparent Android status icon
 *   assets/images/favicon.png                 48×48 web favicon
 *   assets/images/samples/{nova,rex,mochi}.png 768×960 demo-star "photos" (original artwork)
 *
 * Run:  NODE_PATH="$(npm root -g)" node --experimental-strip-types scripts/render-brand-assets.mjs
 * (needs Playwright + Chromium; the output PNGs are committed so builds never need this).
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/images');
const { CHARACTERS } = await import(join(ROOT, 'src/features/demo/characters.ts'));

const PALETTES = {
  magenta: ['#FF2E88', '#FF7A1A'],
  sunset: ['#FF7A1A', '#FFD23F'],
  violet: ['#7B2FFF', '#FF2E88'],
  ocean: ['#1FB6FF', '#7B2FFF'],
  lime: ['#B6FF3D', '#1FD1A5'],
  gold: ['#FFD23F', '#FF8A00'],
  ember: ['#FF4D4D', '#8A1FD2'],
  rose: ['#FF7EB6', '#B14DFF'],
};

/** The Belto face: a sticker-outlined singer mid-note. Drawn in a 1024 box around (512,540). */
function face({ scale = 1, cx = 512, cy = 540, mono = false } = {}) {
  const ink = mono ? '#FFFFFF' : '#1B1036';
  const t = (x, y) => `${cx + (x - 512) * scale},${cy + (y - 540) * scale}`;
  const r = (v) => v * scale;
  if (mono) {
    return `
      <circle cx="${cx}" cy="${cy}" r="${r(276)}" fill="#FFFFFF"/>
      <ellipse cx="${cx}" cy="${cy + r(80)}" rx="${r(110)}" ry="${r(120)}" fill="#000000"/>
      <path d="M${t(392, 478)} q ${r(40)} ${r(-52)} ${r(80)} 0 M${t(552, 478)} q ${r(40)} ${r(-52)} ${r(80)} 0"
        stroke="#000000" stroke-width="${r(28)}" stroke-linecap="round" fill="none"/>`;
  }
  return `
    <circle cx="${cx}" cy="${cy}" r="${r(300)}" fill="#FF2E4F"/>
    <circle cx="${cx}" cy="${cy}" r="${r(276)}" fill="#FFFFFF"/>
    <circle cx="${cx}" cy="${cy}" r="${r(252)}" fill="#FFF1E4"/>
    <circle cx="${cx - r(150)}" cy="${cy + r(40)}" r="${r(42)}" fill="#FF9DB3" opacity="0.7"/>
    <circle cx="${cx + r(150)}" cy="${cy + r(40)}" r="${r(42)}" fill="#FF9DB3" opacity="0.7"/>
    <path d="M${t(392, 478)} q ${r(40)} ${r(-52)} ${r(80)} 0 M${t(552, 478)} q ${r(40)} ${r(-52)} ${r(80)} 0"
      stroke="${ink}" stroke-width="${r(28)}" stroke-linecap="round" fill="none"/>
    <ellipse cx="${cx}" cy="${cy + r(86)}" rx="${r(112)}" ry="${r(124)}" fill="#5B1030"/>
    <rect x="${cx - r(76)}" y="${cy - r(26)}" width="${r(152)}" height="${r(40)}" rx="${r(16)}" fill="#FFFFFF"/>
    <ellipse cx="${cx}" cy="${cy + r(156)}" rx="${r(72)}" ry="${r(46)}" fill="#FF6B8A"/>`;
}

function sparkle(x, y, s, color) {
  return `<path d="M${x} ${y - s} C ${x + s * 0.18} ${y - s * 0.18}, ${x + s * 0.18} ${y - s * 0.18}, ${x + s} ${y}
    C ${x + s * 0.18} ${y + s * 0.18}, ${x + s * 0.18} ${y + s * 0.18}, ${x} ${y + s}
    C ${x - s * 0.18} ${y + s * 0.18}, ${x - s * 0.18} ${y + s * 0.18}, ${x - s} ${y}
    C ${x - s * 0.18} ${y - s * 0.18}, ${x - s * 0.18} ${y - s * 0.18}, ${x} ${y - s} Z" fill="${color}"/>`;
}

function note(x, y, s, color) {
  return `<g fill="${color}">
    <rect x="${x + s * 0.62}" y="${y - s * 1.3}" width="${s * 0.16}" height="${s * 1.3}" rx="${s * 0.06}"/>
    <path d="M${x + s * 0.7} ${y - s * 1.3} q ${s * 0.6} ${s * 0.1} ${s * 0.7} ${s * 0.6} q -${s * 0.2} -${s * 0.3} -${s * 0.7} -${s * 0.28} Z"/>
    <ellipse cx="${x + s * 0.4}" cy="${y}" rx="${s * 0.36}" ry="${s * 0.28}" transform="rotate(-20 ${x + s * 0.4} ${y})"/>
  </g>`;
}

const backgroundSvg = (size) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF2E88"/><stop offset="0.6" stop-color="#FF7A1A"/><stop offset="1" stop-color="#FFD23F"/>
    </linearGradient>
    <radialGradient id="spot" cx="28%" cy="18%" r="65%">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.38"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#spot)"/>`;

function svgDoc(width, height, body, background = 'transparent') {
  return `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${background}}svg{display:block}</style></head>
  <body><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg></body></html>`;
}

function shapeSvg(shape) {
  const opacity = shape.opacity !== undefined ? ` opacity="${shape.opacity}"` : '';
  switch (shape.t) {
    case 'circle':
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${shape.fill}"${opacity}/>`;
    case 'ellipse': {
      const rot = shape.rotate ? ` transform="rotate(${shape.rotate} ${shape.cx} ${shape.cy})"` : '';
      return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" fill="${shape.fill}"${opacity}${rot}/>`;
    }
    case 'rect': {
      const rot = shape.rotate
        ? ` transform="rotate(${shape.rotate} ${shape.x + shape.w / 2} ${shape.y + shape.h / 2})"`
        : '';
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.rx ?? 0}" fill="${shape.fill}"${opacity}${rot}/>`;
    }
    case 'path':
      return `<path d="${shape.d}" fill="${shape.fill ?? 'none'}" stroke="${shape.stroke ?? 'none'}" stroke-width="${shape.strokeWidth ?? 0}" stroke-linecap="round"${opacity}/>`;
    default:
      return '';
  }
}

/** A demo star "photo": palette poster backdrop, halftone dots, the character singing mid-note. */
function sampleSvg(character) {
  const [from, to] = PALETTES[character.palette];
  const m = character.mouth;
  const mouthOpen = 0.75;
  const ry = m.closedRy + (m.openRy - m.closedRy) * mouthOpen;
  const dots = Array.from({ length: 90 }, (_, i) => {
    const x = (i * 97) % 768;
    const y = (i * 53) % 960;
    return `<circle cx="${x}" cy="${y}" r="${3 + (i % 4)}" fill="#FFFFFF" opacity="0.12"/>`;
  }).join('');
  const parts = [...character.back, ...character.head].map(shapeSvg).join('');
  const mouth = `<ellipse cx="${m.cx}" cy="${m.cy}" rx="${(m.width / 2) * (1 - 0.18 * mouthOpen)}" ry="${ry}" fill="${m.cavity}"/>
    <ellipse cx="${m.cx}" cy="${m.cy + ry * 0.5}" rx="${(m.width / 2) * 0.55}" ry="${ry * 0.42}" fill="${m.tongue}"/>`;
  const front = character.front.map(shapeSvg).join('');
  return `
    <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="55%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>
    <rect width="768" height="960" fill="url(#p)"/>${dots}<rect width="768" height="960" fill="url(#glow)"/>
    <g transform="translate(24 96) scale(3.6)">${parts}${mouth}${front}</g>`;
}

async function shot(page, html, file, width, height, omitBackground = false) {
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  await page.screenshot({ path: file, omitBackground, clip: { x: 0, y: 0, width, height } });
  console.log(`wrote ${file.replace(`${ROOT}/`, '')} (${width}×${height})`);
}

mkdirSync(join(OUT, 'samples'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();

const iconBody = `${backgroundSvg(1024)}${face({ scale: 0.95, cy: 548 })}
  ${sparkle(206, 214, 58, '#FFFFFF')}${sparkle(846, 300, 40, '#FFF6C9')}${note(770, 190, 110, '#FFFFFF')}`;
await shot(page, svgDoc(1024, 1024, iconBody), join(OUT, 'icon.png'), 1024, 1024);
await shot(page, svgDoc(1024, 1024, backgroundSvg(1024)), join(OUT, 'android-icon-background.png'), 1024, 1024);
await shot(
  page,
  svgDoc(1024, 1024, `${face({ scale: 0.62, cy: 530 })}${note(690, 330, 70, '#FFFFFF')}`),
  join(OUT, 'android-icon-foreground.png'),
  1024,
  1024,
  true,
);
await shot(
  page,
  svgDoc(1024, 1024, face({ scale: 0.62, cy: 530, mono: true })),
  join(OUT, 'android-icon-monochrome.png'),
  1024,
  1024,
  true,
);
await shot(page, svgDoc(1024, 1024, face({ scale: 1.2, cy: 512 })), join(OUT, 'splash-icon.png'), 1024, 1024, true);
await shot(
  page,
  svgDoc(96, 96, `<g transform="scale(0.09375)">${face({ scale: 1.25, cy: 512, mono: true })}</g>`),
  join(OUT, 'notification-icon.png'),
  96,
  96,
  true,
);
await shot(page, svgDoc(48, 48, `<g transform="scale(0.046875)">${iconBody}</g>`), join(OUT, 'favicon.png'), 48, 48);

for (const character of CHARACTERS) {
  await shot(page, svgDoc(768, 960, sampleSvg(character)), join(OUT, 'samples', `${character.id}.png`), 768, 960);
}

await browser.close();
