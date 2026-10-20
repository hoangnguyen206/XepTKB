/**
 * Canonical domain types — mirror of docs/DOMAIN_MODEL.md §§2–3.
 * Any breaking change bumps SCHEMA_VERSION and requires an ADR/migration note.
 */

export const SCHEMA_VERSION = "0.2.0";

export type SchoolCode = string;
export type TermId = string;
export type DatasetVersion = string;
export type Period = number;
export type WeekNo = number;
export type DayNo = 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type WeekOrigin = "explicit" | "parser-default" | "registration-default";

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
  /** Undefined means the source did not provide credits; it is never treated as zero. */
  credits?: number;
  school: SchoolCode;
};

export type SessionKind = "LT" | "TH" | "BT" | "ONL" | "OTHER";

type SessionBase = {
  id: string;
  frame: string;
  weeks: WeekNo[];
  weekOrigin?: WeekOrigin;
  kind: SessionKind;
  group?: string;
  room?: string;
  campus?: string;
  lecturers: string[];
  rawNote?: string;
  source: SourceRef;
  confidence: "deterministic" | "reviewed-fallback" | "manual";
};

export type FixedSession = SessionBase & {
  /** Omitted is treated as true for the 0.1.0 wire shape during migration. */
  fixedTime?: true;
  day: DayNo;
  startPeriod: Period;
  endPeriod: Period;
};

export type NonFixedSession = SessionBase & {
  fixedTime: false;
  day?: DayNo;
};

export type Session = FixedSession | NonFixedSession;

export function isFixedSession(session: Session): session is FixedSession {
  return session.fixedTime !== false;
}

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

export type DomainCatalog = {
  courses: readonly Course[];
  sections: readonly Section[];
  datasetVersion?: DatasetVersion;
  /** Optional frame definitions used to validate runtime period overrides. */
  timeFrames?: readonly TimeFrame[];
};

export type PlanPick = { sectionId: string; group?: string };

export type OverrideTarget = {
  sectionId: string;
  sessionId: string;
};

export type OverrideField = "room" | "campus" | "day" | "periods" | "weeks" | "lecturer";

export type Override = {
  target: OverrideTarget;
  field: OverrideField;
  from?: unknown;
  to: unknown;
  source: "registration" | "user" | "admin-correction";
  reason?: string;
};

export type Plan = {
  id: string;
  term: TermId;
  datasetVersion: DatasetVersion;
  name: string;
  planKind: "draft" | "final";
  picks: PlanPick[];
  final: boolean;
  cohort?: string;
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
