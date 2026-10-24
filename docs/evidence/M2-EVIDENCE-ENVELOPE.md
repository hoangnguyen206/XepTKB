# M2 evidence envelope

> **Artifact ID:** `EVID-M2-001`
> **Artifact status:** `needs_review`
> **Canonical gate/sub-gate:** `G1 + G2 + G3a preliminary`
> **Owner:** Tech Lead + Coder
> **Last reviewed:** 2026-10-20
> **Related docs:** [M2 design handoff](M2-DESIGN-HANDOFF.md), [M2 implementation handoff](M2-IMPLEMENTATION-HANDOFF.md), [M2 test report](M2-TEST-REPORT.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md)
> **Decision actor / UTC timestamp:** `N/A — no independent gate approver recorded`
> **Receiving owner / acknowledgement:** Tester, Security Reviewer and Independent Reviewer — pending
> **Superseded by:** [EVID-M2-002](M2-EVIDENCE-ENVELOPE-v2.md); xem thêm [audit M0–M2](M0-M2-AUDIT-2026-10-25.md)

## Source and traceability

- Source docs: `IMPLEMENTATION_PLAN.md` M2; `DOMAIN_MODEL.md` §§2–8; `PRD.md` FR-02–FR-10/AC-01/AC-05/AC-06; `PARSER_SPEC.md` §7; `QA_TEST_PLAN.md` §§3–5.
- Source version/hash: `N/A — local working tree before commit`.
- Requirement/P0 claim: M2 domain slice covered; all product P0 `no` until M3–M5.
- Related ADR/handoffs: ADR-0009, DESIGN-M2-001, IMPL-M2-001, TEST-M2-001.

## Immutable execution identity

- Commit/PR/diff ID: `N/A — not committed yet`.
- Exact commands observed:
  - `npm run lint` — exit `0`.
  - `npm run typecheck` — exit `0`.
  - `npm test` — exit `0`; `54/54` tests pass.
  - `npm audit --omit=dev` — exit `0`; `0 vulnerabilities`.
  - `npm run fixtures:run` — exit `0`; `5/5` entries pass.
- Remote CI/browser run IDs: `N/A — not run`.

## Data and integrity

- Synthetic fixtures only; no real UET/student source added.
- Schema changed from `0.1.0` to `0.2.0`; migration/compatibility is documented in ADR-0009.
- No public artifact or dataset publish output.

## Evidence and results

| Evidence | Expected | Actual | Result |
| --- | --- | --- | --- |
| M2 Node tests | conflict/search/Plan/date/merge/credits + regression | 54/54 pass | pass locally |
| Synthetic manifests | all fixture entries pass | 5/5 pass | pass locally |
| Source lint/typecheck | strict/no forbidden network/eval | exit 0 | pass locally |
| Browser privacy interception | no registration bytes/PII network | no app exists | deferred |
| Real UET golden validation | approved source coverage | source unavailable | pending |

## Risk and controls

- Privacy boundary: M2 consumes normalized local candidates; no raw registration/network/storage path added.
- No known S0/S1 from local checks; independent security review is pending.
- Rollback: revert M2 commit and schema/fixture updates; no persisted application data exists.
- Monitoring/canary: `N/A — no app or publication`.

## Decision and next step

- Recommendation: `ready-for-verification`; no gate approval claimed.
- Conditions: independent G3a/G3b/G3c review, real-source validation, future M3 persistence/network/accessibility evidence.
- Next owners: Tester, Security Reviewer, Independent Reviewer; Tech Lead records decisions.
