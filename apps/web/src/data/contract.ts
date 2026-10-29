/**
 * Static artifact contract (ADR-0010 §2). Everything fetched from `data/` is validated here before
 * it reaches the domain engine; any violation throws `ArtifactError` and the data is discarded.
 */
import {
  SCHEMA_VERSION,
  isFixedSession,
  validateCourse,
  validateIsoDate,
  validateSection,
  type Course,
  type Section,
  type Term,
  type TimeFrame,
} from "@ky-nay/domain";

export const MANIFEST_SCHEMA_VERSION = "1.0";
export const METADATA_SCHEMA_VERSION = "1.0";

export type DatasetStatus = "candidate" | "validated" | "published" | "retracted";
export type SourceType = "official-timetable" | "planned-timetable" | "synthetic-fixture";

export type ArtifactRef = { kind: "timetable" | "metadata"; url: string; sha256: string; bytes: number };

export type DatasetEntry = {
  datasetVersion: string;
  school: "uet";
  term: string;
  termName: string;
  status: DatasetStatus;
  source: { type: SourceType; documentRef: string; publishedBy: string; importHash: string };
  parserVersion: string;
  domainSchemaVersion: string;
  importedAt: string;
  reviewedAt?: string;
  publishedAt?: string;
  expiresAt?: string;
  artifacts: ArtifactRef[];
};

export type DatasetManifest = { schemaVersion: string; generatedAt: string; datasets: DatasetEntry[] };

export type TimetableArtifact = { schemaVersion: string; datasetVersion: string; school: "uet"; term: string; courses: Course[]; sections: Section[] };

export type CreditPolicy = { minCredits?: number; maxCredits?: number };

export type MetadataArtifact = {
  schemaVersion: string;
  datasetVersion: string;
  school: "uet";
  term: Term;
  timeFrame: TimeFrame;
  creditPolicy?: CreditPolicy;
};

export type LoadedDataset = { entry: DatasetEntry; timetable: TimetableArtifact; metadata: MetadataArtifact; cachedAt: string };

export type ArtifactErrorCode =
  | "MANIFEST_UNAVAILABLE"
  | "INVALID_MANIFEST"
  | "NO_DATASET"
  | "INVALID_ARTIFACT"
  | "HASH_MISMATCH"
  | "SCHEMA_UNSUPPORTED"
  | "DOMAIN_INVALID"
  | "TOO_LARGE";

export class ArtifactError extends Error {
  constructor(readonly code: ArtifactErrorCode, message: string) {
    super(message);
    this.name = "ArtifactError";
  }
}

const STATUSES: readonly DatasetStatus[] = ["candidate", "validated", "published", "retracted"];
const SOURCE_TYPES: readonly SourceType[] = ["official-timetable", "planned-timetable", "synthetic-fixture"];
const KINDS = ["LT", "TH", "BT", "ONL", "OTHER"] as const;
const CONFIDENCE = ["deterministic", "reviewed-fallback", "manual"] as const;
const SOURCE_REF_TYPES = ["timetable", "registration", "exam", "study-plan", "manual"] as const;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const SHA256 = /^[0-9a-f]{64}$/;

type Json = Record<string, unknown>;

