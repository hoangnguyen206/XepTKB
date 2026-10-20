import { createHash } from "node:crypto";
import {
  SCHEMA_VERSION,
  validateArtifact,
  validateCourse,
  validateSection,
  type Course,
  type ImportArtifact,
  type ParseIssue,
  type Section,
  type Session,
  type SourceRef,
} from "@ky-nay/domain";
import type { ParserAdapter, ParseResult, SourceInput } from "./adapter.js";
import { readOoxmlWorkbook, type OoxmlSheet } from "./ooxml.js";
import {
  canonicalColumn,
  detectCampus,
  isCanonicalSectionId,
  normalizeCode,
  normalizeDisplay,
  normalizeGroup,
  normalizeKind,
  normalizeLecturers,
  normalizeRoom,
  normalizeSectionId,
  parseCredits,
  parseDay,
  parsePeriodRanges,
  periodsFromShift,
} from "./normalize.js";
import { parseNote } from "./weeks.js";

const ADAPTER_ID = "uet-xlsx";
const ADAPTER_VERSION = "0.1.0";
const DEFAULT_MAX_BYTES = 12 * 1024 * 1024;
const MAX_PERIOD = 12;

type HeaderMapping = Map<string, number>;

type RowRecord = {
  row: string[];
  sourceRow: number;
  mapping: HeaderMapping;
};

function issue(
  code: ParseIssue["code"],
  severity: ParseIssue["severity"],
  message: string,
  details: Partial<ParseIssue> = {},
): ParseIssue {
  return { code, severity, message, ...details };
}

function rowValue(record: RowRecord, field: string): string | undefined {
  const index = record.mapping.get(field);
  return index === undefined ? undefined : normalizeDisplay(record.row[index]);
}

function courseCodeValue(value: string): { code: string; altCodes: string[] } {
  const normalized = normalizeCode(value);
  const withoutPrefix = normalized.replace(/^UET\./, "");
  return withoutPrefix === normalized
    ? { code: normalized, altCodes: [] }
    : { code: withoutPrefix, altCodes: [normalized] };
}

function canonicalSection(value: string): { id: string; courseCode: string } | undefined {
  const normalized = normalizeSectionId(value);
  const parts = normalized.split(/\s+/);
  if (parts.length < 2) return undefined;
  const course = courseCodeValue(parts.shift()!).code;
  const id = `${course} ${parts.join(" ")}`;
  return isCanonicalSectionId(id) ? { id, courseCode: course } : undefined;
}

function makeArtifact(input: SourceInput, sha256: string): ImportArtifact {
  return {
    id: `${ADAPTER_ID}:${sha256.slice(0, 12)}`,
    sourceType: "timetable",
    ...(input.fileName ? { fileName: input.fileName } : {}),
    sha256,
    parserVersion: `${ADAPTER_ID}@${ADAPTER_VERSION}`,
    schemaVersion: SCHEMA_VERSION,
    status: "candidate",
    importedAt: new Date(0).toISOString(),
    errors: [],
    warnings: [],
  };
}

