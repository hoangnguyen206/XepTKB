#!/usr/bin/env node
// Runs the compiled node:test suites of every package. Listing files here instead of passing a
// glob keeps `npm test` working on Node versions whose test runner does not expand globs.
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const files = [];
for (const pkg of readdirSync("packages")) {
  const dir = join("packages", pkg, "dist", "test");
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) if (name.endsWith(".test.js")) files.push(join(dir, name));
}
if (files.length === 0) {
  console.error("run-node-tests: no compiled tests found; run the build first");
  process.exit(1);
}
const result = spawnSync(process.execPath, ["--test", ...files.sort()], { stdio: "inherit" });
process.exit(result.status ?? 1);
