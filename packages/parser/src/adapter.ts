/**
 * Adapter contract for deterministic source parsers (PARSER_SPEC §2, §3).
 * Every adapter is synchronous, pure and offline — no network, no LLM.
 */
import type { Course, ImportArtifact, ParseIssue, Section, Term } from "@ky-nay/domain";

export type SourceInput = {
  /** File bytes or text. Adapters must not trust file extension. */
  bytes: Uint8Array;
  fileName?: string;
  /** For local-only sources (registration) the artifact may carry a local marker instead of a real hash. */
  localOnly?: boolean;
  /** Manifest-provided context; adapters must use it instead of hardcoded term defaults. */
  context?: {
    term: string;
    teachingWeeks: number;
    datasetVersion?: string;
    sourceVersion?: string;
  };
  /** Adapter-specific upper bound; adapters still apply their own safe default. */
  maxBytes?: number;
  /** Per-file overrides for quirks that cannot be inferred; recorded in the import report. Adapters ignore unknown keys. */
  profile?: ImportProfile;
};

/** PARSER_SPEC §4 import profile: a format change is fixed by a reviewed profile, not by code. */
export type ImportProfile = {
  /** Worksheet to read; otherwise the adapter picks the sheet with a complete header. */
  sheet?: string;
  /** Folded substrings of worksheet names that list cancelled sections (default: UET config). */
  cancelledSheetPatterns?: string[];
  /** How a bare `a - b` in the `Ca` column is read (default "shifts"). */
  shiftRange?: "shifts" | "periods";
};

/** Row accounting of a timetable import: every row with a section id ends up parsed, skipped with a reason, or in error. */
export type ParseCoverage = {
  sheet: string;
  headerRow: number;
  /** Canonical fields found in the header, sorted; the format fingerprint. */
  columns: string[];
  /** Whether `columns` matches a format already reviewed (UET config). An unknown format is imported as `hold`. */
  knownFormat: boolean;
  sectionRows: number;
  parsedRows: number;
  skippedRows: Record<string, number>;
  errorRows: number;
};

export type ParseResult = {
  artifact: ImportArtifact;
  courses: Course[];
  sections: Section[];
  terms: Term[];
  issues: ParseIssue[];
  coverage?: ParseCoverage;
};

export interface ParserAdapter {
  /** Stable adapter id, e.g. "uet-xlsx", "vnu-registration-html". */
  readonly id: string;
  /** Semver of the adapter — recorded on ImportArtifact.parserVersion. */
  readonly version: string;
  /** Cheap sniff: can this adapter handle these bytes? Never throws. */
  canParse(input: SourceInput): boolean;
  /** Deterministic parse. Must not throw on malformed input — report issues instead. */
  parse(input: SourceInput): ParseResult;
}
