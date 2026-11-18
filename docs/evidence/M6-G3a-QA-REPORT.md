# Test report — M6 "Lịch có màu" (làm mới frontend), kiểm định QA độc lập G3a

> **Artifact ID:** `TEST-M6-001`  
> **Artifact status:** `approved`  
> **Canonical gate:** `G3a`  
> **Owner:** Tester  
> **Last reviewed:** 2026-11-18  
> **Related docs:** [SPEC-M6-001](M6-SPEC.md), [DESIGN-M6-001](M6-DESIGN-HANDOFF.md), [ADR-0015](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md), [QA plan](../QA_TEST_PLAN.md), [PRD §8](../PRD.md), [TEST-M5-001](M5-G3a-QA-REPORT.md) (mẫu định dạng), [Agent workflow](../../.claude/AGENT_WORKFLOW.md)  
> **Evidence envelope:** `EVID-M6-001` (G2, `docs/evidence/M6-EVIDENCE-ENVELOPE.md` — đang được viết song song, không có trong commit đích)  
> **Tester sign-off actor / UTC timestamp:** Tester (agent, vai `.claude/agents/tester.md`), `2026-11-17` — khuyến nghị `qa-pass-with-follow-up`; sau sửa và tái kiểm định ([REVERIFY-M6-001](M6-G3-FOLLOWUP-REVERIFICATION.md)) `qa-pass`. **G3a Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6"): `qa-pass`.**

## 1. Scope and immutable identity

| Trường | Giá trị |
| --- | --- |
| Source spec / design + version | `SPEC-M6-001` (`g0-approved`, Owner `2026-11-12T14:53Z`), AC-M6-01…20, D-M6-1…12; `DESIGN-M6-001` (`g1-approved`, Owner `2026-11-12T15:28Z`) §2–§15 kèm ghi chú triển khai F2–F7 ở §13; ADR-0015 `accepted` |
| Commit đích (đóng băng G2/G3) | `51da5174d29adb201bc8a9f99e08903d38d776f0` (`51da517`, tip `origin/m6-frontend`, "Merge pull request #22 … fix/m6-visual-determinism"), checkout detached; `git rev-parse HEAD` khớp |
| Base so sánh | `origin/main` = `990784c7fa711343a67df1f999ad626211ceec50` (bản M5) |
| Build identity | `ky-nay-build=0.0.0+51da517` (`verify-production-bundle` in ra) |
| Dataset / schema | e2e dùng dataset synthetic `synthetic-uet-2026-2027-h2.1` (+ `synthetic-uet-2026-2027-h1.1`) từ `scripts/build-synthetic-dataset.mjs`; `data/published` = 0 dataset; `SCHEMA_VERSION = "0.2.0"` (`packages/domain/src/types.ts:6`) — M6 không đổi schema/parser |
| Fixture | `fixtures/*` 6/6 (`npm run fixtures:run`); `fixtures/redacted-registration/portal-format.doc` (dùng trong `apps/web/src/export/poster.test.ts:210`) |
| Môi trường | Windows 10 Pro 10.0.19045, Node `v22.22.2`, npm `12.0.2`, TypeScript `5.9.3`, Vitest `5.0.3` (jsdom), Playwright `@playwright/test 1.64.0` (Chromium), axe-core `4.13.0`, Vite `8.3.4`, React `19.3.0` |
| CI tham chiếu | GitHub Actions run `44054059870` (push, headSha `51da517`, `check` ✓ / `e2e` ✓ 54 passed 4 skipped / `visual` ✓ 10 passed 6 skipped) |
| Coverage P0 committed | **yes** — mọi AC-M6-01…20 có test hoặc bằng chứng tự động; phần thủ công còn lại (máy thật, trình đọc màn hình, kiểm poster bằng mắt) đã được SPEC §8 dời sang trước G4a của bản M6 |

Ghi chú môi trường: các phiên review khác (G3c) chạy song song trên cùng máy, nên CPU bị tranh chấp; điều này ảnh hưởng tới F-M6-QA-02.

## 2. Scope and risk focus

- **Tính năng:** M6-A…J — token/theme sáng-tối, font tự host, thành phần UI, khung app (BottomNav/AppBar/chip trạng thái), Lịch tuần/ngày có màu, Thêm lớp (bộ lọc trùng, sheet lớp, ô mờ desktop, Ctrl/⌘ K), màn Bắt đầu ít chữ, gợi ý một lần, trạng thái rỗng, Phương án + 4 ô xuất, poster PNG, chuyển động, ngân sách.
- **Rủi ro cao nhất được ưu tiên:** (1) hồi quy privacy của luồng nhập ĐKMH (AC-M6-14, cửa sổ 0 request của `e2e/m4.spec.ts` có thể bị font/chunk lazy phá); (2) chỉ báo trùng lịch chỉ bằng màu (false-negative thị giác); (3) theme tối làm hỏng tương phản; (4) offline mất phương án/theme/màu; (5) bàn phím và focus trên khung mobile có thanh cố định; (6) ngân sách JS gần trần.
- **Ngoài phạm vi:** parser/domain/ICS-Word format (không đổi), WebKit/Firefox (chỉ Chromium được chạy), thiết bị thật, so ảnh `visual` trên máy cục bộ (project `visual` từ chối chạy ngoài Linux — `apps/web/playwright.config.ts`), G3b/G3c.

