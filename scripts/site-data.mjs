#!/usr/bin/env node
// Copies the published dataset tree (data/published) into the web app's static folder for a site build (ADR-0012).
// Dev and e2e builds use the synthetic dataset instead (scripts/build-synthetic-dataset.mjs).
import { cpSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { repoRoot } from "./lib/cli.mjs";

const target = resolve(process.argv[2] ?? join(repoRoot, "apps", "web", "public", "data"));
const source = join(repoRoot, "data", "published");
if (!existsSync(join(source, "manifest.json"))) {
  console.error("site-data: data/published/manifest.json is missing");
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`site-data: copied data/published → ${target}`);
