/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { Plugin } from 'vite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * precache.json: every file of the build, for the service worker (public/sw.js) to cache on
 * install. Listed from what was written (Vite drops some planned chunks, e.g. CSS-only ones).
 */
const precacheList = (base: string): Plugin => ({
  name: 'precache-list',
  apply: 'build',
  writeBundle(options) {
    const dir = options.dir!;
    const files = readdirSync(join(dir, 'assets')).map((f) => `${base}assets/${f}`).sort();
    writeFileSync(join(dir, 'precache.json'), JSON.stringify(files));
  },
});

/**
 * The single-file build ships no files beside index.html, so its links to icons, the manifest and
 * social images would point at nothing. Drop them and put the SVG favicon inline instead.
 */
const inlineFavicon = (): Plugin => ({
  name: 'inline-favicon',
  apply: 'build',
  transformIndexHtml(html) {
    const svg = readFileSync(new URL('./public/icon.svg', import.meta.url), 'utf8').trim();
    const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    return html
      .replace(/^[ \t]*<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\r?\n/gm, '')
      .replace(/^[ \t]*<meta (property="og:image|name="twitter:card)[^>]*>\r?\n/gm, '')
      .replace('</title>', `</title>\n    <link rel="icon" type="image/svg+xml" href="${href}" />`);
  },
});

/**
 * The link-preview image needs a full address where the site has one (SITE_URL, set by the GitHub
 * Pages workflow); elsewhere it stays a path on the site.
 */
const previewImage = (base: string): Plugin => ({
  name: 'preview-image',
  transformIndexHtml(html) {
    const site = process.env.SITE_URL?.replace(/\/?$/, '/');
    return html.replace('content="/og-image.png"', `content="${site ?? base}og-image.png"`);
  },
});

/**
 * Where the site lives. "/" for your own copy and the dev server; GitHub Pages serves it under the
 * repository's name, so its workflow sets BASE_PATH=/lambda-studio/. Everything else (icons,
 * manifest, service worker, the offline file list) follows it.
 */
const base = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

// `vite build --mode single` makes one self-contained HTML file (dist-single/index.html) that
// works offline: scripts, styles, fonts and the workers are all inlined.
export default defineConfig(({ mode }) => ({
  base: mode === 'single' ? '/' : base, // the single file inlines everything, so its base never matters
  plugins: mode === 'single' ? [react(), inlineFavicon(), viteSingleFile({ removeViteModuleLoader: true })] : [react(), precacheList(base), previewImage(base)],
  worker: { format: 'es' },
  publicDir: mode === 'single' ? false : 'public', // one file: no icons, manifest or service worker beside it
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 5000 } : { chunkSizeWarningLimit: 1000 },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
}));
