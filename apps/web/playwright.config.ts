import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4380);
/** SEC-M3-003: the e2e build allows unpublished data, so it is written apart from the release build in `dist/`. */
const OUT_DIR = "dist-e2e";

/**
 * DESIGN-M6-001 §12 / AC-M6-19: screenshot comparison runs only in the `visual` project, which exists only when
 * `KY_NAY_VISUAL=1` (CI job `visual`, `npm run test:visual`). Baselines are made on the pinned Linux runner, so the
 * project refuses to run anywhere else (the Playwright Docker image of the same version is Linux and is accepted).
 * Baseline file names carry no platform suffix.
 */
const VISUAL = process.env.KY_NAY_VISUAL === "1";
if (VISUAL && process.platform !== "linux") {
  throw new Error(
    `KY_NAY_VISUAL=1: screenshot baselines are only made and compared on Linux (CI job "visual" or the Playwright Docker image), not on ${process.platform}.`,
  );
}
/** Specs that only the `visual` project runs. `gallery.spec.ts` keeps its axe checks in `chromium` too (F1b). */
const VISUAL_ONLY_SPECS = /(?:^|[\\/])visual\.spec\.ts$/;
const VISUAL_SPECS = /(?:^|[\\/])(?:visual|gallery)\.spec\.ts$/;

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
    // DESIGN-M5-001 §9: a report URL on a reserved TLD; it reaches the bundle once vite.config.ts defines
    // `__KY_NAY_REPORT_URL__` from it (WP2). e2e/m5.spec.ts checks the link through the rendered DOM either way.
    // KY_NAY_GALLERY=1 adds gallery.html (component gallery) to this e2e build only (DESIGN-M6-001 §12).
    env: {
      VITE_ALLOW_UNPUBLISHED: "true",
      VITE_REPORT_ISSUE_URL: process.env.VITE_REPORT_ISSUE_URL ?? "https://example.invalid/report",
      KY_NAY_GALLERY: "1",
    },
  },
  projects: [
    { name: "chromium", testIgnore: VISUAL_ONLY_SPECS, use: { ...devices["Desktop Chrome"] } },
    ...(process.env.E2E_WEBKIT === "1" ? [{ name: "webkit", testIgnore: VISUAL_ONLY_SPECS, use: { ...devices["Desktop Safari"] } }] : []),
    ...(VISUAL
      ? [
          {
            name: "visual",
            testMatch: VISUAL_SPECS,
            snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
            expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" as const, caret: "hide" as const } },
            use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" as const },
          },
        ]
      : []),
  ],
});
