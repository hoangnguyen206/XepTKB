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

/**
 * Required canonical columns (PARSER_SPEC §4 "yes"); a `shift` or `periodText` column is required as well.
 * `kind` is optional: the HK I 2026–27 timetable has no LT/TH column.
 */
export const REQUIRED_COLUMNS = ["courseCode", "courseName", "sectionId", "day"];

/** Columns that may repeat in a header; their values are joined (the HK II layout has two "Ghi chú" columns). */
export const REPEATABLE_COLUMNS = ["note"];

/** Folded words of worksheet names that list cancelled sections ("Các lớp hủy"); such a sheet is never imported. */
export const CANCELLED_SHEET_WORDS = ["huy"];

/** Folded room text of a self-paced online class when the file has no kind column ("Học Online"). */
export const ONLINE_ROOM_WORDS = ["online"];

/**
 * Column sets already reviewed (format fingerprints). Any other set imports as `hold` with FORMAT_UNRECOGNIZED,
 * so a new layout is looked at before publication instead of being trusted silently.
 */
export const KNOWN_FORMATS: { id: string; columns: string[] }[] = [
  { id: "uet-hk1-2026-27-portal", columns: ["courseCode", "courseName", "credits", "day", "group", "lecturer", "room", "sectionId", "shift"] },
  { id: "uet-official-with-kind-and-notes", columns: ["courseCode", "courseName", "credits", "day", "group", "homeClass", "kind", "lecturer", "note", "room", "sectionId", "shift"] },
  { id: "uet-official-with-periods", columns: ["courseCode", "courseName", "credits", "day", "group", "homeClass", "kind", "lecturer", "note", "periodText", "room", "sectionId", "shift"] },
];

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
