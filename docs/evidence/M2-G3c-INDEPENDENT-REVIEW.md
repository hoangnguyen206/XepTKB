# Review — M2 domain engine G3c independent review

> **Artifact ID:** `REVIEW-M2-001`  
> **Artifact status:** `ready`  
> **Canonical gate:** `G3c`  
> **Owner:** Independent Reviewer  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [Implementation plan](../IMPLEMENTATION_PLAN.md), [Domain model](../DOMAIN_MODEL.md), [PRD](../PRD.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md), [M2 G3a QA report](M2-G3a-QA-REPORT.md), [M2 G3b security review](M2-G3b-SECURITY-REVIEW.md)  
> **Evidence envelope:** [EVID-M2-002](M2-EVIDENCE-ENVELOPE-v2.md)  
> **Independent reviewer / approval UTC timestamp:** Agent (Independent Reviewer role) / 2026-10-24T18:30:00Z  
> **Re-entry (2026-10-25):** reopened bởi [REVIEW-M0M2-AUDIT-001](M0-M2-AUDIT-2026-10-25.md): registration merge dựng Plan chính thức từ nháp (AUD-001), override cũ thắng khi import lại (AUD-008), cùng các finding parser AUD-002…007. Quyết định bên dưới không còn hiệu lực cho tới khi chạy lại G3c.

## Scope and identity

- Review type: correctness / architecture / parser regression / maintainability.
- Source spec/ADR/PRD: `IMPLEMENTATION_PLAN.md` M2; `DOMAIN_MODEL.md` §§2–8; `PRD.md` FR-02–FR-10/AC-01/AC-05/AC-06; ADR-0009.
- Base commit: `61ee300`.
- Target commit: `7faccaf`.
- Dataset/parser/schema: schema `0.2.0`; synthetic fixtures; M1 parser regression preserved.
- Tested commands: `npm run check` exit 0 (lint + typecheck + 54/54 tests + 5/5 fixtures); `npm audit --omit=dev` exit 0.
- Requirement/AC/P0 coverage: M2 domain slice covered; product P0 `no` until M3–M5.

## Verdict

**`review-pass-with-follow-up`**

The M2 domain engine implementation is **correct, well-structured and consistent** with the documented contracts. All M2 requirements have corresponding test coverage. No S0/S1 issues found. Follow-up items are all S2/process, with identified owners.

## Structured checks

| Check | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| **Correctness/domain invariants** | Contract holds per DOMAIN_MODEL §§2–8 | Session union type correctly discriminates fixed/non-fixed; conflict engine handles period intersection + week intersection + day match; ONL exclusion works; campus warning is separate from hard conflict; week1 resolution fails closed on ambiguity; registration merge is field-level and immutable | **pass** |
| **Parser/data provenance** | Deterministic/traceable | `SourceRef` on every Session and Section; `weekOrigin` tracks explicit vs parser-default vs registration-default; `Override.source` and `reason` provide full provenance chain; validator enforces `localOnly`/no-hash/no-filename for registration | **pass** |
| **Scope/contract/migration** | No silent drift | Schema bumped from `0.1.0` to `0.2.0`; ADR-0009 documents all type changes, migration rules and alternatives rejected; existing M1 tests and fixtures all pass (54/54, 5/5); fixture manifests updated to `0.2.0` | **pass** |
| **Privacy/security boundary** | No unsafe crossing | Domain packages have zero I/O, zero network, zero storage, zero dynamic eval; registration merge consumes `Section[]` objects not raw bytes; `DomainIssue.rawValue` comment warns against PII; `ImportArtifact` validator enforces privacy contract | **pass** |
| **Performance/maintainability** | Thresholds/design reasonable | 54 tests complete in ~390ms; O(n²) conflict loop is acceptable for typical Plan size (5–10 sections, ~20 sessions); search index is linear scan with limit cap; pure functional style with immutable inputs | **pass** |
| **Tests/docs/observability** | Evidence complete | 54 Node tests + 5 synthetic fixtures; lint + typecheck + audit clean; 13 evidence documents in `docs/evidence/`; ADR-0009 records decisions; IMPLEMENTATION_PLAN §2 checkpoint updated | **pass** |

## Detailed code review findings

### Architecture assessment

The domain engine is well-separated into focused modules:

1. **`types.ts`** — Clean type system with discriminated union for Session (fixed/non-fixed). `isFixedSession()` type guard is correct. `SCHEMA_VERSION` constant enables migration checks.

2. **`normalize.ts`** — Unicode normalization (NFD→strip→lowercase for search, NFC for codes) is correct for Vietnamese text. The `normalizeGroup()` function correctly handles "Cả lớp"/"CL" and "Nhóm X" patterns. `buildCourseCodeAliases()` detects collisions rather than silently choosing first-wins.

3. **`search.ts`** — Deterministic ranking (0=exact code, 1=exact section, 2=code prefix, 3=name match, 4=name substring, 5=section substring). Empty query short-circuits to `[]`. Index is immutable after build. Limit defaults to 50 with floor guard.

4. **`conflict.ts`** — Correctly implements `day × inclusive period range × week intersection`. The `periodsOverlap` function uses `Math.max(start) <= Math.min(end)` which is the standard inclusive range overlap check. `weeksIntersect` uses set intersection. Canonical pair ordering via `compareRefs` ensures no duplicate reports. Non-fixed sessions are correctly excluded.

