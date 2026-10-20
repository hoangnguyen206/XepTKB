/**
 * Domain invariant validation — mirrors DOMAIN_MODEL.md §3.
 * Returns issues; errors block publish per PARSER_SPEC §8.
 */
import type { Course, DayNo, ImportArtifact, Section, Session, Term } from "./types.js";
import type { ParseIssue } from "./issues.js";

const VALID_DAYS: readonly number[] = [2, 3, 4, 5, 6, 7, 8];

function issue(partial: Omit<ParseIssue, "severity"> & { severity: ParseIssue["severity"] }): ParseIssue {
  return partial;
}

export function validateSession(s: Session, maxPeriod: number, teachingWeeks: number): ParseIssue[] {
  const out: ParseIssue[] = [];
  if (!VALID_DAYS.includes(s.day)) {
    out.push(issue({ code: "INVALID_DAY_OR_PERIOD", severity: "error", field: "day", rawValue: String(s.day), message: `day must be 2..8, got ${s.day}` }));
  }
  if (!Number.isInteger(s.startPeriod) || !Number.isInteger(s.endPeriod) || s.startPeriod < 1 || s.endPeriod > maxPeriod || s.startPeriod > s.endPeriod) {
    out.push(issue({ code: "INVALID_DAY_OR_PERIOD", severity: "error", field: "periods", rawValue: `${s.startPeriod}-${s.endPeriod}`, message: `periods must satisfy 1 <= start <= end <= ${maxPeriod}` }));
  }
  if (!Array.isArray(s.weeks) || s.weeks.length === 0) {
    out.push(issue({ code: "INVALID_DAY_OR_PERIOD", severity: "error", field: "weeks", message: "weeks must be a non-empty explicit array" }));
  } else {
    const sorted = [...s.weeks].sort((a, b) => a - b);
    const unique = new Set(s.weeks);
    if (unique.size !== s.weeks.length || sorted.some((w, i) => w !== s.weeks[i])) {
      out.push(issue({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "weeks", message: "weeks must be sorted and unique" }));
    }
    if (s.weeks.some((w) => !Number.isInteger(w) || w < 1 || w > teachingWeeks)) {
      out.push(issue({ code: "INVALID_DAY_OR_PERIOD", severity: "error", field: "weeks", rawValue: s.weeks.join(","), message: `weeks must be within 1..${teachingWeeks}` }));
    }
  }
  if (!s.source || !s.source.artifactId) {
    out.push(issue({ code: "HASH_OR_PROVENANCE_MISSING", severity: "error", field: "source", message: "session missing SourceRef.artifactId" }));
  }
  return out;
}

export function validateSection(sec: Section, maxPeriod: number, teachingWeeks: number): ParseIssue[] {
  const out: ParseIssue[] = [];
  if (!sec.id || sec.id !== sec.id.trim().toUpperCase() || /\s{2,}/.test(sec.id)) {
    out.push(issue({ code: "INVALID_SECTION_ID", severity: "error", field: "id", rawValue: sec.id, message: "Section.id must be canonical (uppercase, trimmed, single spaces)" }));
  }
  if (!sec.courseCode) {
    out.push(issue({ code: "INVALID_SECTION_ID", severity: "error", field: "courseCode", message: "missing courseCode" }));
  }
  if (sec.sessions.length === 0) {
    out.push(issue({ code: "NO_VALID_SECTION_ROWS", severity: "error", message: `Section ${sec.id} has no sessions` }));
  }
  for (const s of sec.sessions) {
    out.push(...validateSession(s, maxPeriod, teachingWeeks));
  }
  return out;
}

export function validateCourse(c: Course): ParseIssue[] {
  const out: ParseIssue[] = [];
  if (!c.code || c.code !== c.code.trim().toUpperCase()) {
    out.push(issue({ code: "INVALID_SECTION_ID", severity: "error", field: "code", rawValue: c.code, message: "Course.code must be normalized uppercase" }));
  }
  if (typeof c.credits !== "number" || c.credits < 0) {
    out.push(issue({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "credits", rawValue: String(c.credits), message: "credits must be a non-negative number" }));
  }
  return out;
}

export function validateArtifact(a: ImportArtifact): ParseIssue[] {
  const out: ParseIssue[] = [];
  if (a.sourceType === "registration" && a.localOnly !== true) {
    out.push(issue({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "localOnly", message: "registration artifacts must be marked local-only" }));
  }
  const isLocalRegistration = a.sourceType === "registration" && a.localOnly === true;
  if (isLocalRegistration) {
    if (a.sha256 !== undefined) {
      out.push(issue({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "sha256", message: "local registration artifacts must not retain a content hash" }));
    }
    if (a.fileName !== undefined) {
      out.push(issue({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "fileName", message: "local registration artifacts must not retain the user-selected filename" }));
    }
  } else if (!a.sha256 || !/^[0-9a-f]{64}$/i.test(a.sha256)) {
    out.push(issue({ code: "HASH_OR_PROVENANCE_MISSING", severity: "error", field: "sha256", message: "artifact sha256 missing or malformed" }));
  }
  if (a.localOnly && a.sourceType !== "registration") {
    out.push(issue({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "localOnly", message: "only registration artifacts may be local-only" }));
  }
  if (!a.parserVersion || !a.schemaVersion) {
    out.push(issue({ code: "HASH_OR_PROVENANCE_MISSING", severity: "error", field: "version", message: "parserVersion and schemaVersion are required" }));
  }
  if (!a.importedAt) {
    out.push(issue({ code: "HASH_OR_PROVENANCE_MISSING", severity: "error", field: "importedAt", message: "importedAt is required" }));
  }
  return out;
}

export function maxPeriodOf(term: Term | undefined, fallback = 12): number {
  void term;
  return fallback;
}

export function isValidDay(n: number): n is DayNo {
  return VALID_DAYS.includes(n);
}
