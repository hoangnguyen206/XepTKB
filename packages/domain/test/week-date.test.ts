import { test } from "node:test";
import assert from "node:assert/strict";
import { dateFor, resolveWeek1, type Term } from "../src/index.js";

const term: Term = { id: "2026-h2", school: "uet", name: "HK II", teachingWeeks: 15, starts: [{ cohorts: ["K69", "K70"], week1: "2027-02-15" }], timezone: "Asia/Ho_Chi_Minh" };

test("resolves configured and user week1 deterministically", () => {
  assert.deepEqual(resolveWeek1(term, { cohort: "K69" }), { date: "2027-02-15", source: "term", cohort: "K69" });
  assert.deepEqual(resolveWeek1(term, { override: "2027-02-22" }), { date: "2027-02-22", source: "user" });
});

test("dateFor uses civil date arithmetic for T2..CN", () => {
  assert.deepEqual(dateFor("2027-02-15", 1, 2, 15), { date: "2027-02-15", week: 1, day: 2, timezone: "Asia/Ho_Chi_Minh" });
  assert.deepEqual(dateFor("2027-02-15", 1, 8, 15), { date: "2027-02-21", week: 1, day: 8, timezone: "Asia/Ho_Chi_Minh" });
  assert.deepEqual(dateFor("2027-02-15", 2, 2, 15), { date: "2027-02-22", week: 2, day: 2, timezone: "Asia/Ho_Chi_Minh" });
});

test("invalid date/week is rejected", () => {
  const invalidDate = dateFor("2027-02-30", 1, 2, 15);
  const invalidWeek = dateFor("2027-02-15", 16, 2, 15);
  const invalidOverride = resolveWeek1(term, { override: "2027-02-30" });
  assert.equal("code" in invalidDate ? invalidDate.code : undefined, "INVALID_WEEK1");
  assert.equal("code" in invalidWeek ? invalidWeek.code : undefined, "INVALID_WEEK");
  assert.equal("code" in invalidOverride ? invalidOverride.code : undefined, "INVALID_WEEK1");
});

test("ambiguous term starts fail closed without cohort", () => {
  const ambiguous = { ...term, starts: [{ cohorts: ["K69"], week1: "2027-02-15" }, { cohorts: ["K70"], week1: "2027-02-22" }] };
  const result = resolveWeek1(ambiguous);
  assert.equal("code" in result ? result.code : undefined, "AMBIGUOUS_WEEK1");
});
