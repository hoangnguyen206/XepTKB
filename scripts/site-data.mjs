#!/usr/bin/env node
// Copies the published dataset tree (data/published) into the web app's static folder for a site build (ADR-0012).
// Dev and e2e builds use the synthetic dataset instead (scripts/build-synthetic-dataset.mjs).
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { repoRoot } from "./lib/cli.mjs";
import { isSafeRelativePath, resolveSiteAllowUnpublished } from "./lib/dataset-core.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (message) => {
  console.error(`site-data: ${message}`);
  process.exit(1);
};

const target = resolve(process.argv[2] ?? join(repoRoot, "apps", "web", "public", "data"));
const source = process.env.DATASET_PUBLISHED_DIR ? resolve(process.env.DATASET_PUBLISHED_DIR) : join(repoRoot, "data", "published");
const manifestPath = join(source, "manifest.json");
if (!existsSync(manifestPath)) fail("data/published/manifest.json is missing");
if (lstatSync(manifestPath).isSymbolicLink()) fail("symlink not allowed at data/published/manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const isProductionOnly = !resolveSiteAllowUnpublished(process.env);

// SEC-M3-003(c) / SEC-M3-104(c): only copy verified, non-symlinked files referenced by the manifest;
// on production builds, strip candidate/validated entries and their artifacts so unpublished data is never served.
const allowedStatuses = isProductionOnly ? new Set(["published", "retracted"]) : new Set(["candidate", "validated", "published", "retracted"]);
const filteredDatasets = (manifest.datasets ?? []).filter((entry) => allowedStatuses.has(entry.status));

const toWrite = [];
for (const entry of filteredDatasets) {
  for (const artifact of entry.artifacts ?? []) {
    if (!isSafeRelativePath(artifact.url)) fail(`${entry.datasetVersion}: unsafe artifact url ${artifact.url}`);
    const srcFile = join(source, artifact.url);
    if (!existsSync(srcFile)) fail(`${entry.datasetVersion}: missing ${artifact.url}`);
    if (lstatSync(srcFile).isSymbolicLink()) fail(`${entry.datasetVersion}: symlink not allowed at ${artifact.url}`);
    const bytes = readFileSync(srcFile);
    if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
      fail(`${entry.datasetVersion}: ${artifact.url} does not match its recorded size/hash`);
    }
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (parsed.datasetVersion !== entry.datasetVersion) {
      fail(`${entry.datasetVersion}: ${artifact.url} names another datasetVersion`);
    }
    toWrite.push({ url: artifact.url, bytes });
  }
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const outManifest = isProductionOnly ? { ...manifest, datasets: filteredDatasets } : manifest;
writeFileSync(join(target, "manifest.json"), `${JSON.stringify(outManifest, null, 2)}\n`);
for (const item of toWrite) {
  const dest = join(target, item.url);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, item.bytes);
}
console.log(`site-data: copied ${filteredDatasets.length} dataset(s) → ${target}${isProductionOnly ? " (production-only filter)" : ""}`);
