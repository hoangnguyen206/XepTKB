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
  isFixedSession,
} from "@ky-nay/domain";
import type { ImportProfile, ParseCoverage, ParserAdapter, ParseResult, SourceInput } from "./adapter.js";
import { readOoxmlWorkbook, type OoxmlSheet } from "./ooxml.js";
import {
  canonicalColumn,
  detectCampus,
  foldText,
  isCanonicalSectionId,
  normalizeCode,
  normalizeDisplay,
  normalizeGroup,
  normalizeKind,
  normalizeLecturers,
  normalizeRoom,
  parseCredits,
  parseDay,
  parsePeriodRanges,
  periodsFromShiftCell,
  sectionIdFromCourse,
} from "./normalize.js";
import { CANCELLED_SHEET_WORDS, KNOWN_FORMATS, ONLINE_ROOM_WORDS, REPEATABLE_COLUMNS, REQUIRED_COLUMNS } from "./uet-config.js";
import { parseNote } from "./weeks.js";

const ADAPTER_ID = "uet-xlsx";
const ADAPTER_VERSION = "0.2.0";
const DEFAULT_MAX_BYTES = 12 * 1024 * 1024;
const MAX_PERIOD = 12;

/** Canonical field → source column indexes (several only for REPEATABLE_COLUMNS). */
type HeaderMapping = Map<string, number[]>;

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
  const values = (record.mapping.get(field) ?? []).map((index) => normalizeDisplay(record.row[index])).filter((value): value is string => value !== undefined);
  return values.length === 0 ? undefined : values.join(" · ");
}

function hasWord(value: string, words: readonly string[]): boolean {
  const folded = foldText(value).split(/[^a-z0-9]+/);
  return words.some((word) => folded.includes(word));
}

function courseCodeValue(value: string): { code: string; altCodes: string[] } {
  const normalized = normalizeCode(value);
  const withoutPrefix = normalized.replace(/^UET\./, "");
  return withoutPrefix === normalized
    ? { code: normalized, altCodes: [] }
    : { code: withoutPrefix, altCodes: [normalized] };
}

