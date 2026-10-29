#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const allowedExtensions = new Set([".ts", ".tsx", ".mjs"]);
const ignoredDirectories = new Set(["node_modules", "dist", "test-results", "playwright-report"]);

const common = [
  { pattern: /\b(?:studentId|birthDate|fullName)\b/i, message: "PII field name in source" },
  { pattern: /\b(?:eval|Function)\s*\(/, message: "dynamic code execution" },
];
const packageRules = [
  ...common,
  { pattern: /fetch\s*\(/, message: "network access in foundation packages" },
];
// apps/web: one network module (ADR-0010 §4) and no HTML injection sinks.
const NETWORK_MODULE = ["apps", "web", "src", "data", "loader.ts"].join(sep);
const webRules = [
  ...common,
  { pattern: /fetch\s*\(/, message: "network access outside the artifact loader", allow: (file) => file.endsWith(NETWORK_MODULE) },
  { pattern: /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write/, message: "HTML injection sink" },
  { pattern: /\blocalStorage\b|\bsessionStorage\b|document\.cookie/, message: "storage outside IndexedDB" },
];
const scopes = [
  { path: "packages", rules: packageRules },
  { path: join("apps", "web", "src"), rules: webRules },
];
const errors = [];

function walk(path, rules) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(full, rules);
    } else if (allowedExtensions.has(full.slice(full.lastIndexOf(".")))) check(full, rules);
  }
}

function check(file, rules) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const rule of rules) {
      if (rule.pattern.test(line) && !rule.allow?.(file)) {
        errors.push(`${relative(root, file)}:${index + 1}: ${rule.message}`);
      }
    }
  }
}

for (const scope of scopes) {
  if (statSync(join(root, scope.path), { throwIfNoEntry: false })) walk(join(root, scope.path), scope.rules);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("lint: foundation and web boundary checks passed");
}
