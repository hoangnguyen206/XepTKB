# M2 test report — domain engine

> **Artifact ID:** `TEST-M2-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G3a`
> **Owner:** Tester (handoff prepared by implementer; independent sign-off pending)
> **Last reviewed:** 2026-10-20
> **Related docs:** [QA plan](../QA_TEST_PLAN.md), [M2 implementation handoff](M2-IMPLEMENTATION-HANDOFF.md), [M2 evidence envelope](M2-EVIDENCE-ENVELOPE.md)
> **Evidence envelope:** [EVID-M2-001](M2-EVIDENCE-ENVELOPE.md)
> **Tester sign-off actor / UTC timestamp:** `N/A — no independent Tester sign-off recorded`

## Scope and immutable identity

- Scope: M2 pure domain engine and M1 regression.
- Base/target commit: `N/A — working tree not committed yet`.
- Schema: `0.2.0`; synthetic fixtures only.
- Environment: local Node `>=20`; browser/device not applicable.
- P0 completeness: `no — M3–M5 remain required`.

## Commands and summary

| Suite/command | Exit code | Result | Count |
| --- | ---: | --- | ---: |
| `npm run lint` | 0 | pass | foundation lint |
| `npm run typecheck` | 0 | pass | strict TypeScript |
| `npm test` | 0 | pass | 54/54 Node tests |
| `npm run fixtures:run` | 0 | pass | 5/5 fixture entries |
| `npm audit --omit=dev` | 0 | pass | 0 production vulnerabilities |
| browser/E2E/network | N/A | deferred | no app |

## Requirement matrix

| Requirement | Test | Result |
| --- | --- | --- |
| FR-02 search aliases/diacritics | `search.test.ts` | pass locally |
| FR-03 group-aware Section selection | `plan.test.ts` | pass locally |
| FR-04 / AC-01 week-aware conflict | `conflict.test.ts` | pass locally |
| FR-06 ONL/no fixed time | `conflict.test.ts`, `validate.test.ts` | pass locally |
| AC-06 week1/date | `week-date.test.ts` | pass locally |
| FR-08 credits | `credits.test.ts` | pass locally |
| AC-05 registration override | `registration-merge.test.ts` | pass locally |
| M1 parser/privacy regression | existing parser tests/fixtures | pass locally |

## Findings and limitations

| Finding | Severity | Status |
| --- | --- | --- |
| Independent Tester/Security/Reviewer sign-off absent | process | open |
| Real approved UET golden source absent | S2 | open; Data Reviewer owner |
| Browser network interception absent | S2 | deferred to M3/M4 |
| C-02 credit threshold unresolved | product/spec | no threshold invented |
| C-09 actual registration format unconfirmed | S2 | open |
| Persistence migration not exercised | S2 | deferred to M3 |

## Gate decision

- Local result: `qa-pass-with-follow-up` for package-test preparation only; no canonical independent `qa-pass` decision is recorded.
- Tester actor/date/evidence: `N/A — independent sign-off pending`.
- Release recommendation: `no-go` for public app/dataset release until downstream milestones and gates pass.
