import { defineConfig, devices } from "@playwright/test";

const PORT = 4180;
/** SEC-M3-003: the e2e build allows unpublished data, so it is written apart from the release build in `dist/`. */
const OUT_DIR = "dist-e2e";

/** E2E runs against a production build (service worker + CSP) with the synthetic dataset. */
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
    command: `npm run build -- --outDir ${OUT_DIR} && npx vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { VITE_ALLOW_UNPUBLISHED: "true" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
