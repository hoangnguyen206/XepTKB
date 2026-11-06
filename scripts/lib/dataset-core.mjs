// Pure rules of the dataset pipeline (ADR-0012): versions, term starts, diffs and status transitions.
// The CLI in scripts/dataset.mjs does the file work; everything here is deterministic and unit-tested.

export const SOURCE_TYPES = ["official-timetable", "planned-timetable"];

/**
 * Fail-closed preview vs production rule (ADR-0010 §2 rule 4 / SEC-M3-003):
 * - On Cloudflare Pages (`CF_PAGES=1`) or Workers Builds (`WORKERS_CI=1`), only a non-production preview branch
 *   may enable unpublished datasets; the production branch (`PRODUCTION_BRANCH`, default `"main"`) is always `false`.
 * - Outside preview CI, defaults to `false` unless `VITE_ALLOW_UNPUBLISHED === "true"` is explicitly passed.
 */
export function resolveSiteAllowUnpublished(env = process.env) {
  const prodBranch = env.PRODUCTION_BRANCH?.trim() || "main";
  if (env.CF_PAGES === "1" || env.WORKERS_CI === "1") {
    const branch = (env.CF_PAGES_BRANCH ?? env.WORKERS_CI_BRANCH)?.trim();
    return Boolean(branch && branch !== prodBranch && env.VITE_ALLOW_UNPUBLISHED !== "false");
  }
  return env.VITE_ALLOW_UNPUBLISHED === "true";
}

/** Normalizes an actor name so whitespace/case/diacritic variations cannot bypass two-person review (SEC-M3-101). */
export function normalizeActor(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Rejects control characters / newlines and excessive length in CLI free-text fields written to Markdown reports (SEC-M3-104). */
export function sanitizeCliText(value, flagName, maxLen = 240) {
  const raw = String(value ?? "");
  if (/[\r\n\0-\x1f\x7f]/.test(raw)) {
    throw new Error(`${flagName} must be a single line without control characters`);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(`${flagName} must not be empty`);
  }
  if (trimmed.length > maxLen) {
    throw new Error(`${flagName} exceeds maximum length (${maxLen} characters)`);
  }
  return trimmed;
}

/** Same relative-path contract as apps/web/src/data/contract.ts `isSafeRelativeUrl` (SEC-M3-002, SEC-M3-104). */
export function isSafeRelativePath(url) {
  if (typeof url !== "string" || url.length === 0 || url.length > 256) return false;
  if (url.startsWith("/") || url.includes("\\") || url.includes("?") || url.includes("#") || url.includes(":") || url.includes("%")) return false;
  const parts = url.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== ".." && /^[A-Za-z0-9._-]+$/.test(part));
}

/** `uet-<term>-<YYYYMMDD in Asia/Ho_Chi_Minh>-<first 8 hex of the source hash>`: unique, sortable, readable. */
export function datasetVersionFor(term, importedAt, importHash) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(importedAt)).replace(/-/g, "");
  return `uet-${term}-${day}-${importHash.slice(0, 8)}`;
}

