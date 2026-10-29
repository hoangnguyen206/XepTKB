# ADR-0011 — Timetable layouts that change every term: one adapter, import profile, format fingerprint

> **Artifact ID:** `ADR-0011`
> **Artifact status:** `ready` — G1 acknowledgement pending (Tech Lead, Data Reviewer)
> **Canonical gate:** `G1`
> **Date:** 2026-10-30
> **Owner:** Data Parser + Tech Lead
> **Decision owner:** Product (owner approved the approach on 2026-10-30)
> **Last reviewed:** 2026-10-30
> **Related docs:** [Parser spec §4–§6, §8](../PARSER_SPEC.md), [ADR-0007](ADR-0007-static-artifact-cli-admin.md), [ADR-0008](ADR-0008-m1-parser-dependencies-local-provenance.md), [ADR-0009 amendment (15)](ADR-0009-m2-domain-engine-schema.md), [Fixture policy](../evidence/M0-FIXTURE-POLICY.md), [Implementation plan §10 C-10, Q-012](../IMPLEMENTATION_PLAN.md)
> **Evidence envelope:** [EVID-M3-001 fix round 2026-10-30](../evidence/M3-EVIDENCE-ENVELOPE.md)

## Context

`uet-xlsx@0.1.0` was built from synthetic fixtures. The first real timetable (HK I 2026–27, "SAU ĐKH 04.09.2026", public data, kept outside the repository) gave **0 sections**: it has 10 columns and no `LT/TH` column, which 0.1.0 required. A screenshot of another term shows 17 columns with `LT/TH`, two `Ghi chú` columns and a `Lớp` column. The column set changes from term to term, together with value quirks:

- a "Các lớp hủy" sheet with the same header, placed before the timetable;
- `Ca` values `1`–`4`, `1 - 2`, `Tiết 1-2`;
- course codes with a space (`EMA 3062`) or `#` (`AIT3003#` next to `AIT3003`);
- projects and `Học Online` rows with no day or shift;
- a cancelled class (`INT3102 5`) that is still listed on the main sheet.

## Decision

1. **One adapter, header-driven.** Columns are found by name, never by position. Required: `courseCode`, `courseName`, `sectionId`, `day`, and `shift` or `periodText`. Everything else is optional and has a documented default.
2. **Format fingerprint.** The sorted set of canonical fields in the header is compared with `KNOWN_FORMATS`. An unknown set imports with `status: "hold"` and `FORMAT_UNRECOGNIZED`. It cannot be published until a Data Reviewer looks at it and adds the set to the list. A layout change therefore stops the pipeline instead of being trusted silently.
3. **Import profile.** A small JSON per source file (`sheet`, `cancelledSheetPatterns`, `shiftRange`) handles quirks that cannot be inferred. The reviewer changes the profile, not the code. The profile is part of the import record.
4. **Row coverage.** `ParseResult.coverage` accounts for every row with a section id as parsed, skipped with a reason (`cancelled`, `duplicate`) or in error. `npm run test:real -- <file>` fails on errors or on rows that are not accounted for. It refuses files inside the repository.
5. **Quirk rules from the real file:**
   - a cancelled-classes sheet is never imported, and its ids are removed from the timetable (`SECTION_CANCELLED`);
   - section ids are rebuilt from the normalized course code;
   - `#` is kept as part of the code;
   - a bare `a - b` in `Ca` means shifts a..b (`SHIFT_RANGE_INTERPRETED`; profile `shiftRange` can switch it to periods);
   - rows with no time in a file without a kind column become non-fixed sessions (`OTHER`, or `ONL` when the room says online), as in Q-012;
   - repeated `Ghi chú` columns are joined.
6. **Notes are information (Q-012, owner 2026-10-30).** Only an explicit week or period pattern changes a session. Any other note text is kept in `rawNote` and shown to students, with no warning.
7. **Later (post-MVP).** For a never-seen layout, an LLM may *propose* a profile in the admin flow, as a draft that a reviewer approves (deterministic-first rule).

## Alternatives considered

| Option | Why not |
| --- | --- |
| One adapter per term or per layout | Duplicates the normalization rules; each new term needs code and a release before data can be imported, close to the registration window |
| Column positions per term | Breaks on any inserted column; positions are not reviewable as meaning |
| Accept any header that has the required columns | A layout change (for example, a new column carrying week information) would be published without anyone noticing |
| LLM mapping as the primary path | Violates deterministic-first; output is not reproducible |

## Consequences

- Positive:
  - the real HK I file imports with 0 errors: 1077 sections, 1467 sessions, 1 cancelled row, 0 unaccounted;
  - every new layout is visible as `hold` with the list of columns;
  - quirks are fixed in a reviewed JSON file.
- Negative:
  - `KNOWN_FORMATS` and profiles must be maintained;
  - the `1 - 2` = shifts rule is an interpretation. It is backed by the file (the school writes `Tiết` when it means periods) but not yet confirmed by the school or the owner.
- Privacy/security: no new boundary. Timetable files are public; `test:real` prints counts only for registration files.
- Rollback: `uet-xlsx@0.1.0` cannot read the real file, so rollback means fixing forward with a profile. Data already imported keeps its `parserVersion`.

## Verification

- `uet-xlsx.test.ts`:
  - a synthetic workbook with the HK I layout (cancelled sheet, letterhead, signature row, every quirk above);
  - a profile test;
  - a test for unknown format → `hold` and repeated `Ghi chú`.
- `npm run test:real -- "<path>/TKB HKI 2026-2027 SAU ĐKH 04.09.2026.xlsx" --term 2026-2027-h1` → exit 0, coverage complete (run 2026-10-30).
- Re-entry: G1 acknowledgement of this ADR; G3a for M1 (parser) together with the M3 G3 re-run.
