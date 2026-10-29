# Test report — M3 Core UI & export (G3a QA verification)

> **Artifact ID:** `TEST-M3-001`  
> **Artifact status:** `ready`  
> **Canonical gate:** `G3a`  
> **Owner:** Tester  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [M3 spec](M3-SPEC.md), [M3 design handoff](M3-DESIGN-HANDOFF.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [M3 implementation handoff](M3-IMPLEMENTATION-HANDOFF.md), [QA plan](../QA_TEST_PLAN.md), [PRD](../PRD.md), [G3b security review](M3-G3b-SECURITY-REVIEW.md), [G3c independent review](M3-G3c-INDEPENDENT-REVIEW.md)  
> **Evidence envelope:** `EVID-M3-001` ([M3-EVIDENCE-ENVELOPE.md](M3-EVIDENCE-ENVELOPE.md)). The file does not exist at test time (see `QA-M3-010`), so the run evidence is recorded in this report.  
> **Tester sign-off actor / UTC timestamp:** Claude subagent (Tester role), not a human sign-off / 2026-10-25T00:16:24Z

## Scope and immutable identity

- **Source spec/PRD/ADR + versions:** SPEC-M3-001 (`ready`, G0 `g0-blocked` pending Product actor/date), DESIGN-M3-001, ADR-0010 (`g1-blocked` pending Tech Lead), IMPL-M3-001 (`needs_review`). PRD §4 P0 #2–#8, #11, #12; §6 FR-01–FR-08, FR-11; §7 AC-01, AC-06, AC-07. QA_TEST_PLAN §2, §5, §8.
- **Base/target commit/build/diff:** base `4681c63` (`main`). Target = **uncommitted working tree** on top of `4681c63`, the same as the handoff. It includes the post-handoff change to `apps/web/src/app/controller.ts:12` (`import.meta.env.DEV` also allows unpublished data).
  - No source under test changed during this session. The newest source file is `controller.ts`, at 2026-10-24T20:08Z, which is before the first QA command at 2026-10-24T23:43:09Z.
  - Content identity: SHA-256 manifest of the 58 files under test (`apps/web/src`, `apps/web/e2e`, web configs, `packages/export/src|test`, `scripts/*.mjs`, root `package.json`/lock, `tsconfig.build.json`; the QA files are excluded). The manifest hash is `2ae3b0cb998e905a05dc6ae5a8ea893f81b16ce442c4c15899ccc40f600841fa`. Per-file hashes include `controller.ts` `79c0edd1…`, `picker.ts` `cfeb24d4…`, `plan-view.ts` `d2c11ba2…`, `PlanSummary.tsx` `8ab59793…`, `SectionCard.tsx` `9405f10e…`, `sw-client.ts` `152b9e7b…`, `local-data.ts` `c282abec…` and `vite.config.ts` `b8b446a0…` (full list in the scratch evidence file `code-under-test.sha256`).
  - `README.md` appears modified in `git status`. Its mtime is 2026-10-24T23:42:25Z, before this session started. The Tester did not touch it.
- **Dataset/parser/schema version:** synthetic only. `synthetic-uet-2026-2027-h2.1` / `…-h1.1` (status `candidate`, `synthetic-fixture`), parser `uet-xlsx@0.1.0`, domain schema `0.2.0`, manifest `1.0`. Adversarial datasets (`qa-h2.1`, `qa-xss.1`, `qa-credit.1`, `qa-next-*`, `qa-renamed-*`) were crafted in-test, hashed, and served through Playwright routes. No real student or school data was used.
- **Fixture manifest + hash:** parser fixtures 5/5 (`fixtures:run`). The synthetic web dataset is regenerated on every build, and its timetable SHA-256 changes per build (see `QA-M3-009`).
- **Environment/device/browser:** Windows 10 Pro 10.0.19045. Node 22.22.2, npm 12.0.2. Browsers:
  - Playwright Chromium 1248 (headless shell).
  - Playwright WebKit 27.2 (`webkit-2370`, installed in this session), run with the iPhone 13 profile.
  - No real devices.
- **Runner/tool versions:** TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0, @axe-core/playwright 4.13.0 (axe-core 4.13.0).
- **Test run IDs/links:** local runs only, no CI. Logs and probe scripts are in the session scratchpad `C:\Users\ADMIN\AppData\Local\Temp\claude\c--Users-ADMIN-Desktop-XepTKB\250911f4-ce2d-4942-8016-5cbb4e557cac\scratchpad\qa\`: `check.log`, `e2e.log` (baseline), `check2.log`, `e2e2.log` (rerun), `probe*.mjs`/`*.out`, `repro-*.png`, `xss.ics`. The scratchpad is session-local and not durable, so key outputs are quoted in this report.
- **Exact commands + exit codes:** see *Commands and summary*.
- **Requirement/AC/P0 coverage — all committed P0 covered?** `no`. The M3 slice (AC-M3-01…13) is covered by automated or probe evidence, with failures recorded below. Product P0 also needs M4 (FR-09/FR-10) and M5 (FR-12). Manual P0 evidence is not done: the calendar-client import (AC-07) and Tier 1 devices.

## Scope and risk focus

- **Features/requirements:** onboarding and week 1 (cohort or manual), search and section/group picker, week-aware conflict explanation and campus warning, week grid and day list with Sunday, ONL off-grid, credits, local persistence/migration/backups/wipe, offline, artifact integrity and status policy, provenance, ICS/PNG/Word/print, stale dataset and rebase, privacy/XSS/CSP.
- **Highest-risk scenarios exercised:**
  - false-negative conflicts: AC-01 exact case, disjoint odd/even weeks, adjacent periods, CL vs numbered groups, group and same-course switches, ONL carrying a day/period, week-15 and single-period boundaries;
  - ICS dates checked against an independent oracle: cohort vs manual week 1, three device time zones, sparse weeks, Sunday, ONL excluded;
  - stale-dataset rebase with changed groups and times;
  - offline reload, wipe, IndexedDB migration and backups;
  - error states: manifest unreachable/500/not JSON/schema 2.0/`..` URL/retracted; tampered artifact with and without a cache;
  - XSS in 9 dataset/manifest text fields;
  - 360 px layout on extra states; keyboard-only path to the ICS download;
  - production-build status policy and CSP enforcement;
  - WebKit smoke; two tabs.
- **Out of scope:** M4 registration import, M5 admin/CDN/PWA hardening and performance budgets, real UET data, share link (P1).

## Commands and summary

| Suite/command | Tool/run ID | Exit code | Result | Count | Evidence |
| --- | --- | ---: | --- | --- | --- |
| `npm run check` (baseline; from 2026-10-24T23:43:09Z) | lint.mjs + tsc + node:test + Vitest + run-fixtures | 0 | pass | lint pass; typecheck pass; node:test **78/78**; Vitest **31/31** (4 files); fixtures **5/5** | `check.log` |
| `npm run test:e2e` (baseline) | Playwright/Chromium on the prod build with `VITE_ALLOW_UNPUBLISHED=true`, port 4180 | 0 | pass | **10/10** (26.3 s) | `e2e.log` |
| `node scripts/bench-m3.mjs` | dev machine | 0 | pass (NFR indicative) | `{"sections":1200,"indexBuildMs":41.4,"searchP95Ms":4.91,"conflictP95Ms":4.82}`, within the 100 ms / 50 ms targets | console |
| `npx playwright install webkit` (apps/web) | — | 0 | installed | WebKit 27.2 (`webkit-2370`) | console |
| `npx vite build --outDir <scratch>/dist-prod` (no `VITE_ALLOW_UNPUBLISHED`) | Vite 8.3.4 | 0 | built | 1 JS (307.75 kB), 1 CSS, `sw.js`, CSP meta | console |
| Probe 1: scheduling, groups, weeks, ICS oracle, time zones | Chromium, own server on 4190 | 1 | 2 fail | 52/54 | fails map to `QA-M3-007` |
| Probe 2: error states, integrity with cache, stale, migration, wipe, offline | Chromium | 1 | 5 fail | 44/49 (one pass was a false positive from a loose regex, superseded by 2b) | `QA-M3-001`, `-003`, `-006` |
| Probe 2b: minimal repro of a stale pick whose group changed (renamed / added group) | Chromium | 1 | fail | 1/8 | `QA-M3-001`; `repro-renamed-group.png`, `repro-added-group.png` |
| Probe 2c: export after group-rename rebase | Chromium | 1 | fail | 0/1 (ICS 44 → 15 events) | `QA-M3-001` |
| Probe 3: XSS ×9 fields, exports escaping, 360 px states, axe, keyboard to ICS | Chromium | 0 | pass | 22/22 | `probe3.out`, `xss.ics` |
| Probe 4: prod build (no flag) policy and CSP; WebKit iPhone smoke | Chromium + WebKit, prod build on 4190/4192 | 0 | pass | 13/13 | `probe4.out` |
| Probe 5: H1 default week with today = 2026-10-25, credit policy, in-app nudge, search | Chromium | 0 | pass | 11/11 | `probe5.out` |
| Probe 6: two tabs on one Plan | Chromium | 1 | fail | 0/1 | `QA-M3-005` |
| Probe 7: independent re-check of REV-M3-003 and REV-M3-006 | Chromium | 1 | fail (both reproduced) | 0/2 | `QA-M3-002`, `QA-M3-008` |
| `wk-diag7.mjs`: first-visit update banner frequency | WebKit vs Chromium | 0 | defect observed | WebKit 9/12 (iPhone 3/6, desktop 6/6); Chromium 0/6 | `QA-M3-004` |
| New tests: `npx vitest run src/qa-m3.test.tsx`; `tsc -p tsconfig.test.json`; `tsc -p tsconfig.node.json` | Vitest / tsc | 0 / 0 / 0 | pass | 8/8 | — |
| `npm run check` (rerun with QA tests; 2026-10-25T00:12:32Z) | as baseline | 0 | pass | lint pass; typecheck pass; node:test **78/78**; Vitest **39/39** (5 files); fixtures **5/5** | `check2.log` |
| `npm run test:e2e` (rerun with QA tests) | Playwright/Chromium, port 4180 | 0 | pass | **14/14** (42.9 s) | `e2e2.log` |
| `npx playwright test e2e/qa-m3.spec.ts` (after a test-title-only edit) | Playwright/Chromium, port 4180 | 0 | pass | 4/4 | console |

New automated tests added. They pass, and nothing else was modified.

- `apps/web/src/qa-m3.test.tsx` (8 Vitest cases):
  - the PRD AC-01 exact case;
  - adjacency before and after;
  - CL vs numbered group;
  - a group switch revealing a conflict;
  - disjoint odd/even weeks and a same-course switch;
  - ONL with a day/period;
  - ICS DTSTART/DTEND equal to an independent oracle for cohort K71 and a manual week 1 (sparse Sunday weeks, ONL excluded).
- `apps/web/e2e/qa-m3.spec.ts` (4 Playwright cases):
  - AC-01, adjacency, week-scoped grid flags and a group switch in the UI;
  - hostile manifest/dataset strings inert in the UI (360 px) and the Word export;
  - the build's CSP blocking an injected inline script and an inline handler;
  - first visit with the manifest unreachable, then retry.

Deviation: the WebKit smoke used port **4192**. WebKit refuses port 4190, which is on the Fetch standard's bad-port list (ManageSieve). Chromium loads it. Port 4180 was never used by my own servers.

## Requirement/AC matrix

Legend: **E2E** = existing `e2e/m3.spec.ts`; **UT** = existing Vitest/node:test; **QA-E2E/QA-UT** = new QA test files; **P#** = probe.

| Requirement/AC/P0 | Test case | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| AC-M3-01 onboarding (FR-01, P0 #2, C-08) | E2E core flow (cohort only); UT `previewWeek1`; P1 manual week 1 in Plan settings; P5 H1 cohorts; QA-UT manual ICS | Cohort gives `Term.starts`; manual date must be a Monday and is stored as an override; persists after reload | Ambiguous cohorts keep "Tạo phương án" disabled until chosen. K71 gives 22/02/2027. Tuesday 2027-03-02 is rejected with "phải là Thứ Hai" and Save is disabled. 2027-03-01 is saved as "(tự nhập)", persists after reload, and ICS shifts accordingly | **pass** | Gap in the existing suite: the manual path is not in E2E (now covered by P1/QA-UT) |
| AC-M3-02 search/picker (FR-02/03, P0 #3/#4) | E2E `giai tich`, group required; UT alias search; P3 card text; P5 `tin chi` | Accent-insensitive search; card shows Mã LHP, nhóm, thứ, tiết + giờ, tuần, phòng/campus, GV, lớp khóa, ONL label; multi-group requires a group | As expected; ONL badge "Trực tuyến · không xếp lịch tuần"; empty state "Không tìm thấy môn nào." | **pass** | E2E/UT/P3/P5 |
| AC-M3-03 conflict explanation (FR-04, PRD AC-01, P0 #5) | P1 (21 conflict cases); QA-UT (6); QA-E2E; P2/P2b stale cases | Text "Trùng lịch" with code/day/periods/weeks; no conflict for disjoint weeks; campus warning for adjacent different-campus sessions | **Fresh plans:** every case correct. Examples: "…QAA001 1 (Môn A nhóm): Thứ 3, tiết 5–6, tuần 8–10"; odd vs even weeks → none; adjacency → none; group switch → T5 tiết 2 tuần 5; ONL with a day → none; campus warning "(Hòa Lạc ↔ ĐHKHTN), Thứ 2, tuần 5–8", and none when weeks are disjoint. **After a dataset revision that changes a picked section's groups:** conflicts with that section are no longer reported, and the summary says "✓ Không có lớp nào trùng lịch" | **fail** | `QA-M3-001` (S1); campus warning had no coverage in the existing suite |
| AC-M3-04 grid/day list (FR-06/07, P0 #6) | E2E week 9; P1 weeks 1/2/5/6/15; P4 WebKit | Correct day × period for the selected week; text conflict marker; ONL listed separately; dated day list | Correct for resolvable picks: CN column only in weeks with a Sunday class; conflict blocks only in intersecting weeks; ONL never on the grid; "Chủ nhật, 06/06/2027" for K71 week 15; same dates under LA/Kiritimati device time zones. Unresolved picks disappear from the grid while the plan still counts them | **pass with defect** | `QA-M3-001` |
| AC-M3-05 responsive/a11y/keyboard (P0 #8) | E2E 360/768/1280 overflow + axe + keyboard to a pick; P3 extra states and keyboard to export at 360; P4 WebKit iPhone | No page overflow; no serious/critical axe issues; keyboard search → pick → export; visible focus | No overflow or serious/critical issues, including provenance open, long/hostile strings, conflict grid/summary and the error state. Keyboard at 360 px: onboarding → tab → search → radio arrows → pick → End to the Phương án tab → Enter downloads the ICS; every focused element had an outline | **pass** (Chromium; WebKit overflow only) | Screen-reader pass not run |
| AC-M3-06 persistence/offline/wipe | E2E reload/offline/wipe; P2 wipe internals, offline after wipe, offline cross-term; P4 WebKit reload | Plan survives reload; offline reload works after the first online visit; wipe clears Plan, dataset cache and app cache | Reload and offline pass. Wipe empties `plans`/`backups` and deletes `ky-nay-shell-*` (dataset and settings are re-cached immediately by the reload, which is public data). **After a wipe, offline reload fails (`net::ERR_FAILED`) until the next deploy.** Offline, a Plan in a term other than the last viewed one is unreachable | **pass with defects** | `QA-M3-003` (S2), `QA-M3-006` (S3) |
| AC-M3-07 artifact integrity | UT loader; E2E tampered (no cache); P2 with cache; P2 first-visit errors; P4 prod build | Wrong sha256/school/term/version, unsupported schema or domain violation rejected; cache kept and error shown; `retracted` never loaded; unpublished only in dev/preview builds | All verified: hash mismatch, `endPeriod` 13, artifact naming another term, manifest 503 → cached data + "Không cập nhật được dữ liệu …"; first visit → specific error + "Thử lại"; `..` URL → "Danh mục dữ liệu không hợp lệ"; retracted current version → fail closed. Prod build (no flag): `candidate`/`validated` refused, `published` loads | **pass** | P2 44 checks, P4. Percent-encoded `..` is G3b `SEC-M3-002` (not retested) |
| AC-M3-08 provenance (FR-01, P0 #12) | E2E provenance; P4 published entry | Version, source type, document ref, parser, import/review time, status, short hash, independence disclaimer | All shown; review/publish times shown when present ("Duyệt lúc 08:00 25/10/2026") | **pass** | E2E, P4 |
| AC-M3-09 ICS (FR-11, PRD AC-06/AC-07) | E2E (33 events, 2 DTSTART); P1 oracle; QA-UT oracle; P4 WebKit 46 events | One VEVENT per teaching week; date = week1+(w-1)·7+(d-2); UTC from UTC+7; name/term/version/source; no ONL/PII | Every DTSTART/DTEND equals the independent oracle: 58 events for K71; manual 2027-03-01; device TZ America/Los_Angeles (across the US DST change) and Pacific/Kiritimati. Also checked: sparse/Sunday weeks, unique UIDs, CRLF, ≤ 75 octets, no ONL, no property injection from hostile text. **Exports silently omit unresolved picks** | **pass with defect** | `QA-M3-001`; calendar-client import not run |
| AC-M3-10 PNG/Word/print | E2E PNG header/width, Word content, PDF MediaBox 842×595; P3 Word escaping and PNG with hostile text | PNG/Word carry grid/table + metadata; all strings escaped; print A4 landscape, controls hidden | As expected; Word contains no raw `<script`/`<img`/`<svg`/`<iframe` | **pass** (automated scope) | Visual review not done; G3c `REV-M3-010` (PNG one-period conflict text) not retested |
| AC-M3-11 credits (FR-08, C-02) | UT; P1; P5; P7 | Each course counted once; unknown shown "chưa rõ", not 0; thresholds only with `creditPolicy` | Once-per-course and ONL counted ("9 lớp · 18 tín chỉ"); summary lists "(chưa rõ tín chỉ: …)"; policy 14/25 gives below/above warnings. **The plan bar reads "1 lớp · 0 tín chỉ" when only unknown-credit courses are picked** | **pass with defect** | `QA-M3-008` (S3) |
| AC-M3-12 stale Plan | E2E (section removed); UT; P2 time change; P2b group change | Banner; "Cập nhật" lists classes that no longer exist before confirming | Section removal and time change OK (the conflict from the new time appears before and after rebase). **Group renamed/added: the confirmation says "Mọi lớp đã chọn vẫn còn trong dữ liệu mới."** and the pick silently stops resolving | **fail** | `QA-M3-001` |
| AC-M3-13 privacy/XSS/CSP | E2E same-origin GET-only + CSP meta present; P3; P4; QA-E2E | Same-origin only; no analytics; dataset text inert; CSP blocks inline scripts in the build | Payloads in course name, room, campus, lecturer, home class, term name (manifest + metadata), documentRef and publishedBy render as text: no injected nodes, no dialogs, `window.__qa` unset. Word escaped; ICS lines all valid properties. Injected inline `<script>` and `onerror` were blocked with `securitypolicyviolation` (`script-src-elem`, `script-src-attr`). Bundle has no external fetch URLs and no source maps | **pass** | P3, P4, QA-E2E |
| NFR search/conflict p95 | `bench-m3.mjs` | search < 100 ms, conflict < 50 ms (~1,000 sections) | 4.91 ms / 4.82 ms (1,200 sections) | **pass** (indicative) | dev machine only |

P0 traceability for the M3 slice:

| Requirement | ACs | Status |
| --- | --- | --- |
| FR-01 | AC-M3-07/08 | pass |
| FR-02 | AC-M3-02 | pass |
| FR-03 | AC-M3-02/03 | pass, with defect `QA-M3-002` |
| FR-04 | AC-M3-03 | **fail**, `QA-M3-001` |
| FR-06 | AC-M3-04 | pass |
| FR-07 | AC-M3-04/05 | pass |
| FR-08 | AC-M3-11 | pass, S3 |
| FR-11 | AC-M3-09/10 | pass; manual calendar import pending; exports affected by `QA-M3-001` |

## Quality checks

| Area | Expected/control | Actual/evidence | Result |
| --- | --- | --- | --- |
| Privacy/network/log/Sentry | no PII/raw registration | No PII inputs in M3. E2E: requests same-origin, GET-only. Bundle grep: only XML namespaces and the react.dev error URL (not fetched); no analytics; no source maps | pass |
| Security/auth/RBAC/share/file | controls enforced | Hash/size/schema/domain checks fail closed (P2). Prod build refuses unpublished data (P4). CSP enforced (P4, QA-E2E). XSS inert in UI/Word/ICS/PNG (P3). Backup JSON download returns the original record and never renders it | pass (G3b owns the security decision) |
| Accessibility/keyboard/contrast | no blocking issue | axe WCAG 2.1 A/AA: no serious/critical on 8 additional states. Keyboard-only flow to the ICS download at 360 px; focus outline on every focused element | pass (screen reader not run) |
| Responsive/mobile/desktop | supported viewports usable | No page overflow at 360/768/1280 (E2E) or at 360 with provenance open, hostile/long strings and the error state (P3); WebKit iPhone 13 grid (P4) | pass |
| Offline/cache/update | safe stale/fallback | Offline reload OK after the first visit. Broken after a wipe (`QA-M3-003`). Offline cross-term unreachable (`QA-M3-006`). Spurious update banner in WebKit (`QA-M3-004`). The SW update flow between two builds is untested | **fail (S2 follow-ups)** |
| Export/calendar | correct dates/content | ICS equals the independent oracle in all probed modes and time zones. Exports omit picks that stopped resolving (`QA-M3-001`) | **fail (S1)** |
| Performance budgets | thresholds in spec | Indicative bench passes; formal budgets are M5 | pass (indicative) |

## Findings

| Finding ID | Severity | Repro/evidence | Impact | Owner/status/expiry |
| --- | --- | --- | --- | --- |
| `QA-M3-001` | **S1** | See detail 1 below | False-negative conflicts and silently incomplete grid and exports after a dataset revision changes a picked section's groups. The UI asserts the opposite ("no conflict", "every class still exists"). The QA plan §8 classes false-negative conflicts and wrong exports as S1. Independently matches G3c `REV-M3-001` | Frontend/Coder, plus Tech Lead for the unresolved-pick contract (whether CL sessions should still resolve). **Open; blocks G3a.** No waiver possible |
| `QA-M3-002` | S2 | See detail 2 below | After any pick stops resolving, the user cannot add classes, and the message points at the wrong class. Matches G3c `REV-M3-003` | Frontend/Coder. Open; fix together with `QA-M3-001` |
| `QA-M3-003` | S2 | See detail 3 below | "Xóa dữ liệu trên máy" permanently disables offline use (AC-M3-06) until a new build ships, with no indication. Workaround: clear site data or wait for a deploy. Matches G3c `REV-M3-002` | Frontend/Coder. Open; owner/date/mitigation needed before G4a |
| `QA-M3-004` | S2 | See detail 4 below | On a Tier 1 engine (Safari iOS), most first visits show a false "Có phiên bản mới của ứng dụng" banner whose button does nothing. No data impact. Needs real-device confirmation | Frontend/Coder. Open; confirm on a real iPhone (owner) |
| `QA-M3-005` | S2 | See detail 5 below | Silent loss of the user's own Plan edits when two tabs are open (common on desktop). Related to G3b `SEC-M3-006(b)` (wipe resurrection across tabs) | Frontend/Coder. Open |
| `QA-M3-006` | S3 | Open H2, create a Plan, switch to H1 ("Đổi học kỳ"), reload online, go offline, reload. The "Học kỳ" selector lists only "Học kỳ I…", so the H2 Plan is unreachable. P2 last block. `apps/web/src/data/loader.ts:139` returns `terms: [termOption(cached.entry)]` although every term's dataset is cached in IndexedDB | The offline Plan is hidden behind the last-viewed term. Workaround: go online | Frontend/Coder. Open |
| `QA-M3-007` | S3 | See detail 7 below | A picked conflicting class's card shows no conflict in the picker (D-M3-4 says the conflict is always visible there). The group-switch button gives no text cue (WCAG "not colour only"). Grid, summary and plan bar do show the conflict. Badge part matches G3c `REV-M3-007` | Frontend/Coder. Open |
| `QA-M3-008` | S3 | Pick only SYN4001 1 (no credits): the plan bar reads "Học kỳ II … · 1 lớp · 0 tín chỉ" (P7). `apps/web/src/components/Workspace.tsx:108` prints `knownTotal` with no "chưa rõ" cue; the summary tab does show "(chưa rõ tín chỉ: …)" | AC-M3-11 says unknown credits are not shown as 0. Matches G3c `REV-M3-006` | Frontend/Coder. Open |
| `QA-M3-009` | S3 | Each run of `scripts/build-synthetic-dataset.mjs` gives different artifacts for the same synthetic `datasetVersion`. `synthetic-uet-2026-2027-h2.1/timetable.json` was `f0df5d3c…` (generated 2026-10-24T23:43:52Z), `05756156…` (rerun ~00:13Z) and `7ba9dca8…` (00:14:34Z). Two of these were compared field by field and are identical apart from `source.rawHash`/`artifactId`. Cause: `packages/parser/test/synthetic-xlsx.ts:42` calls `zipSync(files)` with no fixed mtime, so the workbook hash changes per build | The same dataset version does not identify the same bytes, and hashes cited in evidence cannot be reproduced. Clients re-download on every rebuild. Synthetic data only | Data Parser / Frontend (script). Open; fix with a fixed zip mtime |
| `QA-M3-010` | S3 (process) | `docs/evidence/M3-EVIDENCE-ENVELOPE.md` (EVID-M3-001) is linked from `M3-SPEC.md:9`, `ADR-0010…md:11`, `M3-DESIGN-HANDOFF.md:9` and `M3-IMPLEMENTATION-HANDOFF.md:11`, but does not exist. The G2 target is an uncommitted tree with no build or file hashes. This report records its own content hash instead | Gate evidence cannot be bound to an immutable artefact. G3c rates the same issue S2 (`REV-M3-005`) | Tech Lead. Open; required before G4a |

### Finding details

**1. `QA-M3-001` (S1).** Picks that stop resolving after a dataset revision drop out of conflicts, the grid and the exports.

- Repro (probe 2b, `repro-renamed-group.png`):
  1. Pick SYN1001 1 group 2.
  2. Publish a new dataset version in which group "2" of SYN1001 1 is renamed "3". Same times, same section id.
  3. Reload. The stale banner appears. Click "Cập nhật phương án". The confirmation says **"Mọi lớp đã chọn vẫn còn trong dữ liệu mới."** Click "Xác nhận cập nhật".
  4. Observe:
     - the plan bar still says "1 lớp · 4 tín chỉ";
     - the week grid says "Chưa có lớp nào";
     - the summary says **"✓ Không có lớp nào trùng lịch."** with no error;
     - SYN1003 1 (T2 tiết 1–3, tuần 9–15) is offered as "Chọn lớp này" with no conflict, although SYN1001 1's unchanged CL lecture is on T2 tiết 1–3, tuần 1–15.
- Same false negative when a group is *added* (GROUP_REQUIRED). There "Chưa chọn nhóm" is shown, but conflicts and "✓ Không có…" are still wrong.
- Export (probe 2c):
  - 2 picks: ICS goes from **44 → 15 events**. All 29 SYN1001 1 events, including its 15 unchanged lectures, disappear while the plan still lists the class.
  - 1 pick: the export buttons are disabled with "Hãy chọn ít nhất một lớp để xuất lịch".
- The defect already applies before rebase, while the plan is stale.
- Root cause:
  - `packages/domain/src/plan.ts:46,50` returns `sessions: []` (the CL sessions too) on GROUP_REQUIRED/GROUP_NOT_FOUND.
  - `apps/web/src/model/plan-view.ts:34` computes conflicts and sessions from `resolution.picks` and ignores `resolution.issues`.
  - `plan-view.ts:57-60` (`missingPicks`) checks only that the section exists.
  - `apps/web/src/components/PlanSummary.tsx:22` (rebase confirmation), `:75-76` (only GROUP_REQUIRED and SECTION_NOT_FOUND are surfaced) and `:93` ("✓ Không có lớp nào trùng lịch").
  - `apps/web/src/model/picker.ts:73-74` (the preview uses the same resolution).
- Recommendation: list every pick that will not resolve (group gone or newly required) in the rebase confirmation; show an error on the pick; never show "✓ Không có lớp nào trùng lịch" or enable exports silently while any pick fails to resolve; consider resolving CL sessions even when the group is invalid; add regression tests based on probe 2b/2c.

**2. `QA-M3-002` (S2).** One unresolved pick blocks every later pick.

- Repro (probe 7): after the `QA-M3-001` rebase, pick an unrelated SYN2004 1. It is rejected with **"Nhóm đã chọn không có trong lớp này."**, and nothing can be added.
- Root cause:
  - `apps/web/src/model/picker.ts:92-99` (`applyPick`) calls domain `addPlanPick`.
  - `packages/domain/src/plan.ts:147-151` rejects the pick when *any* resolution error exists, including errors from existing picks.
  - `apps/web/src/components/Workspace.tsx:19` maps that error to text that blames the new class.

**3. `QA-M3-003` (S2).** "Xóa dữ liệu trên máy" disables offline use until the next deploy.

- Repro (probe 2, wipe block):
  1. Visit online until the service worker controls the page.
  2. Wipe.
  3. Create a Plan again online, pick a class, reload.
  4. The `ky-nay-shell-*` cache exists again but holds **0 entries**.
  5. Go offline and reload: `net::ERR_FAILED`.
- Root cause: `apps/web/src/storage/local-data.ts:29-30` deletes the SW caches while the worker stays registered. `apps/web/vite.config.ts:56` precaches only on `install`. The fetch handler at `:74/:78` re-creates an empty cache through `caches.open(CACHE)`.
- Recommendation: unregister and re-register the worker after a wipe, or have the worker re-precache (or cache on fetch) when its cache is missing.

**4. `QA-M3-004` (S2).** False update banner on first visit in WebKit.

- Repro (`wk-diag7.mjs`, prod build): fresh WebKit context, first visit. **"Có phiên bản mới của ứng dụng … Tải lại"** appears in 9/12 runs (iPhone 13 profile 3/6, desktop 6/6); Chromium 0/6. Clicking "Tải lại" does nothing: 0 navigations, the banner stays.
- A trace (`wk-diag5`) shows no registration at init, then `controllerchange` at ~204 ms from `clients.claim()`. In WebKit the `installed` statechange is delivered after a controller exists.
- Root cause: `apps/web/src/app/sw-client.ts:23-25,32-33`. `offer()` checks `navigator.serviceWorker.controller` when the event fires, not whether a controller existed before this install.
- Recommendation: record whether a controller existed at registration; verify `registration.waiting` at click time.

**5. `QA-M3-005` (S2).** Two tabs silently lose each other's edits.

- Repro (probe 6):
  1. Tab A creates a Plan. Tab B opens the same Plan.
  2. A picks SYN2004 1, then B picks SYN3003 1.
  3. A fresh tab shows "1 lớp · 3 tín chỉ": A's pick is gone, with no warning.
- Root cause: `apps/web/src/app/controller.ts:89-95` (`persistPlan`) writes the tab's in-memory Plan (last write wins). There is no `updatedAt` check and no cross-tab signal.

**7. `QA-M3-007` (S3).** A picked class's card stops showing its conflict.

- Repro (probe 1):
  1. Pick A group 1 and C1.
  2. In A's card choose group 2 (the preview correctly shows the conflict). The button reads only **"Đổi nhóm"**, with no "trùng" text.
  3. Click it. Afterwards A's card shows "✓ Đã chọn" but **no "⚠ Trùng lịch" badge**.
- Root cause: `apps/web/src/components/SectionCard.tsx:28-29` (no preview when the same group is picked) and `:33` (the label ignores `conflicting`).

## Limitations and skipped tests

| Test | Why skipped | Owner | Due/expiry | Re-entry trigger |
| --- | --- | --- | --- | --- |
| Real devices: Tier 1 Safari iOS (2 versions), Chrome Android; Tier 2 Samsung Internet, Firefox | No devices in this session. Playwright WebKit on Windows is only an approximation (SW behaviour differs, see `QA-M3-004`) | Owner (manual) | before G4a | any UI/SW change |
| ICS import into a calendar client (PRD AC-07) | No calendar client available; only RFC structure and the date oracle were checked | Owner (manual) | before G4a | export change |
| Visual review of PNG, Word in MS Word, print preview | Automated checks cover structure and escaping only; G3c `REV-M3-010` (PNG one-period conflict text) was not retested | Owner / Tester | before G4a | export layout change |
| Screen-reader pass (TalkBack/VoiceOver) | Not available; axe plus keyboard only | Tester / owner | before G4a | a11y change |
| Service-worker update flow between two real builds | Needs two deployed builds; only the false-positive banner was examined | Frontend + Tester | M5 PWA hardening | SW change |
| WebKit offline/SW behaviour | The WebKit smoke ran with `serviceWorkers: "block"` so route-served data could be used; SW-controlled requests bypass Playwright routes in WebKit | Tester | with a real-device run | — |
| iOS storage eviction / private mode | Not reproducible in Playwright | Frontend | M5 | — |
| In-app browsers (Facebook/Messenger/Zalo) | Only UA detection was checked (nudge shown for an `FBAN` UA) | Owner (manual) | before G4a | — |
| CI on GitHub (`m0-foundation.yml` e2e job) | Not executed from this session | Tech Lead | before G4a | workflow change |
| Percent-encoded `..`, size cap without Content-Length, lint-guard bypass | G3b scope (`SEC-M3-002/004/005`); not retested by QA | Security Reviewer | per G3b | — |
| Production budgets (bundle size, mobile render) | M5 scope; dev-machine bench only | Release Manager | M5 | — |

## Gate decision

- **Decision: `qa-no-go`.** `QA-M3-001` is an open S1: a false-negative conflict plus silently incomplete exports after a dataset revision, while the UI states "Không có lớp nào trùng lịch". AGENT_WORKFLOW §3/§11 and QA_TEST_PLAN §8 block on any S0/S1, and the Tester cannot waive it. AC-M3-03 and AC-M3-12 fail for that scenario. All other M3 acceptance criteria pass in the automated scope, with the S2/S3 follow-ups above.
- **Tester actor/date/evidence:** Claude subagent (Tester role), not a human sign-off; 2026-10-25T00:16:24Z; evidence in this report, the new tests `apps/web/src/qa-m3.test.tsx` and `apps/web/e2e/qa-m3.spec.ts`, and scratch probes 1–7.
- **Release recommendation:** `no-go`.
- **Conditions/next owner:**
  1. Frontend/Coder (with Tech Lead for the unresolved-pick contract) fixes `QA-M3-001` and `QA-M3-002`, with regression tests reproducing probe 2b/2c/7.
  2. S2 items `QA-M3-003/004/005` get a fix, or an owner + mitigation + expiry accepted by the Release Manager.
  3. S3 items get an owner/date.
  4. Tech Lead creates EVID-M3-001 and freezes the G2 target (`QA-M3-010`).
  5. Re-entry: any code change reopens G2/G3a/G3c. The Tester re-runs `npm run check`, `npm run test:e2e` and probes 1–7, then issues a new report that supersedes TEST-M3-001.
