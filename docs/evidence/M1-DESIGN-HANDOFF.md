# M1 design handoff — parser and fixtures

> **Artifact ID:** `DESIGN-M1-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G1`
> **Owner:** Tech Lead + Data Parser
> **Last reviewed:** 2026-10-20
> **Related docs:** [Implementation plan](../IMPLEMENTATION_PLAN.md), [Parser spec](../PARSER_SPEC.md), [Domain model](../DOMAIN_MODEL.md), [Security & privacy](../SECURITY_PRIVACY.md), [QA plan](../QA_TEST_PLAN.md), [ADR-0008](../adr/ADR-0008-m1-parser-dependencies-local-provenance.md)
> **Evidence envelope:** [EVID-M1-001](M1-EVIDENCE-ENVELOPE.md)

## Context and source

- M1 source of truth: `IMPLEMENTATION_PLAN.md` §2; `PARSER_SPEC.md` §§2–9 and §11; `DOMAIN_MODEL.md` §§2–5; `QA_TEST_PLAN.md` §§3–5; `SECURITY_PRIVACY.md` §§2–6.
- Requirement/AC focus: M1 parser/fixture vertical slice; FR-01, FR-05 and the parser/privacy portions of FR-09/FR-10. Product P0 is not fully covered until later milestones.
- Constraints: UET-first, deterministic-first, fail closed, local-first registration parsing, no portal credentials, no raw registration upload, no M2 implementation.
- In scope: canonical validation refinements; bounded `uet-xlsx`; local-only `vnu-registration-html`; notes→weeks/period override; manifest runner; synthetic fixtures and evidence.
- Out of scope: search/index, conflict engine, week/date engine, registration matching/override precedence, Plan mutation, UI/PWA, IndexedDB, export, admin publish and real source ingestion.

## Decision/design

- `SourceInput` carries bytes, optional filename only at the adapter boundary, local-only marker, term/teaching-week context and an adapter byte limit.
- OOXML is read through a bounded `fflate` unzip plus `@xmldom/xmldom` XML boundary. Only workbook relationships, worksheets, shared strings and merge ranges are consumed. DOCTYPE/entity declarations, malformed input and size violations fail closed.
- UET header mapping uses normalized synonyms rather than column positions. Header rows 1 and 4, merged-cell fill-down, T7, aliases, explicit weeks and period-note override are covered by synthetic fixtures.
- Registration HTML is parsed as inert text/DOM data according to content, not `.doc` extension. The candidate artifact is constant/non-identifying, `localOnly=true`, and omits filename and hash. Identity fields/raw markup are not emitted.
- Registration M1 stops at schedule candidate extraction. It does not match to an existing dataset, create `Override`, mutate `Plan`, persist, or call a network service.

## Alternatives and rationale

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| SheetJS `xlsx` | broad familiar workbook support | current audited release had high findings with no compatible fix | rejected; see ADR-0008 |
| `fast-xml-parser` | convenient XML API | tested release raised critical/high entity/DOCTYPE concerns | rejected |
| `fflate` + `@xmldom/xmldom` | small browser-compatible primitives and explicit bounds | supported OOXML subset is owned by adapter; real-file spike remains | selected |
| Hash registration input | simple provenance lookup | enables linkage and violates local-only boundary | rejected |

## Operational and quality impact

- Privacy/security: timetable fixture inputs may carry SHA-256; registration input must carry neither `sha256` nor `fileName`. No raw HTML, identity fields or credentials may enter output/issues/telemetry.
- Parser/fixture: synthetic-only committed fixtures; two binary synthetic UET workbooks are now executed through the manifest runner. No real approved UET workbook is present.
- Accessibility/performance/offline: no web app in M1; browser, worker, IndexedDB and UI gates are deferred.
- Observability/analytics: no network/logging path; runner prints counts and issue codes only.
- Rollback: remove M1 adapters/fixtures and revert additive domain/docs changes; no persisted data or published artifact exists.

## Verification plan

- Unit: domain validation, adapter parsing, OOXML merge/header/size/malformed behavior, registration privacy assertions and note/week rules.
- Golden: `fixtures/synthetic-uet-xlsx`, `fixtures/synthetic-registration`, `fixtures/smoke`, `fixtures/synthetic-adversarial` manifests.
- Security: dependency audit, no-network/static lint, no identity/hash/filename registration assertions. Browser network interception is N/A until an app exists.
- Commands: `npm run check`, `npm run fixtures:run`, `npm audit --omit=dev`, `git diff --check`.

## Approval

- Product scope approval: `N/A — no independent actor recorded in this session`.
- Tech Lead design approval: `N/A — implementer cannot self-approve`.
- Data Parser approval: `N/A — independent acknowledgement pending`.
- Security consultation/gate: `N/A — G1 acknowledgement pending`.
- Decision: `g1-blocked` until the designated approvers record acknowledgement.
- Open conditions: validate against an approved real/redacted UET workbook before any dataset publication; run browser network evidence in M3/M4; resolve the real registration format gap (C-09) before freezing the adapter for production.
