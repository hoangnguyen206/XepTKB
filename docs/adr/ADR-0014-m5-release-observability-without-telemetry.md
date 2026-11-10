# ADR-0014 — M5 release observability without runtime telemetry, and a report-issue channel without network egress

> **Artifact ID:** `ADR-0014`  
> **Artifact status:** `proposed` — G1 decision pending Owner sign-off  
> **Canonical gate:** `G1`  
> **Date:** 2026-11-10  
> **Owner:** Tech Lead + Release Manager  
> **Decision owner:** Owner (Product + Security), from decision `D-M5-2` recorded 2026-11-10  
> **Last reviewed:** 2026-11-10  
> **Related docs:** [M5 design handoff (DESIGN-M5-001)](../evidence/M5-DESIGN-HANDOFF.md), [M5 spec (SPEC-M5-001)](../evidence/M5-SPEC.md), [ADR-0010](ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0012](ADR-0012-dataset-publish-pipeline.md), [ADR-0013](ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [Architecture §9](../ARCHITECTURE.md), [Security & privacy §7](../SECURITY_PRIVACY.md), [Operations §5](../OPERATIONS.md), [PRD §9](../PRD.md)  
> **Evidence envelope:** `EVID-M5-001` (created at G2; this ADR is `N/A — docs-only`)

## Source and context

- `ARCHITECTURE.md` §9 and `OPERATIONS.md` §5 describe client error reporting, product counters and alerting. `PRD.md` §9 / `Q-008` allow only cookieless aggregate counters, and only after a privacy notice, an opt-out and a legal review. That review has not happened.
- M5 has to make the first release operable: know which build is live, notice stale or broken data, give users a way to report wrong timetable data, and roll back. The current boundary must stay closed: one network module `apps/web/src/data/loader.ts`, same-origin `GET` only, CSP `connect-src 'self'`, lint bans on beacons and navigation sinks, and no PII in network, logs or storage (ADR-0010 §4, ADR-0013 §4).
- Owner decision `D-M5-2` (2026-11-10): no runtime telemetry in the first release.
- Affected modules: `apps/web` (footer, report form, About panel, error boundary), `apps/web/vite.config.ts` (build-time constants), `scripts/` (smoke, secret scan), `docs/OPERATIONS.md`. No contract, schema or IndexedDB version changes.

## Decision

1. **No runtime telemetry in the first public release.** The app sends no analytics, counters, error reports, beacons, pings or third-party scripts. No new network call is added anywhere in `apps/web/src`. `loader.ts` stays the only network module, and CSP and the lint rules are unchanged.
2. **Observability uses only signals outside the user's browser:**
   - Cloudflare Pages build/deploy status;
   - `scripts/smoke-deploy.mjs`, which the Owner runs by hand after each preview or production deploy. It checks headers, the build meta tag, the manifest and the artifact hashes. It never runs in CI against production;
   - a manual release checklist;
   - issue reports that users start themselves.

   The monitoring window and its owner are defined in `OPERATIONS.md` §5.
3. **Build identity in the UI.** `version` (root `package.json`), short `commit` (`CF_PAGES_COMMIT_SHA` → `WORKERS_CI_COMMIT_SHA` → `GITHUB_SHA` → `git` → `unknown`), `builtAt` and `channel` are injected at build time. They are shown in the footer and the error screen, copied into reports, and emitted as `<meta name="ky-nay-build">` so the smoke script can tell which build is served.
4. **Report-issue channel without egress.** The app builds a PII-free plain-text report: app build, dataset version/term/status, optional section id/course code, one field from a fixed list, and a user note of at most 500 characters with a personal-data warning. The user can then:
   - copy it to the clipboard (`navigator.clipboard.writeText`, with a read-only textarea as fallback); or
   - follow a link to `VITE_REPORT_ISSUE_URL`, if one was configured at build time. The URL is validated at build (`https:` only, `http:` only for localhost; no userinfo; ≤ 2048 characters; an invalid value fails the build) and checked again at runtime. It is rendered as a plain `<a target="_blank" rel="noopener noreferrer">`. The app **never appends report content or identifiers to the URL**.

   With no URL configured, the UI is copy-only plus instructions.
5. **Local-only failure handling.** The React error boundary offers reload and wipe of local data. It shows only the build id and the error name, and it does not log or report anything.

## Scope and non-goals

- In scope: points 1–5 for M5 and the first public release (G4a).
- Not in scope:
  - counters and client error reporting (P1, Q-008, re-opened only by a new ADR after legal review);
  - prefilled issue URLs;
  - a server-side report inbox;
  - a manifest `statusMessage` field (P1, a schema change);
  - uptime probes run by third parties against the site.

## Options considered

| Option | Pros | Cons | Why not/why chosen |
| --- | --- | --- | --- |
| A. No telemetry; deploy status + manual smoke + user reports (chosen) | No new boundary, no consent/legal dependency, nothing to secure server-side | Blind to client errors nobody reports, and no usage numbers | Fits `D-M5-2`, the privacy promise in `PRIVACY_NOTE` and the time left before the HK II window |
| B. Cookieless aggregate counters (PRD §9) | Usage trends for the registration season | Needs an endpoint, privacy notice, opt-out and legal review, and widens `connect-src` | Deferred to P1 until legal review |
| C. Client error reporting (Sentry or similar) | Finds crashes quickly | Third-party vendor, needs a data-region review (D-004 open), and risks leaking PII in breadcrumbs | Rejected for the first release |
| D. Report link with a prefilled query (`?body=`) | One click for the user | The user's free text, which may hold PII, ends up in third-party URLs and logs | Rejected; copy, then paste |
| E. `fetch`/form POST to a report endpoint | Structured inbox | Opens network egress and needs a backend, CSP and lint changes | Rejected |

## Consequences

### Positive

- The privacy boundary stays exactly as approved in ADR-0010/0013, and G3b only has to verify that nothing changed, plus the link and the clipboard.
- Every build can be identified in the UI, in reports and in smoke output.

### Negative / risks

- Runtime failures that nobody reports go unseen. Mitigations: error boundary, stale-data banners, Owner checks of reports during the registration week, and a smoke run after every deploy.
- Embedding the build id changes the service worker cache name on every commit, so users see the update banner even after docs-only deploys.
- Each user reports by hand, and some may paste personal data into a third-party form. Mitigations: an inline warning and no prefilling.

### Privacy/security

- Data crossing boundaries:
  - the clipboard (local OS);
  - a top-level navigation to an Owner-configured `https:` URL. No app data is attached, and `Referrer-Policy: no-referrer` applies.
- Threat/control:
  - URL injection: build-time and runtime validation;
  - tabnabbing: `rel="noopener noreferrer"`;
  - stray use of the constants: new lint rule restricting `__KY_NAY_REPORT_URL__`/`__KY_NAY_BUILD__` to `apps/web/src/app/build-info.ts`;
  - secrets in the repo: `scripts/secret-scan.mjs` in CI.
- Security review required: G1 consultation on this ADR; G3b verifies the e2e zero-request report window and the link attributes.

### Operations/migration

- Rollout: ships with M5; `VITE_REPORT_ISSUE_URL` is unset by default (copy-only).
- Backward compatibility: no schema, contract or IndexedDB change.
- Migration trigger and steps: none. Introducing telemetry later requires a new ADR that supersedes points 1–2.
- Rollback trigger and target: revert the M5 merge or roll back in Pages. To retarget the report link, rebuild with the variable changed or unset.
- Owner: Release Manager.

## Reproducible evidence and acceptance

- Spike/test runs: none yet (`N/A — docs-only`). G2 evidence is listed in DESIGN-M5-001 §9.
- Acceptance criteria:
  - lint passes and `loader.ts` is still the only network module;
  - e2e shows zero requests during the report flow and only same-origin `GET` overall;
  - the report text contains only the allowed fields;
  - an invalid `VITE_REPORT_ISSUE_URL` fails the build;
  - the footer and `meta ky-nay-build` match the deployed commit (checked by smoke);
  - `OPERATIONS.md` §5 defines the monitoring window and owner.
- Known limitations: no usage or error metrics, and reports can't be matched to sessions.

## Approval and risk acceptance

- Decision: pending (`g1-approved` / `g1-blocked`).
- Accepted by / actor / UTC date: pending — Owner (Tech Lead + Security).
- Risk exception: none proposed. The lack of runtime error visibility is accepted by design (`D-M5-2`), not by exception.

## Follow-up and history

| Action | Owner | Due/trigger | Status |
| --- | --- | --- | --- |
| Legal review of counters (Q-008) before any telemetry ADR | Product | before P1 analytics work | open |
| Update `ARCHITECTURE.md` §9 and `SECURITY_PRIVACY.md` §7 to point here | Tech Lead (WP3) | M5 G2 | open |
| Owner chooses the report link target (none / GitHub issues / form) | Owner | M5 G1 sign-off | open |

| Change ID | Date/actor | Reason | Supersedes |
| --- | --- | --- | --- |
| ADR-0014-r0 | 2026-11-10 / Tech Lead (agent) | Initial proposal from `D-M5-2` and DESIGN-M5-001 | none (narrows ARCHITECTURE §9 / OPERATIONS §5 for the first release) |
