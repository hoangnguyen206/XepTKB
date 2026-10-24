/**
 * Parser and domain issue taxonomy.
 * Domain issues are deterministic, structured diagnostics for Plan/runtime work;
 * parser issues remain compatible with PARSER_SPEC §8.
 */

export type IssueSeverity = "error" | "warning";

export const ERROR_CODES = [
  "MISSING_REQUIRED_COLUMN",
  "NO_VALID_SECTION_ROWS",
  "INVALID_SECTION_ID",
  "INVALID_DAY_OR_PERIOD",
  "CONFLICTING_NORMALIZED_FIELDS",
  "AMBIGUOUS_NOTE",
  "SCHEMA_VERSION_UNSUPPORTED",
  "HASH_OR_PROVENANCE_MISSING",
  "INPUT_TOO_LARGE",
  "UNSUPPORTED_INPUT",
  "MALFORMED_INPUT",
  "AMBIGUOUS_HEADER",
] as const;

export const WARNING_CODES = [
  "UNKNOWN_COLUMN",
  "UNPARSED_NOTE",
  "DEFAULT_WEEKS_APPLIED",
  "GROUP_MISSING",
  "ROOM_CAMPUS_UNKNOWN",
  "LECTURER_ALIAS_UNMATCHED",
  "DUPLICATE_SESSION_COLLAPSED",
  "REGISTRATION_OVERRIDE_UNMATCHED",
  "NON_FIXED_TIME",
  "CREDITS_MISSING",
  "PERIOD_OVERRIDE_APPLIED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export type WarningCode = (typeof WARNING_CODES)[number];
export type IssueCode = ErrorCode | WarningCode;

export type ParseIssue = {
  code: IssueCode;
  severity: IssueSeverity;
  sourceRow?: number;
  sourcePage?: number;
  field?: string;
  /** rawValue must be redacted — never PII (spec §8). */
  rawValue?: string;
  message: string;
  suggestedAction?: string;
};

export function isErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}

export const DOMAIN_ERROR_CODES = [
  "INVALID_PLAN",
  "PLAN_TERM_MISMATCH",
  "PLAN_DATASET_MISMATCH",
  "PLAN_STATUS_MISMATCH",
  "SECTION_NOT_FOUND",
  "DUPLICATE_PLAN_PICK",
  "DUPLICATE_COURSE_SELECTION",
  "GROUP_REQUIRED",
  "GROUP_NOT_FOUND",
  "INVALID_OVERRIDE_TARGET",
  "INVALID_OVERRIDE_VALUE",
  "STALE_DATASET",
  "INVALID_SESSION_FOR_CONFLICT",
  "WEEK1_UNRESOLVED",
  "AMBIGUOUS_WEEK1",
  "INVALID_WEEK1",
  "INVALID_WEEK",
  "INVALID_DATE",
  "REGISTRATION_OVERRIDE_AMBIGUOUS",
  "REGISTRATION_OVERRIDE_UNMATCHED",
  "REGISTRATION_NOT_SELECTED",
  "CONFLICTING_OVERRIDES",
  "CONFLICTING_COURSE_CREDITS",
  "COURSE_NOT_FOUND",
  "INVALID_CREDITS",
  "MISSING_CREDITS",
  "COURSE_CODE_COLLISION",
  "DUPLICATE_SECTION_ID",
] as const;

export const DOMAIN_WARNING_CODES = [
  "CAMPUS_TRANSITION",
  "DUPLICATE_REGISTRATION_ROW",
  "REGISTRATION_DEFAULT_WEEKS",
  "UNKNOWN_COURSE_CREDITS",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];
export type DomainWarningCode = (typeof DOMAIN_WARNING_CODES)[number];
export type DomainIssueCode = DomainErrorCode | DomainWarningCode;

export type DomainIssue = {
  code: DomainIssueCode;
  severity: IssueSeverity;
  message: string;
  field?: string;
  sectionId?: string;
  sessionId?: string;
  courseCode?: string;
};

export function domainIssue(
  code: DomainIssueCode,
  severity: IssueSeverity,
  message: string,
  details: Omit<DomainIssue, "code" | "severity" | "message"> = {},
): DomainIssue {
  return { code, severity, message, ...details };
}
