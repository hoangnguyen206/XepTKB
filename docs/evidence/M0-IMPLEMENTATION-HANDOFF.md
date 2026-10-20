# M0 implementation handoff

> **Artifact ID:** `IMPL-M0-001`
> **Artifact status:** `needs_review`
> **Canonical gate:** `G2`
> **Task/PR:** `M0 Foundation & decisions`
> **Owner:** Tech Lead
> **Implementer:** Coder/Data Parser foundation work
> **Last reviewed:** 2026-10-20
> **Related docs:** [Implementation plan](../IMPLEMENTATION_PLAN.md), [ADR-0001](../adr/ADR-0001-react-vite-monorepo.md), [ADR-0006](../adr/ADR-0006-default-th-weeks.md), [ADR-0007](../adr/ADR-0007-static-artifact-cli-admin.md), [QA plan](../QA_TEST_PLAN.md), [Security review](M0-G1-threat-data-flow.md)
> **Evidence envelope:** `N/A — this handoff is the M0 evidence envelope`
> **Receiving owner / acknowledgement:** Tester, Security Reviewer, Independent Reviewer — pending

## Source and immutable identity

- Approved spec/ADR/design IDs + versions/hashes: `IMPLEMENTATION_PLAN.md` M0; `TECH_STACK.md`; `ARCHITECTURE.md`; `SECURITY_PRIVACY.md`; `QA_TEST_PLAN.md`; ADR-0001/0006/0007; no immutable source hash recorded.
- Base commit/diff ID: `N/A — uncommitted working tree`
- Target commit/PR/build ID: `N/A — no commit/PR created`
- CI/test/import run IDs: local commands below; CI workflow not remotely executed in this session
- Toolchain versions: Node/npm from local environment; TypeScript `5.9.3` in lockfile; Node engine `>=20`
- Exact commands + exit codes:
  - `npm run build` — exit `0`
  - `npm test` — exit `0`, 17 tests passed
  - `npm run fixtures:run` — exit `0`, 2/2 fixture cases passed
  - `npm run lint` — exit `0`, foundation checks passed
  - `npm run check` — exit `0`, lint/typecheck/build/tests/fixtures all passed

## Outcome and scope

- Outcome: establish a strict npm-workspace shell, canonical type/validation package boundary, deterministic offline fixture harness, synthetic fixture policy, M0 ADRs, threat/data-flow review draft and CI command.
- In scope: package shell, TypeScript project references, lockfile, synthetic fixtures, lint guard, CI workflow and M0 evidence documents.
- Out of scope: all M1 source adapters (`uet-xlsx`, `vnu-registration-html`), M2 search/conflict/week/date/merge engine, UI/PWA, IndexedDB, export, backend, admin publish and real source files.
- Requirement/AC/P0 coverage: `no` for the product P0 set; M0 only establishes prerequisites. M1–M5 must provide feature evidence before release.

## Changed artefacts

| File/module/contract | Change | Why | Migration/compatibility | Evidence |
| --- | --- | --- | --- | --- |
| `package.json`, `package-lock.json` | workspace scripts and locked toolchain | reproducible M0 checks | no persisted data migration | local build/test results |
| `tsconfig.base.json`, `tsconfig.build.json`, package tsconfigs | strict project references | keep package boundaries explicit | schema remains `0.1.0` | build exit 0 |
| `packages/domain` | canonical types/issues/validation foundation | establish domain contract without M2 engine | future breaking model bumps schema | domain tests |
| `packages/parser` | offline adapter contract, manifest, fixture runner and note helper | establish deterministic parser boundary/harness | source-specific adapters deferred to M1 | fixture tests |
| `fixtures/**` | synthetic valid/adversarial inputs and manifests | enforce Q-006 policy without PII | real fixtures remain external | 2/2 fixture run |
| `scripts/lint.mjs` | no-network/dynamic-code/selected-PII foundation guard | low-dependency CI boundary check | not a replacement for later security tooling | exit 0 |
| `.github/workflows/m0-foundation.yml` | CI install + check command | M0 exit criterion requires CI | CI must be run by repository host | workflow defined; remote run pending |
| `docs/adr/*`, `docs/evidence/*` | decisions and gate handoffs | make G1/G2 auditable | approvers still pending | docs-only evidence |

## Data and integrity

- Fixture manifest + hash: manifest files are committed synthetic metadata; each declared fixture input SHA-256 is recorded in the manifest and verified by the runner; the manifest file hash itself is not recorded.
- Input/source hash: `N/A — no approved real source input`
- Output/artifact/manifest hash: `N/A — no publish artifact`
- Schema/parser/dataset version: schema `0.1.0`; canonical adapter `0.1.0`; fixture manifest `1`
- New data fields/boundary: no runtime PII or external boundary; synthetic source references only.

## Acceptance mapping

| Criterion | Implementation | Test/evidence | Result |
| --- | --- | --- | --- |
| M0 repo/monorepo shell | npm workspaces + project refs | `npm run build` | pass locally |
| CI lint + typecheck | lint script + `typecheck` + workflow | `npm run check` and CI | local pass; remote CI pending |
| ADR stack/backend decision | ADR-0001 and ADR-0007 | docs review | ready; approval pending |
| G1 threat/data-flow | M0 security review | `M0-G1-threat-data-flow.md` | draft/pass-by-scope; Security acknowledgement pending |
| Fixture policy + synthetic fixture | manifests + smoke/adversarial files | `npm run fixtures:run` | pass locally |

## Test and verification

- Automated suites/results: build pass; 17 Node tests pass; 2/2 fixture entries pass.
- Manual checks: inspected manifests and source paths for synthetic-only content; no browser/app exists in M0.
- Tests not run and why: GitHub Actions has not been executed from this local session; no browser/security/network interception is applicable to M0.
- Skipped test owner + due/expiry: Tester to run CI and independent QA before G3a; Security Reviewer to acknowledge G1; no release expiry because M0 is not a release.
- Known limitations/findings: foundation remains pre-M1; no real UET format coverage; no app/UI; no runtime PII boundary implementation.

## Data/privacy/security

- PII/secret handling: ignored private/raw/real fixture paths; synthetic fixtures only; no credentials or raw registration data.
- Security review needed: yes, G1 design review; report is prepared but not independently signed.
- Logging/analytics impact: none; foundation commands print counts/issues only, not personal content.
- Re-open trigger: any network call, browser storage, source-format parser, registration input, backend/auth, or schema contract change.

## Risks, rollout and rollback

- Migration/compatibility: no persisted data; schema version remains `0.1.0`.
- Rollout/feature flag: CI workflow activates on push/PR; no production rollout.
- Rollback trigger/target/procedure: revert M0 scripts/workflow/docs; retain original docs only if the team rejects the foundation decision.
- Monitoring/alert: GitHub Actions result; no production monitoring in M0.

## Handoff decision

- Recommendation: `ready-for-verification`; local `npm run check` passes, but independent Tester/Security/Reviewer acknowledgements and remote CI remain pending.
- Implementer actor/date: `N/A — actor not recorded in repository evidence`
- Tech Lead readiness decision/date/evidence: `N/A — this is a draft handoff, not self-approval`
- Next owner/action: run `npm run check`, then Tester/Security/Reviewer record independent decisions.
- Open questions: Product/Tech Lead approval of ADR-0001; Security acknowledgement of M0 G1 review; whether CI executes successfully on the repository host.
