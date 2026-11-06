# ADR-0011 — Timetable layouts that change every term: one adapter, import profile, format fingerprint

> **Artifact ID:** `ADR-0011`
> **Artifact status:** `ready` — G1 acknowledgement pending (Tech Lead, Data Reviewer)
> **Canonical gate:** `G1`
> **Date:** 2026-10-30
> **Owner:** Data Parser + Tech Lead
> **Decision owner:** Product (owner approved the approach on 2026-10-30)
> **Last reviewed:** 2026-11-06
> **Related docs:** [Parser spec §4–§6, §8](../PARSER_SPEC.md), [ADR-0007](ADR-0007-static-artifact-cli-admin.md), [ADR-0008](ADR-0008-m1-parser-dependencies-local-provenance.md), [ADR-0009 amendment (15)](ADR-0009-m2-domain-engine-schema.md), [Fixture policy](../evidence/M0-FIXTURE-POLICY.md), [Implementation plan §10 C-10, Q-012](../IMPLEMENTATION_PLAN.md)
> **Evidence envelope:** [EVID-M3-001 fix round 2026-10-30 & 2026-11-06](../evidence/M3-EVIDENCE-ENVELOPE.md)

## Context

`uet-xlsx@0.1.0` was built from synthetic fixtures. The first real timetable (HK I 2026–27, "SAU ĐKH 04.09.2026", public data, kept outside the repository) gave **0 sections**: it has 10 columns and no `LT/TH` column, which 0.1.0 required. A screenshot of another term shows 17 columns with `LT/TH`, two `Ghi chú` columns and a `Lớp` column. The column set changes from term to term, together with value quirks:

- a "Các lớp hủy" sheet with the same header, placed before the timetable;
- `Ca` values `1`–`4`, `1 - 2`, `Tiết 1-2`;
- course codes with a space (`EMA 3062`) or `#` (`AIT3003#` next to `AIT3003`);
- projects and `Học Online` rows with no day or shift;
- a cancelled class (`INT3102 5`) that is still listed on the main sheet.

## Decision

1. **One adapter, header-driven.** Columns are found by name, never by position. Required: `courseCode`, `courseName`, `sectionId`, `day`, and `shift` or `periodText`. Everything else is optional and has a documented default.
2. **Format fingerprint (canonical + extra `info` columns).** Both the sorted set of canonical fields in the header and every non-canonical (`info`) column header are compared with `KNOWN_FORMATS` (`columns` and `infoColumns` in `packages/parser/src/uet-config.ts`). Any unreviewed canonical set or unreviewed extra `info` column (such as a new `"Tuần áp dụng"` column) imports with `status: "hold"` and `FORMAT_UNRECOGNIZED` (plus `UNKNOWN_COLUMN` naming the header in `rawValue`). In the CLI (`scripts/dataset.mjs`), a `"hold"` result stops `dataset import` with exit code 2 until the column set is added to `KNOWN_FORMATS`, or an operator explicitly passes `--accept-new-format "<reason>"` on `import` AND the Data Reviewer confirms `--accept-new-format "<reason>"` on `validate` after checking the report's `Extra (info) columns` table (`REV-M3-102`, `SEC-M3-102`, `QA-M3-105`).
3. **Import profile.** A small JSON per source file (`sheet`, `cancelledSheetPatterns`, `shiftRange`) handles quirks that cannot be inferred. The reviewer changes the profile, not the code. The profile is part of the import record.
4. **Row coverage.** `ParseResult.coverage` accounts for every row with a section id as parsed, skipped with a reason (`cancelled`, `duplicate`) or in error, and records both `columns` and `infoColumns`. `npm run test:real -- <file>` fails on errors or on rows that are not accounted for. It refuses files inside the repository.
5. **Quirk rules from the real file:**
   - a cancelled-classes sheet is never imported, and its ids are removed from the timetable (`SECTION_CANCELLED`);
   - section ids are rebuilt from the normalized course code;
   - `#` is kept as part of the code;
   - a bare `a - b` in `Ca` means shifts a..b; only an explicit `Tiết a-b` means periods (confirmed by the owner, Q-013, 2026-10-31, so no warning; profile `shiftRange` exists for a source that writes it differently);
   - rows with no time in a file without a kind column become non-fixed sessions (`OTHER`, or `ONL` when the room says online), as in Q-012;
   - repeated `Ghi chú` columns are joined.
