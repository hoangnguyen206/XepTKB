# M1 security review — parser and local provenance

> **Artifact ID:** `SEC-REVIEW-M1-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G1` design boundary + `G3b` implementation verification
> **Owner:** Security Reviewer (handoff prepared by implementer; independent sign-off pending)
> **Last reviewed:** 2026-10-20
> **Related docs:** [Security & privacy](../SECURITY_PRIVACY.md), [M1 design handoff](M1-DESIGN-HANDOFF.md), [M1 test report](M1-TEST-REPORT.md), [ADR-0008](../adr/ADR-0008-m1-parser-dependencies-local-provenance.md)
> **Evidence envelope:** [EVID-M1-001](M1-EVIDENCE-ENVELOPE.md)

## Scope and identity

- Review phase: G1 design boundary and preliminary G3b implementation verification.
- Review type: parser input safety, dependency/provenance and privacy contract.
- Base/target build: `N/A — uncommitted local working tree`; commands are reproducible local runs, not an independent security sign-off.
- Data boundary: approved non-PII timetable bytes versus user-selected registration bytes containing possible identity fields.
- Actors: user browser boundary, future app integration, parser package, future admin/reviewer; no server path is implemented in M1.

## Data-flow and threat checks

| Check/control | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Registration raw bytes/PII network | none | adapter accepts bytes synchronously; no network dependency or call; browser interception unavailable without app | pass by code scope; G3b browser evidence pending |
| Logs/Sentry/analytics scrub | no PII/secret | no logging/analytics path; fixture runner prints counts/issues; synthetic identity assertions | pass locally; future app review required |
| Auth/RBAC/RLS/share token | not in M1 | no backend/auth/share implementation | N/A — deferred |
| File parser/XSS/CSP | bounded/inert/no execution | bounded ZIP/XML, DOCTYPE/entity rejection, text extraction, no script injection; malformed/size tests | pass locally; broader stress matrix pending |
| SSRF/rate limit/budget | no outbound path | no URL fetch or external service | N/A — deferred |
| Secrets/dependencies | no leak; reviewed | lockfile and `npm audit --omit=dev` reports 0 vulnerabilities; dependency decision in ADR-0008 | pass locally; independent review pending |
| Artifact integrity/provenance | timetable hash; registration no hash/filename | validator and adapter tests enforce split | pass locally |
| Retention/deletion/consent | local app policy | no storage/UI in M1 | N/A — deferred |

## Findings and exceptions

| Finding ID | Severity | Scenario/impact | Evidence/repro | Fix/owner/status |
| --- | --- | --- | --- | --- |
| SEC-M1-001 | S2 | No approved real UET workbook means source drift is not tested | synthetic manifests only | Data Reviewer; open before dataset publication |
| SEC-M1-002 | S2 | Browser network boundary is not exercised because no app exists | no browser test target | Frontend + Security in M3/M4; open |
| SEC-M1-003 | S2 | ZIP bomb/entry-count/encrypted-workbook stress cases are not in the local matrix | OOXML tests cover malformed and size limits only | Security + Tester; open before production parser freeze |
| SEC-M1-004 | process | Independent Security/Reviewer acknowledgement is not recorded | this document is implementer-prepared | Security Reviewer; pending |

- Waiver/exception: none. Open S2 items are not release-accepted; M1 has no release recommendation.
- No S0/S1 finding is known from the local checks, but this is not a substitute for independent G3b review.

## Decision

- Decision: `security-pass-with-exception` for the bounded, offline M1 package implementation only; `security-no-go` for public app/dataset release until the listed follow-ups and independent gate are complete.
- Required remediation/retest: run browser network interception once file import exists; validate approved real/redacted UET input; expand hostile OOXML tests; record independent actor/date/evidence.
- Actor/date/UTC: `N/A — Security Reviewer acknowledgement pending`.
- Next owner acknowledgement: Security Reviewer, Data Reviewer and Independent Reviewer.