5. **`plan.ts`** — Plan factory creates deterministic `createdAt`/`updatedAt` from caller-provided `now` (no `new Date()` in domain). Group resolution filters sessions correctly: CL sessions always included, requested group filters non-CL. Duplicate course detection via normalized code.

6. **`week-date.ts`** — Uses `Date.UTC()` only for civil date arithmetic — no host timezone involvement. Round-trip validation `(year/month/day → Date → check getUTCFullYear/Month/Date)` catches invalid dates like Feb 30. `dateFor` offset calculation `(week-1)*7 + (day-2)` is correct for T2(Monday)=0 offset.

7. **`registration-merge.ts`** — Most complex module (272 lines). Key correctness properties verified:
   - `mergeRegistration` never mutates input `catalog.sections` or draft `plan`.
   - `cloneSession` creates deep-enough copies (arrays spread, source spread).
   - `candidateSessions` uses progressive narrowing (kind→group→day→periods) and fails closed if 0 or >1 candidates.
   - `overridesForPair` validates every field value before applying.
   - TH default weeks `[2..teachingWeeks]` only applied when `weekOrigin === "parser-default"`.
   - Final Plan is a new object; draft Plan is preserved unmodified.
   - Override precedence: `registration:1 < admin-correction:2 < user:3`.

8. **`credits.ts`** — Counts each course once via normalized code set. Uses integer-cent arithmetic (`Math.round(value * 100)`) to avoid floating point issues. Unknown credits explicitly tracked and reported.

### Cross-platform patch review (`7faccaf`)

The `normalizeCrlf` function in `runner.ts`:
- Correctly strips only `\r` before `\n` (not standalone `\r`).
- Uses a fast path `buf.includes(0x0d)` to avoid unnecessary work.
- Applies normalization only to the hash computation path; raw bytes are still passed to `adapter.parse()`, preserving parser behavior.
- `.gitattributes` ensures fixture JSON/doc files use LF at checkout, providing a secondary defense.

## Findings

### `REV-M2-001` — [S2] `Override.from typed as unknown limits compile-time validation`

- **File/line:** `packages/domain/src/types.ts` L129
- **Failure scenario:** `Override.from` is `unknown`; callers must manually narrow the type when reading `from` values.
- **Expected / actual:** A union type mapping `OverrideField` to value types would provide compile-time safety. Current approach is safe at runtime due to `fieldValue()` extracting correctly, but `from` is never validated.
- **Impact:** Low — `from` is purely informational/audit trail; never used for computation. Risk is incorrect display in future UI.
- **Evidence:** Code review.
- **Recommended fix:** Add a `FieldValueMap` type mapping in M3 when UI consumes overrides.
- **Owner / status / due:** Tech Lead / open / M3.

### `REV-M2-002` — [S2] `O(n²) conflict detection may be slow for very large Plans`

- **File/line:** `packages/domain/src/conflict.ts` L125–133
- **Failure scenario:** If a Plan somehow contains >50 sections (unlikely for UET students), conflict detection could become slow.
- **Expected / actual:** Typical Plan has 5–10 sections with ~2 sessions each ≈ 20 sessions → 190 comparisons. Even 50 sections × 3 sessions = 150 sessions → ~11,000 comparisons — still fast.
- **Impact:** Negligible for MVP. No performance budget defined for M2.
- **Evidence:** ~390ms total for 54 tests including conflict tests.
- **Recommended fix:** No action needed for MVP. Add performance benchmark in M3 if needed.
- **Owner / status / due:** Tech Lead / informational / M3.

### `REV-M2-003` — [S2] `equalField uses JSON.stringify for deep comparison`

- **File/line:** `packages/domain/src/registration-merge.ts` L75–78
- **Failure scenario:** `JSON.stringify` comparison is order-dependent for objects. If an override value has properties in different order, comparison would fail.
- **Expected / actual:** Currently safe because `fieldValue()` constructs objects deterministically (`{startPeriod, endPeriod}`) and arrays (`lecturers`) are simple string arrays. No user-provided arbitrary objects reach this path.
- **Impact:** Low — would only matter if field value construction changed.
- **Recommended fix:** Consider `structuredClone`-based comparison or explicit field comparison if object shapes become more complex.
- **Owner / status / due:** Tech Lead / informational / deferred.

## Waivers and limitations

- Waiver/exception: none. No S0/S1.
- Limitations: review covers package source code only; no browser/E2E/persistence/real-source validation performed (correctly deferred per M2 scope).
- S2 findings are informational/maintainability observations, not correctness issues.

## Approval and re-review

- Reviewer decision: **`review-pass-with-follow-up`** for M2 domain engine package implementation.
- Actor/date/evidence: Agent (Independent Reviewer role) / 2026-10-24T18:30:00Z / commit `7faccaf`, code review of all 12 changed source files + 45 changed files in M2 commit.
- Next owner/action: Tech Lead acknowledge G3c decision; proceed to M3 planning.
- Follow-up: REV-M2-001..003 are S2 informational; do not block M2 or M3 entry.
- Re-review trigger: contract/schema/privacy boundary change reopens G3c.
