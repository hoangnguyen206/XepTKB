import { defineConfig, devices } from "@playwright/test";

const PORT = 4180;

/** E2E runs against the production build (service worker + CSP) with the synthetic dataset. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    acceptDownloads: true,
    trace: "retain-on-failure",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { VITE_ALLOW_UNPUBLISHED: "true" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
