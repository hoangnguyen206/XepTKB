# Test report — M2 domain engine G3a QA verification

> **Artifact ID:** `TEST-M2-002`  
> **Artifact status:** `ready`  
> **Canonical gate:** `G3a`  
> **Owner:** Tester  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [QA plan](../QA_TEST_PLAN.md), [M2 implementation handoff](M2-IMPLEMENTATION-HANDOFF.md), [M2 evidence envelope](M2-EVIDENCE-ENVELOPE-v2.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md)  
> **Evidence envelope:** [EVID-M2-002](M2-EVIDENCE-ENVELOPE-v2.md)  
> **Tester sign-off actor / UTC timestamp:** `Agent (Tester role) / 2026-10-24T18:20:00Z`  
> **Supersedes:** [TEST-M2-001](M2-TEST-REPORT.md) (implementer-prepared draft)  
> **Re-entry (2026-10-25):** reopened bởi [REVIEW-M0M2-AUDIT-001](M0-M2-AUDIT-2026-10-25.md): thiếu golden conflict matrix/property test (AUD-011), FR-06 chưa có ở parser (AUD-003), một số số liệu trong báo cáo không khớp repo (AUD-013). Quyết định bên dưới không còn hiệu lực cho tới khi chạy lại G3a.

## Scope and immutable identity

- Source spec/PRD/ADR: `IMPLEMENTATION_PLAN.md` M2; `DOMAIN_MODEL.md` §§2–8; `PRD.md` FR-02–FR-10/AC-01/AC-05/AC-06; `PARSER_SPEC.md` §7; `QA_TEST_PLAN.md` §§3–5; ADR-0009.
- Base commit: `61ee300` (feat: implement M2 domain engine).
- Target commit: `7faccaf` (fix: normalize CRLF for cross-platform SHA-256 hash stability).
- Dataset/parser/schema: schema `0.2.0`; synthetic fixtures only.
- Fixture manifest: 5 entries across 4 families (smoke, adversarial, registration-html, uet-xlsx×2).
- Environment: Windows 11, Node ≥20, TypeScript 5.9.3.
- Runner/tool: Node built-in test runner (`node --test`); fixture runner (`run-fixtures.js`).
- Requirement/AC/P0 coverage: `no — M2 is domain-only; M3–M5 UI/export/admin remain required for product P0`.

## Scope and risk focus

- Features: search index with Vietnamese diacritics/aliases, Plan/group resolution, week-aware conflict detection, week1/date civil arithmetic, field-level registration merge/override, credits summary with unknown-credit handling.
- Highest-risk: conflict false negatives (disjoint weeks but same periods), registration merge applying to wrong session, CRLF hash instability on Windows.
- Out of scope: UI/PWA, IndexedDB persistence, browser/E2E, export ICS/PNG/Word, real approved UET source, accessibility, performance budgets.

## Commands and summary

| Suite/command | Tool/run ID | Exit code | Result | Count | Evidence |
| --- | --- | ---: | --- | ---: | --- |
| `npm run lint` | scripts/lint.mjs | 0 | pass | — | no forbidden patterns |
| `npm run typecheck` | tsc strict | 0 | pass | — | no type errors |
| `npm test` | node --test | 0 | pass | 54/54 | all tests pass |
| `npm run fixtures:run` | run-fixtures.js | 0 | pass | 5/5 | all fixture entries match |
| `npm audit --omit=dev` | npm audit | 0 | pass | 0 vulnerabilities | no production vulnerability |
| browser/E2E/network | N/A | N/A | deferred | — | no app exists |

## Requirement/AC matrix

