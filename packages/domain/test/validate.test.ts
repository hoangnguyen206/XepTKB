import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArtifact, validateSection, type Section } from "../src/index.js";

const baseSection: Section = {
  id: "INT1001 1",
  courseCode: "INT1001",
  homeClasses: ["K69"],
  online: false,
  sessions: [
    {
      id: "s1",
      day: 2,
      startPeriod: 1,
      endPeriod: 3,
      frame: "uet-default",
      weeks: [1, 2, 3],
      kind: "LT",
      lecturers: [],
      source: { artifactId: "a1", sourceType: "timetable" },
      confidence: "deterministic",
    },
  ],
  source: { artifactId: "a1", sourceType: "timetable" },
  datasetVersion: "v1",
  warnings: [],
};

test("valid section produces no issues", () => {
  assert.equal(validateSection(baseSection, 12, 15).length, 0);
});

test("day outside 2..8 is an error", () => {
  const s = structuredClone(baseSection);
  s.sessions[0]!.day = 9 as never;
  const codes = validateSection(s, 12, 15).map((i) => i.code);
  assert.ok(codes.includes("INVALID_DAY_OR_PERIOD"));
});

test("non-canonical section id is an error", () => {
  const s = structuredClone(baseSection);
  s.id = " int1001  1 ";
  assert.ok(validateSection(s, 12, 15).some((i) => i.code === "INVALID_SECTION_ID"));
});

test("unsorted or duplicate weeks are an error", () => {
  const s = structuredClone(baseSection);
  s.sessions[0]!.weeks = [3, 1, 3];
  assert.ok(validateSection(s, 12, 15).some((i) => i.code === "CONFLICTING_NORMALIZED_FIELDS"));
});

test("local registration artifact rejects retained filename or hash", () => {
  const artifact = {
    id: "local-registration",
    sourceType: "registration" as const,
    localOnly: true,
    fileName: "student.doc",
    sha256: "a".repeat(64),
    parserVersion: "test@0.1.0",
    schemaVersion: "0.2.0",
    status: "candidate" as const,
    importedAt: new Date(0).toISOString(),
    errors: [],
    warnings: [],
  };
  const issues = validateArtifact(artifact);
  assert.ok(issues.some((issue) => issue.field === "fileName"));
  assert.ok(issues.some((issue) => issue.field === "sha256"));
});

test("non-fixed online sessions are valid without day or periods", () => {
  const section = structuredClone(baseSection);
  section.online = true;
  section.sessions = [{
    id: "online",
    fixedTime: false,
    frame: "uet-default",
    weeks: [1, 2],
    kind: "ONL",
    lecturers: [],
    source: { artifactId: "a1", sourceType: "timetable" },
    confidence: "deterministic",
  }];
  assert.equal(validateSection(section, 12, 15).length, 0);
});

test("an untimed OTHER session is valid (Q-012) but an untimed LT session is not", () => {
  const section = structuredClone(baseSection);
  const untimed = { id: "project", fixedTime: false as const, frame: "uet-default", weeks: [1, 2], kind: "OTHER" as const, lecturers: [], source: { artifactId: "a1", sourceType: "timetable" as const }, confidence: "deterministic" as const };
  section.sessions = [untimed];
  assert.equal(validateSection(section, 12, 15).length, 0);
  section.sessions = [{ ...untimed, kind: "LT" }];
  assert.ok(validateSection(section, 12, 15).some((issue) => issue.code === "INVALID_DAY_OR_PERIOD" && issue.field === "fixedTime"));
});

