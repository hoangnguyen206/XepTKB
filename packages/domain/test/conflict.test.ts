import { test } from "node:test";
import assert from "node:assert/strict";
import { findConflicts, type ResolvedPlanPick, type Section, type Session } from "../src/index.js";

const source = { artifactId: "m2-conflict", sourceType: "timetable" as const };
function session(id: string, patch: Partial<Session> = {}): Session {
  return { id, day: 3, startPeriod: 4, endPeriod: 6, frame: "uet-default", weeks: [1, 2, 3, 8, 9, 10], kind: "LT", lecturers: [], source, confidence: "deterministic", ...patch } as Session;
}
function entry(sectionId: string, sessions: Session[]): ResolvedPlanPick {
  const section: Section = { id: sectionId, courseCode: sectionId.split(" ")[0]!, homeClasses: [], online: false, sessions, source, datasetVersion: "m2", warnings: [] };
  return { pick: { sectionId }, section, sessions };
}

test("AC-01 detects period and week intersection", () => {
  const report = findConflicts([entry("INT1001 1", [session("a")]), entry("MAT1001 1", [session("b", { startPeriod: 5, endPeriod: 7, weeks: [8, 9, 10] })])]);
  assert.equal(report.conflicts.length, 1);
  assert.deepEqual(report.conflicts[0]!.periodIntersection, { startPeriod: 5, endPeriod: 6 });
  assert.deepEqual(report.conflicts[0]!.weekIntersection, [8, 9, 10]);
  assert.equal(report.conflicts[0]!.reasonCode, "TIME_AND_WEEK_OVERLAP");
});

test("disjoint weeks, adjacent periods and different days do not conflict", () => {
  assert.equal(findConflicts([entry("A 1", [session("a")]), entry("B 1", [session("b", { weeks: [11], startPeriod: 4, endPeriod: 6 })])]).conflicts.length, 0);
  assert.equal(findConflicts([entry("A 1", [session("a")]), entry("B 1", [session("b", { startPeriod: 7, endPeriod: 9 })])]).conflicts.length, 0);
  assert.equal(findConflicts([entry("A 1", [session("a")]), entry("B 1", [session("b", { day: 4 })])]).conflicts.length, 0);
});

test("online/non-fixed sessions do not create hard conflicts", () => {
  const online: Session = { id: "online", fixedTime: false, frame: "uet-default", weeks: [1], kind: "ONL", lecturers: [], source, confidence: "deterministic" };
  const report = findConflicts([entry("A 1", [online]), entry("B 1", [session("fixed", { weeks: [1] })])]);
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.issues.length, 0);
});

test("adjacent campuses produce warning, not hard conflict", () => {
  const report = findConflicts([entry("A 1", [session("a", { startPeriod: 1, endPeriod: 3, weeks: [1], campus: "A" })]), entry("B 1", [session("b", { startPeriod: 4, endPeriod: 6, weeks: [1], campus: "B" })])]);
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.warnings[0]!.reasonCode, "CAMPUS_TRANSITION");
});
