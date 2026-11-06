#!/usr/bin/env node
// Dataset pipeline CLI (ADR-0007, ADR-0012, DATA_INGESTION_RUNBOOK §12). Published data lives in data/published and
// ships with the site; git history is the audit trail next to data/audit.jsonl. The raw source never enters the repo.
//
//   npm run dataset -- import <file.xlsx> --term <id> --term-name <name> --source-type official-timetable|planned-timetable
//                      --document-ref <safe ref> --published-by <source publisher> --actor <importer>
//                      [--weeks 15] [--start "K67,K68=2026-09-07"]... [--profile profile.json] [--accept-new-format <reason>]
//   npm run dataset -- validate <version> --reviewer <name> [--note <text>] [--accept-single-reviewer <reason>] [--accept-new-format <reason>]
//   npm run dataset -- publish  <version> --by <name> [--note <text>]
//   npm run dataset -- retract  <version> --by <name> --reason <text>
//   npm run dataset -- status | check
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { assertOutsideRepo, parseArgs, repoRoot } from "./lib/cli.mjs";
import { SOURCE_TYPES, datasetVersionFor, diffSections, nextStatus, parseStart } from "./lib/dataset-core.mjs";

const DATA_DIR = join(repoRoot, "data", "published");
const REPORT_DIR = join(repoRoot, "data", "reports");
const AUDIT_LOG = join(repoRoot, "data", "audit.jsonl");
const MANIFEST = join(DATA_DIR, "manifest.json");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const now = () => new Date().toISOString();
const fail = (message, code = 1) => {
  console.error(`dataset: ${message}`);
  process.exit(code);
};