| Requirement/AC/P0 | Test case | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| FR-02 search code/name/alias diacritics | `search.test.ts` #16–19 | normalize accents, rank exact, detect alias collision, reject duplicates | as expected | **pass** | 4 tests |
| FR-03 Section group selection | `plan.test.ts` #1–5 | resolve group, reject missing/invalid, no duplicate course | as expected | **pass** | 5 tests |
| FR-04 / AC-01 week-aware conflict | `conflict.test.ts` #6–9 | hard conflict on period+week overlap; no conflict on disjoint weeks; no conflict on adjacent periods; ONL excluded; campus warning | as expected | **pass** | 4 tests |
| FR-06 ONL/no-fixed-time exclusion | `conflict.test.ts` + `validate.test.ts` #25 | non-fixed session does not conflict; validate allows fixedTime:false for ONL | as expected | **pass** | 2 tests |
| AC-06 week1/date arithmetic | `week-date.test.ts` #26–29 | civil date for week/day; user override; ambiguous cohort fails closed | as expected | **pass** | 4 tests |
| FR-08 credits / unknown handling | `credits.test.ts` #10–11 | course-once total; unknown preserved; no fabricated zero | as expected | **pass** | 2 tests |
| AC-05 registration field-level override | `registration-merge.test.ts` #12–15 | room/day/period/week override; invalid values rejected; unmatched preserved as warning; TH ADR-0006 default weeks | as expected | **pass** | 4 tests |
| FR-05 note period override | `weeks.test.ts` #48–54 | "Học tiết 9-12" overrides Ca; conflicting patterns block | as expected | **pass** | 7 tests |
| AC-02 header/merged cells | `uet-xlsx.test.ts` #42–47 | row 1, row 4, merged fill-down, subtotal skip, synonym, T7, CN day 8 | as expected | **pass** | 6 tests |
| M1 parser regression | `runner.test.ts` #33–40 + fixture manifest | fixture hash, adapter, schema stability | 54/54 + 5/5 | **pass** | complete |
| Cross-platform hash stability | `runner.ts` normalizeCrlf + `.gitattributes` | SHA-256 matches on LF and CRLF | `7faccaf` commit, check passes on Windows | **pass** | commit evidence |

## Quality checks

| Area | Expected/control | Actual/evidence | Result |
| --- | --- | --- | --- |
| Privacy/network/log/Sentry | no PII/raw registration; no network calls in packages | `grep` scan: 0 `fetch/XMLHttpRequest/eval/innerHTML` hits in source; only XML namespace URIs in test helpers | **pass** |
| Security/auth/RBAC/share/file | no secrets, no credentials in source | `grep` scan: 0 `secret/password/credential/API_KEY/process.env` hits | **pass** |
| Accessibility/keyboard/contrast | N/A — no UI in M2 | — | **N/A** |
| Responsive/mobile/desktop | N/A — no UI in M2 | — | **N/A** |
| Offline/cache/update | N/A — no PWA/storage in M2 | — | **N/A** |
| Export/calendar | N/A — M3 scope | — | **N/A** |
| Performance budgets | N/A — package-level only; 54 tests in ~390ms | acceptable | **pass** |

## Findings

| Finding ID | Severity | Repro/evidence | Impact | Owner/status/expiry |
| --- | --- | --- | --- | --- |
| QA-M2-001 | S2 | No real approved UET golden source in fixture suite | Cannot validate production parsing accuracy | Data Reviewer; open; before dataset publication |
| QA-M2-002 | S2 | Browser network interception not exercised | Cannot prove PII boundary at runtime | Frontend + Security; deferred to M3/M4 |
| QA-M2-003 | S2 | C-02 credit threshold unresolved | No min/max warning behavior | Product; open; before M3 UI |
| QA-M2-004 | S2 | C-09 actual registration file format unconfirmed | Adapter may not cover production quirks | Data Parser; open; before M4 |
| QA-M2-005 | S2 | IndexedDB persistence migration not exercised | No live migration validation | Frontend; deferred to M3 |

S0/S1 luôn block. No S0/S1 findings. S2 items are `pass-with-follow-up` with identified owner/expiry.

## Limitations and skipped tests

| Test | Why skipped | Owner | Due/expiry | Re-entry trigger |
| --- | --- | --- | --- | --- |
| Browser/E2E | No app exists | Frontend | M3 | App creation |
| Real UET golden | Source requires approval/redaction | Data Reviewer | Before dataset publication | Source availability |
| Accessibility audit | No UI in M2 | Frontend | M3 | UI creation |
| Export verification | No export module in M2 | Frontend | M3 | Export implementation |
| Performance benchmarks | Package tests only; budget TBD | Tech Lead | M3 | UI/bundle creation |

## Gate decision

- Decision: **`qa-pass-with-follow-up`** for M2 package-level domain engine.
- Tester actor/date/evidence: Agent (Tester role) / 2026-10-24T18:20:00Z / commit `7faccaf`, 54/54 tests, 5/5 fixtures, 0 vulnerabilities.
- Release recommendation: **`no-go`** for public app/dataset release until M3–M5 and all downstream gates pass.
- Conditions: QA-M2-001..005 are S2 follow-ups with identified owners; none block M2 domain package verification. Real-source validation, browser evidence, persistence migration and UI tests required before G4a/G4b.
- Next owner: Tech Lead (acknowledge G3a); Security Reviewer (G3b); Independent Reviewer (G3c).
