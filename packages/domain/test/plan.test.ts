import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlanPick, createPlan, resolvePlanPicks, sessionsForPick, validatePlan, type DomainCatalog, type Section, type Term } from "../src/index.js";

const source = { artifactId: "m2-plan", sourceType: "timetable" as const };
const term: Term = { id: "2026-h2", school: "uet", name: "HK II", teachingWeeks: 15, starts: [{ cohorts: ["K69"], week1: "2027-02-15" }], timezone: "Asia/Ho_Chi_Minh" };
const section: Section = {
  id: "INT2213 1",
  courseCode: "INT2213",
  homeClasses: [],
  online: false,
  sessions: [
    { id: "lt", day: 2, startPeriod: 1, endPeriod: 3, frame: "uet-default", weeks: [1, 2], kind: "LT", group: "CL", lecturers: [], source, confidence: "deterministic" },
    { id: "g1", day: 3, startPeriod: 4, endPeriod: 6, frame: "uet-default", weeks: [1], kind: "TH", group: "Nhóm 1", lecturers: [], source, confidence: "deterministic" },
    { id: "g2", day: 4, startPeriod: 4, endPeriod: 6, frame: "uet-default", weeks: [1], kind: "TH", group: "2", lecturers: [], source, confidence: "deterministic" },
  ],
  source,
  datasetVersion: "m2",
  warnings: [],
};
const catalog: DomainCatalog = { courses: [{ code: "INT2213", altCodes: [], name: "Lập trình", normalizedName: "lap trinh", credits: 3, school: "uet" }], sections: [section], datasetVersion: "m2" };

function plan(picks = [{ sectionId: "INT2213 1", group: "1" as const }]) {
  return createPlan({ id: "p1", term: term.id, datasetVersion: "m2", name: "A", planKind: "draft", picks }, "2026-10-20T00:00:00.000Z");
}

test("group selection includes common sessions and only requested numbered group", () => {
  const resolved = sessionsForPick(section, { sectionId: section.id, group: "1" });
  assert.deepEqual(resolved.sessions.map((session) => session.id), ["lt", "g1"]);
});

test("multiple numbered groups require explicit group; the common session still resolves (REV-M3-001)", () => {
  const resolved = sessionsForPick(section, { sectionId: section.id });
  assert.ok(resolved.issues.some((issue) => issue.code === "GROUP_REQUIRED"));
  assert.deepEqual(resolved.sessions.map((session) => session.id), ["lt"]);
});

test("a group that no longer exists keeps the common session and reports GROUP_NOT_FOUND", () => {
  const resolved = sessionsForPick(section, { sectionId: section.id, group: "3" });
  assert.deepEqual(resolved.issues.map((issue) => issue.code), ["GROUP_NOT_FOUND"]);
  assert.deepEqual(resolved.sessions.map((session) => session.id), ["lt"]);
});

test("addPlanPick rejects only on errors of the new pick (REV-M3-003)", () => {
  const other: Section = { ...section, id: "MAT1051 1", courseCode: "MAT1051", sessions: [{ ...section.sessions[0]!, id: "m1", day: 6 }] };
  const wide: DomainCatalog = { ...catalog, courses: [...catalog.courses, { ...catalog.courses[0]!, code: "MAT1051", normalizedName: "toan" }], sections: [section, other] };
  const broken = createPlan({ id: "p3", term: term.id, datasetVersion: "m2", name: "Broken", planKind: "draft", picks: [{ sectionId: "INT2213 1", group: "9" }, { sectionId: "GONE 1" }] }, "2026-10-20T00:00:00.000Z");
  const added = addPlanPick(broken, { sectionId: "MAT1051 1" }, wide);
  assert.ok(added.plan);
  assert.deepEqual(added.plan.picks.map((pick) => pick.sectionId), ["INT2213 1", "GONE 1", "MAT1051 1"]);
  assert.ok(added.issues.some((issue) => issue.code === "SECTION_NOT_FOUND"));
  const rejected = addPlanPick(broken, { sectionId: "INT2213 1" }, wide);
  assert.equal(rejected.plan, undefined);
  // Only issues of section INT2213 1 are returned; GONE 1's SECTION_NOT_FOUND is not blamed on the new pick.
  assert.deepEqual(rejected.issues.map((issue) => issue.code), ["GROUP_NOT_FOUND", "DUPLICATE_PLAN_PICK"]);
});

test("validatePlan rejects one source disagreeing with itself on the same field", () => {
  const target = { sectionId: section.id, sessionId: "lt" };
  const conflicting = { ...plan(), overrides: [
    { target, field: "room" as const, to: "101", source: "registration" as const },
    { target, field: "room" as const, to: "102", source: "registration" as const },
  ] };
  assert.ok(validatePlan(conflicting, catalog, term).some((issue) => issue.code === "CONFLICTING_OVERRIDES"));
  const layered = { ...plan(), overrides: [
    { target, field: "room" as const, to: "101", source: "registration" as const },
    { target, field: "room" as const, to: "Lab", source: "user" as const },
  ] };
  assert.equal(validatePlan(layered, catalog, term).some((issue) => issue.code === "CONFLICTING_OVERRIDES"), false);
});

test("Plan resolves picks without mutating input and mirrors final status", () => {
  const draft = plan();
  const resolved = resolvePlanPicks(draft, catalog);
  assert.equal(resolved.issues.length, 0);
  assert.equal(draft.final, false);
  const final = createPlan({ id: "p2", term: term.id, datasetVersion: "m2", name: "Final", planKind: "final" }, "2026-10-20T00:00:00.000Z");
  assert.equal(final.final, true);
});
