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

test("uet-xlsx keeps ONL rows as non-fixed sessions with credits (Q-009) and still rejects other rows without time", () => {
  const bytes = syntheticXlsx([{ name: "Online", rows: [headers,
    ["K69I", "INT3999", "Học phần trực tuyến", "2", "INT3999 1", "CL", "ONL", "", "", "", "", "GV A", "Học tuần 1-15"],
    ["K69I", "INT3998", "Học phần trực tuyến 2", "2", "INT3998 1", "CL", "Online", "T4", "", "1-3", "", "GV A", "Học tuần 1-15"],
    ["K69I", "INT1001", "Mạng", "3", "INT1001 1", "CL", "LT", "", "", "", "203-G2", "GV B", "Học tuần 1-5"],
  ] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  for (const id of ["INT3999 1", "INT3998 1"]) {
    const online = result.sections.find((section) => section.id === id)!;
    assert.equal(online.online, true, id);
    assert.equal(online.sessions.length, 1, id);
    assert.equal(isFixedSession(online.sessions[0]!), false, id);
  }
  assert.deepEqual(result.courses.filter((course) => course.code.startsWith("INT399")).map((course) => course.credits), [2, 2]);
  assert.deepEqual(result.issues.filter((item) => item.code === "NON_FIXED_TIME").map((item) => item.sourceRow), [2, 3]);
  assert.equal(result.issues.some((item) => item.severity === "error" && (item.sourceRow === 2 || item.sourceRow === 3)), false);
  assert.ok(result.issues.some((item) => item.code === "INVALID_DAY_OR_PERIOD" && item.sourceRow === 4));
});

test("UET time frame matches DOMAIN_MODEL §4 shift boundaries", () => {
  const byNo = new Map(UET_TIMEFRAME.periods.map((period) => [period.no, period]));
  const shifts = UET_TIMEFRAME.shifts.map((shift) => `${byNo.get(shift.periods[0]!)!.start}-${byNo.get(shift.periods.at(-1)!)!.end}`);
  assert.deepEqual(shifts, ["07:00-09:40", "09:50-12:30", "13:30-16:10", "16:20-19:00"]);
});

test("uet-xlsx rejects a missing required header", () => {
  const missingSection = headers.filter((header) => header !== "Mã LHP");
  const bytes = syntheticXlsx([{ name: "MissingSection", rows: [missingSection, ["K69I", "INT1001", "Mạng", "3", "CL"]] }]);
  const result = uetXlsxAdapter.parse(input(bytes));
  assert.ok(result.issues.some((item) => item.code === "MISSING_REQUIRED_COLUMN"));
  const noTime = headers.filter((header) => header !== "Ca" && header !== "Tiết");
  const timeless = uetXlsxAdapter.parse(input(syntheticXlsx([{ name: "NoTime", rows: [noTime, ["K69I", "INT1001", "Mạng", "3", "INT1001 1"]] }])));
  assert.ok(timeless.issues.some((item) => item.code === "MISSING_REQUIRED_COLUMN" && item.field === "shift"));
});

// HK I 2026–27 layout (C-10): 10 columns, header on row 6, no LT/TH/Tiết/Ghi chú/Lớp, a "Các lớp hủy" sheet with the
// same header, bare Ca ranges, "Tiết a-b" in Ca, course codes with a space or `#`, untimed projects and "Học Online".
const hk1Headers = ["STT", "Mã học phần", "Học phần", "Số TC", "Mã LHP", "Giảng Viên", "Thứ", "Ca", "Giảng đường", "Nhóm"];
const letterhead = (text: string) => Array.from({ length: 10 }, () => text);
function hk1Workbook(extraRows: string[][] = []) {
  const main = [
    letterhead("TRƯỜNG MẪU"), letterhead("THỜI KHÓA BIỂU"), letterhead("HỌC KỲ 1"), [], [],
    hk1Headers,
    ["1", "SYN3071E", "Môn mẫu", "3", "SYN3071E 1", "TS.Mẫu", "3", "3", "203-B", "CL"],
    ["2", "SYN3071E", "Môn mẫu", "3", "SYN3071E 1", "TS.Mẫu", "5", "4", "310-G2", "2"],
    ["3", "SYN 3062", "Môn có dấu cách", "3", "SYN 3062 1", "TS.Mẫu", "2", "4", "408-B", "CL"],
    ["4", "SYN3003", "Môn gốc", "3", "SYN3003 1", "TS.Mẫu", "3", "3", "105-A", "CL"],
    ["5", "SYN3003#", "Môn biến thể", "3", "SYN3003# 1", "TS.Mẫu", "5", "3", "404-B", "CL"],
    ["6", "SYN3996", "Môn ca ghép", "3", "SYN3996 1", "ThS.Mẫu", "6", " 1 - 2", "303-GĐ2", "CL"],
    ["7", "SYN1025", "Bóng đá mẫu", "1", "SYN1025 2", "TT GDTC&TT", "4", "Tiết 1-2", "Sân bãi", "CL"],
    ["8", "SYN1057", "Môn online", "2", "SYN1057 1", "", "", "", "Học Online", "CL"],
    ["9", "SYN3132", "Dự án mẫu", "3", "SYN3132 1", "TS.Mẫu", "", "", "Khoa Mẫu", "CL"],
    ["10", "SYN3102", "Môn bị hủy", "3", "SYN3102 5", "TS.Mẫu", "5", "2", "305-B", "CL"],
    ...extraRows,
    ["", "", "", "", "", "", letterhead("Hà Nội, ngày 5 tháng 9 năm 2026")[0]!, "", "", ""],
  ];
  return syntheticXlsx([
    { name: "Các lớp hủy", rows: [hk1Headers, ["1", "SYN3102", "Môn bị hủy", "3", "SYN3102 5", "TS.Mẫu", "5", "2", "305-B", "CL"]] },
    { name: "TKB 04.09", rows: main },
    { name: "Thời gian dạy và học", rows: [["Buổi", "Ca", "Tiết", "Thời gian"], ["Sáng", "1", "Tiết 1-3", "07:00 – 09:40"]] },
  ]);
}

test("uet-xlsx reads the HK I 2026–27 layout without a kind column (C-10)", () => {
  const result = uetXlsxAdapter.parse(input(hk1Workbook()));
  assert.deepEqual(result.issues.filter((item) => item.severity === "error"), []);
  assert.equal(result.artifact.status, "candidate");
  const slots = Object.fromEntries(result.sections.map((section) => [section.id, section.sessions.map((s) => (isFixedSession(s) ? `T${s.day} ${s.startPeriod}-${s.endPeriod}` : `untimed ${s.kind}`))]));
  assert.deepEqual(slots, {
    "SYN3071E 1": ["T3 7-9", "T5 10-12"],
    "SYN3062 1": ["T2 10-12"],
    "SYN3003 1": ["T3 7-9"],
    "SYN3003# 1": ["T5 7-9"],
    "SYN3996 1": ["T6 1-6"],
    "SYN1025 2": ["T4 1-2"],
    "SYN1057 1": ["untimed ONL"],
    "SYN3132 1": ["untimed OTHER"],
  });
  assert.deepEqual(result.courses.map((course) => course.code).sort(), ["SYN1025", "SYN1057", "SYN3003", "SYN3003#", "SYN3062", "SYN3071E", "SYN3132", "SYN3996"]);
  assert.equal(result.sections.find((section) => section.id === "SYN1057 1")!.online, true);
  assert.equal(result.sections.find((section) => section.id === "SYN3132 1")!.online, false);
  assert.ok(result.issues.some((item) => item.code === "SECTION_CANCELLED" && item.rawValue === "SYN3102 5"));
  assert.ok(result.issues.some((item) => item.code === "SHIFT_RANGE_INTERPRETED" && item.sourceRow === 12));
  assert.deepEqual(result.coverage, {
    sheet: "TKB 04.09", headerRow: 6, knownFormat: true,
    columns: ["courseCode", "courseName", "credits", "day", "group", "lecturer", "room", "sectionId", "shift"],
    sectionRows: 10, parsedRows: 9, skippedRows: { cancelled: 1 }, errorRows: 0,
  });
});

test("an import profile can read bare Ca ranges as periods and pin the sheet", () => {
  const result = uetXlsxAdapter.parse({ ...input(hk1Workbook()), profile: { shiftRange: "periods", sheet: "TKB 04.09" } });
  const session = result.sections.find((section) => section.id === "SYN3996 1")!.sessions[0]!;
  assert.ok(isFixedSession(session));
  assert.deepEqual([session.startPeriod, session.endPeriod], [1, 2]);
  const missing = uetXlsxAdapter.parse({ ...input(hk1Workbook()), profile: { sheet: "Không có" } });
  assert.ok(missing.issues.some((item) => item.code === "MISSING_REQUIRED_COLUMN"));
});

test("an unreviewed column set is held, and repeated Ghi chú columns are joined as information", () => {
  // HK II layout seen in the owner's screenshot: hour columns LT/TH, two "Ghi chú" columns.
  const hk2 = ["Lớp", "Mã HP", "Môn", "TC", "LT", "TH", "Tự học", "SS", "Mã LHP", "Nhóm", "LT/TH", "Thứ", "Ca", "GĐ", "Giảng viên", "Ghi chú", "Ghi chú"];
  const known = uetXlsxAdapter.parse(input(syntheticXlsx([{ name: "TKB", rows: [hk2,
    ["K69I-IT1", "SYN2213", "Mạng mẫu", "4", "45", "", "", "60", "SYN2213 1", "CL", "LT", "6", "4", "105-B", "GV Mẫu", "", "Học 1 ca/15 tuần, thi đợt 2"],
    ["K69I-IT1", "SYN2213", "Mạng mẫu", "4", "", "30", "", "60", "SYN2213 1", "CL", "TH", "2", "4", "307-A", "GV Mẫu", "Học tuần 2-15", "thi đợt 2"],
  ] }])));
  assert.deepEqual(known.issues.filter((item) => item.severity === "error" || item.code === "FORMAT_UNRECOGNIZED"), []);
  const [lt, th] = known.sections[0]!.sessions;
  assert.equal(lt!.rawNote, "Học 1 ca/15 tuần, thi đợt 2");
  assert.equal(lt!.weekOrigin, "parser-default");
  assert.deepEqual(th!.weeks, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(th!.rawNote, "Học tuần 2-15 · thi đợt 2");
  const unknown = uetXlsxAdapter.parse(input(syntheticXlsx([{ name: "TKB", rows: [["Mã HP", "Môn", "Mã LHP", "Thứ", "Ca", "Đợt thi"], ["SYN1", "Môn", "SYN1 1", "2", "1", "1"]] }])));
  assert.equal(unknown.artifact.status, "hold");
  assert.ok(unknown.issues.some((item) => item.code === "FORMAT_UNRECOGNIZED"));
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
