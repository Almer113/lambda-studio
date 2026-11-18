/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { Plugin } from 'vite';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * precache.json: every file of the build, for the service worker (public/sw.js) to cache on
 * install. Listed from what was written (Vite drops some planned chunks, e.g. CSS-only ones).
 */
const precacheList = (): Plugin => ({
  name: 'precache-list',
  apply: 'build',
  writeBundle(options) {
    const dir = options.dir!;
    const files = readdirSync(join(dir, 'assets')).map((f) => `/assets/${f}`).sort();
    writeFileSync(join(dir, 'precache.json'), JSON.stringify(files));
  },
});

// `vite build --mode single` makes one self-contained HTML file (dist-single/index.html) that
// works offline: scripts, styles, fonts and the workers are all inlined.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile({ removeViteModuleLoader: true })] : [react(), precacheList()],
  worker: { format: 'es' },
  publicDir: mode === 'single' ? false : 'public', // one file: no icons, manifest or service worker beside it
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 5000 } : { chunkSizeWarningLimit: 1000 },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
}));
