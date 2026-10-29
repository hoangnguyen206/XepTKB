/** Vietnamese display formatting shared by the web UI and every export. */
import type { DayNo, HardConflict, SessionKind } from "@ky-nay/domain";

const DAY_LONG: Record<DayNo, string> = { 2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "Chủ nhật" };
const DAY_SHORT: Record<DayNo, string> = { 2: "T2", 3: "T3", 4: "T4", 5: "T5", 6: "T6", 7: "T7", 8: "CN" };
const KIND_LABEL: Record<SessionKind, string> = { LT: "Lý thuyết", TH: "Thực hành", BT: "Bài tập", ONL: "Trực tuyến", OTHER: "Khác" };

export function dayLabel(day: DayNo, style: "long" | "short" = "long"): string {
  return style === "short" ? DAY_SHORT[day] : DAY_LONG[day];
}

export function kindLabel(kind: SessionKind): string {
  return KIND_LABEL[kind];
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

export function formatPeriods(startPeriod: number, endPeriod: number): string {
  return startPeriod === endPeriod ? `tiết ${startPeriod}` : `tiết ${startPeriod}–${endPeriod}`;
}

/** ISO civil date `YYYY-MM-DD` → `DD/MM/YYYY` (or `DD/MM` when `withYear` is false). */
export function formatDate(iso: string, withYear = true): string {
  const [year, month, day] = iso.split("-");
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
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