## 3. Commands and summary

Mọi lệnh chạy tại `C:\Users\ADMIN\Desktop\XepTKB\.claude\worktrees\agent-a8f0742ec7eb17711` trên `51da517` (thời gian UTC).

| Suite/command | Run | Exit code | Result | Count | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| `npm run check` | lần 1, kết thúc `09:22:01Z` | `0` | pass | — | log bị một phiên song song ghi đè (trùng tên file tạm trong scratchpad dùng chung) nên **không dùng làm bằng chứng đếm**; chỉ ghi exit code |
| `npm run check` | lần 2, `09:22:15Z–09:23:23Z` | `1` | fail (flaky) | lint ✓, typecheck ✓, node:test 153/153, **Vitest 187/188** | `apps/web/src/m5-ui.test.tsx:216` "only carries public identifiers…" `Test timed out in 5000ms` (Vitest 41.16 s, CPU tranh chấp) → F-M6-QA-02 |
| `npm run check` | lần 3, `09:23:41Z–09:24:45Z` | `0` | pass | lint ✓; typecheck ✓; node:test **153/153**; Vitest **23 file / 188/188** (31.45 s); fixtures **6/6**; `dataset: data/published OK — 0 datasets (0 published)` | cùng commit, không đổi gì → test ở lần 2 phân loại **flaky (timing)** |
| `npm run verify:bundle` | `09:25:58Z–09:26:06Z` | `0` | pass | `verify-production-bundle: OK (3 JS asset(s), allowUnpublished:!1, _headers + sw.js present, ky-nay-build=0.0.0+51da517, 4 PNG icons, CSP unchanged, 4 precached woff2 + licenses.txt, no gallery, no third-party origins)`; `check-bundle-budget: OK` | số đo ở §6 |
| `E2E_PORT=4381 npm run test:e2e` | `09:26:16Z–09:28:49Z` | `0` | pass | **54 passed, 4 skipped, 0 failed** (2.5 m): `gallery.spec.ts` 6 ✓ + 4 skip (ảnh chụp chỉ chạy ở project `visual`), `m3.spec.ts` 13 ✓, `m4.spec.ts` 2 ✓, `m5.spec.ts` 6 ✓, `m6.spec.ts` 23 ✓, `qa-m3.spec.ts` 4 ✓ | không có lỗi nên không cần chạy lại |
| Spec thăm dò tạm `apps/web/e2e/zz-g3a-explore.spec.ts` (`npx playwright test … --project=chromium`, `E2E_PORT=4381`) | lần 1 | `1` | 10 ✓ / 3 ✘ | 13 | 3 ✘ đều do lỗi của chính script thăm dò (locator `aria-label` thay vì tên từ nội dung, tên nút nav có huy hiệu số "Phương án1", `selectOption` trên view không có ô chọn tuần) — không phải lỗi sản phẩm |
| idem, chạy lại X2/X3 sau khi sửa script | lần 2–4 | `0` | pass | X3 ✓; X2 light ✓, X2 dark ✓ | |
| Probe tạm `apps/web/e2e/zz-g3a-probe.spec.ts` (focus bị che bởi thanh dưới) | 1 | `0` | 2 ✓ (test ghi nhận, không assert) | 2 | lộ F-M6-QA-01 |
| `gh run view` (CI, chỉ đọc) | — | — | — | — | lịch sử CI cho AC-M6-19/20 (§4, §7) |

Hai spec tạm đã bị **xóa** khỏi worktree sau khi chạy (`git status --short` sạch, chỉ còn thư mục build bị ignore); bản sao nằm ngoài repo trong scratchpad của phiên.

## 4. Requirement/AC matrix (AC-M6-01…20)

Ký hiệu: **PASS** = test tự động kiểm đúng câu chữ AC và xanh; **PASS\*** = xanh nhưng test chỉ kiểm một phần câu chữ, phần còn lại được thăm dò ở §5 hoặc là kiểm thủ công đã được SPEC dời; **FAIL** = có sai lệch.

