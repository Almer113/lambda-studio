/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` makes one self-contained HTML file (dist-single/index.html) that
// works offline: scripts, styles, fonts and the workers are all inlined.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile({ removeViteModuleLoader: true })] : [react()],
  worker: { format: 'es' },
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 5000 } : { chunkSizeWarningLimit: 1000 },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
}));
