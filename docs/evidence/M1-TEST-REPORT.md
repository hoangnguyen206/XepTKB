# M1 test report — parser and fixtures

> **Artifact ID:** `TEST-M1-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G3a`
> **Owner:** Tester (handoff prepared by implementer; independent sign-off pending)
> **Last reviewed:** 2026-10-20
> **Related docs:** [QA plan](../QA_TEST_PLAN.md), [M1 implementation handoff](M1-IMPLEMENTATION-HANDOFF.md), [M1 evidence envelope](M1-EVIDENCE-ENVELOPE.md)
> **Evidence envelope:** [EVID-M1-001](M1-EVIDENCE-ENVELOPE.md)
> **Tester sign-off actor / UTC timestamp:** `N/A — no independent Tester run/sign-off recorded`

## Scope and immutable identity

- Scope: M1 `uet-xlsx`, `vnu-registration-html`, canonical validation, notes/weeks, fixture manifests and privacy-safe candidate extraction.
- Base/target commit/build/diff: `N/A — uncommitted working tree`; no remote run ID.
- Dataset/parser/schema: synthetic fixtures; schema `0.1.0`; adapters `uet-xlsx@0.1.0`, `vnu-registration-html@0.1.0`.
- Environment: local Node `>=20` environment; browser/device not applicable to this package-only run.
- Fixture manifests: smoke, synthetic-adversarial, synthetic-registration and synthetic-uet-xlsx; real source absent by policy.
- P0 completeness: `no — M1 is one milestone; product P0 requires M2–M5`.

## Scope and risk focus

- Highest-risk scenarios: local registration identity leakage, registration hash/filename linkage, malicious/malformed OOXML/HTML, wrong header mapping, merged-cell loss, period-note precedence and week bounds.
- Out of scope: UI, browser interception, IndexedDB, search/conflict/date engine, matching/override, export, admin publish and real-school source acceptance.

## Commands and summary

| Suite/command | Exit code | Result | Count/evidence |
| --- | ---: | --- | --- |
| `npm run lint` | 0 | pass | foundation lint checks |
| `npm run typecheck` | 0 | pass | strict TypeScript build |
| `npm test` | 0 | pass | 28/28 Node tests |
| `npm run fixtures:run` | 0 | pass | 5/5 fixture entries |
| `npm run check` | 0 | pass | lint + typecheck + tests + fixtures |
| `npm audit --omit=dev` | 0 | pass | 0 production vulnerabilities |
| `git diff --check` | 0 | pass | no whitespace errors; Git emitted only line-ending warnings |

## Requirement/AC matrix

| Requirement | Test/evidence | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| UET header row 1/17 columns | `uet-xlsx.test.ts`, `uet-hk1-row1` | map by synonym; one section/session | one section/session | pass |
| UET header row 4/18 columns | `uet-xlsx.test.ts`, `uet-hk2-row4` | merged fill-down; ten-week weeks | one section/session; weeks 6–15 | pass |
| T7 and note override | UET parser test | day 7; note periods win | day 7; periods 9–12 | pass |
| Registration multi-day/multi-period | registration test/manifest | four sessions from first row; safe candidate | 2 sections/5 sessions | pass |
| Registration privacy boundary | registration serialization test + domain validator | no identity/hash/filename | absent/rejected | pass |
| Malformed/oversized input | UET and registration tests | typed error, no throw | safe issue returned | pass |
| M2 functionality | scope inspection | not implemented in M1 | not present | pending independent review |

## Quality checks

| Area | Expected/control | Actual/evidence | Result |
| --- | --- | --- | --- |
| Privacy/network/log | no raw registration or PII leaves adapter | pure synchronous adapters; serialization assertions; no network API | pass locally; browser interception N/A |
| File parser/XSS | inert parsing, size limits, no script execution | XML entity/DOCTYPE rejection; HTML text extraction; malformed tests | pass locally |
| Dependency integrity | no known production audit findings | `npm audit --omit=dev` → 0 vulnerabilities | pass locally |
| Accessibility/responsive/offline | app gates | no app exists in M1 | N/A — deferred |
| Export/calendar/performance | later milestones | not implemented | N/A — deferred |

## Findings

| Finding | Severity | Evidence | Impact | Status |
| --- | --- | --- | --- | --- |
| Real approved UET source coverage missing | S2 | only synthetic binary fixtures committed | format drift could remain undetected | open; Data Reviewer to provide approved fixture before publish |
| Browser network interception not run | S2 | no web app in repository | runtime integration boundary not yet evidenced | open; M3/M4 owner |
| Broader OOXML hostile-input stress matrix missing | S2 | no ZIP-bomb/entry-count/encrypted-workbook fixture | residual parser hardening uncertainty | open; Security/Tester before production parser freeze |
| Independent gate acknowledgement missing | process | no Tester/Security/Reviewer actor recorded | cannot claim release readiness | open; Tech Lead coordinates |

## Limitations and skipped tests

| Test | Why skipped | Owner | Re-entry trigger |
| --- | --- | --- | --- |
| Browser request interception during `.doc` import | no app/browser flow in M1 | Frontend + Security | M3/M4 file picker exists |
| Real approved UET workbook golden run | no approved/redacted source supplied | Data Reviewer | source approval and secure fixture availability |
| Accessibility/viewport/offline/E2E | no UI/PWA | Frontend + Tester | M3 implementation |
| Registration matching/override | M2/M4 scope | Data/Frontend | Plan and dataset matcher exist |
| Remote CI | not invoked from this session | repository owner | push/PR workflow run |

## Gate decision

- Decision: `qa-pass-with-follow-up` for local M1 package checks only; not a release decision.
- Tester actor/date/evidence: `N/A — independent sign-off pending`.
- Release recommendation: `no-go` for public release/dataset publication until G1/G3a/G3b/G3c and real-source/privacy evidence are independently accepted.
- Conditions/next owner: record independent review, add approved real-source fixture, run browser network evidence when app exists, and keep M2+ scope separate.
