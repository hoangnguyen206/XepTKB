# G4b dataset publish & rollback drill report — UET HK I 2026–2027

> **Artifact ID:** `DRILL-M3-G4b-001`  
> **Artifact status:** `approved` (drill completed; temporary drill artifacts removed from `data/published` after verification so the repository remains clean prior to real HK II intake)  
> **Canonical gate:** `G4b` (dataset publish & rollback drill per [ADR-0012 §Verification](../adr/ADR-0012-dataset-publish-pipeline.md) and [Data ingestion runbook §12](../DATA_INGESTION_RUNBOOK.md))  
> **Owner:** Release Manager + Data Parser + Data Reviewer  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [ADR-0011](../adr/ADR-0011-timetable-format-variability.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [Data ingestion runbook](../DATA_INGESTION_RUNBOOK.md), [M3 evidence envelope](M3-EVIDENCE-ENVELOPE.md), [Implementation plan §2](../IMPLEMENTATION_PLAN.md)  
> **Evidence envelope:** [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md) (and the [Evidence Envelope](#evidence-envelope) section below)  
> **Decision actor / UTC timestamp:** executed and verified on `main` @ `4915a86` at `2026-11-06T06:13:34Z–06:13:51Z` (requested by Owner)

## 1. Purpose and scope

Verify end-to-end operational readiness of the CLI dataset publish pipeline (`scripts/dataset.mjs`, `scripts/lib/dataset-core.mjs`, `scripts/site-data.mjs`) and the browser loader (`apps/web/src/data/loader.ts`) before the UET HK II 2026–2027 timetable window (09–15/11/2026):

1. Pre-flight check (`npm run test:real`) on the real UET HK I 2026–2027 timetable outside the repository.
2. Intake (`import` → `candidate`), report generation (`Extra (info) columns` + `Week notes ("tuần")` tables), and negative guards (duplicate hash refusal, unvalidated publish refusal, same-actor validation refusal with whitespace normalization).
3. Production vs. preview build separation (`scripts/site-data.mjs` + `apps/web/vite.config.ts`): `candidate` dataset is stripped from production builds (`CF_PAGES_BRANCH=main`) and served with the `"Dữ liệu chưa được công bố"` banner on preview builds (`CF_PAGES_BRANCH=m3-web-app`).
4. Independent validation (`candidate → validated`) and first publish (`validated → published`), verified via `dataset check`, `published.test.ts` (both `allowUnpublished: false` and `true`), and headless Chromium against a production build.
5. Second-version import (`v2`) on the same term to verify section/session diff generation against the published `v1`.
6. Emergency rollback (`retract` on `v2` → automatic fallback to `v1`; `retract` on `v1`), negative guard against publishing a `retracted` version directly, `restore` (`retracted → validated`), and re-publish (`validated → published`) with full `audit.jsonl` integrity verification (`dataset check`).

## 2. Source identity and intake

| Field | `v1` (real UET HK I 2026–2027) | `v2` (synthetic delta workbook) |
| --- | --- | --- |
| School / term | `uet` / `2026-2027-h1` (Học kỳ I năm học 2026–2027, 15 teaching weeks) | `uet` / `2026-2027-h1` |
| Week 1 by cohort | `K67,K68,K69,K70 → 2026-09-07`; `K71 → 2026-10-12` | `K67,K68,K69,K70 → 2026-09-07`; `K71 → 2026-10-12` |
| Source document ref | `TKB HKI 2026-2027 SAU ĐKH 04.09.2026` (111,939 bytes, outside repo) | `TKB HKI 2026-2027 BỔ SUNG (drill v2)` (1,537 bytes, synthetic) |
| Source SHA-256 | `sha256:33843d5f78cf7e0a2f3a90ab200979338b6369d82633320b86fd9a25427e2941` | `sha256:24779643cb6cd7675392c99b509c46a6c25592c765b4566a539705c47e42a71b` |
| Dataset version | `uet-2026-2027-h1-20261106-33843d5f` | `uet-2026-2027-h1-20261106-24779643` |
| Parser / schema version | `uet-xlsx@0.2.0` / domain `0.2.0` | `uet-xlsx@0.2.0` / domain `0.2.0` |
| Sheet & header row | `TKB 04.09` (row 6); cancelled sheet `Các lớp hủy` skipped | `TKB 05.09` (row 4) |
| Format fingerprint | `courseCode, courseName, credits, day, group, lecturer, room, sectionId, shift`; `infoColumns: []` (`STT` ignored) — **format reviewed** | Same 10-column portal layout — **format reviewed** |
| Parsed counts | **354** courses, **1,077** sections, **1,467** sessions (1,432 fixed, 35 untimed / 18 online); 1,468 rows with section ID (1,467 parsed, 1 `cancelled`, **0 errors, 0 unaccounted**) | **2** courses, **2** sections, **3** sessions (0 errors, 0 unaccounted) |
| Output `timetable.json` | 1,054,796 bytes · `sha256:323ef6a7d86b86a24a00d55ea3531da30193948d90b607d622cd5b909cf6928f` | 2,313 bytes · `sha256:675d6fc7c9f8769b9af012ee34d7651b7890a2632ae5b775723931a8f7da40ea` |
| Output `metadata.json` | 1,041 bytes · `sha256:aa1dee17565c7785a1353abf0d07577cfdf31190e6943259bb6f55742637666a` | 1,041 bytes · `sha256:caeb2eea7a654d197521a4b5e12d4472c8dc8d2946f8e97079ca4903099bffed` |

## 3. Step-by-step execution and timing log

Total end-to-end automated drill wall-clock time (including two Vite production builds, two Playwright Chromium runs, and one Vitest run): **16.77 s** (`2026-11-06T06:13:34.285Z` → `2026-11-06T06:13:51.052Z`). Pure CLI lifecycle operations (`import`, `validate`, `publish`, `retract`, `restore`, `check`) each completed in **75–835 ms**.

| Step | Command / Action | Exit | Duration | Outcome / Evidence |
| --- | --- | ---: | ---: | --- |
| `S0-test-real` | `node scripts/test-real.mjs "<HK I.xlsx>" --term 2026-2027-h1` | `0` | `626.9 ms` | `status candidate`, 354 courses, 1,077 sections, 1,467 sessions, 0 errors, 0 unaccounted |
| `S1-import-v1` | `node scripts/dataset.mjs import "<HK I.xlsx>" --term 2026-2027-h1 ... --actor "Data Parser"` | `0` | `734.6 ms` | Created `uet-2026-2027-h1-20261106-33843d5f` (`candidate`), report `.md`, and `audit.jsonl` import entry |
| `S1b-guard-dup-import` | Re-run `dataset.mjs import` on the same file | `1` (expected) | `81.6 ms` | Refused: `this file was already imported as uet-2026-2027-h1-20261106-33843d5f (status candidate)` |
| `S1c-guard-publish-candidate` | `node scripts/dataset.mjs publish <v1> --by "Release Manager"` | `1` (expected) | `92.5 ms` | Refused: `only a validated dataset can be published (status: candidate)` |
| `S1d-guard-self-validate` | `node scripts/dataset.mjs validate <v1> --reviewer "  data   parser  "` | `1` (expected) | `98.6 ms` | Refused (`SEC-M3-101` actor normalization): `the reviewer imported this dataset; another person must review it, or record --accept-single-reviewer "<reason>"` |
| `S2a-build-prod-candidate` | `CF_PAGES_BRANCH=main node scripts/site-data.mjs` while `v1` is `candidate` | `0` | `85.3 ms` | `site-data: copied 0 dataset(s) (production-only filter)` — verified `apps/web/public/data/manifest.json` has `datasets: []` (`SEC-M3-003(c)`) |
| `S2b-build-preview-candidate` | `CF_PAGES=1 CF_PAGES_BRANCH=m3-web-app` → `site-data.mjs` + `vite build apps/web` | `0` | `859.0 ms` | `site-data: copied 1 dataset(s)`; Vite bundle built in `313 ms` |
| `S2c-browser-preview-check` | Playwright Chromium against preview build (`127.0.0.1:4391`) | `0` | `1,409.3 ms` | Onboarding (`K68`) + load 1,077 sections in **`1,118.1 ms`**; `"Dữ liệu chưa được công bố"` banner **`visible`**; search `INT2213` in **`25.3 ms`**; `AIT3003#` and `EMA3062` both found |
| `S3-validate-v1` | `node scripts/dataset.mjs validate <v1> --reviewer "Data Reviewer" --note "..."` | `0` | `111.3 ms` | `uet-2026-2027-h1-20261106-33843d5f is now validated` |
| `S4-publish-v1` | `node scripts/dataset.mjs publish <v1> --by "Release Manager"` | `0` | `114.7 ms` | `uet-2026-2027-h1-20261106-33843d5f is now published` |
| `S4b-check-published-v1` | `node scripts/dataset.mjs check` + `vitest run src/data/published.test.ts` | `0` | `6,659.0 ms` | `data/published OK — 1 datasets (1 published)`; Vitest `4/4` tests passed (`640 ms`) under both `allowUnpublished: false` and `true` |
| `S4c-build-prod-published` | `CF_PAGES=1 CF_PAGES_BRANCH=main` → `site-data.mjs` + `vite build apps/web` | `0` | `1,052.4 ms` | `site-data: copied 1 dataset(s) (production-only filter)`; Vite bundle built in `282 ms` |
| `S4d-browser-prod-check` | Playwright Chromium against production build (`127.0.0.1:4392`) | `0` | `1,524.8 ms` | Loaded published `v1` in **`1,310.2 ms`**; `"Dữ liệu chưa được công bố"` banner **`hidden`** (`unpublishedBanner: false`); search `INT2213` OK |
| `S5a-import-v2` | `node scripts/dataset.mjs import "<drill-v2.xlsx>" --term 2026-2027-h1 ...` | `0` | `834.7 ms` | Imported `uet-2026-2027-h1-20261106-24779643`; diff vs `v1` recorded (`+0 −1075 ~2 sections`, with exact session/room/lecturer changes for `EMA3062 1` and `INT2213 1`) |
| `S5b-validate-publish-v2` | `validate` (`Data Reviewer`) + `publish` (`Release Manager`) on `v2` | `0` | `198.7 ms` | `v2` is now `published` |
| `S6a-retract-v2` | `node scripts/dataset.mjs retract <v2> --by "Release Manager" --reason "G4b drill: rollback v2 to previous known-good v1"` | `0` | `94.1 ms` | `v2 is now retracted`; CLI confirmed: `production now falls back to uet-2026-2027-h1-20261106-33843d5f once deployed` |
| `S6b-retract-v1` | `node scripts/dataset.mjs retract <v1> --by "Release Manager" --reason "G4b drill: test retracting v1"` | `0` | `79.4 ms` | `v1 is now retracted`; CLI confirmed: `production now falls back to no published dataset for this term once deployed` |
| `S6c-guard-publish-retracted` | `node scripts/dataset.mjs publish <v1> --by "Release Manager"` while `retracted` | `1` (expected) | `75.7 ms` | Refused: `only a validated dataset can be published (status: retracted)` |
| `S7a-restore-v1` | `node scripts/dataset.mjs restore <v1> --by "Release Manager" --reason "G4b drill: restore v1 after rollback test"` | `0` | `104.6 ms` | `uet-2026-2027-h1-20261106-33843d5f is now validated` (`REV-M3-106`) |
| `S7b-republish-v1` | `node scripts/dataset.mjs publish <v1> --by "Release Manager"` | `0` | `88.3 ms` | `uet-2026-2027-h1-20261106-33843d5f is now published` |
| `S7c-final-check` | `node scripts/dataset.mjs status` + `node scripts/dataset.mjs check` | `0` | `225.5 ms` | `data/published OK — 2 datasets (1 published)` (`v1` `published`, `v2` `retracted`; all 10 `audit.jsonl` entries verified) |

## 4. Audit trail recorded during the drill (`data/audit.jsonl`)

```jsonl
{"at":"2026-11-06T06:13:35.622Z","action":"import","datasetVersion":"uet-2026-2027-h1-20261106-33843d5f","actor":"Data Parser","importHash":"sha256:33843d5f78cf7e0a2f3a90ab200979338b6369d82633320b86fd9a25427e2941","parserVersion":"uet-xlsx@0.2.0","sections":1077}
{"at":"2026-11-06T06:13:39.208Z","action":"validate","datasetVersion":"uet-2026-2027-h1-20261106-33843d5f","actor":"Data Reviewer","status":"validated","note":"G4b drill: verified 1077 sections, 1467 sessions, Extra (info) columns (STT), Week notes, preview UI"}
{"at":"2026-11-06T06:13:39.325Z","action":"publish","datasetVersion":"uet-2026-2027-h1-20261106-33843d5f","actor":"Release Manager","status":"published"}
{"at":"2026-11-06T06:13:50.393Z","action":"import","datasetVersion":"uet-2026-2027-h1-20261106-24779643","actor":"Data Parser","importHash":"sha256:24779643cb6cd7675392c99b509c46a6c25592c765b4566a539705c47e42a71b","parserVersion":"uet-xlsx@0.2.0","sections":2}
{"at":"2026-11-06T06:13:50.519Z","action":"validate","datasetVersion":"uet-2026-2027-h1-20261106-24779643","actor":"Data Reviewer","status":"validated","note":"Drill v2"}
{"at":"2026-11-06T06:13:50.608Z","action":"publish","datasetVersion":"uet-2026-2027-h1-20261106-24779643","actor":"Release Manager","status":"published"}
{"at":"2026-11-06T06:13:50.703Z","action":"retract","datasetVersion":"uet-2026-2027-h1-20261106-24779643","actor":"Release Manager","status":"retracted","reason":"G4b drill: rollback v2 to previous known-good v1"}
{"at":"2026-11-06T06:13:50.784Z","action":"retract","datasetVersion":"uet-2026-2027-h1-20261106-33843d5f","actor":"Release Manager","status":"retracted","reason":"G4b drill: test retracting v1"}
{"at":"2026-11-06T06:13:50.962Z","action":"restore","datasetVersion":"uet-2026-2027-h1-20261106-33843d5f","actor":"Release Manager","status":"validated","reason":"G4b drill: restore v1 after rollback test"}
{"at":"2026-11-06T06:13:51.052Z","action":"publish","datasetVersion":"uet-2026-2027-h1-20261106-33843d5f","actor":"Release Manager","status":"published"}
```

## 5. Finding discovered and fixed during the drill

- **Production filter consistency in `scripts/site-data.mjs`:** `site-data.mjs` previously checked `process.env.CF_PAGES === "1" && (process.env.CF_PAGES_BRANCH === "main" || !process.env.CF_PAGES_BRANCH)` when deciding whether to filter out `candidate`/`validated` datasets, so running `CF_PAGES_BRANCH=main node scripts/site-data.mjs` locally without `CF_PAGES=1` did not activate the production filter. Updated `scripts/site-data.mjs` line 25 to also trigger on `process.env.CF_PAGES_BRANCH === "main"` directly.

## 6. Evidence Envelope

- **Artifact ID / gate:** `DRILL-M3-G4b-001` / `G4b` (operational drill).
- **Execution commit:** `main` @ `4915a86f1229c4d05e6e9374bf4203ab89b941d0` (plus the 1-line `scripts/site-data.mjs` filter refinement).
- **Toolchain:** Windows 10 Pro 19045, Node `22.22.2`, Vite `8.3.4`, Vitest `5.0.3`, Playwright `1.64.0` (Chromium).
- **Clean-up verification:** After capturing the drill report and audit trail, `data/published` was restored to `datasets: []` (`0 datasets`) so no HK I drill dataset is published to users before the real HK II timetable arrives.
- **Decision:** **`g4b-drill-pass`** — the pipeline (`import → preview review → validate → publish → retract → restore → publish → check`) is verified end-to-end and ready for the HK II 2026–2027 timetable window.
