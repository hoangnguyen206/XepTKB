import { DOMParser } from "@xmldom/xmldom";
import {
  SCHEMA_VERSION,
  validateArtifact,
  validateSection,
  type ImportArtifact,
  type ParseIssue,
  type Section,
  type Session,
} from "@ky-nay/domain";
import type { ParserAdapter, ParseResult, SourceInput } from "./adapter.js";
import {
  detectCampus,
  normalizeDisplay,
  normalizeCode,
  normalizeGroup,
  normalizeKind,
  normalizeLecturers,
  normalizeRoom,
  normalizeSectionId,
  parseDays,
  parsePeriodRanges,
} from "./normalize.js";

const ADAPTER_ID = "vnu-registration-html";
const ADAPTER_VERSION = "0.1.0";
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

const HEADER_SYNONYMS: Record<string, string[]> = {
  courseCode: ["ma hp", "ma mon", "ma hoc phan", "ma hoc phan"],
  courseName: ["mon", "ten hoc phan", "ten mon", "hoc phan"],
  sectionId: ["ma lhp", "ma lop hoc phan", "lop hoc phan", "ma lop"],
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

function safeCandidateSection(row: Record<string, string>, source: { artifactId: string; sourceType: "registration"; sourceRow: number }, teachingWeeks: number): Section {
  const sectionId = row.sectionId ? normalizeSectionId(row.sectionId) : `REGISTRATION ROW ${source.sourceRow}`;
  const courseCode = row.courseCode ? normalizeCode(row.courseCode) : "UNKNOWN";
  const sectionSource = { ...source };
  const days = parseDays(row.day);
  const ranges = parsePeriodRanges(row.periodText);
  const kind = normalizeKind(row.kind);
  const weeks = Array.from({ length: teachingWeeks }, (_, index) => index + 1);
  const sessions: Session[] = [];
  for (const day of days) {
    for (const range of ranges) {
      const group = normalizeGroup(row.group);
      const room = normalizeRoom(row.room);
      const campus = detectCampus(row.room);
      sessions.push({
        id: `${sectionId}:${source.sourceRow}:${day}:${range.startPeriod}-${range.endPeriod}`,
        day,
        startPeriod: range.startPeriod,
        endPeriod: range.endPeriod,
        frame: "uet-default",
        weeks,
        kind,
        ...(group ? { group } : {}),
        ...(room ? { room } : {}),
        ...(campus ? { campus } : {}),
        lecturers: normalizeLecturers(row.lecturer),
        source: sectionSource,
        confidence: "deterministic",
      });
    }
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
      const sourceRow = rowIndex + 1;
      const section = safeCandidateSection(row, { artifactId: artifact.id, sourceType: "registration", sourceRow }, teachingWeeks);
      if (!row.courseCode || !row.sectionId || section.sessions.length === 0) {
        issues.push(issue("REGISTRATION_OVERRIDE_UNMATCHED", "warning", "registration schedule row could not produce a complete local candidate", { sourceRow }));
        continue;
      }
      sections.push(section);
    }
    for (const section of sections) issues.push(...validateSection(section, 12, teachingWeeks));
    if (sections.length === 0) issues.push(issue("NO_VALID_SECTION_ROWS", "error", "registration table contains no usable schedule rows"));
    return finish(sections);
  },
};
