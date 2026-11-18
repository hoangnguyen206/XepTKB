# Review — M6 "Lịch có màu" (làm mới frontend), toàn bộ diff `origin/main..51da517`

> **Artifact ID:** `REVIEW-M6-001`  
> **Artifact status:** `approved`  
> **Canonical gate:** `G3c`  
> **Owner:** Independent Reviewer  
> **Last reviewed:** 2026-11-18  
> **Related docs:** [SPEC-M6-001](M6-SPEC.md), [DESIGN-M6-001](M6-DESIGN-HANDOFF.md), [ADR-0015](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md), [PLAN-M6-001](M6-FRONTEND-REFRESH-PLAN.md), [CHANGELOG](../../CHANGELOG.md), [docs/README.md › Trạng thái hiện tại](../README.md#trạng-thái-hiện-tại), [Review template](../../.claude/templates/REVIEW_REPORT_TEMPLATE.md), [Agent workflow](../../.claude/AGENT_WORKFLOW.md)  
> **Evidence envelope:** `EVID-M6-001` (G2 của M6; không có trong checkout này — báo cáo chỉ dựa trên lệnh reviewer tự chạy, ghi ở §1.2)  
> **Independent reviewer / approval UTC timestamp:** Independent Reviewer (agent), đề xuất kỹ thuật `2026-11-17`. **G3c Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6"): `review-pass`** (sau sửa ở PR #23, tái kiểm định [REVERIFY-M6-001](M6-G3-FOLLOWUP-REVERIFICATION.md) và D-M6-13 hoãn REV-M6-006).

---

## 1. Scope and identity

- **Review type:** correctness / maintainability / accessibility / regression (security-adjacent: ranh giới privacy của nhập ĐKMH và poster).
- **Source spec/ADR/PRD + versions:** `SPEC-M6-001` (g0-approved `2026-11-12T14:53Z`, có D-M6-12), `DESIGN-M6-001` (g1-approved `2026-11-12T15:28Z`, §13 có ghi chú triển khai F2–F7), `ADR-0015` (r0, r1, r2), tất cả đọc tại commit đích.
- **Base commit/diff ID:** `origin/main` = `990784c7fa711343a67df1f999ad626211ceec50`; merge-base `c6d9e2b61e5bac1609e657ec649281381c9b2222`.
- **Target commit/PR/build ID:** `51da5174d29adb201bc8a9f99e08903d38d776f0` (nhánh tích hợp `m6-frontend`, merge PR #22). Diff: **173 file, +8 486 / −2 190** (`git diff --stat origin/main..51da517`), gồm PR #11, #12, #14–#22.
- **Dataset/parser/schema/fixture versions:** không đổi — dataset synthetic `synthetic-uet-2026-2027-h2.1` (e2e/Vitest), schema domain `0.2.0`, manifest `1.0`; diff không chạm `packages/*`, `fixtures/*`, `data/*`.
- **Requirement/AC/P0 coverage:** M6-A…J, AC-M6-01…20 (đối chiếu ở §3), cộng các bảo đảm M3–M5 phải giữ (§4).

### 1.1. Cách làm

1. Đọc `CLAUDE.md`, `.claude/agents/reviewer.md`, `.claude/AGENT_WORKFLOW.md`, template review, `REVIEW-M5-001` (định dạng), SPEC/DESIGN/ADR-0015, CHANGELOG, `docs/README.md`.
2. Đọc toàn bộ code app thay đổi trong `apps/web/src` (model, storage, controller, components, export, styles) và so với bản cũ ở `origin/main` cho các phần thay thế (`SectionCard` → `ClassSheet`, `DatasetBanners` → `datasetStatuses`, `PlanSummary` → `PlanView`, `ExportPanel`, `controller.ts`, `local-data.ts`).
3. So diff mọi file test (`apps/web/e2e/*.spec.ts`, `apps/web/src/*.test.tsx`) để tìm assertion bị xóa hoặc nới.
4. Viết một spec Playwright tạm (`apps/web/e2e/zz-g3c-probe.spec.ts`, **đã xóa** sau khi chạy, `git status` sạch) để kiểm 3 giả thuyết: Esc trên sheet lớp có xóa ô tìm không, ô mờ có lộ ra cây truy cập không, số gợi ý cùng lúc.
5. Quét export không còn ai dùng và class CSS không còn ai dùng bằng script node tạm trong scratchpad (không nằm trong repo).

### 1.2. Lệnh đã chạy (worktree riêng tại `51da517`, Windows 10, Node v22.22.2)

| # | Lệnh | Exit | Kết quả chính |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | — |
| 2 | `npm run check` (lần 1, chạy cùng lúc với tiến trình Vitest của một agent khác trên máy) | **1** | lint, typecheck, 153/153 node test qua; Vitest **1 failed / 187 passed (23 file)**: `src/m5-ui.test.tsx › per-section report in the app (AC-M5-02) › only carries public identifiers…`. Log lần này bị một tiến trình khác ghi chồng một phần nên không giữ được thông báo lỗi; xem `REV-M6-002` |
| 3 | `npm run check` (lần 2) | 0 | `lint: foundation and web boundary checks passed`; typecheck sạch; node test **153/153**; Vitest **188/188 (23 file)**; fixtures **6/6**; `dataset: data/published OK — 0 datasets (0 published)` |
| 4 | `npx vitest run src/m5-ui.test.tsx --reporter=verbose` (apps/web) | 0 | 13/13; ca ở dòng 216 mất **4 336 ms** khi chạy một mình (timeout mặc định 5 000 ms) |
| 5 | `npx vitest run --reporter=verbose` (apps/web) | 0 | 188/188; các ca dài nhất: `m4-registration` 8 231 ms (đã có timeout 20 s), `m5-ui` dòng 216 4 279 ms, `qa-m3.test.tsx` "says the credits are unknown…" 3 283 ms, `App.test.tsx` "requires a group…" 2 831 ms (ba ca sau dùng timeout mặc định 5 s) |
| 6 | `npm run verify:bundle` | 0 | `verify-production-bundle: OK (3 JS asset(s) … CSP unchanged, 4 precached woff2 + licenses.txt, no gallery, no third-party origins)`; JS ban đầu **117 991 B** gzip (ngân sách 119 808), CSS ban đầu **7 123 B** (12 288), `exporters-` 6,1 KiB, `RegistrationImport-` 37,3 KiB, **tổng JS 162 431 B** (162 816 — còn 385 B), font 67 424 B / 4 file (90 000) |
| 7 | `E2E_PORT=4383 npx playwright test e2e/zz-g3c-probe.spec.ts --project=chromium` (spec tạm lần 1, đã xóa) | 0 | 2/2; kết quả ở `REV-M6-003` và §6 |
| 8 | `E2E_PORT=4383 npm run test:e2e` | 0 | **54 passed, 4 skipped (2.3m)** — xem §1.3 |
| 9 | `E2E_PORT=4383 npx playwright test e2e/zz-g3c-probe.spec.ts --project=chromium` (spec tạm lần 2, đã xóa) | 0 | 2/2; kết quả ở `REV-M6-004` |

Sau lệnh #7 và #9, file probe đã xóa; `git status --short` chỉ còn file báo cáo này (untracked), HEAD vẫn là `51da517`.

Không chạy: project `visual` (chỉ chạy trên Linux CI, `playwright.config.ts` từ chối trên Windows), `E2E_WEBKIT=1`, thử thủ công trên thiết bị thật, `secret-scan`/`npm audit` (thuộc G3b).

### 1.3. Kết quả e2e

`E2E_PORT=4383 npm run test:e2e` → exit 0, Playwright Chromium: **54 passed, 4 skipped** (`m3.spec.ts` 13, `m4.spec.ts` 2, `m5.spec.ts` 6, `qa-m3.spec.ts` 4, `m6.spec.ts` và `gallery.spec.ts` phần còn lại). 4 ca bỏ qua là ảnh chụp `gallery.spec.ts` (`gallery {360,1280}px {light,dark}: screenshot`), cố ý chỉ chạy ở project `visual` trên Linux. Fixture `networkGuard` (request cùng origin, chỉ GET, 0 WebSocket) qua ở mọi ca.

---

## 2. Verdict

`review-pass-with-follow-up` *(đề xuất của Independent Reviewer; chờ Owner quyết định)*

- **0 S0, 0 S1, 0 S2, 7 S3.** Không thấy lỗi nào làm sai invariant domain (conflict theo tiết × tuần, override precedence, tuần), không có rò rỉ PII và không có hồi quy hành vi M3–M5 đã được test.
- Các S3 gồm: một lỗi thể hiện số tín chỉ trên poster trái quy tắc "chưa rõ ≠ 0" (`REV-M6-001`), một test Vitest chập chờn đã thấy fail một lần (`REV-M6-002`), một lệch a11y so với DESIGN §8 (`REV-M6-003`), một lỗi nhỏ của sheet toàn màn (`REV-M6-004`), lệch tài liệu/quyết định (`REV-M6-005`, `REV-M6-006`) và code/CSS chết (`REV-M6-007`).
- `REV-M6-002` và `REV-M6-005` nên xong **trước khi merge vào `main`** (độ tin cậy của CI và trạng thái trong `docs/README.md`); các mục còn lại có thể theo dõi sau với owner và hạn ghi ở từng finding.

## 3. Structured checks

| Check | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Correctness/domain invariants | Không rule domain mới; conflict qua `findConflicts`; override, tuần giữ nguyên | `model/picker.ts:114-130` (`sectionFits`, `previewTargetFor`) chỉ gọi `previewPick` → `resolvePlanPicks` + `findConflicts`; `candidatePlan` (`:105-107`) chỉ dùng cho xem trước. `ClassSheet.tsx:99-102` giữ nguyên bảng quyết định nút của `SectionCard` (so với `origin/main`), chỉ đổi chữ. Không file nào trong `packages/` đổi | pass |
| Parser/data provenance | Không đổi parser/dataset; nguồn dữ liệu ≤ 2 chạm | Diff không chạm `packages/parser`, `fixtures`, `data`. `DataSourceSheet.tsx` giữ mọi trường của `ProvenancePanel` cũ; chip học kỳ mở trong 1 chạm | pass |
| Scope/contract/migration | Settings không tăng version DB; tương thích M5; lệch so với G1 phải có quyết định | `local-data.ts` `sanitizeSettings`/`mutateSettings`/`withCourseColor` đúng DESIGN §4; test M5-spread ở `local-data.test.ts`. Lệch thiết kế §11 (2 hiệu ứng) và tài liệu cũ: `REV-M6-005`, `REV-M6-006` | pass (kèm S3) |
| Privacy/security boundary | 0 request trong cửa sổ nhập ĐKMH; poster không PII; CSP không đổi | `e2e/m4.spec.ts` chỉ đổi locator/điều hướng (§4.2); `buildPosterInput` chỉ chép trường công khai (`poster.ts:204-239`); `verify:bundle` báo "CSP unchanged … no third-party origins" | pass |
| Performance/maintainability | Trong ngân sách; không code chết | Mọi ngân sách qua, nhưng tổng JS chỉ còn 385 B (đã ghi ở DESIGN §13 F7). Code/CSS chết: `REV-M6-007` | pass (kèm S3) |
| Tests/docs/observability | Test không bị nới; tài liệu khớp code | Không thấy assertion hành vi nào bị bỏ (§4.2). Test chập chờn `REV-M6-002`; README/ADR lệch `REV-M6-005` | pass (kèm S3) |

---

## 4. Đối chiếu chi tiết

### 4.1. Theo contract của DESIGN-M6-001

| Hạng mục | Code tại `51da517` | Kết quả |
| --- | --- | --- |
| §3 Bảng màu, gán màu tất định | `model/palette.ts:87-107` `assignCourseColors`: FNV-1a 32 bit mod 10, dò tuyến tính tới màu ít dùng nhất (khi < 10 môn là màu chưa dùng), màu người dùng chọn chỉ thay màu hiển thị của chính môn đó và vẫn giữ chỗ màu tự động, nên không đẩy màu môn khác. `courseOrder` (`:65-79`) nháp trước chính thức, mã chuẩn qua `courseOf`. `useCourseColors.ts` dùng một map cho cả nháp và chính thức; khóa `courseColors` là mã chuẩn (`WeekView.tsx:166`, `canonical`) | pass |
| §4 Settings | `sanitizeSettings` bỏ giá trị lạ, giới hạn 100 khóa; `idbUpdate` (`storage/db.ts`) đọc-ghi trong một transaction, `mutate` ném lỗi thì abort; `removeFinalPlan` chuyển sang `mutateSettings` (`controller.ts:260-265`); `setTheme`/`setCourseColor`/`markHintSeen` nối tiếp qua `saveChainRef` (`controller.ts:286-321`); `settings-changed` → `reloadPlans` (`:335`); xóa dữ liệu đặt lại theme "system" (`:278-279`) | pass |
| §2 Theme | `applyTheme` gọi ngay sau `loadSettings`, trước khi tải dataset (`controller.ts:139-143`); không script inline, không `localStorage` (lint qua) | pass |
| `model/dataset-status.ts` | Điều kiện và câu chữ khớp 1:1 với `DatasetBanners` ở `origin/main:apps/web/src/App.tsx:35-63` (hết hiệu lực, dữ liệu mẫu, bản thử với mọi `status !== "published"`, ngoại tuyến, dữ liệu cũ); chỉ khác thứ tự hiển thị (nặng trước) | pass |
| §7 Lưới tuần | `visiblePeriods` cố định qua các tuần; `sessionAccessibleName` bắt đầu bằng mã môn và có "đang trùng lịch với …"; `CourseBlock` giữ `is-conflict`/`is-overridden`, có viền, sọc, icon và chữ "Trùng"; phím ←/→/T bỏ qua khi focus ở ô nhập hoặc trong dialog (`WeekView.tsx:152-163`); vạch giờ chỉ ở tuần hiện tại (`:120-121`) | pass |
| §8 Thêm lớp | Bộ lọc tính trên ≤ 30 kết quả, chỉ khi bật (`AddClassView.tsx:80-83`); "Vẫn thêm lớp này" là đường duy nhất để thêm lớp trùng (không thêm bước xác nhận); `Ctrl/⌘ K` là listener document duy nhất, bỏ qua IME (`isComposing`, `keyCode 229`), sự kiện đã `preventDefault`, Alt/Shift và khi có `dialog[open]` (`useSearchShortcut.ts:8-13`). Ô mờ: xem `REV-M6-003` | pass (kèm S3) |
| §9 Gợi ý, trạng thái rỗng | `Workspace.tsx:160-167` chọn gợi ý đầu tiên chưa xem trong các gợi ý áp dụng, nên mỗi lúc tối đa một gợi ý (probe: `hints=1` ở 1280 px). `EmptyState` nhận đúng một `action`; 5 trạng thái rỗng (Lịch rỗng, không tìm thấy, lọc ẩn hết, tuần trống, Phương án rỗng) mỗi chỗ một nút; "Lịch rỗng" và "tuần trống" không thể hiện cùng lúc (`nearestWeek` cần buổi cố định) | pass |
| §6 `Sheet` | `showModal`, Esc qua `cancel`, trả focus về phần tử mở (cả khi unmount), `Sheet.test.tsx` có test. Lỗi nhỏ ở sheet `size="full"`: `REV-M6-004` | pass (kèm S3) |
| §10 Poster/xuất | 1080×1350, không DPR; `buildPosterInput` không nhận ghi chú ĐKMH, lớp chưa khớp, tên phương án hay mã lớp; tên file ICS/Word/PNG không đổi; chunk `exporters-` có `resetExporters` khi lỗi để bấm lại thử lại. Số tín chỉ trên poster: `REV-M6-001` | pass (kèm S3) |
| §11 Chuyển động | `withViewTransition` (`app/motion.ts:16-26`): bỏ qua khi không có API hoặc giảm chuyển động, bọc `flushSync`; chỉ dùng cho đổi tuần. Mờ khi đổi view và hiệu ứng "rơi" chưa làm: `REV-M6-006` | pass (kèm S3) |
| §2 CSS layer | `styles/index.css`: `@layer tokens, base, components, screens, print;` rồi các `@import … layer(…)`; không còn layer legacy; `verify:bundle` xác nhận đúng một file CSS | pass (tài liệu lệch: `REV-M6-005`) |
| Lazy chunk + lỗi tải | `Workspace.tsx:280-303` bọc panel ĐKMH trong `LocalErrorBoundary` với "Thử lại" (`resetRegistrationImport` + lazy component mới); prefetch `RegistrationImport-` và `exporters-` khi mount (`:114-119`) | pass |

### 4.2. Hồi quy so với M3–M5

- **`e2e/m4.spec.ts` có thay đổi** (34 dòng), không phải "giữ nguyên" theo nghĩa đen; DESIGN §12 cho phép đổi locator và bước điều hướng. Đã đọc toàn bộ diff: chỉ thêm `openView`, đổi locator (tab → nút điều hướng, "Chọn lớp này" → "Thêm vào lịch", day list → sheet chi tiết buổi) và thêm bước mở view. **Mọi `expect` về `postImportRequests`, `PII_TOKENS`, `idbDump`, console và nội dung file không đổi một ký tự.** Một điểm giảm phạm vi nhỏ: vòng lặp AC-M4-08 trước đi qua 3 tab (Tuần, Theo ngày, Phương án), nay chỉ còn "Lịch" và "Phương án"; lịch ngày giờ là một chế độ trong Lịch, axe cho lịch ngày không còn được kiểm trong m4 (m6.spec có axe cho 5 màn chính nhưng không có lịch ngày). Ghi nhận, không xếp finding.
- Các spec/test khác (`m3`, `qa-m3`, `m5`, `App.test`, `qa-m3.test`, `m4-registration.test`, `m5-ui.test`): những assertion bị xóa đều có bản thay thế tương đương (ví dụ chữ trùng "⚠ Trùng lịch với QAA001 1 (Môn A): Thứ 3, tiết 5–6, tuần 8–10", "1 lớp · chưa rõ tín chỉ", "2 lớp · 4 tín chỉ + 1 môn chưa rõ tín chỉ", 2 tab, offline, rebase, xóa dữ liệu). Assertion "lưới cuộn ngang ở 360" đổi thành "không cuộn ngang" đúng theo DESIGN §12.
- Bảng quyết định nút chọn lớp/nhóm (`ClassSheet.tsx:99-109`) trùng logic với `SectionCard` cũ; ngưỡng "Vẫn …" giữ nguyên.
- Ghép dataset mới (`StalePlanNotice`, `rebasePlan`) và luồng `removeFinalPlan` giữ hành vi; `removeFinalPlan` nay còn an toàn hơn vì đọc-ghi trong một transaction.

### 4.3. Accessibility và đường lỗi

- Tên truy cập: nút điều hướng có `aria-current="page"`; ô lịch là `button` trong `li`, tên bắt đầu bằng mã môn; DayStrip có "hôm nay" trong tên; chip trạng thái và chip học kỳ là nút có `aria-haspopup="dialog"`.
- Bàn phím: phím tắt ký tự "T" chỉ chạy khi focus ở trong vùng lịch (WCAG 2.1.4); `Ctrl/⌘ K` bỏ qua IME. `onKeyDown` của `WeekView` không kiểm `isComposing`, nhưng đã bỏ qua mọi ô nhập nên không ảnh hưởng.
- Sheet trả focus về phần tử mở. Ngoại lệ đã biết: khi phần tử mở không còn (ví dụ "Bỏ lớp này" trong sheet chi tiết buổi xóa luôn ô vừa mở sheet) focus rơi về `body` vì `opener.isConnected` sai (`Sheet.tsx:29-33`). Hành vi này giống "Bỏ lớp" ở danh sách Phương án từ M3; ghi nhận, không xếp finding.
- Lỗi tải chunk: ĐKMH có "Thử lại"; xuất file báo lỗi và quên promise lỗi (`ExportPanel.tsx:38-46`), bấm lại sẽ thử tải lại.

### 4.4. Race condition

- Lưu settings giao diện: cập nhật lạc quan (`showSettings(local(settingsRef.current))`) rồi áp cùng hàm `local` lên bản trong IndexedDB trong một transaction, nên hai tab đổi hai trường khác nhau không ghi đè nhau (`local-data.test.ts` "concurrent updates…").
- Một khe nhỏ vẫn còn (có từ M5 với `activeSlots`): nếu tab A đang chờ lưu trong `saveChainRef` mà nhận `settings-changed` của tab B, `reloadPlans` (`controller.ts:89-95`, không đi qua chuỗi lưu) đọc bản DB chưa có thay đổi của A và hiện lại giá trị cũ cho tới lần đọc sau, dù DB cuối cùng đúng. Cần hai tab thao tác trong vài chục ms; không xếp finding.
- `withViewTransition` + `flushSync`: callback chạy bất đồng bộ sau khi trình duyệt chụp trạng thái cũ; tuần đích được tính từ props lúc bấm. Hai lần bấm "Tuần sau" trong cùng khung hình có thể chỉ tiến một tuần. Không tái hiện được bằng thao tác thường; không xếp finding.

---

## 5. Findings

### `REV-M6-001` — [S3] Poster ghi "0 tín chỉ" (hoặc thiếu ghi chú) khi có môn chưa rõ tín chỉ

- **File/line/artefact:** `apps/web/src/export/poster.ts:121` (`` `${input.credits} tín chỉ · ${input.courseCount} môn` ``), `:219` (`credits: view.credits.knownTotal`).
- **Failure scenario:** phương án có môn không có số tín chỉ trong dữ liệu (`course.credits === undefined`), ví dụ chỉ một môn như vậy → xuất "Poster chia sẻ (.png)".
- **Expected / actual:** quy tắc AC-M3-11 / QA-M3-008, ghi ngay trong code M6 tại `components/PlanView.tsx:118` ("unknown credits are 'chưa rõ', never counted as 0"); màn Phương án ghi "chưa rõ" và các file xuất khác dùng `creditsLine` ("Tổng tín chỉ đã biết: N (k môn chưa rõ số tín chỉ)", `export/files.ts:19-22`). Poster lại in "0 tín chỉ · 1 môn"; khi có cả môn biết và chưa biết tín chỉ, poster in tổng đã biết như thể là tổng đầy đủ.
- **Impact:** ảnh chia sẻ ghi sai số tín chỉ cho người xem; không ảnh hưởng lịch, trùng lịch hay dữ liệu lưu.
- **Evidence/repro/run ID:** đọc code; `export/poster.test.ts` chỉ kiểm `` `${view.credits.knownTotal} tín chỉ · 3 môn` `` với dữ liệu đủ tín chỉ, không có ca chưa rõ tín chỉ.
- **Recommended fix:** đưa vào `PosterInput` số môn chưa rõ tín chỉ (chỉ là số đếm, không PII) và hiển thị "chưa rõ tín chỉ" / "N tín chỉ + k môn chưa rõ" giống `PlanView`; thêm ca Vitest cho poster với môn chưa rõ tín chỉ.
- **Owner / status / due:** Frontend / open / trước G4a của bản M6.

### `REV-M6-002` — [S3] Test Vitest dài của M5 dùng timeout mặc định 5 s, đã fail một lần khi máy bận

- **File/line/artefact:** `apps/web/src/m5-ui.test.tsx:216` (`it("only carries public identifiers, even with a final Plan built from a registration file with PII and overrides", …)` không có timeout riêng). Hai ca khác cũng gần ngưỡng: `qa-m3.test.tsx` "says the credits are unknown instead of showing 0" (3 283 ms), `App.test.tsx` "requires a group, explains conflicts and updates credits" (2 831 ms).
- **Failure scenario:** chạy `npm run check` (Vitest chạy song song nhiều file) khi CPU bận.
- **Expected / actual:** test xanh ổn định. Thực tế: lần chạy `npm run check` đầu tiên của reviewer cho **exit 1**, Vitest "1 failed | 187 passed", đúng ca này; lần chạy lại exit 0. Ca này mất 4 336 ms khi chạy một mình (một file) và 4 279 ms trong lần chạy đầy đủ, sát 5 000 ms. Từ M6, ca phải mở view Thêm lớp, sheet lớp, view Phương án, sheet ĐKMH (chunk lazy) rồi lại Thêm lớp, dài hơn bản M5.
- **Impact:** CI (`npm run check` trong job `check`) có thể đỏ ngẫu nhiên, làm nhiễu evidence G2/G4a. Cùng kiểu lỗi đã sửa cho `m4-registration.test.tsx` ở PR #13/#14 (`c6d9e2b`, timeout 20 s).
- **Evidence/repro/run ID:** lệnh #2, #4, #5 ở §1.2. Log của lần #2 bị một tiến trình khác ghi chồng một phần, nên không giữ được thông báo lỗi gốc; dòng tóm tắt "Test Files 1 failed | 22 passed (23)", "Tests 1 failed | 187 passed (188)" và đường dẫn workspace của worktree reviewer còn đọc được. Vì vậy nguyên nhân "timeout" là suy luận từ thời gian chạy, chưa được chứng minh bằng thông báo lỗi.
- **Recommended fix:** đặt timeout riêng (ví dụ `20_000`, như `m4-registration.test.tsx:412`) cho ca ở dòng 216, và xem xét cho hai ca trên 2,5 s; hoặc tách ca thành hai phần (nhập ĐKMH, rồi báo lỗi).
- **Owner / status / due:** Frontend / open / trước khi merge `m6-frontend` vào `main`.

### `REV-M6-003` — [S3] Ô mờ xem trước trên desktop lộ ra cây truy cập như một buổi học thật

- **File/line/artefact:** `apps/web/src/components/WeekGrid.tsx:61-65` (nhãn `ul.day-body` đếm cả ô mờ), `:76-86` (ô mờ vẫn render `CourseBlock` với tên đầy đủ); `apps/web/src/components/CourseBlock.tsx:42,54` (tên trong `visually-hidden`, ô mờ là `div` không `aria-hidden`); `apps/web/src/components/WeekView.tsx:109-126` (`counts` của DayStrip lấy từ layout đã có ô mờ).
- **Failure scenario:** ở ≥ 1200 px, người dùng bàn phím/trình đọc màn hình focus một dòng môn ở cột trái (focus là đủ để bật xem trước sau 80 ms), rồi đọc lưới bên phải.
- **Expected / actual:** DESIGN-M6-001 §8: "`WeekGrid` bên phải vẽ ô mờ có viền nét đứt (**aria-hidden**)". Thực tế ô mờ không có `aria-hidden`; lớp chưa thêm xuất hiện trong lưới với tên đầy đủ, và nhãn ngày/DayStrip đếm nó là một buổi học. Probe (lệnh #7) với phương án rỗng, focus dòng SYN1001: `ghostAriaHidden=false`, nhãn `"Thứ 2 15/02/2027, 1 buổi học"`, DayStrip `button "Xem Thứ 2 15/02/2027, 1 buổi học"`, `listitem: SYN1001 Giải tích 1, Thứ 2, tiết 1–3 (07:00–09:40), phòng 301-G2, lớp SYN1001 1, Lý thuyết, tuần 1–15`. Ô của các lớp khác cũng nhận chữ "đang trùng lịch với …" theo plan xem trước (`partners` tính trên `gridConflicts` của ô mờ).
- **Impact:** người dùng trình đọc màn hình có thể hiểu nhầm lớp đang xem trước đã nằm trong lịch. Người nhìn màn hình không bị ảnh hưởng; ô mờ không bấm được (đúng).
- **Evidence/repro/run ID:** lệnh #7 (spec tạm đã xóa); `e2e/m6.spec.ts:456-486` chỉ kiểm class `.is-ghost`, không kiểm cây truy cập.
- **Recommended fix:** khi có `ghostKeys`, render ô mờ với `aria-hidden="true"`, không đếm ô mờ trong nhãn `day-body`/`counts`, và tính `partners` cho tên truy cập từ xung đột của plan thật; nếu cần thông báo, dùng một dòng chữ riêng như `ghost-note`. Thêm assertion `ariaSnapshot`/`aria-hidden` vào test AC-M6-10.
- **Owner / status / due:** Frontend / open / trước G4a của bản M6 (cùng đợt kiểm a11y thủ công SPEC §8).

### `REV-M6-004` — [S3] Chạm vào vùng trống bên trong sheet toàn màn sẽ đóng sheet như chạm nền

- **File/line/artefact:** `apps/web/src/components/ui/Sheet.tsx:56` (`if (event.target === event.currentTarget) props.onClose()`); `apps/web/src/styles/components/sheet.css:17-18,22` (`.sheet[open] { display: flex; flex-direction: column; }`, `.sheet.size-full { height: 92dvh; }`, `.sheet-body` không có `flex: 1`).
- **Failure scenario:** sheet `size="full"` có nội dung ngắn hơn chiều cao cố định — ví dụ sheet "Nhập kết quả đăng ký môn học (ĐKMH)" ở bước đầu (chỉ có ô chọn file) — người dùng chạm vào khoảng trống phía dưới nội dung, vẫn nằm trong khung sheet.
- **Expected / actual:** DESIGN §6: "bấm **nền** để đóng". Khoảng trống dưới `.sheet-body` là chính phần tử `dialog` (không phải `::backdrop`), nên `event.target === event.currentTarget` đúng và sheet đóng.
- **Impact:** sheet đóng ngoài ý muốn; không mất dữ liệu (chưa chọn file thì chưa có gì; khi đã có bản xem trước, nội dung thường lấp đầy sheet). Sheet `size="auto"` không bị vì cao theo nội dung.
- **Evidence/repro/run ID:** lệnh #9 (spec tạm, đã xóa): mở Phương án → "Nhập kết quả ĐKMH", click tại điểm giữa, cách đáy sheet 12 px (dưới `.sheet-body`, trong khung dialog). 360 px: dialog `y 62–780`, body `y 133–500`, click `y 768` → `stillOpen=false`. 1280 px: dialog `y 63–837`, body `y 128–354`, click `y 825` → `stillOpen=false`. Không có rule `flex` nào khác cho `.sheet-body` (đã grep `styles/`).
- **Recommended fix:** cho `.sheet-body` `flex: 1 1 auto` (vùng trống thuộc body), hoặc kiểm toạ độ click nằm ngoài `getBoundingClientRect()` của dialog thay vì so `target`.
- **Owner / status / due:** Frontend / open / có thể sau merge, trước G4a của bản M6.

### `REV-M6-005` — [S3] Tài liệu lệch với code tại `51da517` (trạng thái, layer CSS, file poster)

- **File/line/artefact:**
  - `docs/README.md:19` vẫn ghi "**F7** (Hoàn thiện) đang ở PR vào `m6-frontend`" và không nhắc PR #21 (F7, `e433f5d`) và PR #22 (sửa mốc ảnh, `51da517`) đã merge.
  - `docs/adr/ADR-0015-m6-design-system-and-local-ui-settings.md:35` (điểm 1) và `docs/evidence/M6-DESIGN-HANDOFF.md:30` (§2) còn ghi thứ tự layer "tokens → base → legacy → components → screens → print"; F7 đã xóa legacy (`styles/index.css:8`). Ghi chú F7 ở DESIGN §13 có nói, nhưng ADR không có change record cho việc này.
  - `docs/evidence/M6-DESIGN-HANDOFF.md:156` (§10) và `:192` (bảng F7) còn ghi `export/poster-lazy.ts` (`loadPoster`, `prefetchPoster`); file này không tồn tại, poster nằm trong `exporters-` (ghi chú F7 ở `:200` có nói).
  - Nhỏ: `apps/web/src/components/ExportPanel.tsx:103` ghi "F7 turns 'Ảnh' into the PNG/poster choice" (đã làm); tên bước `.github/workflows/m0-foundation.yml:108` "no visual spec yet passes" (đã có 30 mốc).
- **Failure scenario:** người đọc `docs/README.md` (nguồn trạng thái duy nhất theo CLAUDE.md §4.7) hoặc ADR-0015 để làm G3/G4a.
- **Expected / actual:** CLAUDE.md §4.7 và §6: trạng thái chỉ ghi ở README và phải đúng; contract không lệch code. Thực tế như trên.
- **Impact:** gây hiểu nhầm trạng thái F7 và kiến trúc CSS; không ảnh hưởng hành vi.
- **Evidence/repro/run ID:** `git log --oneline --first-parent origin/main..51da517`; đọc các dòng nêu trên.
- **Recommended fix:** cập nhật dòng M6 trong README (F7 merge qua PR #21, PR #22, G3 đang chạy); thêm change record ADR-0015-r3 cho điểm 1 (bỏ layer legacy) và sửa câu ở DESIGN §2/§10/bảng §13 (hoặc ghi "xem ghi chú F7"); sửa hai chú thích code/CI.
- **Owner / status / due:** Tech Lead (docs) + Frontend (comment) / open / trước khi merge `m6-frontend` vào `main`.

### `REV-M6-006` — [S3] Hai hiệu ứng của DESIGN §11 bị bỏ mà chưa có quyết định Owner

- **File/line/artefact:** `docs/evidence/M6-DESIGN-HANDOFF.md:165` (§11: đổi view mờ dần 150 ms; lớp "rơi" vào lưới trên desktop, có fallback keyframes CSS); `apps/web/src/app/motion.ts` chỉ được gọi ở `components/WeekView.tsx:131` (đổi tuần); ghi chú F7 `M6-DESIGN-HANDOFF.md:200` ("chưa làm … xem phần báo cáo của PR F7").
- **Failure scenario:** đối chiếu implementation với contract G1 đã ký.
- **Expected / actual:** CLAUDE.md §3 "Không silent scope change" và §6: thay đổi so với contract phải có decision/ghi rõ ở handoff và được chấp nhận. Thực tế chỉ có ghi chú "chưa làm" trong DESIGN §13 trỏ tới báo cáo PR (không nằm trong repo); không có dòng D-M6-x, không có Owner chấp nhận hay hạn bổ sung. AC-M6-16 (giảm chuyển động tắt hiệu ứng) vẫn đạt.
- **Impact:** thiếu một phần nhỏ của trải nghiệm thiết kế (M6-A "chuyển động"); không ảnh hưởng chức năng hay a11y.
- **Evidence/repro/run ID:** `grep -rn "withViewTransition" apps/web/src` → chỉ `app/motion.ts`, `app/motion.test.ts`, `components/WeekView.tsx`.
- **Recommended fix:** Owner chọn một trong hai: (a) chấp nhận hoãn, ghi D-M6-13 trong SPEC (hoặc dòng risk acceptance có owner và hạn) và sửa §11; (b) làm hai hiệu ứng trước G4a của bản M6 (lưu ý tổng JS chỉ còn 385 B — có thể làm bằng CSS là chính).
- **Owner / status / due:** Owner + Tech Lead / open / quyết định trước khi merge vào `main`.

### `REV-M6-007` — [S3] Code và CSS không còn chỗ dùng sau khi thay giao diện M3–M5

- **File/line/artefact:**
  - `apps/web/src/model/labels.ts:7` `PRIVACY_NOTE`: không còn file nào import (trước đây `Footer` trong `components/Chrome.tsx` đã xóa).
  - `apps/web/src/storage/local-data.ts:78` `saveSettings`: production không còn gọi (controller chuyển sang `mutateSettings`); chỉ `plan-store.test.ts` dùng. Hàm ghi đè cả bản ghi nên để lại dễ bị dùng nhầm, trái ý ADR-0015 điểm 6.
  - `apps/web/src/styles/screens/app-shell.css:69-70` `.view-week .week-picker`, `.day-section`: không phần tử nào còn class này (`WeekPicker`, danh sách "Theo ngày" của F2 đã bỏ).
  - `apps/web/src/styles/components/course-color.css:13` `.course-chip`: chỉ trang mẫu `src/gallery/main.tsx:101` dùng nhưng nằm trong CSS production.
  - `apps/web/src/components/icons.tsx:139,163` `IconPalette`, `IconUpload`: không dùng ở đâu (tree-shaking loại khỏi bundle, nên chỉ là code thừa).
- **Failure scenario:** bảo trì sau M6 (người sau tưởng còn dùng, hoặc dùng nhầm `saveSettings`).
- **Expected / actual:** reviewer.md: tìm code chết/duplicate; DESIGN §6 "bỏ … khi không còn chỗ dùng". Thực tế còn các mục trên.
- **Impact:** nhỏ; CSS thừa vài chục byte gzip trong lúc tổng ngân sách đang rất sát.
- **Evidence/repro/run ID:** script quét export/class tạm (scratchpad, không commit); xác nhận lại bằng `grep -rn` cho từng tên.
- **Recommended fix:** xóa `PRIVACY_NOTE` (hoặc dùng lại trong sheet (i) nếu muốn giữ câu này), bỏ `saveSettings` khỏi API (test dùng `idbPut`/`mutateSettings`), xóa hai rule CSS chết, chuyển `.course-chip` sang `gallery.css`.
- **Owner / status / due:** Frontend / open / sau merge, trước G4a của bản M6.

---

## 6. Observations (không xếp finding)

- **Esc trên sheet lớp xóa ô tìm (nêu trong commit `d1c8b84`):** commit sửa mốc ảnh nói "Esc closing the class sheet sometimes reached the type=search box, which Chromium clears". Probe (lệnh #7) ở 1280 px, 8 lần mở/đóng SYN1003 bằng Esc: lần nào focus cũng về đúng dòng môn và ô tìm giữ "vat ly"; mở lại ngay cùng môn đều được. Không tái hiện trên Windows. Nếu CI Linux còn gặp, nên mở issue riêng cho hành vi app thay vì chỉ sửa test.
- **Ngày hết hiệu lực trong `DataSourceSheet`** (`DataSourceSheet.tsx:44`, `formatDate(entry.expiresAt.slice(0, 10))`) lấy ngày UTC, còn câu trạng thái dùng ngày Việt Nam (`dataset-status.ts:36-39`). Với `expiresAt` trong 17:00–23:59Z, hai chỗ trong cùng một sheet lệch một ngày. Có từ M5 (`ProvenancePanel`), M6 chỉ đặt hai chỗ cạnh nhau. Nên sửa cùng đợt `REV-M6-005`.
- **Ngân sách JS:** tổng JS 162 431 / 162 816 B gzip. Mọi sửa đổi sau M6 (kể cả sửa các finding trên) có thể chạm ngưỡng; nên đo lại `verify:bundle` ở mỗi PR sửa.
- **Thông báo lưu trữ trùng chữ** dùng `notice.text` làm key (`App.tsx:65`): nhiều lần lỗi lưu cùng câu sẽ trùng key React. Có từ M5 (`origin/main:App.tsx:112`).
- **Phạm vi axe:** lịch ngày (DayView) không còn được axe kiểm ở `m4.spec.ts` và không có trong 5 màn của `m6.spec.ts`; nên thêm khi làm a11y thủ công SPEC §8.

## 7. Waivers and limitations

- **Waiver/exception:** none.
- **Limitations:**
  - Không chạy project `visual` (30 mốc ảnh, chỉ chạy trên Linux CI) và WebKit; không thử trên thiết bị thật, TalkBack/VoiceOver, Zalo/Messenger (SPEC §8 để cho Owner trước G4a).
  - `EVID-M6-001` không có trong checkout; không đối chiếu được số đo G2 với số đo của reviewer, chỉ đối chiếu với ghi chú F7 trong DESIGN §13 (khớp: JS ban đầu 117 991 B so với 117 992 B ghi trong tài liệu).
  - `REV-M6-004` tái hiện bằng chuột trên Chromium desktop (360 và 1280 px); chưa thử chạm thật trên điện thoại.
  - Không review sâu `scripts/*.mjs`, `vite.config.ts` (bundle/CSP/SW) ngoài việc chạy `verify:bundle`; phần này thuộc G3b.
  - Máy reviewer có tiến trình test của agent khác chạy cùng lúc (ảnh hưởng thời gian chạy Vitest, xem `REV-M6-002`).

## 8. Approval and re-review

- **Reviewer decision actor/date/evidence:** Independent Reviewer (agent), 2026-11-17, đề xuất `review-pass-with-follow-up` theo các lệnh ở §1.2–§1.3. Gate: `review-pass` — Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6").
- **Next owner/action:** Frontend sửa `REV-M6-002` và Tech Lead sửa `REV-M6-005` trước khi merge vào `main`; Owner quyết định `REV-M6-006`; `REV-M6-001`, `-003`, `-004`, `-007` theo dõi tới G4a của bản M6.
- **Fix commit/target:** —
- **Retest command/evidence:** `npm run check` (chạy ít nhất 3 lần liên tiếp để xác nhận `REV-M6-002`), `npm run verify:bundle`, `E2E_PORT=4383 npm run test:e2e`; thêm Vitest cho `REV-M6-001` và assertion cây truy cập cho `REV-M6-003`.
- **Finding outcomes:** `REV-M6-001…007`: `still-open`.