6. **Notes are information; partial/unreviewed `"tuần"` phrasings warn and fail closed to default weeks (Q-012, owner 2026-10-30; `REV-M3-101`, 2026-11-06).** Only a complete, unambiguous week or period pattern (`Học tuần a-b`, `Học từ tuần a`, `Học tuần a,b,c`, `Học tiết a-b`) changes a session. General notes without `"tuần"` (and the benign frequency phrase `N ca/M tuần`) are kept in `rawNote` with no warning. However, if a note mentions `"tuần"` in a partially matched or unreviewed phrasing (for example `"Học tuần 1 đến tuần 8"`, `"Học từ tuần 3 đến tuần 10"`, `"Tuần 1-8"`), the parser never silently truncates to partial `explicit` weeks; instead it keeps default weeks (`weekOrigin: "parser-default"`), emits `UNPARSED_NOTE` with `rawValue`, and lists every `"tuần"` note and its resolved weeks in the import report for Data Reviewer sign-off.
7. **Later (post-MVP).** For a never-seen layout, an LLM may *propose* a profile in the admin flow, as a draft that a reviewer approves (deterministic-first rule).
8. **Columns outside the list are information, with hidden-element stripping and PII header deny-list (Q-013, owner 2026-10-31; `SEC-M3-102`, 2026-11-06).** There is no fixed column count. Only the necessary columns are required. Every visible column the adapter does not use (unknown ones such as `SS`, `LT`, `Tự học`, or canonical ones it ignores such as `Đợt thi`) is kept per session as `info: { label, value }[]`:
   - OOXML hidden worksheets (`state="hidden"|"veryHidden"`), hidden columns (`<col hidden="1">`), and hidden rows (`<row hidden="1">`) are skipped by `ooxml.ts` and never read or exposed in `info`;
   - visible headers matching the personal-data deny-list (`FORBIDDEN_HEADER_PATTERNS`: `sđt`, `điện thoại`, `phone`, `email`, `ngày sinh`, `mã sv`, `mssv`, `cccd`, `cmnd`, etc.) are rejected with a blocking `UNSUPPORTED_INPUT` error and excluded from `info`;
   - the label is the header as written; empty cells are skipped and row-number columns (`STT`) are dropped;
   - at most 30 entries of up to 300 characters each, checked again by the web loader;
   - shown to students next to the note, never used for weeks or conflicts.

   This is an additive optional field: schema stays `0.2.0`, and older loaders ignore it.

## Status after the owner's answers (2026-10-31) and G3 R2 remediation (2026-11-06)

Q-013 confirmed the `Ca` rule, the column policy (§8) and Cloudflare Pages for hosting. The `SHIFT_RANGE_INTERPRETED` warning added on 2026-10-30 was removed before any merge. On 2026-11-06, `REV-M3-101` and `SEC-M3-102` / `REV-M3-102` / `QA-M3-105` were remediated by tightening week-clause matching in `weeks.ts`, stripping OOXML hidden sheets/columns/rows in `ooxml.ts`, adding `FORBIDDEN_HEADER_PATTERNS` and reviewed `infoColumns` to `KNOWN_FORMATS`, and listing extra `info` columns and `"tuần"` notes in the import report.

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
  - every new layout (including any new non-canonical `info` column) is visible as `hold` with the list of columns;
  - quirks are fixed in a reviewed JSON file.
- Negative:
  - `KNOWN_FORMATS` and profiles must be maintained;
  - `Session.info` makes the dataset somewhat larger when a layout has many extra columns (capped per session).
- Privacy/security: no new boundary. Timetable files are public; hidden OOXML sheets/columns/rows and PII header names are blocked; `test:real` prints counts only for registration files.
- Rollback: `uet-xlsx@0.1.0` cannot read the real file, so rollback means fixing forward with a profile. Data already imported keeps its `parserVersion`.

## Verification

- `uet-xlsx.test.ts` & `weeks.test.ts`:
  - a synthetic workbook with the HK I layout (cancelled sheet, letterhead, signature row, every quirk above);
  - a profile test;
  - tests for unknown format / extra unreviewed `info` column → `hold` and repeated `Ghi chú`;
  - tests for hidden sheets/columns/rows and PII column headers (`SEC-M3-102`);
  - tests for partial/unreviewed `"tuần"` notes (`REV-M3-101`).
- `npm run test:real -- "<path>/TKB HKI 2026-2027 SAU ĐKH 04.09.2026.xlsx" --term 2026-2027-h1` → exit 0, coverage complete (run 2026-10-30).
- Re-entry: G1 acknowledgement of this ADR; G3a for M1 (parser) together with the M3 G3 re-run.
