# M3 implementation handoff — Core UI & export

> **Artifact ID:** `IMPL-M3-001`  
> **Artifact status:** `blocked` — G3a/G3c `no-go` ngày 2026-10-25; xem mục Verification outcome và [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md)  
> **Canonical gate:** `G2`  
> **Task/PR:** `M3 Core UI & export`  
> **Owner:** Tech Lead  
> **Implementer:** Frontend/Coder (Claude Code agent session, 2026-10-25)  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [M3 spec](M3-SPEC.md), [M3 design handoff](M3-DESIGN-HANDOFF.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [QA plan](../QA_TEST_PLAN.md)  
> **Evidence envelope:** [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md)  
> **Receiving owner / acknowledgement:** Tester (G3a), Security Reviewer (G3b), Independent Reviewer (G3c) — pending

## Source and immutable identity

- Spec/design: SPEC-M3-001, DESIGN-M3-001, ADR-0010 (all `g0/g1` acknowledgement pending; implementation on owner instruction 2026-10-25).
- Base commit: `4681c63` (`main`). Target: uncommitted working tree on top of `4681c63` at hand-off time.
- Toolchain: Node 22.22.2, npm 12.0.2, TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0 (Chromium headless shell 156.0.8078.4).
- Commands and results (Windows 10, local):
  - `npm run check` → exit 0: lint (packages + web boundary rules), typecheck (packages + web app/tests/e2e), node:test **78/78**, Vitest **31/31**, parser fixtures **5/5**.
  - `npm run test:e2e` → exit 0: Playwright **10/10** on the production build (service worker + CSP) with `VITE_ALLOW_UNPUBLISHED=true`.
  - `node scripts/bench-m3.mjs` → `{"sections":1200,"indexBuildMs":24.4,"searchP95Ms":2.35,"conflictP95Ms":2.11}`.
  - `npm audit --omit=dev` and `npm audit` → 0 vulnerabilities.

## Outcome and scope

- Outcome: first runnable web app — load and verify a dataset, onboard (term + week 1 by cohort or date), search/pick sections with group choice and conflict explanation, week grid / day list / plan summary, local persistence with migration, offline view, ICS/PNG/Word export and print.
- Out of scope (not started): registration import UI and final Plan slot (M4); admin publish/CDN/catalog hosting, PWA hardening, observability (M5); share link (P1); analytics.
- Requirement coverage: M3 slice of FR-01–FR-08, FR-11, AC-01, AC-06, AC-07 (see mapping). Product P0 overall: `no` — M4/M5 remain.

## Changed artefacts

| Path | Change |
| --- | --- |
| `apps/web/` (new) | React 19 + Vite 8 app: `src/data` (artifact contract + loader, the only network module), `src/storage` (IndexedDB wrapper, Plan envelope + migration, wipe), `src/model` (catalog/search, picker, plan view, week helpers, labels), `src/components`, `src/export` (download, canvas PNG), `src/app` (controller, service-worker client), CSS, `vite.config.ts` (build-only CSP meta, service-worker generator), Vitest + Playwright suites |
| `packages/export/` (new) | Pure TS: formatting, schedule expansion, grid layout, ICS (RFC 5545), Word `.doc` HTML; node:test suite |
| `scripts/build-synthetic-dataset.mjs` (new) | Synthetic workbook → real `uet-xlsx` adapter → `timetable.json`/`metadata.json`/`manifest.json` with sha256; fails on any parser error |
| `scripts/run-node-tests.mjs` (new) | Lists compiled test files instead of relying on `node --test` glob expansion (AUD-012 risk) |
| `scripts/bench-m3.mjs` (new) | Rough search/conflict timing for ~1,200 sections |
| `scripts/lint.mjs` | Adds `apps/web/src` rules: `fetch(` only in `src/data/loader.ts`; no HTML sinks; no localStorage/sessionStorage/cookies |
| `package.json`, lockfile | Workspaces `apps/*`; root `typecheck`/`test` include the web app; `test:e2e`; `overrides.playwright-core = 1.64.0`; engines `node >= 22.22.2` (jsdom 30/Vitest 5 requirement) |
| `.github/workflows/m0-foundation.yml` | Node 22; `check` job + `e2e` job (installs Chromium) |
| `tsconfig.build.json`, `.gitignore` | Export package reference; ignore generated `apps/web/public/data/`, Playwright output, `.playwright-mcp/` |
| `docs/evidence/m3-screens/*.png` | Screenshots at 360/768/1280 (synthetic data only) |

No change to `@ky-nay/domain` or `@ky-nay/parser` source in M3. Domain schema stays `0.2.0`.

## Data and integrity

- Fixture: synthetic workbook defined in `scripts/build-synthetic-dataset.mjs` (codes `SYN…`, labelled `synthetic-fixture`, status `candidate`); generated files are git-ignored and rebuilt by `npm run build -w @ky-nay/web`.
- Artifact hashes are computed at generation time and verified by the loader with WebCrypto.
- New boundary: browser ↔ same-origin `data/*` (public timetable only); IndexedDB (`plans`, `datasets`, `settings`, `backups`); service-worker cache (`ky-nay-shell-*`). No PII is handled in M3.

## Acceptance mapping

| AC | Implementation | Evidence | Result |
| --- | --- | --- | --- |
| AC-M3-01 onboarding (C-08) | `Onboarding.tsx` (`Week1Fields`, Monday check) | `App.test.tsx` onboarding cases; e2e core flow | pass |
| AC-M3-02 search/picker | `model/catalog.ts`, `SectionCard.tsx` | `model.test.ts` search/group; e2e | pass |
| AC-M3-03 conflict explanation (AC-01) | `model/picker.ts` → domain `findConflicts`, `describeConflict` | `model.test.ts`, `App.test.tsx`, e2e text assertion | pass with fresh Plans; **fail** after a dataset revision changes a picked section's groups (QA-M3-001 = REV-M3-001, S1); campus warning untested (REV-M3-008); picked card loses its conflict badge (REV-M3-007) |
| AC-M3-04 grid/day list, ONL off-grid | `Schedule.tsx`, `@ky-nay/export` grid layout | `export.test.ts` lanes/CN; e2e week 9 conflict blocks, day list dates | pass |
| AC-M3-05 responsive/a11y/keyboard | CSS, tabs pattern, skip link, labelled controls | e2e: overflow ≤ 0 px at 360/768/1280 on 5 screens; axe WCAG 2.1 A/AA no serious/critical; keyboard path with focus ring checks | pass (Chromium; WebKit smoke by G3a). Gaps: spec says 1200 px, test uses 1280; e2e keyboard path stops at the pick (G3a probe reached the ICS download) — REV-M3-008 |
| AC-M3-06 persistence/offline/wipe | `storage/*`, service worker, controller | `plan-store.test.ts`; e2e reload, offline reload, wipe | pass for one tab; wipe breaks offline until next deploy (QA-M3-003 = REV-M3-002, S2); two tabs overwrite each other (QA-M3-005, S2; SEC-M3-006) |
| AC-M3-07 artifact integrity | `data/contract.ts`, `data/loader.ts` | `loader.test.ts` (hash, retracted, status policy, offline, domain invariants, URL safety); e2e tampered artifact | pass for the tested cases; open: retracted-then-offline (SEC-M3-001), `%2e%2e` (SEC-M3-002), size cap without Content-Length (SEC-M3-004), cache-write failure reported as invalid data (REV-M3-004, S2) |
| AC-M3-08 provenance | `ProvenancePanel`, banners, labels | e2e provenance test | pass |
| AC-M3-09 ICS | `@ky-nay/export` `buildIcs`, `export/files.ts` | `export.test.ts` (events per week, UTC, folding, escaping); e2e 33 events + exact DTSTART | pass (calendar-client import not run) |
| AC-M3-10 PNG/Word/print | `export/png.ts`, `buildWordDoc`, print CSS | `export.test.ts` escaping; e2e PNG header/size, Word content, PDF MediaBox 842×595 | pass (visual check pending); one-period conflict block in PNG has no text marker (REV-M3-010) |
| AC-M3-11 credits (C-02) | `model/plan-view.ts` | `model.test.ts` | summary tab pass; plan bar shows "0 tín chỉ" for unknown credits (QA-M3-008 = REV-M3-006) |
| AC-M3-12 stale Plan | `StalePlanNotice`, `rebasePlan` | `model.test.ts`; e2e new-version rebase | pass when a section is removed; **fail** when groups change — rebase says every class still exists (QA-M3-001, S1) |
| AC-M3-13 privacy/XSS | CSP meta, lint rules, text rendering | e2e same-origin GET-only, CSP present, XSS probe inert; `App.test.tsx` | pass |

## Test and verification

- Not run: WebKit/Firefox/real phones (Tier 1 Safari iOS, Chrome Android); import of the `.ics` into a calendar client; visual review of PNG/Word/print; screen-reader pass; CI on GitHub (workflow updated, not executed from this session).
- Defects found and fixed during implementation: page-level horizontal overflow caused by absolutely positioned screen-reader text inside the grid scroller; service worker missed precached assets because the preview server sends `Vary: Origin`; update banner missed an already-installing worker; deferred search results could drop keyboard focus.

## Data/privacy/security

- One network module, same-origin GET only (e2e-verified); CSP `script-src 'self'` in the build; no analytics; no PII fields; all dataset text rendered as text and HTML-escaped in Word export.
- Security review needed: yes (G3b) — new browser storage, service worker and export paths.

## Risks, rollout and rollback

- No production deploy. Rollback: revert the M3 change set; Plan records keep schema `0.2.0`.
- Known limitations: synthetic data only; production builds refuse unpublished datasets, so a deploy shows “chưa có dữ liệu được công bố” until M5 publishes one; service-worker update strategy is minimal (M5 hardening).

## Post-handoff changes (2026-10-25, before the G3 run)

- `apps/web/src/app/controller.ts`: the Vite dev server (`import.meta.env.DEV`) may load unpublished datasets, so `npm run dev` works with the synthetic data; production builds still need `VITE_ALLOW_UNPUBLISHED=true` (recorded in ADR-0010 §2 rule 4; risk in SEC-M3-003).
- Root `package.json`: `dev` script (`npm run build && npm run dev -w @ky-nay/web`); `README.md` rewritten (UTF-8, run/test instructions).
- Added by the G3a Tester: `apps/web/src/qa-m3.test.tsx` (8 tests) and `apps/web/e2e/qa-m3.spec.ts` (4 tests), both passing.

## Verification outcome (G3, 2026-10-25)

- Re-run on the same working tree: `npm run check` exit 0 (node:test 78/78, Vitest 39/39, fixtures 5/5); `npm run test:e2e` exit 0 (14/14).
- G3a [TEST-M3-001](M3-G3a-QA-REPORT.md): `qa-no-go`. G3b [SEC-REVIEW-M3-001](M3-G3b-SECURITY-REVIEW.md): `security-pass-with-exception`. G3c [REVIEW-M3-001](M3-G3c-INDEPENDENT-REVIEW.md): `review-no-go`. All three by agent roles, not human sign-off.
- Consolidated register (1 S1, 6 S2, 14 S3) and re-run conditions: [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md). The acceptance mapping above was corrected after G3 (REV-M3-008: the original table overstated coverage).

## Fix round 2026-10-29 (findings 1–2 of EVID-M3-001)

- Domain `packages/domain/src/plan.ts`: `sessionsForPick` keeps common sessions on group errors; `addPlanPick` rejects only on the new pick's own errors ([ADR-0009 amendment 2026-10-29](../adr/ADR-0009-m2-domain-engine-schema.md)).
- Web `apps/web/src/model/plan-view.ts`: `PlanView.unresolved`, `rebasePreview`, `rebasePlan` clears groups that no longer exist. UI: `PlanSummary.tsx` (per-pick messages for every error code, rebase confirmation lists, no "✓" while unresolved), `Workspace.tsx` (plan bar count), `ExportPanel.tsx` + `export/files.ts` (warning, Word note), `SectionCard.tsx` ("⚠ Cần chọn lại nhóm").
- Tests: domain `plan.test.ts` (3), web `model.test.ts` (4: group renamed, rebase preview/after, group added, unrelated pick on a stale Plan), e2e `REV-M3-001/003 — a revision that renames a picked group…` following the G3c repro.
- Same change set: C-09 registration adapter 0.2.0 and merge changes ([REVIEW-C09-001](C09-REGISTRATION-SAMPLE-REVIEW.md)); no M3 UI uses them yet.
- Local: `npm run check` exit 0 (node:test 84/84, Vitest 43/43, fixtures 6/6), `npm run test:e2e` exit 0 (15/15). Commit and CI run IDs are recorded in [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md).
- Not addressed in this round: findings 3–21 (S2 QA-M3-003…005, REV-M3-004 and the S3 items).

## Fix round 2026-10-30 (S2 findings 3–6, 13 of 14 S3, C-10, Q-012)

- **Timetable parser** (`uet-xlsx@0.2.0`, [ADR-0011](../adr/ADR-0011-timetable-format-variability.md)):
  - optional kind column; required day + shift/period;
  - cancelled-classes sheet excluded;
  - section ids rebuilt from the course code;
  - `#` kept in codes;
  - bare `Ca a - b` read as shifts;
  - untimed rows become non-fixed;
  - repeated `Ghi chú` columns joined;
  - format fingerprint → `hold`; import profile; row coverage;
  - `npm run test:real`.
  The real HK I 2026–27 file imports with 0 errors.
- **Notes** (Q-012): no note warnings; `rawNote` shown on section cards, the untimed list and the day list.
- **S2 fixes:**
  - wipe unregisters the service worker (#3);
  - loader keeps verified data on a cache-write failure and reports `INSECURE_CONTEXT` (#4);
  - SW update offer only under an older worker (#5);
  - compare-and-put save plus `BroadcastChannel` between tabs (#6).
- **S3 fixes:**
  - SEC-M3-001/002/004/005/006a fixed; SEC-M3-003 and -007 partly (e2e build in `dist-e2e`, generated `_headers`);
  - QA-M3-006/007/008/009;
  - REV-M3-009 (c)(d);
  - REV-M3-010;
  - REV-M3-008 partly.
- Local results: `npm run check` exit 0 (node:test 89/89, Vitest 52/52, fixtures 6/6); `npm run test:e2e` exit 0 (17/17); WebKit probe 0/24 false banners, and a genuine update is still offered and applied.
- Not done:
  - real iPhone check (#5);
  - browser test with the unpublished flag off (SEC-M3-003);
  - host choice and real response headers (SEC-M3-007);
  - campus-warning and keyboard-to-export tests (REV-M3-008).

## Handoff decision

- Recommendation (2026-10-30): `ready-for-verification` for findings 1–6 and the S3 items marked fixed; the G3 re-run must use the commit that contains this round. The implementer does not self-approve.
- Recommendation (2026-10-29): `ready-for-verification` for findings 1–2 only; M3 stays `g2-blocked` overall until findings 3–6 are fixed or accepted. The implementer does not self-approve.
- Earlier recommendation (2026-10-25): `g2-blocked` until the S1/S2 findings are fixed (owner will fix later).
- Next owners: Owner/Frontend (fixes), Tech Lead (unresolvable-pick contract, ADR-0010 G1 acknowledgement, commit/freeze the target), Product (SPEC-M3-001 G0, D-M3-1…4), Release Manager (G3b exception), then Tester/Security/Reviewer re-run G3.