/** Section id built from the row's course code (`EMA 3062 1` + `EMA 3062` → `EMA3062 1`; `UET.` prefix dropped). */
function canonicalSection(value: string, courseCode: string): { id: string; courseCode: string } | undefined {
  const id = sectionIdFromCourse(value.replace(/^\s*UET\./i, ""), courseCode);
  const parts = id.split(/\s+/);
  if (parts.length < 2) return undefined;
  const sectionCourse = courseCodeValue(parts[0]!).code;
  const canonical = `${sectionCourse} ${parts.slice(1).join(" ")}`;
  return isCanonicalSectionId(canonical) ? { id: canonical, courseCode: sectionCourse } : undefined;
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
  const required = REQUIRED_COLUMNS;
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
      const existing = mapping.get(canonical);
      if (existing && REPEATABLE_COLUMNS.includes(canonical)) {
        existing.push(index);
      } else if (existing) {
        issues.push(issue("AMBIGUOUS_HEADER", "error", `header maps more than one column to ${canonical}`, { field: canonical, sourceRow: rowIndex + 1 }));
      } else {
        mapping.set(canonical, [index]);
      }
    }
    const score = required.filter((field) => mapping.has(field)).length;
    if (score > 0) candidates.push({ mapping, rowIndex, score: score * 100 - unknownCount });
  }
  candidates.sort((a, b) => b.score - a.score || a.rowIndex - b.rowIndex);
  const best = candidates[0];
  const present = best?.mapping ?? new Map<string, number[]>();
  const missing = required.filter((field) => !present.has(field));
  if (!present.has("shift") && !present.has("periodText")) missing.push("shift");
  if (!best || missing.length > 0) {
    for (const field of missing) issues.push(issue("MISSING_REQUIRED_COLUMN", "error", `required column ${field} was not found`, { field }));
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

type SelectedSheet = { sheet: OoxmlSheet; mapping: HeaderMapping; headerRow: number; cancelled: Set<string> };

/** Section ids listed on a cancelled-classes sheet, built the same way as timetable ids. */
function cancelledSectionIds(sheet: OoxmlSheet, header: { mapping: HeaderMapping; headerRow: number }): Set<string> {
  const ids = new Set<string>();
  for (let rowIndex = header.headerRow; rowIndex < sheet.rows.length; rowIndex += 1) {
    const record: RowRecord = { row: sheet.rows[rowIndex] ?? [], sourceRow: rowIndex + 1, mapping: header.mapping };
    const rawSection = rowValue(record, "sectionId");
    const rawCourse = rowValue(record, "courseCode");
    const section = rawSection && rawCourse ? canonicalSection(rawSection, courseCodeValue(rawCourse).code) : undefined;
    if (section) ids.add(section.id);
  }
  return ids;
}

function selectSheet(workbook: { sheets: OoxmlSheet[] }, profile: ImportProfile | undefined, issues: ParseIssue[]): SelectedSheet | undefined {
  const cancelledWords = profile?.cancelledSheetPatterns ?? CANCELLED_SHEET_WORDS;
  const candidates: Array<{ sheet: OoxmlSheet; mapping: HeaderMapping; headerRow: number }> = [];
  const cancelled = new Set<string>();
  let firstMissing: ParseIssue[] | undefined;
  for (const sheet of workbook.sheets) {
    const headerIssues: ParseIssue[] = [];
    const header = findHeader(sheet, headerIssues);
    // A "Các lớp hủy" sheet has the timetable header too; it is never the timetable, only the list of cancelled ids.
    if (hasWord(sheet.name, cancelledWords)) {
      if (header) for (const id of cancelledSectionIds(sheet, header)) cancelled.add(id);
      continue;
    }
    if (profile?.sheet !== undefined && sheet.name !== profile.sheet) continue;
    if (header) candidates.push({ sheet, ...header });
    else firstMissing ??= headerIssues.filter((item) => item.code === "MISSING_REQUIRED_COLUMN");
  }
  if (candidates.length === 0) {
    // Name the missing columns of the first timetable-like sheet so the admin knows what the new layout lacks.
    issues.push(...(firstMissing ?? []));
    issues.push(issue("MISSING_REQUIRED_COLUMN", "error", profile?.sheet !== undefined ? `worksheet ${profile.sheet} has no complete UET timetable header` : "no worksheet contains the required UET timetable header"));
    return undefined;
  }
  candidates.sort((a, b) => a.headerRow - b.headerRow || a.sheet.name.localeCompare(b.sheet.name));
  const selected = candidates[0]!;
  const selectedHeader = findHeader(selected.sheet, issues);
  return selectedHeader ? { sheet: selected.sheet, ...selectedHeader, cancelled } : undefined;
}

function formatFingerprint(mapping: HeaderMapping): { columns: string[]; known: boolean } {
  const columns = [...mapping.keys()].sort();
  const key = columns.join(",");
  return { columns, known: KNOWN_FORMATS.some((format) => [...format.columns].sort().join(",") === key) };
}

function sectionSource(artifact: ImportArtifact, row: number): SourceRef {
  return { artifactId: artifact.id, sourceType: "timetable", sourceRow: row, rawHash: artifact.sha256! };
}

function sessionKey(session: Session): string {
  if (!isFixedSession(session)) return ["non-fixed", session.kind, session.group ?? "", session.weeks.join(",")].join("|");
  return [session.day, session.startPeriod, session.endPeriod, session.kind, session.group ?? "", session.room ?? "", session.campus ?? "", session.weeks.join(",")].join("|");
}

function addSession(target: Section, session: Session, sourceRow: number, issues: ParseIssue[]): boolean {
  const key = sessionKey(session);
  if (target.sessions.some((existing) => sessionKey(existing) === key)) {
    target.warnings.push("DUPLICATE_SESSION_COLLAPSED");
    issues.push(issue("DUPLICATE_SESSION_COLLAPSED", "warning", "duplicate normalized session collapsed", { sourceRow }));
    return false;
  }
  target.sessions.push(session);
  return true;
}

function buildCourse(record: RowRecord, course: { code: string; altCodes: string[] }): Course | undefined {
  const name = rowValue(record, "courseName");
  if (!name) return undefined;
  const credits = parseCredits(rowValue(record, "credits"));
  return {
    code: course.code,
    altCodes: course.altCodes,
    name,
    normalizedName: name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    ...(credits === undefined ? {} : { credits }),
    school: "uet",
  };
}

type RowCounts = Omit<ParseCoverage, "sheet" | "headerRow" | "columns" | "knownFormat">;

function parseRows(input: SourceInput, artifact: ImportArtifact, selected: SelectedSheet, issues: ParseIssue[]): { sections: Section[]; courses: Course[]; counts: RowCounts } {
  const { sheet, mapping, headerRow, cancelled } = selected;
  const teachingWeeks = input.context?.teachingWeeks && Number.isInteger(input.context.teachingWeeks) && input.context.teachingWeeks > 0 ? input.context.teachingWeeks : 15;
  const datasetVersion = input.context?.datasetVersion ?? "candidate";
  const shiftRange = input.profile?.shiftRange ?? "shifts";
  const sections = new Map<string, Section>();
  const courses = new Map<string, Course>();
  const seenCourseRows = new Set<string>();
  const seenCancelled = new Set<string>();
  const seenRooms = new Set<string>();
  const counts: RowCounts = { sectionRows: 0, parsedRows: 0, skippedRows: {}, errorRows: 0 };
  const skip = (reason: string) => { counts.skippedRows[reason] = (counts.skippedRows[reason] ?? 0) + 1; };
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
    if (!rawSection) continue; // title/subtotal/heading/signature row
    counts.sectionRows += 1;
    const issuesBefore = issues.length;
    const outcome = parseRow(record, rawSection, rawCourseCode, rawCourseName);
    const rowFailed = issues.slice(issuesBefore).some((item) => item.severity === "error");
    if (outcome === "error" || rowFailed) counts.errorRows += 1;
    else if (outcome === "parsed") counts.parsedRows += 1;
    else skip(outcome);
  }

  /** Parses one row with a section id; returns "parsed", "error" or the reason it was skipped. */
  function parseRow(record: RowRecord, rawSection: string, rawCourseCode: string | undefined, rawCourseName: string | undefined): string {
    if (!rawCourseCode || !rawCourseName) {
      issues.push(issue("NO_VALID_SECTION_ROWS", "error", "section row is missing course code or course name", { sourceRow: record.sourceRow }));
      return "error";
    }
    const course = courseCodeValue(rawCourseCode);
    const section = canonicalSection(rawSection, course.code);
    if (!section) {
      issues.push(issue("INVALID_SECTION_ID", "error", "row contains a non-canonical section id", { sourceRow: record.sourceRow, field: "sectionId", rawValue: rawSection }));
      return "error";
    }
    if (course.code !== section.courseCode) {
      issues.push(issue("CONFLICTING_NORMALIZED_FIELDS", "error", "course code and section id disagree after normalization", { sourceRow: record.sourceRow, field: "courseCode" }));
      return "error";
    }
    if (cancelled.has(section.id)) {
      if (!seenCancelled.has(section.id)) {
        seenCancelled.add(section.id);
        issues.push(issue("SECTION_CANCELLED", "warning", `section ${section.id} is listed on the cancelled-classes sheet and is not imported`, { sourceRow: record.sourceRow, field: "sectionId", rawValue: section.id }));
      }
      return "cancelled";
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
    if (!builtCourse || builtCourse.credits === undefined) {
      if (!seenCourseRows.has(course.code)) {
        seenCourseRows.add(course.code);
        issues.push(issue("CREDITS_MISSING", "warning", "course credits missing or invalid; course remains searchable with incomplete credits", { sourceRow: record.sourceRow, field: "credits" }));
      }
    }

    const rawDay = rowValue(record, "day");
    const day = parseDay(rawDay ?? "");
    const note = rowValue(record, "note");
    const noteResult = parseNote(note, teachingWeeks);
    issues.push(...noteResult.issues.map((item) => ({ ...item, sourceRow: record.sourceRow })));
    if (noteResult.issues.some((item) => item.code === "AMBIGUOUS_NOTE")) return "error";
    const weeks = noteResult.weeks;
    const weekOrigin = noteResult.weekOrigin;
    if (!weeks) return "error";
    const notePeriods = noteResult.periodOverride ? [{ startPeriod: noteResult.periodOverride.startPeriod, endPeriod: noteResult.periodOverride.endPeriod }] : [];
    if (notePeriods.length > 0) {
      issues.push(issue("PERIOD_OVERRIDE_APPLIED", "warning", "note period override takes precedence over shift/period columns", { sourceRow: record.sourceRow, field: "note" }));
    }
    const rawShift = rowValue(record, "shift");
    const rawPeriods = rowValue(record, "periodText");
    const columnPeriods = parsePeriodRanges(rawPeriods);
    const shiftCell = notePeriods.length > 0 || columnPeriods.length > 0 ? { ranges: [], rangeRead: false } : periodsFromShiftCell(rawShift, shiftRange);
    if (shiftCell.rangeRead) {
      issues.push(issue("SHIFT_RANGE_INTERPRETED", "warning", `Ca range read as ${shiftRange === "shifts" ? "shifts" : "periods"} (import profile shiftRange)`, { sourceRow: record.sourceRow, field: "shift", ...(rawShift ? { rawValue: rawShift } : {}) }));
    }
    const ranges = notePeriods.length > 0 ? notePeriods : columnPeriods.length > 0 ? columnPeriods : shiftCell.ranges;
    const uniqueRanges = new Map<string, { startPeriod: number; endPeriod: number }>();
    for (const range of ranges) uniqueRanges.set(`${range.startPeriod}-${range.endPeriod}`, range);
    const room = normalizeRoom(rowValue(record, "room"));
    // A file without a kind column marks self-paced classes only by room ("Học Online") and an empty day/shift;
    // projects and theses have no time either. Both are kept without a fixed slot (Q-009, Q-012).
    const noTime = !rawDay && !rawShift && !rawPeriods && notePeriods.length === 0;
    const kindColumn = record.mapping.has("kind");
    const kind = !kindColumn && noTime && room !== undefined && hasWord(room, ONLINE_ROOM_WORDS) ? "ONL" : normalizeKind(rowValue(record, "kind"));
    const campus = detectCampus(room);
    // Reported once per distinct room so a reviewer sees the list of rooms, not one line per session.
    if (room && !campus && !seenRooms.has(room)) {
      seenRooms.add(room);
      issues.push(issue("ROOM_CAMPUS_UNKNOWN", "warning", "room campus did not match configured UET campus patterns", { sourceRow: record.sourceRow, field: "room", rawValue: room }));
    }
    const group = normalizeGroup(rowValue(record, "group"));
    if (!group) issues.push(issue("GROUP_MISSING", "warning", "session group is missing; reviewer must confirm applicability", { sourceRow: record.sourceRow, field: "group" }));
    const sessionBase = {
      frame: "uet-default",
      weeks,
      ...(weekOrigin ? { weekOrigin } : {}),
      kind,
      ...(group ? { group } : {}),
      ...(room ? { room } : {}),
      ...(campus ? { campus } : {}),
      lecturers: normalizeLecturers(rowValue(record, "lecturer")),
      ...(note ? { rawNote: note } : {}),
      source,
      confidence: "deterministic" as const,
    };
    // Q-009: ONL classes are self-paced per lecturer — listed and counted for credits, never placed on the week grid.
    if (kind === "ONL" || (!kindColumn && noTime)) {
      if (kind === "ONL") target.online = true;
      issues.push(issue("NON_FIXED_TIME", "warning", `${kind === "ONL" ? "ONL" : "untimed (project/thesis)"} session is kept without a fixed day/period and is not placed on the week grid`, { sourceRow: record.sourceRow }));
      return addSession(target, { id: `${section.id}:${record.sourceRow}:non-fixed`, fixedTime: false, ...sessionBase }, record.sourceRow, issues) ? "parsed" : "duplicate";
    }
    if (day === undefined || uniqueRanges.size === 0) {
      issues.push(issue("INVALID_DAY_OR_PERIOD", "error", "row has no valid day and period range", { sourceRow: record.sourceRow }));
      return "error";
    }
    let added = false;
    for (const range of uniqueRanges.values()) {
      if (range.startPeriod < 1 || range.endPeriod > MAX_PERIOD || range.startPeriod > range.endPeriod) {
        issues.push(issue("INVALID_DAY_OR_PERIOD", "error", `periods must be within 1..${MAX_PERIOD}`, { sourceRow: record.sourceRow, field: "periodText" }));
        continue;
      }
      added = addSession(target, {
        id: `${section.id}:${record.sourceRow}:${range.startPeriod}-${range.endPeriod}`,
        day,
        startPeriod: range.startPeriod,
        endPeriod: range.endPeriod,
        ...sessionBase,
      }, record.sourceRow, issues) || added;
    }
    return added ? "parsed" : "duplicate";
  }

  for (const section of sections.values()) {
    issues.push(...validateSection(section, MAX_PERIOD, teachingWeeks));
  }
  for (const course of courses.values()) issues.push(...validateCourse(course));
  return { sections: [...sections.values()], courses: [...courses.values()], counts };
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
    const finish = (courses: Course[], sections: Section[], coverage?: ParseCoverage): ParseResult => {
      artifact.errors = issueCodes(issues, "error");
      artifact.warnings = issueCodes(issues, "warning");
      issues.push(...validateArtifact(artifact));
      artifact.errors = issueCodes(issues, "error");
      return { artifact, courses, sections, terms: [], issues, ...(coverage ? { coverage } : {}) };
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
    const selected = selectSheet(workbook, input.profile, issues);
    if (!selected) return finish([], []);
    const fingerprint = formatFingerprint(selected.mapping);
    if (!fingerprint.known) {
      // A column set nobody has reviewed yet is held for review instead of being published as a candidate.
      artifact.status = "hold";
      issues.push(issue("FORMAT_UNRECOGNIZED", "warning", `header columns ${fingerprint.columns.join(", ")} do not match a reviewed UET format; import is held for review`, { sourceRow: selected.headerRow }));
    }
    const result = parseRows(input, artifact, selected, issues);
    if (result.sections.length === 0) issues.push(issue("NO_VALID_SECTION_ROWS", "error", "workbook contains no valid timetable sections"));
    return finish(result.courses, result.sections, { sheet: selected.sheet.name, headerRow: selected.headerRow, columns: fingerprint.columns, knownFormat: fingerprint.known, ...result.counts });
  },
};
