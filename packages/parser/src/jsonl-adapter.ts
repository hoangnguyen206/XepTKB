/**
 * `canonical-jsonl` adapter — development/harness adapter that reads an
 * already-canonical JSONL/JSON fixture and runs normalization + validation.
 * Exists so the M0 fixture harness has a real adapter before `uet-xlsx`
 * and `vnu-registration-html` land. Deterministic, offline.
 */
import { createHash } from "node:crypto";
import { SCHEMA_VERSION, validateCourse, validateSection, type Course, type ImportArtifact, type ParseIssue, type Section } from "@ky-nay/domain";
import type { ParserAdapter, ParseResult, SourceInput } from "./adapter.js";

const ADAPTER_ID = "canonical-jsonl";
const ADAPTER_VERSION = "0.1.0";

type JsonlPayload = {
  courses?: unknown;
  sections?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSectionRecord(value: unknown): value is Section {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.courseCode === "string"
    && Array.isArray(value.sessions);
}

function isCourseRecord(value: unknown): value is Course {
  return isRecord(value) && typeof value.code === "string" && "credits" in value;
}

function isSafeSessionContainer(value: Section): boolean {
  return value.sessions.every((session) => isRecord(session));
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function issueCodes(issues: ParseIssue[], severity: ParseIssue["severity"]): string[] {
  return [...new Set(issues.filter((i) => i.severity === severity).map((i) => i.code))];
}

function parsePayload(text: string): JsonlPayload {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return { sections: parsed };
  if (isSectionRecord(parsed)) return { sections: [parsed] };
  if (isRecord(parsed)) return parsed;
  throw new Error("JSON root must be an object or array");
}

export const canonicalJsonlAdapter: ParserAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,

  canParse(input: SourceInput): boolean {
    try {
      const text = decode(input.bytes).trimStart();
      return text.startsWith("{") || text.startsWith("[") || input.fileName?.endsWith(".jsonl") === true || input.fileName?.endsWith(".json") === true;
    } catch {
      return false;
    }
  },

  parse(input: SourceInput): ParseResult {
    const issues: ParseIssue[] = [];
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const artifact: ImportArtifact = {
      id: `${ADAPTER_ID}:${sha256.slice(0, 12)}`,
      sourceType: "timetable",
      ...(input.fileName ? { fileName: input.fileName } : {}),
      sha256,
      parserVersion: `${ADAPTER_ID}@${ADAPTER_VERSION}`,
      schemaVersion: SCHEMA_VERSION,
      status: "candidate",
      importedAt: new Date(0).toISOString(), // deterministic — real pipeline stamps wall clock at import
      errors: [],
      warnings: [],
    };

    const finish = (courses: Course[], sections: Section[]): ParseResult => {
      artifact.errors = issueCodes(issues, "error");
      artifact.warnings = issueCodes(issues, "warning");
      return { artifact, courses, sections, terms: [], issues };
    };

    let text: string;
    try {
      text = decode(input.bytes).trim();
    } catch (e) {
      issues.push({ code: "NO_VALID_SECTION_ROWS", severity: "error", message: `input is not valid UTF-8: ${(e as Error).message}` });
      return finish([], []);
    }

    let payload: JsonlPayload;
    try {
      try {
        payload = parsePayload(text);
      } catch {
        // JSONL fallback: each non-empty line must be a complete record.
        const lines = text.split("\n").filter((line) => line.trim());
        payload = { sections: lines.map((line) => JSON.parse(line)) };
      }
    } catch (e) {
      issues.push({ code: "NO_VALID_SECTION_ROWS", severity: "error", message: `input is not valid JSON/JSONL: ${(e as Error).message}` });
      return finish([], []);
    }

    const rawSections = payload.sections;
    const rawCourses = payload.courses;
    if (rawSections !== undefined && !Array.isArray(rawSections)) {
      issues.push({ code: "NO_VALID_SECTION_ROWS", severity: "error", field: "sections", message: "sections must be an array" });
    }
    if (rawCourses !== undefined && !Array.isArray(rawCourses)) {
      issues.push({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "courses", message: "courses must be an array" });
    }

    const sectionValues = Array.isArray(rawSections) ? rawSections : [];
    const sections = sectionValues.filter(isSectionRecord).filter((section) => {
      if (!isSafeSessionContainer(section)) {
        issues.push({ code: "NO_VALID_SECTION_ROWS", severity: "error", field: "sessions", message: `Section ${section.id} contains a malformed session` });
        return false;
      }
      return true;
    });
    if (sections.length === 0) {
      issues.push({ code: "NO_VALID_SECTION_ROWS", severity: "error", message: "payload contains no valid sections" });
    } else if (sections.length !== sectionValues.length) {
      issues.push({ code: "NO_VALID_SECTION_ROWS", severity: "error", message: "payload contains malformed section records" });
    }

    const courseValues = Array.isArray(rawCourses) ? rawCourses : [];
    const courses = courseValues.filter(isCourseRecord);
    if (courses.length !== courseValues.length) {
      issues.push({ code: "CONFLICTING_NORMALIZED_FIELDS", severity: "error", field: "courses", message: "payload contains malformed course records" });
    }

    const teachingWeeks = input.context?.teachingWeeks && Number.isInteger(input.context.teachingWeeks) && input.context.teachingWeeks > 0
      ? input.context.teachingWeeks
      : 15;
    const maxPeriod = 12;
    for (const c of courses) issues.push(...validateCourse(c));
    for (const section of sections) issues.push(...validateSection(section, maxPeriod, teachingWeeks));

    return finish(courses, sections);
  },
};