/** `--start "K67,K68=2026-09-07"`: the cohorts whose week 1 begins on that Monday. */
export function parseStart(spec) {
  const match = /^([^=]+)=(\d{4}-\d{2}-\d{2})$/.exec(spec.trim());
  if (!match) throw new Error(`--start "${spec}" must look like "K67,K68=2026-09-07"`);
  const cohorts = match[1].split(",").map((cohort) => cohort.trim()).filter(Boolean);
  const week1 = match[2];
  const date = new Date(`${week1}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== week1) throw new Error(`--start date ${week1} is not a real date`);
  if (date.getUTCDay() !== 1) throw new Error(`--start date ${week1} is not a Monday; week 1 starts on a Monday`);
  if (cohorts.length === 0) throw new Error(`--start "${spec}" names no cohort`);
  return { cohorts, week1 };
}

/** What a student sees of a session; ids and source rows change between versions and are left out. */
function sessionSignature(session) {
  const time = session.fixedTime === false ? "untimed" : `T${session.day} ${session.startPeriod}-${session.endPeriod}`;
  return [time, session.kind, session.group ?? "", session.room ?? "", `w${session.weeks.join(",")}`, session.lecturers.join("+")].join(" | ");
}

/** Sections added, removed and changed (by their sessions) between two timetables. */
export function diffSections(previous, next) {
  const before = new Map(previous.map((section) => [section.id, section.sessions.map(sessionSignature).sort()]));
  const after = new Map(next.map((section) => [section.id, section.sessions.map(sessionSignature).sort()]));
  const added = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removed = [...before.keys()].filter((id) => !after.has(id)).sort();
  const changed = [];
  for (const [id, sessions] of after) {
    const old = before.get(id);
    if (old && old.join("\n") !== sessions.join("\n")) changed.push({ id, before: old.filter((item) => !sessions.includes(item)), after: sessions.filter((item) => !old.includes(item)) });
  }
  changed.sort((a, b) => a.id.localeCompare(b.id));
  return { added, removed, changed };
}

/**
 * Runbook §7 lifecycle: candidate → validated → published, any of them → retracted, and retracted → validated (restore).
 * Validation and publication require an actor other than the importer; a single-person review/publish is allowed only
 * with a recorded reason (SEC-M3-101, REV-M3-106).
 * When a candidate was imported with `--accept-new-format`, the Data Reviewer must also confirm the new format
 * at validation time via `--accept-new-format "<reason>"` (REV-M3-102).
 */
export function nextStatus(entry, action, { actor, importer, singleReviewerReason, newFormatImported, acceptNewFormatReason } = {}) {
  const normActor = normalizeActor(actor);
  if (!normActor) throw new Error(`${action} needs an actor name`);
  if (action === "validate") {
    if (entry.status !== "candidate") throw new Error(`only a candidate can be validated (status: ${entry.status})`);
    const normImporter = normalizeActor(importer);
    if (!normImporter) {
      throw new Error("cannot validate without an import audit record naming the importer");
    }
    if (normActor === normImporter && !singleReviewerReason?.trim()) {
      throw new Error("the reviewer imported this dataset; another person must review it, or record --accept-single-reviewer \"<reason>\"");
    }
    if (newFormatImported && !acceptNewFormatReason?.trim()) {
      throw new Error("this candidate was imported with an unreviewed column format; the Data Reviewer must inspect the columns/info labels in the report and pass --accept-new-format \"<reason>\"");
    }
    return "validated";
  }
  if (action === "publish") {
    if (entry.status !== "validated") throw new Error(`only a validated dataset can be published (status: ${entry.status})`);
    const normImporter = normalizeActor(importer);
    if (normImporter && normActor === normImporter && !singleReviewerReason?.trim()) {
      throw new Error("the publisher imported this dataset; another person must publish it, or record --accept-single-reviewer \"<reason>\"");
    }
    return "published";
  }
  if (action === "retract") {
    if (entry.status === "retracted") throw new Error("already retracted");
    return "retracted";
  }
  if (action === "restore") {
    if (entry.status !== "retracted") throw new Error(`only a retracted dataset can be restored (status: ${entry.status})`);
    return "validated";
  }
  throw new Error(`unknown action ${action}`);
}

/**
 * Verifies that `currentManifest` preserves append-only entries and immutable artifact records
 * relative to `baseManifest` from a base git commit/branch (ADR-0012 §4/§6, SEC-M3-101(e)).
 */
export function verifyBaseManifestImmutability(baseManifest, currentManifest) {
  const problems = [];
  const baseDatasets = baseManifest?.datasets ?? [];
  const currentByVersion = new Map((currentManifest?.datasets ?? []).map((item) => [item.datasetVersion, item]));

  for (const baseEntry of baseDatasets) {
    const ver = baseEntry.datasetVersion;
    const curEntry = currentByVersion.get(ver);
    if (!curEntry) {
      problems.push(`${ver}: dataset entry existed in base manifest (${baseEntry.status}) and must not be deleted`);
      continue;
    }
    if (curEntry.source?.importHash !== baseEntry.source?.importHash) {
      problems.push(`${ver}: immutable source.importHash changed relative to base manifest (${baseEntry.source?.importHash} -> ${curEntry.source?.importHash})`);
    }
    if ((baseEntry.status === "published" || baseEntry.status === "retracted") && curEntry.status === "candidate") {
      problems.push(`${ver}: status "${baseEntry.status}" in base manifest cannot be downgraded to "candidate"`);
    }
    const baseArtifacts = baseEntry.artifacts ?? [];
    const curArtifacts = curEntry.artifacts ?? [];
    if (curArtifacts.length !== baseArtifacts.length) {
      problems.push(`${ver}: artifact count changed relative to base manifest (${baseArtifacts.length} -> ${curArtifacts.length})`);
      continue;
    }
    for (const baseArt of baseArtifacts) {
      const curArt = curArtifacts.find((a) => a.kind === baseArt.kind);
      if (
        !curArt ||
        curArt.url !== baseArt.url ||
        curArt.sha256 !== baseArt.sha256 ||
        curArt.bytes !== baseArt.bytes
      ) {
        problems.push(`${ver}: immutable artifact "${baseArt.kind}" (${baseArt.url}) changed url/size/hash relative to base manifest`);
      }
    }
  }
  return problems;
}
