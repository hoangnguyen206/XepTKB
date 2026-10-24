#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const roots = ["packages"];
const allowedExtensions = new Set([".ts", ".mjs"]);
const forbidden = [
  { pattern: /\b(?:studentId|birthDate|fullName)\b/i, message: "PII field name in source" },
  { pattern: /\b(?:eval|Function)\s*\(/, message: "dynamic code execution" },
  { pattern: /fetch\s*\(/, message: "network access in foundation packages" },
];
const errors = [];

function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (allowedExtensions.has(full.slice(full.lastIndexOf(".")))) check(full);
  }
}

function check(file) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) {
        errors.push(`${relative(root, file)}:${index + 1}: ${rule.message}`);
      }
    }
  }
}

for (const path of roots) {
  if (statSync(join(root, path), { throwIfNoEntry: false })) walk(join(root, path));
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("lint: foundation checks passed");
}
