# M2 evidence envelope v2

> **Artifact ID:** `EVID-M2-002`  
> **Artifact status:** `ready`  
> **Canonical gate/sub-gate:** `G1 + G2 + G3a + G3b + G3c`  
> **Owner:** Tech Lead  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [M2 design handoff](M2-DESIGN-HANDOFF.md), [M2 implementation handoff](M2-IMPLEMENTATION-HANDOFF.md), [M2 G3a QA report](M2-G3a-QA-REPORT.md), [M2 G3b security review](M2-G3b-SECURITY-REVIEW.md), [M2 G3c independent review](M2-G3c-INDEPENDENT-REVIEW.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md)  
> **Decision actor / UTC timestamp:** Agent (Tech Lead role) / 2026-10-24T18:35:00Z  
> **Receiving owner / acknowledgement:** Product (for M3 planning), Frontend (for M3 implementation)  
> **Supersedes:** [EVID-M2-001](M2-EVIDENCE-ENVELOPE.md) (implementer-prepared draft)  
> **Re-entry (2026-10-25):** các quyết định G3 tổng hợp ở đây đã được reopen bởi [REVIEW-M0M2-AUDIT-001](M0-M2-AUDIT-2026-10-25.md) (actor là agent role, không độc lập; G1 chưa approve; finding đề xuất S1). Nội dung bên dưới giữ nguyên làm lịch sử, không còn hiệu lực cho tới khi G3 chạy lại.

## Source and traceability

- Source docs: `IMPLEMENTATION_PLAN.md` M2; `DOMAIN_MODEL.md` §§2–8; `PRD.md` FR-02–FR-10/AC-01/AC-05/AC-06; `PARSER_SPEC.md` §7; `QA_TEST_PLAN.md` §§3–5.
- Source version/hash: commit `7faccaf` on branch `feat/m2-domain-engine`.
- PRD requirement IDs / AC IDs: FR-02 (search), FR-03 (select), FR-04/AC-01 (conflict), FR-05 (note override), FR-06 (ONL), FR-08 (credits), FR-09/FR-10/AC-05 (registration), AC-06 (week1/date).
- P0 completeness claim: `no` — M2 is domain-only; M3–M5 required for product P0.
- Related ADR/design/spec/handoff IDs: ADR-0009, DESIGN-M2-001, IMPL-M2-001, TEST-M2-002, SEC-REVIEW-M2-001, REVIEW-M2-001.

## Immutable execution identity

- Commit/PR/diff ID: `7faccaf` (fix: normalize CRLF) on top of `61ee300` (feat: implement M2 domain engine).
- Build ID: `tsc -b tsconfig.build.json` — exit 0.
- Test/import/review run ID(s): `npm run check` — exit 0 (lint + typecheck + 54/54 tests + 5/5 fixtures).
- Toolchain versions: Node ≥20; TypeScript 5.9.3; npm lockfile frozen.
- Exact commands + exit codes:
  - `npm run lint` — exit `0`.
  - `npm run typecheck` — exit `0`.
  - `npm test` — exit `0`; `54/54` tests pass; duration ~390ms.
  - `npm run fixtures:run` — exit `0`; `5/5` entries pass.
  - `npm audit --omit=dev` — exit `0`; `0 vulnerabilities`.

## Data and artefact integrity

- Fixture manifest: 5 entries across 4 families (smoke-minimal, adversarial-invalid, registration-local-synthetic, uet-hk1-row1, uet-hk2-row4).
- Input/source hash: synthetic fixtures with manifest SHA-256 for timetable inputs; no hash for local-only registration.
- Output/artifact/manifest hash: no published artifact.
- Dataset/schema/parser version: schema `0.2.0`.
- Compatibility/migration note: ADR-0009 documents `0.1.0` → `0.2.0` migration; M1 fixtures updated; no persisted application data exists.

## Evidence links and results

| Evidence ID/link | Check | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| [TEST-M2-002](M2-G3a-QA-REPORT.md) | G3a QA: 54 tests + 5 fixtures + requirement matrix | all pass | 54/54 + 5/5 pass | **qa-pass-with-follow-up** |
| [SEC-REVIEW-M2-001](M2-G3b-SECURITY-REVIEW.md) | G3b Security: code review + data-flow + dependency | no PII/network/eval/secret | 0 findings in M2 source | **security-pass-with-exception** |
| [REVIEW-M2-001](M2-G3c-INDEPENDENT-REVIEW.md) | G3c Independent: correctness + architecture + regression | contract holds; no drift | all checks pass | **review-pass-with-follow-up** |
| `npm audit --omit=dev` | Dependency security | 0 vulnerabilities | 0 vulnerabilities | **pass** |
| CRLF normalization | Cross-platform hash stability | SHA-256 matches on LF/CRLF | commit `7faccaf` + Windows check | **pass** |

## Risk and controls

- Privacy/security impact and boundary: M2 domain engine is pure computation; no I/O, no network, no storage, no PII processing. Registration merge boundary consumes normalized `Section[]` objects, never raw bytes or identity fields.
- Findings (ID/severity/status):
  - QA-M2-001..005 (S2): real source, browser evidence, credit threshold, registration format, persistence migration — all have identified owners.
  - SEC-M2-001..003 (S2): browser boundary, ZIP stress, registration format — inherited from M1, not M2-introduced.
  - REV-M2-001..003 (S2): `Override.from` typing, O(n²) conflict, `JSON.stringify` comparison — informational/maintainability, not correctness issues.
- Waiver/exception: `none` — no S0/S1 found; S2 items have owners and do not block M2 milestone.
- Rollback/migration trigger: revert M2 commit (`61ee300` + `7faccaf`) and schema/fixture updates; no persisted application data exists.
- Monitoring/canary/alert evidence: `N/A — no app or publication`.

## Decision and next step

- Gate decisions recorded:
  - **G2:** `g2-ready-for-verification` — implementation complete, evidence collected.
  - **G3a:** `qa-pass-with-follow-up` — 54/54 tests, 5/5 fixtures, 5 S2 follow-ups.
  - **G3b:** `security-pass-with-exception` — no S0/S1; 3 S2 inherited exceptions.
  - **G3c:** `review-pass-with-follow-up` — code review pass; 3 S2 informational findings.
- Recommendation: **M2 milestone is `verified` and ready for merge to `main`**. No gate is `no-go` or `blocked`.
- Conditions: all S2 follow-ups are tracked with owners; none block M2 merge or M3 entry. Real-source validation, browser evidence and persistence migration remain required before G4a/G4b (public release).
- Next owner action:
  1. Merge `feat/m2-domain-engine` → `main`.
  2. Product: begin M3 scope/spec planning (Core UI & Export).
  3. Frontend: begin M3 implementation (React+Vite app, search/select/conflict UI, day/grid views, ICS/PNG export).