| AC | Test/bằng chứng tại `51da517` | Kiểm đúng câu chữ AC? | Kết quả |
| --- | --- | --- | --- |
| AC-M6-01 theme + tương phản | `e2e/m6.spec.ts:65` (Tối thắng OS sáng, lưu, qua reload và offline; Hệ thống theo OS); `src/m6-ui.test.tsx:59` (picker, lưu, áp lại); `src/styles/contrast.test.ts:72` (cặp token sáng/tối, 2 khối tối giống hệt), `:96` (10 màu môn ≥ 4.5 cả hai theme), `:115` (hex chỉ trong file cho phép) | Có. "mọi cặp chữ/nền" được kiểm trên các cặp token khai báo trong DESIGN §2.1/§3 + axe `color-contrast` trên màn thật. Chữ đè trên nền sọc trùng lịch (`background-image`) axe không đo được (axe xếp vào *incomplete*) | PASS |
| AC-M6-02 font | `e2e/m6.spec.ts:96` (4 face 400/800 × latin/vietnamese loaded, URL cùng origin, 4 woff2 trong precache); `scripts/test/fonts.test.mjs`; budget `fonts 67424 B … (budget 90000 B)`; `networkGuard` trong `e2e/fixture.ts` (0 request khác origin cho mọi test) | Có | PASS |
| AC-M6-03 lưới ≤ 200 px, nav 3 mục ≥ 44 px | `e2e/m6.spec.ts:153`, `:181` | Có (đo `boundingBox`, `aria-current`) | PASS |
| AC-M6-04 chip thay banner, nguồn ≤ 2 chạm | `e2e/m6.spec.ts:191`; `src/model/dataset-status.test.ts:12`; offline chip "Ngoại tuyến" trong `e2e/m3.spec.ts:293`, `e2e/m5.spec.ts:147` | Có | PASS |
| AC-M6-05 T2–T7 ở 360, mã + phòng, màu, trùng không chỉ bằng màu | `e2e/m6.spec.ts:254` (không cuộn ngang trang/lưới, 6 ngày ≤ 360 px, mã + phòng, nền khác trong suốt, viền 3 px, nhãn "Trùng", tên truy cập "đang trùng lịch với"); `e2e/m3.spec.ts:156` (CN cũng không cuộn ngang); `src/model/grid-view.test.ts:39` | Phần lớn. **Sọc** chỉ có trong CSS (`src/styles/screens/calendar.css:97`), không assert ở e2e lưới chính; ảnh mốc `week-*` của `e2e/visual.spec.ts` chụp tuần 3 — tuần không có ô trùng trên lưới chính. Biểu tượng ⚠ không assert riêng | PASS\* (F-M6-QA-03) |
| AC-M6-06 đổi tuần, hôm nay, vạch giờ | `e2e/m6.spec.ts:285` (nút, vuốt bằng pointer event tổng hợp, chuột không đổi tuần, phím ←/→/T, "Tuần này", đồng hồ cố định); `src/model/grid-view.test.ts:65`, `:86` | Có; vuốt thật trên cảm ứng thuộc kiểm máy thật | PASS |
| AC-M6-07 sheet chi tiết, màu lưu qua reload | `e2e/m6.spec.ts:327`; `src/model/palette.test.ts`; `src/storage/local-data.test.ts:13`; nhãn đổi từ ĐKMH trong sheet: `e2e/m4.spec.ts` (bước "M6 F3: the session sheet … shows the badge and the from → to detail") | Gần đủ: giảng viên và dòng tuần (`formatWeeks`) không được assert ở e2e | PASS\* |
| AC-M6-08 lịch ngày cùng màu, ONL | `e2e/m6.spec.ts:363` | Có | PASS |
| AC-M6-09 tìm không dấu, lọc trùng, mini-lịch, "Vẫn thêm lớp này" | `e2e/m6.spec.ts:380`; `src/qa-m3.test.tsx:130` | Có | PASS |
| AC-M6-10 desktop 2 cột, Ctrl/⌘ K, ô mờ | `e2e/m6.spec.ts:433`, `:456`; `src/qa-m3.test.tsx:165` | Có | PASS |
| AC-M6-11 một màn, chip từ `Term.starts`, ≤ 25 chữ, 2 chạm | `e2e/m6.spec.ts:491`, `:522`; `src/f5-ui.test.tsx:18`; `e2e/word-count.ts` | Có, theo **phương pháp đã duyệt ở G1** (DESIGN §9): chỉ duyệt `main`, bỏ phần ẩn/`aria-hidden`/kích thước 0, mỗi token có chữ/số là 1 chữ. Thăm dò X6 đo **20 chữ** ở cả 360 và 1280 (`Học kỳ II 2026–2027 (dữ liệu mẫu) Bạn khóa mấy? K67 K68 K69 K70 K71 Tự chọn ngày Bắt đầu`), 34 nếu tính câu độc lập; nếu đếm cả `body` (AppBar + skip link) là 35. Câu độc lập có đúng 1 lần, nguyên văn | PASS (ghi chú phương pháp ở §5) |
| AC-M6-12 câu độc lập, gợi ý 1 lần, rỗng 1 nút | `e2e/m6.spec.ts:218`, `:537`, `:593`; `src/f5-ui.test.tsx:59`; câu độc lập trong file xuất: `e2e/m3.spec.ts:242`, `src/export/poster.test.ts:124` | Phần lớn. Trạng thái rỗng "Tắt lọc" (`src/components/AddClassView.tsx:125`) **không có test** — dataset synthetic không tạo được trường hợp mọi lớp của một môn đều trùng; kiểu `EmptyState` (`src/components/ui/EmptyState.tsx`) chỉ nhận đúng một `action` | PASS\* (F-M6-QA-03) |
| AC-M6-13 Phương án + 4 ô xuất | `e2e/m6.spec.ts:603` (thanh màu cộng đúng tổng, chip trùng → focus đúng ô, chip nhóm, 4 ô, tên file .ics/.png/poster/.doc, `print()`); nội dung file: `e2e/m3.spec.ts:242`; `src/export/poster.test.ts:254` | Có | PASS |
| AC-M6-14 m4.spec không nới lỏng | `e2e/m4.spec.ts` 2/2 ✓; diff với `origin/main` ở §7 | Có — mọi dòng chứa `postImportRequests`/`PII_TOKENS`/`idbDump`/`console` giống hệt từng byte | PASS |
| AC-M6-15 poster | `src/export/poster.test.ts:120` (7 case: 1080×1350, Be Vietnam Pro 400/800, phiên bản dataset + `INDEPENDENCE_NOTE`, màu môn + sọc + viền đỏ + chữ "Trùng", chú thích ≤ 8 môn, không lộ PII từ `fixtures/redacted-registration/portal-format.doc` và file cổng synthetic, chờ font); `e2e/m6.spec.ts:603` (PNG thật 1080×1350); X2/X3 tải poster bằng bàn phím và khi offline | Phần tự động: có. **"kiểm bằng mắt"** chưa làm (thủ công, SPEC §8, trước G4a của bản M6) | PASS\* |
| AC-M6-16 axe 30 ô, bàn phím, focus, reduced motion, tên truy cập | axe: `e2e/m3.spec.ts:156` (sáng, 360/768/1200/1280: Bắt đầu, Thêm lớp + sheet lớp, Lịch, Phương án), `e2e/m6.spec.ts:128` (tối 360/1280: Thêm lớp + sheet lớp), `:688` (tối 360/1280: Phương án, sheet (i), nguồn dữ liệu, nhập ĐKMH), `e2e/gallery.spec.ts`; bàn phím: `e2e/m3.spec.ts:196` (1280 px; bước nav dùng `planNav.focus()` chứ không Tab); reduced motion: `e2e/m6.spec.ts:728`, `src/app/motion.test.ts:18`, luật chung `src/styles/base.css:129`; tên truy cập: `src/model/grid-view.test.ts:39` | **Không đủ ở repo**: thiếu tối cho Bắt đầu và Lịch tuần, thiếu mọi ô tối ở 768; chưa có đường bàn phím ở khổ điện thoại. Thăm dò X1 phủ đủ 30 ô (+ tuần 9 có trùng): 0 serious/critical, 0 tràn ngang; X2 đi trọn luồng bằng bàn phím ở 360×780 cả hai theme, mọi điểm dừng có vòng focus. **Nhưng** "focus luôn thấy rõ" **bị vi phạm**: nút/summary nhận focus có thể nằm trọn dưới thanh điều hướng cố định (F-M6-QA-01) | **FAIL một phần** (F-M6-QA-01 S2, F-M6-QA-03) |
| AC-M6-17 ngân sách | `npm run verify:bundle` (§6) + `scripts/test/check-bundle-budget.test.mjs` | Có | PASS |
| AC-M6-18 0 request bên thứ ba, CSP, không localStorage, offline giữ phương án/theme/màu | `networkGuard` (`e2e/fixture.ts`, mọi test); `verify-production-bundle` "CSP unchanged … no third-party origins"; lint cấm `localStorage`/`sessionStorage`/`document.cookie` (`scripts/lint.mjs:44`); offline: phương án `e2e/m3.spec.ts:293`, theme `e2e/m6.spec.ts:65` | Repo không có test offline cho **màu môn** (AC-M6-07 reload online). Thăm dò X3: offline reload giữ phương án + `data-theme="dark"` + màu môn đã chọn, chip "Ngoại tuyến" hiện, poster tải được offline, `localStorage.length === 0`, `document.cookie === ""` | PASS\* (F-M6-QA-03) |
| AC-M6-19 30 ảnh mốc + CI so | `e2e/visual.spec.ts:63` (5 màn × 360/768/1280 × sáng/tối), 30 file trong `apps/web/e2e/__screenshots__/visual.spec.ts/`; CI run `44054059870` job `visual` ✓ (6 test màn hình ✓ = 30 ảnh) | Có (không chạy được cục bộ trên Windows — đúng thiết kế) | PASS |
| AC-M6-20 PR phase vào `m6-frontend`, qua check/verify/e2e | PR run của F5 `43919603191`, F6 `44011802987`, F7 `44018113974`, #22 `44053370672` đều `success`; nhưng run **push sau merge** của #19 (`43920262293`, e2e ✘ AC-M6-10), #20 (`44012170828`, e2e ✘ AC-M6-07 + AC-M6-10), #21 (`44018607474`, visual ✘) **fail**; các test chập chờn đã được sửa ở `8701a1a` (AC-M6-10), `66a7c5e` (AC-M6-07), `d1c8b84` (ảnh plan-1280-dark); run push của tip `44054059870` xanh cả 3 job; `main` vẫn là M5 (`990784c`) | Đạt ở tip; lịch sử có 3 lần nhánh tích hợp đỏ sau merge (đã khắc phục bằng sửa test, không đổi code sản phẩm) | PASS (quan sát OBS-M6-QA-01) |