function fail(code: ArtifactErrorCode, message: string): never {
  throw new ArtifactError(code, message);
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isOptional(value: unknown, check: (item: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function isInstant(value: unknown): value is string {
  return isString(value) && ISO_INSTANT.test(value) && !Number.isNaN(Date.parse(value));
}

/** Relative path below `data/`: no scheme, no absolute path, no `..`, no backslash or query. */
export function isSafeRelativeUrl(url: unknown): url is string {
  if (!isNonEmptyString(url)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/") || url.startsWith("//")) return false;
  if (/[\\?#]/.test(url) || /[\u0000-\u001f]/.test(url)) return false;
  return url.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function parseArtifactRef(value: unknown, where: string): ArtifactRef {
  if (!isRecord(value)) fail("INVALID_MANIFEST", `${where}: artifact entry is not an object`);
  if (value.kind !== "timetable" && value.kind !== "metadata") fail("INVALID_MANIFEST", `${where}: unknown artifact kind`);
  if (!isSafeRelativeUrl(value.url)) fail("INVALID_MANIFEST", `${where}: artifact url must be a relative path inside data/`);
  if (!isString(value.sha256) || !SHA256.test(value.sha256)) fail("INVALID_MANIFEST", `${where}: sha256 must be 64 lowercase hex characters`);
  if (typeof value.bytes !== "number" || !Number.isInteger(value.bytes) || value.bytes <= 0) fail("INVALID_MANIFEST", `${where}: bytes must be a positive integer`);
  return { kind: value.kind, url: value.url, sha256: value.sha256, bytes: value.bytes };
}

function parseEntry(value: unknown, index: number): DatasetEntry {
  const where = `datasets[${index}]`;
  if (!isRecord(value)) fail("INVALID_MANIFEST", `${where} is not an object`);
  const source = value.source;
  if (!isNonEmptyString(value.datasetVersion) || value.school !== "uet" || !isNonEmptyString(value.term) || !isNonEmptyString(value.termName)) {
    fail("INVALID_MANIFEST", `${where}: datasetVersion/school/term/termName are required`);
  }
  if (!STATUSES.includes(value.status as DatasetStatus)) fail("INVALID_MANIFEST", `${where}: unknown status`);
  if (!isRecord(source) || !SOURCE_TYPES.includes(source.type as SourceType) || !isNonEmptyString(source.documentRef) || !isNonEmptyString(source.publishedBy) || !isNonEmptyString(source.importHash)) {
    fail("INVALID_MANIFEST", `${where}: source provenance is incomplete`);
  }
  if (!isNonEmptyString(value.parserVersion) || !isNonEmptyString(value.domainSchemaVersion) || !isInstant(value.importedAt)) {
    fail("INVALID_MANIFEST", `${where}: parserVersion, domainSchemaVersion and importedAt are required`);
  }
  for (const field of ["reviewedAt", "publishedAt", "expiresAt"] as const) {
    if (!isOptional(value[field], isInstant)) fail("INVALID_MANIFEST", `${where}: ${field} must be an ISO-8601 instant`);
  }
  if (!Array.isArray(value.artifacts)) fail("INVALID_MANIFEST", `${where}: artifacts must be an array`);
  const artifacts = value.artifacts.map((artifact, artifactIndex) => parseArtifactRef(artifact, `${where}.artifacts[${artifactIndex}]`));
  for (const kind of ["timetable", "metadata"] as const) {
    if (artifacts.filter((artifact) => artifact.kind === kind).length !== 1) fail("INVALID_MANIFEST", `${where}: exactly one ${kind} artifact is required`);
  }
  return {
    datasetVersion: value.datasetVersion,
    school: "uet",
    term: value.term,
    termName: value.termName,
    status: value.status as DatasetStatus,
    source: { type: source.type as SourceType, documentRef: source.documentRef as string, publishedBy: source.publishedBy as string, importHash: source.importHash as string },
    parserVersion: value.parserVersion,
    domainSchemaVersion: value.domainSchemaVersion,
    importedAt: value.importedAt,
    ...(isString(value.reviewedAt) ? { reviewedAt: value.reviewedAt } : {}),
    ...(isString(value.publishedAt) ? { publishedAt: value.publishedAt } : {}),
    ...(isString(value.expiresAt) ? { expiresAt: value.expiresAt } : {}),
    artifacts,
  };
}

export function parseManifest(value: unknown): DatasetManifest {
  if (!isRecord(value)) fail("INVALID_MANIFEST", "manifest is not an object");
  if (value.schemaVersion !== MANIFEST_SCHEMA_VERSION) fail("SCHEMA_UNSUPPORTED", `manifest schemaVersion ${String(value.schemaVersion)} is not supported`);
  if (!isInstant(value.generatedAt)) fail("INVALID_MANIFEST", "manifest generatedAt is required");
  if (!Array.isArray(value.datasets)) fail("INVALID_MANIFEST", "manifest datasets must be an array");
  return { schemaVersion: value.schemaVersion, generatedAt: value.generatedAt, datasets: value.datasets.map(parseEntry) };
}

function isSourceRef(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.artifactId) && SOURCE_REF_TYPES.includes(value.sourceType as (typeof SOURCE_REF_TYPES)[number]);
}

function isSessionShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const common = isNonEmptyString(value.id)
    && isNonEmptyString(value.frame)
    && Array.isArray(value.weeks) && value.weeks.every((week) => typeof week === "number")
    && KINDS.includes(value.kind as (typeof KINDS)[number])
    && isStringArray(value.lecturers)
    && CONFIDENCE.includes(value.confidence as (typeof CONFIDENCE)[number])
    && isSourceRef(value.source)
    && isOptional(value.group, isString) && isOptional(value.room, isString) && isOptional(value.campus, isString) && isOptional(value.rawNote, isString)
    && isOptional(value.weekOrigin, (origin) => origin === "explicit" || origin === "parser-default" || origin === "registration-default");
  if (!common) return false;
  if (value.fixedTime === false) return isOptional(value.day, (day) => typeof day === "number");
  return (value.fixedTime === undefined || value.fixedTime === true)
    && typeof value.day === "number" && typeof value.startPeriod === "number" && typeof value.endPeriod === "number";
}

function isSectionShape(value: unknown): value is Section {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.courseCode)
    && isStringArray(value.homeClasses)
    && typeof value.online === "boolean"
    && Array.isArray(value.sessions) && value.sessions.every(isSessionShape)
    && isSourceRef(value.source)
    && isNonEmptyString(value.datasetVersion)
    && isStringArray(value.warnings)
    && isOptional(value.capacity, (capacity) => typeof capacity === "number")
    && isOptional(value.examRound, (round) => round === 1 || round === 2);
}

function isCourseShape(value: unknown): value is Course {
  return isRecord(value)
    && isNonEmptyString(value.code)
    && isStringArray(value.altCodes)
    && isNonEmptyString(value.name)
    && isString(value.normalizedName)
    && isNonEmptyString(value.school)
    && isOptional(value.credits, (credits) => typeof credits === "number");
}

function checkHeader(value: Json, entry: DatasetEntry, kind: string, schemaVersion: string): void {
  if (value.schemaVersion !== schemaVersion) fail("SCHEMA_UNSUPPORTED", `${kind} schemaVersion ${String(value.schemaVersion)} is not supported`);
  if (value.datasetVersion !== entry.datasetVersion || value.school !== entry.school || (kind === "timetable" && value.term !== entry.term)) {
    fail("INVALID_ARTIFACT", `${kind} does not belong to dataset ${entry.datasetVersion}`);
  }
}

function parseTimeFrame(value: unknown): TimeFrame {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.school) || value.timezone !== "Asia/Ho_Chi_Minh" || !Array.isArray(value.periods) || !Array.isArray(value.shifts)) {
    fail("INVALID_ARTIFACT", "metadata timeFrame is invalid");
  }
  const periods = value.periods.map((period) => {
    if (!isRecord(period) || typeof period.no !== "number" || !Number.isInteger(period.no) || period.no < 1 || !isString(period.start) || !CLOCK.test(period.start) || !isString(period.end) || !CLOCK.test(period.end) || period.end <= period.start) {
      fail("INVALID_ARTIFACT", "metadata timeFrame period is invalid");
    }
    return { no: period.no, start: period.start, end: period.end };
  });
  if (new Set(periods.map((period) => period.no)).size !== periods.length || periods.length === 0) fail("INVALID_ARTIFACT", "metadata timeFrame periods must be unique");
  const shifts = value.shifts.map((shift) => {
    if (!isRecord(shift) || !isString(shift.name) || !Array.isArray(shift.periods) || !shift.periods.every((no) => typeof no === "number")) fail("INVALID_ARTIFACT", "metadata timeFrame shift is invalid");
    return { name: shift.name, periods: shift.periods as number[] };
  });
  return { id: value.id, school: value.school, periods, shifts, timezone: "Asia/Ho_Chi_Minh" };
}

function parseTerm(value: unknown, entry: DatasetEntry): Term {
  if (!isRecord(value) || value.id !== entry.term || value.school !== entry.school || !isNonEmptyString(value.name) || value.timezone !== "Asia/Ho_Chi_Minh") {
    fail("INVALID_ARTIFACT", "metadata term does not match the manifest entry");
  }
  if (typeof value.teachingWeeks !== "number" || !Number.isInteger(value.teachingWeeks) || value.teachingWeeks < 1 || value.teachingWeeks > 30) fail("INVALID_ARTIFACT", "metadata teachingWeeks is invalid");
  if (!Array.isArray(value.starts)) fail("INVALID_ARTIFACT", "metadata term starts must be an array");
  const starts = value.starts.map((start) => {
    if (!isRecord(start) || !isStringArray(start.cohorts) || !isString(start.week1) || !validateIsoDate(start.week1)) fail("INVALID_ARTIFACT", "metadata term start is invalid");
    return { cohorts: start.cohorts, week1: start.week1 };
  });
  return { id: value.id as string, school: "uet", name: value.name, teachingWeeks: value.teachingWeeks, starts, timezone: "Asia/Ho_Chi_Minh" };
}

function parseCreditPolicy(value: unknown): CreditPolicy | undefined {
  if (value === undefined) return undefined;
  const nonNegative = (item: unknown) => typeof item === "number" && Number.isFinite(item) && item >= 0;
  if (!isRecord(value) || !isOptional(value.minCredits, nonNegative) || !isOptional(value.maxCredits, nonNegative)) fail("INVALID_ARTIFACT", "metadata creditPolicy is invalid");
  return { ...(typeof value.minCredits === "number" ? { minCredits: value.minCredits } : {}), ...(typeof value.maxCredits === "number" ? { maxCredits: value.maxCredits } : {}) };
}

export function parseMetadata(value: unknown, entry: DatasetEntry): MetadataArtifact {
  if (!isRecord(value)) fail("INVALID_ARTIFACT", "metadata is not an object");
  checkHeader(value, entry, "metadata", METADATA_SCHEMA_VERSION);
  const creditPolicy = parseCreditPolicy(value.creditPolicy);
  return {
    schemaVersion: METADATA_SCHEMA_VERSION,
    datasetVersion: entry.datasetVersion,
    school: "uet",
    term: parseTerm(value.term, entry),
    timeFrame: parseTimeFrame(value.timeFrame),
    ...(creditPolicy ? { creditPolicy } : {}),
  };
}

/** Structural checks, then the domain invariants (DOMAIN_MODEL §3) against the metadata time frame. */
export function parseTimetable(value: unknown, entry: DatasetEntry, metadata: MetadataArtifact): TimetableArtifact {
  if (!isRecord(value)) fail("INVALID_ARTIFACT", "timetable is not an object");
  checkHeader(value, entry, "timetable", SCHEMA_VERSION);
  if (!Array.isArray(value.courses) || !value.courses.every(isCourseShape)) fail("INVALID_ARTIFACT", "timetable courses have an invalid shape");
  if (!Array.isArray(value.sections) || !value.sections.every(isSectionShape)) fail("INVALID_ARTIFACT", "timetable sections have an invalid shape");
  const courses = value.courses;
  const sections = value.sections;
  const maxPeriod = Math.max(...metadata.timeFrame.periods.map((period) => period.no));
  const periodNumbers = new Set(metadata.timeFrame.periods.map((period) => period.no));
  const courseCodes = new Set(courses.map((course) => course.code));
  for (const course of courses) {
    const errors = validateCourse(course).filter((issue) => issue.severity === "error");
    if (errors.length > 0) fail("DOMAIN_INVALID", `course ${course.code}: ${errors[0]!.code}`);
  }
  const ids = new Set<string>();
  for (const section of sections) {
    if (ids.has(section.id)) fail("DOMAIN_INVALID", `section ${section.id} appears twice`);
    ids.add(section.id);
    if (section.datasetVersion !== entry.datasetVersion) fail("DOMAIN_INVALID", `section ${section.id} belongs to another dataset version`);
    if (!courseCodes.has(section.courseCode)) fail("DOMAIN_INVALID", `section ${section.id} references an unknown course`);
    const errors = validateSection(section, maxPeriod, metadata.term.teachingWeeks).filter((issue) => issue.severity === "error");
    if (errors.length > 0) fail("DOMAIN_INVALID", `section ${section.id}: ${errors[0]!.code}`);
    for (const session of section.sessions) {
      if (session.frame !== metadata.timeFrame.id) fail("DOMAIN_INVALID", `section ${section.id} uses an unknown time frame`);
      if (isFixedSession(session) && (!periodNumbers.has(session.startPeriod) || !periodNumbers.has(session.endPeriod))) {
        fail("DOMAIN_INVALID", `section ${section.id} uses a period missing from the time frame`);
      }
    }
  }
  return { schemaVersion: SCHEMA_VERSION, datasetVersion: entry.datasetVersion, school: "uet", term: entry.term, courses, sections };
}
