import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNote } from "../src/weeks.js";

test("empty note → default weeks + warnings", () => {
  const r = parseNote(undefined, 15);
  assert.deepEqual(r.weeks, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.ok(r.issues.some((i) => i.code === "DEFAULT_WEEKS_APPLIED"));
});

test("'Học tuần 11-15' → [11..15]", () => {
  const r = parseNote("Học tuần 11-15", 15);
  assert.deepEqual(r.weeks, [11, 12, 13, 14, 15]);
});

test("'Học từ tuần 14' → [14..teachingWeeks]", () => {
  const r = parseNote("Học từ tuần 14", 15);
  assert.deepEqual(r.weeks, [14, 15]);
});

test("explicit list is sorted and deduped", () => {
  const r = parseNote("Học tuần 4, 7, 10, 4", 15);
  assert.deepEqual(r.weeks, [4, 7, 10]);
});

test("period override is extracted", () => {
  const r = parseNote("Học tuần 1-5. Học tiết 9-12", 15);
  assert.deepEqual(r.periodOverride, { startPeriod: 9, endPeriod: 12 });
});

test("conflicting week patterns are blocking", () => {
  const r = parseNote("Học tuần 1-5. Học từ tuần 6", 15);
  assert.ok(r.issues.some((i) => i.code === "AMBIGUOUS_NOTE" && i.severity === "error"));
  assert.equal(r.weeks, undefined);
});

test("unrecognized note → UNPARSED_NOTE warning + default weeks", () => {
  const r = parseNote("Nhóm 1", 15);
  assert.deepEqual(r.weeks, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.ok(r.issues.some((i) => i.code === "UNPARSED_NOTE"));
});
