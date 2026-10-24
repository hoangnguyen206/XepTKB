# M2 security review — domain engine G3b verification

> **Artifact ID:** `SEC-REVIEW-M2-001`  
> **Artifact status:** `ready`  
> **Canonical gate:** `G3b`  
> **Owner:** Security Reviewer  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [Security & privacy](../SECURITY_PRIVACY.md), [M2 design handoff](M2-DESIGN-HANDOFF.md), [M2 implementation handoff](M2-IMPLEMENTATION-HANDOFF.md), [M1 security review](M1-SECURITY-REVIEW.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md)  
> **Evidence envelope:** [EVID-M2-002](M2-EVIDENCE-ENVELOPE-v2.md)  
> **Supersedes:** M1 security review for domain-specific modules

## Scope and identity

- Review phase: `G3b implementation verification`.
- Review type: code / dependency / privacy / data boundary.
- Base commit: `61ee300` (feat: implement M2 domain engine).
- Target commit: `7faccaf` (fix: normalize CRLF for cross-platform SHA-256 hash stability).
- Source design/spec/ADR: `SECURITY_PRIVACY.md`, `DOMAIN_MODEL.md`, ADR-0009, M2 design handoff.
- Data boundary/actors: user browser (future) → parser packages (existing M1) → domain packages (M2) → no storage/network/server.
- Test/tool/run IDs: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` 54/54 exit 0; `npm audit --omit=dev` 0 vulnerabilities.

## Code review scope

All 11 files in `packages/domain/src/` and the `runner.ts` patch in `packages/parser/src/`:

| Module | Purpose | Lines | Security-relevant findings |
| --- | --- | ---: | --- |
| `types.ts` | Schema 0.2.0 type definitions | 190 | No executable logic; `Override.from` is `unknown` — safe since it's never evaluated |
| `normalize.ts` | Unicode/code/section normalization | 97 | Pure string transforms; NFD → strip diacritics + NFC; no regex DoS risk (linear patterns) |
| `search.ts` | Search index build + query | 118 | Deterministic; empty query returns []; no external input execution |
| `plan.ts` | Plan creation/resolution | 155 | Pure validation; `final` mirroring enforced; timestamp validated via RFC3339 regex |
| `conflict.ts` | Conflict engine | 142 | Period/week intersection only; non-fixed sessions excluded; canonical pair ordering |
| `week-date.ts` | Civil date arithmetic | 64 | UTC-only Date construction; no `Intl`/timezone parsing; label-only `Asia/Ho_Chi_Minh` |
| `registration-merge.ts` | Field-level merge | 272 | Fail-closed on ambiguity; timetable Sections immutable; `applyField` validates all values |
| `credits.ts` | Credit summary | 61 | Integer-cent precision; unknown ≠ 0; no threshold invention |
| `validate.ts` | Domain invariant checks | 120 | Artifact validation: registration must be `localOnly`; no hash/filename for local |
| `issues.ts` | Issue taxonomy | 118 | Type-only; `rawValue` docstring warns no PII |
| `runner.ts` (patch) | CRLF normalization for hash | 147 | `normalizeCrlf` operates on byte array; raw bytes still passed to parser |

## Data-flow and threat checks

| Check/control | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Registration raw bytes/PII network | none in M2 | M2 domain imports normalized candidates only; no raw HTML/bytes; `registration-merge.ts` consumes `Section` objects not file content; no `fetch`/`XMLHttpRequest`/`navigator`/`window` in packages source | **pass** |
| Logs/Sentry/analytics scrub | no PII/secret | No logging/analytics paths; `DomainIssue.message` uses section/session IDs (not PII); `rawValue` comment warns against PII | **pass** |
| Auth/RBAC/RLS/share token | not in M2 | No backend/auth/share implementation | **N/A — deferred** |
| File parser/XSS/CSP | safe handling | M2 does not parse files; M1 parser handles OOXML/HTML with bounded ZIP, DOCTYPE rejection, text-only extraction; `normalizeCrlf` is byte-level, no eval/script | **pass** |
| SSRF/rate limit/budget | no outbound path | `grep` confirms 0 hits for `fetch`/`http://` in source (only XML namespace URIs in test helpers) | **pass** |
| Secrets/dependencies | no leak; reviewed | `grep` confirms 0 hits for `secret`/`password`/`credential`/`process.env`; `npm audit --omit=dev` = 0 vulnerabilities; dependency set unchanged from M1 (`fflate`, `@xmldom/xmldom`) | **pass** |
| Artifact integrity/provenance | timetable hash; registration no hash/filename | `validateArtifact()` enforces: registration must be `localOnly: true`; `sha256` and `fileName` prohibited for local-only; non-local requires valid hex SHA-256 | **pass** |
| Retention/deletion/consent | no storage in M2 | No IndexedDB/localStorage/sessionStorage usage | **N/A — deferred** |
| Dynamic code execution | none | `grep` confirms 0 hits for `eval`/`Function(`/`import(`/`innerHTML`/`document.write` in packages source | **pass** |
| Override precedence safety | registration < admin < user | `applyExistingOverrides` sorts by rank `{registration:1, admin:2, user:3}`; conflicting same-rank overrides produce `CONFLICTING_OVERRIDES` error | **pass** |
| Immutability of timetable source | timetable Sections not mutated | `mergeRegistration` clones sessions via `cloneSession()`; final Plan is a new object; `effective.set()` builds new Section | **pass** |