function readManifest() {
  if (!existsSync(MANIFEST)) return { schemaVersion: "1.0", generatedAt: now(), datasets: [] };
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

/** Pretty-printed so every publish/retract is a readable git diff. */
function writeManifest(manifest) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify({ ...manifest, generatedAt: now() }, null, 2)}\n`);
}

/** Artifacts are written once and never rewritten (immutable versions). */
function writeArtifact(relativePath, value) {
  const target = join(DATA_DIR, relativePath);
  if (existsSync(target)) fail(`refusing to overwrite immutable artifact ${relativePath}`);
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return { url: relativePath.split("\\").join("/"), sha256: sha256(bytes), bytes: bytes.length };
}

function audit(action, datasetVersion, actor, extra = {}) {
  mkdirSync(dirname(AUDIT_LOG), { recursive: true });
  appendFileSync(AUDIT_LOG, `${JSON.stringify({ at: now(), action, datasetVersion, actor, ...extra })}\n`);
}

function auditEntries() {
  if (!existsSync(AUDIT_LOG)) return [];
  return readFileSync(AUDIT_LOG, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const reportPath = (version) => join(REPORT_DIR, `${version}.md`);
function appendReport(version, lines) {
  appendFileSync(reportPath(version), `${lines.join("\n")}\n`);
}

function findEntry(manifest, version) {
  const entry = manifest.datasets.find((item) => item.datasetVersion === version);
  if (!entry) fail(`no dataset ${version} in data/published/manifest.json`);
  return entry;
}

function loadTimetable(entry) {
  const artifact = entry.artifacts.find((item) => item.kind === "timetable");
  return JSON.parse(readFileSync(join(DATA_DIR, artifact.url), "utf8"));
}

const count = (items, key) => {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
};

async function importDataset(file, options) {
  for (const name of ["term", "term-name", "source-type", "document-ref", "published-by", "actor"]) {
    if (!options[name]) fail(`import needs --${name}`);
  }
  if (!SOURCE_TYPES.includes(options["source-type"])) fail(`--source-type must be one of ${SOURCE_TYPES.join(", ")}`);
  const term = options.term;
  if (!/^\d{4}-\d{4}-h[1-3]$/.test(term)) fail(`--term ${term} must look like 2026-2027-h1`);
  const teachingWeeks = Number(options.weeks ?? 15);
  if (!Number.isInteger(teachingWeeks) || teachingWeeks < 1 || teachingWeeks > 30) fail("--weeks must be 1..30");
  const starts = (options.start ?? []).map(parseStart);
  const profile = options.profile ? JSON.parse(readFileSync(options.profile, "utf8")) : undefined;
  const path = assertOutsideRepo(file);

  const bytes = new Uint8Array(readFileSync(path));
  const importHash = `sha256:${sha256(bytes)}`;
  const manifest = readManifest();
  const duplicate = manifest.datasets.find((item) => item.source.importHash === importHash);
  if (duplicate) fail(`this file was already imported as ${duplicate.datasetVersion} (status ${duplicate.status})`);

  const importedAt = now();
  const datasetVersion = datasetVersionFor(term, importedAt, importHash.slice("sha256:".length));
  const { SCHEMA_VERSION } = await import(pathToFileURL(join(repoRoot, "packages/domain/dist/src/index.js")).href);
  const { uetXlsxAdapter } = await import(pathToFileURL(join(repoRoot, "packages/parser/dist/src/uet-xlsx-adapter.js")).href);
  const { UET_TIMEFRAME } = await import(pathToFileURL(join(repoRoot, "packages/parser/dist/src/uet-config.js")).href);
  const result = uetXlsxAdapter.parse({ bytes, context: { term, teachingWeeks, datasetVersion }, ...(profile ? { profile } : {}) });

  // Runbook §4: blocking errors and rows that are not accounted for stop the import; nothing is written.
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const coverage = result.coverage;
  if (errors.length > 0) {
    for (const issue of errors.slice(0, 20)) console.error(`  ${issue.code} row ${issue.sourceRow ?? "-"} ${issue.field ?? ""} ${issue.message}`);
    fail(`${errors.length} blocking parser errors; nothing was written`);
  }
  if (!coverage) fail("the parser returned no row coverage; nothing was written");
  const skipped = Object.values(coverage.skippedRows).reduce((sum, n) => sum + n, 0);
  const unaccounted = coverage.sectionRows - coverage.parsedRows - skipped - coverage.errorRows;
  if (unaccounted !== 0) fail(`${unaccounted} rows with a section id are not accounted for; nothing was written`);
  if (!coverage.knownFormat && !options["accept-new-format"]) {
    const extraDesc = coverage.infoColumns?.length ? `; extra (info) columns: ${coverage.infoColumns.join(", ")}` : "";
    fail(`new column set (${coverage.columns.join(", ")}${extraDesc}): review it, add it to KNOWN_FORMATS or pass --accept-new-format "<reason>"`, 2);
  }

  const base = `schools/uet/terms/${term}/${datasetVersion}`;
  const timetable = writeArtifact(`${base}/timetable.json`, { schemaVersion: SCHEMA_VERSION, datasetVersion, school: "uet", term, courses: result.courses, sections: result.sections });
  const metadata = writeArtifact(`${base}/metadata.json`, {
    schemaVersion: "1.0",
    datasetVersion,
    school: "uet",
    term: { id: term, school: "uet", name: options["term-name"], teachingWeeks, starts, timezone: "Asia/Ho_Chi_Minh" },
    timeFrame: UET_TIMEFRAME,
  });
  const entry = {
    datasetVersion,
    school: "uet",
    term,
    termName: options["term-name"],
    status: "candidate",
    source: { type: options["source-type"], documentRef: options["document-ref"], publishedBy: options["published-by"], importHash },
    parserVersion: result.artifact.parserVersion,
    domainSchemaVersion: SCHEMA_VERSION,
    importedAt,
    artifacts: [{ kind: "timetable", ...timetable }, { kind: "metadata", ...metadata }],
  };
  const previous = [...manifest.datasets].reverse().find((item) => item.term === term && item.status !== "retracted");
  const diff = previous ? diffSections(loadTimetable(previous).sections, result.sections) : undefined;
  manifest.datasets.push(entry);
  writeManifest(manifest);
  writeImportReport({ entry, result, coverage, starts, teachingWeeks, previous, diff, actor: options.actor, fileName: basename(path), fileBytes: bytes.length, newFormatReason: options["accept-new-format"] });
  audit("import", datasetVersion, options.actor, { importHash, parserVersion: entry.parserVersion, sections: result.sections.length, ...(options["accept-new-format"] ? { acceptedNewFormat: options["accept-new-format"] } : {}) });

  console.log(`dataset: imported ${datasetVersion} as candidate`);
  console.log(`  ${result.sections.length} sections, ${result.courses.length} courses, ${result.sections.reduce((n, s) => n + s.sessions.length, 0)} sessions; rows ${coverage.parsedRows} parsed, skipped ${JSON.stringify(coverage.skippedRows)}`);
  if (coverage.infoColumns?.length) console.log(`  extra (info) columns: ${coverage.infoColumns.join(", ")}`);
  if (diff) console.log(`  vs ${previous.datasetVersion}: +${diff.added.length} −${diff.removed.length} ~${diff.changed.length} sections`);
  if (starts.length === 0) console.log("  note: no --start given; students will enter the week-1 date themselves");
  console.log(`  report: ${relative(repoRoot, reportPath(datasetVersion))}`);
  console.log("  next: commit and push; review it on the preview URL, then `npm run dataset -- validate` by a second person");
}

function summarizeInfoColumns(sessions, infoColumns = []) {
  if (infoColumns.length === 0) return ["- None."];
  const rows = infoColumns.map((label) => {
    const values = [];
    let countSessions = 0;
    for (const session of sessions) {
      for (const item of session.info ?? []) {
        if (item.label === label) {
          countSessions += 1;
          if (!values.includes(item.value) && values.length < 3) values.push(item.value);
        }
      }
    }
    const sample = values.length > 0 ? values.map((v) => `\`${v.replace(/\|/g, "\\|")}\``).join(", ") : "*(all empty)*";
    return `| \`${label.replace(/\|/g, "\\|")}\` | ${countSessions} | ${sample} |`;
  });
  return [
    "| Column header (`info.label`) | Non-empty sessions | Sample values |",
    "| --- | --- | --- |",
    ...rows,
  ];
}

