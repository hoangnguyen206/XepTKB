/**
 * UET-specific deterministic config for `uet-xlsx` adapter (PARSER_SPEC §4-§6).
 * TimeFrame lives here — never hardcoded inside the engine (DOMAIN_MODEL §4).
 *
 * The adapter consumes real OOXML `.xlsx` bytes through the bounded reader in
 * `ooxml.ts`; the same normalization rules stay pure and testable in memory.
 */
import type { TimeFrame } from "@ky-nay/domain";

/**
 * UET fixture clock (DOMAIN_MODEL §4): shifts 07:00–09:40, 09:50–12:30,
 * 13:30–16:10, 16:20–19:00; 50-minute periods with 5-minute breaks inside a shift.
 */
const UET_PERIOD_TIMES: ReadonlyArray<readonly [start: string, end: string]> = [
  ["07:00", "07:50"], ["07:55", "08:45"], ["08:50", "09:40"],
  ["09:50", "10:40"], ["10:45", "11:35"], ["11:40", "12:30"],
  ["13:30", "14:20"], ["14:25", "15:15"], ["15:20", "16:10"],
  ["16:20", "17:10"], ["17:15", "18:05"], ["18:10", "19:00"],
];

export const UET_TIMEFRAME: TimeFrame = {
  id: "uet-default",
  school: "uet",
  periods: UET_PERIOD_TIMES.map(([start, end], index) => ({ no: index + 1, start, end })),
  shifts: [
    { name: "1", periods: [1, 2, 3] },
    { name: "2", periods: [4, 5, 6] },
    { name: "3", periods: [7, 8, 9] },
    { name: "4", periods: [10, 11, 12] },
  ],
  timezone: "Asia/Ho_Chi_Minh",
};

export const UET_TEACHING_WEEKS = 15;

export type UetAdapterConfig = {
  frame: TimeFrame;
  teachingWeeks: number;
  /** Named Ca values that are not numeric ("Sáng"/"Chiều") → period range. */
  namedShiftRanges: Record<string, { start: number; end: number }>;
  /** Campus tokens matched inside room strings (PARSER_SPEC §5 room/campus). */
  campusPatterns: { token: string; campus: string }[];
  /** Placeholder lecturer names that must not be externally matched. */
  lecturerPlaceholders: string[];
};

export const UET_CONFIG: UetAdapterConfig = {
  frame: UET_TIMEFRAME,
  teachingWeeks: UET_TEACHING_WEEKS,
  namedShiftRanges: {
    sáng: { start: 1, end: 6 },
    chiều: { start: 7, end: 12 },
  },
  campusPatterns: [
    { token: "ĐHKHTN", campus: "ĐHKHTN" },
    { token: "Hòa Lạc", campus: "Hòa Lạc" },
  ],
  lecturerPlaceholders: ["khoa cntt", "ngoại ngữ 4", "chủ nghĩa 3", "tt gdtc"],
};

/**
 * Canonical column → header synonyms (PARSER_SPEC §4). Compared after
 * NFC + lowercase + diacritic-strip + whitespace-collapse; never by index.
 */
export const COLUMN_SYNONYMS: Record<string, string[]> = {
  homeClass: ["lớp", "lớp khóa", "lop", "lớp khoá"],
  courseCode: ["mã hp", "mã môn", "ma hoc phan", "mã học phần"],
  courseName: ["môn", "tên học phần", "ten mon", "môn học", "học phần"],
  credits: ["tc", "tín chỉ", "số tc", "stc"],
  sectionId: ["mã lhp", "mã lớp học phần", "ma lhp"],
  group: ["nhóm", "nhom"],
  kind: ["lt/th", "bt/th", "lt+bt/th", "lt/bt/th", "loại buổi", "loai buoi", "lt+th"],
  day: ["thứ", "thu"],
  shift: ["ca", "ca học", "ca hoc"],
  periodText: ["tiết", "tiết học", "tiet", "tiet hoc"],
  room: ["gđ", "giảng đường", "phòng", "phong", "gd", "phòng học", "phong hoc"],
  lecturer: ["gv", "giảng viên", "giang vien"],
  note: ["ghi chú", "ghi chú học", "tuần học", "ghi chu", "ghi chu hoc", "tuan hoc"],
  examRound: ["đợt thi", "dot thi"],
};

/** Required canonical columns (PARSER_SPEC §4 "yes"). */
export const REQUIRED_COLUMNS = ["courseCode", "courseName", "sectionId", "kind"];

/** Kind value → canonical SessionKind (configured aliases only, no guessing). */
export const KIND_ALIASES: Record<string, "LT" | "TH" | "BT" | "ONL" | "OTHER"> = {
  lt: "LT",
  th: "TH",
  bt: "BT",
  onl: "ONL",
  "lt+th": "LT",
  "lt/th": "LT",
  "lt+bt": "LT",
  "lt+bt/th": "LT",
  "tl+th": "LT",
  "lt/bt/th": "LT",
  "bt/th": "BT",
  "thuc_hanh": "TH",
  "thuc hanh": "TH",
};
