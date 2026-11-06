# Review — M3 Core UI & export G3c independent review

> **Artifact ID:** `REVIEW-M3-001`  
> **Artifact status:** `ready`  
> **Canonical gate:** `G3c`  
> **Owner:** Independent Reviewer  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [M3 spec](M3-SPEC.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [M3 design handoff](M3-DESIGN-HANDOFF.md), [M3 implementation handoff](M3-IMPLEMENTATION-HANDOFF.md), [M3 G3b security review](M3-G3b-SECURITY-REVIEW.md), [Implementation plan §2/§10](../IMPLEMENTATION_PLAN.md), [PRD §4–§8](../PRD.md), [Domain model](../DOMAIN_MODEL.md), [Agent workflow](../../.claude/AGENT_WORKFLOW.md)  
> **Evidence envelope:** `EVID-M3-001` ([M3-EVIDENCE-ENVELOPE.md](M3-EVIDENCE-ENVELOPE.md)). The file does not exist at review time (see `REV-M3-005`). Run evidence for this review is recorded below.  
> **Independent reviewer / approval UTC timestamp:** Claude subagent (Independent Reviewer role) — not a human sign-off / 2026-10-25T00:04:37Z

## Scope and identity

- Review type: correctness / contract fidelity / state and storage behaviour / tests vs acceptance / docs consistency / maintainability where it creates risk.
- Source spec/ADR/PRD: SPEC-M3-001 (AC-M3-01…13, D-M3-1…4), ADR-0010 §1–§5, DESIGN-M3-001, IMPL-M3-001, `IMPLEMENTATION_PLAN.md` §2 (M3 row) and §10 (Q-001…Q-010), `PRD.md` §4–§8, `DOMAIN_MODEL.md` §3, §5–§9. All M3 docs are `ready` with G0/G1 acknowledgement pending (`g0-blocked`/`g1-blocked` on form, implementation on owner instruction of 2026-10-25).
- Base commit/diff ID: `4681c633af9344a7c541fa91bd45a8a9f4a904be` (`main`).
- Target: the **uncommitted** working tree on top of `4681c63` (not immutable). Fingerprint of `git diff 4681c63` + untracked `apps/web/**` (excluding generated `public/data`), `packages/export/**`, `scripts/*` at review time: SHA-256 `5665b256e32fec095843249a06ba89eaed282c309da5853031d818da320b4d5d`. Per-file SHA-256 prefixes of the files the findings point at: `model/plan-view.ts` `d2c11ba29e93e44e`, `components/PlanSummary.tsx` `8ab597938e859715`, `data/loader.ts` `be09ad1501925ca0`, `storage/local-data.ts` `c282abec8e1ed7ac`, `vite.config.ts` `b8b446a03d60742b`, `app/controller.ts` `79c0edd1479d1309`. During the review another agent modified the root `README.md` and added `M3-G3b-SECURITY-REVIEW.md`; neither is in scope of this review.
- Build exercised dynamically: the prebuilt copy given to this review (`…/scratchpad/review/dist`, copied to `…/scratchpad/review/dist2` for probes), bundle `assets/index-ys2Rb7jC.js`, SW cache `ky-nay-shell-111fae0d19c0a846`, built with `VITE_ALLOW_UNPUBLISHED=true`. This review did **not** build.
- Dataset/parser/schema/fixture versions: synthetic dataset `synthetic-uet-2026-2027-h2.1` / `…-h1.1` (`source.type = synthetic-fixture`, `candidate`), parser `uet-xlsx@0.1.0`, domain schema `0.2.0`, manifest `1.0`. Synthetic data only; no real school data or PII was used.
- Tested commands / run IDs / exit codes (Windows 10, Node 22.22.2, local, 2026-10-25):

| Command | Result |
| --- | --- |
| `npx vitest run` (in `apps/web`) | exit 0 — 4 files, **31/31** |
| `node --test packages/*/dist/test/*.test.js` (12 compiled files) | exit 0 — **78/78** |
| `node --test packages/export/dist/test/export.test.js` | exit 0 — 8/8 |
| `node scripts/bench-m3.mjs` | exit 0 — `{"sections":1200,"indexBuildMs":18.1,"searchP95Ms":2.11,"conflictP95Ms":1.98}` |
| `npx vite preview --outDir …/dist2 --port 4192 --strictPort` + throwaway Playwright probe `…/scratchpad/review/probe.mjs` (Chromium, `playwright-core` 1.64.0) | scenarios `wipeOffline`, `staleBlocksPick`, `staleGroupRenamed`, `unknownCredits`, `campusAndPickedConflictBadge`, `swUpdate`, `cacheWriteFailure`, `wipeThenImmediateReload`, `termSwitch`; outputs quoted in the findings. Server stopped afterwards |
| `node …/scratchpad/review/ics-check.mjs` (compiled `@ky-nay/domain` + `@ky-nay/export` on the synthetic timetable) | exit 0 — ICS dates/times checked (see clean areas) |

- Not run (by instruction): `npm run build`, `npm run check`, `npm run test:e2e`. The handoff's Playwright 10/10 claim is therefore not independently re-run; the e2e spec was reviewed statically.
- Requirement/AC/P0 coverage: M3 slice of FR-01–FR-08, FR-11, AC-01, AC-06, AC-07 (PRD P0 #2–#8, #11, #12). Product P0 overall stays `no` (M4/M5 open).

## Verdict

**`review-no-go`**

One S1 (`REV-M3-001`): after a dataset revision changes the groups of a section the student picked, that section silently stops taking part in conflict detection, the grid and every export, while the app states "✓ Không có lớp nào trùng lịch." and the rebase dialog states "Mọi lớp đã chọn vẫn còn trong dữ liệu mới." This is a false-negative conflict plus missing ICS events on the stale/rebase path that M3 owns (AC-M3-12). In addition, the mandatory evidence envelope `EVID-M3-001` does not exist and the G2 target is not immutable (`REV-M3-005`), which is itself a no-go condition under AGENT_WORKFLOW §11. Four S2 and five S3 findings follow.

The core happy path is solid: conflicts come from the domain engine, ICS dates/UTC are correct, ONL handling follows Q-009, the service-worker update flow works, and output escaping holds (see clean areas).

## Structured checks

| Check | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Correctness/domain invariants | conflicts `day × period × weeks` from the domain engine; no false negatives; week1/date and credits from domain | Happy path correct: `findConflicts`, `resolvePlanPicks`, `resolvePlanWeek1`, `calculatePlanCredits`, `dateFor` are used, not re-implemented. Picks that fail resolution are dropped from conflicts/grid/ICS without the UI noticing (`REV-M3-001`); one unresolved pick blocks all later picks (`REV-M3-003`) | **fail** |
| Parser/data provenance | deterministic, traceable, fail closed | Loader checks size, SHA-256 (WebCrypto), schema, header match, domain invariants and time-frame coverage before data reaches the UI; provenance panel shows version/source/status/parser/import/review/hash prefix; synthetic data stamped into exports. A storage failure after verification is misreported as invalid data (`REV-M3-004`) | **pass with finding** |
| Scope/contract/migration | no silent drift | ADR-0010 vs code drift on unpublished policy, `validatePlan` use, banner rule, 0.1.0 contradiction handling, CSP list; TECH_STACK/ARCHITECTURE/README/plan not updated (`REV-M3-009`). Plan envelope `0.2.0` + 0.1.0 migration + backups implemented | **pass with finding** |
| Privacy/security boundary | no unsafe crossing | No PII in M3; same-origin fetch only from the loader; text rendered as text; Word/ICS escaped. G3b (`SEC-REVIEW-M3-001`) is `security-pass-with-exception` with SEC-M3-001…007 (all S3). This review adds no privacy finding | **pass** (defer to G3b) |
| Performance/maintainability | search p95 < 100 ms, conflict p95 < 50 ms (~1,000 sections) | bench: search p95 2.11 ms, conflict p95 1.98 ms (1,200 sections). Group-option logic duplicates the domain rule (`groupOptions` vs `sectionGroups`) but is consistent today | **pass** |
| Tests/docs/observability | evidence complete; tests catch the claimed failures | Unit 31/31 and 78/78 reproduced. Several AC claims are untested or tested at the wrong boundary (`REV-M3-008`); evidence envelope missing and handoff stale (`REV-M3-005`) | **fail** |

## Findings

> Ordered by severity. Every finding was reproduced in the prebuilt app or is a direct reading of the cited code with the stated scenario.

### `REV-M3-001` — [S1] Picks that stop resolving after a dataset revision silently drop out of conflicts, grid and exports, while the app reports "no conflict"

- **File/line/artefact:** `apps/web/src/model/plan-view.ts:32-54` (`buildPlanView` uses `resolution.picks` for conflicts/sessions but never acts on `resolution.issues`), `:57-59` (`missingPicks` only checks that the section still exists), `:62-74` (`rebasePlan` keeps picks whose group is no longer valid); `apps/web/src/components/PlanSummary.tsx:75-76` (only `GROUP_REQUIRED` and `SECTION_NOT_FOUND` are surfaced), `:93` ("✓ Không có lớp nào trùng lịch." whenever `view.conflicts` is empty); `apps/web/src/components/SectionCard.tsx:28-29` (picked card shows "✓ Đã chọn · nhóm 2" and skips any check). Domain behaviour this relies on: `packages/domain/src/plan.ts:44-50` returns **no sessions at all** (not even `CL`) for `GROUP_NOT_FOUND`/`GROUP_REQUIRED` and reports an `error` issue — correct for the engine; the UI must act on it.
- **Failure scenario:** a student picks `SYN1001 1` group 2 and, knowingly, `SYN1003 1`, which overlaps the common LT session (Thứ 2, tiết 1–3, tuần 9–15). The school publishes a revised timetable where group "2" of `SYN1001 1` is relabelled "3" (everything else unchanged). The app loads the new version, shows the stale banner, and the student confirms "Cập nhật phương án".
- **Expected / actual:** expected — the rebase step lists `SYN1001 1` as needing a group choice, the conflict on Thứ 2 stays visible (the `CL` session did not change), the pick shows an error, and exports either include the class or warn. Actual (probe `staleGroupRenamed`):
  - before the revision: plan bar `… · 2 lớp · 7 tín chỉ · ⚠ 1 chỗ trùng lịch`;
  - on the new version (before rebase): `… · 2 lớp · 7 tín chỉ` — the conflict count is gone;
  - rebase confirmation: "Mọi lớp đã chọn vẫn còn trong dữ liệu mới.";
  - after rebase: week 9 grid contains only `SYN1003`; pick list `SYN1001 1 Giải tích 1 · nhóm 2 · 4 TC` with **no** field error; summary "✓ Không có lớp nào trùng lịch."; downloaded ICS has 7 events, **0** for `SYN1001` (36 before the revision; at least the 15 unchanged LT events were expected).
  - The same mechanism applies when a revision adds a second numbered group to a picked section (`GROUP_REQUIRED`): an error is shown in the summary, but all of the section's sessions (including `CL`) disappear from conflicts/grid/ICS while the summary simultaneously says "✓ Không có lớp nào trùng lịch."
- **Impact:** false-negative conflict and missing calendar events for a class the UI still lists as chosen and counts toward credits. Triggered by a routine TKB revision, which is exactly the situation the M3 stale/rebase flow (AC-M3-12) exists for. Students may register for, or import into their calendar, a timetable with an undetected clash.
- **Evidence/repro/run ID:** `…/scratchpad/review/probe.mjs staleGroupRenamed` against `dist2` (bundle `index-ys2Rb7jC.js`), output quoted above. `apps/web/src/model/model.test.ts:74-83` covers only a removed section; no test covers a changed group.
- **Recommended fix:** derive an "unresolved picks" list from every error-severity `resolution.issues` entry (`SECTION_NOT_FOUND`, `GROUP_NOT_FOUND`, `GROUP_REQUIRED`, `DUPLICATE_*`) and (1) show it in the stale/rebase confirmation and on each affected pick, (2) never render "✓ Không có lớp nào trùng lịch." or a conflict-free plan bar while any pick is unresolved, (3) warn or block in `ExportPanel` when exported sessions do not cover every pick, (4) make `rebasePlan` either require a new group choice or drop the invalid group and flag the pick. Add unit tests for group renamed / group added and an e2e variant of the AC-M3-07/12 rebase test.
- **Owner / status / due:** Frontend/Coder / open / before G3c re-run (blocks M3 G3 and any G4).

### `REV-M3-002` — [S2] "Xóa dữ liệu trên máy" permanently disables offline use until the next app deploy

- **File/line/artefact:** `apps/web/src/storage/local-data.ts:26-31` (deletes every `ky-nay-*` cache, including the active service worker's precache, but keeps the worker registered); `apps/web/vite.config.ts:55-57` (precache is filled only in `install`), `:78` (cache-first handler never writes back on a miss); `apps/web/src/app/controller.ts:101-108`.
- **Failure scenario:** a student uses the app online (service worker installed), taps "Xóa dữ liệu trên máy" to reset, creates a new Plan and keeps using the app online. Later, offline, they reopen the app.
- **Expected / actual:** expected (AC-M3-06, PRD §8 availability) — after an online visit the Plan opens offline. Actual (probe `wipeOffline`): before the wipe the shell cache held 6 entries and an offline reload showed "Đang ngoại tuyến"; after wipe → new Plan → two online reloads, cache `ky-nay-shell-111fae0d19c0a846` exists with **0** entries, the page is still SW-controlled, and the offline reload fails with `net::ERR_FAILED`. The worker's `install` never runs again for the same build, so this persists until a new `sw.js` is deployed.
- **Impact:** offline view silently broken after using a P0 privacy control; no in-app recovery (the user would have to clear site data in browser settings).
- **Evidence/repro/run ID:** `probe.mjs wipeOffline` (output above). The e2e wipe test (`apps/web/e2e/m3.spec.ts:232-240`) only checks that onboarding reappears; the offline test (`:214-230`) never wipes.
- **Recommended fix:** after deleting the caches, unregister the service worker (`navigator.serviceWorker.getRegistrations()` → `unregister()`), so the next online load re-installs and re-precaches; alternatively re-populate the precache on demand in the fetch handler. Add an e2e: wipe → online reload → offline reload shows the Plan.
- **Owner / status / due:** Frontend/Coder / open / before G4a.

### `REV-M3-003` — [S2] One unresolved pick blocks every later pick, with an error that blames the class being picked

- **File/line/artefact:** `apps/web/src/model/picker.ts:92-98` (`applyPick` → domain `addPlanPick`, which rejects the whole candidate if **any** pick in the Plan has an error issue); `apps/web/src/components/Workspace.tsx:17-23`, `:85-93` (all issue codes are mapped to sentences about "this class").
- **Failure scenario:** a Plan contains a section that the current dataset removed (stale Plan, not yet rebased) or a pick with an invalid group after a revision (`REV-M3-001`, which rebase does not clear). The student tries to add an unrelated course.
- **Expected / actual:** expected — the new pick is accepted (it is valid), or the app explains that another pick must be fixed first. Actual (probe `staleBlocksPick`): on a stale Plan whose `SYN2003 1` was removed, clicking "Chọn lớp này" on `SYN2004 1` does nothing except show "Lớp không có trong dữ liệu đang dùng." although `SYN2004 1` exists. For an invalid group on another pick the message would be "Nhóm đã chọn không có trong lớp này." / "Lớp này có nhiều nhóm — hãy chọn nhóm trước."
- **Impact:** after every dataset update, users with existing Plans cannot add or switch classes until they discover the rebase banner, and the message points at the wrong class. Workaround: rebase (for removed sections) or re-select the group (for group changes).
- **Evidence/repro/run ID:** `probe.mjs staleBlocksPick`: `{"pickedAfterClick": false, "errorNotices": ["Lớp không có trong dữ liệu đang dùng."]}`.
- **Recommended fix:** accept a pick when the issues that concern the new pick (and the one-section-per-course rule) are clean; report issues of other picks where those picks are shown, or point the user to the stale/rebase action with a specific message. Add a model test: stale Plan + valid new pick.
- **Owner / status / due:** Frontend/Coder / open / before G3c re-run.

### `REV-M3-004` — [S2] Storage or platform failures are reported as data-integrity failures and discard a verified dataset

- **File/line/artefact:** `apps/web/src/data/loader.ts:151-161` (`options.cache.put(dataset)` is inside the same `try` as fetch/verify, so a cache write error takes the "fetch failed" path), `:119-123` (`asArtifactError` maps every unexpected exception to `INVALID_ARTIFACT`); `:63` (`crypto.subtle`) and `apps/web/src/App.tsx:55` (`crypto.randomUUID`) are secure-context-only APIs.
- **Failure scenario:** (a) IndexedDB is available but the `datasets` write fails (quota exceeded on a nearly full phone, eviction, a browser storage bug); (b) the app is opened over plain HTTP from another device, e.g. `npm run dev -- --host` used for the owner's pending Tier 1 phone check, where `crypto.subtle` and `crypto.randomUUID` are undefined.
- **Expected / actual:** expected — a hash-verified dataset is shown (with a "không lưu được để dùng ngoại tuyến" notice in case a), and an unsupported context gets an accurate message. Actual (probe `cacheWriteFailure`, `put` on `datasets` throwing `QuotaExceededError`): "Chưa xem được thời khóa biểu — Dữ liệu tải về không hợp lệ."; "Thử lại" repeats it. In case b, the digest throws a `TypeError` and the same `INVALID_ARTIFACT` text is shown (code reading; the HTTPS deploy requirement itself is G3b `SEC-M3-007`).
- **Impact:** the app is unusable on the affected device and tells the user the data is corrupt, which misleads both users and the data owner's incident triage.
- **Evidence/repro/run ID:** `probe.mjs cacheWriteFailure` output above. No loader test uses a failing cache.
- **Recommended fix:** return the fresh dataset when only the cache write fails (catch around `put`, surface a non-blocking notice); map non-`ArtifactError` exceptions to a distinct code (for example `CLIENT_UNSUPPORTED` / `STORAGE_FAILED`) with accurate wording; check `isSecureContext` at boot. Add unit tests with a throwing cache.
- **Owner / status / due:** Frontend/Coder / open / before G4a.

### `REV-M3-005` — [S2] Mandatory gate evidence is missing and the G2 target is not immutable

- **File/line/artefact:** `docs/evidence/M3-EVIDENCE-ENVELOPE.md` (absent) — linked as `EVID-M3-001` from `M3-SPEC.md:9`, `ADR-0010…md:11`, `M3-DESIGN-HANDOFF.md:9`, `M3-IMPLEMENTATION-HANDOFF.md:11`; `M3-IMPLEMENTATION-HANDOFF.md:17` (target = uncommitted working tree, no file hashes or bundle/build ID); the handoff predates the later change to `apps/web/src/app/controller.ts:12` (dev server loads unpublished data) and the new root `dev` script in `package.json`.
- **Failure scenario:** G3a/G3b/G3c and later G4a cannot bind their decisions to an identifiable artefact; the working tree keeps changing while gates run (it changed during this review).
- **Expected / actual:** expected (CLAUDE.md §6, AGENT_WORKFLOW §2/§4) — an evidence envelope with immutable commit/build IDs, exact commands/exit codes, P0 traceability and hashes. Actual: no envelope file; handoff counts (78/78, 31/31) are reproducible, but there is no immutable identity and the post-handoff changes are not recorded.
- **Impact:** per AGENT_WORKFLOW §11 missing mandatory evidence is a no-go condition independent of defect severity; G4 cannot proceed on this target.
- **Evidence/repro/run ID:** `find . -iname "*M3-EVIDENCE*"` returns nothing; G3b (`SEC-REVIEW-M3-001`) records the same gap.
- **Recommended fix:** Tech Lead creates `EVID-M3-001`, commits the M3 change set (or records per-file SHA-256 plus bundle hash), records exact commands/exit codes for `npm run check` and `npm run test:e2e`, and updates IMPL-M3-001 with the post-handoff changes.
- **Owner / status / due:** Tech Lead / open / before G3c re-run.

### `REV-M3-006` — [S3] Plan bar shows "0 tín chỉ" when credits are unknown (AC-M3-11)

- **File/line/artefact:** `apps/web/src/components/Workspace.tsx:108`.
- **Failure scenario:** a Plan contains a course without credits (`SYN4001`).
- **Expected / actual:** expected — unknown credits shown as "chưa rõ", never as 0 (AC-M3-11, DOMAIN_MODEL §3). Actual (probe `unknownCredits`): always-visible plan bar `… · 1 lớp · 0 tín chỉ`; only the Phương án tab says `0 (chưa rõ tín chỉ: SYN4001)`. Exports use `creditsLine` and are correct.
- **Impact:** misleading credit total in the main header.
- **Evidence/repro/run ID:** `probe.mjs unknownCredits`.
- **Recommended fix:** reuse the `creditsLine` wording (or append "+ N môn chưa rõ") in the plan bar; add a component assertion.
- **Owner / status / due:** Frontend/Coder / open / 2026-11-08.

### `REV-M3-007` — [S3] A picked section's card stops showing its conflict (D-M3-4)

- **File/line/artefact:** `apps/web/src/components/SectionCard.tsx:28-30` (`preview` is skipped when `pickedSameGroup`, so `conflicting` is false for picked cards).
- **Failure scenario:** the student force-picks `SYN1002 2` although it clashes with `SYN1001 2`.
- **Expected / actual:** expected (spec D-M3-4) — conflict "luôn hiện rõ ở picker, lưới và tóm tắt phương án". Actual (probe `campusAndPickedConflictBadge`): the card shows only "✓ Đã chọn" and 0 conflict lines, while the plan bar shows "⚠ 1 chỗ trùng lịch".
- **Impact:** the picker loses the textual conflict marker right after the user accepts a conflict; grid and summary still show it.
- **Evidence/repro/run ID:** `probe.mjs campusAndPickedConflictBadge` → `"pickedCardBadges": "✓ Đã chọn", "pickedCardConflictTexts": 0`.
- **Recommended fix:** for picked sections, show conflicts from the current `PlanView` (`view.conflicts` filtered by section) with the same badge and text.
- **Owner / status / due:** Frontend/Coder / open / 2026-11-08.

### `REV-M3-008` — [S3] Tests do not cover several acceptance claims marked `pass` in the handoff

- **File/line/artefact:** `apps/web/e2e/m3.spec.ts:11-15`, `:92` (viewports 360/768/**1280**; the spec requires 1200, which is exactly the two-column breakpoint `min-width: 1200px`), `:129-163` (keyboard path ends at a pick; the spec says "tìm → chọn → xuất"), `:232-240` (wipe test does not check offline); `apps/web/src/**` tests contain no campus-transition assertion (grep for `campus|cơ sở` in tests: 0 hits); `model.test.ts:74-83` (stale case covers only a removed section); `loader.test.ts` (no failing-cache case); `M3-IMPLEMENTATION-HANDOFF.md:56-70` (all rows `pass`).
- **Failure scenario:** the defects in `REV-M3-001`…`REV-M3-004` and `REV-M3-007` passed every suite; a regression in the campus warning or at the 1200 px breakpoint would too.
- **Expected / actual:** expected — each AC claim backed by an assertion that fails when the behaviour breaks. Actual: campus warning (AC-M3-03) is correct in the app (`"ⓘ Học liền tiết với SYN1003 2 nhưng khác cơ sở (Hòa Lạc ↔ ĐHKHTN), Thứ 4, tuần 1–8"`) but untested; AC-M3-05 keyboard export and the 1200 px viewport are untested.
- **Impact:** acceptance evidence overstates coverage.
- **Evidence/repro/run ID:** static review of the listed files; probe outputs above.
- **Recommended fix:** add the 1200 px viewport, extend the keyboard path through "Tải lịch (.ics)", add campus/stale-group/wipe-offline/failing-cache tests, and change the handoff mapping to reflect what is verified.
- **Owner / status / due:** Tester + Frontend/Coder / open / before G3a sign-off.

### `REV-M3-009` — [S3] ADR-0010 and project docs drift from the implementation

- **File/line/artefact:**
  - (a) `apps/web/src/app/controller.ts:12` allows unpublished data whenever `import.meta.env.DEV`; ADR-0010 §2 rule 4 names only `VITE_ALLOW_UNPUBLISHED=true` (the spec's D-M3-3 agrees with the code). Build-flag risk itself is G3b `SEC-M3-003`.
  - (b) ADR-0010 §3 says same-version records get "`validatePlan` shape checks"; `apps/web/src/storage/plan-store.ts` uses a local `isPlanShape`, and the domain `validatePlan` is not called anywhere in `apps/web`.
  - (c) `plan-store.ts:81-83` silently resolves a `0.1.0` record with contradictory `planKind`/`final` in favour of `planKind`; ADR-0009 (compatibility section) requires such records to be rejected. `0.1.0` Plans did carry both fields (`git show 22bf934:packages/domain/src/types.ts`, `Plan` type).
  - (d) `apps/web/src/App.tsx:28-29` hides the "Dữ liệu chưa được công bố" banner for synthetic sources; ADR-0010 §2 rule 4 requires a non-dismissible banner for every `candidate`/`validated` dataset.
  - (e) `apps/web/vite.config.ts:12` adds `font-src 'self'`, not listed in ADR-0010 §4.
  - (f) `docs/TECH_STACK.md:14-19` and `docs/ARCHITECTURE.md:45` still name Tailwind, Dexie, `vite-plugin-pwa`/Workbox and `html-to-image`; `docs/README.md` and `IMPLEMENTATION_PLAN.md` have no M3 checkpoint or ADR-0010 entry; DESIGN-M3-001 lists `@ky-nay/parser`, `fflate` for the dataset script, which actually imports the parser's compiled test helper `packages/parser/dist/test/synthetic-xlsx.js`.
- **Failure scenario:** later milestones (M4 storage, M5 release policy) build on the ADR text rather than the code and reintroduce or miss behaviour.
- **Expected / actual:** CLAUDE.md §4 — no silent contract drift; docs updated with the change. Actual as listed.
- **Impact:** contract ambiguity for M4/M5 and for G1 acknowledgement.
- **Evidence/repro/run ID:** static diff of the cited lines.
- **Recommended fix:** amend ADR-0010 (a, b, d, e) and decide (c) explicitly (reject to backups, or record the deviation from ADR-0009); update TECH_STACK/ARCHITECTURE (pointing to ADR-0010 deviations), `docs/README.md`, the plan checkpoint and DESIGN-M3-001.
- **Owner / status / due:** Tech Lead / open / with the G1 acknowledgement.

### `REV-M3-010` — [S3] PNG export omits the text conflict marker on one-period blocks

- **File/line/artefact:** `apps/web/src/export/png.ts:124-138`.
- **Failure scenario:** a conflicting session lasting one period (for example "Học tiết 5" notes) is exported as PNG.
- **Expected / actual:** expected — conflicts carry a text marker, not only colour (AC-M3-04, PRD §8 "color không phải tín hiệu duy nhất"). Actual: a one-period block is `ROW − 6 = 52` px high; lines are drawn at +5, +23, +41 px and skipped when `lineY + 16 > y + h`, so only code and name fit and the fifth line "⚠ TRÙNG LỊCH" is never drawn; the conflict is shown by red hatching/border only. The on-screen grid keeps a visually-hidden text description.
- **Impact:** conflict information lost for colour-blind readers of the PNG in that case; the synthetic dataset has no one-period session, so no test exercises it.
- **Evidence/repro/run ID:** code arithmetic from the cited lines.
- **Recommended fix:** draw the conflict marker first (or as a fixed corner glyph such as "⚠") regardless of block height.
- **Owner / status / due:** Frontend/Coder / open / 2026-11-08.

## Clean areas verified

- **Contract fidelity (happy path):** conflicts (`findConflicts`), group resolution (`resolvePlanPicks`/`sessionsForPick`), week1 (`resolveWeek1`/`resolvePlanWeek1`), dates (`dateFor` inside `occurrencesForWeek`) and credits (`calculatePlanCredits`) come from `@ky-nay/domain`. The conflict preview replaces the same course's current section before checking, so a section is never reported as clashing with the one it replaces. Grid/day-list markers are filtered per week (`conflictKeys(conflicts, week)`); disjoint weeks give no conflict (unit test plus probe).
- **ICS (AC-M3-09):** independent check on the synthetic timetable (`ics-check.mjs`): 29 events for `SYN3005 1` (CN, weeks 1–10) + `SYN2005 1` (weeks 1–15) + `SYN2003 1` (weeks 4, 7, 10, 14) + ONL `SYN3001 1` (0); CN of week 1 = `2027-02-21` (`week1 + 6`); `16:20–19:00` ICT → `DTSTART:20270215T092000Z`/`DTEND:20270215T120000Z`; fixed UTC+7 conversion; TEXT escaping and 75-octet folding are tested; UIDs unique and stable per dataset/session/week.
- **ONL per Q-009:** non-fixed sessions get no grid block, no conflict, no ICS event; listed separately in grid/day/Word/PNG/print; credits counted (unit and component tests).
- **Grid layout:** interval partitioning assigns the lowest free lane and per-cluster lane counts; CN column added only when a CN session is in view. Under the production CSP no violation was logged and React's CSSOM styles apply (`top` values `0%`/`25%`).
- **Service-worker update flow:** with a changed `sw.js`, the "Có phiên bản mới của ứng dụng" banner appeared, "Tải lại" reloaded into the new worker, and only the new cache remained (`ky-nay-shell-v2…` with 6 entries).
- **Term switch / onboarding:** Plans are per term; the h1 term with two cohort start dates keeps "Tạo phương án" disabled until a cohort is chosen (K71 → 12/10/2026); switching back restores the h2 Plan; reload restores the active term. Manual week 1 rejects non-Mondays (unit test).
- **Persistence:** pick followed by an immediate reload kept the Plan in 3/3 runs; envelope `{schemaVersion, storedAt, plan}`; unknown/invalid records go to `backups`; newer records are left untouched.
- **Escaping:** dataset text renders as text (XSS probe inert, G3b confirmed); Word export escapes every value.
- **Performance:** bench well under the NFR (above).

## G3a / G3b cross-reference

- G3a (QA): no M3 QA report existed at review time.
- G3b (`SEC-REVIEW-M3-001`, `security-pass-with-exception`): SEC-M3-001…007, all S3 (retracted-then-offline, encoded `..` in artifact URLs, build-time unpublished flag, size cap without `Content-Length`, regex lint guard, wipe edge cases across tabs/backup list, meta-only CSP and missing deploy headers). No overlap with `REV-M3-001`…`004`/`006`…`010`. `REV-M3-002` is a different wipe defect from SEC-M3-006 (offline availability, not residual data). `REV-M3-004` case b relies on SEC-M3-007's HTTPS requirement for production. `REV-M3-005` restates G3b's note on the missing envelope.

## Waivers and limitations

- Waiver/exception: none. `REV-M3-001` (S1) cannot be waived; `REV-M3-005` is a mandatory-evidence gap.
- Limitations: the build exercised is the prebuilt copy given to this review, not rebuilt from the current tree; the working tree is not immutable and changed during the review (root `README.md`, new G3b file). The e2e suite was not run (instruction); WebKit/Firefox/real phones, calendar-client ICS import, Word/print visual checks and a screen-reader pass were not done. Accessibility was reviewed only where it creates real risk (axe results rely on the handoff). Domain/parser packages were treated as existing contracts and not re-reviewed beyond the call sites.
- Temporary files: probes live in `…/scratchpad/review/` (`probe.mjs`, `ics-check.mjs`, `dist2/`); nothing was written to the repository except this report. The preview server on port 4192 was stopped.

## Approval and re-review

- Reviewer decision actor/date/evidence: Claude subagent (Independent Reviewer role) — not a human sign-off; 2026-10-25T00:04:37Z; decision **`review-no-go`**; evidence in this report and `…/scratchpad/review/probe.mjs`.
- Next owner/action: Frontend/Coder fixes `REV-M3-001`…`004`, `006`, `007`, `010`; Tech Lead creates `EVID-M3-001`, freezes the target (commit or per-file hashes) and resolves `REV-M3-009`; Tester extends coverage per `REV-M3-008`.
- Fix commit/target: pending.
- Retest command/evidence: `npx vitest run` (apps/web), `npm run check`, `npm run test:e2e` on the fixed target, plus the probe scenarios `staleGroupRenamed`, `staleBlocksPick`, `wipeOffline`, `cacheWriteFailure`, `unknownCredits`, `campusAndPickedConflictBadge`.
- Finding outcomes: `REV-M3-001`…`REV-M3-010` — `still-open`.
