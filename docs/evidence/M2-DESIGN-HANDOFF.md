# M2 design handoff — domain engine

> **Artifact ID:** `DESIGN-M2-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G1`
> **Owner:** Tech Lead
> **Last reviewed:** 2026-10-20
> **Related docs:** [Implementation plan](../IMPLEMENTATION_PLAN.md), [Domain model](../DOMAIN_MODEL.md), [Parser spec](../PARSER_SPEC.md), [QA plan](../QA_TEST_PLAN.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md)
> **Evidence envelope:** [EVID-M2-001](M2-EVIDENCE-ENVELOPE.md)

## Context and source

- M2 source of truth: `IMPLEMENTATION_PLAN.md` §2/§3/§5; `DOMAIN_MODEL.md` §§2–8; `PRD.md` FR-02–FR-10 and AC-01/AC-05/AC-06; `PARSER_SPEC.md` §7; `QA_TEST_PLAN.md` §§3–5.
- M1 baseline: canonical parser/domain package at schema `0.1.0`; registration adapter stopped at candidate extraction.
- Scope: pure domain engine only. No UI, PWA, IndexedDB, export, browser network, artifact loader, admin CLI or M3 work.

## Decision/design

- `packages/domain/src/normalize.ts`: parser-independent Unicode/code/section/group identity normalization and alias collision detection.
- `search.ts`: immutable code/name/section search index with deterministic ranking, alias support and empty-query fail-closed behavior.
- `plan.ts`: Plan factory, term/dataset/status validation, section/group resolution, duplicate selection checks and pure pick mutation helpers.
- `conflict.ts`: fixed-session `day × inclusive period × intersecting weeks` engine, canonical pair ordering, ONL exclusion and adjacent known-campus warning.
- `week-date.ts`: ISO civil-date validation, cohort/user week1 resolution and `Asia/Ho_Chi_Minh`-labelled date calculation.
- `registration-merge.ts`: exact section/session matching, field-level targeted overrides, TH registration default-week policy, unmatched warning and separate final Plan.
- `credits.ts`: course-once credit totals with integer-cent precision, unknown-credit diagnostics and no threshold invention.
- Schema `0.2.0`: targeted `Override`, `Plan.datasetVersion`, optional credits, `Session.fixedTime` union and `Session.weekOrigin`.

## Alternatives and rationale

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Keep mandatory time fields for ONL | no type migration | sentinel values can create false conflicts | rejected |
| Untargeted Override | smaller type | unsafe with multi-session Sections | rejected |
| First-match merge on ambiguity | simple UX | can change wrong room/session | rejected; fail closed |
| Missing credits = 0 | easy total | hides source incompleteness | rejected |
| Domain importing parser normalization | no duplicate helpers | dependency cycle and browser boundary | rejected; domain owns identity normalization |

## Verification plan

- Unit/golden: 54 Node tests across M1 + M2; search, Plan/group, conflict, date, merge, credits and parser regression.
- Fixtures: all 5 synthetic fixture entries remain green; no real student/UET source added.
- Security: no network or dynamic evaluation; registration remains local-only; browser interception remains deferred to M3/M4.
- Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run fixtures:run`, `npm run check`, `npm audit --omit=dev`.

## Approval

- Product scope approval: `N/A — no independent actor recorded in this session`.
- Tech Lead design approval: `N/A — implementer cannot self-approve`.
- Security consultation/gate: `N/A — no new network/auth boundary; independent G3b still pending`.
- Decision: `g1-blocked` until designated acknowledgement.
- Open conditions: real-source validation, independent review, browser integration evidence and future persistence migration remain pending.
