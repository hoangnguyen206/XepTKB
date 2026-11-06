# ADR-0012 — Dataset publish pipeline: CLI, data/published in the repository, deployed with the site

> **Artifact ID:** `ADR-0012`
> **Artifact status:** `approved` — G1 acknowledged by Owner (Tech Lead, Release Manager, Data Reviewer) on `2026-11-06T05:50Z`
> **Canonical gate:** `G1` (G4b drill evidence later)
> **Date:** 2026-11-01
> **Owner:** Tech Lead + Release Manager
> **Decision owner:** Product (owner asked to start the pipeline on 2026-11-01; G1 signed off on 2026-11-06)
> **Last reviewed:** 2026-11-06
> **Related docs:** [ADR-0007](ADR-0007-static-artifact-cli-admin.md), [ADR-0010 §2](ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0011](ADR-0011-timetable-format-variability.md), [Data ingestion runbook §12](../DATA_INGESTION_RUNBOOK.md), [Operations §1](../OPERATIONS.md), [Implementation plan Q-011](../IMPLEMENTATION_PLAN.md)
> **Evidence envelope:** generated import reports in `data/reports/`; tests listed under Verification

## Context

ADR-0007 chose a local CLI and static artifacts, and planned the push to a CDN (R2/Cloudflare) as an M5 task. Q-011 needs real data for an internal beta when the HK II 2026–27 timetable appears (09–15/11/2026). Hosting is Cloudflare Pages (D-004), which already deploys the site from git. Nothing published existed before this ADR: the app only had synthetic data.

## Decision

1. **Published data lives in the repository** under `data/published/`:
   - `manifest.json`, pretty-printed and append-only;
   - one immutable folder per version: `schools/uet/terms/<term>/<datasetVersion>/{timetable,metadata}.json`.

   `npm run build:web` copies this tree into the site (`scripts/site-data.mjs`), so Cloudflare Pages is the CDN. Publish and rollback are commits, and git history is the audit trail. The raw source file never enters the repository: only its SHA-256 and a safe document reference do (ADR-0007 §2).
2. **CLI** `npm run dataset -- <command>` (`scripts/dataset.mjs`):
   - `import` — parse with `uet-xlsx`; refuse on any blocking error, unaccounted row, duplicate source hash or unreviewed column set; write the artifacts, a `candidate` manifest entry, a report in `data/reports/<version>.md` (template `DATA_IMPORT_REPORT`, with a diff against the previous version of the term) and a line in `data/audit.jsonl`;
   - `validate`, `publish`, `retract`, `restore`, `status`, `check`.
3. **Lifecycle (runbook §7):**
   - `candidate → validated → published`, any status → `retracted`, and `retracted → validated` via `restore` (with a recorded reason);
   - the current dataset of a term is the last allowed entry in manifest order, so retracting the newest published version falls back to the previous one.
4. **Two people.** `validate` refuses a reviewer who is also the importer. While the project has one maintainer, `--accept-single-reviewer "<reason>"` records a process exception in the audit log and the report. Neither is technical enforcement (as ADR-0007 states).
5. **Preview vs production.**
   - Preview builds (any non-`main` branch on Cloudflare) show `candidate` and `validated` data, with the "chưa được công bố" banner. The reviewer checks the real data on the preview URL before `validate`.
   - Production (`main`) shows only `published` data (SEC-M3-003, ADR-0010 §2 rule 4).
6. **Integrity in CI.**
   - `npm run check` runs `dataset check`: every artifact has the recorded size/hash, and no unreferenced file exists.
   - `apps/web/src/data/published.test.ts` loads every current dataset through the app's own loader (hash, schema, domain invariants).
   - The published data is public timetable data, not student data, so this does not conflict with "no real data in CI".
7. **Version name:** `uet-<term>-<YYYYMMDD Asia/Ho_Chi_Minh>-<8 hex of the source hash>`.

## Alternatives considered

| Option | Why not now |
| --- | --- |
| R2 bucket + `wrangler` upload (ADR-0007 wording) | Needs write credentials on the admin machine and a second deploy path; Pages already serves static files. Revisit if `data/published` grows beyond ~100 MB (one HK version ≈ 1 MB) |
| A separate data repository or branch | Two deploys to keep in step; harder to review data with the app version that reads it |
| Build the dataset during the Cloudflare build | Would need the raw source in the repository or on the build host (forbidden by ADR-0007 §2) and makes review impossible |

## Consequences

- Positive:
  - one command imports a file with every gate;
  - the reviewer sees the real data on a phone before it is public;
  - rollback is `retract` + push (< 5 min plus the Pages build);
  - CI proves that what ships loads in the app.
- Negative:
  - the repository grows by about 1 MB per imported version;
  - publishing to production also needs the `main` deploy (G4a) — until then data reaches only preview URLs;
  - the two-person rule is a recorded process, not enforcement.
- Privacy/security: no new boundary. No credential is needed beyond git push. Reports and the audit log contain no student data, only public timetable facts and actor names chosen by the operator (role names are fine).
- Rollback of this ADR: delete `data/published` entries by retracting them; the app then shows "chưa có dữ liệu".

## Verification

- `scripts/test/dataset-core.test.mjs`: version naming (Vietnam date), week-1 Monday validation, diff by what students see, status transitions and the two-person rule.
- Dry run on 2026-10-31 with the real HK I 2026–27 file: 1077 sections, 1467 sessions, report generated; refusals checked (importer as reviewer, publish of a candidate, duplicate file). The dataset passed `published.test.ts` and an end-to-end Chromium run (load 215 ms, search 15 ms). The dry run was then removed.
- G4b drill still to do: import → preview review → validate → publish → retract → publish again, with times recorded.
