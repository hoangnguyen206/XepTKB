import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { runFixtures } from "../src/runner.js";
import { canonicalJsonlAdapter } from "../src/jsonl-adapter.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/packages/parser/test → repo root is 4 levels up
const repoRoot = resolve(here, "..", "..", "..", "..");

test("smoke fixture passes", () => {
  const r = runFixtures(resolve(repoRoot, "fixtures/smoke"));
  assert.equal(r.ok, true);
  assert.equal(r.outcomes[0]!.id, "smoke-minimal");
});

test("adversarial fixture expects errors and matches", () => {
  const r = runFixtures(resolve(repoRoot, "fixtures/synthetic-adversarial"));
  assert.equal(r.ok, true); // expected errors are part of the contract
  const codes = r.outcomes[0]!.issues.map((i) => i.code);
  assert.ok(codes.includes("INVALID_SECTION_ID"));
  assert.ok(codes.includes("INVALID_DAY_OR_PERIOD"));
});

test("missing manifest throws", () => {
  assert.throws(() => runFixtures(resolve(repoRoot, "fixtures")));
});

test("malformed canonical shapes return issues and artifact error codes", () => {
  const bytes = new TextEncoder().encode('{"sections":[null]}');
  const result = canonicalJsonlAdapter.parse({ bytes, fileName: "malformed.json" });
  assert.ok(result.issues.some((i) => i.code === "NO_VALID_SECTION_ROWS"));
  assert.ok(result.artifact.errors.includes("NO_VALID_SECTION_ROWS"));
});

test("invalid UTF-8 is rejected without throwing", () => {
  const result = canonicalJsonlAdapter.parse({ bytes: new Uint8Array([0x7b, 0xff, 0x7d]), fileName: "invalid.json" });
  assert.ok(result.issues.some((i) => i.message.includes("UTF-8")));
  assert.ok(result.artifact.errors.includes("NO_VALID_SECTION_ROWS"));
});

test("canonical JSONL retains courses when credits are missing", () => {
  const source = { artifactId: "jsonl-test", sourceType: "timetable" };
  const payload = JSON.stringify({
    courses: [{ code: "OPT101", altCodes: [], name: "Optional credits", normalizedName: "optional credits", school: "uet" }],
    sections: [{
      id: "OPT101 1",
      courseCode: "OPT101",
      homeClasses: [],
      online: false,
      sessions: [{ id: "OPT101 1:s1", day: 2, startPeriod: 1, endPeriod: 2, frame: "uet-default", weeks: [1], kind: "LT", lecturers: [], source, confidence: "deterministic" }],
      source,
      datasetVersion: "test",
      warnings: [],
    }],
  });
  const result = canonicalJsonlAdapter.parse({ bytes: new TextEncoder().encode(payload), fileName: "optional-credits.json" });
  assert.equal(result.courses.length, 1);
  assert.equal(result.courses[0]!.credits, undefined);
  assert.ok(result.issues.some((i) => i.code === "CREDITS_MISSING"));
});
test("canonical JSONL rejects malformed course shape while retaining optional credits", () => {
  const source = { artifactId: "jsonl-test", sourceType: "timetable" };
  const payload = JSON.stringify({
    courses: [{ code: "OPT101" }],
    sections: [{
      id: "OPT101 1",
      courseCode: "OPT101",
      homeClasses: [],
      online: false,
      sessions: [{ id: "OPT101 1:s1", day: 2, startPeriod: 1, endPeriod: 2, frame: "uet-default", weeks: [1], kind: "LT", lecturers: [], source, confidence: "deterministic" }],
      source,
      datasetVersion: "test",
      warnings: [],
    }],
  });
  const result = canonicalJsonlAdapter.parse({ bytes: new TextEncoder().encode(payload), fileName: "malformed-course.json" });
  assert.equal(result.courses.length, 0);
  assert.ok(result.issues.some((i) => i.code === "CONFLICTING_NORMALIZED_FIELDS"));
});
test("fixture input paths cannot escape their manifest directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "ky-nay-fixture-"));
  try {
    writeFileSync(join(directory, "manifest.json"), JSON.stringify({
      manifestVersion: "1",
      schemaVersion: "0.2.0",
      context: { term: "synthetic", teachingWeeks: 15 },
      fixtures: [{
        id: "escape",
        family: "synthetic-adversarial",
        adapter: "canonical-jsonl",
        input: "../outside.json",
        dataClass: "synthetic",
        expected: { inputSha256: "0".repeat(64) },
      }],
    }));
    const result = runFixtures(directory);
    assert.equal(result.ok, false);
    assert.match(result.outcomes[0]!.mismatches[0]!, /escapes fixture directory/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
