import { test } from "node:test";
import assert from "node:assert/strict";
import { uetXlsxAdapter } from "../src/uet-xlsx-adapter.js";
import { readOoxmlWorkbook } from "../src/ooxml.js";
import { UET_TIMEFRAME } from "../src/uet-config.js";
import { isFixedSession, type FixedSession } from "@ky-nay/domain";
import { syntheticXlsx } from "./synthetic-xlsx.js";
const headers = ["Lớp", "Mã HP", "Môn", "TC", "Mã LHP", "Nhóm", "Loại buổi", "Thứ", "Ca", "Tiết", "GĐ", "GV", "Ghi chú", "Unknown", "X", "Y", "Z"];

function input(bytes: Uint8Array, fileName = "timetable.xlsx") {
  return {
    bytes,
    fileName,
    context: { term: "2026-2027-h1", teachingWeeks: 15, datasetVersion: "fixture-uet-v1" },
  };
}

test("OOXML reader extracts rows and fills merged cells", () => {
  const bytes = syntheticXlsx([{ name: "TKB", rows: [headers, ["K69I", "INT2213", "Lập trình", "3", "INT2213 1", "CL", "LT", "T7", " 2 ", "", "203-G2", "GV A", "Học tiết 9-12"], ["", "", "", "", "", "", "", "", "", "", "", "", ""]], merges: ["A2:A3", "E2:E3"] }]);
  const workbook = readOoxmlWorkbook(bytes);
  assert.equal(workbook.sheets[0]!.rows[2]![0], "K69I");
  assert.equal(workbook.sheets[0]!.rows[2]![4], "INT2213 1");
});

