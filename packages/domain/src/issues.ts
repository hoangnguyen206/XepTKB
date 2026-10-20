/**
 * Parser issue taxonomy — mirror of docs/PARSER_SPEC.md §8.
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
