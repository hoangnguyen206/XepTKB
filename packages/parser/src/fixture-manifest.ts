/**
 * Fixture manifest format (QA_TEST_PLAN §3, PARSER_SPEC §11).
 * Manifest is the authority for expected counts/issues — never hardcode
 * expected numbers in test code.
 */
import type { IssueCode, SourceRef } from "@ky-nay/domain";

export const FIXTURE_MANIFEST_VERSION = "1";

export type FixtureExpected = {
  /** SHA-256 of the declared input, lowercase hex. Omit for local-only registration input. */
  inputSha256?: string;
  sections?: number;
  sessions?: number;
  courses?: number;
  /** Exact issue codes expected (order-insensitive). */
  issueCodes?: IssueCode[];
  /** At least one issue with this code must be an error. */
  errorCodes?: IssueCode[];
};

export type FixtureEntry = {
  /** Fixture id, unique within the manifest. */
  id: string;
  /** Source family per PARSER_SPEC §11 (e.g. "uet-xlsx", "vnu-registration-html", "synthetic-adversarial"). */
  family: string;
  /** Adapter id to run. */
  adapter: string;
  /** Path to input file relative to the manifest directory. */
  input: string;
  /** "synthetic" | "redacted" — real PII files never live in the repo. */
  dataClass: "synthetic" | "redacted";
  /** Optional human note on which quirk this fixture reproduces. */
  quirk?: string;
  expected: FixtureExpected;
};

export type FixtureManifest = {
  manifestVersion: string;
  /** Schema of the canonical model the fixture targets. */
  schemaVersion: string;
  /** Term context used for defaults (e.g. teachingWeeks). */
  context: { term: string; teachingWeeks: number };
  sourceRef?: SourceRef;
  fixtures: FixtureEntry[];
};
