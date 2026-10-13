import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Opt-in visible owner acceptance; ordinary CI stays fast and headless.
export default defineConfig({
  ...base,
  timeout: 120_000,
  workers: 1,
  retries: 0,
  outputDir: '../output/playwright/headed-regression',
  reporter: [
    ['list'],
    ['json', { outputFile: '../output/playwright/headed-results.json' }],
  ],
  use: {
    ...base.use,
    headless: false,
    launchOptions: { slowMo: 250 },
  },
});
