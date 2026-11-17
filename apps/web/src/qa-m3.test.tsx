/**
 * G3a Tester regression cases for M3 (TEST-M3-001). Synthetic data only.
 * Independent oracles for conflict (day × period × weeks) and ICS dates; complements model.test.ts.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createPlan, type Course, type Plan, type Section, type Session } from "@ky-nay/domain";
import type { LoadedDataset, TimetableArtifact } from "./data/contract.js";
import { icsFile } from "./export/exporters.js";
import { buildAppCatalog } from "./model/catalog.js";
import { applyPick, previewPick, previewTargetFor, sectionFits } from "./model/picker.js";
import { AddClassView } from "./components/AddClassView.js";
import { isSearchShortcut } from "./components/useSearchShortcut.js";
import { COURSE_PALETTE } from "./model/palette.js";
import { buildPlanView } from "./model/plan-view.js";
import { serveDataset, testMetadata, TERM, VERSION } from "./test/fixture.js";

const source = { artifactId: "qa-m3:synthetic", sourceType: "timetable" as const };
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const fixed = (id: string, day: number, start: number, end: number, weeks: number[], patch: Partial<Session> = {}): Session =>
  ({ id, day, startPeriod: start, endPeriod: end, frame: "uet-default", weeks, weekOrigin: "explicit", kind: "LT", group: "CL", lecturers: [], source, confidence: "deterministic", ...patch }) as Session;
const course = (code: string, credits: number): Course => ({ code, altCodes: [], name: `Môn ${code}`, normalizedName: `mon ${code.toLowerCase()}`, credits, school: "uet" });

const SESSIONS: Record<string, Session[]> = {
  "QAA001 1": [fixed("a-cl", 3, 4, 6, range(1, 15)), fixed("a-g1", 4, 1, 3, range(2, 15), { kind: "TH", group: "1" }), fixed("a-g2", 5, 1, 3, range(2, 15), { kind: "TH", group: "2" })],
  "QAB001 1": [fixed("b1", 3, 5, 7, [8, 9, 10])],
  "QAC001 1": [fixed("c1", 5, 2, 2, [5])],
  "QAC001 2": [fixed("c2", 4, 3, 3, [15])],
  "QAD001 1": [fixed("d1", 3, 7, 9, range(1, 15))],
  "QAD001 2": [fixed("d2", 3, 1, 3, range(1, 15))],
  "QAE001 1": [fixed("e1", 6, 1, 3, range(1, 15).filter((week) => week % 2 === 1))],
  "QAF001 1": [fixed("f1", 6, 1, 3, range(1, 15).filter((week) => week % 2 === 0))],
  "QAF001 2": [fixed("f2", 6, 3, 5, [15])],
  "QAI001 1": [{ id: "i1", fixedTime: false, day: 3, frame: "uet-default", weeks: range(1, 15), weekOrigin: "parser-default", kind: "ONL", group: "CL", lecturers: [], source, confidence: "deterministic" } as Session],
  "QAJ001 1": [fixed("j1", 8, 10, 12, [1, 15])],
};
const COURSES = ["QAA001", "QAB001", "QAC001", "QAD001", "QAE001", "QAF001", "QAI001", "QAJ001"].map((code) => course(code, 2));
const sections: Section[] = Object.entries(SESSIONS).map(([id, sessions]) => ({
  id, courseCode: id.split(" ")[0]!, homeClasses: [], online: id.startsWith("QAI"), sessions, source, datasetVersion: VERSION, warnings: [],
}));
const timetable: TimetableArtifact = { schemaVersion: "0.2.0", datasetVersion: VERSION, school: "uet", term: TERM, courses: COURSES, sections };
const dataset: LoadedDataset = { entry: serveDataset({ timetable }).entry, timetable, metadata: testMetadata(), cachedAt: "2026-10-25T00:00:00.000Z" };
const catalog = buildAppCatalog(dataset);
const NOW = "2026-10-25T00:00:00.000Z";
const empty = (patch: Partial<Plan> = {}): Plan => ({ ...createPlan({ id: "qa", term: TERM, datasetVersion: VERSION, name: "Phương án nháp", planKind: "draft" }, NOW), ...patch });
const withPicks = (picks: { sectionId: string; group?: string }[], patch: Partial<Plan> = {}) => picks.reduce((plan, pick) => {
  const next = applyPick(plan, catalog, pick, NOW).plan;
  if (!next) throw new Error(`pick rejected: ${pick.sectionId}`);
  return next;
}, empty(patch));
const texts = (plan: Plan, pick: { sectionId: string; group?: string }) => previewPick(plan, catalog, pick).conflictTexts;

describe("QA-M3 conflict matrix (QA_TEST_PLAN §5 Domain, AC-01)", () => {
  const planA1 = withPicks([{ sectionId: "QAA001 1", group: "1" }]);

  it("PRD AC-01: T3 4–6 w1–15 vs T3 5–7 w8–10 → periods 5–6, weeks 8–10", () => {
    expect(texts(planA1, { sectionId: "QAB001 1" })).toEqual(["Trùng lịch với QAA001 1 (Môn QAA001): Thứ 3, tiết 5–6, tuần 8–10"]);
  });

  it("adjacent periods before/after are not conflicts", () => {
    expect(texts(planA1, { sectionId: "QAD001 1" })).toEqual([]);
    expect(texts(planA1, { sectionId: "QAD001 2" })).toEqual([]);
  });

  it("only the chosen group's sessions conflict (CL always)", () => {
    expect(texts(planA1, { sectionId: "QAC001 1" })).toEqual([]);
    expect(texts(planA1, { sectionId: "QAC001 2" })).toEqual(["Trùng lịch với QAA001 1 (Môn QAA001): Thứ 4, tiết 3, tuần 15"]);
  });

  it("switching the group of a picked section previews and records the new conflict", () => {
    const plan = withPicks([{ sectionId: "QAA001 1", group: "1" }, { sectionId: "QAC001 1" }]);
    expect(buildPlanView(plan, catalog).conflicts).toHaveLength(0);
    expect(texts(plan, { sectionId: "QAA001 1", group: "2" })).toEqual(["Trùng lịch với QAC001 1 (Môn QAC001): Thứ 5, tiết 2, tuần 5"]);
    const switched = applyPick(plan, catalog, { sectionId: "QAA001 1", group: "2" }, NOW).plan!;
    expect(switched.picks).toEqual([{ sectionId: "QAC001 1" }, { sectionId: "QAA001 1", group: "2" }]);
    expect(buildPlanView(switched, catalog).conflicts.map((conflict) => conflict.weekIntersection)).toEqual([[5]]);
  });

  it("disjoint odd/even weeks never conflict; a same-course switch previews without the replaced section", () => {
    const plan = withPicks([{ sectionId: "QAE001 1" }, { sectionId: "QAF001 1" }]);
    expect(buildPlanView(plan, catalog).conflicts).toHaveLength(0);
    expect(texts(plan, { sectionId: "QAF001 2" })).toEqual(["Trùng lịch với QAE001 1 (Môn QAE001): Thứ 6, tiết 3, tuần 15"]);
  });

  it("an ONL session that carries a day/period never conflicts and stays off the grid (Q-009)", () => {
    expect(texts(planA1, { sectionId: "QAI001 1" })).toEqual([]);
    const view = buildPlanView(withPicks([{ sectionId: "QAA001 1", group: "1" }, { sectionId: "QAI001 1" }]), catalog);
    expect(view.sessions.filter((session) => !session.fixed).map((session) => session.sectionId)).toEqual(["QAI001 1"]);
    expect(view.credits.knownTotal).toBe(4);
  });
});

/** Oracle: UTC stamp of week1 + (week-1)*7 + (day-2) at HH:MM in UTC+7, computed independently of @ky-nay/export. */
function stamp(week1: string, week: number, day: number, hhmm: string): string {
  const [year, month, date] = week1.split("-").map(Number) as [number, number, number];
  const [hour, minute] = hhmm.split(":").map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 1, date + (week - 1) * 7 + (day - 2), hour - 7, minute)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
