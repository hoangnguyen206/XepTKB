import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlan, resolvePlanPicks, sessionsForPick, type DomainCatalog, type Section, type Term } from "../src/index.js";

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

test("multiple numbered groups require explicit group", () => {
  const resolved = sessionsForPick(section, { sectionId: section.id });
  assert.ok(resolved.issues.some((issue) => issue.code === "GROUP_REQUIRED"));
  assert.equal(resolved.sessions.length, 0);
});

test("Plan resolves picks without mutating input and mirrors final status", () => {
  const draft = plan();
  const resolved = resolvePlanPicks(draft, catalog);
  assert.equal(resolved.issues.length, 0);
  assert.equal(draft.final, false);
  const final = createPlan({ id: "p2", term: term.id, datasetVersion: "m2", name: "Final", planKind: "final" }, "2026-10-20T00:00:00.000Z");
  assert.equal(final.final, true);
});