function findHeader(sheet: OoxmlSheet, issues: ParseIssue[]): { mapping: HeaderMapping; headerRow: number } | undefined {
  const required = ["courseCode", "courseName", "sectionId", "kind"];
  const candidates: Array<{ mapping: HeaderMapping; rowIndex: number; score: number }> = [];
  const maxRows = Math.min(sheet.rows.length, 12);
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const values = sheet.rows[rowIndex] ?? [];
    const mapping: HeaderMapping = new Map();
    let unknownCount = 0;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (!value?.trim()) continue;
      const canonical = canonicalColumn(value);
      if (!canonical) {
        unknownCount += 1;
        continue;
      }
      if (mapping.has(canonical)) {
        issues.push(issue("AMBIGUOUS_HEADER", "error", `header maps more than one column to ${canonical}`, { field: canonical, sourceRow: rowIndex + 1 }));
      } else {
        mapping.set(canonical, index);
      }
    }
    const score = required.filter((field) => mapping.has(field)).length;
    if (score > 0) candidates.push({ mapping, rowIndex, score: score * 100 - unknownCount });
  }
  candidates.sort((a, b) => b.score - a.score || a.rowIndex - b.rowIndex);
  const best = candidates[0];
  const bestRequiredCount = best?.mapping ? required.filter((field) => best.mapping.has(field)).length : 0;
  if (!best || bestRequiredCount !== required.length) {
    const present = best?.mapping ?? new Map<string, number>();
    for (const field of ["courseCode", "courseName", "sectionId", "kind"]) {
      if (!present.has(field)) issues.push(issue("MISSING_REQUIRED_COLUMN", "error", `required column ${field} was not found`, { field }));
    }
    return undefined;
  }
  const values = sheet.rows[best.rowIndex] ?? [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value?.trim() && !canonicalColumn(value)) {
      issues.push(issue("UNKNOWN_COLUMN", "warning", "unmapped source column was retained only as source input", { sourceRow: best.rowIndex + 1, field: `column-${index + 1}` }));
    }
  }
  return { mapping: best.mapping, headerRow: best.rowIndex + 1 };
}

function selectSheet(workbook: { sheets: OoxmlSheet[] }, issues: ParseIssue[]): { sheet: OoxmlSheet; mapping: HeaderMapping; headerRow: number } | undefined {
  const candidates: Array<{ sheet: OoxmlSheet; mapping: HeaderMapping; headerRow: number }> = [];
  for (const sheet of workbook.sheets) {
    const localIssues: ParseIssue[] = [];
    const header = findHeader(sheet, localIssues);
    if (header) candidates.push({ sheet, ...header });
  }
  if (candidates.length === 0) {
    issues.push(issue("MISSING_REQUIRED_COLUMN", "error", "no worksheet contains the required UET timetable header"));
    return undefined;
  }
  candidates.sort((a, b) => a.headerRow - b.headerRow || a.sheet.name.localeCompare(b.sheet.name));
  const selected = candidates[0]!;
  const selectedHeader = findHeader(selected.sheet, issues);
  return selectedHeader ? { sheet: selected.sheet, ...selectedHeader } : undefined;
}

function sectionSource(artifact: ImportArtifact, row: number): SourceRef {
  return { artifactId: artifact.id, sourceType: "timetable", sourceRow: row, rawHash: artifact.sha256! };
}

function sessionKey(session: Session): string {
  return [session.day, session.startPeriod, session.endPeriod, session.kind, session.group ?? "", session.room ?? "", session.campus ?? "", session.weeks.join(",")].join("|");
}

function buildCourse(record: RowRecord, course: { code: string; altCodes: string[] }): Course | undefined {
  const name = rowValue(record, "courseName");
  if (!name) return undefined;
  const credits = parseCredits(rowValue(record, "credits"));
  if (credits === undefined) return undefined;
  return {
    code: course.code,
    altCodes: course.altCodes,
    name,
    normalizedName: name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    credits,
    school: "uet",
  };
}