const START: Record<number, string> = { 1: "07:00", 2: "07:55", 3: "08:50", 4: "09:50", 5: "10:45", 7: "13:30", 10: "16:20" };
const END: Record<number, string> = { 2: "08:45", 3: "09:40", 5: "11:35", 6: "12:30", 9: "16:10", 12: "19:00" };

async function icsStarts(plan: Plan): Promise<string[]> {
  const file = icsFile(plan, buildPlanView(plan, catalog), catalog, new Date(NOW));
  const text = await file.blob.text();
  return text.replace(/\r\n /g, "").split("\r\n").filter((line) => line.startsWith("DTSTART:") || line.startsWith("DTEND:")).sort();
}

describe("QA-M3 ICS dates (AC-06, AC-M3-09)", () => {
  const picks = [{ sectionId: "QAA001 1", group: "2" }, { sectionId: "QAJ001 1" }, { sectionId: "QAI001 1" }, { sectionId: "QAC001 2" }];
  const expected = (week1: string) => {
    const out: string[] = [];
    const add = (session: Session & { day: number; startPeriod: number; endPeriod: number }) => {
      for (const week of session.weeks) out.push(`DTSTART:${stamp(week1, week, session.day, START[session.startPeriod]!)}`, `DTEND:${stamp(week1, week, session.day, END[session.endPeriod]!)}`);
    };
    for (const id of ["a-cl", "a-g2"]) add(SESSIONS["QAA001 1"]!.find((session) => session.id === id) as never);
    add(SESSIONS["QAJ001 1"]![0] as never);
    add(SESSIONS["QAC001 2"]![0] as never);
    return out.sort();
  };

  it("cohort week 1 (K71 → 2027-02-22): one event per teaching week, sparse Sunday weeks, ONL excluded", async () => {
    const actual = await icsStarts(withPicks(picks, { cohort: "K71" }));
    expect(actual).toEqual(expected("2027-02-22"));
    expect(actual.filter((line) => line.startsWith("DTSTART:"))).toHaveLength(15 + 14 + 2 + 1);
    expect(actual).toContain("DTSTART:20270606T092000Z"); // QAJ001 1: Sunday of week 15, 16:20 ICT
  });

  it("manual week 1 override (2027-03-01) shifts every event by the same civil-date offset", async () => {
    expect(await icsStarts(withPicks(picks, { cohort: "K71", week1: "2027-03-01" }))).toEqual(expected("2027-03-01"));
  });
});

