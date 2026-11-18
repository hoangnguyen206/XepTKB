/**
 * Pure helpers for the M6 week grid (DESIGN-M6-001 §7, AC-M6-05/06): how many periods to show, the accessible name of
 * a block, conflict partners and the position of the current-time line. No React, no DOM.
 */
import type { HardConflict, TimeFrame } from "@ky-nay/domain";
import { dayLabel, formatPeriods, formatWeeks, kindText, periodTimes, sessionKey, type ScheduledSession } from "@ky-nay/export";

/** Periods 1…max(10, last period of any fixed session in any week), never beyond the dataset's last period. Stable across weeks. */
export function visiblePeriods(sessions: readonly ScheduledSession[], maxPeriod: number): number {
  const last = sessions.reduce((max, session) => (session.fixed && session.endPeriod !== undefined ? Math.max(max, session.endPeriod) : max), 0);
  return Math.min(maxPeriod, Math.max(10, last));
}

/** For each conflicting session key, the course codes it conflicts with (in that week, or any week when `week` is undefined). */
export function conflictPartners(conflicts: readonly HardConflict[], sessions: readonly ScheduledSession[], week?: number): Map<string, string[]> {
  const codeOf = new Map(sessions.map((session) => [session.sectionId, session.courseCode]));
  const partners = new Map<string, Set<string>>();
  const add = (key: string, code: string | undefined) => {
    if (!code) return;
    const set = partners.get(key) ?? new Set<string>();
    set.add(code);
    partners.set(key, set);
  };
  for (const conflict of conflicts) {
    if (week !== undefined && !conflict.weekIntersection.includes(week)) continue;
    add(sessionKey(conflict.left.sectionId, conflict.left.sessionId), codeOf.get(conflict.right.sectionId));
    add(sessionKey(conflict.right.sectionId, conflict.right.sessionId), codeOf.get(conflict.left.sectionId));
  }
  return new Map([...partners].map(([key, set]) => [key, [...set].sort()]));
}

/**
 * "{mã} {tên môn}, {thứ}, tiết a–b (giờ), phòng R, lớp X nhóm N, {đổi từ ĐKMH}, đang trùng lịch với {mã}".
 * Starts with the course code, which is the block's visible text (WCAG 2.5.3 label in name).
 */
export function sessionAccessibleName(session: ScheduledSession, frame: TimeFrame, partners: readonly string[] = []): string {
  const hasPeriods = session.startPeriod !== undefined && session.endPeriod !== undefined;
  const times = hasPeriods ? periodTimes(frame, session.startPeriod!, session.endPeriod!) : undefined;
  return [
    `${session.courseCode} ${session.courseName}`,
    session.day !== undefined ? dayLabel(session.day) : "",
    hasPeriods ? `${formatPeriods(session.startPeriod!, session.endPeriod!)}${times ? ` (${times.start}–${times.end})` : ""}` : "",
    session.room ? `phòng ${session.room}` : "",
    `lớp ${session.sectionId}${session.group && session.group !== "CL" ? ` nhóm ${session.group}` : ""}`,
    kindText(session.kind),
    `tuần ${formatWeeks(session.weeks)}`,
    (session.overrides ?? []).map((item) => item.detail).join("; "),
    partners.length > 0 ? `đang trùng lịch với ${partners.join(", ")}` : "",
  ].filter(Boolean).join(", ");
}

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
};

/**
 * Vertical position of "now" as a fraction (0…1) of a grid showing periods 1…`periods`, interpolated between the start
 * times of consecutive periods (the last one runs to its end time). `undefined` outside teaching hours.
 */
export function nowLineOffset(frame: TimeFrame, minutes: number, periods: number): number | undefined {
  const shown = frame.periods.filter((period) => period.no >= 1 && period.no <= periods).sort((a, b) => a.no - b.no);
  if (shown.length === 0) return undefined;
  for (let index = 0; index < shown.length; index += 1) {
    const period = shown[index]!;
    const start = toMinutes(period.start);
    const next = index + 1 < shown.length ? toMinutes(shown[index + 1]!.start) : toMinutes(period.end);
    if (minutes >= start && minutes < next) return (period.no - 1 + (minutes - start) / (next - start)) / periods;
  }
  return undefined;
}
