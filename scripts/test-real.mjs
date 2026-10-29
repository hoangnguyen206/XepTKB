#!/usr/bin/env node
// Checks a real source file against the parser (M0 fixture policy: real files stay outside the repository).
// Usage: npm run test:real -- <file> [--adapter uet-xlsx|vnu-registration-html] [--profile profile.json] [--term id] [--weeks 15]
// Prints counts, issue codes and row coverage only; never cell values of a registration file.
// Exit 0 = importable, 1 = errors or unaccounted rows, 2 = importable but the column set needs review (hold).
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_REAL_DIRS = ["fixtures/real", "fixtures/raw", "fixtures/private", "data/raw", "data/private"];

// `npm run` on Windows hands arguments over cmd.exe caret-escaped (`^C:\a^ b.xlsx^`); undo that, nothing else.
const unescapeCmd = (arg) => (process.platform === "win32" && arg.startsWith("^") ? arg.replace(/\^(.)/g, "$1").replace(/\^$/, "") : arg);
const args = process.argv.slice(2).map(unescapeCmd);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args.splice(index, 2)[1] : undefined;
};
const adapterId = option("adapter") ?? "uet-xlsx";
const profilePath = option("profile");
const term = option("term") ?? "real-check";
const teachingWeeks = Number(option("weeks") ?? 15);
const file = args[0];
if (!file) {
  console.error("usage: npm run test:real -- <file> [--adapter uet-xlsx|vnu-registration-html] [--profile profile.json] [--term id] [--weeks 15]");
  process.exit(1);
}

const path = resolve(file);
const inRepo = relative(repoRoot, path);
if (!inRepo.startsWith("..") && !isAbsolute(inRepo) && !IGNORED_REAL_DIRS.some((dir) => inRepo.split(sep).join("/").startsWith(`${dir}/`))) {
  console.error(`test:real: ${file} is inside the repository. Keep real files outside it or under ${IGNORED_REAL_DIRS.join(", ")}.`);
  process.exit(1);
}

const modules = {
  "uet-xlsx": ["uet-xlsx-adapter.js", "uetXlsxAdapter"],
  "vnu-registration-html": ["vnu-registration-html-adapter.js", "vnuRegistrationHtmlAdapter"],
};
if (!modules[adapterId]) {
  console.error(`test:real: unknown adapter ${adapterId}`);
  process.exit(1);
}
const [moduleFile, exportName] = modules[adapterId];
const adapter = (await import(pathToFileURL(resolve(repoRoot, "packages/parser/dist/src", moduleFile)).href))[exportName];
const profile = profilePath ? JSON.parse(readFileSync(profilePath, "utf8")) : undefined;
const bytes = new Uint8Array(readFileSync(path));
const result = adapter.parse({ bytes, context: { term, teachingWeeks }, ...(profile ? { profile } : {}) });

const sessions = result.sections.flatMap((section) => section.sessions);
const errors = result.issues.filter((item) => item.severity === "error");
const byCode = {};
for (const item of result.issues) byCode[`${item.severity}:${item.code}`] = (byCode[`${item.severity}:${item.code}`] ?? 0) + 1;
console.log(`adapter ${result.artifact.parserVersion} · status ${result.artifact.status}`);
console.log(`courses ${result.courses.length} · sections ${result.sections.length} · sessions ${sessions.length} (untimed ${sessions.filter((s) => s.fixedTime === false).length})`);
console.log("issues", JSON.stringify(byCode));
// Registration issues may only carry safe row/field data; timetable values are public.
for (const item of errors.slice(0, 20)) console.log(`  error ${item.code} row ${item.sourceRow ?? "-"} field ${item.field ?? "-"}${adapterId === "uet-xlsx" && item.rawValue ? ` raw ${JSON.stringify(item.rawValue)}` : ""}`);

let unaccounted = 0;
if (result.coverage) {
  const c = result.coverage;
  const skipped = Object.values(c.skippedRows).reduce((sum, n) => sum + n, 0);
  unaccounted = c.sectionRows - c.parsedRows - skipped - c.errorRows;
  console.log(`sheet "${c.sheet}" header row ${c.headerRow} · format ${c.knownFormat ? "reviewed" : "NEW — held for review"}: ${c.columns.join(", ")}`);
  console.log(`rows with a section id ${c.sectionRows}: parsed ${c.parsedRows}, skipped ${JSON.stringify(c.skippedRows)}, errors ${c.errorRows}, unaccounted ${unaccounted}`);
}
if (errors.length > 0 || unaccounted !== 0 || result.sections.length === 0) process.exit(1);
if (result.coverage && !result.coverage.knownFormat) process.exit(2);
