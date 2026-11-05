import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "fluxo-caixa-local.spec.js",
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? "line" : "list",
  use: {
    browserName: "chromium",
    headless: true,
    baseURL: "http://127.0.0.1:4176",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "node ../scripts/serve-finance-local.mjs",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