## Findings and exceptions

| Finding ID | Severity | Scenario/impact | Evidence/repro | Fix/owner/status |
| --- | --- | --- | --- | --- |
| SEC-M2-001 | S2 | Browser network boundary not exercised | No app exists; cannot intercept registration bytes in browser | Frontend + Security; deferred to M3/M4; blocks G4a |
| SEC-M2-002 | S2 | ZIP bomb/encrypted workbook stress coverage limited | M1 tests cover malformed + size limits but not adversarial ZIP nesting | Security + Tester; open before parser freeze |
| SEC-M2-003 | S2 | Real registration file format unconfirmed (C-09) | Adapter tested with synthetic HTML only | Data Parser; open |
| SEC-M2-004 | process | Independent Security Reviewer acknowledgement formalized | This report serves as the first independent-role verification | — |

- Waiver/exception: none. No S0/S1 found.
- Open S2 items are inherited from M1 security review (SEC-M1-001..003) and do not introduce new risk from M2 code.

## Privacy boundary verification

M2 domain engine is a **pure computation layer** with no external I/O:

1. **No file access**: domain modules do not import `fs`, `path`, `crypto` or any Node built-in.
2. **No network access**: zero HTTP/fetch/WebSocket calls.
3. **No storage access**: zero IndexedDB/localStorage/cookie usage.
4. **No PII processing**: domain receives `Section`/`Session` objects (course codes, periods, weeks, rooms) — never student names, IDs, or dates of birth.
5. **Registration boundary**: `registration-merge.ts` consumes normalized `Section[]` from M1 adapter output; raw `.doc` bytes never enter domain packages.
6. **Override provenance**: every `Override` records `source` ("registration"/"user"/"admin-correction") and `reason`; changes are traceable.

## Decision

- Decision: **`security-pass-with-exception`** for M2 package-level domain engine implementation.
- S2 exceptions: SEC-M2-001..003 are inherited process/coverage gaps, not M2-introduced vulnerabilities. They have identified owners and are tracked for resolution before G4a/G4b.
- Required remediation/retest: browser network interception evidence (M3/M4); ZIP stress expansion (pre-parser-freeze); real registration file validation (M4).
- Actor/date/UTC: Agent (Security Reviewer role) / 2026-10-24T18:25:00Z.
- Next owner acknowledgement: Tech Lead (record decision); Independent Reviewer (G3c); Release Manager (pre-G4 assessment).
