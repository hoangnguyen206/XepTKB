import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlanCredits, createPlan, resolvePlanPicks, summarizeCredits, type Course, type DomainCatalog, type Section } from "../src/index.js";

const source = { artifactId: "m2-credits", sourceType: "timetable" as const };
function section(id: string, courseCode: string): Section {
  return { id, courseCode, homeClasses: [], online: false, sessions: [{ id: `${id}:a`, day: 2, startPeriod: 1, endPeriod: 2, frame: "uet-default", weeks: [1], kind: "LT", lecturers: [], source, confidence: "deterministic" }], source, datasetVersion: "m2", warnings: [] };
}
const courses: Course[] = [
  { code: "A", altCodes: [], name: "A", normalizedName: "a", credits: 3, school: "uet" },
  { code: "B", altCodes: [], name: "B", normalizedName: "b", school: "uet" },
  { code: "C", altCodes: [], name: "C", normalizedName: "c", credits: 0, school: "uet" },
];
const catalog: DomainCatalog = { courses, sections: [section("A 1", "A"), section("B 1", "B"), section("C 1", "C")], datasetVersion: "m2" };

test("credits count each selected course once and preserve unknowns", () => {
  const plan = createPlan({ id: "p", term: "t", datasetVersion: "m2", name: "P", planKind: "draft", picks: [{ sectionId: "A 1" }, { sectionId: "B 1" }, { sectionId: "C 1" }] }, "2026-10-20T00:00:00.000Z");
  const summary = calculatePlanCredits(plan, catalog);
  assert.equal(summary.knownTotal, 3);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.unknownCourseCodes, ["B"]);
  assert.deepEqual(summary.countedCourseCodes, ["A", "B", "C"]);
});

test("credits do not count sessions twice", () => {
  const resolution = resolvePlanPicks(createPlan({ id: "p", term: "t", datasetVersion: "m2", name: "P", planKind: "draft", picks: [{ sectionId: "A 1" }] }, "2026-10-20T00:00:00.000Z"), catalog);
  const summary = summarizeCredits(resolution, courses);
  assert.equal(summary.knownTotal, 3);
  assert.deepEqual(summary.unknownCourseCodes, []);
});
