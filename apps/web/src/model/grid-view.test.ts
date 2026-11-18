/** DESIGN-M6-001 §7 / §12: grid helpers (periods shown, accessible names, conflict partners, current-time line) and swipe thresholds. */
import { describe, expect, it } from "vitest";
import type { HardConflict } from "@ky-nay/domain";
import type { ScheduledSession } from "@ky-nay/export";
import { swipeDirection } from "../components/useSwipe.js";
import { testMetadata } from "../test/fixture.js";
import { conflictPartners, nowLineOffset, sessionAccessibleName, visiblePeriods } from "./grid-view.js";
import { nowInVietnam } from "./week.js";

const frame = testMetadata().timeFrame;
const session = (patch: Partial<ScheduledSession>): ScheduledSession => ({
  key: "INT2213 1|s1",
  sectionId: "INT2213 1",
  courseCode: "INT2213",
  courseName: "Mạng máy tính",
  sessionId: "s1",
  kind: "LT",
  group: "CL",
  fixed: true,
  day: 4,
  startPeriod: 4,
  endPeriod: 6,
  weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  room: "404-A",
  lecturers: [],
  ...patch,
});

describe("visiblePeriods", () => {
  it("shows at least 10 periods, up to the last fixed period of the plan, never beyond the dataset", () => {
    expect(visiblePeriods([], 12)).toBe(10);
    expect(visiblePeriods([session({ endPeriod: 12 })], 12)).toBe(12);
    expect(visiblePeriods([session({ endPeriod: 12 })], 11)).toBe(11);
    expect(visiblePeriods([session({ fixed: false, endPeriod: 14 })], 14)).toBe(10);
    expect(visiblePeriods([], 8)).toBe(8);
  });
});

describe("sessionAccessibleName (AC-M6-05, AC-M6-16)", () => {
  it("starts with the course code and carries day, periods with times, room, class, overrides and conflict partners", () => {
    const name = sessionAccessibleName(
      session({ group: "2", overrides: [{ field: "room", badge: "Đã đổi phòng", detail: "Phòng học: 404-A → 305-G2 (theo ĐKMH)", source: "registration" } as never] }),
      frame,
      ["ELT3996"],
    );
    expect(name.startsWith("INT2213 Mạng máy tính, Thứ 4, tiết 4–6 (")).toBe(true);
    expect(name).toMatch(/phòng 404-A, lớp INT2213 1 nhóm 2/);
    expect(name).toContain("Phòng học: 404-A → 305-G2 (theo ĐKMH)");
    expect(name.endsWith("đang trùng lịch với ELT3996")).toBe(true);
    expect(sessionAccessibleName(session({}), frame)).not.toContain("trùng");
  });
});

describe("conflictPartners", () => {
  it("lists the other course of each conflicting session, filtered by week", () => {
    const sessions = [session({}), session({ key: "ELT3996 1|e1", sectionId: "ELT3996 1", courseCode: "ELT3996", sessionId: "e1" })];
    const conflicts = [{ left: { sectionId: "INT2213 1", sessionId: "s1" }, right: { sectionId: "ELT3996 1", sessionId: "e1" }, weekIntersection: [3, 4] }] as unknown as HardConflict[];
    expect(conflictPartners(conflicts, sessions).get("INT2213 1|s1")).toEqual(["ELT3996"]);
    expect(conflictPartners(conflicts, sessions).get("ELT3996 1|e1")).toEqual(["INT2213"]);
    expect(conflictPartners(conflicts, sessions, 3).size).toBe(2);
    expect(conflictPartners(conflicts, sessions, 9).size).toBe(0);
  });
});

describe("nowLineOffset (AC-M6-06)", () => {
  const start1 = frame.periods[0]!.start;
  const [h, m] = start1.split(":").map(Number);
  const first = h! * 60 + m!;
  it("is 0 at the start of period 1, interpolates within a period and is hidden outside teaching hours", () => {
    expect(nowLineOffset(frame, first, 10)).toBe(0);
    const second = frame.periods[1]!.start.split(":").map(Number);
    const secondStart = second[0]! * 60 + second[1]!;
    expect(nowLineOffset(frame, secondStart, 10)).toBeCloseTo(1 / 10);
    expect(nowLineOffset(frame, Math.round((first + secondStart) / 2), 10)!).toBeGreaterThan(0);
    expect(nowLineOffset(frame, Math.round((first + secondStart) / 2), 10)!).toBeLessThan(1 / 10);
    expect(nowLineOffset(frame, first - 1, 10)).toBeUndefined();
    expect(nowLineOffset(frame, 23 * 60, 10)).toBeUndefined();
  });

  it("nowInVietnam uses Asia/Ho_Chi_Minh whatever the device zone", () => {
    expect(nowInVietnam(new Date("2027-03-03T02:30:00.000Z"))).toEqual({ date: "2027-03-03", minutes: 9 * 60 + 30 });
    expect(nowInVietnam(new Date("2027-03-02T17:15:00.000Z"))).toEqual({ date: "2027-03-03", minutes: 15 });
  });
});

describe("swipeDirection (AC-M6-06)", () => {
  it("needs ≥ max(48 px, 15 % width), mostly horizontal, within 600 ms", () => {
    expect(swipeDirection(-60, 5, 200, 344)).toBe(1);
    expect(swipeDirection(60, 5, 200, 344)).toBe(-1);
    expect(swipeDirection(-40, 0, 200, 344)).toBe(0);
    expect(swipeDirection(-60, 0, 200, 1000)).toBe(0);
    expect(swipeDirection(-160, 0, 200, 1000)).toBe(1);
    expect(swipeDirection(-60, 50, 200, 344)).toBe(0);
    expect(swipeDirection(-60, 0, 700, 344)).toBe(0);
  });
});
