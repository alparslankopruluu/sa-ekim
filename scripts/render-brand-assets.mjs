#!/usr/bin/env node
/**
 * Renders Kök's brand PNGs from vector sources with headless Chromium (Google Chrome for Testing
 * from the Playwright cache, or CHROME_BIN):
 *   assets/images/icon.png                    1024×1024 opaque iOS/store icon (system masks corners)
 *   assets/images/android-icon-{foreground,background,monochrome}.png  adaptive icon layers (1024)
 *   assets/images/splash-icon.png             transparent splash mark
 *   assets/images/notification-icon.png       96×96 white-on-transparent Android status icon
 *   assets/images/favicon.png                 48×48 web favicon
 * The mark: a follicle at the base, three strands rising like a sprout, fine roots below.
 * Run: node scripts/render-brand-assets.mjs   (outputs are committed; builds never need this)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/images');
mkdirSync(OUT, { recursive: true });

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      const bin = join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
      if (existsSync(bin)) return bin;
    }
  }
  throw new Error('No Chromium found: set CHROME_BIN');
}

const COPPER = `
  <linearGradient id="cu" gradientUnits="userSpaceOnUse" x1="330" y1="270" x2="700" y2="860">
    <stop offset="0" stop-color="#F8E0A8"/><stop offset="0.5" stop-color="#E89A5B"/><stop offset="1" stop-color="#B4682F"/>
  </linearGradient>`;

/** The Kök mark in a 1024 box, centred on x = 512, spanning roughly y 250–860. */
function mark({ fill = 'url(#cu)', root = 0.55, scale = 1, dy = 0 } = {}) {
  return `<g transform="translate(512 ${540 + dy}) scale(${scale}) translate(-512 -540)" fill="none" stroke="${fill}" stroke-linecap="round">
    <path d="M512 650 C 512 540 500 430 524 282" stroke-width="30"/>
    <path d="M512 650 C 470 572 420 520 390 414" stroke-width="26"/>
    <path d="M512 650 C 556 576 622 530 658 424" stroke-width="26"/>
    <path d="M512 650 C 440 604 352 574 296 494" stroke-width="22"/>
    <path d="M512 650 C 584 608 672 584 728 508" stroke-width="22"/>
    <circle cx="512" cy="664" r="26" fill="${fill}" stroke="none"/>
    <g stroke-width="12" opacity="${root}">
      <path d="M512 694 C 512 752 484 792 442 824"/>
      <path d="M512 694 C 522 754 560 792 602 824"/>
      <path d="M512 694 C 510 770 514 814 512 858"/>
    </g>
  </g>`;
}

const page = (w, h, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${body}</body></html>`;

const svg = (w, h, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1024 1024">${inner}</svg>`;

const bg = `<defs><radialGradient id="bg" cx="0.5" cy="0.38" r="0.8">
    <stop offset="0" stop-color="#3A2519"/><stop offset="0.55" stop-color="#1B120D"/><stop offset="1" stop-color="#0D0A08"/>
  </radialGradient>${COPPER}</defs><rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="600" r="330" fill="#E89A5B" opacity="0.07"/>`;

const jobs = [
  { file: 'icon.png', size: 1024, body: svg(1024, 1024, `${bg}${mark({ scale: 1.08, dy: -10 })}`), opaque: true },
  { file: 'android-icon-background.png', size: 1024, body: svg(1024, 1024, `${bg}`), opaque: true },
  { file: 'android-icon-foreground.png', size: 1024, body: svg(1024, 1024, `<defs>${COPPER}</defs>${mark({ scale: 0.72, dy: 4 })}`) },
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    body: svg(1024, 1024, `<defs>${COPPER}</defs>${mark({ fill: '#FFFFFF', scale: 0.72, root: 1, dy: 4 })}`),
  },
  { file: 'splash-icon.png', size: 1024, body: svg(1024, 1024, `<defs>${COPPER}</defs>${mark({ scale: 1.0 })}`) },
  { file: 'notification-icon.png', size: 96, body: svg(96, 96, `${mark({ fill: '#FFFFFF', scale: 1.15, root: 1 })}`) },
  { file: 'favicon.png', size: 48, body: svg(48, 48, `${bg}${mark({ scale: 1.08, dy: -10 })}`), opaque: true },
];

const chrome = findChrome();
const tmp = join(tmpdir(), 'kok-brand');
mkdirSync(tmp, { recursive: true });
for (const job of jobs) {
  const htmlPath = join(tmp, `${job.file}.html`);
  writeFileSync(htmlPath, page(job.size, job.size, job.body));
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${job.size},${job.size}`,
      '--force-device-scale-factor=1',
      ...(job.opaque ? [] : ['--default-background-color=00000000']),
      `--screenshot=${join(OUT, job.file)}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  );
  process.stdout.write(`wrote ${job.file}\n`);
}