describe("F4 \"Không trùng lịch\" filter (DESIGN-M6-001 §8, AC-M6-09)", () => {
  const section = (id: string) => catalog.sectionById.get(id)!;
  const fits = (plan: Plan, id: string) => sectionFits(plan, catalog, section(id));

  it("an empty plan fits every section, with or without groups", () => {
    for (const id of Object.keys(SESSIONS)) expect(fits(empty(), id), id).toBe(true);
  });

  it("hides exactly the sections that would create a hard conflict (day × period × overlapping weeks)", () => {
    const planA1 = withPicks([{ sectionId: "QAA001 1", group: "1" }]);
    expect(fits(planA1, "QAB001 1")).toBe(false);
    expect(fits(planA1, "QAC001 2")).toBe(false);
    for (const id of ["QAC001 1", "QAD001 1", "QAD001 2", "QAE001 1", "QAI001 1", "QAJ001 1"]) expect(fits(planA1, id), id).toBe(true);
  });

  it("one fitting group is enough; a conflicting CL session rules out every group", () => {
    const withC1 = withPicks([{ sectionId: "QAC001 1" }]);
    expect(fits(withC1, "QAA001 1")).toBe(true);
    expect(previewTargetFor(withC1, catalog, section("QAA001 1"))).toEqual({ sectionId: "QAA001 1", group: "1" });
    const withB = withPicks([{ sectionId: "QAB001 1" }]);
    expect(fits(withB, "QAA001 1")).toBe(false);
    expect(previewTargetFor(withB, catalog, section("QAA001 1"))).toEqual({ sectionId: "QAA001 1", group: "1" });
  });

  it("a picked section always fits; another section of the same course is judged without it", () => {
    const conflicting = withPicks([{ sectionId: "QAA001 1", group: "1" }, { sectionId: "QAB001 1" }]);
    expect(buildPlanView(conflicting, catalog).conflicts).toHaveLength(1);
    expect(fits(conflicting, "QAB001 1")).toBe(true);
    expect(previewTargetFor(conflicting, catalog, section("QAA001 1"))).toEqual({ sectionId: "QAA001 1", group: "1" });
    const oddEven = withPicks([{ sectionId: "QAE001 1" }, { sectionId: "QAF001 1" }]);
    expect(fits(oddEven, "QAF001 1")).toBe(true);
    expect(fits(oddEven, "QAF001 2")).toBe(false);
  });
});

describe("Ctrl/⌘ K (DESIGN-M6-001 §8, AC-M6-10)", () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", { key: "k", cancelable: true, ...init });

  it("runs with Ctrl or Meta + K only", () => {
    expect(isSearchShortcut(key({ ctrlKey: true }))).toBe(true);
    expect(isSearchShortcut(key({ metaKey: true, key: "K" }))).toBe(true);
    expect(isSearchShortcut(key({}))).toBe(false);
    expect(isSearchShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isSearchShortcut(key({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isSearchShortcut(key({ ctrlKey: true, key: "j" }))).toBe(false);
  });

  it("never runs while an IME composes, after another handler, or with a dialog open", () => {
    expect(isSearchShortcut(key({ ctrlKey: true, isComposing: true }))).toBe(false);
    const handled = key({ ctrlKey: true });
    handled.preventDefault();
    expect(isSearchShortcut(handled)).toBe(false);
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    try {
      expect(isSearchShortcut(key({ ctrlKey: true }))).toBe(false);
    } finally {
      dialog.remove();
    }
  });
});

describe("\"Tắt lọc\" empty state (DESIGN-M6-001 §8/§9, AC-M6-09/12; G3 F-M6-QA-03)", () => {
  it("when the filter hides every course found, one \"Tắt lọc\" action brings them back", async () => {
    const user = userEvent.setup();
    // QAB001 has one section, and it overlaps QAA001 1 (group 1) on Thứ 3, tiết 5–6, tuần 8–10.
    const plan = withPicks([{ sectionId: "QAA001 1", group: "1" }]);
    render(<AddClassView catalog={catalog} plan={plan} colorOf={() => COURSE_PALETTE[0]!} onPick={() => undefined} onUnpick={() => undefined} />);
    await user.type(screen.getByLabelText("Mã hoặc tên môn"), "QAB001");
    expect(screen.getByRole("button", { name: /^QAB001 / })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Không trùng lịch" }));
    expect(screen.queryByRole("button", { name: /^QAB001 / })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Tìm thấy 0 môn. Ẩn 1 môn trùng lịch.");
    const empty = screen.getByText("Các môn tìm thấy đều trùng lịch").closest(".empty") as HTMLElement;
    expect(empty.querySelectorAll("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Tắt lọc" }));
    expect(screen.getByRole("button", { name: "Không trùng lịch" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^QAB001 / })).toBeTruthy();
  });
});
