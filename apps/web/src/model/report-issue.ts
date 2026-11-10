/**
 * "Báo sai dữ liệu" text (M5-B, DESIGN-M5-001 §3, ADR-0014 §4). Pure and PII-free by construction: it takes only the
 * build identity, public dataset identifiers, an optional public section id/course code, one field from a fixed list
 * and the user's own note. It never sees Plans, picks, registration data, unmatched notes, file names, the user agent
 * or local timestamps.
 */
import type { BuildInfo } from "../app/build-info.js";
import type { DatasetStatus } from "../data/contract.js";
import { APP_NAME, statusLabel } from "./labels.js";

export const REPORT_FIELDS = [
  { id: "time", label: "Giờ học / tiết" },
  { id: "day", label: "Thứ" },
  { id: "weeks", label: "Tuần học" },
  { id: "room", label: "Phòng học" },
  { id: "lecturer", label: "Giảng viên" },
  { id: "group", label: "Nhóm" },
  { id: "credits", label: "Số tín chỉ" },
  { id: "other", label: "Khác" },
] as const;

export type ReportFieldId = (typeof REPORT_FIELDS)[number]["id"];

export const REPORT_NOTE_MAX = 500;

/** Public dataset identifiers only (a whole `DatasetEntry` may be passed; nothing else is read). */
export type ReportDataset = { datasetVersion: string; term: string; termName: string; status: DatasetStatus };

/** Public section identifiers only. */
export type ReportSection = { sectionId: string; courseCode: string };

export type IssueReportInput = {
  build: BuildInfo;
  dataset?: ReportDataset;
  section?: ReportSection;
  field?: ReportFieldId;
  note?: string;
};

const MAX_IDENTIFIER = 120;

/** Single-line, length-capped copy of a public identifier. */
function oneLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, MAX_IDENTIFIER);
}

/** Caps the note at 500 characters and drops control characters other than line breaks. */
export function clampReportNote(note: string): string {
  return Array.from(note.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ""))
    .slice(0, REPORT_NOTE_MAX)
    .join("");
}

export function reportFieldLabel(id: ReportFieldId): string {
  return REPORT_FIELDS.find((item) => item.id === id)?.label ?? "Khác";
}

export function isReportFieldId(value: string): value is ReportFieldId {
  return REPORT_FIELDS.some((item) => item.id === value);
}

export function buildIssueReport(input: IssueReportInput): string {
  const { build, dataset, section } = input;
  const lines = [`Báo sai dữ liệu — ${APP_NAME}`];
  lines.push(`Ứng dụng: ${oneLine(build.version)} (${oneLine(build.commit)}, ${build.channel})${build.builtAt ? ` · dựng ${oneLine(build.builtAt)}` : ""}`);
  if (dataset) {
    lines.push(`Dữ liệu: ${oneLine(dataset.datasetVersion)} · ${oneLine(dataset.termName)} (${oneLine(dataset.term)}) · trạng thái ${statusLabel(dataset.status)}`);
  } else {
    lines.push("Dữ liệu: chưa tải được bộ dữ liệu");
  }
  if (section) lines.push(`Lớp: ${oneLine(section.sectionId)} (môn ${oneLine(section.courseCode)})`);
  lines.push(`Thông tin sai: ${input.field ? reportFieldLabel(input.field) : "chưa chọn"}`);
  const note = clampReportNote(input.note ?? "").trim();
  lines.push(`Mô tả: ${note.length > 0 ? note : "(trống)"}`);
  return lines.join("\n");
}

const PERSONAL_INFO_PATTERNS: readonly RegExp[] = [
  /(?<!\d)\d{8}(?!\d)/, // 8-digit number shaped like a student code
  /(?<!\d)\d{1,2}[/.-]\d{1,2}[/.-]\d{4}(?!\d)/, // dd/mm/yyyy date
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // e-mail address
  /(?<!\d)(?:0|\+84[\s.]?)\d(?:[\s.]?\d){8}(?!\d)/, // Vietnamese phone number
];

/** Warning heuristic for the free-text note; it never blocks copying. */
export function looksLikePersonalInfo(text: string): boolean {
  return PERSONAL_INFO_PATTERNS.some((pattern) => pattern.test(text));
}
