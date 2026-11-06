# M4 evidence envelope — Registration merge UI

> **Artifact ID:** `EVID-M4-001`  
> **Artifact status:** `ready` (`approved` by Owner at `2026-11-06T07:30Z`) — G0/G1/G2 authored, independent G3a/G3b/G3c R1 (`12abdbd`) + R1.1 (`6fd1506`) completed (`qa-pass`, `security-pass-with-exception`, `review-approved`), and formally signed off by Owner  
> **Canonical gate/sub-gate:** `G0 | G1 | G2 | G3a | G3b | G3c`  
> **Owner:** Tech Lead + Release Manager  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [M4 spec](M4-SPEC.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [M4 design handoff](M4-DESIGN-HANDOFF.md), [M4 implementation handoff](M4-IMPLEMENTATION-HANDOFF.md), [M4 G3a QA report](M4-G3a-QA-REPORT.md), [M4 G3b security review](M4-G3b-SECURITY-REVIEW.md), [M4 G3c independent review](M4-G3c-INDEPENDENT-REVIEW.md)  
> **Decision actor / UTC timestamp:** Approved by Owner (Product / Tech Lead / Security / Release Manager) at `2026-11-06T07:30Z`  
> **Receiving owner / acknowledgement:** Product (`G0`), Tech Lead + Security (`G1`), Tester (`G3a`), Security Reviewer (`G3b`), Independent Reviewer (`G3c`), Owner (`2026-11-06T07:30Z`)

## Source and traceability

- Source docs/sections:
  - [`docs/PRD.md`](../PRD.md) §4 (#7, #9, #10), §7 (`FR-09`, `FR-10`, `NFR-03`), §9 (`AC-04`, `AC-05`)
  - [`docs/IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) §2 (`M4 — Registration merge UI`), §4 step 8
  - [`docs/DOMAIN_MODEL.md`](../DOMAIN_MODEL.md) §3 (`Plan`, `PlanOverride`, `OverrideSource`)
  - [`docs/PARSER_SPEC.md`](../PARSER_SPEC.md) §1 (`vnu-registration-html`)
  - [`docs/SECURITY_PRIVACY.md`](../SECURITY_PRIVACY.md) §1 (`#2`, `#8`), §2, §5 (`G3b`)
  - [`docs/QA_TEST_PLAN.md`](../QA_TEST_PLAN.md) §2 (`AC-04`, `AC-05`), §6 (`G3a`)
- Base commit: `3c34c89` (`main`).
- PRD requirement IDs / AC IDs: `FR-09`, `FR-10`, `NFR-03`, `AC-04`, `AC-05` (`AC-M4-01`..`AC-M4-08`).
- P0 completeness claim: `yes` for the M4 slice (`FR-09`, `FR-10`, `AC-04`, `AC-05`); product-wide P0 overall awaits M5 release gates (`G4a/G4b/G5`).
- Related ADR/design/spec/handoff/G3 IDs:
  - `SPEC-M4-001`: [`docs/evidence/M4-SPEC.md`](M4-SPEC.md)
  - `ADR-0013`: [`docs/adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md)
  - `DESIGN-M4-001`: [`docs/evidence/M4-DESIGN-HANDOFF.md`](M4-DESIGN-HANDOFF.md)
  - `IMPL-M4-001`: [`docs/evidence/M4-IMPLEMENTATION-HANDOFF.md`](M4-IMPLEMENTATION-HANDOFF.md)
  - `TEST-M4-001`: [`docs/evidence/M4-G3a-QA-REPORT.md`](M4-G3a-QA-REPORT.md)
  - `SEC-REVIEW-M4-001`: [`docs/evidence/M4-G3b-SECURITY-REVIEW.md`](M4-G3b-SECURITY-REVIEW.md)
  - `REVIEW-M4-001`: [`docs/evidence/M4-G3c-INDEPENDENT-REVIEW.md`](M4-G3c-INDEPENDENT-REVIEW.md)

## Immutable execution identity

- Branch: `m4-registration-ui` (branched from `main` @ `3c34c89`).
- Target commits:
  - Initial G2 handoff commit (`R1`): `12abdbd`
  - G3 fix round commit (`R1.1`): `6fd1506`
- Toolchain versions: Node `22.22.2`, npm `12.0.2`, TypeScript `5.9.3`, Vite `8.3.4`, Vitest `5.0.3`, Playwright `1.64.0`.
- Exact commands + exit codes (2026-11-06 on `6fd1506`):
  - `npm run check` → exit `0` (`lint` passed, `typecheck` passed, `node:test` `102/102`, `vitest` `68/68`, `fixtures:run` `6/6`, `node scripts/dataset.mjs check` `0 datasets`).
  - `npm run test:e2e` → exit `0` (Playwright Chromium `19/19` passed).
  - `npm audit` & `npm audit --omit=dev` → `0 vulnerabilities`.

## Data and artefact integrity

- Fixture manifest: [`fixtures/manifest.json`](../../fixtures/manifest.json)
  - `registration-portal-format-redacted` (`fixtures/redacted-registration/portal-format.doc`): sha256 `4937d9964e2c64112e58b8bf753c5966a55f3982dfdb4cf0f46b7d484d959fb4`
  - `registration-local-synthetic` (`fixtures/synthetic/registration-local.html`): sha256 `357da7470b18dd26386c16bdcc5537c213fd9e3b875645e29cb5b19b2651f8c3`
- Dataset/schema/parser version: domain schema `0.2.0`, Plan storage envelope `0.2.0`, registration parser `vnu-registration-html@0.2.0`.
- Compatibility/migration note: Backward-compatible with all M3 IndexedDB `draft` Plans and `Settings`.

## Evidence links and results

| Evidence ID/link | Check | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| [`SPEC-M4-001`](M4-SPEC.md) | `G0` M4 specification (`AC-M4-01..08`, `D-M4-1..3`) | Complete spec covering `FR-09`, `FR-10`, `AC-04`, `AC-05`, `Q-005`, `Q-007` | Approved by Owner (`2026-11-06T07:30Z`) | `g0-approved` |
| [`ADR-0013`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) & [`DESIGN-M4-001`](M4-DESIGN-HANDOFF.md) | `G1` architecture, privacy boundary & threat review | Local-only boundary, `resolvePlanPicks` override application, 2-slot storage design | Approved by Owner (`2026-11-06T07:30Z`) | `g1-approved` |
| [`IMPL-M4-001`](M4-IMPLEMENTATION-HANDOFF.md) | `G2` implementation + automated test suites | `npm run check` exit `0`, `npm run test:e2e` exit `0` | `102/102` node tests, `68/68` Vitest, `6/6` fixtures, `19/19` E2E passed (`6fd1506`) | `ready-for-verification` |
| [`TEST-M4-001`](M4-G3a-QA-REPORT.md) | `G3a` independent QA verification (`R1` + `R1.1` @ `6fd1506`) | Verify `AC-M4-01..08`, `AC-04`, `AC-05`, zero open defects | `0` S0/S1/S2/S3 open (`QA-M4-001..003` `verified-fixed`), approved by Owner (`2026-11-06T07:30Z`) | `qa-pass` |
| [`SEC-REVIEW-M4-001`](M4-G3b-SECURITY-REVIEW.md) | `G3b` independent security & privacy review (`R1` + `R1.1` @ `6fd1506`) | Verify zero network/PII leakage (`AC-04`), XSS/file parser hardening | `0` S0/S1/S2/S3 open for M4 (`SEC-M4-001` `verified-fixed`; 3 inherited M3 S3 exceptions tracked for M5), approved by Owner (`2026-11-06T07:30Z`) | `security-pass-with-exception` |
| [`REVIEW-M4-001`](M4-G3c-INDEPENDENT-REVIEW.md) | `G3c` independent code & architecture review (`R1` + `R1.1` @ `6fd1506`) | Verify domain/export/web implementation and G3a/G3b synthesis | `0` S0/S1/S2/S3 open (`REV-M4-001..004` + `SEC-M4-001` `verified-fixed`), approved by Owner (`2026-11-06T07:30Z`) | `review-approved` |

## Findings ledger (M4 G3 R1 `12abdbd` → R1.1 `6fd1506`)

| # | ID | Severity | Summary | Resolution at `6fd1506` | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `QA-M4-001` / `REV-M4-001` | `S2` | `rebasePlan` matched `session.id === override.target.sessionId` literally, which could drop overrides if a new `.xlsx` version shifted `sourceRow` | Added `findOverrideTargetSession` in `packages/domain/src/registration-merge.ts` + `resolveOverrideTargets` and `droppedOverrides` warning in `apps/web/src/model/plan-view.ts` & `PlanSummary.tsx` + regression test | `verified-fixed` |
| 2 | `QA-M4-002` / `REV-M4-002` | `S3` | `renderPng` drew overridden sessions at their new time/room but did not draw override badge/detail text on the canvas block | Updated `apps/web/src/export/png.ts` to draw `★ ${overrideBadges}` and `from → to` details + added unit test in `png.test.ts` | `verified-fixed` |
| 3 | `QA-M4-003` / `REV-M4-003` | `S3` | `RegistrationImport.tsx` `catch` did not clear prior `preview`; `controller.ts` called `updateSettings` outside `saveChainRef`; missing UI tests for re-import button & in-app browser banner | Cleared `setPreview(undefined)` in `catch`, serialized `updateSettings` in `saveChainRef.current`, added UI tests in `m4-registration.test.tsx` | `verified-fixed` |
| 4 | `REV-M4-004` | `S3` | `M4-IMPLEMENTATION-HANDOFF.md` & `M4-EVIDENCE-ENVELOPE.md` listed `Plan storage envelope 1.0.0` and `vnu-registration-html@0.1.0` instead of `0.2.0` | Updated both docs to `0.2.0` | `verified-fixed` |
| 5 | `SEC-M4-001` | `S3` | `splitRooms` in `vnu-registration-html-adapter.ts` had no length cap before backtracking (`O(L^2)` on oversized room strings) and table picker selected first table with `>= 1` synonym | Added `MAX_ROOM_TEXT_LENGTH = 128` in `splitRooms` and preferred candidate table matching all 5 `REQUIRED_COLUMNS` + regression test | `verified-fixed` |

## Risk and controls

- Privacy/security impact and boundary: High-sensitivity boundary (`AC-04` student registration `.doc`/`.html` containing PII in the raw file). Enforced via in-memory `vnuRegistrationHtmlAdapter.parse` (`localOnly: true`), magic-byte/size guards (`<= 2 MiB`), immediate input clearing, no network capability outside `apps/web/src/data/loader.ts` (enforced by `scripts/lint.mjs` and verified by Playwright network interception), and zero PII in DOM/IndexedDB/console/exports.
- Findings (ID/severity/status): `5/5` M4 findings (`1 S2`, `4 S3`) are `verified-fixed` at `6fd1506` (`0` open M4 findings).
- Waiver/exception: `none` new in M4 (inherited M3 S3 exceptions `EXC-SEC-M3-R2-B/C/D` remain tracked under `EVID-M3-001` with expiry `2026-11-08` for M5 `G4a`/`G4b`).
- Rollback/migration trigger and target: Revert M4 merge commit on `main` if any `S0`/`S1` defect is found; existing `draft` Plans remain readable.

## Decision and next step

- Recommendation/gate decision: **Approved by Owner (`2026-11-06T07:30Z`)**
  - `G0`: **`g0-approved`** (`SPEC-M4-001`)
  - `G1`: **`g1-approved`** (`ADR-0013`, `DESIGN-M4-001`)
  - `G3a`: **`qa-pass`** (`TEST-M4-001`)
  - `G3b`: **`security-pass-with-exception`** (`SEC-REVIEW-M4-001`, `0` M4 findings open)
  - `G3c`: **`review-approved`** (`REVIEW-M4-001`)
- Next owner action: Merge `m4-registration-ui` into `main` and proceed to M5 release readiness (`G4a/G4b/G5`).
