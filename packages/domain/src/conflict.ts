/** Week-aware timetable conflict detection and campus transition warnings. */
import { domainIssue, type DomainIssue } from "./issues.js";
import { isFixedSession, type DayNo, type Period, type Section, type Session, type WeekNo } from "./types.js";
import type { ResolvedPlanPick } from "./plan.js";

export type ConflictReasonCode = "TIME_AND_WEEK_OVERLAP";
export type CampusWarningReasonCode = "CAMPUS_TRANSITION";

type SessionRef = { sectionId: string; sessionId: string };

export type HardConflict = {
  kind: "hard";
  reasonCode: ConflictReasonCode;
  left: SessionRef;
  right: SessionRef;
  days: readonly DayNo[];
  periodIntersection: { startPeriod: Period; endPeriod: Period };
  weekIntersection: readonly WeekNo[];
};

export type CampusWarning = {
  kind: "warning";
  reasonCode: CampusWarningReasonCode;
  left: SessionRef;
  right: SessionRef;
  day: DayNo;
  weekIntersection: readonly WeekNo[];
  fromCampus: string;
  toCampus: string;
};

export type ConflictReport = {
  conflicts: readonly HardConflict[];
  warnings: readonly CampusWarning[];
  issues: readonly DomainIssue[];
};

function intersection(left: readonly number[], right: readonly number[]): number[] {
  const rightSet = new Set(right);
  return [...new Set(left.filter((value) => rightSet.has(value)))].sort((a, b) => a - b);
}

function refKey(ref: SessionRef): string {
  return `${ref.sectionId}\u0000${ref.sessionId}`;
}

function compareRefs(left: SessionRef, right: SessionRef): number {
  return refKey(left).localeCompare(refKey(right));
}

function refsFor(left: SessionRef, right: SessionRef): [SessionRef, SessionRef] {
  return compareRefs(left, right) <= 0 ? [left, right] : [right, left];
}

function fixedSessionIssue(session: Session, sectionId: string): DomainIssue | undefined {
  if (!isFixedSession(session)) return undefined;
  if (!Number.isInteger(session.day) || !Number.isInteger(session.startPeriod) || !Number.isInteger(session.endPeriod) || session.startPeriod > session.endPeriod || session.weeks.length === 0) {
    return domainIssue("INVALID_SESSION_FOR_CONFLICT", "error", `session ${session.id} cannot be evaluated safely`, { sectionId, sessionId: session.id });
  }
  return undefined;
}

export function periodsOverlap(left: Session, right: Session): boolean {
  if (!isFixedSession(left) || !isFixedSession(right) || left.day !== right.day) return false;
  return Math.max(left.startPeriod, right.startPeriod) <= Math.min(left.endPeriod, right.endPeriod);
}

export function weeksIntersect(left: Session, right: Session): readonly WeekNo[] {
  return intersection(left.weeks, right.weeks) as WeekNo[];
}

export function findSessionConflict(
  left: SessionRef & { session: Session },
  right: SessionRef & { session: Session },
): HardConflict | CampusWarning | undefined {
  if (!isFixedSession(left.session) || !isFixedSession(right.session)) return undefined;
  const leftSession = left.session;
  const rightSession = right.session;
  if (leftSession.day !== rightSession.day) return undefined;
  const weekIntersection = weeksIntersect(leftSession, rightSession);
  if (weekIntersection.length === 0) return undefined;
  const [orderedLeft, orderedRight] = refsFor(left, right);
  const periodStart = Math.max(leftSession.startPeriod, rightSession.startPeriod);
  const periodEnd = Math.min(leftSession.endPeriod, rightSession.endPeriod);
  if (periodStart <= periodEnd) {
    return {
      kind: "hard",
      reasonCode: "TIME_AND_WEEK_OVERLAP",
      left: orderedLeft,
      right: orderedRight,
      days: [leftSession.day],
      periodIntersection: { startPeriod: periodStart, endPeriod: periodEnd },
      weekIntersection,
    };
  }
  const adjacent = leftSession.endPeriod + 1 === rightSession.startPeriod || rightSession.endPeriod + 1 === leftSession.startPeriod;
  if (adjacent && leftSession.campus && rightSession.campus && leftSession.campus !== rightSession.campus) {
    const fromLeft = orderedLeft.sectionId === left.sectionId;
    return {
      kind: "warning",
      reasonCode: "CAMPUS_TRANSITION",
      left: orderedLeft,
      right: orderedRight,
      day: leftSession.day,
      weekIntersection,
      fromCampus: fromLeft ? leftSession.campus : rightSession.campus,
      toCampus: fromLeft ? rightSession.campus : leftSession.campus,
    };
  }
  return undefined;
}

export function findConflicts(entries: readonly ResolvedPlanPick[]): ConflictReport {
  const conflicts: HardConflict[] = [];
  const warnings: CampusWarning[] = [];
  const issues: DomainIssue[] = [];
  const sessions: Array<SessionRef & { session: Session }> = [];
  for (const entry of entries) {
    for (const session of entry.sessions) {
      const invalid = fixedSessionIssue(session, entry.section.id);
      if (invalid) issues.push(invalid);
      sessions.push({ sectionId: entry.section.id, sessionId: session.id, session });
    }
  }
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      if (sessions[i]!.sectionId === sessions[j]!.sectionId) continue;
      const result = findSessionConflict(sessions[i]!, sessions[j]!);
      if (!result) continue;
      if (result.kind === "hard") conflicts.push(result);
      else warnings.push(result);
    }
  }
  conflicts.sort((a, b) => refKey(a.left).localeCompare(refKey(b.left)) || refKey(a.right).localeCompare(refKey(b.right)));
  warnings.sort((a, b) => refKey(a.left).localeCompare(refKey(b.left)) || refKey(a.right).localeCompare(refKey(b.right)));
  return { conflicts, warnings, issues };
}

export function explainConflict(conflict: HardConflict): string {
  return `${conflict.left.sectionId} and ${conflict.right.sectionId} overlap on day ${conflict.days.join(",")} periods ${conflict.periodIntersection.startPeriod}-${conflict.periodIntersection.endPeriod} during weeks ${conflict.weekIntersection.join(",")}`;
}
