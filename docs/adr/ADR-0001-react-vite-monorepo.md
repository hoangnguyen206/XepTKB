# ADR-0001 — TypeScript monorepo và React/Vite baseline cho MVP

> **Artifact ID:** `ADR-0001`
> **Artifact status:** `ready`
> **Canonical gate:** `G1`
> **Date:** 2026-10-20
> **Owner:** Tech Lead
> **Decision owner:** Product + Tech Lead
> **Last reviewed:** 2026-10-20
> **Related docs:** [Tech stack](../TECH_STACK.md), [Architecture](../ARCHITECTURE.md), [Implementation plan §2](../IMPLEMENTATION_PLAN.md), [PRD §4](../PRD.md)
> **Evidence envelope:** [M0-G1 threat/data-flow review](../evidence/M0-G1-threat-data-flow.md)

## Source and context

- Source of truth: `docs/TECH_STACK.md` §1–§4, `docs/ARCHITECTURE.md` §1–§7, `docs/IMPLEMENTATION_PLAN.md` §2 and §10, reviewed 2026-10-20.
- M0 needs one implementation path for strict contracts, deterministic parser/domain work and a later mobile-first PWA without introducing a backend dependency.
- Requirement/AC IDs: FR-01–FR-12; AC-01–AC-07; NFR privacy, responsive and offline constraints.
- Affected consumers: `packages/domain`, `packages/parser`, future `apps/web`, CI and fixture harness.
- Contract/schema affected: canonical TypeScript model `SCHEMA_VERSION = 0.1.0`; no public API or persisted user-data migration in M0.

## Decision

1. Use a TypeScript strict monorepo managed by npm workspaces under `packages/*`.
2. Use React + Vite as the future web-app baseline. M0 does not create the web app, PWA service worker, UI, IndexedDB store or export implementation.
3. Use project references (`tsconfig.build.json`) and package boundaries so domain/parser code can be tested without a browser or backend.
4. Keep the M0 toolchain dependency-light: TypeScript and Node's built-in test runner are sufficient for the foundation; UI/PWA/test-library dependencies are introduced only in the milestone that needs them and require their own review.
5. CI must run the repository lint guard, typecheck/build, tests and synthetic fixture runner from the lockfile.

This closes the M0 foundation choice without claiming that production hosting, PWA caching, browser matrix or vendor/legal decisions are closed.

## Scope and non-goals

- **In scope:** repository/workspace layout, strict TypeScript configuration, deterministic lint guard, CI command contract, domain/parser package boundaries and synthetic fixture harness.
- **Not in scope:** React components, Vite app, service worker, IndexedDB, search index, conflict engine, week/date engine, registration adapter, export, backend, authentication or production deployment.

## Options considered

| Option | Pros | Cons | Why not/why chosen |
| --- | --- | --- | --- |
| TypeScript + npm workspaces + React/Vite baseline | One language/contract, small local tooling, clear package references, suitable for browser-local parsing | UI/PWA dependencies remain for a later milestone | **Chosen** for M0 and the planned MVP path |
| Next.js full-stack baseline | Integrated routing/server features | Adds server boundary and a second critical path that is not needed for local/static MVP | Not chosen; conflicts with ADR-0007 |
| Single unstructured app | Fast first files | Weakens parser/domain/UI boundaries and makes privacy review harder | Not chosen; does not satisfy architecture boundary |

## Consequences

### Positive

- A clean, reproducible foundation can run offline and in CI without a backend.
- Domain/parser packages remain independently testable and can be consumed by a future web app.
- The M0 check command is deterministic and does not require real school or student files.

### Negative / risks

- The repository is not yet a user-facing app; M1–M5 remain required.
- React/Vite and PWA behavior are selected as baseline, not validated by a browser spike in M0.
- The lightweight lint guard is an M0 boundary check, not a replacement for full ESLint, accessibility or security tooling in later milestones.

### Privacy/security

- Data crossing boundaries: no new runtime data boundary in M0; CI reads repository code and synthetic fixtures only.
- Controls: raw/private/real fixture paths are ignored; lint rejects selected PII field names and dynamic/network primitives in foundation packages; CI has no registration-file input.
- Security review required: G1 design/data-flow review is required; G3b runtime verification remains a later gate.

### Operations/migration

- Rollout: enable `.github/workflows/m0-foundation.yml` on push/PR.
- Backward compatibility: no consumer-facing API change; `SCHEMA_VERSION` remains `0.1.0`.
- Migration trigger: adding an app, browser storage, network call or new dependency reopens G1 and adds a milestone-specific ADR/spec.
- Rollback trigger/target: revert this ADR's implementation changes and CI workflow; no deployed data is changed.
- Owner: Tech Lead for boundary; Coder for implementation; Tester/Security for independent verification.

## Reproducible evidence and acceptance

- Commands: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run fixtures:run`.
- CI definition: `.github/workflows/m0-foundation.yml`.
- Evidence: [M0 G1 threat/data-flow review](../evidence/M0-G1-threat-data-flow.md), [M0 implementation handoff](../evidence/M0-IMPLEMENTATION-HANDOFF.md).
- Acceptance criteria:
  - one locked workspace command runs lint, typecheck, tests and synthetic fixtures;
  - no M0 check requires a real or personal file;
  - package boundaries and schema version are explicit;
  - introducing network, PII or browser persistence is treated as out of scope and a re-entry trigger.
- Known limitations: no Product/Tech Lead approval record is fabricated here; this ADR is `ready` for the named approvers.

## Approval and risk acceptance

- Decision: `g1-blocked` pending explicit Product/Tech Lead acknowledgement of the M0 stack baseline.
- Accepted by / actor / UTC date: `N/A — docs-only; no independent approver recorded in this session`.
- Risk exception: `none`.

## Follow-up and history

| Action | Owner | Due/trigger | Status |
| --- | --- | --- | --- |
| Approve M0 stack baseline | Product + Tech Lead | Before M0 G1 close | open |
| Add Vite/React/PWA dependencies and browser spike | Frontend | M3 design entry | deferred |
| Reopen G1 if a new runtime/data boundary is introduced | Tech Lead + Security | Any boundary/contract change | standing rule |

| Change ID | Date/actor | Reason | Supersedes |
| --- | --- | --- | --- |
| ADR-0001 | 2026-10-20 / implementation session | Establish one M0 TypeScript monorepo and future React/Vite path | — |
