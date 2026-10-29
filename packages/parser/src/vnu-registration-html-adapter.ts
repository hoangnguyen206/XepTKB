import { DOMParser } from "@xmldom/xmldom";
import {
  SCHEMA_VERSION,
  validateArtifact,
  validateSection,
  type DayNo,
  type ImportArtifact,
  type ParseIssue,
  type Section,
  type Session,
} from "@ky-nay/domain";
import type { ParserAdapter, ParseResult, SourceInput } from "./adapter.js";
import {
  detectCampus,
  normalizeCode,
  normalizeGroup,
  normalizeKind,
  normalizeLecturers,
  normalizeRoom,
  normalizeSectionId,
  parseDay,
  parsePeriodRanges,
  type PeriodRange,
} from "./normalize.js";

const ADAPTER_ID = "vnu-registration-html";
const ADAPTER_VERSION = "0.2.0";
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

function localName(node: any): string {
  return String(node.localName ?? node.nodeName ?? "").split(":").pop()?.toLowerCase() ?? "";
}

function children(node: any, name?: string): any[] {
  const out: any[] = [];
  for (let i = 0; i < (node?.childNodes?.length ?? 0); i += 1) {
    const child = node.childNodes.item(i);
    if (child && (!name || localName(child) === name)) out.push(child);
  }
  return out;
}

function descendants(node: any, name: string): any[] {
  const out: any[] = [];
  const visit = (current: any) => {
    for (const child of children(current)) {
      if (localName(child) === name) out.push(child);
      visit(child);
    }
  };
  visit(node);
  return out;
}

