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

test("out-of-term or inverted week numbers fail closed instead of defaulting", () => {
  for (const note of ["Học tuần 11-20", "Học tuần 15-11", "Học từ tuần 16", "Học tuần 3, 18"]) {
    const r = parseNote(note, 15);
    assert.equal(r.weeks, undefined, note);
    assert.ok(r.issues.some((i) => i.code === "INVALID_DAY_OR_PERIOD" && i.severity === "error"), note);
  }
});

test("weekOrigin separates explicit weeks from parser defaults", () => {
  assert.equal(parseNote(undefined, 15).weekOrigin, "parser-default");
  assert.equal(parseNote("Nhóm 1", 15).weekOrigin, "parser-default");
  assert.equal(parseNote("Học tuần 11-15", 15).weekOrigin, "explicit");
});

test("period-only note keeps default weeks without UNPARSED_NOTE", () => {
  const r = parseNote("Học tiết 9-12", 15);
  assert.deepEqual(r.periodOverride, { startPeriod: 9, endPeriod: 12 });
  assert.equal(r.weekOrigin, "parser-default");
  assert.equal(r.issues.some((i) => i.code === "UNPARSED_NOTE"), false);
  assert.ok(r.issues.some((i) => i.code === "DEFAULT_WEEKS_APPLIED"));
});

test("unrecognized note → UNPARSED_NOTE warning + default weeks", () => {
  const r = parseNote("Nhóm 1", 15);
  assert.deepEqual(r.weeks, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.ok(r.issues.some((i) => i.code === "UNPARSED_NOTE"));
});
