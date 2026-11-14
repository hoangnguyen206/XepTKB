/**
 * Dataset status chips (DESIGN-M6-001 §9, AC-M6-04; ADR-0010 §2 rule 4 as amended by ADR-0015 point 7). The same
 * inputs, conditions and sentences as the M5 banners (`DatasetBanners`, M5-D): only the presentation changes — an
 * always-visible, non-dismissible chip in the app bar, with the full sentence in the data-source sheet.
 */
import { formatDate } from "@ky-nay/export";
import type { ArtifactError, DatasetEntry } from "../data/contract.js";
import { ageText, datasetFreshness } from "./freshness.js";
import { SYNTHETIC_NOTE, formatInstant, isSynthetic, statusLabel } from "./labels.js";

export const ERROR_TEXT: Record<ArtifactError["code"], string> = {
  MANIFEST_UNAVAILABLE: "Không kết nối được tới nguồn dữ liệu.",
  INVALID_MANIFEST: "Danh mục dữ liệu không hợp lệ.",
  NO_DATASET: "Chưa có dữ liệu thời khóa biểu được công bố cho kỳ này.",
  INVALID_ARTIFACT: "Dữ liệu tải về không hợp lệ.",
  HASH_MISMATCH: "Dữ liệu tải về không khớp mã kiểm tra (có thể bị hỏng hoặc bị thay đổi).",
  SCHEMA_UNSUPPORTED: "Dữ liệu dùng định dạng mà phiên bản ứng dụng này chưa hỗ trợ.",
  DOMAIN_INVALID: "Dữ liệu vi phạm quy tắc thời khóa biểu nên đã bị từ chối.",
  TOO_LARGE: "Dữ liệu tải về vượt giới hạn kích thước.",
  INSECURE_CONTEXT: "Trình duyệt không kiểm tra được dữ liệu vì trang không được mở qua HTTPS. Hãy mở bằng địa chỉ https://.",
};

export type DatasetStatusId = "expired" | "synthetic" | "unpublished" | "offline" | "stale";
export type DatasetStatusTone = "danger" | "warning" | "info";
export type DatasetStatus = { id: DatasetStatusId; tone: DatasetStatusTone; chip: string; title: string; text: string };

export type DatasetStatusInput = {
  entry: DatasetEntry;
  cachedAt: string;
  cached?: { reason: "offline" | "invalid"; error: ArtifactError };
  online: boolean;
  now?: Date;
};

/** `expiresAt` is a UTC instant; the date shown is the Vietnam calendar day. */
export function expiryDate(expiresAt: string): string {
  const vn = new Date(Date.parse(expiresAt) + 7 * 3_600_000).toISOString().slice(0, 10);
  return formatDate(vn);
}

/** Statuses in display order (most serious first). Computed from data already in memory — no network call. */
export function datasetStatuses(input: DatasetStatusInput): DatasetStatus[] {
  const { entry, cachedAt, cached } = input;
  const freshness = datasetFreshness(entry, cachedAt, input.now ?? new Date());
  const age = `${ageText(freshness)}.`;
  const statuses: DatasetStatus[] = [];
  if (freshness.expired && freshness.expiresAt) {
    statuses.push({
      id: "expired",
      tone: "danger",
      chip: "Hết hiệu lực",
      title: "Dữ liệu đã hết hiệu lực",
      text: `Bộ dữ liệu ${entry.datasetVersion} đã hết hiệu lực từ ${expiryDate(freshness.expiresAt)}. Lịch có thể đã thay đổi — hãy đối chiếu với cổng đăng ký của trường.`,
    });
  }
  if (cached?.reason === "invalid") {
    statuses.push({
      id: "stale",
      tone: "danger",
      chip: "Dữ liệu cũ",
      title: "Không cập nhật được dữ liệu",
      text: `${ERROR_TEXT[cached.error.code]} Ứng dụng tiếp tục dùng bản đã lưu lúc ${formatInstant(cachedAt)}. ${age}`,
    });
  }
  if (isSynthetic(entry)) statuses.push({ id: "synthetic", tone: "warning", chip: "Dữ liệu mẫu", title: "Dữ liệu mẫu", text: SYNTHETIC_NOTE });
  // ADR-0010 §2 rule 4: every unpublished dataset says so, synthetic ones included (REV-M3-009d).
  if (entry.status !== "published") {
    statuses.push({
      id: "unpublished",
      tone: "warning",
      chip: "Bản thử",
      title: "Dữ liệu chưa được công bố",
      text: `Bộ dữ liệu này đang ở trạng thái “${statusLabel(entry.status)}”, chỉ dùng để thử nghiệm.`,
    });
  }
  if (!input.online || cached?.reason === "offline") {
    statuses.push({
      id: "offline",
      tone: "info",
      chip: "Ngoại tuyến",
      title: "Đang ngoại tuyến",
      text: `Bạn vẫn xem và xuất được phương án. ${age} Bản đang dùng được lưu trên máy lúc ${formatInstant(cachedAt)}.`,
    });
  }
  return statuses;
}

/** "Học kỳ II 2026–2027 (dữ liệu mẫu)" → "HK II 2026–2027" for the app-bar chip; the sheet shows the full name. */
export function shortTermLabel(termName: string): string {
  return termName.replace(/\s*\([^)]*\)\s*$/, "").replace(/^Học kỳ\s+/i, "HK ").trim() || termName;
}