function text(node: any): string {
  return String(node?.textContent ?? "").replace(/[ \t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function attr(node: any, name: string): string | undefined {
  const value = node?.getAttribute?.(name);
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

function issue(code: ParseIssue["code"], severity: ParseIssue["severity"], message: string, details: Partial<ParseIssue> = {}): ParseIssue {
  return { code, severity, message, ...details };
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function normalizedHeader(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[Đđ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

// The portal export (C-09 sample, 2026-10-29) uses "Mã môn học", "Môn học" and "Lớp môn học".
const HEADER_SYNONYMS: Record<string, string[]> = {
  courseCode: ["ma hp", "ma mon", "ma hoc phan", "ma mon hoc"],
  courseName: ["mon", "ten hoc phan", "ten mon", "hoc phan", "mon hoc"],
  sectionId: ["ma lhp", "ma lop hoc phan", "lop hoc phan", "ma lop", "lop mon hoc"],
  group: ["nhom", "to"],
  kind: ["loai buoi", "loai"],
  day: ["thu", "ngay"],
  periodText: ["tiet", "tiet hoc", "tiet thi"],
  room: ["phong", "giang duong", "gd", "phong hoc"],
  lecturer: ["gv", "giang vien"],
};

function mapHeader(value: string): string | undefined {
  const normalized = normalizedHeader(value);
  for (const [canonical, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    if (synonyms.includes(normalized) || normalized === canonical.toLowerCase()) return canonical;
  }
  return undefined;
}

function createLocalArtifact(_input: SourceInput): ImportArtifact {
  // The id is intentionally constant: it cannot identify a file or user.
  return {
    id: "local-registration",
    sourceType: "registration",
    localOnly: true,
    parserVersion: `${ADAPTER_ID}@${ADAPTER_VERSION}`,
    schemaVersion: SCHEMA_VERSION,
    status: "candidate",
    importedAt: new Date(0).toISOString(),
    errors: [],
    warnings: [],
  };
}

function parseTables(html: string): string[][][] {
  const document = new DOMParser({ onError: () => undefined }).parseFromString(html, "text/html");
  return descendants(document, "table").map((table) => descendants(table, "tr").map((row) => children(row, "th").concat(children(row, "td")).map(text)));
}

function findColumn(headers: string[], canonical: string): number | undefined {
  const index = headers.findIndex((header) => mapHeader(header) === canonical);
  return index >= 0 ? index : undefined;
}

function splitRows(table: string[][]): { headers: string[]; rows: string[][] } | undefined {
  const headerIndex = table.findIndex((row) => row.some((cell) => mapHeader(cell) !== undefined));
  if (headerIndex < 0) return undefined;
  return { headers: table[headerIndex]!, rows: table.slice(headerIndex + 1).filter((row) => row.some(Boolean)) };
}

/** Day tokens in source order; undefined when any token is not a day. */
function parseDayList(value: string | undefined): DayNo[] | undefined {
  const days = (value ?? "").split(/[;,|/]+/).map((token) => token.trim()).filter(Boolean).map(parseDay);
  return days.every((day): day is DayNo => day !== undefined) ? days : undefined;
}

type Slot = { day: DayNo; range: PeriodRange };

/**
 * C-09 sample: a row with several days lists one period range per day in the same order
 * (`T2,T6` + `4 - 6,1 - 3` is T2 4–6 and T6 1–3). A single day or a single range is shared;
 * any other count mismatch is ambiguous and yields no slot.
 */
function pairSlots(days: DayNo[], ranges: PeriodRange[]): Slot[] | undefined {
  if (days.length === 0 || ranges.length === 0) return [];
  if (days.length === ranges.length) return days.map((day, index) => ({ day, range: ranges[index]! }));
  if (days.length === 1) return ranges.map((range) => ({ day: days[0]!, range }));
  if (ranges.length === 1) return days.map((day) => ({ day, range: ranges[0]! }));
  return undefined;
}

const ROOM_TOKEN = /^\d{3}-[A-ZĐ][A-ZĐ0-9]*$/u;

/**
 * Rooms of a multi-slot row are concatenated with no separator (`301-B306-B`). A row is split only
 * when exactly one segmentation into `count` room tokens exists; one room token is shared by every slot.
 */
function splitRooms(value: string | undefined, count: number): (string | undefined)[] | undefined {
  const room = normalizeRoom(value);
  if (count <= 1 || room === undefined || ROOM_TOKEN.test(room)) return Array.from({ length: count }, () => room);
  const separated = room.split(/[\s,;|]+/).filter(Boolean);
  if (separated.length === count && separated.every((token) => ROOM_TOKEN.test(token))) return separated;
  const found: string[][] = [];
  const visit = (rest: string, pieces: string[]): void => {
    if (found.length > 1) return;
    if (pieces.length === count - 1) {
      if (ROOM_TOKEN.test(rest)) found.push([...pieces, rest]);
      return;
    }
    for (let end = 1; end < rest.length; end += 1) {
      const head = rest.slice(0, end);
      if (ROOM_TOKEN.test(head)) visit(rest.slice(end), [...pieces, head]);
    }
  };
  visit(room, []);
  return found.length === 1 ? found[0] : undefined;
}

/** `SYN 1007 5` for course `SYN1007` becomes `SYN1007 5`, the id shape the timetable adapter emits. */
function sectionIdFor(rawSection: string, courseCode: string): string {
  const normalized = normalizeSectionId(rawSection);
  let index = 0;
  for (const char of courseCode) {
    while (normalized[index] === " ") index += 1;
    if (normalized[index] !== char) return normalized;
    index += 1;
  }
  const suffix = normalized.slice(index);
  return /^ \S/.test(suffix) ? `${courseCode} ${suffix.trim()}` : normalized;
}

function safeCandidateSection(row: Record<string, string>, source: { artifactId: string; sourceType: "registration"; sourceRow: number }, teachingWeeks: number, issues: ParseIssue[]): Section | undefined {
  if (!row.courseCode || !row.sectionId) {
    issues.push(issue("REGISTRATION_OVERRIDE_UNMATCHED", "warning", "registration schedule row could not produce a complete local candidate", { sourceRow: source.sourceRow }));
    return undefined;
  }
  const courseCode = normalizeCode(row.courseCode);
  const sectionId = sectionIdFor(row.sectionId, courseCode);
  const sectionSource = { ...source };
  const kind = normalizeKind(row.kind);
  const weeks = Array.from({ length: teachingWeeks }, (_, index) => index + 1);
  const group = normalizeGroup(row.group);
  const sessionBase = (room: string | undefined) => {
    const campus = detectCampus(room);
    return {
      frame: "uet-default",
      weeks,
      weekOrigin: "parser-default" as const,
      kind,
      ...(group ? { group } : {}),
      ...(room ? { room } : {}),
      ...(campus ? { campus } : {}),
      lecturers: normalizeLecturers(row.lecturer),
      source: sectionSource,
      confidence: "deterministic" as const,
    };
  };
  let sessions: Session[];
  if (kind === "ONL") {
    // Q-009: an ONL class has no fixed slot; one non-fixed session lets it match the timetable and count for credits.
    sessions = [{ id: `${sectionId}:${source.sourceRow}:non-fixed`, fixedTime: false, ...sessionBase(normalizeRoom(row.room)) }];
  } else {
    const days = parseDayList(row.day);
    const slots = days ? pairSlots(days, parsePeriodRanges(row.periodText)) : undefined;
    if (slots === undefined) {
      issues.push(issue("REGISTRATION_OVERRIDE_UNMATCHED", "warning", "registration row lists days and period ranges that cannot be paired", { sourceRow: source.sourceRow, field: "periodText" }));
      return undefined;
    }
    const rooms = splitRooms(row.room, slots.length);
    if (!rooms) issues.push(issue("REGISTRATION_OVERRIDE_UNMATCHED", "warning", "registration rooms cannot be split per session; the timetable rooms are kept", { sourceRow: source.sourceRow, field: "room" }));
    sessions = slots.map((slot, index) => ({
      id: `${sectionId}:${source.sourceRow}:${slot.day}:${slot.range.startPeriod}-${slot.range.endPeriod}`,
      day: slot.day,
      startPeriod: slot.range.startPeriod,
      endPeriod: slot.range.endPeriod,
      ...sessionBase(rooms?.[index]),
    }));
  }
  if (sessions.length === 0) {
    issues.push(issue("REGISTRATION_OVERRIDE_UNMATCHED", "warning", "registration schedule row could not produce a complete local candidate", { sourceRow: source.sourceRow }));
    return undefined;
  }
  return {
    id: sectionId,
    courseCode,
    homeClasses: [],
    online: kind === "ONL",
    sessions,
    source: sectionSource,
    datasetVersion: "local-registration",
    warnings: [],
  };
}

function issueCodes(issues: ParseIssue[], severity: ParseIssue["severity"]): string[] {
  return [...new Set(issues.filter((item) => item.severity === severity).map((item) => item.code))];
}

export const vnuRegistrationHtmlAdapter: ParserAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,
  canParse(input: SourceInput): boolean {
    if (input.bytes.length === 0 || input.bytes.length > (input.maxBytes ?? DEFAULT_MAX_BYTES)) return false;
    try {
      const textValue = decode(input.bytes).toLowerCase();
      return textValue.includes("<table") && textValue.includes("</table>");
    } catch {
      return false;
    }
  },
  parse(input: SourceInput): ParseResult {
    const issues: ParseIssue[] = [];
    const artifact = createLocalArtifact(input);
    const finish = (sections: Section[]): ParseResult => {
      artifact.errors = issueCodes(issues, "error");
      artifact.warnings = issueCodes(issues, "warning");
      issues.push(...validateArtifact(artifact));
      artifact.errors = issueCodes(issues, "error");
      return { artifact, courses: [], sections, terms: [], issues };
    };
    const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
    if (input.bytes.length > maxBytes) {
      issues.push(issue("INPUT_TOO_LARGE", "error", `registration input exceeds ${maxBytes} byte local limit`));
      return finish([]);
    }
    let html: string;
    try {
      html = decode(input.bytes);
    } catch {
      issues.push(issue("MALFORMED_INPUT", "error", "registration input is not valid UTF-8"));
      return finish([]);
    }
    if (!/<table\b/i.test(html)) {
      issues.push(issue("UNSUPPORTED_INPUT", "error", "registration input does not contain a supported HTML table"));
      return finish([]);
    }
    let tables: string[][][];
    try {
      tables = parseTables(html);
    } catch {
      issues.push(issue("MALFORMED_INPUT", "error", "registration HTML could not be parsed safely"));
      return finish([]);
    }
    const table = tables.map(splitRows).find((candidate) => candidate !== undefined);
    if (!table) {
      issues.push(issue("MISSING_REQUIRED_COLUMN", "error", "registration table has no recognized schedule header"));
      return finish([]);
    }
    const columns = new Map<string, number>();
    for (let index = 0; index < table.headers.length; index += 1) {
      const canonical = mapHeader(table.headers[index]!);
      if (canonical && !columns.has(canonical)) columns.set(canonical, index);
    }
    for (const required of ["courseCode", "sectionId", "day", "periodText", "room"]) {
      if (!columns.has(required)) issues.push(issue("MISSING_REQUIRED_COLUMN", "error", `registration column ${required} is missing`, { field: required }));
    }
    if (issues.some((item) => item.severity === "error")) return finish([]);
    const teachingWeeks = input.context?.teachingWeeks && Number.isInteger(input.context.teachingWeeks) && input.context.teachingWeeks > 0 ? input.context.teachingWeeks : 15;
    const sections: Section[] = [];
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const values = table.rows[rowIndex]!;
      const row: Record<string, string> = {};
      for (const [canonical, index] of columns) row[canonical] = values[index] ?? "";
      // Summary rows (the portal's "Tổng" credit/fee total) carry no course or section.
      if (!row.courseCode && !row.sectionId) continue;
      const sourceRow = rowIndex + 1;
      const section = safeCandidateSection(row, { artifactId: artifact.id, sourceType: "registration", sourceRow }, teachingWeeks, issues);
      if (section) sections.push(section);
    }
    for (const section of sections) issues.push(...validateSection(section, 12, teachingWeeks));
    if (sections.length === 0) issues.push(issue("NO_VALID_SECTION_ROWS", "error", "registration table contains no usable schedule rows"));
    return finish(sections);
  },
};
