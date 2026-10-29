import { describe, expect, it } from "vitest";
import { createPlan, type DayNo, type Plan, type Section, type Session } from "@ky-nay/domain";
import type { LoadedDataset } from "../data/contract.js";
import { serveDataset, testMetadata, testTimetable, VERSION } from "../test/fixture.js";
import { buildAppCatalog, searchCourses } from "./catalog.js";
import { applyPick, groupOptions, previewPick, unpick } from "./picker.js";
import { buildPlanView, missingPicks, rebasePlan, rebasePreview } from "./plan-view.js";
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

describe("dataset revision that changes a picked section's groups (REV-M3-001 / QA-M3-001)", () => {
  const REVISED = "test-uet-h2.2";
  function revisedCatalog(mutate: (section: Section) => Section) {
    const timetable = testTimetable(REVISED);
    return buildAppCatalog({ ...dataset(REVISED), timetable: { ...timetable, sections: timetable.sections.map(mutate) } });
  }
  const regroup = (sectionId: string, sessions: (section: Section) => Session[]) => (section: Section): Section => (section.id === sectionId ? { ...section, sessions: sessions(section) } : section);
  const renamed = revisedCatalog(regroup("SYN1001 1", (section) => section.sessions.map((session) => (session.group === "2" ? { ...session, group: "3" } : session))));
  const stalePlan = empty({ picks: [{ sectionId: "SYN1001 1", group: "2" }, { sectionId: "SYN1003 1" }] });

  it("keeps the common-session conflict and flags the pick when its group was renamed", () => {
    expect(buildPlanView(stalePlan, catalog).conflicts).toHaveLength(1);
    const view = buildPlanView(stalePlan, renamed);
    expect(view.conflicts).toHaveLength(1);
    expect(view.unresolved).toEqual([{ sectionId: "SYN1001 1", codes: ["GROUP_NOT_FOUND"] }]);
    expect(view.sessions.some((session) => session.sectionId === "SYN1001 1")).toBe(true);
  });

  it("lists the group change before a rebase and asks for a new group after it", () => {
    expect(rebasePreview(stalePlan, renamed)).toEqual({ removed: [], groupCleared: ["SYN1001 1"], needsGroup: ["SYN1001 1"] });
    const rebased = rebasePlan(stalePlan, renamed, NOW);
    expect(rebased.picks).toEqual([{ sectionId: "SYN1001 1" }, { sectionId: "SYN1003 1" }]);
    const view = buildPlanView(rebased, renamed);
    expect(view.stale).toBe(false);
    expect(view.unresolved).toEqual([{ sectionId: "SYN1001 1", codes: ["GROUP_REQUIRED"] }]);
    expect(view.conflicts).toHaveLength(1);
    expect(applyPick(rebased, renamed, { sectionId: "SYN1001 1", group: "3" }, NOW).plan?.picks).toContainEqual({ sectionId: "SYN1001 1", group: "3" });
  });

  it("flags a pick whose section gained a second numbered group", () => {
    const lab = (id: string, day: DayNo, group: string): Session => ({ id, day, startPeriod: 7, endPeriod: 9, frame: "uet-default", weeks: [2, 3], weekOrigin: "explicit", kind: "TH", group, lecturers: [], source: { artifactId: "uet-xlsx:test", sourceType: "timetable" }, confidence: "deterministic" });
    const added = revisedCatalog(regroup("SYN1001 2", (section) => [...section.sessions, lab("n1", 4, "1"), lab("n2", 6, "2")]));
    const plan = empty({ picks: [{ sectionId: "SYN1001 2" }] });
    const view = buildPlanView(plan, added);
    expect(view.unresolved).toEqual([{ sectionId: "SYN1001 2", codes: ["GROUP_REQUIRED"] }]);
    expect(view.sessions.map((session) => session.sessionId)).toEqual(["s2"]);
    expect(rebasePreview(plan, added)).toEqual({ removed: [], groupCleared: [], needsGroup: ["SYN1001 2"] });
  });

  it("does not block an unrelated pick while another pick is unresolved (REV-M3-003 / QA-M3-002)", () => {
    const gone = empty({ datasetVersion: "old-version", picks: [{ sectionId: "GONE 1" }] });
    const added = applyPick(gone, catalog, { sectionId: "SYN4001 1" }, NOW);
    expect(added.plan?.picks).toEqual([{ sectionId: "GONE 1" }, { sectionId: "SYN4001 1" }]);
    const rejected = applyPick(gone, catalog, { sectionId: "SYN1001 1" }, NOW);
    expect(rejected.issues.map((issue) => issue.code)).toEqual(["GROUP_REQUIRED"]);
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
