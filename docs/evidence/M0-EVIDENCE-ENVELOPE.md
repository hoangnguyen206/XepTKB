# M0 evidence envelope

> **Artifact ID:** `EVID-M0-001`
> **Artifact status:** `needs_review`
> **Canonical gate/sub-gate:** `G0 + G1`
> **Owner:** Tech Lead
> **Last reviewed:** 2026-10-20
> **Related docs:** [Implementation plan](../IMPLEMENTATION_PLAN.md), [ADR-0001](../adr/ADR-0001-react-vite-monorepo.md), [Security review](M0-G1-threat-data-flow.md), [Implementation handoff](M0-IMPLEMENTATION-HANDOFF.md)
> **Decision actor / UTC timestamp:** `N/A — no gate approver recorded in this session`
> **Receiving owner / acknowledgement:** Product, Tech Lead, Security Reviewer, Tester, Independent Reviewer — pending

## Source and traceability

- Source docs/sections: `docs/README.md`, `PRD.md`, `IMPLEMENTATION_PLAN.md` §2/§10, `TECH_STACK.md`, `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `PARSER_SPEC.md`, `SECURITY_PRIVACY.md`, `QA_TEST_PLAN.md`, `.claude/AGENT_WORKFLOW.md`.
- Source version or SHA-256: `N/A — current working tree is uncommitted`.
- PRD requirement IDs / AC IDs: M0 establishes prerequisites for FR-01–FR-12 and AC-01–AC-07; it does not implement product P0 behavior.
- P0 completeness claim: `no — M0 only; product P0 requires M1–M5`.
- Related ADR/design/spec/handoff IDs: ADR-0001, ADR-0006, ADR-0007, IMPL-M0-001.

## Immutable execution identity

- Commit/PR/diff ID: `N/A — uncommitted working tree`.
- Build ID: `N/A — local build only`.
- Test/import/review run IDs: `N/A — local shell runs; no CI run ID`.
- Toolchain versions: TypeScript `5.9.3` and Node types `22.19.17` from lockfile; Node `>=20` required.
- Exact commands + exit codes:
  - `npm run check` — exit `0`.
  - Result: lint passed, typecheck/build passed, 17 tests passed, 2/2 synthetic fixture entries passed.

## Data and artefact integrity

- Fixture manifest + hash: `fixtures/smoke/manifest.json` and `fixtures/synthetic-adversarial/manifest.json`; synthetic only; each declared input SHA-256 is verified by the fixture runner, while the manifest file hash is not recorded.
- Input/source hash: `N/A — no real source input`.
- Output/artifact/manifest hash: `N/A — no public dataset artifact`.
- Dataset/schema/parser version: schema `0.1.0`, adapter `0.1.0`, manifest `1`.
- Compatibility/migration note: no persisted user data or public API migration; new runtime boundary reopens G1.

## Evidence links and results

| Evidence ID/link | Check | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| `npm run check` | M0 local check | all stages exit 0 | all stages passed | pass locally |
| `M0-FIXTURE-POLICY.md` | fixture privacy boundary | synthetic/redacted only | two synthetic families committed; private paths ignored | pass by inspection |
| `M0-G1-threat-data-flow.md` | M0 threat/data-flow | no new runtime PII/network boundary | no app/backend/registration input in M0 | design pass pending acknowledgement |
| `.github/workflows/m0-foundation.yml` | CI reproducibility | `npm ci` then `npm run check` | workflow defined; remote run not observed | pending |

## Risk and controls

- Privacy/security impact and boundary: repository/CI only; no student file, credential, network or external vendor in M0.
- Findings: `SEC-M0-001` S2 limitation — lightweight lint is not full security tooling; follow-up at M1/M3/M4.
- Waiver/exception: `none`.
- Rollback/migration trigger and target: revert M0 foundation changes if contract is rejected; no deployed artifact exists.
- Monitoring/canary/alert evidence: `N/A — no production runtime`.

## Decision and next step

- Recommendation/gate decision: `g0/g1 ready-for-verification`; not approved in this session.
- Conditions/follow-up owner + due date: Product/Tech Lead approve scope/ADR; Security acknowledge threat review; Tester and Independent Reviewer inspect the diff; repository host runs CI.
- Next owner action: record gate decisions with actor/date/evidence, then start M1 only after M0 G0+G1 are approved.
- Notes: no real source, PII, secret, fake run ID or fabricated sign-off is included.