function summarizeWeekNotes(sessions, warnings) {
  const unparsedNotes = new Set(warnings.filter((w) => w.code === "UNPARSED_NOTE" && w.rawValue).map((w) => w.rawValue));
  const byNote = new Map();
  for (const session of sessions) {
    const raw = session.rawNote;
    if (!raw) continue;
    const folded = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!/\btuan\b/.test(folded) && !unparsedNotes.has(raw)) continue;
    const existing = byNote.get(raw);
    if (existing) {
      existing.count += 1;
    } else {
      byNote.set(raw, {
        rawNote: raw,
        weekOrigin: session.weekOrigin ?? "unknown",
        weeks: session.weeks.join(","),
        unparsed: unparsedNotes.has(raw),
        count: 1,
      });
    }
  }
  if (byNote.size === 0) return ["- None."];
  return [
    "| Note (`rawNote`) | Week origin | Resolved weeks | Sessions |",
    "| --- | --- | --- | --- |",
    ...[...byNote.values()].map((item) => {
      const originLabel = item.unparsed ? `${item.weekOrigin} (⚠ \`UNPARSED_NOTE\` — review required)` : item.weekOrigin;
      return `| \`${item.rawNote.replace(/\|/g, "\\|")}\` | ${originLabel} | \`${item.weeks}\` | ${item.count} |`;
    }),
  ];
}

