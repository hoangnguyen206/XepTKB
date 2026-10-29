import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlan, findConflicts, resolvePlanPicks, type Course, type DomainCatalog, type Section, type Session, type TimeFrame } from "@ky-nay/domain";
import {
  allOccurrences,
  buildGridLayout,
  buildIcs,
  buildWordDoc,
  conflictKeys,
  describeConflict,
  escapeText,
  foldLine,
  formatWeeks,
  occurrencesForWeek,
  scheduledSessions,
  toUtcStamp,
  weekOfDate,
  weekRange,
} from "../src/index.js";

const frame: TimeFrame = {
  id: "uet-default",
  school: "uet",
  periods: [
    ["07:00", "07:50"], ["07:55", "08:45"], ["08:50", "09:40"], ["09:50", "10:40"], ["10:45", "11:35"], ["11:40", "12:30"],
    ["13:30", "14:20"], ["14:25", "15:15"], ["15:20", "16:10"], ["16:20", "17:10"], ["17:15", "18:05"], ["18:10", "19:00"],
  ].map(([start, end], index) => ({ no: index + 1, start: start!, end: end! })),
  shifts: [],
  timezone: "Asia/Ho_Chi_Minh",
};
const source = { artifactId: "export-test", sourceType: "timetable" as const };
const fixed = (id: string, patch: Partial<Session>): Session => ({ id, day: 3, startPeriod: 4, endPeriod: 6, frame: "uet-default", weeks: [1, 2, 3], kind: "LT", group: "CL", lecturers: ["GV A"], source, confidence: "deterministic", ...patch } as Session);
const section = (id: string, courseCode: string, sessions: Session[]): Section => ({ id, courseCode, homeClasses: [], online: false, sessions, source, datasetVersion: "v1", warnings: [] });
const courses: Course[] = [
  { code: "SYN1001", altCodes: [], name: "Giải tích", normalizedName: "giai tich", credits: 3, school: "uet" },
  { code: "SYN1002", altCodes: [], name: "Đại số", normalizedName: "dai so", credits: 2, school: "uet" },
  { code: "SYN3001", altCodes: [], name: "Học phần trực tuyến", normalizedName: "hoc phan truc tuyen", credits: 2, school: "uet" },
];
const catalog: DomainCatalog = {
  courses,
  sections: [
    section("SYN1001 1", "SYN1001", [fixed("a", { weeks: [1, 3, 5], room: "301-G2" })]),
    section("SYN1002 1", "SYN1002", [fixed("b", { startPeriod: 5, endPeriod: 7, weeks: [3, 4] })]),
    section("SYN3001 1", "SYN3001", [{ id: "o", fixedTime: false, frame: "uet-default", weeks: [1, 2], kind: "ONL", lecturers: [], source, confidence: "deterministic" }]),
  ],
  datasetVersion: "v1",
};
const plan = createPlan({ id: "p", term: "t", datasetVersion: "v1", name: "Phương án nháp", planKind: "draft", picks: catalog.sections.map((item) => ({ sectionId: item.id })) }, "2026-10-25T00:00:00.000Z");
const resolution = resolvePlanPicks(plan, catalog);
const sessions = scheduledSessions(resolution.picks, courses);

test("formatWeeks compacts runs and keeps short gaps explicit", () => {
  assert.equal(formatWeeks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), "1–15");
  assert.equal(formatWeeks([1, 3, 5]), "1, 3, 5");
  assert.equal(formatWeeks([6, 7]), "6, 7");
  assert.equal(formatWeeks([1, 2, 3, 5, 9, 10, 11]), "1–3, 5, 9–11");
});

test("scheduled sessions keep names, order fixed sessions first and mark non-fixed", () => {
  assert.deepEqual(sessions.map((item) => item.sectionId), ["SYN1001 1", "SYN1002 1", "SYN3001 1"]);
  assert.equal(sessions[0]!.courseName, "Giải tích");
  assert.equal(sessions[2]!.fixed, false);
});

test("AC-06 dates follow week1 + (week-1)*7 + (day-2) and week helpers agree", () => {
  const week3 = occurrencesForWeek(sessions, 3, "2027-02-15", frame);
  assert.deepEqual(week3.map((item) => `${item.sectionId}@${item.date} ${item.startTime}-${item.endTime}`), [
    "SYN1001 1@2027-03-02 09:50-12:30",
    "SYN1002 1@2027-03-02 10:45-14:20",
  ]);
  assert.deepEqual(weekRange("2027-02-15", 3), { start: "2027-03-01", end: "2027-03-07" });
  assert.equal(weekOfDate("2027-02-15", "2027-03-07"), 3);
  assert.equal(weekOfDate("2027-02-15", "2027-02-14"), 0);
});

