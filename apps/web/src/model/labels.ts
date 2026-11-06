/** User-facing wording for provenance and the independence disclaimer (CLAUDE.md §3, PRD §4 #12). */
import type { DatasetEntry, DatasetStatus, SourceType } from "../data/contract.js";

export const APP_NAME = "Kỳ Này";
export const INDEPENDENCE_NOTE = "Công cụ độc lập của sinh viên, không phải sản phẩm của nhà trường.";
export const VERIFY_NOTE = "Dữ liệu chỉ để tham khảo — luôn đối chiếu với cổng đăng ký của trường.";
export const PRIVACY_NOTE = "Phương án của bạn chỉ lưu trên thiết bị này, không gửi đi đâu. Ứng dụng không dùng công cụ theo dõi hay thống kê người dùng.";
export const SYNTHETIC_NOTE = "Dữ liệu mẫu tổng hợp để thử nghiệm — không phải thời khóa biểu thật của trường.";

const SOURCE_LABEL: Record<SourceType, string> = {
  "official-timetable": "TKB chính thức",
  "planned-timetable": "TKB dự kiến",
  "synthetic-fixture": "Dữ liệu mẫu (tổng hợp)",
};

const STATUS_LABEL: Record<DatasetStatus, string> = {
  candidate: "chưa duyệt",
  validated: "đã kiểm tra, chưa công bố",
  published: "đã công bố",
  retracted: "đã thu hồi",
};

export function sourceLabel(type: SourceType): string {
  return SOURCE_LABEL[type];
}

export function statusLabel(status: DatasetStatus): string {
  return STATUS_LABEL[status];
}

export function isSynthetic(entry: DatasetEntry): boolean {
  return entry.source.type === "synthetic-fixture";
}

/** One-line provenance stamped into every export. */
export function provenanceLine(entry: DatasetEntry): string {
  return `Dữ liệu ${entry.datasetVersion} · ${sourceLabel(entry.source.type)} · nguồn ${entry.source.documentRef} · trạng thái ${statusLabel(entry.status)}`;
}

export function exportDisclaimer(entry: DatasetEntry): string {
  return [INDEPENDENCE_NOTE, VERIFY_NOTE, ...(isSynthetic(entry) ? [SYNTHETIC_NOTE] : [])].join(" ");
}

/** `2026-10-25T07:30:00.000Z` → `25/10/2026 14:30` in Vietnam time. */
export function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

/** ASCII file name stem, e.g. `ky-nay-2026-2027-h2`. */
export function fileStem(term: string): string {
  return `ky-nay-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}