## 5. Thăm dò / adversarial (spec tạm, đã xóa)

| ID | Kịch bản | Kết quả |
| --- | --- | --- |
| X1 (×6) | 5 màn (Bắt đầu, Lịch tuần 3, Lịch tuần 9 có trùng, Thêm lớp, sheet lớp SYN1003 trùng, Phương án) × 360/768/1280 × sáng/tối: axe (`wcag2a/2aa/21a/21aa`) serious/critical + tràn ngang; chạy thêm tag `wcag22aa` để tham khảo | 6/6 ✓: 0 vi phạm, 0 px tràn; `wcag22aa` (tham khảo): 0 |
| X2 (×2) | Chỉ bàn phím ở 360×780 (sáng, tối): Tab vào chip khóa → mũi tên chọn → "Bắt đầu" → nav "Thêm lớp" → gõ "SYN2002" → dòng môn → sheet → "Thêm vào lịch" → nav "Lịch" → ô SYN2002 → sheet chi tiết → Esc (focus trở về ô) → →/T đổi tuần → nav "Phương án" → ô "Ảnh" → "Poster chia sẻ (.png)" (tải về, 1080×1350) → nút (i) → đổi theme; kiểm vòng focus (`outline`/`box-shadow`) ở mọi điểm dừng | 2/2 ✓ sau khi sửa locator của script; 77/76 điểm dừng, **0 điểm thiếu vòng focus**; ghi nhận summary "Tuần 1: 15/02/2027 (theo khóa K69)" nằm trong dải thanh điều hướng → điều tra thêm ở P1 |
| P1 (×2) | 3 lớp (SYN2002, SYN2004, SYN1001 nhóm 1), Tab qua Phương án và Lịch ở 360×780 và 360×640; mỗi điểm dừng đo `getBoundingClientRect` so với thanh dưới và `elementFromPoint` | **Phương án 360×780:** nút "Bỏ lớp SYN2004 1" nhận focus ở y 730–774, thanh điều hướng bắt đầu ở 711 → bị che **hoàn toàn**. **360×640:** "Bỏ lớp SYN2002 1" y 596–640, thanh ở 571 → che hoàn toàn. Lịch: không bị che. Không có `scroll-padding`/`scroll-margin` nào trong `apps/web/src/styles/` → F-M6-QA-01 |
| X3 | AC-M6-18: chọn màu "Cam" (`orange`, `apps/web/src/model/palette.ts:36`) cho SYN2002 + theme Tối → chờ SW → offline → reload | ✓ phương án, `data-theme="dark"`, màu môn giữ nguyên, chip "Ngoại tuyến", poster tải offline, `localStorage` 0 key, cookie rỗng |
| X4 | `prefers-reduced-motion: reduce`: đổi view, đổi tuần, mở/đóng sheet | ✓ `document.getAnimations()` = 0 ở cả 4 thời điểm; dialog `transition-duration 0s`, `animation none` |
| X5 | Thiết bị cảm ứng (`hasTouch`, `isMobile`, 360×780): gợi ý | ✓ "Vuốt sang trái hoặc phải để đổi tuần." hiện trước, "Đã hiểu" → gợi ý kế tiếp "Chạm vào một lớp…", luôn tối đa 1; tắt cả hai rồi reload → 0 gợi ý |
| X6 | Màn Bắt đầu 1280 tối + 360: câu độc lập, tràn ngang, đếm chữ, số chạm tới lớp đầu tiên | ✓ câu độc lập 1 lần, không tràn; 20 chữ (360 và 1280); chip → "Bắt đầu" → "Thêm lớp" → dòng môn → "Thêm vào lịch" = **5 chạm** (không tính gõ), đạt mục tiêu SPEC §2 |
| X7 | "Xóa dữ liệu trên máy" sau khi đặt theme Tối + màu Xám | ✓ về màn Bắt đầu, `data-theme` bị gỡ, store `settings` chỉ còn `{"activeTerm":"2026-2027-h2"}` (không còn `theme`/`courseColors`/`seenHints`) |

