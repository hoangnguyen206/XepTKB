/** Expands a resolved Plan into displayable sessions and dated occurrences. */
import {
  buildCourseCodeAliases,
  dateFor,
  isFixedSession,
  normalizeCourseCode,
  type Course,
  type DayNo,
  type HardConflict,
  type ResolvedPlanPick,
  type SessionKind,
  type TimeFrame,
} from "@ky-nay/domain";

export type ScheduledSession = {
  /** `${sectionId}|${sessionId}` — matches the conflict keys used by the grid. */
  key: string;
  sectionId: string;
  courseCode: string;
  courseName: string;
  sessionId: string;
  kind: SessionKind;
  group?: string;
  fixed: boolean;
  day?: DayNo;
  startPeriod?: number;
  endPeriod?: number;
  weeks: readonly number[];
  room?: string;
  campus?: string;
  lecturers: readonly string[];
};

export type Occurrence = ScheduledSession & {
  fixed: true;
  day: DayNo;
  startPeriod: number;
  endPeriod: number;
  week: number;
  date: string;
  startTime: string;
  endTime: string;
};

export function sessionKey(sectionId: string, sessionId: string): string {
  return `${sectionId}|${sessionId}`;
}

export function scheduledSessions(picks: readonly ResolvedPlanPick[], courses: readonly Course[]): ScheduledSession[] {
  const { aliases } = buildCourseCodeAliases(courses);
  const names = new Map<string, string>();
  for (const course of courses) {
    const code = normalizeCourseCode(course.code);
    if (!names.has(code)) names.set(code, course.name);
  }
  const out: ScheduledSession[] = [];
  for (const entry of picks) {
    const rawCode = normalizeCourseCode(entry.section.courseCode);
    const courseCode = aliases.get(rawCode) ?? rawCode;
    for (const session of entry.sessions) {
      const base = {
        key: sessionKey(entry.section.id, session.id),
        sectionId: entry.section.id,
        courseCode,
        courseName: names.get(courseCode) ?? courseCode,
        sessionId: session.id,
        kind: session.kind,
        ...(session.group !== undefined ? { group: session.group } : {}),
        weeks: [...session.weeks],
        ...(session.room !== undefined ? { room: session.room } : {}),
        ...(session.campus !== undefined ? { campus: session.campus } : {}),
        lecturers: [...session.lecturers],
      };
      out.push(isFixedSession(session)
        ? { ...base, fixed: true, day: session.day, startPeriod: session.startPeriod, endPeriod: session.endPeriod }
        : { ...base, fixed: false });
    }
  }
  return out.sort(compareSessions);
}

export function compareSessions(a: ScheduledSession, b: ScheduledSession): number {
  return Number(b.fixed) - Number(a.fixed)
    || (a.day ?? 9) - (b.day ?? 9)
    || (a.startPeriod ?? 0) - (b.startPeriod ?? 0)
    || a.courseCode.localeCompare(b.courseCode)
    || a.sectionId.localeCompare(b.sectionId)
    || a.sessionId.localeCompare(b.sessionId);
}

export function periodTimes(frame: TimeFrame, startPeriod: number, endPeriod: number): { start: string; end: string } | undefined {
  const start = frame.periods.find((period) => period.no === startPeriod)?.start;
  const end = frame.periods.find((period) => period.no === endPeriod)?.end;
  return start && end ? { start, end } : undefined;
}

/** Fixed sessions taught in `week`, with civil dates (Asia/Ho_Chi_Minh) and clock times from the frame. */
export function occurrencesForWeek(sessions: readonly ScheduledSession[], week: number, week1: string, frame: TimeFrame): Occurrence[] {
  const out: Occurrence[] = [];
  for (const session of sessions) {
    if (!session.fixed || session.day === undefined || session.startPeriod === undefined || session.endPeriod === undefined) continue;
    if (!session.weeks.includes(week)) continue;
    const dated = dateFor(week1, week, session.day);
    const times = periodTimes(frame, session.startPeriod, session.endPeriod);
    if ("code" in dated || !times) continue;
    out.push({ ...session, fixed: true, day: session.day, startPeriod: session.startPeriod, endPeriod: session.endPeriod, week, date: dated.date, startTime: times.start, endTime: times.end });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startPeriod - b.startPeriod || a.courseCode.localeCompare(b.courseCode));
}

export function allOccurrences(sessions: readonly ScheduledSession[], week1: string, frame: TimeFrame, teachingWeeks: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (let week = 1; week <= teachingWeeks; week += 1) out.push(...occurrencesForWeek(sessions, week, week1, frame));
  return out;
}

/** Sessions that cannot be placed on the grid (ONL / no fixed time). */
export function nonFixedSessions(sessions: readonly ScheduledSession[]): ScheduledSession[] {
  return sessions.filter((session) => !session.fixed);
}

function parseIso(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

function formatIso(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  return formatIso(parseIso(iso) + days * 86_400_000);
}

/** Monday–Sunday civil dates of a teaching week. */
export function weekRange(week1: string, week: number): { start: string; end: string } {
  const start = addDays(week1, (week - 1) * 7);
  return { start, end: addDays(start, 6) };
}

/** Teaching week containing `date` (may be < 1 before term start or > teachingWeeks after it). */
export function weekOfDate(week1: string, date: string): number {
  return Math.floor((parseIso(date) - parseIso(week1)) / (7 * 86_400_000)) + 1;
}

/** Session keys involved in a hard conflict, optionally only conflicts that overlap `week`. */
export function conflictKeys(conflicts: readonly HardConflict[], week?: number): Set<string> {
  const keys = new Set<string>();
  for (const conflict of conflicts) {
    if (week !== undefined && !conflict.weekIntersection.includes(week)) continue;
    keys.add(sessionKey(conflict.left.sectionId, conflict.left.sessionId));
    keys.add(sessionKey(conflict.right.sectionId, conflict.right.sessionId));
  }
  return keys;
}
