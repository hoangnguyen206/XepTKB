import { describe, expect, it } from "vitest";
import { createPlan, type Plan } from "@ky-nay/domain";
import type { LoadedDataset } from "../data/contract.js";
import { serveDataset, testMetadata, testTimetable, VERSION } from "../test/fixture.js";
import { buildAppCatalog, searchCourses } from "./catalog.js";
import { applyPick, groupOptions, previewPick, unpick } from "./picker.js";
import { buildPlanView, missingPicks, rebasePlan } from "./plan-view.js";
import { defaultWeek, isMonday, todayInVietnam, weekLabel } from "./week.js";

function dataset(version = VERSION, metadata = testMetadata(version)): LoadedDataset {
  return { entry: serveDataset({ version }).entry, timetable: testTimetable(version), metadata, cachedAt: "2026-10-25T00:00:00.000Z" };
}

const catalog = buildAppCatalog(dataset());
const NOW = "2026-10-25T00:00:00.000Z";
const empty = (patch: Partial<Plan> = {}): Plan => ({ ...createPlan({ id: "p", term: "2026-2027-h2", datasetVersion: VERSION, name: "Phương án nháp", planKind: "draft" }, NOW), ...patch });

describe("search and picker", () => {
  it("finds courses without diacritics and by alias code", () => {
    expect(searchCourses(catalog, "giai tich").map((result) => result.course.code)).toEqual(["SYN1001"]);
    expect(searchCourses(catalog, "UET.SYN1001")[0]!.sections.map((section) => section.id)).toEqual(["SYN1001 1", "SYN1001 2"]);
    expect(searchCourses(catalog, "")).toEqual([]);
  });

  it("requires a group only when a section has several numbered groups", () => {
    expect(groupOptions(catalog.sectionById.get("SYN1001 1")!)).toEqual(["1", "2"]);
    expect(groupOptions(catalog.sectionById.get("SYN1001 2")!)).toEqual([]);
    const rejected = applyPick(empty(), catalog, { sectionId: "SYN1001 1" }, NOW);
    expect(rejected.plan).toBeUndefined();
    expect(rejected.issues.map((issue) => issue.code)).toContain("GROUP_REQUIRED");
  });

  it("AC-M3-03 explains conflicts in Vietnamese with section, day, periods and weeks", () => {
    const plan = applyPick(empty(), catalog, { sectionId: "SYN1001 1", group: "1" }, NOW).plan!;
    const preview = previewPick(plan, catalog, { sectionId: "SYN1003 1" });
    expect(preview.conflictTexts).toEqual(["Trùng lịch với SYN1001 1 (Giải tích 1): Thứ 2, tiết 1–3, tuần 9–15"]);
    // Same day/periods but disjoint weeks: no conflict.
    const quiet = previewPick(applyPick(empty(), catalog, { sectionId: "SYN1003 2" }, NOW).plan!, catalog, { sectionId: "SYN1001 2" });
    expect(quiet.conflictTexts).toEqual([]);
  });

  it("replaces another section of the same course and keeps the draft immutable", () => {
    const first = applyPick(empty(), catalog, { sectionId: "SYN1001 2" }, NOW).plan!;
    const second = applyPick(first, catalog, { sectionId: "SYN1001 1", group: "2" }, "2026-10-25T01:00:00.000Z").plan!;
    expect(second.picks).toEqual([{ sectionId: "SYN1001 1", group: "2" }]);
    expect(first.picks).toEqual([{ sectionId: "SYN1001 2" }]);
    expect(unpick(second, "SYN1001 1", NOW).picks).toEqual([]);
  });
});

describe("plan view", () => {
  it("counts credits once per course, keeps unknown credits and includes ONL (Q-009)", () => {
    let plan = empty();
    for (const pick of [{ sectionId: "SYN1001 1", group: "1" }, { sectionId: "SYN3001 1" }, { sectionId: "SYN4001 1" }]) plan = applyPick(plan, catalog, pick, NOW).plan!;
    const view = buildPlanView(plan, catalog);
    expect(view.credits.knownTotal).toBe(6);
    expect(view.credits.unknownCourseCodes).toEqual(["SYN4001"]);
    expect(view.sessions.filter((session) => !session.fixed).map((session) => session.sectionId)).toEqual(["SYN3001 1"]);
    expect(view.creditCheck).toBeUndefined();
  });

  it("warns about credit limits only when the dataset configures them (C-02)", () => {
    const withPolicy = buildAppCatalog(dataset(VERSION, { ...testMetadata(), creditPolicy: { minCredits: 14, maxCredits: 25 } }));
    const plan = applyPick(empty(), withPolicy, { sectionId: "SYN1001 2" }, NOW).plan!;
    expect(buildPlanView(plan, withPolicy).creditCheck).toEqual({ kind: "below", limit: 14 });
  });

  it("resolves week 1 from the cohort, a manual date or reports ambiguity", () => {
    expect(buildPlanView(empty({ cohort: "K71" }), catalog).week1).toEqual({ date: "2027-02-22", source: "term" });
    expect(buildPlanView(empty({ week1: "2027-03-01" }), catalog).week1).toEqual({ date: "2027-03-01", source: "user" });
    expect(buildPlanView(empty(), catalog).week1Issue?.code).toBe("AMBIGUOUS_WEEK1");
  });

  it("AC-M3-12 detects a stale Plan and rebases after listing missing picks", () => {
    const plan = empty({ datasetVersion: "old-version", picks: [{ sectionId: "SYN1001 2" }, { sectionId: "GONE 1" }] });
    const view = buildPlanView(plan, catalog);
    expect(view.stale).toBe(true);
    expect(missingPicks(plan, catalog)).toEqual(["GONE 1"]);
    const rebased = rebasePlan(plan, catalog, NOW);
    expect(rebased.datasetVersion).toBe(VERSION);
    expect(rebased.picks).toEqual([{ sectionId: "SYN1001 2" }]);
    expect(buildPlanView(rebased, catalog).stale).toBe(false);
  });
});

describe("week helpers", () => {
  it("uses the Vietnam calendar date regardless of the device time zone", () => {
    expect(todayInVietnam(new Date("2026-10-24T17:30:00.000Z"))).toBe("2026-10-25");
    expect(todayInVietnam(new Date("2026-10-24T16:30:00.000Z"))).toBe("2026-10-24");
  });

  it("checks Mondays, picks the current week inside the term and labels weeks", () => {
    expect(isMonday("2027-02-15")).toBe(true);
    expect(isMonday("2027-02-16")).toBe(false);
    expect(defaultWeek("2027-02-15", 15, "2027-03-03")).toBe(3);
    expect(defaultWeek("2027-02-15", 15, "2026-10-25")).toBe(1);
    expect(weekLabel("2027-02-15", 3)).toBe("Tuần 3 · 01/03–07/03");
  });
});
