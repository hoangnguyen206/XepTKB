# M4 evidence envelope — Registration merge UI

> **Artifact ID:** `EVID-M4-001`  
> **Artifact status:** `in_progress` — G0/G1/G2 authored and automated checks passing; awaiting independent G3a/G3b/G3c verification and human Owner gate approval  
> **Canonical gate/sub-gate:** `G0 | G1 | G2 | G3a | G3b | G3c`  
> **Owner:** Tech Lead + Release Manager  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [M4 spec](M4-SPEC.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [M4 design handoff](M4-DESIGN-HANDOFF.md), [M4 implementation handoff](M4-IMPLEMENTATION-HANDOFF.md)  
> **Decision actor / UTC timestamp:** `pending` (awaiting G3a/G3b/G3c completion and human Owner sign-off)  
> **Receiving owner / acknowledgement:** Product (`G0`), Tech Lead + Security (`G1`), Tester (`G3a`), Security Reviewer (`G3b`), Independent Reviewer (`G3c`)

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
- Related ADR/design/spec/handoff IDs:
  - `SPEC-M4-001`: [`docs/evidence/M4-SPEC.md`](M4-SPEC.md)
  - `ADR-0013`: [`docs/adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md)
  - `DESIGN-M4-001`: [`docs/evidence/M4-DESIGN-HANDOFF.md`](M4-DESIGN-HANDOFF.md)
  - `IMPL-M4-001`: [`docs/evidence/M4-IMPLEMENTATION-HANDOFF.md`](M4-IMPLEMENTATION-HANDOFF.md)

## Immutable execution identity

- Branch: `m4-registration-ui` (branched from `main` @ `3c34c89`).
- Toolchain versions: Node `22.22.2`, npm `12.0.2`, TypeScript `5.9.3`, Vite `8.3.4`, Vitest `5.0.3`, Playwright `1.64.0`.
- Exact commands + exit codes (2026-11-06):
  - `npm run check` → exit `0` (`lint` passed, `typecheck` passed, `node:test` `102/102`, `vitest` `65/65`, `fixtures:run` `6/6`, `node scripts/dataset.mjs check` `0 datasets`).
  - `npm run test:e2e` → exit `0` (Playwright Chromium `19/19` passed).

## Data and artefact integrity

- Fixture manifest: [`fixtures/manifest.json`](../../fixtures/manifest.json)
  - `registration-portal-format-redacted` (`fixtures/redacted-registration/portal-format.doc`): sha256 `4937d9964e2c64112e58b8bf753c5966a55f3982dfdb4cf0f46b7d484d959fb4`
  - `registration-local-synthetic` (`fixtures/synthetic/registration-local.html`): sha256 `357da7470b18dd26386c16bdcc5537c213fd9e3b875645e29cb5b19b2651f8c3`
- Dataset/schema/parser version: domain schema `0.2.0`, Plan storage envelope `1.0.0`, registration parser `vnu-registration-html@0.1.0`.
- Compatibility/migration note: Backward-compatible with all M3 IndexedDB `draft` Plans and `Settings`.

## Evidence links and results

| Evidence ID/link | Check | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| [`SPEC-M4-001`](M4-SPEC.md) | `G0` M4 specification (`AC-M4-01..08`, `D-M4-1..3`) | Complete spec covering `FR-09`, `FR-10`, `AC-04`, `AC-05`, `Q-005`, `Q-007` | Authored (`in-review`, awaiting human Owner `G0` sign-off) | `in-review` |
| [`ADR-0013`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) & [`DESIGN-M4-001`](M4-DESIGN-HANDOFF.md) | `G1` architecture, privacy boundary & threat review | Local-only boundary, `resolvePlanPicks` override application, 2-slot storage design | Authored (`in-review`, awaiting human Owner `G1` sign-off) | `in-review` |
| [`IMPL-M4-001`](M4-IMPLEMENTATION-HANDOFF.md) | `G2` implementation + automated test suites | `npm run check` exit `0`, `npm run test:e2e` exit `0` | `102/102` node tests, `65/65` Vitest, `6/6` fixtures, `19/19` E2E passed | `ready-for-verification` |
| `TEST-M4-001` (`docs/evidence/M4-G3a-QA-REPORT.md`) | `G3a` independent QA verification | Verify `AC-M4-01..08`, `AC-04`, `AC-05` | Pending subagent execution | `pending` |
| `SEC-REVIEW-M4-001` (`docs/evidence/M4-G3b-SECURITY-REVIEW.md`) | `G3b` independent security & privacy review | Verify zero network/PII leakage (`AC-04`), XSS/file parser hardening | Pending subagent execution | `pending` |
| `REVIEW-M4-001` (`docs/evidence/M4-G3c-INDEPENDENT-REVIEW.md`) | `G3c` independent code & architecture review | Verify domain/export/web implementation and G3a/G3b synthesis | Pending subagent execution | `pending` |

## Risk and controls

- Privacy/security impact and boundary: High-sensitivity boundary (`AC-04` student registration `.doc`/`.html` containing PII in the raw file). Enforced via in-memory `vnuRegistrationHtmlAdapter.parse` (`localOnly: true`), magic-byte/size guards (`<= 2 MiB`), immediate input clearing, no network capability outside `apps/web/src/data/loader.ts` (enforced by `scripts/lint.mjs` and verified by Playwright network interception), and zero PII in DOM/IndexedDB/console/exports.
- Findings (ID/severity/status): Pending `G3a`/`G3b`/`G3c`.
- Waiver/exception: `none` (inherited M3 S3 exceptions `EXC-SEC-M3-R2-B/C/D` remain tracked under `EVID-M3-001` with expiry `2026-11-08`).
- Rollback/migration trigger and target: Revert M4 merge commit on `main` if any `S0`/`S1` defect is found.

## Decision and next step

- Recommendation/gate decision: `in_progress` — ready for parallel `G3a` (QA), `G3b` (Security), and `G3c` (Independent Review) verification.
- Next owner action: Run `G3a`, `G3b`, `G3c` subagents on `m4-registration-ui`, resolve any findings, and present `G0`/`G1`/`G3` artifacts to Owner for approval.
