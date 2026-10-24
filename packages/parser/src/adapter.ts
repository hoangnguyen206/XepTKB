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
};

export type ParseResult = {
  artifact: ImportArtifact;
  courses: Course[];
  sections: Section[];
  terms: Term[];
  issues: ParseIssue[];
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