Ghi chú phương pháp AC-M6-11: `countVisibleWords` chỉ đếm trong `main` đúng như DESIGN §9 đã ký; AppBar trên màn Bắt đầu (chip học kỳ, chip "Dữ liệu mẫu", "+1") cộng thêm khoảng 9 chữ ngoài `main`. Không phải lỗi so với spec đã duyệt, chỉ ghi để Owner biết con số "20" không gồm AppBar.

## 6. Quality checks

| Area | Expected/control | Actual/evidence | Result |
| --- | --- | --- | --- |
| Privacy/network/log | 0 request khác origin/không-GET/WebSocket; m4 privacy giữ nguyên; settings mới không chứa PII | `networkGuard` xanh ở 54 test e2e + 13 thăm dò; §7 diff m4; poster không lộ PII (`src/export/poster.test.ts:210`); X3 `localStorage`/cookie rỗng; X7 wipe xóa 3 trường settings mới | pass |
| Security/CSP | CSP không đổi, không origin lạ, không script/style inline | `verify-production-bundle: OK (… CSP unchanged … no third-party origins)`; lint luật mới (stylesheet/FontFace/`url()` có scheme) xanh trong `npm run check` | pass (G3b quyết định riêng) |
| Accessibility/keyboard/contrast | axe 0 serious/critical 30 ô; dùng được hoàn toàn bằng bàn phím; focus luôn thấy rõ; reduced motion | axe 30/30 ô sạch (X1); bàn phím trọn luồng ở 360 (X2) và 1280 (`e2e/m3.spec.ts:196`); reduced motion X4 + `e2e/m6.spec.ts:728`; **focus bị thanh dưới che hoàn toàn ở Phương án (P1)** | **fail một phần** (F-M6-QA-01) |
| Responsive/mobile/desktop | không cuộn ngang 360/768/1200/1280; lưới ≤ 200 px; desktop 2 cột | `e2e/m3.spec.ts:156`, `e2e/m6.spec.ts:153`, `:456`; X1 0 px tràn ở 30 ô | pass |
| Offline/cache/update | phương án, theme, màu, poster offline | `e2e/m3.spec.ts:293`, `e2e/m6.spec.ts:65`, `e2e/m5.spec.ts:147`, X3 | pass |
| Export/calendar | 4 ô, tên + nội dung file như trước, poster 1080×1350 | `e2e/m6.spec.ts:603`, `e2e/m3.spec.ts:242`, `src/export/png.test.ts`, `src/export/poster.test.ts` | pass (kiểm poster bằng mắt: chưa làm) |
| Performance budgets | JS ban đầu ≤ 119 808 B gzip; CSS ≤ 12 288 B; font ≤ 90 000 B; chunk ĐKMH lazy; 1 file CSS | `initial JS 386191 B raw / 117991 B gzip (budget 119808 B)`; `initial CSS 33299 B raw / 7123 B gzip (budget 12288 B)`; `lazy JS 121377 B raw / 44436 B gzip (per chunk budget 43008 B)` — chunk lớn nhất `RegistrationImport-` 37.3 KiB, `exporters-` 6.1 KiB; `total JS 507568 B raw / 162427 B gzip (budget 162816 B)` → **còn 389 B**; `fonts 67424 B raw woff2 in 4 file(s)`; `lazy RegistrationImport-* chunk required: yes; single CSS file required: yes` | pass (biên rất mỏng, xem OBS-M6-QA-02) |