test("AC-07 ICS creates one event per teaching week, in UTC, without non-fixed sessions", () => {
  const occurrences = allOccurrences(sessions, "2027-02-15", frame, 15);
  const ics = buildIcs({ calendarName: "Phương án nháp – HK II", datasetVersion: "v1", sourceLine: "Dataset v1", disclaimer: "Đối chiếu với cổng trường.", generatedAt: "2026-10-25T01:02:03.000Z", occurrences });
  const events = ics.split("BEGIN:VEVENT").length - 1;
  assert.equal(events, 5); // SYN1001: weeks 1,3,5; SYN1002: weeks 3,4; ONL: none
  assert.ok(ics.includes("DTSTART:20270216T025000Z")); // Tuesday of week 1, 09:50 ICT
  assert.ok(ics.includes("DTSTAMP:20261025T010203Z"));
  assert.equal(ics.includes("SYN3001"), false);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(/[^\r]\n/.test(ics), false, "every line ends with CRLF");
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
  const uids = ics.split("\r\n").filter((line) => line.startsWith("UID:"));
  assert.equal(new Set(uids).size, uids.length);
});

test("ICS escaping, folding and UTC conversion", () => {
  assert.equal(escapeText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  assert.equal(toUtcStamp("2027-02-15", "07:00"), "20270215T000000Z");
  assert.equal(toUtcStamp("2027-01-01", "03:00"), "20261231T200000Z");
  const folded = foldLine(`DESCRIPTION:${"ạ".repeat(60)}`);
  for (const line of folded.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), `DESCRIPTION:${"ạ".repeat(60)}`);
});

test("grid layout places overlapping blocks in lanes and marks conflicts per week", () => {
  const conflicts = findConflicts(resolution.picks).conflicts;
  assert.equal(conflicts.length, 1);
  const week3 = buildGridLayout(sessions, { week: 3, maxPeriod: 12, conflictKeys: conflictKeys(conflicts, 3) });
  assert.deepEqual(week3.days, [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(week3.blocks.map((block) => [block.session.sectionId, block.lane, block.lanes, block.conflict]), [
    ["SYN1001 1", 0, 2, true],
    ["SYN1002 1", 1, 2, true],
  ]);
  const week4 = buildGridLayout(sessions, { week: 4, maxPeriod: 12, conflictKeys: conflictKeys(conflicts, 4) });
  assert.deepEqual(week4.blocks.map((block) => [block.session.sectionId, block.lanes, block.conflict]), [["SYN1002 1", 1, false]]);
  assert.equal(describeConflict(conflicts[0]!, "SYN1002 1", (id) => id === "SYN1001 1" ? { courseName: "Giải tích" } : undefined), "Trùng lịch với SYN1001 1 (Giải tích): Thứ 3, tiết 5–6, tuần 3");
});

test("the timetable note reaches the schedule as information (Q-012)", () => {
  const noted = scheduledSessions([{ pick: { sectionId: "X 1" }, section: section("X 1", "SYN1001", []), sessions: [fixed("s", { rawNote: "Học 1 ca/15 tuần, thi đợt 2" }), fixed("t", {})] }], courses);
  assert.deepEqual(noted.map((session) => session.note), ["Học 1 ca/15 tuần, thi đợt 2", undefined]);
});

test("Sunday sessions add a CN column", () => {
  const sunday = scheduledSessions([{ pick: { sectionId: "X 1" }, section: section("X 1", "SYN1001", []), sessions: [fixed("s", { day: 8 })] }], courses);
  assert.deepEqual(buildGridLayout(sunday, { maxPeriod: 12 }).days, [2, 3, 4, 5, 6, 7, 8]);
});

test("Word export escapes every value and lists non-fixed sessions separately", () => {
  const hostile = scheduledSessions([{ pick: { sectionId: "X 1" }, section: section("X 1", "SYN9", []), sessions: [fixed("s", { room: "<img src=x onerror=alert(1)>" })] }], [{ ...courses[0]!, code: "SYN9", name: "<script>alert(1)</script>" }]);
  const doc = buildWordDoc({ title: "Phương án <b>", meta: [["Dataset", "v1 & co"]], sessions: [...hostile, ...sessions.filter((item) => !item.fixed)], frame, notes: ["Tổng: 3 tín chỉ"], disclaimer: "Đối chiếu với cổng trường." });
  assert.equal(doc.includes("<script>"), false);
  assert.equal(doc.includes("<img"), false);
  assert.ok(doc.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(doc.includes("v1 &amp; co"));
  assert.ok(doc.includes("Không có giờ cố định"));
  assert.ok(doc.includes("mso-page-orientation: landscape"));
});
