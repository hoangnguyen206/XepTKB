# M2 implementation handoff — domain engine

> **Artifact ID:** `IMPL-M2-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G2`
> **Task/PR:** `M2 Domain engine`
> **Owner:** Tech Lead
> **Implementer:** Coder
> **Last reviewed:** 2026-10-20
> **Related docs:** [M2 design handoff](M2-DESIGN-HANDOFF.md), [M2 evidence envelope](M2-EVIDENCE-ENVELOPE.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md), [Implementation plan](../IMPLEMENTATION_PLAN.md)
> **Evidence envelope:** [EVID-M2-001](M2-EVIDENCE-ENVELOPE.md)
> **Receiving owner / acknowledgement:** Tester, Security Reviewer and Independent Reviewer — pending

## Source and immutable identity

- Source contracts: `IMPLEMENTATION_PLAN.md` M2; `DOMAIN_MODEL.md` §§2–8; `PRD.md` FR-02–FR-10/AC-01/AC-05/AC-06; `PARSER_SPEC.md` §7; `QA_TEST_PLAN.md` §§3–5; ADR-0009.
- Base/target commit: `N/A — working tree not committed yet`.
- Toolchain: Node `>=20`; TypeScript `5.9.3`; npm lockfile; existing M1 dependencies.
- Commands currently observed: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` exit 0 (54 tests); `npm run fixtures:run` exit 0 (5/5 entries); `npm audit --omit=dev` exit 0 (0 vulnerabilities).

## Outcome and scope

- Outcome: implement M2 domain engine as pure, deterministic TypeScript.
- In scope: search index, Plan/group resolution, conflict engine, week1/date, registration merge/override precedence and credit summary; required schema/issue/fixture updates.
- Out of scope: M3 UI/PWA, IndexedDB, export, browser network interception, artifact loader, admin publish, backend, PDF or real source ingestion.
- Product P0 coverage: `no` — M2 is one milestone; M3–M5 remain required.

## Changed artefacts

| File/module | Change | Compatibility/migration |
| --- | --- | --- |
| `packages/domain/src/types.ts` | schema `0.2.0`; fixed/non-fixed Session, week origin, optional credits, targeted Override, Plan datasetVersion | ADR-0009; future storage migration required |
| `packages/domain/src/normalize.ts`, `search.ts` | identity normalization, alias collision detection and deterministic search | pure API; no UI/network |
| `packages/domain/src/plan.ts`, `conflict.ts` | Plan/group resolution and week-aware conflict/warning engine | no persistence |
| `packages/domain/src/week-date.ts` | validated ISO civil-date/week1 functions | no host-local date parsing |
| `packages/domain/src/registration-merge.ts` | field-level local registration merge and final Plan creation | draft is copied, timetable immutable |
| `packages/domain/src/credits.ts` | course-once totals and incomplete-credit diagnostics | no threshold until C-02 |
| `packages/parser/src/weeks.ts`, adapters | week origin metadata and optional-credit retention | M1 regression preserved |
| `packages/domain/test/*` | M2 golden/adversarial coverage | search/Plan/conflict/date/merge/credits and parser regressions; Node test harness |
| `docs/adr/ADR-0009*`, `docs/evidence/M2-*` | contract, handoff and evidence boundary | approvals intentionally pending |

## Acceptance mapping

| Criterion | Evidence | Result |
| --- | --- | --- |
| Search code/name without accents and aliases | `search.test.ts` | pass locally |
| Plan group resolution and status mirror | `plan.test.ts` | pass locally |
| AC-01 conflict period/week intersection | `conflict.test.ts` | pass locally |
| Disjoint weeks/adjacent periods/no false conflict | `conflict.test.ts` | pass locally |
| ONL/non-fixed exclusion and campus warning | `conflict.test.ts`, `validate.test.ts` | pass locally |
| Week1/date Asia/Ho_Chi_Minh civil arithmetic | `week-date.test.ts` | pass locally |
| AC-05 room/time field-level registration override | `registration-merge.test.ts` | pass locally |
| TH registration default weeks `[2..teachingWeeks]` | `registration-merge.test.ts` | pass locally |
| Credits count once and preserve unknown | `credits.test.ts` | pass locally |

## Test and verification

- Automated: 54/54 Node tests; 5/5 synthetic fixture entries; lint/typecheck/audit pass.
- Not run: remote CI, browser/E2E, IndexedDB migration, accessibility, export/calendar import, real approved UET source, independent G3a/G3b/G3c review.
- Known limitations: M2 has no UI or persistence; exact registration source format remains C-09; product credit thresholds remain C-02; parser candidate matching is pure package behavior only.

## Data/privacy/security

- No new network, storage, credential or external-service path.
- Registration bytes remain within M1 local adapter; M2 consumes normalized candidates only and never raw HTML/identity fields.
- Security evidence is package-level only; independent G3b and browser interception remain pending.
- Contract/privacy/parser changes reopen G1 and downstream gates.

## Handoff decision

- Recommendation: `ready-for-verification` based on local implementation evidence; Coder does not approve its own code.
- Implementer actor/date: `N/A — independent sign-off not recorded`.
- Tech Lead readiness: pending acknowledgement.
- Next owners: Tester (G3a), Security Reviewer (G3b), Independent Reviewer (G3c).