## 7. Regression M3/M4/M5

- **`apps/web/e2e/m4.spec.ts`** không giống từng byte với `origin/main` (`git diff --numstat`: +24/−10). So sánh tập dòng chứa `expect` (45 dòng ở `main`, 47 ở đích): chỉ khác ở (a) thêm `toHaveAttribute("aria-current", "page")` trong helper mới `openView`, (b) thêm `toBeHidden()` cho sheet lớp SYN2004, (c) thay `heading "Phương án nháp"` bằng `navigation "Điều hướng chính"` sau khi bắt đầu, (d) nhãn thông điệp của 2 `expect` overflow/axe đổi từ `${tab}` sang `${view}`. **Mọi dòng chứa `postImportRequests`, `PII_TOKENS`, `idbDump`, `console` (11 dòng) giống hệt từng byte.** Thay đổi duy nhất làm giảm phạm vi: vòng lặp axe/overflow của AC-M4-08 trên phương án chính thức trước duyệt 3 tab (Tuần, Theo ngày, Phương án), nay duyệt 2 view (Lịch, Phương án) — view "Theo ngày" không còn là tab (DayView mở từ DayStrip) nên không còn được axe trong m4.spec, và không spec nào khác chạy axe trên DayView → ghi vào F-M6-QA-03.
- **`m3.spec.ts`, `m5.spec.ts`, `qa-m3.spec.ts`** (`git diff origin/main..HEAD`): các `expect` bị xóa đều có thay thế tương đương: heading "Bắt đầu xếp thời khóa biểu" → nút "Bắt đầu"; "Đang ngoại tuyến" (banner) → nút chip "Ngoại tuyến" và câu đầy đủ trong sheet nguồn (`source.getByText("Đang ngoại tuyến")`); `✓ Đã chọn` trong thẻ → tên truy cập dòng môn `· ✓ đã chọn lớp …`; câu độc lập nay assert trong dialog (i); `expect(scroller.scroll).toBeGreaterThan(scroller.client)` → `toBeLessThanOrEqual` (đổi chủ ý theo AC-M6-05); focus heading của panel nhập → focus nằm trong `dialog[open]` (`m5.spec.ts`). Hai assertion bàn phím cũ về tab "Theo ngày" (`aria-selected`, `toBeFocused`) được thay bằng `aria-current` của nav, nhưng bước nav dùng `planNav.focus()` thay vì Tab — giảm nhẹ độ phủ bàn phím, đã bù bằng X2. Không thấy assertion hành vi (trùng lịch, ICS/PNG/Word, offline, 2 tab, artifact bị sửa, rebase, CSP, chuỗi độc hại) bị bỏ.

