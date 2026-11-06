/** Vietnamese display formatting shared by the web UI and every export. */
import type { DayNo, HardConflict, Override, OverrideField, SessionInfo, SessionKind } from "@ky-nay/domain";

const DAY_LONG: Record<DayNo, string> = { 2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "Chủ nhật" };
const DAY_SHORT: Record<DayNo, string> = { 2: "T2", 3: "T3", 4: "T4", 5: "T5", 6: "T6", 7: "T7", 8: "CN" };
const KIND_LABEL: Record<SessionKind, string> = { LT: "Lý thuyết", TH: "Thực hành", BT: "Bài tập", ONL: "Trực tuyến", OTHER: "Khác" };

const OVERRIDE_BADGE: Record<OverrideField, string> = {
  room: "Đã đổi phòng",
  campus: "Đã đổi cơ sở",
  day: "Đã đổi giờ",
  periods: "Đã đổi giờ",
  weeks: "Đã đổi tuần",
  lecturer: "Đã đổi giảng viên",
};

const OVERRIDE_FIELD_LABEL: Record<OverrideField, string> = {
  room: "Phòng học",
  campus: "Cơ sở",
  day: "Thứ học",
  periods: "Tiết học",
  weeks: "Tuần học",
  lecturer: "Giảng viên",
};

const OVERRIDE_SOURCE_LABEL: Record<Override["source"], string> = {
  registration: "theo ĐKMH",
  "admin-correction": "theo đính chính",
  user: "tự chỉnh",
};

export function dayLabel(day: DayNo, style: "long" | "short" = "long"): string {
  return style === "short" ? DAY_SHORT[day] : DAY_LONG[day];
}

export function kindLabel(kind: SessionKind): string {
  return KIND_LABEL[kind];
}

/**
 * The kind as students should read it: empty for `OTHER`, which only means the source has no LT/TH column
 * (HK I 2026–27) and would otherwise print "Khác" on every session. Callers drop the separator when it is empty.
 */
export function kindText(kind: SessionKind): string {
  return kind === "OTHER" ? "" : KIND_LABEL[kind];
}

/** Compact a sorted week list: [1..15] → "1–15", [1, 3, 5] → "1, 3, 5". */
export function formatWeeks(weeks: readonly number[]): string {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index]!;
    let end = start;
    while (sorted[index + 1] === end + 1) {
      end += 1;
      index += 1;
    }
    parts.push(end - start >= 2 ? `${start}–${end}` : end === start ? `${start}` : `${start}, ${end}`);
  }
  return parts.join(", ");
}

/** Note and extra source columns as one information line (Q-012, ADR-0011 §8); empty when there is neither. */
export function formatSessionExtras(note: string | undefined, info: readonly SessionInfo[] | undefined): string {
  return [...(note ? [`Ghi chú: ${note}`] : []), ...(info ?? []).map((item) => `${item.label}: ${item.value}`)].join(" · ");
}

export function formatPeriods(startPeriod: number, endPeriod: number): string {
  return startPeriod === endPeriod ? `tiết ${startPeriod}` : `tiết ${startPeriod}–${endPeriod}`;
}

/** ISO civil date `YYYY-MM-DD` → `DD/MM/YYYY` (or `DD/MM` when `withYear` is false). */
export function formatDate(iso: string, withYear = true): string {
  const [year, month, day] = iso.split("-");
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

export function overrideBadge(field: OverrideField): string {
  return OVERRIDE_BADGE[field];
}

export function formatOverrideValue(field: OverrideField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "chưa rõ";
  if (field === "day" && typeof value === "number" && value >= 2 && value <= 8) return dayLabel(value as DayNo);
  if (field === "periods" && typeof value === "object") {
    const periods = value as { startPeriod?: unknown; endPeriod?: unknown };
    if (typeof periods.startPeriod === "number" && typeof periods.endPeriod === "number") {
      return formatPeriods(periods.startPeriod, periods.endPeriod);
    }
  }
  if (field === "weeks" && Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return `tuần ${formatWeeks(value as number[])}`;
  }
  if (field === "lecturer" && Array.isArray(value)) {
    const names = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return names.length > 0 ? names.join(", ") : "chưa rõ";
  }
  return String(value);
}

export function describeOverride(override: Pick<Override, "field" | "from" | "to" | "source">): string {
  const label = OVERRIDE_FIELD_LABEL[override.field];
  const fromText = formatOverrideValue(override.field, override.from);
  const toText = formatOverrideValue(override.field, override.to);
  const sourceText = OVERRIDE_SOURCE_LABEL[override.source];
  return `${label}: ${fromText} → ${toText} (${sourceText})`;
}

export type ConflictLookup = (sectionId: string) => { courseName?: string } | undefined;

/**
 * Vietnamese explanation of a hard conflict seen from `perspectiveSectionId`.
 * The structured conflict comes from the domain engine; this only formats it.
 */
export function describeConflict(conflict: HardConflict, perspectiveSectionId?: string, lookup?: ConflictLookup): string {
  const other = perspectiveSectionId !== undefined && conflict.left.sectionId === perspectiveSectionId ? conflict.right : conflict.left;
  const self = other === conflict.left ? conflict.right : conflict.left;
  const name = lookup?.(other.sectionId)?.courseName;
  const target = name ? `${other.sectionId} (${name})` : other.sectionId;
  const prefix = perspectiveSectionId === undefined ? `${self.sectionId} trùng lịch với ${target}` : `Trùng lịch với ${target}`;
  const days = conflict.days.map((day) => dayLabel(day)).join(", ");
  return `${prefix}: ${days}, ${formatPeriods(conflict.periodIntersection.startPeriod, conflict.periodIntersection.endPeriod)}, tuần ${formatWeeks(conflict.weekIntersection)}`;
}
