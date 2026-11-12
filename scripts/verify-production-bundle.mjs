#!/usr/bin/env node
// Verifies that a production site build (`apps/web/dist`) disables unpublished datasets (`allowUnpublished:!1`),
// strips candidate/validated entries from `dist/data/manifest.json`, and emits `_headers` and `sw.js` (SEC-M3-003, SEC-M3-007).
// M5: also the `ky-nay-build` meta tag (M5-A), the PNG icons (M5-G) and the no-telemetry checks (AC-M5-18).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ICON_TARGETS, readPngSize } from "./generate-icons.mjs";
import { readDefaultReportUrl, resolveReportUrlSetting } from "./lib/build-identity.mjs";
import { repoRoot } from "./lib/cli.mjs";

const fail = (message) => {
  console.error(`verify-production-bundle: ${message}`);
  process.exit(1);
};

const distDir = resolve(process.argv[2] ?? join(repoRoot, "apps", "web", "dist"));
if (!existsSync(distDir)) fail(`dist directory not found: ${distDir} (run 'npm run build:web' first)`);

const headersPath = join(distDir, "_headers");
if (!existsSync(headersPath)) fail("missing _headers in production bundle");
const headersText = readFileSync(headersPath, "utf8");
for (const expected of ["Content-Security-Policy:", "frame-ancestors 'none'", "X-Frame-Options: DENY", "X-Content-Type-Options: nosniff"]) {
  if (!headersText.includes(expected)) fail(`_headers missing required directive: ${expected}`);
}

const swPath = join(distDir, "sw.js");
if (!existsSync(swPath)) fail("missing sw.js in production bundle");

const manifestPath = join(distDir, "data", "manifest.json");
if (!existsSync(manifestPath)) fail("missing data/manifest.json in production bundle");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
for (const entry of manifest.datasets ?? []) {
  if (entry.status !== "published" && entry.status !== "retracted") {
    fail(`unpublished dataset ${entry.datasetVersion} (${entry.status}) present in production dist/data/manifest.json`);
  }
}

const assetsDir = join(distDir, "assets");
if (!existsSync(assetsDir)) fail("missing assets/ directory in production bundle");
const jsFiles = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
if (jsFiles.length === 0) fail("no .js files found in dist/assets/");

let foundAllowFalse = false;
for (const file of jsFiles) {
  const code = readFileSync(join(assetsDir, file), "utf8");
  if (/allowUnpublished\s*:\s*(?:!0|true)\b/.test(code)) {
    fail(`${file} enables allowUnpublished in a production build`);
  }
  if (/allowUnpublished\s*:\s*(?:!1|false)\b/.test(code)) {
    foundAllowFalse = true;
  }
}
if (!foundAllowFalse) {
  fail("could not find `allowUnpublished:!1` (or `allowUnpublished:false`) in dist/assets/*.js");
}

// M5-A: build identity meta tag (read back by scripts/smoke-deploy.mjs).
const indexPath = join(distDir, "index.html");
if (!existsSync(indexPath)) fail("missing index.html in production bundle");
const indexHtml = readFileSync(indexPath, "utf8");
const buildMeta = /<meta name="ky-nay-build" content="([^"]+)"/.exec(indexHtml)?.[1];
if (!buildMeta) fail('index.html is missing <meta name="ky-nay-build">');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\+(?:[0-9a-f]{7}(?:-dirty)?|unknown)$/.test(buildMeta)) {
  fail(`ky-nay-build meta has an unexpected value: ${buildMeta}`);
}

// M5-G: PNG icons exist with the right size, are linked from manifest/index.html and are precached by sw.js.
const swText = readFileSync(swPath, "utf8");
for (const icon of ICON_TARGETS) {
  const file = join(distDir, icon.path);
  if (!existsSync(file)) fail(`missing ${icon.path} in production bundle`);
  let size;
  try {
    size = readPngSize(readFileSync(file));
  } catch (error) {
    fail(`${icon.path}: ${error.message}`);
  }
  if (size.width !== icon.size || size.height !== icon.size) fail(`${icon.path} is ${size.width}×${size.height}, expected ${icon.size}×${icon.size}`);
  if (!swText.includes(`"./${icon.path}"`)) fail(`sw.js does not precache ./${icon.path}`);
}
if (!/<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png"/.test(indexHtml)) fail("index.html is missing the apple-touch-icon link");
const webManifest = JSON.parse(readFileSync(join(distDir, "manifest.webmanifest"), "utf8"));
const manifestIcons = webManifest.icons ?? [];
for (const [src, purpose] of [["icons/icon-192.png", "any"], ["icons/icon-512.png", "any"], ["icons/icon-maskable-512.png", "maskable"]]) {
  if (!manifestIcons.some((icon) => icon.src === src && icon.type === "image/png" && String(icon.purpose).split(/\s+/).includes(purpose))) {
    fail(`manifest.webmanifest does not list ${src} with purpose "${purpose}"`);
  }
}

// AC-M5-18 / ADR-0014 point 1: no telemetry. CSP keeps connect-src 'self'; no beacon; no third-party origin in code
// apart from the inert strings below (React error links, XML/SVG namespace URIs used by the registration parser).
const cspMeta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(indexHtml)?.[1];
if (!cspMeta || !cspMeta.split(";").map((part) => part.trim()).includes("connect-src 'self'")) fail("index.html CSP must keep connect-src 'self'");
if (!headersText.includes("connect-src 'self'")) fail("_headers CSP must keep connect-src 'self'");
const INERT_ORIGINS = new Set(["react.dev", "www.w3.org"]);
// The report link (ADR-0014 point 4) is a build-time constant rendered as a plain <a>; its host may appear in the code.
const reportUrl = resolveReportUrlSetting(process.env.VITE_REPORT_ISSUE_URL, readDefaultReportUrl());
if (reportUrl) INERT_ORIGINS.add(new URL(reportUrl).hostname.toLowerCase());
for (const file of jsFiles) {
  const code = readFileSync(join(assetsDir, file), "utf8");
  if (/\bsendBeacon\b/.test(code)) fail(`${file} references sendBeacon (no telemetry, ADR-0014)`);
  for (const [, host] of code.matchAll(/\b(?:https?|wss?):\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
    if (!INERT_ORIGINS.has(host.toLowerCase())) fail(`${file} references third-party origin ${host} (no telemetry, ADR-0014)`);
  }
}

console.log(
  `verify-production-bundle: OK (${jsFiles.length} JS asset(s), allowUnpublished:!1, _headers + sw.js present, ky-nay-build=${buildMeta}, ${ICON_TARGETS.length} PNG icons, no third-party origins)`,
);
