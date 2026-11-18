# Tái kiểm định các bản sửa sau G3 của M6 (G3a/G3c mở lại cho phần thay đổi)

> **Artifact ID:** `REVERIFY-M6-001`  
> **Trạng thái/Status:** `approved` — đề xuất kỹ thuật của agent; **G2/G3 Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6")** (G3a `qa-pass`, G3c `review-pass` sau D-M6-13)  
> **Canonical gate/sub-gate:** `G3a` + `G3c` (mở lại cho phần thay đổi, theo [Agent workflow](../../.claude/AGENT_WORKFLOW.md): thay đổi code/build/UI → mở lại G2 và G3a/G3c)  
> **Owner:** Tester (`.claude/agents/tester.md`) + Independent Reviewer (`.claude/agents/reviewer.md`) — agent tái kiểm độc lập  
> **Last reviewed:** 2026-11-18  
> **Base / target:** `51da5174d29adb201bc8a9f99e08903d38d776f0` (`51da517`, target G3 trước) → `821fc6b7fc9f30196a5aa35c4f58abb2f377a5eb` (`821fc6b`, nhánh `origin/fix/m6-g3-findings`, 1 commit, 19 file, +327/−41) — vòng 1; **vòng 2:** `821fc6b` → `bd0d0874709604030f49d8bd477e079509fc12ab` (`bd0d087`), xem mục 6 (đề xuất cuối ở mục 6.4)  
> **Liên kết:** `EVID-M6-001` (evidence envelope M6), `TEST-M6-001` (G3a), `SEC-REVIEW-M6-001` (G3b), `REVIEW-M6-001` (G3c) — ba báo cáo G3 chưa commit, finding lấy từ bản tóm tắt được giao; [Evidence Envelope template](../../.claude/templates/EVIDENCE_ENVELOPE.md)  
> **Related docs:** [M6-SPEC](M6-SPEC.md) (`SPEC-M6-001`), [M6-DESIGN-HANDOFF](M6-DESIGN-HANDOFF.md) (`DESIGN-M6-001`), [ADR-0015](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md), [QA_TEST_PLAN](../QA_TEST_PLAN.md), [Trạng thái hiện tại](../README.md#trạng-thái-hiện-tại)

## 1. Phạm vi và cách làm

- Phạm vi: đúng `git diff 51da517 821fc6b`. Không sửa code/test; probe tạm (`apps/web/e2e/zz-reverify-probe.spec.ts`) đã xóa; mọi đột biến (mutation) đã khôi phục bằng `git checkout --`; `git status` sạch ở cuối. Không commit/push. Chỉ dữ liệu tổng hợp (synthetic).
- Với mỗi finding: (1) tái hiện kịch bản gốc bằng probe Playwright/Vitest, (2) đột biến bỏ bản sửa và xác nhận test mới fail, (3) rà hồi quy.
- `apps/web/e2e/m4.spec.ts` không đổi so với `51da517` (`git diff --quiet 51da517 821fc6b -- apps/web/e2e/m4.spec.ts` → exit 0).

## 2. Bảng finding → bản sửa → bằng chứng → trạng thái

| Finding (sev.) | Bản sửa tại `821fc6b` | Bằng chứng tái kiểm | Trạng thái |
| --- | --- | --- | --- |
| **F-M6-QA-01** (S2) focus bị thanh điều hướng dưới che ở 360 px | `apps/web/src/styles/screens/app-shell.css:70` — `@media (max-width: 1199.98px) { html { scroll-padding-bottom: calc(96px + env(safe-area-inset-bottom)); } }`; e2e `apps/web/e2e/m6.spec.ts:786` (360×780 và 360×640) | E2E đầy đủ: 2 test pass. **Đột biến M4** (comment dòng 70): 2 test **fail** — 360×780: `Bỏ lớp SYN2004 1:730–774 vs nav top 711`, ô Word/In; 360×640: `Bỏ lớp SYN2002 1:596–640 vs nav top 571`, ô ics/png. Tác dụng phụ: probe đo `scroll-padding-bottom` = `96px` ở 360, `auto` ở 1280; màn Bắt đầu 360×640 Tab tới "Bắt đầu" vẫn nằm trong viewport (y 492–544). Thanh dưới cao ≈ 69 px < 96 px. | **closed** (chiều xuống). Chiều ngược (Shift+Tab, app bar dính trên) chưa được xử lý → finding mới **F-RV-M6-01** |
| **REV-M6-001** (S3) poster in "0 tín chỉ" khi chưa rõ | `apps/web/src/export/poster.ts:104` `posterCreditsLine`, `:230` `unknownCredits`; test `apps/web/src/export/poster.test.ts:297` + kiểm nối dây trong `buildPosterInput` | **Đột biến M2** (luôn in `N tín chỉ`): test fail `expected '0 tín chỉ · 1 môn' to be 'chưa rõ tín chỉ · 1 môn'`. Quy tắc khớp `PlanView.tsx:119` (`creditsText`). | **closed** |
| **REV-M6-002 / F-M6-QA-02** (S3) timeout 5 s flaky | `apps/web/src/m5-ui.test.tsx:253` timeout `20_000` | Chạy riêng 3 lần: 2 790 / 2 230 / 2 119 ms, exit 0; trong `npm run check` pass. Là giảm thiểu (nâng timeout), không đổi luồng test — chấp nhận được với mức S3. | **closed** |
| **REV-M6-003** (S3) ô mờ desktop không aria-hidden, bị đếm trong nhãn ngày | `apps/web/src/components/WeekGrid.tsx:60` (`real`), `:66` nhãn, `:78` `aria-hidden` cho `li` ô mờ khi `variant === "screen"` | Probe 1280 px (hover SYN1003 khi đã có SYN1001 1): mọi `li` ô mờ `aria-hidden="true"`, không `li` thật nào bị ẩn; nhãn "Thứ 2, 1 buổi học" (2 slot, 1 ô mờ); nhãn các ngày trước/sau xem trước **giống hệt**; ariaSnapshot của lưới không có nội dung ô mờ; mini-calendar `variant-compact` vẫn `aria-hidden` ở wrapper. **Đột biến M5** (bỏ aria-hidden + đếm mọi block): `npx vitest run` 190/190 pass và `m6.spec.ts` 40/40 pass — **không test commit nào bắt hồi quy**, chỉ probe fail. | **partly** — hành vi đã sửa đúng; thiếu test hồi quy → **F-RV-M6-02** |
| **REV-M6-004** (S3) bấm chỗ trống trong sheet cao hết cỡ làm đóng sheet | `apps/web/src/components/ui/Sheet.tsx:55–61` (chỉ đóng khi điểm bấm nằm ngoài `getBoundingClientRect()` của dialog); `Sheet.test.tsx:47` | **Đột biến M1** (`if (outside \|\| true)`): Vitest fail. Probe Playwright sheet nhập ĐKMH (`size="full"`): 360 px — điểm trống của chính dialog (2, 777) trong hộp 62–780 → sheet **vẫn mở**; chạm backdrop (180, 31) → đóng, focus về "Nhập kết quả ĐKMH"; Esc vẫn đóng. 1280 px — điểm trống (202, 723) → vẫn mở; backdrop (8, 8) → đóng. Sheet lớp (auto, bottom sheet 360 px, top 142) — chạm backdrop (180, 71) → đóng. | **closed** |
| **REV-M6-005 / F-M6-QA-04** (S3) lệch tài liệu | ADR-0015 điểm 1 + dòng `ADR-0015-r3`; DESIGN-M6-001 §2/§10/§13; `docs/QA_TEST_PLAN.md` mục M6; comment `ExportPanel.tsx:103`, `.github/workflows/m0-foundation.yml:108` | Đối chiếu: thứ tự layer sau F7 đúng với code; `poster-lazy.ts` ghi rõ "không có"; QA_TEST_PLAN khớp `scripts/bundle-budget.json` (119 808 / 12 288 / 90 000 / 162 816, `requireSingleCss`), 30 + 4 ảnh mốc có thật (34 PNG), mọi file Vitest được liệt kê tồn tại. Còn vài chỗ nhỏ → **F-RV-M6-03**. | **closed** (kèm S3 tài liệu nhỏ) |
| **REV-M6-007** (S3) code chết | Xóa `PRIVACY_NOTE`, `saveSettings`, `IconPalette`, `IconUpload`, `.week-picker`, `.day-section`; giữ `.course-chip` kèm comment | `grep` trong `apps packages scripts` (ts/tsx/css/mjs/html): 0 tham chiếu còn lại; `.course-chip` chỉ dùng ở `apps/web/src/gallery/main.tsx` và `e2e/gallery.spec.ts`. Test `plan-store.test.ts` chuyển sang `mutateSettings`. Lời hứa riêng tư vẫn hiển thị qua `model/about-content.ts:51`. | **closed** |
| **F-M6-QA-03** (S3) thiếu coverage | 9 e2e mới trong `m6.spec.ts` (`:786` ×2, `:814` ×3, `:845`, `:906`, `:942`, `:960`) + Vitest "Tắt lọc" `qa-m3.test.tsx:197` | Cả 9 e2e pass trong lần chạy đầy đủ. **Đột biến M3** (nút "Tắt lọc" thành no-op): Vitest fail. Xem thêm OBS-RV-02 về độ chặt của oracle vòng focus. | **closed** |
| **REV-M6-006** (S3) hai hiệu ứng §11 | Cố ý chưa sửa — chờ Owner | Không đổi trong diff. | **open** (chờ quyết định Owner) |
| **OBS-M6-01..04** (G3b) | Cố ý chưa xử lý | Không đổi trong diff; không tái kiểm. | không đổi |

## 3. Finding mới

### F-RV-M6-01 — S2 — Shift+Tab: control được focus bị app bar dính (sticky) che hoàn toàn

- **Bằng chứng (probe, Chromium, `821fc6b`):** Phương án có 3 lớp (SYN2002 1, SYN2004 1, SYN1004 1), focus control cuối của region "Phương án" rồi Shift+Tab; hit-test `elementFromPoint` tại 3 điểm (trên/giữa/dưới) của control đều rơi vào `.app-bar`:
  - 360×780: `Bỏ lớp SYN2002 1` 0–44 px, đáy app bar 100 px (điểm giữa trúng một `circle` của icon SVG trong app bar).
  - 360×640: `Bỏ lớp SYN1004 1` 25–69 px, đáy app bar 100 px (trúng `.about-button`) — ảnh chụp xác nhận nút bị chip "Dữ liệu mẫu"/"+1" phủ.
  - 1280×560: `Bỏ lớp SYN2002 1` 32–76 px, đáy app bar 108 px. Ở ≥ 1200 px điều hướng chính nằm **trong** app bar, nên đây trái đúng câu chữ AC-M6-16 "focus không bị thanh điều hướng che".
- **Nguyên nhân:** `.app-bar { position: sticky; top: 0; … }` (`apps/web/src/styles/screens/app-shell.css:15`), không có `scroll-padding-top`; khi lùi focus, trình duyệt cuộn control lên mép trên viewport, dưới app bar. Bản sửa F-M6-QA-01 chỉ xử lý mép dưới.
- **Phân loại:** có từ trước (CSS app bar không đổi trong diff), **không phải hồi quy** của `821fc6b`; G3 trước không phát hiện. Cùng lớp lỗi và cùng mức với F-M6-QA-01 (WCAG 2.2 SC 2.4.11 AA: control bị che **hoàn toàn**) → **S2**.
- **Khuyến nghị:** thêm `scroll-padding-top` bằng chiều cao app bar ở mọi độ rộng (chiều cao thay đổi theo số chip: 100 px ở 360, 108 px ở 1280 với dữ liệu mẫu — nên dùng biến CSS do `ResizeObserver` cập nhật hoặc giá trị bảo thủ có kiểm chứng), và thêm e2e Shift+Tab đối xứng với `m6.spec.ts:786` ở 360×780/640 và 1280. Nếu không sửa trước G4a thì cần risk acceptance có owner, mitigation, hạn.

### F-RV-M6-02 — S3 — REV-M6-003 không có test hồi quy

- Đột biến M5 (bỏ `aria-hidden` của ô mờ và đếm cả ô mờ trong nhãn ngày) không làm fail test nào trong `npm run check` hay `m6.spec.ts`.
- **Khuyến nghị:** Vitest cho `WeekGrid` với `ghostKeys`: `li` ô mờ có `aria-hidden="true"`, nhãn `ul.day-body` chỉ đếm buổi thật, `variant="compact"` không đổi; hoặc thêm 2 assertion vào test AC-M6-10 (`m6.spec.ts:459`).

### F-RV-M6-03 — S3 — tài liệu còn lệch nhỏ

- `docs/evidence/M6-DESIGN-HANDOFF.md:157` (§10 bố cục poster) vẫn chỉ ghi `"N tín chỉ · M môn"`, chưa có dạng "chưa rõ tín chỉ" / "N tín chỉ + K môn chưa rõ" của `posterCreditsLine`.
- `Last reviewed` của ADR-0015 và DESIGN-M6-001 vẫn `2026-11-12` dù đã sửa ngày 2026-11-17.
- Bảng change log ADR-0015: dòng `ADR-0015-r3` (`:162`) nằm giữa r0 và r2 — thứ tự không theo thời gian.
- `docs/adr/ADR-0014-…md:52` nhắc identifier `PRIVACY_NOTE` đã xóa; ADR đã accepted nên chỉ là ghi chú lịch sử — nội dung lời hứa vẫn có ở `apps/web/src/model/about-content.ts:51`. Không cần sửa ADR-0014; có thể thêm chú thích khi cập nhật traceability.

### Quan sát (không xếp severity)

- **OBS-RV-01 — ngân sách bundle:** tổng JS 162 583 B gzip / 162 816 B → còn **233 B** (sau F7 là 162 433 B, còn 383 B theo ghi chú F7 trong DESIGN-M6-001 §13; commit này dùng thêm 150 B). Sửa F-RV-M6-01 bằng CSS thuần không tốn JS; nếu dùng `ResizeObserver` cần đo lại.
- **OBS-RV-02 — oracle vòng focus:** test keyboard-only coi là có vòng focus khi `outlineStyle !== "none" || boxShadow !== "none"` (`m6.spec.ts:766–769`). Phần tử có bóng cố định (vd. `.nav-add` có `box-shadow: var(--shadow-2)`, `app-shell.css:60`) sẽ pass kể cả khi không có vòng focus. Nên so với style lúc không focus.
- **OBS-RV-03 — tên truy cập khi xem trước:** khi đang xem trước SYN1003 trên desktop, block thật SYN1001 có tên "… đang trùng lịch với SYN1003" (partner lấy từ xung đột có cả ô mờ) — khớp viền đỏ hiển thị trên block thật; có từ trước, không phải lỗi, chỉ cần xác nhận là chủ ý.
- **OBS-RV-04 — Sheet khi đang trượt vào:** `getBoundingClientRect()` gồm cả `translateY(24px)` của `@starting-style` trong 250 ms mở; chỉ ảnh hưởng cú bấm vào đúng vùng trống của dialog trong khoảng đó. Không đáng kể.
- **OBS-RV-05 — toast:** ở 360×640 ba toast "Đã thêm lớp …" xếp chồng phủ ô Word/In trong ảnh chụp probe; chưa kiểm toast có che control đang focus hay không và có tự tắt không — ngoài phạm vi diff.

## 4. Lệnh đã chạy (worktree riêng, Windows 10 Pro 10.0.19045, Node v22.22.2, npm 12.0.2, Playwright 1.64.0 Chromium)

| # | Lệnh | Exit | Kết quả |
| --- | --- | --- | --- |
| 1 | `git fetch origin` ; `git checkout --detach 821fc6b` ; `git rev-parse HEAD` | 0 | `821fc6b7fc9f30196a5aa35c4f58abb2f377a5eb` |
| 2 | `npm ci` | 0 | 0 vulnerabilities |
| 3 | `npm run check` | 0 | lint pass; Node tests 153/153; Vitest 23 file, 190/190; fixtures 6/6; `dataset: data/published OK — 0 datasets` |
| 4 | `npm run verify:bundle` | 0 | JS ban đầu 118 084 B gzip (≤ 119 808); CSS ban đầu 7 124 B (≤ 12 288), đúng 1 file CSS; chunk lazy `RegistrationImport-` 37,3 KiB, `exporters-` 6,2 KiB (≤ 43 008 B/chunk); **tổng JS 162 583 B (≤ 162 816)**; font 67 424 B / 4 file (≤ 90 000); `verify-production-bundle: OK … ky-nay-build=0.0.0+821fc6b … no third-party origins` |
| 5 | `E2E_PORT=4384 npm run test:e2e` | 0 | 67 test: **63 passed, 4 skipped** (4 ảnh gallery chỉ chạy ở project `visual`), 0 failed, 0 flaky, 2,6 phút |
| 6 | Đột biến M1 (Sheet) + M2 (poster) → `npx vitest run src/components/ui/Sheet.test.tsx src/export/poster.test.ts` | 1 | 2 failed / 11 passed (đúng 2 test mới); khôi phục |
| 7 | Đột biến M3 ("Tắt lọc" no-op) → `npx vitest run src/qa-m3.test.tsx -t "Tắt lọc"` | 1 | 1 failed; khôi phục |
| 8 | `npx vitest run src/m5-ui.test.tsx -t "only carries public identifiers" --reporter=verbose` ×3 | 0 ×3 | 2 790 / 2 230 / 2 119 ms |
| 9 | Đột biến M4 (comment `app-shell.css:70`) → `E2E_PORT=4384 npx playwright test e2e/m6.spec.ts --project=chromium -g "F-M6-QA-01"` | 1 | 2 failed (đúng 2 test mới); khôi phục |
| 10 | Probe → `E2E_PORT=4384 npx playwright test e2e/zz-reverify-probe.spec.ts --project=chromium` | 1 rồi 0 | Lần 1: 5 passed, 1 failed do assertion của probe quá chặt (tên partner của block thật, xem OBS-RV-03), không phải lỗi sản phẩm; sửa probe, lần 2: **8 passed** |
| 11 | Probe Shift+Tab 360×780, 360×640, 1280×560 (`-g "last plan row"`) | 0 | 3 passed (probe chỉ ghi log); mỗi kích thước có 1 control bị app bar che hoàn toàn → F-RV-M6-01 |
| 12 | Đột biến M5 (WeekGrid) → `npx vitest run` ; `E2E_PORT=4384 npx playwright test e2e/m6.spec.ts e2e/zz-reverify-probe.spec.ts --project=chromium` | 0 ; 1 | Vitest 190/190 pass; e2e 40 passed, chỉ probe REV-M6-003 fail → F-RV-M6-02; khôi phục (lần thử đầu tiên build fail vì biến `real` không còn dùng, đã bỏ luôn biến này trong đột biến) |
| 13 | `git diff --quiet 51da517 821fc6b -- apps/web/e2e/m4.spec.ts` | 0 | m4.spec không đổi |
| 14 | Xóa probe; `git status --short` | 0 | sạch (chỉ còn thư mục build/test-results bị ignore) |

Không có run ID của CI: mọi lần chạy là cục bộ trong worktree cô lập, không chạy G4a/G4b/G5.

## 5. Đề xuất cho G3a/G3c mở lại (phần thay đổi `51da517..821fc6b`)

- **G3a (Tester): `qa-pass-with-follow-up`.** Mọi bản sửa trong diff đều đúng, test mới fail khi bỏ bản sửa (trừ REV-M6-003 chưa có test), check/bundle/e2e xanh, không hồi quy. Điều kiện: **F-RV-M6-01 (S2, có từ trước)** phải được sửa trước G4a (khuyến nghị: CSS `scroll-padding-top` + e2e Shift+Tab, cùng cách F-M6-QA-01) hoặc được Release Manager chấp nhận rủi ro có owner, mitigation, hạn. Nếu cả hai đều không có thì G3a phải xem là `qa-no-go`.
- **G3c (Independent Reviewer): `review-pass-with-follow-up`.** Không có S0/S1; F-RV-M6-02 và F-RV-M6-03 là S3; REV-M6-006 vẫn chờ Owner quyết định.
- Đây là đề xuất của agent; quyết định gate thuộc Owner/Release Manager.
- *(Vòng 1 — đã được thay bằng đề xuất cuối ở mục 6.4.)*

## 6. Vòng 2 — target `bd0d087`

- **Base / target:** `821fc6b` → `bd0d0874709604030f49d8bd477e079509fc12ab` (`bd0d087`, `origin/fix/m6-g3-findings`, 1 commit "re-verification follow-ups", 5 file, +46/−7). Đã review đúng `git diff 821fc6b bd0d087`.
- Cùng quy tắc như vòng 1: worktree riêng, không sửa code/test, probe `apps/web/e2e/zz-reverify-probe2.spec.ts` đã xóa, mọi đột biến đã khôi phục bằng `git checkout --`, `git status` cuối chỉ còn báo cáo này, không commit/push, chỉ dữ liệu tổng hợp.

### 6.1. Finding vòng 1 → bản sửa → bằng chứng → trạng thái

| Finding (sev.) | Bản sửa tại `bd0d087` | Bằng chứng | Trạng thái |
| --- | --- | --- | --- |
| **F-RV-M6-01** (S2) Shift+Tab: focus bị app bar dính che | `apps/web/src/styles/screens/app-shell.css:73` `html { scroll-padding-top: 120px; }` (mọi độ rộng); e2e `apps/web/e2e/m6.spec.ts:817` ở 360×780, 360×640 và 1280×560 | Cả 3 e2e pass trong lần chạy đầy đủ. **Đột biến MA** (comment dòng 73): cả 3 **fail** — 360×780: `Bỏ lớp SYN2004 1:91–135` và `Bỏ lớp SYN2002 1:0–44` so với đáy app bar 100; 360×640: `Bỏ lớp SYN1004 1:25–69`, `Phương án nháp (3):77–121`, `Tuần 1 …:99–143` so với 100; 1280×560: `Bỏ lớp SYN2002 1:32–76`, `Bỏ lớp SYN2004 1:106–150` so với 108. Đúng các control probe vòng 1 đã thấy. Rà hồi quy ở mục 6.2. | **closed** |
| **F-RV-M6-02** (S3) REV-M6-003 không có test hồi quy | `m6.spec.ts:471–480` trong test AC-M6-10: không còn ô mờ nào nằm ngoài `li[aria-hidden='true']`; nhãn ngày trước/sau khi xem trước giống hệt | **Đột biến MB** (bỏ `aria-hidden` + đếm cả ô mờ): AC-M6-10 **fail** ở `m6.spec.ts:479` (`Expected: 0, Received: 1`). **Đột biến MC** (giữ `aria-hidden`, chỉ đếm cả ô mờ trong nhãn): AC-M6-10 **fail** ở `:480` (`"Thứ 2, 1 buổi học"` → `"Thứ 2, 2 buổi học"`). Hai assertion bắt độc lập hai nửa của bản sửa. | **closed** → **REV-M6-003 nay closed** |
| **F-RV-M6-03** (S3) tài liệu lệch nhỏ | DESIGN-M6-001 §10 (`M6-DESIGN-HANDOFF.md:157`) thêm "chưa rõ tín chỉ" / "N tín chỉ + K môn chưa rõ"; `Last reviewed` 2026-11-17 ở ADR-0015 (`:9`) và DESIGN-M6-001 (`:7`); change log ADR-0015 theo thứ tự r0, r1, r2, r3 (`:161–164`); ADR-0014 `:52` thêm ghi chú M6 cho `PRIVACY_NOTE` đã xóa, trỏ tới `model/about-content.ts` | Đã đối chiếu từng chỗ tại `bd0d087`: câu chữ khớp `posterCreditsLine`. Ghi chú trong ADR-0014 (đã accepted) chỉ là ghi chú traceability, không đổi quyết định. | **closed** |

Các finding khác giữ trạng thái vòng 1. REV-M6-006 vẫn **open** chờ Owner; OBS-M6-01..04 không đổi.

### 6.2. Rà hồi quy `scroll-padding-top: 120px` (probe Chromium)

| Kiểm tra | Kết quả |
| --- | --- |
| Chiều cao app bar so với 120 px: rộng 320/360/414/768/1024/1199/1200/1280/1920, online và offline (thêm chip "Ngoại tuyến") | 100 px dưới 1200, 108 px từ 1200 trở lên. Chip gộp thành "+1"/"+2" ở ≤ 360 nên app bar không xuống hai dòng; luôn < 120 px. `scroll-padding` = `120px/96px` dưới 1200, `120px/auto` từ 1200. |
| Cỡ chữ gốc lớn hơn (font-size của `html` 16/20/24 px, mô phỏng thiết lập cỡ chữ của trình duyệt) ở 360/768/1280 | App bar giữ 100/100/108 px (chiều cao do min-height theo px quyết định). |
| Skip link "Bỏ qua tới nội dung chính" sau khi cuộn xuống đáy, ở 360 và 1280 | `scrollY` 779 → 0 (360) và 335 → 0 (1280); hash `#main`; `main` nhận focus; đỉnh `main` = đáy app bar (100/108). Không bị che, không nhảy sai. |
| Màn Bắt đầu 360×640, Tab 25 lần | Mọi điểm dừng đều nằm trọn trong viewport, không bị app bar che; "Bắt đầu" ở 492–544. |
| Thêm lớp (danh sách "SYN" dài), Tab rồi Shift+Tab, 360×640 và 1280×560 | 42 và 55 điểm dừng; không control nào bị app bar hay thanh dưới che. |
| Sheet "Giới thiệu…" 360×640: Tab 25 lần trong sheet | `html` có `overflow: hidden` khi sheet mở; `.sheet-body` (vùng cuộn riêng) có `scroll-padding-top: auto`, nên `scroll-padding` của `html` không ảnh hưởng; không control nào nằm ngoài vùng nhìn thấy của thân sheet. |
| `scrollIntoView({ block: "center" })` trong `WeekView.tsx:175` và `AboutPanel.tsx:38` | Vẫn chạy; vùng căn giữa lệch nhẹ theo padding, không phải lỗi. |

Không thấy hồi quy. Quan sát mới (không xếp severity): **OBS-RV-06** — 120 px là hằng số px dựa trên chiều cao đo được (100–108 px). Nếu sau này app bar thêm dòng chip ở màn hẹp hoặc đổi chiều cao, phải cập nhật giá trị này; ba test `m6.spec.ts:817` sẽ bắt trường hợp đó ở các kích thước đã chọn.

### 6.3. Lệnh vòng 2 (cùng môi trường: Windows 10 Pro 10.0.19045, Node v22.22.2, npm 12.0.2, Playwright 1.64.0 Chromium)

| # | Lệnh | Exit | Kết quả |
| --- | --- | --- | --- |
| R1 | `git fetch origin` ; `git checkout --detach bd0d087` ; `git rev-parse HEAD` | 0 | `bd0d0874709604030f49d8bd477e079509fc12ab` |
| R2 | `npm ci` | 0 | |
| R3 | `npm run check` | 0 | lint pass; Node tests 153/153; Vitest 23 file, 190/190; fixtures 6/6; `dataset: data/published OK — 0 datasets` |
| R4 | `npm run verify:bundle` | 0 | JS ban đầu 118 083 B gzip (≤ 119 808); CSS ban đầu 7 128 B (≤ 12 288), đúng 1 file CSS; `RegistrationImport-` 37,3 KiB, `exporters-` 6,2 KiB; **tổng JS 162 582 B (≤ 162 816, còn 234 B)**; font 67 424 B / 4 file; `verify-production-bundle: OK … ky-nay-build=0.0.0+bd0d087 … no third-party origins` |
| R5 | `E2E_PORT=4384 npm run test:e2e` | 0 | 70 test: **66 passed, 4 skipped** (4 ảnh gallery, chỉ chạy ở project `visual`), 0 failed, 0 flaky, 2,9 phút |
| R6 | Probe hồi quy `E2E_PORT=4384 npx playwright test e2e/zz-reverify-probe2.spec.ts --project=chromium` (7 test, rồi thêm `-g "PROBE2Z"`) | 0 ; 0 | 7 passed ; 1 passed |
| R7 | Đột biến MA + MB → `E2E_PORT=4384 npx playwright test e2e/m6.spec.ts --project=chromium -g "F-RV-M6-01\|from 1200 px: two columns"` | 1 | 4 failed (đúng 3 test F-RV-M6-01 + AC-M6-10); khôi phục |
| R8 | Đột biến MC → `E2E_PORT=4384 npx playwright test e2e/m6.spec.ts --project=chromium -g "from 1200 px: two columns"` | 1 | 1 failed ở `m6.spec.ts:480`; khôi phục |
| R9 | Xóa probe; `git status --short` | 0 | chỉ còn `docs/evidence/M6-G3-FOLLOWUP-REVERIFICATION.md` (chưa track) |

Không có run ID của CI. Không chạy G4a/G4b/G5.

### 6.4. Đề xuất cuối cho G3a/G3c mở lại (phần thay đổi `51da517..bd0d087`)

- **G3a (Tester): `qa-pass`.** Mọi finding G3a trong phạm vi (F-M6-QA-01..04 và F-RV-M6-01) đã đóng. Mỗi bản sửa có test làm fail khi bỏ bản sửa. Check, bundle và e2e đều xanh; không thấy hồi quy của `scroll-padding-top`; không còn S0/S1/S2 mở trong phần thay đổi.
- **G3c (Independent Reviewer): `review-pass-with-follow-up`.** Mọi finding G3c trong phạm vi đã đóng: REV-M6-001..005, 007, F-RV-M6-02, F-RV-M6-03. Phần follow-up duy nhất là **REV-M6-006 (S3, hai hiệu ứng §11)**, cố ý để mở chờ Owner quyết định; nó cần owner, mitigation và hạn theo quy tắc S3. Nếu Owner quyết định bỏ hoặc hoãn có ghi nhận, G3c có thể thành `review-pass`.
- Các quan sát OBS-RV-01..06 không chặn gate. Lưu ý về ngân sách: tổng JS chỉ còn 234 B dưới giới hạn.
- Đây là đề xuất của agent. REV-M6-006 sau đó được Owner hoãn (D-M6-13, 2026-11-18); Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6"): G3a `qa-pass`, G3c `review-pass`.