function writeImportReport({ entry, result, coverage, starts, teachingWeeks, previous, diff, actor, fileName, fileBytes, newFormatReason }) {
  const sessions = result.sections.flatMap((section) => section.sessions);
  const untimed = sessions.filter((session) => session.fixedTime === false);
  const warnings = result.issues.filter((issue) => issue.severity === "warning");
  const byCode = count(warnings, (issue) => issue.code);
  const firstOf = (code) => warnings.filter((issue) => issue.code === code).slice(0, 5).map((issue) => `${issue.sourceRow ?? "-"}${issue.rawValue ? ` (${issue.rawValue})` : ""}`).join(", ");
  const list = (items, limit = 40) => (items.length === 0 ? "none" : `${items.slice(0, limit).join(", ")}${items.length > limit ? ` … (+${items.length - limit})` : ""}`);
  const today = entry.importedAt.slice(0, 10);
  const extraColsText = coverage.infoColumns?.length ? coverage.infoColumns.join(", ") : "none";
  const lines = [
    `# Data import report — UET ${entry.termName} (${entry.datasetVersion})`,
    "",
    `> **Artifact ID:** \`IMPORT-${entry.datasetVersion}\``,
    "> **Artifact status:** see `data/published/manifest.json` and the decision log below",
    "> **Canonical gate:** `G4b`",
    "> **Owner:** Data Parser",
    `> **Last reviewed:** ${today}`,
    "> **Related docs:** [Data ingestion runbook](../../docs/DATA_INGESTION_RUNBOOK.md), [ADR-0012](../../docs/adr/ADR-0012-dataset-publish-pipeline.md), [ADR-0011](../../docs/adr/ADR-0011-timetable-format-variability.md)",
    "> **Evidence envelope:** this report (generated by `scripts/dataset.mjs import`)",
    "",
    "## Source identity and intake",
    "",
    `- School / term: UET / \`${entry.term}\` — ${entry.termName}; ${teachingWeeks} teaching weeks`,
    `- Week 1 by cohort: ${starts.length === 0 ? "none given (students enter the date)" : starts.map((start) => `${start.cohorts.join(", ")} → ${start.week1}`).join("; ")}`,
    `- Source type: \`${entry.source.type}\`; published by: ${entry.source.publishedBy}`,
    `- Source document reference: ${entry.source.documentRef} (local file name \`${fileName}\`, ${fileBytes} bytes; the file stays outside the repository)`,
    `- Source SHA-256: \`${entry.source.importHash}\``,
    `- Imported by: ${actor}, ${entry.importedAt}`,
    `- Previous version of this term: ${previous ? `\`${previous.datasetVersion}\` (${previous.status})` : "none"}`,
    "",
    "## Parser identity",
    "",
    `- Parser: \`${entry.parserVersion}\`; domain schema \`${entry.domainSchemaVersion}\``,
    `- Sheet \`${coverage.sheet}\`, header row ${coverage.headerRow}; columns: ${coverage.columns.join(", ")}; extra (\`info\`) columns: ${extraColsText} — format ${coverage.knownFormat ? "reviewed" : `**new**, accepted on import: ${newFormatReason}`}`,
    "",
    "## Parse summary",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Sections | ${result.sections.length} |`,
    `| Courses | ${result.courses.length} |`,
    `| Sessions | ${sessions.length} |`,
    `| Fixed-time sessions | ${sessions.length - untimed.length} |`,
    `| Untimed sessions (online ${untimed.filter((s) => s.kind === "ONL").length}) | ${untimed.length} |`,
    `| Rows with a section id | ${coverage.sectionRows} (parsed ${coverage.parsedRows}, skipped ${JSON.stringify(coverage.skippedRows)}, errors ${coverage.errorRows}) |`,
    `| Warnings | ${warnings.length} |`,
    "| Blocking errors | 0 |",
    "",
    "## Quality issues (warnings)",
    "",
    "| Code | Count | First rows (value) |",
    "| --- | --- | --- |",
    ...Object.entries(byCode).sort((a, b) => b[1] - a[1]).map(([code, n]) => `| \`${code}\` | ${n} | ${firstOf(code)} |`),
    "",
    "## Extra (info) columns",
    "",
    ...summarizeInfoColumns(sessions, coverage.infoColumns ?? []),
    "",
    "## Week notes (\"tuần\")",
    "",
    ...summarizeWeekNotes(sessions, warnings),
    "",
    "## Output integrity",
    "",
    ...entry.artifacts.map((artifact) => `- \`${artifact.kind}\`: \`${artifact.url}\`, ${artifact.bytes} bytes, sha256 \`${artifact.sha256}\``),
    "",
    "## Diff with the previous version",
    "",
    ...(diff
      ? [
        `- Added sections (${diff.added.length}): ${list(diff.added)}`,
        `- Removed sections (${diff.removed.length}): ${list(diff.removed)}`,
        `- Changed sections (${diff.changed.length}):`,
        ...diff.changed.slice(0, 40).map((item) => `  - \`${item.id}\`: ${item.before.join("; ") || "—"} → ${item.after.join("; ") || "—"}`),
        ...(diff.changed.length > 40 ? [`  - … (+${diff.changed.length - 40})`] : []),
      ]
      : ["- First import of this term: nothing to compare."]),
    "",
    "## Review checklist (Data Reviewer)",
    "",
    "- [ ] Right school/term/source document/status; week-1 dates match the academic calendar.",
    "- [ ] Counts plausible for this version of the timetable (it changes until registration ends).",
    "- [ ] Extra (`info`) columns listed above were checked; none carry schedule weeks or personal data (PII).",
    "- [ ] Week notes containing \"tuần\" listed above were checked against the source file; any `UNPARSED_NOTE` warning was reviewed.",
    "- [ ] Sampled on the preview URL: a few courses, a multi-shift `Ca`, a cancelled class absent, an online/untimed class, a lab group.",
    "- [ ] Warnings read; diff read; room/time changes have a reason.",
    "- [ ] No blocking errors; reviewer is not the importer (or the exception is recorded below).",
    "",
    "## Decision log",
    "",
    `- ${entry.importedAt} — **imported** as \`candidate\` by ${actor}${newFormatReason ? ` — **new format on import:** ${newFormatReason}` : ""}.`,
  ];
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(reportPath(entry.datasetVersion), `${lines.join("\n")}\n`);
}

