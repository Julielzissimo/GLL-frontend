import { defineConfig } from '@playwright/test';
import config from './playwright.config.js';
export default defineConfig({
  ...config,
  testMatch: 'radar-compact.spec.js',
  webServer: { command: 'node scripts/serve-radar-fixtures.mjs', url: 'http://127.0.0.1:4187', reuseExistingServer: !process.env.CI },
});
