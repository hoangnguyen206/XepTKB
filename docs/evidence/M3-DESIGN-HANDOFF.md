# M3 design handoff — Core UI & export

> **Artifact ID:** `DESIGN-M3-001`  
> **Artifact status:** `ready`  
> **Canonical gate:** `G1`  
> **Owner:** Tech Lead + Frontend  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [M3 spec](M3-SPEC.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [Architecture](../ARCHITECTURE.md), [Domain model](../DOMAIN_MODEL.md), [Security & privacy](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md)

## Context and source

- Source: SPEC-M3-001; `IMPLEMENTATION_PLAN.md` §2 (M3 row), §4 steps 1–7; ADR-0010.
- Constraint: UI never re-implements domain rules; one network module; no PII in M3; mobile-first 360 px.

## Decision/design

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `scripts/build-synthetic-dataset.mjs` | Build a synthetic workbook, run `uet-xlsx`, fail on any parser error, write `timetable.json`, `metadata.json`, `manifest.json` with sha256/bytes into `apps/web/public/data/` (git-ignored) | compiled `@ky-nay/parser` (adapter + `UET_TIMEFRAME`) and its compiled test helper `packages/parser/dist/test/synthetic-xlsx.js` for the workbook bytes (REV-M3-009f); note QA-M3-009: zip mtime is not fixed, so hashes differ per build |
| `packages/export` | `formatWeeks`, day/period labels, `scheduledSessions`, `occurrencesForWeek`/`allOccurrences`, `buildGridLayout` (lanes for overlaps), `buildIcs`, `buildWordDoc` | `@ky-nay/domain` |
| `apps/web/src/data` | artifact contract types, validation, loader (fetch + WebCrypto + cache) | domain, storage |
| `apps/web/src/storage` | IndexedDB wrapper, Plan envelope + migrations, dataset cache, wipe | domain |
| `apps/web/src/model` | catalog/search index, picker options + conflict preview text, week helpers, credits view, stale/rebase | domain, export |
| `apps/web/src/components` | header/provenance, banners, onboarding, search/picker, week grid, day list, plan summary, export panel, print sheet | model |
| `apps/web/src/export` | file download helper, canvas PNG renderer | export |
| `apps/web/vite.config.ts` | React plugin, build-only CSP meta, SW precache plugin, Vitest config | — |

Data flow and trust boundary: browser ↔ same-origin `data/*` (public, hash-checked) is the only network edge. IndexedDB holds the cached dataset and the draft Plan. Exports are generated locally and downloaded via `Blob` URLs; nothing is uploaded.

Schema/contract: artifact manifest `1.0` + domain `0.2.0` (ADR-0010 §2); Plan envelope `schemaVersion = 0.2.0` with migration from `0.1.0`.

## Alternatives and rationale

See ADR-0010 options table (dependency set, catalog shape, ICS shape, PNG approach).

## Operational and quality impact

- Privacy/security: CSP meta in build, escaping in UI/exports, single fetch module enforced by lint, no analytics, wipe button.
- Accessibility: landmarks + skip link, labelled controls, tab pattern with arrow keys, text conflict markers, focus-visible outline, ≥ 44 px targets, reduced-motion safe.
- Offline: SW app shell + IndexedDB dataset/Plan; offline banner.
- Observability: none in M3 (Q-008).
- Rollback: revert the M3 commit; local data stays readable because the Plan schema is unchanged (`0.2.0`).

## Verification plan

- Unit/component: `npm run check` (node:test for packages, Vitest for web).
- E2E: `npm run test:e2e` — onboarding (both paths), search/pick/conflict, grid/day list, persistence, offline reload on the production build, viewport 360/768/1200 overflow, axe WCAG 2.1 A/AA, keyboard-only path, ICS/PNG/Word downloads.
- Security: lint guard, CSP present in build, XSS payload in synthetic dataset rendered as text, network log shows same-origin requests only.
- Manual (owner): ICS import into a calendar client, PNG/Word/print visual check, Tier 1 devices.

## Approval

- Product scope approval: pending (see SPEC-M3-001 §9).
- Tech Lead design approval: pending.
- Security consultation: CSP/storage/SW reviewed at G3b by an independent agent; human sign-off pending.
- Decision: `g1-blocked` until acknowledged; implementation proceeds on owner instruction (2026-10-25).
