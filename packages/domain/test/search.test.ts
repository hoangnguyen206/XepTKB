import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchIndex,
  searchSections,
  type Course,
  type Section,
} from "../src/index.js";

const source = { artifactId: "m2-search", sourceType: "timetable" as const };
const courses: Course[] = [
  { code: "INT2213", altCodes: ["UET.INT2213"], name: "Lập trình nâng cao", normalizedName: "lap trinh nang cao", credits: 3, school: "uet" },
  { code: "MAT1051", altCodes: [], name: "Toán học", normalizedName: "toan hoc", credits: 3, school: "uet" },
];

function section(id: string, courseCode: string): Section {
  return {
    id,
    courseCode,
    homeClasses: [],
    online: false,
    sessions: [{ id: `${id}:s`, day: 2, startPeriod: 1, endPeriod: 3, frame: "uet-default", weeks: [1], kind: "LT", group: "CL", lecturers: [], source, confidence: "deterministic" }],
    source,
    datasetVersion: "m2",
    warnings: [],
  };
}

test("search normalizes accents, case, spacing and UET aliases", () => {
  const built = buildSearchIndex(courses, [section("INT2213 1", "INT2213"), section("MAT1051 1", "MAT1051")]);
  assert.equal(built.issues.length, 0);
  assert.deepEqual(searchSections(built.index, "  LAP TRINH  ").map((hit) => hit.sectionId), ["INT2213 1"]);
  assert.deepEqual(searchSections(built.index, "UET.INT2213").map((hit) => hit.sectionId), ["INT2213 1"]);
  assert.deepEqual(searchSections(built.index, "").length, 0);
});

test("search ranks exact code ahead of name and applies limit", () => {
  const built = buildSearchIndex(courses, [section("INT2213 2", "INT2213"), section("INT2213 1", "INT2213"), section("MAT1051 1", "MAT1051")]);
  assert.deepEqual(searchSections(built.index, "INT2213", { limit: 2 }).map((hit) => hit.sectionId), ["INT2213 1", "INT2213 2"]);
  assert.equal(searchSections(built.index, "INT2213")[0]!.rank, 0);
});

test("search reports alias collision instead of choosing an owner", () => {
  const collisionCourses = [...courses, { code: "PHY1", altCodes: ["INT2213"], name: "Vật lý", normalizedName: "vat ly", credits: 3, school: "uet" }];
  const built = buildSearchIndex(collisionCourses, [section("INT2213 1", "INT2213"), section("PHY1 1", "PHY1")]);
  assert.ok(built.issues.some((issue) => issue.code === "COURSE_CODE_COLLISION"));
});

test("search rejects duplicate canonical section identities", () => {
  const built = buildSearchIndex(courses, [section("INT2213 1", "INT2213"), section("INT2213 1", "INT2213")]);
  assert.ok(built.issues.some((issue) => issue.code === "DUPLICATE_SECTION_ID"));
  assert.equal(built.index.documents.length, 1);
});
