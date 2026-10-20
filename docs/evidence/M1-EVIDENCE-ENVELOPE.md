# M1 evidence envelope

> **Artifact ID:** `EVID-M1-001`
> **Artifact status:** `needs_review`
> **Canonical gate/sub-gate:** `G1 + G2 + G3a/G3b preliminary`
> **Owner:** Tech Lead + Data Parser
> **Last reviewed:** 2026-10-20
> **Related docs:** [Implementation plan](../IMPLEMENTATION_PLAN.md), [M1 design handoff](M1-DESIGN-HANDOFF.md), [M1 implementation handoff](M1-IMPLEMENTATION-HANDOFF.md), [M1 test report](M1-TEST-REPORT.md), [M1 security review](M1-SECURITY-REVIEW.md), [ADR-0008](../adr/ADR-0008-m1-parser-dependencies-local-provenance.md)
> **Decision actor / UTC timestamp:** `N/A — no independent gate approver recorded`
> **Receiving owner / acknowledgement:** Tech Lead, Tester, Security Reviewer, Data Reviewer and Independent Reviewer — pending

## Source and traceability

- Source docs/sections: `IMPLEMENTATION_PLAN.md` M1; `PARSER_SPEC.md` §§2–9/11; `DOMAIN_MODEL.md` §§2–5; `SECURITY_PRIVACY.md` §§2–6; `QA_TEST_PLAN.md` §§3–5/7; `TECH_STACK.md` §8.
- Source version/hash: `N/A — uncommitted working tree`; local files are the current source of truth.
- Requirement/AC/P0 traceability: M1 parser slice covers FR-01/FR-05 and parser/privacy portions of FR-09/FR-10; all product P0 remains `no` until M2–M5.
- Related ADR/design/handoff: ADR-0008, DESIGN-M1-001, IMPL-M1-001, TEST-M1-001, SEC-REVIEW-M1-001.

## Immutable execution identity

- Commit/PR/diff ID: `N/A — no commit/PR created`.
- Build/run IDs: `N/A — local shell runs; remote CI not executed`.
- Toolchain: Node `>=20`; TypeScript `5.9.3`; `fflate@0.8.3`; `@xmldom/xmldom@0.9.12`.
- Exact commands and observed exit codes:
  - `npm run lint` — `0`.
  - `npm run typecheck` — `0`.
  - `npm test` — `0`; `28/28` tests pass.
  - `npm run fixtures:run` — `0`; `5/5` fixture entries pass.
  - `npm run check` — `0` after alias/contract updates.
  - `npm audit --omit=dev` — `0`; `0 vulnerabilities`.
  - `git diff --check` — `0`; no whitespace errors (line-ending warnings only).

## Data and artefact integrity

- Fixture manifests/hashes:
  - `fixtures/synthetic-uet-xlsx/manifest.json`: `hk1-row1.xlsx` = `28165264a93cc29635ef50bd1672fa997b3f66b2b1bc43c7812bfc9a6f1e46f8`; `hk2-row4.xlsx` = `e4417afe7d5c77d99d0c0ffd9d7268f3e43bc5b7f159dd324b161513531fa550`.
  - Existing smoke/adversarial manifests retain their declared synthetic hashes; registration manifest intentionally omits input hash.
- Approved source/input hash: `N/A — no real UET or student registration source committed`.
- Output/artifact hash: `N/A — no public dataset/publish artifact`.
- Schema/parser versions: schema `0.1.0`; parser adapters `0.1.0`; fixture manifest `1`.
- Compatibility: additive local-only artifact provenance; no persisted data or migration.

## Evidence links and results

| Evidence | Check | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| `npm run check` | M1 local regression | all package checks pass | exit 0 | pass locally |
| `M1-TEST-REPORT.md` | G3a matrix | parser/fixture cases recorded | 28 tests, 5 fixtures | ready for Tester |
| `M1-SECURITY-REVIEW.md` | G1/G3b controls | local boundary reviewed; gaps explicit | no-network/local checks pass; browser/real-source gaps open | pending Security |
| `fixtures/synthetic-uet-xlsx/manifest.json` | binary golden path | declared hash/counts match | 2/2 UET entries pass | pass locally |
| `fixtures/synthetic-registration/manifest.json` | local registration | no input hash; safe candidate counts | 2 sections/5 sessions; no hash | pass locally |
| `npm audit --omit=dev` | dependency audit | no production vulnerabilities | 0 vulnerabilities | pass locally |

## Risk and controls

- Privacy/security boundary: registration bytes stay in the parser call; adapter output has no raw HTML, identity, hash or user filename. Timetable source hash remains for approved non-PII provenance.
- Findings: SEC-M1-001/002/003 S2 follow-ups and SEC-M1-004 process pending; no S0/S1 is known from local checks.
- Waiver/exception: `none`; S2 items are not accepted for release.
- Rollback: remove M1 adapters/fixtures/docs and restore pre-M1 contract; no user data/public artifact is affected.
- Monitoring/canary: `N/A — no runtime or publication`.

## Decision and next step

- Recommendation: `ready-for-verification`; local M1 implementation evidence is green but the gate is not approved.
- Conditions: independent Tester/Security/Reviewer acknowledgement; approved real UET fixture; browser network evidence when app exists; broader OOXML hostile-input tests before production parser freeze.
- Next owners: Tester (G3a), Security Reviewer (G3b), Independent Reviewer (G3c), Tech Lead (gate decision), Data Reviewer (real-source validation).
- Notes: M2 is intentionally not implemented. No M1 publish/release claim is made.
