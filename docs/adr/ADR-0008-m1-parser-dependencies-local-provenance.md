# ADR-0008 — M1 deterministic parser dependencies and local registration provenance

> **Status:** ready; G1 acknowledgement pending  
> **Owner:** Tech Lead + Data Parser  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [Parser spec](../PARSER_SPEC.md), [Domain model](../DOMAIN_MODEL.md), [Security & privacy](../SECURITY_PRIVACY.md), [M1 design handoff](../evidence/M1-DESIGN-HANDOFF.md)

## Context

M1 needs deterministic parsing for UET OOXML timetables and registration result HTML. The parser must run offline, support a future browser File/ArrayBuffer caller, fail closed on malformed/untrusted input and preserve the rule that registration files and identity data never leave the device.

A review of the obvious spreadsheet dependency showed that the available SheetJS `xlsx` release was reported by `npm audit` with high-severity prototype-pollution and ReDoS advisories and no registry fix compatible with the selected release. The `ImportArtifact` contract also previously required a content hash even though registration input must not be hashed or retained as an identifier.

## Decision

1. Use `fflate@0.8.3` for bounded ZIP/OOXML part extraction and `@xmldom/xmldom@0.9.12` for inert XML/HTML DOM parsing. Both are direct, pinned-major/minor dependencies and `npm audit --omit=dev` is clean at implementation time.
2. The M1 OOXML adapter reads only workbook relationships, worksheet XML, shared strings and merge ranges. It does not evaluate formulas, external links, macros or scripts; input and expanded-entry size limits are enforced before canonicalization.
3. Keep file I/O outside adapter logic: adapters receive bytes and explicit context, make no network calls and return typed issues instead of propagating parser exceptions.
4. Make `ImportArtifact.sha256` optional only for `sourceType="registration"` with `localOnly=true`. Public/non-PII timetable artifacts still require a lowercase 64-character SHA-256. Local registration artifacts use a constant non-identifying id, omit filename/hash and carry only schedule candidates after identity fields are discarded.
5. M1 registration parsing stops at candidate extraction. Matching/override precedence, user confirmation, persistence and Plan mutation remain later work and are not part of M1.

## Alternatives considered

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| SheetJS `xlsx` | familiar, broad format support | current registry release has high audit findings; no available fix | rejected for M1 |
| ExcelJS | broad workbook API | larger dependency graph and Node-oriented surface; unnecessary features | rejected |
| Custom ZIP/XML parser | smallest dependency surface | high correctness/security maintenance burden | rejected |
| `fflate` + `@xmldom/xmldom` | small, browser-compatible primitives; explicit bounded part parsing | adapter owns supported OOXML subset and needs future real-file spike | selected |
| Hash registration bytes | easy artifact identity | violates local-only privacy boundary and can enable linkage | rejected |

## Compatibility and rollback

The change is additive to the M0 adapter contract and preserves canonical JSONL behavior. If the dependency or provenance decision is rejected, remove the M1 adapters and restore mandatory `sha256` for all artifacts; no persisted user data or published dataset is affected because M1 has no UI/storage/publish path.

## Verification

- Unit/golden tests cover header row 1/4, merged cells, synonyms, T7, weeks/period override, malformed OOXML, size limits and registration multi-day/multi-period extraction.
- Registration tests assert no identity field, filename or hash is present in the result; browser network interception remains a G3b manual/web-app follow-up because M1 contains no web app.
- `npm audit --omit=dev`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run fixtures:run` are recorded in the M1 handoff/evidence envelope.

## Approval

- Product scope approval: `N/A — no independent actor recorded in this session`
- Tech Lead design approval: `N/A — draft/ready for review`
- Data Parser approval: `N/A — implementer cannot self-approve`
- Security consultation/gate: `N/A — acknowledgement pending`
- Decision: `g1-approved | g1-blocked` — `g1-blocked` until recorded acknowledgement
- Open conditions: verify real approved UET workbook fixtures before dataset publication; run browser network/security evidence in M3/M4; do not treat synthetic fixtures as real-source coverage.

## Amendment 2026-10-25 — browser entry point (AUD-009)

Source: [audit M0–M2](../evidence/M0-M2-AUDIT-2026-10-25.md). The package root `@ky-nay/parser` re-exports the adapter registry, which imports the `uet-xlsx` and `canonical-jsonl` adapters; both use `node:crypto` and are intended for the local admin pipeline (ADR-0007). Browser code (M4 registration import) must import `@ky-nay/parser/registration`, which exposes only `vnu-registration-html`. A test walks that entry's module graph, including `@ky-nay/domain`, and fails on any Node built-in import. Moving `uet-xlsx` into the browser would need a separate decision on synchronous hashing.

## Amendment 2026-10-29 — registration adapter 0.2.0 from the C-09 sample (AUD-002)

Source: [REVIEW-C09-001](../evidence/C09-REGISTRATION-SAMPLE-REVIEW.md). Adapter 0.1.0 rejected a real portal export (unknown `Mã môn học`/`Lớp môn học` headers) and multiplied days by period ranges. `vnu-registration-html@0.2.0`:

1. adds the header synonyms `ma mon hoc`, `lop mon hoc`, `mon hoc`;
2. pairs days, period ranges and rooms by position, shares a single day/range/room, and skips a row whose counts cannot be paired (`REGISTRATION_OVERRIDE_UNMATCHED`, `field=periodText`);
3. splits concatenated rooms only when exactly one segmentation exists, otherwise keeps the timetable rooms (`field=room` warning);
4. rebuilds the section id from the normalized course code (`AAA 9999 9` → `AAA9999 9`) and skips summary rows without course and section.

Output shape is unchanged (`Section`/`Session` schema `0.2.0`, `localOnly` artifact, no hash, no identity fields); only `parserVersion` changes. Rollback: revert to 0.1.0, which cannot read the real export. Re-entry: G1 acknowledgement and G3a/G3b for the registration adapter.
