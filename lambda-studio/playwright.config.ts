import { defineConfig } from '@playwright/test';

// Browser smoke tests for what unit tests cannot reach: keyboard scope, share links and the
// timeline while a run is in progress. They use the installed Chrome (PW_CHANNEL=msedge for Edge),
// so no browser download is needed.  Run: npm run test:e2e
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5199',
    channel: process.env.PW_CHANNEL ?? 'chrome',
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