function changeStatus(action, version, options) {
  const manifest = readManifest();
  const entry = findEntry(manifest, version);
  const actor = action === "validate" ? options.reviewer : options.by;
  const importAudit = auditEntries().find((item) => item.action === "import" && item.datasetVersion === version);
  const importer = importAudit?.actor;
  const newFormatImported = Boolean(importAudit?.acceptedNewFormat);
  if (action === "retract" && !options.reason) fail("retract needs --reason");
  let status;
  try {
    status = nextStatus(entry, action, {
      actor,
      importer,
      singleReviewerReason: options["accept-single-reviewer"],
      newFormatImported,
      acceptNewFormatReason: options["accept-new-format"],
    });
  } catch (error) {
    fail(error.message);
  }
  const at = now();
  entry.status = status;
  if (action === "validate") entry.reviewedAt = at;
  if (action === "publish") entry.publishedAt = at;
  writeManifest(manifest);
  const exception = action === "validate" && options["accept-single-reviewer"] ? options["accept-single-reviewer"] : undefined;
  const newFormatReview = action === "validate" && options["accept-new-format"] ? options["accept-new-format"] : undefined;
  audit(action, version, actor, {
    status,
    ...(options.note ? { note: options.note } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
    ...(exception ? { singleReviewerException: exception } : {}),
    ...(newFormatReview ? { acceptedNewFormat: newFormatReview } : {}),
  });
  if (existsSync(reportPath(version))) {
    appendReport(version, [
      `- ${at} — **${action}** → \`${status}\` by ${actor}${options.note ? `: ${options.note}` : ""}${options.reason ? ` — reason: ${options.reason}` : ""}${exception ? ` — **single-reviewer exception:** ${exception}` : ""}${newFormatReview ? ` — **new format reviewed:** ${newFormatReview}` : ""}.`,
    ]);
  }
  console.log(`dataset: ${version} is now ${status}`);
  if (action === "publish") console.log("  next: commit and push; production shows it after the next production deploy");
  if (action === "retract") {
    const fallback = [...manifest.datasets].reverse().find((item) => item.term === entry.term && item.status === "published");
    console.log(`  production now falls back to ${fallback ? fallback.datasetVersion : "no published dataset for this term"} once deployed`);
  }
}

function status() {
  const manifest = readManifest();
  if (manifest.datasets.length === 0) return console.log("dataset: no datasets yet");
  for (const entry of manifest.datasets) {
    console.log(`${entry.status.padEnd(10)} ${entry.datasetVersion}  imported ${entry.importedAt.slice(0, 16)}${entry.reviewedAt ? `  reviewed ${entry.reviewedAt.slice(0, 16)}` : ""}${entry.publishedAt ? `  published ${entry.publishedAt.slice(0, 16)}` : ""}`);
  }
}

/** Integrity of what ships: every referenced artifact exists with the recorded size and hash; nothing else is there. */
function check() {
  const manifest = readManifest();
  const problems = [];
  const referenced = new Set(["manifest.json"]);
  const versions = new Set();
  for (const entry of manifest.datasets) {
    if (versions.has(entry.datasetVersion)) problems.push(`duplicate datasetVersion ${entry.datasetVersion}`);
    versions.add(entry.datasetVersion);
    if (!["candidate", "validated", "published", "retracted"].includes(entry.status)) problems.push(`${entry.datasetVersion}: unknown status ${entry.status}`);
    for (const artifact of entry.artifacts) {
      referenced.add(artifact.url);
      const target = join(DATA_DIR, artifact.url);
      if (!existsSync(target)) {
        problems.push(`${entry.datasetVersion}: missing ${artifact.url}`);
        continue;
      }
      const bytes = readFileSync(target);
      if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) problems.push(`${entry.datasetVersion}: ${artifact.url} does not match its recorded size/hash`);
      const value = JSON.parse(bytes.toString("utf8"));
      if (value.datasetVersion !== entry.datasetVersion) problems.push(`${entry.datasetVersion}: ${artifact.url} names another datasetVersion`);
    }
  }
  const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [relative(DATA_DIR, join(dir, name)).split("\\").join("/")]));
  if (existsSync(DATA_DIR)) for (const file of walk(DATA_DIR)) if (!referenced.has(file)) problems.push(`unreferenced file data/published/${file}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  ${problem}`);
    fail(`${problems.length} integrity problems in data/published`);
  }
  const published = manifest.datasets.filter((entry) => entry.status === "published").length;
  console.log(`dataset: data/published OK — ${manifest.datasets.length} datasets (${published} published)`);
}

const [command, ...rest] = process.argv.slice(2);
let parsed;
try {
  parsed = parseArgs(rest, ["start"]);
} catch (error) {
  fail(error.message);
}
const { options, positional } = parsed;
try {
  if (command === "import") await importDataset(positional[0] ?? fail("import needs a file"), options);
  else if (command === "validate" || command === "publish" || command === "retract") changeStatus(command, positional[0] ?? fail(`${command} needs a dataset version`), options);
  else if (command === "status") status();
  else if (command === "check") check();
  else fail("usage: dataset import|validate|publish|retract|status|check (see the header of scripts/dataset.mjs)");
} catch (error) {
  fail(error.message);
}
