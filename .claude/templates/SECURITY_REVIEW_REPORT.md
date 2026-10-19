# Security review report template

> **Artifact ID:** `SEC-REVIEW-XXX`  
> **Artifact status:** `draft | needs_review | approved | blocked`  
> **Canonical gate:** `G1` (design boundary review) hoặc `G3b` (implementation verification)  
> **Owner:** Security Reviewer  
> **Last reviewed:** YYYY-MM-DD  
> **Related docs:**  
> **Evidence envelope:** `EVID-XXX`

## Scope and identity

- Review phase: `G1 design boundary` hoặc `G3b implementation verification`
- Review type: threat model / code / dependency / privacy / release
- Base commit/diff/build ID:
- Target commit/diff/build ID:
- Source design/spec/ADR + versions:
- Data boundary/actors:
- Test/tool/run IDs and versions:

## Data-flow and threat checks

| Check/control | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Registration raw bytes/PII network | none |  | pass/fail/NA |
| Logs/Sentry/analytics scrub | no PII/secret |  | pass/fail/NA |
| Auth/RBAC/RLS/share token | enforced server-side |  | pass/fail/NA |
| File parser/XSS/CSP | safe handling |  | pass/fail/NA |
| SSRF/rate limit/budget | bounded/allowlisted |  | pass/fail/NA |
| Secrets/dependencies | no leak, reviewed |  | pass/fail/NA |
| Artifact integrity/provenance | validated |  | pass/fail/NA |
| Retention/deletion/consent | documented |  | pass/fail/NA |

## Findings and exceptions

| Finding ID | Severity | Scenario/impact | Evidence/repro | Fix/owner/status |
| --- | --- | --- | --- | --- |
| SEC- | S0/S1/S2/S3 |  |  |  |

- Waiver/exception: scope, mitigation, owner, expiry, approving actor/date (or `none`).
- S0/S1 cannot be waived for release; S2/S3 only with explicit risk acceptance.

## Decision

- Decision: `security-design-pass | security-pass | security-pass-with-exception | security-no-go`
- Required remediation/retest:
- Actor/date/UTC:
- Next owner acknowledgement:
