# Test report — M3 Core UI & export, G3a chạy lại (R2)

> **Artifact ID:** `TEST-M3-002`  
> **Artifact status:** `approved` — đã được Owner (Product / Tech Lead / Release Manager) ghi nhận lúc `2026-11-06T05:50Z`  
> **Canonical gate:** `G3a`  
> **Status:** `qa-pass` tại `d51c65b` (nâng từ `qa-pass-with-follow-up` tại `2ab03cd` sau khi toàn bộ `QA-M3-101`…`105` và `#19` đã `verified-fixed`; xem phụ lục R2.1 cuối báo cáo)  
> **Owner:** Tester (agent role)  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [M3 spec](M3-SPEC.md), [M3 implementation handoff](M3-IMPLEMENTATION-HANDOFF.md), [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md), [G3a lần 1 (TEST-M3-001)](M3-G3a-QA-REPORT.md), [QA plan](../QA_TEST_PLAN.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0011](../adr/ADR-0011-timetable-format-variability.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [Implementation plan Q-011/Q-012/Q-013](../IMPLEMENTATION_PLAN.md), [Data ingestion runbook §12](../DATA_INGESTION_RUNBOOK.md)  
> **Evidence envelope:** `EVID-M3-001` ([M3-EVIDENCE-ENVELOPE.md](M3-EVIDENCE-ENVELOPE.md)); bằng chứng chạy của lần này nằm ở mục [Evidence Envelope](#evidence-envelope) cuối báo cáo  
> **Supersedes:** `TEST-M3-001` (2026-10-25, `qa-no-go`) cho phần G3a  
> **Tester sign-off actor / UTC timestamp:** Claude subagent ở vai trò Tester — **không phải sign-off của người** / 2026-11-05 (lệnh đầu tiên 2026-11-05T16:55:09Z; hoàn tất phân loại WebKit 2026-11-06T04:28Z)

Báo cáo này do một agent ở vai trò Tester viết, kiểm chứng độc lập (agent không viết code M3). Quyết định G3a ở đây là đề xuất; Owner và Release Manager cần ghi nhận, và Release Manager phải chấp thuận owner/hạn cho các S3 trước G4a.

## Scope and immutable identity

- **Source spec/PRD/ADR + versions:** SPEC-M3-001 (AC-M3-01…13), DESIGN-M3-001, ADR-0009 amendment (13)(14)(15), ADR-0010, ADR-0011 (2026-10-30, Q-013 2026-10-31), ADR-0012 (2026-11-01), IMPL-M3-001 (fix round 2026-10-29/30), EVID-M3-001 (sổ finding #1–#22 và "Điều kiện chạy lại G3"), QA_TEST_PLAN §2/§5/§8. Tất cả đọc tại commit `2ab03cd`.
- **Base/target commit/build/diff:** base `4681c63` (`main`); target **`2ab03cd7385eb5eafd64251621158e45bed181ba`** (nhánh `m3-web-app`, draft PR #1, commit 2026-11-01T00:04:53+07:00). Phần thay đổi sau lần G3 trước: `82cb85b..2ab03cd` (13 commit; 66 file mã/data, +2260/−253 không tính `docs/`).
  - Chạy trong worktree riêng, tách rời (detached) tại `2ab03cd`, sau `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci` (exit 0). Không chạy gì trong checkout dùng chung.
  - **Sai lệch cục bộ duy nhất với target:** `apps/web/playwright.config.ts` dòng 3 `PORT = 4180` → `4381`, không commit, vì máy này loại trừ dải TCP 4143–4242 (Hyper-V/WinNAT) nên `listen EACCES ::1:4180` (xem `QA-M3-103`). Probe và file cấu hình WebKit tạm thời chỉ nằm trong worktree riêng, đã xóa cùng worktree.
- **Dataset/parser/schema version:** chỉ dữ liệu tổng hợp. Dataset mẫu `synthetic-uet-2026-2027-h2.1` / `-h1.1` (`candidate`, `synthetic-fixture`); parser `uet-xlsx@0.2.0`; domain schema `0.2.0`; manifest/metadata `1.0`. Dataset của probe pipeline do chính QA tạo bằng `npm run dataset -- import` từ 5 workbook tổng hợp (mã `SYN5xxx`, tên "Mẫu"), đặt ngoài repo; bản revision dùng trong trình duyệt được dựng trong probe và phục vụ qua route. Không dùng file trường/đăng ký thật, không có PII.
- **Fixture manifest + hash:** parser fixtures 6/6 (`fixtures:run`). Dataset mẫu dựng 4 lần (2 lần liên tiếp, `TZ=UTC`, `TZ=America/Los_Angeles`): mọi artifact trùng SHA-256 (`h2.1/timetable.json` `2ea99c5e17e3…`, `h1.1/timetable.json` `486d9abb7238…`); chỉ `manifest.json` khác do `generatedAt`/`importedAt` (không thuộc hash artifact).
- **Environment/device/browser:** Windows 10 Pro 10.0.19045; Node 22.22.2; npm 12.0.2. Playwright 1.64.0 với Chromium 156.0.8078.4 (headless shell 1248) và WebKit 27.2 (2370). Không có thiết bị thật.
- **Runner/tool versions:** TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0, @axe-core/playwright 4.13.0.
- **Test run IDs/links:** chỉ chạy local, không có run ID CI cho lần này. Log và probe ở scratchpad của phiên (không bền): `check.log`, `e2e.log`, `e2e-webkit.log`, `cli1.log`, `cli2.log`, `probe-*.out`, script `qa-probes/*.mjs`, `src/qa-r2-probe.test.ts`. Kết quả chính được trích trong báo cáo.
- **Exact commands + exit codes:** xem *Commands and summary*.
- **Requirement/AC/P0 coverage — all committed P0 covered?** `no` ở mức sản phẩm (M4 FR-09/FR-10 và M5 FR-12 còn lại; thiết bị Tier 1 và import lịch thật là việc thủ công). Trong lát cắt M3: AC-M3-01…13 đều có bằng chứng tự động hoặc probe, không AC nào fail.

## Scope and risk focus

- **Features/requirements:** toàn bộ AC-M3-01…13; các finding QA/Frontend trong sổ EVID-M3-001; thay đổi sau G3 lần 1: đọc TKB thật (ADR-0011: không cột loại buổi, cột thừa thành `info`, ghi chú là thông tin — Q-012, buổi không giờ cố định không lên lưới nhưng tính tín chỉ), `kindText` ẩn loại `OTHER`, quy trình dataset ADR-0012 (`import|validate|publish|retract|status|check`), fix offline khi host chuyển hướng `/index.html` (`08401c4`), cờ dữ liệu chưa công bố theo nhánh Cloudflare (`f384f7b`).
- **Highest-risk scenarios exercised:**
  - false-negative conflict sau khi dataset đổi/đổi tên/thêm nhóm hoặc bỏ lớp (dựng lại probe 2b/2c/7 cũ), trên Chromium và WebKit;
  - số VEVENT và ngày ICS so với oracle độc lập; file xuất khi có lớp chưa giải được;
  - quy trình publish/rollback: từ chối đúng, chuyển trạng thái, rollback về bản published trước, chính sách cờ theo nhánh `main`/preview/nhánh rỗng trên bản build kiểu Cloudflare;
  - offline: host chuyển hướng, chuyển kỳ, sau khi xóa dữ liệu; banner cập nhật giả và cập nhật thật (Chromium + WebKit);
  - hai tab không có BroadcastChannel (chỉ dựa vào compare-and-put);
  - `info`/ghi chú ở giới hạn (300 ký tự liền, chuỗi HTML) ở 360 px;
  - bàn phím tới tải `.ics` ở 360 và 1200 px; axe trên các trạng thái mới.
- **Out of scope:** M4 (nhập file đăng ký), M5 (admin UI, ngân sách hiệu năng chính thức), dữ liệu UET thật, share link (P1). Quyết định bảo mật thuộc G3b; đối chiếu contract/docs thuộc G3c.

## Commands and summary

| Suite/command | Tool/run ID | Exit code | Result | Count | Evidence |
| --- | --- | ---: | --- | --- | --- |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci` | npm 12.0.2 | 0 | pass | — | `npm-ci.log` |
| `npm run check` (2026-11-05T16:55:09Z → 16:55:34Z) | lint.mjs + tsc + node:test + Vitest + run-fixtures + `dataset check` | 0 | pass | lint pass; typecheck pass; node:test **94/94**; Vitest **54/54** (7 file); fixtures **6/6**; `dataset: data/published OK — 0 datasets (0 published)` | `check.log` |
| `npm run test:e2e` (PORT 4381, sai lệch cục bộ; 16:55:58Z → 16:56:44Z) | Playwright, project duy nhất `chromium`, bản build production `dist-e2e` | 0 | pass | **17/17** (41.2 s) | `e2e.log` |
| `npx playwright test -c playwright.qa-webkit.config.ts` (thêm, không thuộc suite; cùng spec, project `webkit`) | Playwright WebKit 27.2 | 1 | xem ghi chú | **9/17 pass, 8 fail** (6.3 m) | `e2e-webkit.log`; triage ở dưới |
| `npx playwright test -c playwright.qa-webkit.config.ts -g "after the first online visit\|REV-M3-002" --repeat-each=4` | Playwright WebKit 27.2 | 1 | triage | **6/8 pass** (`AC-M3-06` 4/4, `REV-M3-002` 2/4) | `e2e-webkit-rev002.log` |
| `node scripts/bench-m3.mjs` | máy dev | 0 | pass (chỉ tham khảo) | `{"sections":1200,"indexBuildMs":17.2,"searchP95Ms":2.28,"conflictP95Ms":2.74}` | console |
| `node scripts/build-synthetic-dataset.mjs` ×4 (2 lần, `TZ=UTC`, `TZ=America/Los_Angeles`) | node | 0 | artifact tái lập được | 4/4 cùng SHA-256 artifact | console |
| Probe CLI pipeline (`npm run dataset -- status` + 19 lệnh `node scripts/dataset.mjs …`) | node | đúng như mong đợi từng lệnh | pass | 20/20 lệnh cho exit code mong đợi | `cli1.log`, `cli2.log` |
| `npm run build:site -- --outDir …` với `CF_PAGES=1` + `CF_PAGES_BRANCH=main` (kèm `VITE_ALLOW_UNPUBLISHED=true`), `=m3-web-app`; `npx vite build` với `CF_PAGES_BRANCH=` | Vite 8.3.4 | 0 / 0 / 0 | built | 3 bản build | `build-*.log` |
| Probe A — dữ liệu từ CLI trên bản build kiểu Cloudflare | Chromium | 0 | pass | **19/19** | `probe-a.out` |
| Probe B — sổ finding (2b/2c/7, #16, #17, #19, #21, viewport/axe) | Chromium | 0 | pass | **34/34** | `probe-b.out` |
| Probe B — cùng kịch bản trên WebKit (`serviceWorkers: "block"` để route phục vụ được) | WebKit | 0 | pass | **34/34** | `probe-b-webkit.out` |
| Probe C — storage/tab/SW/offline | Chromium (+ WebKit cho host/banner) | 1 | 2 fail | **17/19** (stale card 1/2, chuyển kỳ 2/2, hai tab 2/2, wipe 1/2, host 6/6, banner 4/4) | `probe-c*.out`; fail → `QA-M3-101`, `QA-M3-102` |
| Probe D — `info`/ghi chú ở giới hạn, 360 px | Chromium + WebKit | 0 | pass | **4/4** | `probe-de.out` |
| Probe E — ghi cache lỗi (quota), không có WebCrypto | Chromium | 0 | pass | **2/2** | `probe-de.out` |
| Probe F — triage WebKit "xóa dữ liệu → online → offline" (có bước đọc state giữa `reload` và `startPlan`) | WebKit | 0 | pass | **3/3** | `probe-f.out` |
| Probe G — triage WebKit lặp nguyên bước `REV-M3-002` (`reload()` rồi gọi ngay `startPlan()` có `goto("/")`) | WebKit | 1 | 3 fail | **3/6** | `probe-g.out`; xem ghi chú WebKit và `QA-M3-104` |
| `npx vitest run src/qa-r2-probe.test.ts` (rollback loader, giới hạn `info`, buổi `OTHER` không giờ) | Vitest | 0 | pass | **6/6** | console |

So với lần G3 trước: node:test 78 → 94, Vitest 39 → 54, fixtures 5 → 6, Playwright 14 → 17. QA không thêm test nào vào repo lần này; các probe là tạm thời.

**Ghi chú về lượt chạy WebKit (thêm):** Chạy nguyên bộ 17 test E2E với project `webkit` (`e2e-webkit.log`) cho kết quả **9/17 pass, 8 fail**:
1. **1 test (`AC-M3-10` print stylesheet):** fail ở `page.pdf()` vì Playwright chỉ hỗ trợ xuất PDF trên Headless Chromium (`page.pdf: PDF generation is only supported for Headless Chromium`); hai assertion ẩn `tablist` và `.app-header` ở chế độ print trước đó vẫn pass.
2. **6 test (`AC-M3-07`, `AC-M3-07/12`, `REV-M3-001/003` trong `m3.spec.ts` và 3 test dùng `serveCrafted`/`page.route` trong `qa-m3.spec.ts`):** fail vì trên Playwright WebKit, khi service worker đã đăng ký và `clients.claim()`, các request `fetch` tới `/data/*` đi qua tiến trình service worker và không đi qua `page.route` của Playwright. Khi chạy lại toàn bộ các kịch bản này trên WebKit với `serviceWorkers: "block"` (Probe B WebKit), kết quả đạt **34/34**.
3. **1 test (`REV-M3-002` — xóa dữ liệu → tải lại online → offline):** fail do timeout ở `navigator.serviceWorker.ready`. Khi chạy lặp 4 lần (`e2e-webkit-rev002.log`), `AC-M3-06` đạt **4/4** còn `REV-M3-002` đạt **2/4**; chạy bằng Probe F (có bước đọc trạng thái xen giữa `page.reload()` và `startPlan(page)`) đạt **3/3**; chạy bằng Probe G (lặp nguyên chuỗi lệnh của test, không có bước đệm) đạt **3/6** — ở 3 lần fail, worker mới kẹt ở trạng thái `installing/-/-` với `caches: []` và khi reload offline thì WebKit báo `page.reload: WebKit encountered an internal error`. Nguyên nhân: trong `m3.spec.ts:256-257`, test gọi `await page.reload()` ngay sau `unregister()` rồi gọi liền `await startPlan(page)` (hàm này mở đầu bằng `await page.goto("/")`), tạo hai lần điều hướng liên tiếp cách nhau vài mili-giây ngay lúc worker mới vừa bắt đầu `installing` trên Playwright WebKit 27.2 (Windows). Ghi nhận vào `QA-M3-102` và `QA-M3-104`.

## Ledger re-verification (EVID-M3-001)

Phân loại: `verified-fixed`, `partially-fixed`, `still-open`, `regressed`. Mục ngoài phạm vi QA ghi rõ owner gate.

| # | ID gốc | Sev gốc | Kiểm chứng lần này | Kết quả |
| --- | --- | --- | --- | --- |
| 1 | QA-M3-001 = REV-M3-001 | S1 | Dựng lại probe 2b: chọn SYN1001 1 nhóm 2 + SYN1003 1; bản mới đổi nhóm 2 → 3. **Trước rebase:** thanh phương án "⚠ 1 chỗ trùng lịch · ⚠ 1 lớp cần xử lý"; không có "✓ Không có lớp nào trùng lịch"; dòng "Chưa kiểm tra đủ trùng lịch: 1 lớp cần xử lý (SYN1001 1)"; lời nhắn theo pick "Nhóm đã chọn không còn trong dữ liệu…"; cảnh báo "File xuất sẽ thiếu buổi học"; ICS giữ 15 buổi CL của SYN1001 + 7 buổi SYN1003 (22). **Xác nhận rebase** ghi "sẽ bỏ nhóm của: SYN1001 1" và "cần chọn lại nhóm cho: SYN1001 1", không còn "Mọi lớp… vẫn còn". **Sau rebase:** xung đột và cờ còn nguyên; thẻ SYN1003 1 vẫn "⚠ Trùng lịch"; thẻ SYN1001 1 "⚠ Cần chọn lại nhóm"; chọn nhóm 3 thì hết cờ. Biến thể thêm nhóm (GROUP_REQUIRED) + bỏ lớp cùng lúc: xác nhận liệt kê cả hai, ICS giữ buổi CL. Chạy cả Chromium và WebKit | **verified-fixed** |
| 2 | QA-M3-002 = REV-M3-003 | S2 | Probe 7 dựng lại: sau rebase ở trên, chọn SYN2004 1 thành công, không có thông báo đổ lỗi | **verified-fixed** |
| 3 | QA-M3-003 = REV-M3-002 | S2 | Đường đã tài liệu hóa (xóa → tải lại online → offline) mở được trên Chromium (E2E + Probe C) và WebKit khi không điều hướng đúp (Probe F 3/3); riêng test `REV-M3-002` chạy trực tiếp trên Playwright WebKit Windows bị chập chờn (2/4 ở `e2e-webkit-rev002.log`, 3/6 ở Probe G) do test gọi `page.reload()` rồi gọi ngay `startPlan(page)` (`page.goto("/")`) làm worker mới đôi khi kẹt ở `installing` (`QA-M3-104`). **Biến thể:** xóa rồi tiếp tục dùng trong cùng trang (không điều hướng) → offline không mở được, vì worker đã gỡ và chỉ được đăng ký lại khi tải trang | **verified-fixed** cho lỗi gốc; biến thể hẹp ghi thành `QA-M3-102` (S3), flakiness của test trên WebKit ghi ở `QA-M3-104` (S3) |
| 4 | REV-M3-004 | S2 | Probe E: ghi IndexedDB `datasets` ném `QuotaExceededError` → app vẫn dùng dữ liệu đã kiểm tra, hiện "Không lưu được dữ liệu thời khóa biểu vào bộ nhớ trình duyệt…", không có "Dữ liệu tải về không hợp lệ". Không có `crypto.subtle` → "…trang không được mở qua HTTPS. Hãy mở bằng địa chỉ https://." | **verified-fixed** |
| 5 | QA-M3-004 | S2 | WebKit 2370: **0/12** lần mở đầu có banner giả (6 desktop, 6 viewport 390×844); Chromium 0/6. Cập nhật thật (đổi byte `sw.js` trên server thử): banner hiện, "Tải lại" áp dụng, sau đó không còn worker `waiting` — đạt trên Chromium và WebKit. Owner đã thử iPhone 12 (theo EVID-M3-001, QA không tự kiểm) | **verified-fixed** (Playwright WebKit; thiết bị thật là bằng chứng của owner) |
| 6 | QA-M3-005 (+SEC-M3-006b) | S2 | e2e `QA-M3-005 — two tabs…` pass. Probe C thêm: tab B bị xóa `BroadcastChannel`, chọn lớp trên bản cũ → hiện "Phương án vừa được thay đổi ở một tab khác…", tải bản mới; tab mới thấy đủ 2 lớp của tab A | **verified-fixed** |
| 7 | REV-M3-005 = QA-M3-010 | S2 (process) | G3a lần này chạy trên commit cố định `2ab03cd`, có envelope. Phần G3b/G3c chạy lại không thuộc báo cáo này | **verified-fixed** cho G3a; đóng hẳn khi G3b/G3c chạy lại trên cùng commit |
| 8 | SEC-M3-001 | S3 | G3b. Probe Vitest: thu hồi bản published mới nhất → loader nạp bản published trước và thay bản cache; nếu bản trước không tải được → `unavailable` và bản cache bị thu hồi bị xóa | ngoài phạm vi (G3b); hành vi khớp |
| 9, 11–13 | SEC-M3-002/004/005/006a | S3 | Không kiểm lại (G3b) | ngoài phạm vi |
| 10 | SEC-M3-003 | S3 | Probe A1 (trình duyệt): build `CF_PAGES=1`, `CF_PAGES_BRANCH=main` **kèm** `VITE_ALLOW_UNPUBLISHED=true` → kỳ `candidate` bị ẩn, chỉ hiện bản `published`; nhánh `m3-web-app` → hiện `candidate`; `CF_PAGES_BRANCH` rỗng → ẩn. Vẫn chưa có test tự động trong repo cho chính sách này | **partially-fixed** (hành vi đúng; thiếu test tự động; G3b quyết) |
| 14 | SEC-M3-007 | S3 | Không kiểm header trên host thật (G3b/RM) | ngoài phạm vi |
| 15 | QA-M3-006 | S3 | Probe C: tạo Plan HK II, chuyển sang HK I, tải lại online, offline tải lại → ô "Học kỳ" liệt kê cả hai kỳ; chọn HK II thấy Plan "1 lớp · 3 tín chỉ" | **verified-fixed** |
| 16 | QA-M3-007 = REV-M3-007 | S3 | Thẻ đã chọn đang trùng vẫn "⚠ Trùng lịch"; nút "Vẫn đổi nhóm (đang trùng lịch)" (Chromium + WebKit) | **verified-fixed** |
| 17 | QA-M3-008 = REV-M3-006 | S3 | Chỉ SYN4001: "1 lớp · chưa rõ tín chỉ"; thêm SYN2004: "2 lớp · 3 tín chỉ + 1 môn chưa rõ tín chỉ" | **verified-fixed** |
| 18 | QA-M3-009 | S3 | 4 lần dựng (khác lần, khác múi giờ) cùng SHA-256 mọi artifact | **verified-fixed** |
| 19 | REV-M3-008 | S3 | Hành vi đạt qua probe: campus warning trên thẻ ("Học liền tiết với SYN2002 1 nhưng khác cơ sở (Hòa Lạc ↔ ĐHKHTN), Thứ 4, tuần 1–8"); chỉ bàn phím tới khi tải `.ics` ở 360 và 1200 px, mọi phần tử focus có viền. Repo vẫn **chưa có** test UI cho campus warning (chỉ có test domain `conflict.test.ts`) và e2e bàn phím vẫn dừng ở bước chọn lớp | **partially-fixed** (không đổi so với 30/10) |
| 20 | REV-M3-009 | S3 | G3c | ngoài phạm vi |
| 21 | REV-M3-010 | S3 | Bản revision có hai buổi 1 tiết trùng nhau (T7 tiết 2); chặn `fillText` khi xuất PNG tuần 5: có "⚠ TRÙNG LỊCH · SYN2004" và "⚠ TRÙNG LỊCH · SYN4001"; file là PNG hợp lệ (Chromium + WebKit) | **verified-fixed** |
| 22 | HOST-M3-001 | S2 | Server thử kiểu Cloudflare (`/index.html` → 308 `/`): precache có `/`, không có `/index.html`; offline tải lại mở được Plan và "Đang ngoại tuyến"; điều hướng offline tới `/?q=1` cũng ra app — Chromium và WebKit | **verified-fixed** (mô phỏng local; host thật do owner kiểm 31/10) |

Không có mục nào `regressed`. Không có mục QA/Frontend nào `still-open`.

## Requirement/AC matrix

Chú thích: **E2E** = `e2e/m3.spec.ts`/`e2e/qa-m3.spec.ts` (Chromium, 17/17); **UT** = Vitest/node:test hiện có; **P-x** = probe của lần này.

| Requirement/AC/P0 | Test case | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| AC-M3-01 onboarding (FR-01, C-08) | E2E core flow (khóa); UT `App.test.tsx` onboarding + `qa-m3.test.tsx` tuần 1 tự nhập; P-A2 (`--start "K69,K70=2027-02-15"` qua CLI) | Khóa → ngày cấu hình; ngày tự nhập phải là Thứ Hai; còn sau tải lại | "15/02/2027 (theo khóa K69)" từ dữ liệu CLI; CLI từ chối `--start` không phải Thứ Hai (2027-02-16); Plan còn sau tải lại (E2E) | **pass** | đường tự nhập vẫn chỉ có ở UT, chưa có E2E |
| AC-M3-02 search/picker (FR-02/03) | E2E `giai tich`, bắt chọn nhóm; P-A2 | Thẻ có Mã LHP, nhóm, thứ, tiết + giờ, tuần, phòng, GV, lớp khóa, nhãn ONL/không lịch | Đạt; dữ liệu bố cục HK I: mã có `#` (SYN5005#) giữ nguyên, cột thừa hiện "Hình thức thi: Viết", buổi `OTHER` không in "Khác" | **pass** | E2E, P-A2 |
| AC-M3-03 conflict (PRD AC-01, FR-04) | E2E `QA-M3 — PRD AC-01…`, `REV-M3-001/003…`; P-B 2b (Chromium + WebKit); P-B campus | "Trùng lịch" bằng chữ + mã/thứ/tiết/tuần; tuần rời → không trùng; liền tiết khác cơ sở → cảnh báo | Đạt cả với Plan mới lẫn sau revision đổi/thêm nhóm (xem ledger #1); campus warning đúng tuần giao 1–8 | **pass** | P-B 34/34 ×2 |
| AC-M3-04 lưới/ngày, ONL ngoài lưới | E2E tuần 9; P-A2; P-D | Đúng thứ × tiết theo tuần; ký hiệu trùng bằng chữ; buổi không giờ không chiếm ô | SYN5003 (`OTHER` không giờ) và SYN5004 (online) không lên lưới, liệt kê riêng; danh sách ngày không tràn với ghi chú/`info` 200–300 ký tự | **pass** | P-A2, P-D |
| AC-M3-05 responsive/a11y/bàn phím | E2E 360/768/1200/1280 + axe + bàn phím tới chọn lớp; P-B bàn phím tới tải `.ics` (360, 1200); P-B overflow + axe ở trạng thái stale/chưa giải/cảnh báo xuất (360/768/1200); P-D | Không cuộn ngang trang; axe không serious/critical; tìm → chọn → xuất bằng bàn phím; focus thấy được | Overflow 0 px và 0 vi phạm serious/critical ở mọi trạng thái đã thử, Chromium và WebKit; tải `.ics` bằng phím Enter ở cả 360 và 1200 px | **pass** | chưa chạy trình đọc màn hình; e2e repo chưa phủ bước xuất (#19) |
| AC-M3-06 lưu/offline/xóa | E2E offline, xóa, REV-M3-002; P-C chuyển kỳ, host chuyển hướng, xóa; P-F | Plan còn sau tải lại; offline sau lần online đầu; xóa sạch Plan/cache | Đạt; offline mở được mọi kỳ đã lưu; host chuyển hướng OK. Xóa rồi tiếp tục trong cùng trang thì offline hỏng tới lần tải trang online kế tiếp | **pass with follow-up** | `QA-M3-102` (S3) |
| AC-M3-07 integrity/status | E2E artifact bị sửa; UT `loader.test.ts`; P-A1 (cờ theo nhánh); P-E; Vitest probe (rollback, giới hạn `info`, `OTHER` không giờ, `LT` không giờ bị từ chối) | Sai hash/schema/domain bị từ chối, giữ cache; `retracted` không nạp; chưa `published` chỉ ở preview | Đạt; bản production (`main`) không nạp `candidate` kể cả khi biến môi trường bật cờ; `info` > 30 mục / > 300 ký tự / nhãn > 100 / nhãn rỗng bị từ chối | **pass** | P-A1 6/6, Vitest 6/6 |
| AC-M3-08 provenance | E2E provenance | Version, nguồn, mã văn bản, parser, thời điểm, status, hash ngắn, tuyên bố độc lập | Đạt (E2E); P-A1: dữ liệu `published` không có banner "chưa được công bố" | **pass** | E2E |
| AC-M3-09 ICS (AC-06/AC-07) | E2E (33 event, DTSTART chính xác); UT oracle `qa-m3.test.tsx`; P-A2 oracle; P-B số event | Một VEVENT/tuần học; ngày = week1+(w−1)·7+(d−2); UTC từ UTC+7; không có buổi không giờ/ONL | P-A2: SYN5005# T3 tiết 1–2 tuần 1 = `20270216T000000Z–20270216T014500Z` (07:00–08:45 +07); 45 event, 0 cho buổi không giờ/online. P-B: 44 event với Plan mới, 30 sau khi nhóm biến mất (chỉ bỏ buổi của nhóm, giữ CL) kèm cảnh báo | **pass** | import vào ứng dụng lịch: owner báo đã làm trên iPhone (31/10), QA không kiểm |
| AC-M3-10 PNG/Word/In | E2E PNG/Word/PDF A4 ngang (Chromium); P-B #21; P-B Word | Lưới + metadata; chuỗi được escape; in A4 ngang | Đạt; Word có dòng "Thiếu buổi học của 1 lớp chưa xác định nhóm…"; PNG khối 1 tiết có chữ cảnh báo | **pass** (tự động) | chưa xem PNG/Word/bản in bằng mắt; in không kiểm được trên WebKit (Playwright `page.pdf` chỉ có ở Chromium) |
| AC-M3-11 tín chỉ (C-02) | UT; P-B #17; P-A2; Vitest probe | Mỗi môn một lần; thiếu tín chỉ = "chưa rõ", không phải 0 | "chưa rõ tín chỉ", "3 tín chỉ + 1 môn chưa rõ tín chỉ"; buổi không giờ và online vẫn tính tín chỉ (4 lớp · 10 tín chỉ) | **pass** | — |
| AC-M3-12 stale Plan | E2E `AC-M3-07/12…`, `REV-M3-001/003…`; P-B (đổi nhóm, thêm nhóm + bỏ lớp); P-C stale card | Banner; "Cập nhật" liệt kê lớp không còn trước khi xác nhận | Đạt; xác nhận liệt kê lớp bị bỏ, nhóm bị xóa, lớp cần chọn lại nhóm. Thẻ lớp đang mở khi rebase giữ nhóm cũ trong state | **pass with follow-up** | `QA-M3-101` (S3) |
| AC-M3-13 privacy/XSS/CSP | E2E `AC-M3-08/13…`, `QA-M3 — hostile…`, `QA-M3 — the build's CSP…`; P-D | Chỉ request same-origin; chuỗi dataset là chữ; CSP chặn inline | Đạt; nhãn/giá trị `info` chứa `<img onerror>`/`<b>` hiện dưới dạng chữ, không có node chèn (Chromium + WebKit) | **pass** | G3b quyết định bảo mật |
| NFR search/conflict | `bench-m3.mjs` | search < 100 ms, conflict < 50 ms (~1.000 lớp) | 2.28 / 2.74 ms (1.200 lớp) | **pass** (tham khảo) | máy dev |

Truy vết P0 lát cắt M3: FR-01 pass (AC-M3-01/07/08), FR-02 pass, FR-03 pass, FR-04 pass, FR-06 pass, FR-07 pass, FR-08 pass, FR-11 pass (import lịch thật và xem bằng mắt là thủ công).

### Thay đổi sau G3 lần 1 (`82cb85b..2ab03cd`)

| Thay đổi | Kiểm chứng | Kết quả |
| --- | --- | --- |
| ADR-0011 đọc TKB thật: không cột loại buổi, sheet "Các lớp hủy", `Ca 1 - 2`, `Tiết 1-2`, mã có `#`, dòng không giờ | CLI import W1 (bố cục 10 cột kiểu HK I + 1 cột thừa): 5 lớp, 7 buổi, 1 dòng hủy bị bỏ, `SYN5002` `Ca 1 - 2` → T2 tiết 1–6, `SYN5005#` `Tiết 1-2` → T3 tiết 1–2, `SYN5003` → `OTHER` không giờ, `SYN5004` "Học Online" → `ONL`, `online: true` | pass |
| Cột thừa thành `info` (ADR-0011 §8) | "Hình thức thi" → `info` trên buổi, hiện trên thẻ; giới hạn được loader kiểm lại (Vitest probe); 300 ký tự liền không làm tràn 360 px (P-D) | pass; xem `QA-M3-105` về khả năng thấy cột lạ khi review |
| Ghi chú là thông tin (Q-012) | e2e/thẻ hiện "Ghi chú: …"; ghi chú 200 ký tự ở danh sách ngày, không tràn | pass |
| Buổi không giờ không lên lưới nhưng tính tín chỉ (ADR-0009 (15)) | P-A2, Vitest probe (`OTHER` không giờ: không xung đột, tính tín chỉ; `LT` không giờ bị từ chối) | pass |
| `kindText` (ẩn `OTHER`) | P-A2: thẻ, lưới, danh sách không giờ, ICS, Word không có chữ "Khác" | pass |
| ADR-0012 CLI | Xem bảng dưới | pass; `QA-M3-105` |
| `08401c4` offline khi host chuyển hướng | Ledger #22 | pass |
| `f384f7b` cờ theo nhánh Cloudflare | Ledger #10, P-A1 | pass |

Probe CLI (chỉ worktree riêng, dữ liệu bị bỏ khi xóa worktree):

| Lệnh (tóm tắt) | Mong đợi | Thực tế | Exit |
| --- | --- | --- | ---: |
| `import w4-error.xlsx` (tiết 13–14) | từ chối, không ghi gì | "2 blocking parser errors; nothing was written"; `git status data/` sạch | 1 |
| `import w3-newformat.xlsx` (thêm "Đợt thi") | từ chối bộ cột chưa duyệt | "new column set (…examRound…): review it…" | 2 |
| `import w1.xlsx --start "K69,K70=2027-02-16"` | từ chối ngày không phải Thứ Hai | "is not a Monday" | 1 |
| `import w1.xlsx --start "K69,K70=2027-02-15"` | `candidate`, báo cáo, audit | `uet-2026-2027-h2-20261105-d0ae9bbc`; báo cáo đủ mục; 1 dòng audit | 0 |
| `import <README.md trong repo>` | từ chối file trong repo | "is inside the repository" | 1 |
| `import w1.xlsx` lần 2 | từ chối file trùng | "already imported as …" | 1 |
| `import w5-weekcol.xlsx` (cột lạ "Tuần áp dụng" = "1-8") | — (probe đối kháng) | nhận, báo cáo ghi "format reviewed"; buổi học tuần 1–15; cột chỉ thành `info` | 0 → `QA-M3-105` |
| `import w2.xlsx` (đổi phòng CL, nhóm 2 → 3, bỏ một lớp) | diff với bản trước | "+0 −1 ~1": bỏ `SYN5005# 1`, đổi `SYN5001 1` (phòng và nhóm) | 0 |
| `publish V1` khi còn `candidate` | từ chối | "only a validated dataset can be published" | 1 |
| `validate V1 --reviewer "QA-Importer"` (khác hoa/thường người nạp) | từ chối | "the reviewer imported this dataset…" | 1 |
| `validate V1 --reviewer qa-reviewer` → lặp lại | lần 1 OK, lần 2 từ chối | `validated`; "only a candidate can be validated" | 0 / 1 |
| `publish V1` | `published`, `publishedAt` | đạt | 0 |
| `validate V2 --accept-single-reviewer "…"` → `publish V2` | ngoại lệ ghi vào audit + báo cáo | đạt, dòng "single-reviewer exception" | 0 / 0 |
| `retract V2` thiếu `--reason` → có `--reason` → lặp lại | từ chối / OK + báo bản fallback / từ chối | "retract needs --reason"; "falls back to …d0ae9bbc"; "already retracted" | 1 / 0 / 1 |
| `validate nonexistent` | từ chối | "no dataset nonexistent" | 1 |
| `status`, `check` | liệt kê; toàn vẹn OK | 3 dataset (1 published, 1 candidate, 1 retracted); "OK — 3 datasets (1 published)" | 0 / 0 |

## Quality checks

| Area | Expected/control | Actual/evidence | Result |
| --- | --- | --- | --- |
| Privacy/network/log/Sentry | không PII, không file đăng ký | M3 không nhận PII. E2E `AC-M3-08/13…` chỉ request GET same-origin (bắt ở cấp context). Báo cáo/audit của CLI chỉ có tên actor do người chạy chọn và dữ kiện TKB công khai. Probe chỉ dùng dữ liệu `SYN…` | pass |
| Security/auth/RBAC/share/file | kiểm soát được thực thi | Hash/size/schema/domain/`info` fail closed; production (`main`) từ chối dữ liệu chưa công bố; CLI từ chối file trong repo, file trùng, người duyệt = người nạp. Quy tắc hai người chỉ là quy trình (ADR-0012 §4) | pass (G3b quyết định) |
| Accessibility/keyboard/contrast | không có lỗi chặn | axe WCAG 2.1 A/AA: 0 serious/critical ở 6 trạng thái mới (3 viewport × 2), cả WebKit. Bàn phím tới tải `.ics` ở 360/1200 px, mọi phần tử focus có viền | pass (chưa chạy trình đọc màn hình) |
| Responsive/mobile/desktop | dùng được ở viewport hỗ trợ | Overflow 0 px ở 360/768/1200 (+1280 trong E2E), kể cả `info` 300 ký tự liền | pass |
| Offline/cache/update | dự phòng an toàn | Offline sau lần đầu, chuyển kỳ, host chuyển hướng, cập nhật thật/giả đều đạt. Xóa rồi dùng tiếp trong cùng trang: offline hỏng tới lần tải online sau (`QA-M3-102`) | pass with follow-up (S3) |
| Export/calendar | ngày/nội dung đúng | ICS khớp oracle; số event đúng khi có lớp chưa giải; Word/PNG có cảnh báo | pass |
| Performance budgets | ngưỡng trong spec | bench tham khảo đạt; ngân sách chính thức là M5 | pass (tham khảo) |

## Findings

Không có S0/S1/S2 mới. Năm finding S3:

| Finding ID | Severity | Repro/evidence | Impact | Recommendation | Owner/status/expiry |
| --- | --- | --- | --- | --- | --- |
| `QA-M3-101` | S3 | Desktop ≥ 1200 px. Chọn SYN1001 1 nhóm 2; bản dữ liệu mới đổi nhóm 2 → 3; tải lại; mở thẻ SYN1001 1 ở cột Tìm môn; bấm "Cập nhật phương án" → "Xác nhận cập nhật" (thẻ vẫn mở). Thẻ: không radio nào được chọn nhưng nút chính "Đổi nhóm" vẫn bật; bấm → thông báo lỗi "Nhóm đã chọn không có trong lớp này." (probe C `stalecard`, 1/2). Gốc: `apps/web/src/components/SectionCard.tsx:30` khởi tạo `useState(() => normalizeGroup(picked?.group))` một lần, không đồng bộ khi rebase xóa nhóm của pick | Người dùng thấy nút mời đổi sang nhóm không còn tồn tại và một lỗi khó hiểu; không sai lịch, không mất dữ liệu; cách tránh: chọn radio nhóm mới hoặc đóng/mở lại môn | Đặt lại state nhóm khi nhóm của pick đổi (hoặc khi nhóm không còn trong `groupOptions`); tắt nút khi nhóm đang chọn không có trong lớp; thêm e2e đúng kịch bản này | Frontend/Coder · open · hạn đề xuất 2026-11-30 (trước G3 của M4) |
| `QA-M3-102` | S3 | 360 px, Chromium. Mở app online tới khi worker điều khiển trang; "Xóa dữ liệu trên máy" → "Xác nhận xóa"; **không tải lại**, tạo phương án và chọn SYN2004 1 ngay trong trang đó (lúc này `getRegistrations().length = 0`); offline → tải lại: `net::ERR_INTERNET_DISCONNECTED` (probe C `wipe`, 1/2). Đường "xóa → tải lại online → offline" thì đạt. Gốc: `apps/web/src/storage/local-data.ts:181-191` gỡ worker; `registerServiceWorker()` chỉ chạy lúc khởi động trang | Sau khi xóa, người dùng tiếp tục dùng app rồi mất mạng (đóng tab, mở lại offline) sẽ không mở được app, không có cảnh báo. AC-M3-06 chỉ hứa offline "sau lần tải online đầu tiên", nên đây là khoảng hở hẹp | Đăng ký lại worker trong `resetAfterWipe` (sau khi xóa xong), hoặc báo "tải lại trang khi có mạng để dùng được khi offline"; thêm e2e không có bước tải lại | Frontend/Coder · open · hạn đề xuất 2026-11-30 |
| `QA-M3-103` | S3 (test infra) | `apps/web/playwright.config.ts:3` `const PORT = 4180` và `--strictPort`; trên máy này Windows loại trừ TCP 4143–4242 (`netsh interface ipv4 show excludedportrange protocol=tcp`) → `listen EACCES ::1:4180`, `npm run test:e2e` không chạy được trước khi có test nào. QA phải sửa cục bộ thành 4381 (không commit) | Lệnh gate `npm run test:e2e` không chạy được trên một máy Windows phổ biến (Hyper-V/WSL/Docker), dễ bị bỏ qua hoặc ghi nhầm là đã chạy | Đọc cổng từ biến môi trường (ví dụ `E2E_PORT`, mặc định ngoài các dải hay bị loại trừ) và ghi trong README/QA plan | Tester + Frontend · open · trước lần chạy G3 kế tiếp |
| `QA-M3-104` | S3 (coverage) | Config chỉ có project `chromium`; Tier 1 gồm Safari iOS (QA plan §Q-007). Chạy cùng spec với project `webkit` (cấu hình tạm của QA): **9/17 pass, 8 fail** (`e2e-webkit.log`). Trong 8 test fail: 1 test (`AC-M3-10`) do `page.pdf` chỉ có ở Chromium; 6 test do trên WebKit, request dưới quyền service worker đi vòng qua `page.route` nên các test dựng dataset bằng route không áp dụng được (chạy lại cùng kịch bản với `serviceWorkers: "block"` ở Probe B WebKit đạt **34/34**); 1 test (`REV-M3-002`) đạt 2/4 khi chạy lặp E2E và 3/6 ở Probe G (nhưng đạt 3/3 ở Probe F) vì test gọi `page.reload()` rồi gọi ngay `startPlan(page)` (`page.goto("/")`) ngay sau `unregister()`, làm tiến trình service worker của Playwright WebKit Windows đôi khi kẹt ở `installing` (`caches: []`) | Hồi quy riêng của WebKit (Safari) chỉ được phát hiện bằng probe thủ công của QA, không có trong CI; test `REV-M3-002` có bước điều hướng đúp gây flaky trên WebKit | Thêm project `webkit` cho các test không cần `page.pdf`; test dùng route chạy với `serviceWorkers: "block"` hoặc phục vụ dataset bằng server thử thay vì route; bỏ lệnh `page.reload()` thừa trước `startPlan(page)` trong test `REV-M3-002` (và kết hợp với sửa `QA-M3-102` đăng ký lại worker sau khi xóa) | Tester + Frontend · open · trước G4a |
| `QA-M3-105` | S3 (data pipeline) | Workbook W5 = bố cục HK I đã biết + cột lạ "Tuần áp dụng" có giá trị "1-8". `npm run dataset -- import` nhận (exit 0); báo cáo ghi "columns: courseCode, … — format **reviewed**"; cảnh báo chỉ là `UNKNOWN_COLUMN \| 3 \| 3, 3, 3` (không có tên cột); các buổi học lấy tuần 1–15, còn "Tuần áp dụng: 1-8" chỉ thành `info` hiển thị cạnh buổi. Gốc: `packages/parser/src/uet-xlsx-adapter.ts:227-230` (`formatFingerprint` chỉ tính cột chuẩn), `scripts/dataset.mjs:193` (chỉ in cột chuẩn), issue `UNKNOWN_COLUMN` không có `rawValue`. Ngoài ra `--accept-new-format` cho phép chính người nạp vượt `hold` (ADR-0011 §2 ghi bộ cột mới phải chờ Data Reviewer) | Dấu vân tay định dạng — biện pháp ADR-0011 dựng ra để chặn một cột mới mang thông tin tuần bị publish mà không ai thấy — không chặn trường hợp cột mới không phải cột chuẩn. Nếu người duyệt bỏ sót, sinh viên thấy lịch tuần 1–15 trong khi thông tin bên cạnh ghi tuần khác (nguy cơ sai tuần/sai trùng lịch). Còn lớp kiểm soát: người duyệt, preview, diff | Liệt kê tên mọi cột thành `info` trong báo cáo và trong cảnh báo `UNKNOWN_COLUMN`; đưa nhãn cột lạ vào dấu vân tay (hoặc ít nhất báo "bộ cột thông tin mới") để cần chấp nhận rõ ràng; ghi lại vai trò của `--accept-new-format` trong ADR-0011/runbook | Data Parser + Tech Lead (Data Reviewer xác nhận) · open · hạn đề xuất trước lần import TKB thật HK II đầu tiên (cửa sổ 09–15/11/2026, Q-011) |

Quan sát không xếp severity (để G3b/G3c xem):

- `apps/web/vite.config.ts:11` coi nhánh production là chuỗi cố định `"main"`. Nếu nhánh production trên Cloudflare đổi tên, bản production sẽ được bật cờ dữ liệu chưa công bố. Thuộc SEC-M3-003 (G3b).
- Cảnh báo ngưỡng tín chỉ dùng `knownTotal` (`plan-view.ts:44-48`); khi có môn chưa rõ tín chỉ, "Ít hơn mức tối thiểu" có thể không đúng. Dữ liệu mẫu không có `creditPolicy`, nên chưa kiểm trên UI.

## Limitations and skipped tests

| Test | Why skipped | Owner | Due/expiry | Re-entry trigger |
| --- | --- | --- | --- | --- |
| Thiết bị thật Tier 1 (Safari iOS 2 phiên bản, Chrome Android), Tier 2 (Samsung Internet, Firefox), trình duyệt trong Zalo/Messenger | QA không có thiết bị; Playwright WebKit trên Windows chỉ là xấp xỉ. Owner báo đã thử iPhone 12 + Safari ngày 31/10 (QA không kiểm) | Owner | trước G4a | mọi thay đổi UI/SW |
| Trình đọc màn hình (VoiceOver/TalkBack) | không có công cụ; chỉ axe + bàn phím | Owner/Tester | trước G4a | thay đổi a11y |
| Import `.ics` vào ứng dụng lịch; xem PNG/Word/bản in bằng mắt | không có ứng dụng lịch; QA chỉ kiểm cấu trúc, oracle ngày, chữ trên canvas | Owner | trước G4a | thay đổi export |
| In/PDF trên WebKit | Playwright `page.pdf` chỉ hỗ trợ Chromium | Owner (thủ công) | trước G4a | thay đổi print CSS |
| TKB thật / file đăng ký thật | cấm dùng dữ liệu thật trong QA; `npm run test:real` không chạy | Data Parser/Data Reviewer | khi có TKB HK II | file nguồn mới |
| Host thật Cloudflare Pages (header, chuyển hướng, cờ theo nhánh) | chỉ mô phỏng bằng server thử local và biến `CF_PAGES*` | Release Manager | G4a | thay đổi host/build |
| CI trên GitHub tại `2ab03cd` | QA không chạy/không đọc run CI cho commit này; EVID-M3-001 chỉ ghi run CI tới `145b376` | Tech Lead | trước G4a | thay đổi workflow |
| Drill G4b (import → preview → validate → publish → retract → publish lại, có thời gian) | ngoài G3a; QA chỉ chạy CLI cục bộ, không push/deploy | Release Manager | G4b | thay đổi pipeline |
| SEC-M3-002/004/005/006a/007 | phạm vi G3b | Security Reviewer | theo G3b | — |
| Ngân sách hiệu năng chính thức (bundle, render trên máy yếu) | phạm vi M5 | Release Manager | M5 | — |

## Gate decision

- **Decision: `qa-pass-with-follow-up`** (đề xuất của agent Tester, chờ người ghi nhận).
  - Không còn S0/S1: QA-M3-001 (S1) đã sửa, kiểm chứng độc lập trên Chromium và WebKit theo repro gốc 2b/2c/7.
  - Mọi S2 trong phạm vi QA/Frontend (#2–#6, #22) đã sửa và kiểm chứng; #7 đóng phần G3a.
  - Năm S3 mới (`QA-M3-101`…`105`) có owner, khuyến nghị và hạn đề xuất ở bảng Findings. Theo CLAUDE.md §5, chúng chỉ được đi tiếp khi Release Manager chấp thuận owner/mitigation/expiry. Đến lúc đó, quyết định này vẫn chỉ là đề xuất.
  - #19 (REV-M3-008) còn `partially-fixed` về test tự động. Hành vi đã đạt qua probe.
- **Tester actor/date/evidence:** Claude subagent (vai trò Tester), không phải sign-off của người; 2026-11-05 (UTC); bằng chứng: bảng lệnh và probe ở trên, log trong scratchpad của phiên (không bền).
- **Release recommendation:** `follow-up-open`. G3a không chặn G4a. G4a vẫn cần G3b và G3c chạy lại trên `2ab03cd`, Release Manager chấp thuận các S3, và kiểm tra thủ công trên thiết bị.
- **Conditions/next owner:**
  1. Release Manager: chấp thuận hoặc đổi owner/hạn của `QA-M3-101`…`105`. `QA-M3-105` cần xử lý hoặc có biện pháp giảm thiểu rõ (người duyệt đọc cột thô của file) **trước lần import TKB thật đầu tiên**.
  2. Frontend/Coder: `QA-M3-101`, `QA-M3-102`; Tester + Frontend: `QA-M3-103`, `QA-M3-104`, và e2e cho campus warning + bàn phím tới bước xuất (#19).
  3. Security Reviewer (G3b) và Independent Reviewer (G3c) chạy lại trên cùng commit `2ab03cd`.
  4. Re-entry: mọi thay đổi code/build/UI mở lại G2/G3a/G3c (AGENT_WORKFLOW §6). Mọi thay đổi quy tắc parser (kể cả sửa `QA-M3-105`) mở lại G1/G2/G3a/G4b.

## Evidence Envelope

- **Artifact ID:** `TEST-M3-002` (gate `G3a`), gắn với `EVID-M3-001`.
- **Source and traceability:** SPEC-M3-001 AC-M3-01…13; PRD FR-01–FR-08, FR-11, AC-01, AC-06, AC-07; ADR-0009 (13)(14)(15), ADR-0010, ADR-0011, ADR-0012; Q-011/Q-012/Q-013. P0 completeness (sản phẩm): `no` (M4/M5); lát cắt M3: mọi AC có bằng chứng.
- **Immutable execution identity:**
  - commit `2ab03cd7385eb5eafd64251621158e45bed181ba` (base `4681c63`), worktree tách rời riêng của QA;
  - sai lệch cục bộ: `apps/web/playwright.config.ts` `PORT` 4180 → 4381, chưa commit (`QA-M3-103`);
  - không có run ID CI;
  - toolchain: Windows 10 Pro 19045, Node 22.22.2, npm 12.0.2, TS 5.9.3, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0 (Chromium 156.0.8078.4, WebKit 27.2), axe 4.13.0.
- **Exact commands + exit codes:** `npm ci` 0; `npm run check` 0; `npm run test:e2e` 0 (17/17); WebKit thêm exit 1 (9/17 pass, 8 fail; chạy lặp `AC-M3-06` + `REV-M3-002` exit 1, 6/8 pass); `node scripts/bench-m3.mjs` 0; 4 lần `build-synthetic-dataset.mjs` 0; 20 lệnh CLI, mỗi lệnh đúng exit code mong đợi (bảng ở trên); probe A 19/19, B 34/34 ×2, C 17/19, D 4/4, E 2/2, F 3/3, G 3/6, Vitest probe 6/6.
- **Data and artefact integrity:**
  - dataset mẫu tái lập được (SHA-256 artifact giống nhau qua 4 lần dựng);
  - artifact do CLI tạo khớp kích thước/hash (`dataset check` OK);
  - mọi dữ liệu là tổng hợp (`SYN…`); workbook probe đặt ngoài repo; `data/` của worktree QA bị bỏ cùng worktree;
  - không có thay đổi schema.
- **Risk and controls:**
  - findings: `QA-M3-101`…`105` (S3, open);
  - không có waiver/exception nào do Tester cấp; chấp thuận S3 thuộc Release Manager;
  - rollback: không áp dụng (QA không đổi code).
- **Decision and next step:** `qa-pass-with-follow-up` tại `2ab03cd`; nâng lên **`qa-pass`** tại `d51c65b` (xem phụ lục R2.1 bên dưới). Bước tiếp theo: Owner ghi nhận báo cáo này.
- **Notes:** QA chỉ ghi duy nhất file này vào checkout dùng chung, không commit, không push.

---

## Phụ lục R2.1 — Tái kiểm chứng hậu sửa lỗi tại `d51c65bc10f91ed7cd23462bdef901f5a81d5acc` (2026-11-06T05:33Z)

- **Target bất biến:** `d51c65bc10f91ed7cd23462bdef901f5a81d5acc` (`db0058c..d51c65b` trên nhánh `m3-web-app`).
- **Lệnh kiểm tra đã chạy:**
  - `npm run check` → exit `0` (`lint` pass, `typecheck` pass, `node:test` **101/101**, Vitest **60/60** trên 7 file, `fixtures:run` **6/6**, `dataset check` OK).
  - `npm run test:e2e` → exit `0` (Playwright Chromium **17/17** trên cổng mặc định `4380`, 41,7s).
  - `E2E_WEBKIT=1 npx --prefix apps/web playwright test -c apps/web/playwright.config.ts --project=webkit -g "REV-M3-002" --repeat-each=3` → exit `0` (**3/3** pass, 22,4s).
- **Trạng thái các finding sau tái kiểm chứng độc lập:**
  - `QA-M3-101` (S3): **`verified-fixed`** — `SectionCard.tsx:30-37,86` đồng bộ `group` theo `pickedGroup` và chỉ nhận `selectedGroup` khi thuộc `groupOptions(section)`; thêm test trong `App.test.tsx:112-140`.
  - `QA-M3-102` (S3): **`verified-fixed`** — `ensureServiceWorkerAfterWipe()` (`sw-client.ts:56-74`) + `REPOPULATE_PRECACHE` (`vite.config.ts:118-120`) được gọi từ `persistPlan` (`controller.ts:118`); kiểm chứng qua E2E `REV-M3-002` trên cả Chromium và WebKit.
  - `QA-M3-103` (S3): **`verified-fixed`** — `playwright.config.ts:3` dùng `Number(process.env.E2E_PORT ?? 4380)`.
  - `QA-M3-104` (S3): **`verified-fixed`** — `m3.spec.ts:258-266` bỏ `await page.reload()` thừa trước khi tạo phương án sau wipe và `playwright.config.ts:30` thêm project `webkit` tùy chọn (`E2E_WEBKIT=1`).
  - `QA-M3-105 = REV-M3-102 = SEC-M3-102` (S2/S3): **`verified-fixed`** — `infoColumns` đưa vào `formatFingerprint`, bảng `Extra (info) columns` trong báo cáo import, bắt buộc Data Reviewer truyền `--accept-new-format` khi `validate`.
  - `#19` (`REV-M3-008`, S3): **`verified-fixed`** — đã bổ sung unit/component test cho cảnh báo chuyển cơ sở trong ngày (`model.test.ts:42-53`, `App.test.tsx:142-162`) và mở rộng E2E bàn phím tới bước tải `.ics` (`m3.spec.ts:161-170`).
- **Quyết định G3a cập nhật tại `d51c65b`:** **`qa-pass`** (đề xuất của agent Tester; 0 S0/S1/S2/S3 mở trong phạm vi QA/Frontend).
