#!/usr/bin/env node
// M5-F bundle budget (DESIGN-M5-001 §5 item 5, SPEC-M5-001 §8, AC-M5-11).
//   node scripts/check-bundle-budget.mjs [distDir] [--budget scripts/bundle-budget.json]
// Classifies dist/assets files from dist/index.html: the entry module script, its modulepreloads and its stylesheets
// form the initial set; every other assets/*.js is lazy. Sizes are raw bytes and gzip (node:zlib, level 9).
// Prints a table plus one `bundle-budget-json {…}` line for evidence; exits 1 when a budget is exceeded or when the
// registration chunk is part of the initial set.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
export const DEFAULT_BUDGET_FILE = join(repoRoot, "scripts", "bundle-budget.json");
const NUMERIC_LIMITS = ["initialJsGzipMax", "initialCssGzipMax", "totalJsGzipMax", "lazyChunkGzipMax"];

/** Validates the budget JSON; numeric limits are positive integers (bytes, gzip) or `null` (not enforced). */
export function parseBudget(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("budget must be a JSON object");
  for (const key of NUMERIC_LIMITS) {
    const limit = value[key];
    if (limit !== null && !(Number.isInteger(limit) && limit > 0)) throw new Error(`budget.${key} must be a positive integer or null`);
  }
  if (typeof value.requireLazyChunkPrefix !== "string" || value.requireLazyChunkPrefix === "") {
    throw new Error("budget.requireLazyChunkPrefix must be a non-empty string");
  }
  if (typeof value.requireLazyChunk !== "boolean") throw new Error("budget.requireLazyChunk must be a boolean");
  const markers = value.initialForbiddenMarkers ?? [];
  if (!Array.isArray(markers) || markers.some((marker) => typeof marker !== "string" || marker === "")) {
    throw new Error("budget.initialForbiddenMarkers must be an array of non-empty strings");
  }
  return { ...value, initialForbiddenMarkers: markers };
}

const attr = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];

