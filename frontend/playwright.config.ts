import { defineConfig } from '@playwright/test';

if (!process.env.TRACESYNC_BROWSER_RUN_ID) throw new Error('Use npm run test:browser or npm run test:browser:live so test servers are isolated and stopped automatically.');

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    browserName: 'chromium',
    channel: process.env.TRACESYNC_BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  // The launcher owns direct server processes; normal preview servers are never reused.
});
