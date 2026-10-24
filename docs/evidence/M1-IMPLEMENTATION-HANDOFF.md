# M1 implementation handoff

> **Artifact ID:** `IMPL-M1-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G2`
> **Task/PR:** `M1 Parser & fixtures UET`
> **Owner:** Tech Lead
> **Implementer:** Coder/Data Parser
> **Last reviewed:** 2026-10-20
> **Related docs:** [M1 design handoff](M1-DESIGN-HANDOFF.md), [M1 evidence envelope](M1-EVIDENCE-ENVELOPE.md), [ADR-0008](../adr/ADR-0008-m1-parser-dependencies-local-provenance.md), [Parser spec](../PARSER_SPEC.md), [QA plan](../QA_TEST_PLAN.md)
> **Evidence envelope:** [EVID-M1-001](M1-EVIDENCE-ENVELOPE.md)
> **Receiving owner / acknowledgement:** Tester, Security Reviewer and Independent Reviewer — pending

## Source and immutable identity

- Approved spec/ADR/design IDs: `IMPLEMENTATION_PLAN.md` M1; `PARSER_SPEC.md`; `DOMAIN_MODEL.md`; `SECURITY_PRIVACY.md`; `QA_TEST_PLAN.md`; ADR-0008; DESIGN-M1-001.
- Base/target commit/diff ID: `N/A — uncommitted working tree`; no PR created.
- CI/test/import run IDs: local shell runs only; remote CI has not run in this session.
- Toolchain: Node engine `>=20`; TypeScript `5.9.3`; npm lockfile; `fflate@0.8.3`; `@xmldom/xmldom@0.9.12`.
- Commands and latest observed results: `npm run check` exit 0; `npm test` exit 0 (28 tests); `npm run fixtures:run` exit 0 (5/5); `npm audit --omit=dev` exit 0 (0 vulnerabilities); `git diff --check` no whitespace errors.

## Outcome and scope

- Outcome: deliver the M1 deterministic parser vertical slice and synthetic fixture evidence without crossing into M2.
- In scope: UET XLSX adapter, local registration HTML adapter, bounded OOXML reader, normalization/config, local-only provenance contract, fixture manifests/runner, tests and docs/evidence.
- Out of scope: search/index, conflict/week/date engine, registration merge/override precedence, Plan runtime, UI/PWA, IndexedDB, export, admin ingest/publish and release.
- Requirement/P0 coverage: `no` for all product P0; M1 covers only its parser/fixture slice. Later milestones remain required.

## Changed artefacts

| File/module | Change | Why | Compatibility/evidence |
| --- | --- | --- | --- |
| `packages/domain/src/types.ts`, `validate.ts`, `issues.ts` | optional hash/local-only marker; validation and M1 issue taxonomy | distinguish approved timetable provenance from local registration | additive schema `0.1.0`; domain tests |
| `packages/parser/src/normalize.ts`, `uet-config.ts`, `ooxml.ts` | deterministic normalization, UET aliases/frame, bounded OOXML reader | parse supported UET subset safely | parser tests; no external I/O |
| `packages/parser/src/uet-xlsx-adapter.ts` | row 1/4 headers, synonyms, merges, notes, grouping/dedup | UET candidate extraction | unit + binary synthetic fixtures |
| `packages/parser/src/vnu-registration-html-adapter.ts` | inert local HTML candidate extraction, no hash/filename/identity | local-first registration boundary | privacy tests + synthetic `.doc` |
| `packages/parser/src/fixture-manifest.ts`, `runner.ts`, registry/index | adapter registration and expected-count/hash runner | reproducible golden checks | 5/5 fixture entries |
| `fixtures/synthetic-uet-xlsx/**` | two synthetic binary OOXML workbooks + hashes/manifest | exercise real byte path without school/PII source | runner verifies hashes |
| `docs/adr/ADR-0008*`, `docs/evidence/M1-*`, source docs | dependency/privacy decision and gate evidence | auditable handoff | approvals intentionally pending |

## Data and integrity

- Fixture manifests: `fixtures/synthetic-uet-xlsx/manifest.json` (two SHA-256 values), plus existing smoke/adversarial/registration manifests. All committed data is synthetic.
- Approved real source: `N/A — no approved real UET or student file is in the repository`.
- Schema/parser: schema `0.1.0`; adapters `uet-xlsx@0.1.0` and `vnu-registration-html@0.1.0`; manifest `1`.
- Boundary: registration candidate artifact has constant id, `localOnly=true`, no hash and no user filename; identity fields and raw HTML are dropped.

## Acceptance mapping

| Criterion | Implementation | Evidence | Result |
| --- | --- | --- | --- |
| UET header row 1/4 and synonyms | `uet-xlsx-adapter.ts` + `normalize.ts` | UET parser tests; 2 binary manifests | pass locally |
| Merged cells and section grouping | bounded OOXML fill-down + adapter grouping | `uet-xlsx.test.ts`; `uet-hk2-row4` | pass locally |
| T7, notes→weeks and period override | UET config/normalization/weeks parser | parser tests; `uet-hk1-row1` | pass locally |
| Registration `.doc` by content, local-only | inert HTML adapter | registration tests + manifest | pass locally |
| No registration hash/filename/identity | artifact/domain validator and serialization assertions | registration tests; domain validator test | pass locally |
| Fail closed on malformed/oversized input | adapter limits, ZIP/XML checks and safe issues | malformed/size tests | pass locally |
| M2 boundary maintained | no runtime/UI/storage/search/conflict implementation | scope inspection | pending independent review |

## Test and verification

- Automated: 28 Node tests pass; 5/5 fixture entries pass; lint/typecheck/build pass; production dependency audit has 0 vulnerabilities.
- Manual: inspected synthetic fixture manifests and output privacy assertions; no real source was opened or committed.
- Not run: remote GitHub Actions; browser network interception; accessibility/responsive/offline/E2E; real approved UET fixture; ZIP bomb/entry-count/encrypted-workbook stress cases.
- Skipped owners: Tester/Security Reviewer/Independent Reviewer; due/expiry to be set by those owners. Any new source format or browser boundary reopens G1/G3b.
- Known limitations: supported OOXML subset is intentionally narrow; registration matching/override is not implemented; no public loader exists, so published-status enforcement is deferred to the future artifact loader milestone.

## Data/privacy/security

- Registration bytes are accepted only in memory by the adapter; no network, file persistence, logging or hash path is present. Identity-like synthetic values are asserted absent from serialized results.
- Security review is required: local implementation checks are recorded, but this handoff does not self-approve G3b.
- No analytics or external service path was added.
- Reopen on any browser network/storage, public loader, persistence, auth, source-format, schema or dependency boundary change.

## Risks, rollout and rollback

- No migration or rollout: M1 has no app or persisted records.
- Rollback: remove the M1 adapter/fixture/docs changes and restore pre-M1 contract if G1 rejects the design; no user data is touched.
- No production monitoring/canary or dataset publication is claimed.

## Handoff decision

- Recommendation: `ready-for-verification`; local evidence is green, independent gates are pending.
- Implementer actor/date: `N/A — not recorded as an independent approval`.
- Tech Lead readiness decision: `N/A — awaiting designated owner acknowledgement`.
- Next owner/action: Tester verifies the matrix; Security Reviewer verifies privacy/dependency controls; Independent Reviewer checks the final diff; Tech Lead records G1/G2/G3 decisions.
- Open questions: approved real UET fixture and actual registration HTML shape (C-09); browser integration/network evidence; stress tests for broader OOXML hostile inputs.
