import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? "line" : "list",
  use: {
    browserName: "chromium",
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
});