## 8. Findings

| Finding ID | Severity | Repro/evidence | Impact | Owner/status/expiry |
| --- | --- | --- | --- | --- |
| `F-M6-QA-01` | **S2** (accessibility major — QA plan §8) | Viewport 360×780, thêm SYN2002 1, SYN2004 1, SYN1001 1 (nhóm 1) → nav "Phương án" → nhấn Tab liên tục: nút "Bỏ lớp SYN2004 1" nhận focus ở y 730–774 trong khi `nav[aria-label="Điều hướng chính"]` bắt đầu ở y 711 → nút và vòng focus nằm **hoàn toàn** dưới thanh cố định; 360×640 tương tự với "Bỏ lớp SYN2002 1" (596–640 vs 571). X2 cũng thấy summary "Tuần 1: …" trong dải thanh. `grep scroll-padding\|scroll-margin` trong `apps/web/src/styles/` = 0 kết quả | Vi phạm câu chữ AC-M6-16 "focus luôn thấy rõ" và WCAG 2.2 SC 2.4.11 (AA). Người dùng bàn phím (bàn phím rời trên tablet/điện thoại, hoặc cửa sổ desktop hẹp < 1200 px) không thấy mình đang ở nút nào — có thể bấm nhầm "Bỏ lớp". Có workaround (cuộn tay), không mất dữ liệu (bỏ lớp còn toast) | Frontend; `open`. Đề xuất: `scroll-padding-bottom` trên `html` bằng chiều cao thanh dưới + khe (< 1200 px) và thêm e2e kiểm focus không bị che. Cần sửa hoặc Release Manager chấp nhận rủi ro **trước khi merge M6 vào `main`** |
| `F-M6-QA-02` | S3 | `npm run check` lần 2: `src/m5-ui.test.tsx:216` (luồng userEvent dài: bắt đầu → thêm lớp → nhập ĐKMH → báo lỗi) `Test timed out in 5000ms`; lần 3 cùng commit xanh 188/188. Cùng loại với `OBS-M5-002` (M4 Vitest, đã sửa ở PR #13/#14 bằng timeout riêng) | CI/G2 có thể đỏ giả khi runner chậm; không ảnh hưởng người dùng | Frontend/Tester; `open`; đặt timeout riêng (vd. 15 s) cho test tích hợp dài; trước G5 của M6 |
| `F-M6-QA-03` | S3 (coverage) | Bộ test trong repo chưa phủ: axe tối cho Bắt đầu và Lịch tuần, mọi ô tối ở 768 (AC-M6-16); đường đi chỉ bằng bàn phím ở khổ điện thoại; focus bị che (đã lọt lưới → F-M6-QA-01); màu môn sau reload **offline** (AC-M6-18); trạng thái rỗng "Tắt lọc" (AC-M6-12, dataset synthetic không tạo được); sọc/biểu tượng trùng trên lưới chính (AC-M6-05; ảnh mốc tuần 3 không có ô trùng); axe trên DayView sau khi m4.spec bỏ tab "Theo ngày" | Hồi quy sau này ở những điểm này sẽ không bị CI bắt. Thăm dò X1–X7 cho thấy hành vi hiện tại đúng (trừ F-M6-QA-01) | Tester + Frontend; `open`; thêm các case X1/X2/X3/P1 vào `e2e/m6.spec.ts`, fixture QA (route như `qa-m3.spec.ts`) cho "Tắt lọc"; trước G5 của M6 |
| `F-M6-QA-04` | S3 (docs) | `docs/QA_TEST_PLAN.md` chưa có mục M6 (ảnh so sánh, axe tối) dù DESIGN-M6-001 §16 liệt kê là follow-up ở G2; `docs/README.md` "Trạng thái hiện tại" vẫn ghi F7 "đang ở PR" trong khi #21, #22 đã merge vào `m6-frontend` | Traceability QA/README lệch thực tế | Tech Lead (G2, `EVID-M6-001`); `open`; cập nhật cùng gói tài liệu G2 |
| `OBS-M6-QA-01` | quan sát | Lịch sử AC-M6-20 (§4): 3 run push sau merge trên `m6-frontend` fail do test chập chờn (AC-M6-10 gõ vào ô tìm cũ khi đổi khổ; AC-M6-07 reload trước khi IndexedDB ghi xong; ảnh plan-1280-dark), đã sửa ở `8701a1a`, `66a7c5e`, `d1c8b84`; tip xanh | Không chặn; cho thấy nên chạy e2e ≥ 2 lần trước khi merge M6 vào `main` | Release Manager; thông tin |
| `OBS-M6-QA-02` | quan sát | Tổng JS gzip 162 427 B / ngân sách 162 816 B (còn 389 B); JS ban đầu còn 1 817 B | Mọi sửa đổi sau M6 (kể cả fix F-M6-QA-01 nếu thêm JS) có thể làm vỡ ngân sách | Tech Lead; thông tin (DESIGN §13 F7 đã ghi) |

Không có S0/S1.

## 9. Limitations and skipped tests

| Test | Why skipped | Owner | Due/expiry | Re-entry trigger |
| --- | --- | --- | --- | --- |
| So ảnh `toHaveScreenshot` (AC-M6-19) cục bộ | project `visual` từ chối chạy ngoài Linux; dựa vào CI run `44054059870` | Platform | — | đổi mốc ảnh hoặc CSS |
| 4 test ảnh của `gallery.spec.ts` trong project `chromium` | `test.skip` theo thiết kế (chỉ ở `visual`) | — | — | — |
| WebKit/Firefox | không chạy (`E2E_WEBKIT` không bật) | Tester | trước G4a bản M6 | Owner yêu cầu |
| Safari iOS, Chrome Android, Zalo/Messenger, TalkBack/VoiceOver, vuốt thật, kiểm poster bằng mắt (AC-M6-15) | cần thiết bị thật (SPEC §8) | Owner | trước G4a của bản dùng M6 | — |
| Chữ đè trên nền sọc trùng lịch | axe không đo tương phản trên `background-image` | Frontend | kiểm bằng mắt cùng poster | — |
| `npm run check` lần 1 | log bị phiên song song ghi đè; chỉ dùng exit code | — | — | — |

## 10. Gate decision

- **Decision:** `qa-pass-with-follow-up` (khuyến nghị của Tester); sau sửa và tái kiểm định: `qa-pass` — Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6").
- **Lý do:** toàn bộ suite tự động xanh trên `51da517` (`npm run check` lần 3: node:test 153/153, Vitest 188/188, fixtures 6/6; `verify:bundle` exit 0; e2e 54 passed / 4 skipped / 0 failed; CI tip xanh cả `check`/`e2e`/`visual`); 20/20 AC có bằng chứng; privacy M4 giữ nguyên từng byte; không có S0/S1. Có một lỗi **S2** (F-M6-QA-01: focus bị thanh điều hướng dưới che hoàn toàn, trái AC-M6-16) và ba S3 — theo CLAUDE.md §5 chỉ được pass khi có risk acceptance, owner, mitigation, due.
- **Release recommendation:** `follow-up-open` — đề nghị sửa F-M6-QA-01 (thay đổi CSS nhỏ + 1 e2e) rồi chạy lại G3a phần a11y trước khi merge M6 vào `main`; nếu Owner chọn merge trước thì cần Release Manager ghi chấp nhận rủi ro với hạn sửa.
- **Điều kiện / owner kế tiếp:** Frontend (F-M6-QA-01, F-M6-QA-02), Tester + Frontend (F-M6-QA-03), Tech Lead (F-M6-QA-04 trong gói G2 `EVID-M6-001`); G3b và G3c ra quyết định riêng.
