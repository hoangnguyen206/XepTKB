# M4 implementation handoff — Registration merge UI

> **Artifact ID:** `IMPL-M4-001`  
> **Artifact status:** `needs_review` — G2 local checks + E2E pass; awaiting independent G3a/G3b/G3c verification  
> **Canonical gate:** `G2`  
> **Task/PR:** `M4 Registration merge UI` (`m4-registration-ui`)  
> **Owner:** Tech Lead  
> **Implementer:** Frontend / Coder (2026-11-06)  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [M4 spec](M4-SPEC.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [M4 design handoff](M4-DESIGN-HANDOFF.md), [QA plan](../QA_TEST_PLAN.md), [Security & privacy](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** [EVID-M4-001](M4-EVIDENCE-ENVELOPE.md)  
> **Receiving owner / acknowledgement:** Tester (`G3a`), Security Reviewer (`G3b`), Independent Reviewer (`G3c`) — pending

## Source and immutable identity

- Approved/authored spec, ADR & design IDs:
  - [`SPEC-M4-001`](M4-SPEC.md) (`in-review`, `G0`)
  - [`ADR-0013`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) (`in-review`, `G1`)
  - [`DESIGN-M4-001`](M4-DESIGN-HANDOFF.md) (`in-review`, `G1`)
- Base commit: `3c34c89` (`main` after M3 PR #1 merge and G4b drill `DRILL-M3-G4b-001`).
- Target branch: `m4-registration-ui` (working tree at handoff time).
- Toolchain versions: Node `22.22.2`, npm `12.0.2`, TypeScript `5.9.3`, Vite `8.3.4`, Vitest `5.0.3`, Playwright `1.64.0`.
- Exact commands & exit codes:
  - `npm run check` → exit `0`:
    - `lint`: foundation and web boundary checks passed (including M4 rules forbidding `@ky-nay/parser` root imports and `node:*` imports in `apps/web/src`).
    - `typecheck`: all packages + `apps/web` (`tsconfig.json`, `tsconfig.test.json`, `tsconfig.node.json`) exit `0`.
    - `node:test`: `102/102` passed.
    - `vitest`: `65/65` passed across 8 test files (including `apps/web/src/m4-registration.test.tsx`).
    - `fixtures:run`: `6/6` passed (`registration-portal-format-redacted`, `registration-local-synthetic`, `smoke-minimal`, `adversarial-invalid`, `uet-hk1-row1`, `uet-hk2-row4`).
    - `node scripts/dataset.mjs check`: `data/published OK — 0 datasets (0 published)`.
  - `npm run test:e2e` → exit `0`: Playwright Chromium **19/19 passed** (`e2e/m3.spec.ts` 13/13, `e2e/m4.spec.ts` 2/2, `e2e/qa-m3.spec.ts` 4/4).

## Outcome and scope

- **Outcome:** Students can import their UET/VNU registration result file (`.doc` HTML / `.htm` / `.html`) locally in the browser, review a PII-free preview of matched sections, field-level overrides (`from → to` for room/campus/day/periods/weeks/lecturer), and unmatched/group-required warnings before saving, confirm to create/update a dedicated **`Phương án chính thức` (`final`)** Plan slot without touching **`Phương án nháp` (`draft`)**, switch between the 2 slots, pick a group inline when the registration export omitted the practice group, re-import or delete `Phương án chính thức`, and see override badges/details across `WeekGrid`, `DayList`, `PlanSummary`, `PrintSheet`, `.ics`, and `.doc` exports.
- **In scope:** `AC-M4-01`..`AC-M4-08`, `FR-09`, `FR-10`, `AC-04`, `AC-05`, `Q-005` (`D-009`), `Q-007` (`D-005`).
- **Out of scope:** PDF/image OCR, `.docx` / binary `.doc` OLE2 parsing, server-side upload/sync, multi-draft slots (`P1`), M5 cloud/production release gates.
- **Requirement/AC/P0 coverage:** All M4 P0 requirements (`FR-09`, `FR-10`, `AC-04`, `AC-05`) are implemented and covered by unit, integration, and E2E tests. Product-wide P0 overall remains `no` until M5 release gates (`G4a/G4b/G5`) complete.

## Changed artefacts

| File/module | Change | Why | Migration/compatibility | Evidence |
| --- | --- | --- | --- | --- |
| [`scripts/lint.mjs`](../../scripts/lint.mjs) | Added web boundary checks forbidding `@ky-nay/parser` imports outside `@ky-nay/parser/registration` and forbidding `node:*` imports in `apps/web/src` (non-test files) | Enforce `ADR-0008` / `ADR-0013` browser bundle boundary | Additive lint check | `npm run lint` |
| [`packages/parser/src/vnu-registration-html-adapter.ts`](../../packages/parser/src/vnu-registration-html-adapter.ts) | Exported `MAX_REGISTRATION_BYTES = 2 * 1024 * 1024` | Share single size cap between parser and browser file guard | Backward-compatible export | `m4-registration.test.tsx` |
| [`packages/domain/src/registration-merge.ts`](../../packages/domain/src/registration-merge.ts), [`packages/domain/src/plan.ts`](../../packages/domain/src/plan.ts), [`packages/domain/src/index.ts`](../../packages/domain/src/index.ts) | Exported `sessionFieldValue` and `applySectionOverrides`; updated `resolvePlanPicks(plan, catalog)` to apply `plan.overrides` (`registration < admin-correction < user`) to resolved sections/sessions | Ensure persisted `final` Plans retain overridden rooms/days/periods/weeks/lecturers when reloaded from IndexedDB (`ADR-0013` §2.3) | Domain schema stays `0.2.0`; Plans without overrides behave identically | `packages/domain/test/registration-merge.test.ts` |
| [`packages/export/src/format.ts`](../../packages/export/src/format.ts), [`schedule.ts`](../../packages/export/src/schedule.ts), [`ics.ts`](../../packages/export/src/ics.ts), [`word.ts`](../../packages/export/src/word.ts), [`index.ts`](../../packages/export/src/index.ts) | Added `overrideBadge`, `formatOverrideValue`, `describeOverride`, and `SessionOverride` (`badge`, `detail`) on `ScheduledSession`; surfaced override details in `.ics` `DESCRIPTION` and `.doc` table/list | Surface `AC-05` override badges and `from → to` details across UI views and exports | Additive `overrides?: readonly PlanOverride[]` param on `scheduledSessions` | `packages/export/test/export.test.ts`, `e2e/m4.spec.ts` |
| [`apps/web/src/model/plan-view.ts`](../../apps/web/src/model/plan-view.ts) | Passed `plan.overrides` into `scheduledSessions`; updated `rebasePlan` to refresh `override.from` against the new catalog and drop redundant `registration` overrides when the new timetable matches `override.to`; added `setPickedGroup` | Keep `final` Plan overrides accurate across views, inline group selection, and dataset rebases | Backward-compatible | `m4-registration.test.tsx` |
| [`apps/web/src/model/registration.ts`](../../apps/web/src/model/registration.ts) (new) | Implemented `checkRegistrationBytes` (empty, `> 2 MiB`, `.docx` ZIP, `.doc` OLE2, `.pdf` magic-byte checks) and `buildRegistrationPreview` (`vnuRegistrationHtmlAdapter.parse` + `mergeRegistration` + `D-M4-1` group/week1 inheritance + PII-free summary) | Pure local registration preview model (`AC-M4-01`, `AC-M4-02`, `AC-M4-05`, `AC-M4-06`) | New module | `m4-registration.test.tsx`, `e2e/m4.spec.ts` |
| [`apps/web/src/storage/plan-store.ts`](../../apps/web/src/storage/plan-store.ts), [`local-data.ts`](../../apps/web/src/storage/local-data.ts), [`app/controller.ts`](../../apps/web/src/app/controller.ts) | Added `deletePlan`, per-term `activeSlots` and PII-free `registrationNotes` in `Settings`, and controller actions `selectSlot`, `applyRegistrationImport`, `removeFinalPlan` | Support 2 fixed Plan slots (`draft` + `final`) per term (`Q-005` / `D-009`) | Additive fields in `Settings` (`v1` IndexedDB schema unchanged) | `m4-registration.test.tsx`, `e2e/m4.spec.ts` |
| [`apps/web/src/components/RegistrationImport.tsx`](../../apps/web/src/components/RegistrationImport.tsx) (new), [`Workspace.tsx`](../../apps/web/src/components/Workspace.tsx), [`PlanSummary.tsx`](../../apps/web/src/components/PlanSummary.tsx), [`Schedule.tsx`](../../apps/web/src/components/Schedule.tsx), [`App.tsx`](../../apps/web/src/App.tsx), [`styles.css`](../../apps/web/src/styles.css) | Added registration import panel (with in-app browser nudge and preview/confirm/cancel), 2-slot switcher (`Phương án nháp` / `Phương án chính thức`), override badges + `from → to` details in `WeekGrid`/`DayList`/`PlanSummary`/`PrintSheet`, inline group selector in `PlanSummary`, and delete `Phương án chính thức` confirmation | Deliver full M4 UI (`AC-M4-01`..`AC-M4-08`) | Additive UI components | `m4-registration.test.tsx`, `e2e/m4.spec.ts` |

## Data and integrity

- Fixture manifest + hash: [`fixtures/manifest.json`](../../fixtures/manifest.json), including `registration-portal-format-redacted` (`fixtures/redacted-registration/portal-format.doc`, sha256 `4937d9964e2c64112e58b8bf753c5966a55f3982dfdb4cf0f46b7d484d959fb4`) and `registration-local-synthetic` (`fixtures/synthetic/registration-local.html`, sha256 `357da7470b18dd26386c16bdcc5537c213fd9e3b875645e29cb5b19b2651f8c3`).
- Domain schema version: `0.2.0` (unchanged). Plan storage envelope: `1.0.0` (unchanged).
- New data fields/boundary: Browser `File` input (`localOnly: true`) is parsed in memory by `vnuRegistrationHtmlAdapter` and discarded immediately after preview construction (`input.value = ""`); only PII-free `Plan` (`planKind: "final"`, `id: "${draftPlan.id}:final"`) and PII-free `RegistrationNoteSummary` (`unmatchedSectionIds`, `issueSummaries`) are persisted in IndexedDB upon explicit user confirmation.

## Acceptance mapping

| Criterion | Implementation | Test/evidence ID/link | Result |
| --- | --- | --- | --- |
| `AC-M4-01` File picker, format/size guard & in-app browser nudge (`FR-09`, `Q-007`) | `checkRegistrationBytes` in [`registration.ts`](../../apps/web/src/model/registration.ts); [`RegistrationImport.tsx`](../../apps/web/src/components/RegistrationImport.tsx) | `m4-registration.test.tsx` (`rejects empty, >2 MiB, .docx, binary .doc, .pdf and table-less HTML`); `e2e/m4.spec.ts` | `pass` |
| `AC-M4-02` Strict local-only processing & zero PII leakage (`AC-04`, `NFR-03`) | `vnuRegistrationHtmlAdapter.parse` (`localOnly: true`), `input.value = ""`, no filename/hash/PII in state or IndexedDB | `m4-registration.test.tsx` (`portal-format.doc` + UI DOM/IDB scan); `e2e/m4.spec.ts` (`postImportRequests === []`, DOM/IDB/console/export scan) | `pass` |
| `AC-M4-03` Preview before commit & explicit confirmation (`FR-09`, `AC-04`) | `buildRegistrationPreview` + preview card in [`RegistrationImport.tsx`](../../apps/web/src/components/RegistrationImport.tsx) | `m4-registration.test.tsx` (cancel leaves no `final` Plan; confirm saves `final` Plan); `e2e/m4.spec.ts` | `pass` |
| `AC-M4-04` 2 fixed Plan slots (`draft` vs `final`), switching, re-import & delete (`Q-005` / `D-009`) | [`controller.ts`](../../apps/web/src/app/controller.ts), [`Workspace.tsx`](../../apps/web/src/components/Workspace.tsx), [`PlanSummary.tsx`](../../apps/web/src/components/PlanSummary.tsx) | `m4-registration.test.tsx` + `e2e/m4.spec.ts` | `pass` |
| `AC-M4-05` Field-level overrides & visual badges (`FR-10`, `AC-05`) | `resolvePlanPicks` (`applySectionOverrides`), `scheduledSessions`, `WeekGrid`, `DayList`, `PlanSummary`, `PrintSheet`, `buildIcs`, `buildWordDoc` | `registration-merge.test.ts`, `export.test.ts`, `m4-registration.test.tsx`, `e2e/m4.spec.ts` | `pass` |
| `AC-M4-06` Unmatched sections & group resolution (`FR-09`, `FR-10`) | `buildRegistrationPreview` (`D-M4-1` group inheritance), `setPickedGroup`, inline `<select>` in [`PlanSummary.tsx`](../../apps/web/src/components/PlanSummary.tsx) | `m4-registration.test.tsx`, `e2e/m4.spec.ts` | `pass` |
| `AC-M4-07` Rebase & wipe compatibility for `final` Plan | `rebasePlan` override refresh in [`plan-view.ts`](../../apps/web/src/model/plan-view.ts), `wipeLocalData` | `m4-registration.test.tsx` (`rebasePlan` test) | `pass` |
| `AC-M4-08` Responsive (`360/768/1200`), keyboard & WCAG 2.1 A/AA | [`RegistrationImport.tsx`](../../apps/web/src/components/RegistrationImport.tsx), [`Workspace.tsx`](../../apps/web/src/components/Workspace.tsx), [`styles.css`](../../apps/web/src/styles.css) | `e2e/m4.spec.ts` (`AC-M4-08 — no horizontal overflow and zero serious/critical axe violations at 360/768/1200 px`) | `pass` |

## Test and verification

- Automated suites run and passing:
  - `npm run check` (`lint` + `typecheck` + `102/102` node tests + `65/65` Vitest tests + `6/6` fixtures + `dataset check`).
  - `npm run test:e2e` (`19/19` Playwright Chromium E2E tests).
- Tests not run / limitations:
  - Real unredacted registration exports from additional semesters (`test:real` outside repo) and manual testing inside native Zalo/Messenger iOS/Android webviews remain part of G4a/M5 release readiness.

## Data/privacy/security

- PII/secret handling: Student PII in `.doc` / `.html` registration exports is stripped in browser memory by `vnuRegistrationHtmlAdapter` and never enters React state, DOM, IndexedDB, console logs, exports, or network requests.
- Security review needed: `yes` (`G3b`) — M4 introduces the student registration file input and local merge pipeline in the browser.
- Logging/analytics impact: None (no analytics or telemetry added).

## Risks, rollout and rollback

- Migration/compatibility: Existing `draft` Plans in IndexedDB load without migration changes; `activeSlots` and `registrationNotes` in `Settings` are optional fields.
- Rollback trigger/target/procedure: Revert the M4 merge commit on `main` if any PII leak or broken schedule calculation is discovered; existing `draft` Plans remain readable.

## Handoff decision

- Recommendation: `ready-for-verification` (awaiting independent `G3a`, `G3b`, `G3c` verification).
- Implementer actor/date: Frontend/Coder agent (`2026-11-06`).
- Tech Lead readiness decision/date/evidence: `pending` (awaiting human Owner sign-off on `G0`/`G1` and independent `G3` reports).
- Next owner/action: Tester (`G3a`), Security Reviewer (`G3b`), and Independent Reviewer (`G3c`) execute parallel verification on `m4-registration-ui`.
- Open questions: None.
