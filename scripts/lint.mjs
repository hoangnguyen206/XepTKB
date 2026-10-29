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
// SEC-M3-005: any reference to a network API (not only `fetch(`), so aliases such as `const f = fetch` are caught too.
const NETWORK_API = /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|importScripts)\b/;
const packageRules = [
  ...common,
  { pattern: NETWORK_API, message: "network access in foundation packages" },
];
// apps/web: one network module (ADR-0010 §4) and no HTML injection sinks.
const NETWORK_MODULE = ["apps", "web", "src", "data", "loader.ts"].join(sep);
// Tests stub `fetch`; they are never part of a build.
const isTestFile = (file) => /\.test\.tsx?$/.test(file) || file.includes(`${sep}test${sep}`);
const webRules = [
  ...common,
  { pattern: NETWORK_API, message: "network access outside the artifact loader", allow: (file) => file.endsWith(NETWORK_MODULE) || isTestFile(file) },
  { pattern: /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write/, message: "HTML injection sink" },
  { pattern: /\blocalStorage\b|\bsessionStorage\b|document\.cookie/, message: "storage outside IndexedDB" },
];
// The service worker source is generated from vite.config.ts: it may only pass same-origin requests through
// (`fetch(request)`), never open another channel.
const workerRules = [
  { pattern: /\b(?:XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|importScripts)\b/, message: "network channel in the service worker" },
  { pattern: /(?<!["'])\bfetch\b(?!\(request\))/, message: "service worker fetch other than the same-origin passthrough `fetch(request)`" },
];
const scopes = [
  { path: "packages", rules: packageRules },
  { path: join("apps", "web", "src"), rules: webRules },
  { path: join("apps", "web", "vite.config.ts"), rules: workerRules },
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

/** Blanks comments but keeps line breaks, so a match still reports the right line and prose never trips a rule. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|(?<![:"'`\\])\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, " "));
}

function check(file, rules) {
  // Whole-file matching catches a call split over lines (`fetch\n(`), which a per-line check misses (SEC-M3-005).
  const source = stripComments(readFileSync(file, "utf8"));
  for (const rule of rules) {
    if (rule.allow?.(file)) continue;
    const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    for (const match of source.matchAll(global)) {
      const line = source.slice(0, match.index).split("\n").length;
      errors.push(`${relative(root, file)}:${line}: ${rule.message}`);
    }
  }
}

for (const scope of scopes) {
  const target = join(root, scope.path);
  const stat = statSync(target, { throwIfNoEntry: false });
  if (stat?.isDirectory()) walk(target, scope.rules);
  else if (stat?.isFile()) check(target, scope.rules);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("lint: foundation and web boundary checks passed");
}
