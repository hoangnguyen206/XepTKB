/**
 * Canonical domain types — mirror of docs/DOMAIN_MODEL.md §2.
 * Any change here must stay in sync with that doc; bump SCHEMA_VERSION on breaking change.
 */

export const SCHEMA_VERSION = "0.1.0";

export type SchoolCode = string;
export type TermId = string;
export type DatasetVersion = string;
export type Period = number;
export type WeekNo = number;
export type DayNo = 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type SourceRef = {
  artifactId: string;
  sourceType: "timetable" | "registration" | "exam" | "study-plan" | "manual";
  sourceVersion?: string;
  sourceRow?: number;
  sourcePage?: number;
  rawHash?: string;
};

export type TimeFrame = {
  id: string;
  school: SchoolCode;
  periods: { no: Period; start: string; end: string }[];
  shifts: { name: string; periods: Period[] }[];
  timezone: "Asia/Ho_Chi_Minh";
};

export type School = {
  code: SchoolCode;
  name: string;
  frames: TimeFrame[];
  defaultFrame: string;
  campuses: { code: string; name: string; roomPattern?: string }[];
};

export type Course = {
  code: string;
  altCodes: string[];
  name: string;
  normalizedName: string;
  credits: number;
  school: SchoolCode;
};

export type SessionKind = "LT" | "TH" | "BT" | "ONL" | "OTHER";

export type Session = {
  id: string;
  day: DayNo;
  startPeriod: Period;
  endPeriod: Period;
  frame: string;
  weeks: WeekNo[];
  kind: SessionKind;
  group?: string;
  room?: string;
  campus?: string;
  lecturers: string[];
  rawNote?: string;
  source: SourceRef;
  confidence: "deterministic" | "reviewed-fallback" | "manual";
};

export type Section = {
  id: string;
  courseCode: string;
  homeClasses: string[];
  capacity?: number;
  examRound?: 1 | 2;
  online: boolean;
  sessions: Session[];
  source: SourceRef;
  datasetVersion: DatasetVersion;
  warnings: string[];
};

export type Term = {
  id: TermId;
  school: SchoolCode;
  name: string;
  teachingWeeks: number;
  starts: { cohorts: string[]; week1: string }[];
  timezone: "Asia/Ho_Chi_Minh";
};

export type PlanPick = { sectionId: string; group?: string };

export type Override = {
  field: "room" | "campus" | "day" | "periods" | "weeks" | "lecturer";
  from?: unknown;
  to: unknown;
  source: "registration" | "user" | "admin-correction";
  reason?: string;
};

export type Plan = {
  id: string;
  term: TermId;
  name: string;
  planKind: "draft" | "final";
  picks: PlanPick[];
  final: boolean;
  week1?: string;
  overrides: Override[];
  createdAt: string;
  updatedAt: string;
};

export type Exam = {
  id: string;
  sectionId?: string;
  courseCode: string;
  date: string;
  startTime: string;
  endTime?: string;
  room?: string;
  campus?: string;
  mode?: string;
  round?: 1 | 2;
  status: "expected" | "official" | "user";
  source: SourceRef;
};

export type ImportArtifactStatus =
  | "candidate"
  | "hold"
  | "validated"
  | "published"
  | "rejected"
  | "retracted";

export type ImportArtifact = {
  id: string;
  sourceType: SourceRef["sourceType"];
  /** Local-only inputs must not retain the user-selected filename. */
  fileName?: string;
  /** Present only for approved non-PII sources; never hash registration input. */
  sha256?: string;
  /** True for user registration input that never crosses the device boundary. */
  localOnly?: boolean;
  parserVersion: string;
  schemaVersion: string;
  status: ImportArtifactStatus;
  importedAt: string;
  reviewedAt?: string;
  errors: string[];
  warnings: string[];
};
