// Draw the app icons into public/ (the λ on the accent colour, as in the header logo).
//
//   node scripts/make-icons.mjs
//
// The λ is a path, not text, so it looks the same everywhere. PNGs are rendered with the
// Playwright driving the installed Chrome, as the browser tests do.

import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const ACCENT = '#5b4bd6';
const INK = '#ffffff';

/** The λ in a 512 box: the long stroke with its hook, and the short leg. */
const lambda = (stroke) => `
  <g fill="none" stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 118 C 190 104 214 126 232 168 L 336 392 C 344 410 356 416 378 410"/>
    <path d="M262 236 L 156 404"/>
  </g>`;

/** A rounded square with the λ (transparent corners): the ordinary icon and the favicon. */
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${ACCENT}"/>${lambda(58)}
</svg>`;

/** Full bleed, the λ inside the middle 80% (the safe zone of maskable and Apple icons). */
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${ACCENT}"/>
  <g transform="translate(256 256) scale(0.78) translate(-256 -256)">${lambda(62)}</g>
</svg>`;

const out = new URL('../public/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon.svg', out), rounded.trim() + '\n');

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' }); // as the browser tests
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
async function png(svg, size, name) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  writeFileSync(new URL(name, out), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
await png(rounded, 192, 'icon-192.png');
await png(rounded, 512, 'icon-512.png');
await png(fullBleed, 512, 'icon-maskable-512.png');
await png(fullBleed, 180, 'apple-touch-icon.png');
await png(rounded, 32, 'favicon-32.png');
await browser.close();
console.log('Icons written to public/');
