# ADR-0010 — M3 web app, artifact loader contract, local storage and export

> **Artifact ID:** `ADR-0010`  
> **Artifact status:** `ready` — G1 acknowledgement pending; G3 found open items (see Status after G3)  
> **Canonical gate:** `G1`  
> **Date:** 2026-10-25  
> **Owner:** Tech Lead + Frontend  
> **Decision owner:** Tech Lead (Security consulted for CSP/storage boundary)  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [M3 spec](../evidence/M3-SPEC.md), [M3 design handoff](../evidence/M3-DESIGN-HANDOFF.md), [ADR-0001](ADR-0001-react-vite-monorepo.md), [Tech stack](../TECH_STACK.md), [API and data contracts §3](../API_AND_DATA_CONTRACTS.md), [Domain model §9](../DOMAIN_MODEL.md), [Security & privacy §5](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** [EVID-M3-001](../evidence/M3-EVIDENCE-ENVELOPE.md)

## Source and context

- M3 needs the first browser runtime: web app, artifact loader, IndexedDB, service worker and export. ADR-0001 deferred UI/PWA/test dependencies to "the milestone that needs them, with their own review".
- `TECH_STACK.md` §5 and `API_AND_DATA_CONTRACTS.md` §3 describe the static manifest with slightly different field lists and no concrete file for timetable/metadata payloads; M3 needs one exact contract to validate against.
- Requirements: FR-01–FR-08, FR-11; AC-01, AC-06, AC-07; NFR responsive/accessibility/offline/privacy.

## Decision

### 1. App and dependencies

1. `apps/web` is an npm workspace: React 19 + Vite 8, TypeScript strict, plain CSS with custom-property tokens.
2. Runtime dependencies: `react@19.3.0`, `react-dom@19.3.0`; workspace packages `@ky-nay/domain` and `@ky-nay/export`. The parser package is **not** imported by the app in M3 (registration import is M4; ADR-0008 browser entry stays reserved for it).
3. Dev dependencies: `vite@8.3.4`, `@vitejs/plugin-react@6.1.2`, `vitest@5.0.3`, `jsdom@30.1.2`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`, `@testing-library/user-event@14.6.7`, `fake-indexeddb@6.2.5`, `@playwright/test@1.64.0`, `@axe-core/playwright@4.13.0`, `@types/react@19.3.0`, `@types/react-dom@19.3.0`. Versions are the newest stable releases published on or before 2026-10-11 (≥ 14 days before adoption).
4. Deviations from `TECH_STACK.md` §1, chosen to keep the M3 supply chain small; each can be revisited in M5 without changing domain or artifact contracts:
   - Tailwind → plain CSS tokens (no build plugin; responsive rules are few).
   - Dexie → a ~150-line native IndexedDB wrapper (record-level `schemaVersion` migration is app logic either way).
   - `vite-plugin-pwa`/Workbox → a hand-written service worker plus a ~40-line Vite plugin that emits the precache list. PWA hardening remains M5.
   - `html-to-image` → PNG drawn directly on `<canvas>` from a pure layout computed in `@ky-nay/export`.
5. `packages/export` (pure TypeScript, node:test) owns display formatting, schedule expansion, grid layout, ICS and Word serialization. The UI never re-implements conflict/week rules; it calls `@ky-nay/domain`.

### 2. Artifact contract (static, same-origin)

Base path `data/` next to the app. All URLs inside the manifest are **relative paths** under that base; absolute URLs, schemes, `..` segments and backslashes are rejected.

```ts
// data/manifest.json — catalog of datasets; each entry follows API_AND_DATA_CONTRACTS §3
type DatasetManifest = {
  schemaVersion: "1.0";
  generatedAt: string;                       // ISO-8601 UTC
  datasets: DatasetEntry[];
};
type DatasetEntry = {
  datasetVersion: string;
  school: "uet";
  term: string;                              // TermId
  termName: string;
  status: "candidate" | "validated" | "published" | "retracted";
  source: {
    type: "official-timetable" | "planned-timetable" | "synthetic-fixture";
    documentRef: string;                     // no PII
    publishedBy: string;                     // role label, no personal name/email
    importHash: string;                      // "sha256:<hex>" of the approved source input
  };
  parserVersion: string;
  domainSchemaVersion: "0.2.0";
  importedAt: string; reviewedAt?: string; publishedAt?: string; expiresAt?: string;
  artifacts: { kind: "timetable" | "metadata"; url: string; sha256: string; bytes: number }[];
};
// schools/uet/terms/<term>/<datasetVersion>/timetable.json
type TimetableArtifact = { schemaVersion: "0.2.0"; datasetVersion: string; school: "uet"; term: string; courses: Course[]; sections: Section[] };
// schools/uet/terms/<term>/<datasetVersion>/metadata.json
type MetadataArtifact = {
  schemaVersion: "1.0"; datasetVersion: string; school: "uet";
  term: Term; timeFrame: TimeFrame;
  creditPolicy?: { minCredits?: number; maxCredits?: number };   // C-02: optional, no default
};
```

Loader rules (fail closed):

1. Manifest and artifacts are size-capped (manifest 1 MB, artifact 20 MB) and parsed as JSON only.
2. Each artifact's byte length and SHA-256 (WebCrypto) must equal the manifest entry before parsing.
3. `schemaVersion`, `school`, `term` and `datasetVersion` of both artifacts must match the entry; every `Course`/`Section` must pass `validateCourse`/`validateSection` with no `error` issue; the metadata `TimeFrame` must define every period referenced by a fixed session.
4. Status policy: `retracted` is never loaded; `published` always allowed; `candidate`/`validated` only on the Vite dev server (`import.meta.env.DEV`) or in a build made with `VITE_ALLOW_UNPUBLISHED=true` (preview/e2e), shown with a non-dismissible banner. `source.type = synthetic-fixture` always shows a "dữ liệu mẫu" banner and is stamped into every export. (Open: SEC-M3-001 retracted-then-offline, SEC-M3-003 flagged build shares `dist/` with release builds — see Status after G3.)
5. A validated dataset is cached in IndexedDB. If the network fails, the last cached dataset for the term is used with an offline indicator. If validation fails, the response is discarded, the cache is kept and an error is shown.

### 3. Local storage

- IndexedDB database `ky-nay` (version 1), stores with out-of-line keys: `plans` (key = `plan.id`), `datasets` (key = term id; one last-validated dataset per term), `settings` (key `"app"`), `backups` (auto-increment).
- Plan record envelope `{ schemaVersion, storedAt, plan }`. On read: same version → structural check `isPlanShape` (`apps/web/src/storage/plan-store.ts`); semantic checks (sections exist, groups resolve) happen later through the domain `resolvePlanPicks` once a dataset is loaded; older known version → deterministic migration (`0.1.0 → 0.2.0`: add `datasetVersion: "unknown"`, mirror `final`, drop untargeted overrides with a notice) then validation; unknown older or failed migration → record moved to `backups` and the user can download it as JSON or delete it; newer version → left untouched, read-only notice. Nothing is sent to a server (DOMAIN_MODEL §9).
- "Xóa dữ liệu trên máy" deletes all four stores and the service-worker caches.

### 4. Service worker and CSP

- Production build only. The emitted `sw.js` precaches the build's own assets in a cache named by a build hash, serves navigations network-first with cached `index.html` fallback, serves precached assets cache-first, and does not cache `data/*` (IndexedDB owns datasets). A new worker waits until the user chooses "Tải lại"; it never mixes asset versions.
- Build-time CSP meta: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. Dev server runs without it (Vite HMR needs inline scripts). A meta CSP cannot carry `frame-ancestors`; deploy headers are an M5 item (SEC-M3-007).
- The worker matches precached assets with `ignoreVary: true` (assets are content-hashed; the preview server sends `Vary: Origin`, which otherwise breaks offline loading of `crossorigin` module scripts).
- `scripts/lint.mjs` extends to `apps/web/src`: `fetch(` only in the loader module; `innerHTML`, `dangerouslySetInnerHTML`, `document.write`, `eval`/`Function(` and selected PII field names are rejected.

### 5. Export

- ICS: one `VEVENT` per fixed session per teaching week (no `RRULE`), `DTSTART/DTEND` in UTC converted from `Asia/Ho_Chi_Minh` (fixed UTC+7; Vietnam has no DST), deterministic `UID`, RFC 5545 escaping and 75-octet folding, `X-WR-CALNAME`/`X-WR-TIMEZONE`, description with dataset version/source/status and the disclaimer. Non-fixed (ONL) sessions are not exported as events.
- Word: `.doc` HTML (`application/msword`), landscape page CSS, every value HTML-escaped.
- PNG: canvas 2× scale, week grid of the selected week plus header/footer metadata.
- Print: `@page { size: A4 landscape }` print stylesheet; no PDF generator (Q-002).

## Scope and non-goals

- In scope: everything M3 lists in `IMPLEMENTATION_PLAN.md` §2.
- Not in scope: registration import UI (M4), admin publish/CDN/catalog hosting (M5), install prompt/push, share link (P1), analytics.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Follow TECH_STACK exactly (Tailwind, Dexie, vite-plugin-pwa) | matches proposal | ~3 extra dependency trees (Workbox build has a large transitive graph); review cost now | deferred; revisit in M5 |
| Native IndexedDB + hand-written SW + plain CSS | minimal supply chain, full control of version/migration semantics | more code to own and test | **chosen** |
| One manifest per dataset (no catalog) | identical to the API example | onboarding cannot list terms without another file | rejected; catalog wraps the documented entry |
| ICS with `RRULE` + `EXDATE` | smaller file | fragile for sparse weeks across clients | rejected; individual events |
| PNG via DOM snapshot library | WYSIWYG | extra dependency; CSP/font quirks | rejected; canvas renderer |

## Consequences

### Positive

- The browser trust boundary has exactly one network module and no third-party runtime code besides React.
- Artifact integrity is checked end-to-end (bytes, hash, schema, domain invariants) before any data reaches the UI.

### Negative / risks

- Hand-written SW/IndexedDB code must be covered by e2e/offline tests; edge cases of storage eviction on iOS Safari are not covered in M3.
- WebKit/Firefox/real mobile devices are smoke-tested only if browsers are available; Tier 1 manual check stays with the owner.

### Privacy/security

- Data crossing boundaries: browser ↔ same-origin static files (public timetable data only). No PII is processed in M3.
- Controls: CSP, single fetch module, escaping in all exports, lint guard, no analytics.
- Security review: G3b required for CSP/XSS/storage/service-worker behavior.

### Operations/migration

- Plan records carry `schemaVersion`; migration path is tested with fixtures.
- Rollback: revert `apps/web`, `packages/export` and the loader; no server state exists.

## Reproducible evidence and acceptance

- Commands: `npm run check`, `npm run test:e2e` (see M3 implementation handoff for exit codes).
- Acceptance: M3 spec AC-M3-01…13.

## Approval and risk acceptance

- Decision: `g1-blocked` pending Tech Lead acknowledgement (actor/date). Implementation proceeds on the owner's instruction of 2026-10-25 and is recorded as such.
- Risk exception: none.

## Implementation notes (2026-10-25)

- Toolchain consequences: root `engines.node >= 22.22.2` (jsdom 30 / Vitest 5); CI moved to Node 22 with a separate Playwright e2e job; root `overrides.playwright-core = 1.64.0` keeps `@axe-core/playwright` on the same core as `@playwright/test`.
- `scripts/build-synthetic-dataset.mjs` builds its workbook with the parser's compiled test helper (`packages/parser/dist/test/synthetic-xlsx.js`) and parses it with the real `uet-xlsx` adapter.
- `scripts/run-node-tests.mjs` replaces the quoted glob in `npm test` (mitigates the Node-version risk noted in AUD-012).

## Status after G3 (2026-10-25)

G3a `qa-no-go`, G3b `security-pass-with-exception`, G3c `review-no-go`; consolidated register in [EVID-M3-001](../evidence/M3-EVIDENCE-ENVELOPE.md). Contract-relevant open items:

| Item | Code today | Decision needed |
| --- | --- | --- |
| Unresolvable picks (QA-M3-001 = REV-M3-001, S1) | A pick whose group no longer exists resolves to no sessions (CL included) and silently leaves conflicts, grid and exports | How the UI and domain treat picks that do not resolve (surface as error, block "no conflict" state, possibly still resolve CL sessions) |
| Migration of contradictory `0.1.0` records (REV-M3-009c) | `plan-store.ts` resolves a contradictory `planKind`/`final` in favour of `planKind` | ADR-0009 says reject; either change the code (send to `backups`) or record the deviation |
| Banner for unpublished synthetic data (REV-M3-009d) | `App.tsx` shows only the "Dữ liệu mẫu" banner for `synthetic-fixture`, not the "chưa được công bố" banner | Rule 4 above requires the unpublished banner for every `candidate`/`validated` dataset |
| Retracted data offline, encoded traversal, build flag, size cap, lint guard, wipe, deploy headers (SEC-M3-001…007) | see G3b report | fixes due per G3b exception terms (first G4a/G4b or 2026-11-08; SEC-M3-005/006 before M4 G3b) |

Any fix to the loader, storage, CSP or service worker reopens G1 acknowledgement for this ADR and G3a/G3b/G3c.