/** Local asset paths (relative to dist, POSIX) that index.html loads up front. */
export function initialAssetsFromHtml(html) {
  const initial = new Set();
  const add = (url) => {
    if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return;
    initial.add(posix.normalize(url.replace(/^\.?\//, "").split(/[?#]/)[0]));
  };
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if ((attr(tag, "type") ?? "").toLowerCase() === "module") add(attr(tag, "src"));
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    if (rel.includes("modulepreload") || rel.includes("stylesheet")) add(attr(tag, "href"));
  }
  return initial;
}

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

/** Measures dist and compares it with the budget. Pure apart from reading files; returns the report object. */
export function checkBundleBudget(distDir, budget) {
  const indexPath = join(distDir, "index.html");
  if (!existsSync(indexPath)) throw new Error(`missing ${indexPath} (run 'npm run build:web' first)`);
  const assetsDir = join(distDir, "assets");
  if (!existsSync(assetsDir)) throw new Error(`missing ${assetsDir}`);
  const initialSet = initialAssetsFromHtml(readFileSync(indexPath, "utf8"));
  const files = [];
  for (const name of readdirSync(assetsDir).sort()) {
    if (!name.endsWith(".js") && !name.endsWith(".css")) continue;
    const path = `assets/${name}`;
    const bytes = readFileSync(join(assetsDir, name));
    files.push({
      file: path,
      type: name.endsWith(".js") ? "js" : "css",
      initial: initialSet.has(path),
      raw: bytes.length,
      gzip: gzipSync(bytes, { level: 9 }).length,
      text: bytes.toString("utf8"),
    });
  }
  const missingInitial = [...initialSet].filter((path) => path.startsWith("assets/") && !files.some((file) => file.file === path));
  const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
  const initialJs = files.filter((file) => file.type === "js" && file.initial);
  const initialCss = files.filter((file) => file.type === "css" && file.initial);
  const lazyJs = files.filter((file) => file.type === "js" && !file.initial);
  const allJs = files.filter((file) => file.type === "js");
  const prefix = budget.requireLazyChunkPrefix;
  const isRegistrationChunk = (file) => posix.basename(file.file).startsWith(prefix);

  const failures = [];
  const over = (label, actual, limit) => {
    if (limit !== null && limit !== undefined && actual > limit) failures.push(`${label} ${actual} B gzip > budget ${limit} B`);
  };
  if (missingInitial.length > 0) failures.push(`index.html references missing asset(s): ${missingInitial.join(", ")}`);
  if (initialJs.length === 0) failures.push("no initial JS entry found in index.html");
  over("initial JS", sum(initialJs, "gzip"), budget.initialJsGzipMax);
  over("initial CSS", sum(initialCss, "gzip"), budget.initialCssGzipMax);
  over("total JS", sum(allJs, "gzip"), budget.totalJsGzipMax);
  for (const file of lazyJs) over(`lazy chunk ${file.file}`, file.gzip, budget.lazyChunkGzipMax);
  for (const file of initialJs.filter(isRegistrationChunk)) failures.push(`${file.file} (${prefix}*) is in the initial set; it must be lazy`);
  if (budget.requireLazyChunk && !lazyJs.some(isRegistrationChunk)) failures.push(`no lazy chunk named ${prefix}* in dist/assets`);
  for (const marker of budget.initialForbiddenMarkers) {
    for (const file of initialJs) if (file.text.includes(marker)) failures.push(`initial chunk ${file.file} contains forbidden marker ${JSON.stringify(marker)}`);
  }

  const strip = ({ text: _text, ...rest }) => rest;
  return {
    ok: failures.length === 0,
    failures,
    totals: {
      initialJs: { raw: sum(initialJs, "raw"), gzip: sum(initialJs, "gzip") },
      initialCss: { raw: sum(initialCss, "raw"), gzip: sum(initialCss, "gzip") },
      lazyJs: { raw: sum(lazyJs, "raw"), gzip: sum(lazyJs, "gzip") },
      totalJs: { raw: sum(allJs, "raw"), gzip: sum(allJs, "gzip") },
    },
    files: files.map(strip),
    budget: {
      initialJsGzipMax: budget.initialJsGzipMax,
      initialCssGzipMax: budget.initialCssGzipMax,
      totalJsGzipMax: budget.totalJsGzipMax,
      lazyChunkGzipMax: budget.lazyChunkGzipMax,
      requireLazyChunk: budget.requireLazyChunk,
      requireLazyChunkPrefix: prefix,
    },
  };
}

export function formatReport(report) {
  const lines = ["file                                      kind     raw        gzip(9)"];
  for (const file of report.files) {
    lines.push(`${file.file.padEnd(42)}${`${file.initial ? "initial" : "lazy"} ${file.type}`.padEnd(9)}${kib(file.raw).padStart(10)} ${kib(file.gzip).padStart(10)}`);
  }
  const limit = (value) => (value === null || value === undefined ? "not enforced" : `${value} B`);
  const { totals, budget } = report;
  lines.push(
    `initial JS  ${totals.initialJs.raw} B raw / ${totals.initialJs.gzip} B gzip (budget ${limit(budget.initialJsGzipMax)})`,
    `initial CSS ${totals.initialCss.raw} B raw / ${totals.initialCss.gzip} B gzip (budget ${limit(budget.initialCssGzipMax)})`,
    `lazy JS     ${totals.lazyJs.raw} B raw / ${totals.lazyJs.gzip} B gzip (per chunk budget ${limit(budget.lazyChunkGzipMax)})`,
    `total JS    ${totals.totalJs.raw} B raw / ${totals.totalJs.gzip} B gzip (budget ${limit(budget.totalJsGzipMax)})`,
    `lazy ${budget.requireLazyChunkPrefix}* chunk required: ${budget.requireLazyChunk ? "yes" : "no (provisional)"}`,
  );
  return lines.join("\n");
}

function parseCli(argv) {
  let distDir = join(repoRoot, "apps", "web", "dist");
  let budgetFile = DEFAULT_BUDGET_FILE;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--budget") {
      budgetFile = argv[index + 1];
      if (!budgetFile) throw new Error("--budget needs a file");
      index += 1;
    } else distDir = argv[index];
  }
  return { distDir: resolve(distDir), budgetFile: resolve(budgetFile) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { distDir, budgetFile } = parseCli(process.argv.slice(2));
    const budget = parseBudget(JSON.parse(readFileSync(budgetFile, "utf8")));
    const report = checkBundleBudget(distDir, budget);
    console.log(formatReport(report));
    console.log(`bundle-budget-json ${JSON.stringify({ ok: report.ok, totals: report.totals, budget: report.budget, failures: report.failures })}`);
    if (!report.ok) {
      for (const failure of report.failures) console.error(`check-bundle-budget: FAIL ${failure}`);
      process.exit(1);
    }
    console.log("check-bundle-budget: OK");
  } catch (error) {
    console.error(`check-bundle-budget: ${error.message}`);
    process.exit(1);
  }
}
