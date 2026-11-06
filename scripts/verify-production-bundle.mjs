#!/usr/bin/env node
// Verifies that a production site build (`apps/web/dist`) disables unpublished datasets (`allowUnpublished:!1`),
// strips candidate/validated entries from `dist/data/manifest.json`, and emits `_headers` and `sw.js` (SEC-M3-003, SEC-M3-007).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
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

console.log(`verify-production-bundle: OK (${jsFiles.length} JS asset(s), allowUnpublished:!1, _headers + sw.js present)`);
