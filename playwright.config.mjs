import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.QA_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://belizelistings.bz";

export default defineConfig({
  testDir: "e2e/staging",
  testMatch: "**/*.spec.mjs",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "e2e-results/staging-report.json" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "mobile-414", use: { viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true } },
    { name: "desktop-1366", use: { viewport: { width: 1366, height: 768 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