function parseRows(input: SourceInput, artifact: ImportArtifact, sheet: OoxmlSheet, mapping: HeaderMapping, headerRow: number, issues: ParseIssue[]): { sections: Section[]; courses: Course[] } {
  const teachingWeeks = input.context?.teachingWeeks && Number.isInteger(input.context.teachingWeeks) && input.context.teachingWeeks > 0 ? input.context.teachingWeeks : 15;
  const datasetVersion = input.context?.datasetVersion ?? "candidate";
  const sections = new Map<string, Section>();
  const courses = new Map<string, Course>();
  const seenCourseRows = new Set<string>();
  const rows: RowRecord[] = [];
  for (let rowIndex = headerRow; rowIndex < sheet.rows.length; rowIndex += 1) {
    const row = sheet.rows[rowIndex] ?? [];
    if (!row.some((cell) => Boolean(cell?.trim()))) continue;
    rows.push({ row, sourceRow: sheet.rowNumbers[rowIndex] ?? rowIndex + 1, mapping });
  }

  for (const record of rows) {
    const rawSection = rowValue(record, "sectionId");
    const rawCourseCode = rowValue(record, "courseCode");
    const rawCourseName = rowValue(record, "courseName");
    const hasScheduleSignal = Boolean(rawCourseCode || rawCourseName || rawSection || rowValue(record, "day") || rowValue(record, "shift") || rowValue(record, "periodText"));
    if (!hasScheduleSignal) continue;
    if (!rawSection) continue; // title/subtotal/heading row
    const section = canonicalSection(rawSection);
    if (!section) {
      issues.push(issue("INVALID_SECTION_ID", "error", "row contains a non-canonical section id", { sourceRow: record.sourceRow, field: "sectionId", rawValue: rawSection }));
      continue;
    }
    if (!rawCourseCode || !rawCourseName) {
      issues.push(issue("NO_VALID_SECTION_ROWS", "error", "section row is missing course code or course name", { sourceRow: record.sourceRow }));
      continue;
    }
    const course = courseCodeValue(rawCourseCode);
    if (course.code !== section.courseCode) {
      issues.push(issue("CONFLICTING_NORMALIZED_FIELDS", "error", "course code and section id disagree after normalization", { sourceRow: record.sourceRow, field: "courseCode" }));
      continue;
    }
    const source = sectionSource(artifact, record.sourceRow);
    let target = sections.get(section.id);
    if (!target) {
      target = {
        id: section.id,
        courseCode: section.courseCode,
        homeClasses: [],
        online: false,
        sessions: [],
        source,
        datasetVersion,
        warnings: [],
      };
      sections.set(section.id, target);
    }
    const homeClass = rowValue(record, "homeClass");
    if (homeClass && !target.homeClasses.includes(homeClass)) target.homeClasses.push(homeClass);
    const builtCourse = buildCourse(record, course);
    if (builtCourse && !courses.has(course.code)) courses.set(course.code, builtCourse);
    if (!builtCourse && !seenCourseRows.has(course.code)) {
      seenCourseRows.add(course.code);
      issues.push(issue("CREDITS_MISSING", "warning", "course credits missing or invalid; course omitted from candidate list", { sourceRow: record.sourceRow, field: "credits" }));
    }

    const kind = normalizeKind(rowValue(record, "kind"));
    const day = parseDay(rowValue(record, "day") ?? "");
    const note = rowValue(record, "note");
    const noteResult = parseNote(note, teachingWeeks);
    issues.push(...noteResult.issues.map((item) => ({ ...item, sourceRow: record.sourceRow })));
    if (noteResult.issues.some((item) => item.code === "AMBIGUOUS_NOTE")) continue;
    const weeks = noteResult.weeks;
    if (!weeks) continue;
    const notePeriods = noteResult.periodOverride ? [{ startPeriod: noteResult.periodOverride.startPeriod, endPeriod: noteResult.periodOverride.endPeriod }] : [];
    if (notePeriods.length > 0) {
      issues.push(issue("PERIOD_OVERRIDE_APPLIED", "warning", "note period override takes precedence over shift/period columns", { sourceRow: record.sourceRow, field: "note" }));
    }
    const columnPeriods = parsePeriodRanges(rowValue(record, "periodText"));
    const ranges = notePeriods.length > 0
      ? notePeriods
      : columnPeriods.length > 0
        ? columnPeriods
        : periodsFromShift(rowValue(record, "shift"));
    const uniqueRanges = new Map<string, { startPeriod: number; endPeriod: number }>();
    for (const range of ranges) uniqueRanges.set(`${range.startPeriod}-${range.endPeriod}`, range);
    const room = normalizeRoom(rowValue(record, "room"));
    const campus = detectCampus(room);
    if (room && !campus) issues.push(issue("ROOM_CAMPUS_UNKNOWN", "warning", "room campus did not match configured UET campus patterns", { sourceRow: record.sourceRow, field: "room" }));
    const group = normalizeGroup(rowValue(record, "group"));
    if (!group) issues.push(issue("GROUP_MISSING", "warning", "session group is missing; reviewer must confirm applicability", { sourceRow: record.sourceRow, field: "group" }));
    if (day === undefined || uniqueRanges.size === 0) {
      issues.push(issue("INVALID_DAY_OR_PERIOD", "error", "row has no valid day and period range", { sourceRow: record.sourceRow }));
      continue;
    }
    for (const range of uniqueRanges.values()) {
      if (range.startPeriod < 1 || range.endPeriod > MAX_PERIOD || range.startPeriod > range.endPeriod) {
        issues.push(issue("INVALID_DAY_OR_PERIOD", "error", `periods must be within 1..${MAX_PERIOD}`, { sourceRow: record.sourceRow, field: "periodText" }));
        continue;
      }
      const session: Session = {
        id: `${section.id}:${record.sourceRow}:${range.startPeriod}-${range.endPeriod}`,
        day,
        startPeriod: range.startPeriod,
        endPeriod: range.endPeriod,
        frame: "uet-default",
        weeks,
        kind,
        ...(group ? { group } : {}),
        ...(room ? { room } : {}),
        ...(campus ? { campus } : {}),
        lecturers: normalizeLecturers(rowValue(record, "lecturer")),
        ...(note ? { rawNote: note } : {}),
        source,
        confidence: "deterministic",
      };
      const key = sessionKey(session);
      if (target.sessions.some((existing) => sessionKey(existing) === key)) {
        target.warnings.push("DUPLICATE_SESSION_COLLAPSED");
        issues.push(issue("DUPLICATE_SESSION_COLLAPSED", "warning", "duplicate normalized session collapsed", { sourceRow: record.sourceRow }));
      } else {
        target.sessions.push(session);
      }
    }
  }
  for (const section of sections.values()) {
    issues.push(...validateSection(section, MAX_PERIOD, teachingWeeks));
  }
  for (const course of courses.values()) issues.push(...validateCourse(course));
  return { sections: [...sections.values()], courses: [...courses.values()] };
}

