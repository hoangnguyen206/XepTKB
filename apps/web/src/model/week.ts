/** Calendar helpers for Asia/Ho_Chi_Minh, independent of the device time zone. */
import { formatDate, weekOfDate, weekRange } from "@ky-nay/export";

const VIETNAM_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's civil date in Vietnam as `YYYY-MM-DD`. */
export function todayInVietnam(now: Date = new Date()): string {
  return VIETNAM_DATE.format(now);
}

/** Monday check for a civil date (week 1 must start on Thứ Hai). */
export function isMonday(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay() === 1;
}

/** Week shown by default: the current teaching week, or week 1 outside the term. */
export function defaultWeek(week1: string, teachingWeeks: number, today: string): number {
  const week = weekOfDate(week1, today);
  return week >= 1 && week <= teachingWeeks ? week : 1;
}

export function weekLabel(week1: string, week: number): string {
  const range = weekRange(week1, week);
  return `Tuần ${week} · ${formatDate(range.start, false)}–${formatDate(range.end, false)}`;
}
