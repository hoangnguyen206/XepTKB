# M0 G1 threat/data-flow review

> **Artifact ID:** `SEC-REVIEW-M0-G1`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G1`
> **Owner:** Security Reviewer
> **Last reviewed:** 2026-10-20
> **Related docs:** [Security & privacy](../SECURITY_PRIVACY.md), [Architecture](../ARCHITECTURE.md), [Tech stack](../TECH_STACK.md), [ADR-0001](../adr/ADR-0001-react-vite-monorepo.md), [ADR-0007](../adr/ADR-0007-static-artifact-cli-admin.md), [Implementation plan](../IMPLEMENTATION_PLAN.md)
> **Evidence envelope:** [M0 implementation handoff](M0-IMPLEMENTATION-HANDOFF.md)

## Scope and identity

- Review phase: `G1 design boundary`
- Review type: threat model / privacy / dependency and repository boundary
- Base/target commit/diff/build ID: `N/A — working tree; no immutable commit created in this session`
- Source design/spec/ADR + versions: docs reviewed 2026-10-20; canonical schema `0.1.0`
- Data boundary/actors: developer/CI ↔ repository; synthetic fixtures only; no browser upload, backend, CDN or student file in M0
- Test/tool/run IDs and versions: `N/A — this is a design review; local command results are recorded in M0 handoff`

## Data-flow and threat checks

| Check/control | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Registration raw bytes/PII network | none in M0 | No registration adapter, web app or network client exists in M0; fixture paths for real/private data are ignored | pass by scope; later G3b required |
| Logs/Sentry/analytics scrub | no PII/secret | No runtime telemetry exists; lint rejects selected PII field names in foundation packages | pass by scope; later implementation verification required |
| Auth/RBAC/RLS/share token | not introduced in M0 | ADR-0007 defers backend/control plane; no auth/API code in current foundation | N/A — deferred |
| File parser/XSS/CSP | no file execution | M0 adapter contract is synchronous and offline; current foundation does not parse HTML/XLSX or execute input | pass by scope; M1/M4 security tests required |
| SSRF/rate limit/budget | no outbound requests | Foundation package source is checked for `fetch(` and has no network client | pass by scope |
| Secrets/dependencies | no secret in repo; lockfile reproducible | `.gitignore` excludes env/key files and private/raw fixtures; lockfile pins TypeScript/Node types; CI uses `npm ci` | pass for M0 repository boundary; dependency audit deferred |
| Artifact integrity/provenance | explicit schema/hash/source fields | domain types include `SourceRef`, `ImportArtifact`, schema version and validation; synthetic fixtures carry source refs | pass for M0 contract; artifact publication is M5 |
| Retention/deletion/consent | no personal storage in M0 | No IndexedDB/account/analytics implementation; privacy boundary is documented | N/A — deferred |

## Findings and exceptions

| Finding ID | Severity | Scenario/impact | Evidence/repro | Fix/owner/status |
| --- | --- | --- | --- | --- |
| SEC-M0-001 | S2 | If a future contributor treats the current foundation lint as a complete security scanner, a new dependency or input path could bypass deeper checks. | `scripts/lint.mjs` is intentionally a small M0 guard; full security criteria remain in `SECURITY_PRIVACY.md` §9. | Keep the guard narrow and require G1/G3b re-entry for network, browser storage, parser input or backend changes. Owner: Tech Lead; status: accepted follow-up for M1/M3/M4. |

- Waiver/exception: none. SEC-M0-001 is not a release waiver; it is a documented limitation for later milestone work.

## Decision

- Decision: `security-design-pass` for the **M0 boundary design only**, pending Security Reviewer acknowledgement.
- Required remediation/retest: independent reviewer must acknowledge this report; any new PII/vendor/auth/external boundary reopens G1 and requires a new review.
- Actor/date/UTC: `N/A — docs-only draft; no Security Reviewer sign-off recorded in this session`.
- Next owner acknowledgement: Security Reviewer, then Tech Lead records `g1-approved` or `g1-blocked`.