function issueCodes(issues: ParseIssue[], severity: ParseIssue["severity"]): string[] {
  return [...new Set(issues.filter((item) => item.severity === severity).map((item) => item.code))];
}

export const uetXlsxAdapter: ParserAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,
  canParse(input: SourceInput): boolean {
    return input.bytes.length >= 4 && input.bytes[0] === 0x50 && input.bytes[1] === 0x4b;
  },
  parse(input: SourceInput): ParseResult {
    const issues: ParseIssue[] = [];
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const artifact = makeArtifact(input, sha256);
    const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
    const finish = (courses: Course[], sections: Section[]): ParseResult => {
      artifact.errors = issueCodes(issues, "error");
      artifact.warnings = issueCodes(issues, "warning");
      issues.push(...validateArtifact(artifact));
      artifact.errors = issueCodes(issues, "error");
      return { artifact, courses, sections, terms: [], issues };
    };
    if (input.bytes.length > maxBytes) {
      issues.push(issue("INPUT_TOO_LARGE", "error", `input exceeds ${maxBytes} byte limit`));
      return finish([], []);
    }
    let workbook: { sheets: OoxmlSheet[] };
    try {
      workbook = readOoxmlWorkbook(input.bytes);
    } catch (error) {
      issues.push(issue("MALFORMED_INPUT", "error", `workbook could not be safely parsed: ${(error as Error).message}`));
      return finish([], []);
    }
    const selected = selectSheet(workbook, issues);
    if (!selected) return finish([], []);
    const result = parseRows(input, artifact, selected.sheet, selected.mapping, selected.headerRow, issues);
    if (result.sections.length === 0) issues.push(issue("NO_VALID_SECTION_ROWS", "error", "workbook contains no valid timetable sections"));
    return finish(result.courses, result.sections);
  },
};