test("uet-xlsx handles header row 1, aliases, Saturday and note period override", () => {
  const bytes = syntheticXlsx([{ name: "TKB", rows: [headers, ["K69I", "UET.INT2213", "Lập trình", "3", "INT2213 1", "CL", "LT", "T7", " 2 ", "", "203-G2", "GV A+GV B", "Học tuần 1-5. Học tiết 9-12", "ignored"]] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  assert.equal(result.sections.length, 1);
  assert.equal(result.courses[0]!.code, "INT2213");
  assert.equal(result.sections[0]!.sessions[0]!.day, 7);
  const session = result.sections[0]!.sessions[0]!;
  assert.ok(isFixedSession(session));
  assert.deepEqual([session.startPeriod, session.endPeriod], [9, 12]);
  assert.ok(result.issues.some((item) => item.code === "PERIOD_OVERRIDE_APPLIED"));
  assert.equal(result.sections[0]!.sessions[0]!.source.sourceRow, 2);
});

test("uet-xlsx accepts configured Sunday day 8", () => {
  const bytes = syntheticXlsx([{ name: "Sunday", rows: [headers, ["K69I", "INT1001", "Mạng", "3", "INT1001 1", "CL", "LT", "CN", "", "1-3", "203-G2", "GV A", "Học tuần 1-5"]] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  assert.equal(result.sections[0]!.sessions[0]!.day, 8);
});

test("uet-xlsx handles header row 4, merged values, ten-week class and subtotal", () => {
  const secondHeaders = ["Lớp khóa", "Mã môn", "Tên học phần", "Tín chỉ", "Mã lớp học phần", "Nhóm", "LT+BT/TH", "Thu", "Ca học", "Tiết học", "Phòng học", "Giảng viên", "Tuần học", "PCGD", "Cột 15", "Cột 16", "Cột 17", "Cột 18"];
  const bytes = syntheticXlsx([{ name: "Official", rows: [["UET timetable", ""], ["planned", ""], ["", ""], secondHeaders, ["K70", "MAT1051", "Toán", "3", "MAT1051 2", "1", "LT", "T2", "1", "", "Hòa Lạc A", "GV C", "Học tuần 6-15", "PCGD-1"], ["", "MAT1051", "Toán", "3", "", "1", "LT", "T2", "1", "", "Hòa Lạc A", "GV C", "", "PCGD-1"], ["Tổng cộng", "", "", "", "", "", "", "", "", "", "", ""]], merges: ["A5:A6", "E5:E6", "M5:M6"] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  assert.equal(result.sections.length, 1);
  assert.deepEqual(result.sections[0]!.sessions[0]!.weeks, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(result.sections[0]!.homeClasses[0], "K70");
  assert.ok(result.issues.some((item) => item.code === "UNKNOWN_COLUMN"));
  assert.ok(result.issues.some((item) => item.code === "DUPLICATE_SESSION_COLLAPSED"));
});

test("uet-xlsx maps named shifts Sáng/Chiều through config", () => {
  const bytes = syntheticXlsx([{ name: "Named", rows: [headers,
    ["K69I", "INT1001", "Mạng", "3", "INT1001 1", "CL", "LT", "T2", "Sáng", "", "203-G2", "GV A", "Học tuần 1-5"],
    ["K69I", "INT1002", "Hệ điều hành", "3", "INT1002 1", "CL", "LT", "T3", "Chiều", "", "203-G2", "GV B", "Học tuần 1-5"],
  ] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  const ranges = result.sections.map((section) => section.sessions[0] as FixedSession).map((session) => [session.startPeriod, session.endPeriod]);
  assert.deepEqual(ranges, [[1, 6], [7, 12]]);
  assert.equal(result.issues.some((item) => item.severity === "error"), false);
});

test("uet-xlsx excludes ONL rows (Q-009) and still rejects other rows without time", () => {
  const bytes = syntheticXlsx([{ name: "Online", rows: [headers,
    ["K69I", "INT3999", "Học phần trực tuyến", "2", "INT3999 1", "CL", "ONL", "", "", "", "", "GV A", "Học tuần 1-15"],
    ["K69I", "INT3998", "Học phần trực tuyến 2", "2", "INT3998 1", "CL", "Online", "T4", "", "1-3", "", "GV A", "Học tuần 1-15"],
    ["K69I", "INT1001", "Mạng", "3", "INT1001 1", "CL", "LT", "", "", "", "203-G2", "GV B", "Học tuần 1-5"],
  ] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  assert.deepEqual(result.sections.map((section) => section.id), ["INT1001 1"]);
  assert.deepEqual(result.courses.map((course) => course.code), ["INT1001"]);
  assert.deepEqual(result.issues.filter((item) => item.code === "ONLINE_SECTION_EXCLUDED").map((item) => item.sourceRow), [2, 3]);
  assert.ok(result.issues.some((item) => item.code === "INVALID_DAY_OR_PERIOD" && item.sourceRow === 4));
});

test("UET time frame matches DOMAIN_MODEL §4 shift boundaries", () => {
  const byNo = new Map(UET_TIMEFRAME.periods.map((period) => [period.no, period]));
  const shifts = UET_TIMEFRAME.shifts.map((shift) => `${byNo.get(shift.periods[0]!)!.start}-${byNo.get(shift.periods.at(-1)!)!.end}`);
  assert.deepEqual(shifts, ["07:00-09:40", "09:50-12:30", "13:30-16:10", "16:20-19:00"]);
});

test("uet-xlsx rejects a missing required header", () => {
  const missingKind = headers.filter((header) => header !== "Loại buổi");
  const bytes = syntheticXlsx([{ name: "MissingKind", rows: [missingKind, ["K69I", "INT1001", "Mạng", "3", "INT1001 1"]] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  assert.ok(result.issues.some((item) => item.code === "MISSING_REQUIRED_COLUMN"));
});

test("uet-xlsx rejects invalid period ranges and reports ambiguous headers", () => {
  const ambiguousHeaders = [...headers, "Mã môn"];
  const bytes = syntheticXlsx([{ name: "Invalid", rows: [ambiguousHeaders, ["K69I", "INT1001", "Mạng", "3", "INT1001 1", "CL", "LT", "T2", "", "13-14", "203-G2", "GV A", "Học tuần 1-5"]] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  assert.ok(result.issues.some((item) => item.code === "AMBIGUOUS_HEADER"));
  assert.ok(result.issues.some((item) => item.code === "INVALID_DAY_OR_PERIOD"));
});

test("uet-xlsx fails closed for malformed input and size limit", () => {
  const malformed = uetXlsxAdapter.parse(input(new Uint8Array([0x50, 0x4b, 0x03, 0x04])));
  assert.equal(malformed.sections.length, 0);
  assert.ok(malformed.issues.some((item) => item.code === "MALFORMED_INPUT"));
  const oversized = uetXlsxAdapter.parse({ ...input(new Uint8Array(20)), maxBytes: 10 });
  assert.ok(oversized.issues.some((item) => item.code === "INPUT_TOO_LARGE"));
});
