# M6 evidence envelope — Làm mới frontend "Lịch có màu"

> **Artifact ID:** `EVID-M6-001`  
> **Artifact status:** `approved` — G0 (`SPEC-M6-001`) Owner ký `2026-11-12T14:53Z`; G1 (`DESIGN-M6-001`, `ADR-0015`) Owner ký `2026-11-12T15:28Z`; G2 ghi nhận trên commit cố định `51da5174d29adb201bc8a9f99e08903d38d776f0` (`51da517`, nhánh tích hợp `m6-frontend`); G3a (`TEST-M6-001` → `qa-pass-with-follow-up`), G3b (`SEC-REVIEW-M6-001` → `security-pass`), G3c (`REVIEW-M6-001` → `review-pass-with-follow-up`) đã chạy độc lập trên cùng commit, mỗi role một worktree riêng; 0 S0/S1. Các finding đã sửa ở `821fc6b` và `bd0d087` (PR #23); tái kiểm định độc lập hai vòng ([`REVERIFY-M6-001`](M6-G3-FOLLOWUP-REVERIFICATION.md)) trên `bd0d087` đề xuất G3a `qa-pass` và G3c `review-pass-with-follow-up` cho phần thay đổi; REV-M6-006 (S3) Owner hoãn theo D-M6-13. **G2/G3 Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6")**: G2 `g2-ready-for-verification` trên `bd0d087` (tip `m6-frontend` `dfc3e5b` chỉ thêm tên bước workflow, 2 mốc gallery và tài liệu), G3a `qa-pass`, G3b `security-pass`, G3c `review-pass`  
> **Canonical gate/sub-gate:** `G2 | G3a | G3b | G3c` (G0/G1 đã ký, xem [docs/README.md › Trạng thái hiện tại](../README.md#trạng-thái-hiện-tại))  
> **Owner:** Tech Lead + Release Manager  
> **Last reviewed:** 2026-11-18  
> **Related docs:** [M6 spec](M6-SPEC.md), [M6 design handoff](M6-DESIGN-HANDOFF.md), [M6 plan](M6-FRONTEND-REFRESH-PLAN.md), [ADR-0015](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md), [CHANGELOG](../../CHANGELOG.md), [M5 evidence envelope](M5-EVIDENCE-ENVELOPE.md)  
> **Decision actor / UTC timestamp:** G2 ghi nhận bởi orchestrator ngày `2026-11-17` cho commit `51da517`; G3a/G3b/G3c hoàn tất kỹ thuật ngày `2026-11-17` trên `51da517`, tái kiểm định trên `bd0d087`; Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6") cho G2/G3a/G3b/G3c  
> **Receiving owner / acknowledgement:** Tester (`G3a`), Security Reviewer (`G3b`, bắt buộc theo C-6 của DESIGN-M6-001 §15), Independent Reviewer (`G3c`); Owner ký G2/G3 — **done `2026-11-18T10:49Z`**

## Source and traceability

- **Source docs/sections:**
  - [`docs/evidence/M6-SPEC.md`](M6-SPEC.md) (`SPEC-M6-001`): §3 phạm vi `M6-A`..`M6-J`, §6 quyết định `D-M6-1`..`D-M6-12`, §7 `AC-M6-01`..`AC-M6-20`.
  - [`docs/evidence/M6-DESIGN-HANDOFF.md`](M6-DESIGN-HANDOFF.md) (`DESIGN-M6-001`): §2–§12 thiết kế, §13 work package F1a–F7 kèm ghi chú triển khai từng phase, §14 rủi ro, §15 C-1..C-6 và câu trả lời của Owner.
  - [`docs/adr/ADR-0015-m6-design-system-and-local-ui-settings.md`](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md).
  - [`docs/SECURITY_PRIVACY.md`](../SECURITY_PRIVACY.md), [`docs/QA_TEST_PLAN.md`](../QA_TEST_PLAN.md), [`docs/PRD.md`](../PRD.md) §8 NFR.
- **Source version or SHA-256:**
  - Base trên `main`: `990784c7fa711343a67df1f999ad626211ceec50` (`990784c`, bản M5 giữ cho G4a; `main` chưa nhận commit M6 nào, D-M6-10).
  - Merge-base của `m6-frontend` với `main`: `c6d9e2b61e5bac1609e657ec649281381c9b2222` (`c6d9e2b`, bản sửa test chập chờn đưa vào cả hai nhánh qua PR #13/#14).
  - Brief gốc: SHA-256 `295BB158F14D9C3C23F920A0CFF7A5DBDC1B76FC88885AFE9992FBA55D650B1E`.
- **PRD requirement IDs / AC IDs:** `AC-M6-01`..`AC-M6-20` (`M6-A`..`M6-J`, đều P0 trong SPEC-M6-001 §3); hồi quy M3–M5 qua `e2e/m3.spec.ts`, `e2e/qa-m3.spec.ts`, `e2e/m4.spec.ts` (so với `main` chỉ đổi locator/bước điều hướng ở F2, F4, F5 — +24/−10 dòng; mọi `expect` về request, PII, IndexedDB, console, nội dung file giữ nguyên từng byte, G3b/G3c xác nhận), `e2e/m5.spec.ts`.
- **P0 completeness claim:** `yes` ở mức implementation (mỗi AC có test hoặc evidence ở bảng dưới), chờ G3a/G3b/G3c kiểm chứng độc lập. Các kiểm tra thủ công trước G4a của bản M6 (Safari iOS, Chrome Android, Zalo/Messenger, TalkBack/VoiceOver, poster bằng mắt — DESIGN-M6-001 §12) **chưa làm**.
- **Related ADR/design/spec/handoff/G3 IDs:** `SPEC-M6-001`, `DESIGN-M6-001`, `PLAN-M6-001`, `ADR-0015`; báo cáo G3: [`TEST-M6-001`](M6-G3a-QA-REPORT.md) (G3a), [`SEC-REVIEW-M6-001`](M6-G3b-SECURITY-REVIEW.md) (G3b), [`REVIEW-M6-001`](M6-G3c-INDEPENDENT-REVIEW.md) (G3c), [`REVERIFY-M6-001`](M6-G3-FOLLOWUP-REVERIFICATION.md) (tái kiểm định phần sửa) — đều `needs_review`.

## Immutable execution identity

- **Branch:** `m6-frontend` (nhánh tích hợp, D-M6-10). Mỗi phase là một PR vào nhánh này:

| PR | Merge commit | Nội dung |
| --- | --- | --- |
| #11 | `a202673` | F1a nền tảng: font tự host 400/800 (D-M6-12), ngân sách CSS/font/`requireSingleCss`, lint CSS, `verify-production-bundle` kiểm CSP, job CI `visual` |
| #12 | `5999c74` | F1b design system: token sáng/tối, bảng màu môn, icon, `components/ui/*`, settings giao diện (ADR-0015), gallery |
| #14 | `8a30764` | sửa test chập chờn (cùng commit `c6d9e2b` với PR #13 vào `main`) |
| #15 | `ad20235` | F2 khung app: AppBar, BottomNav, chip trạng thái, sheet (i), sheet nguồn dữ liệu |
| #16 | `9486da5` | F3 Lịch: lưới màu 360 px, DayStrip/DayView, SessionSheet, vuốt/phím |
| #17 | `d59b6c2` | chunk lazy `exporters-` (ngân sách JS, Owner đồng ý 2026-11-14) |
| #18 | `ac79f58` | F4 Thêm lớp: sheet lớp, lọc "Không trùng lịch", ô mờ desktop, Ctrl/⌘ K |
| #19 | `a1e909d` | F5 Bắt đầu & chữ: chip khóa, đếm chữ, gợi ý một lần, trạng thái rỗng |
| #20 | `31cbd72` | F6 Phương án & xuất: thanh tín chỉ, chip trùng, 4 ô xuất, sheet nhập ĐKMH |
| #21 | `e433f5d` | F7 Hoàn thiện: poster, PNG màu môn, chuyển động, bỏ `legacy.css`, 30 mốc ảnh |
| #22 | **`51da517`** | ảnh so sánh màn Phương án desktop tất định (chỉ đổi test) — **commit đích G2/G3** |

- **Diff vs `main`:** `git diff --stat 990784c 51da517` — 173 file (≈ +8 500 / −2 200 dòng) trước PR #22; `fixtures/`, `data/`, `packages/` **không đổi** so với `main`.
- **Build ID:** `ky-nay-build=0.0.0+51da517` (in bởi `verify-production-bundle`).
- **CI run IDs:** mỗi PR #11–#22 có `check`, `e2e`, `visual`, `Cloudflare Pages` xanh ở commit cuối của PR. Run sinh mốc ảnh: `44017629210` (F7) và `44052653665` (PR #22, 34 mốc giống hệt bộ đã commit). Run push của `m6-frontend` tại `51da517`: `44054059870` — `check`, `e2e`, `visual` đều **success**. Các run push trước đó tại `a1e909d`, `31cbd72` đỏ vì AC-M6-07/AC-M6-10 chập chờn, và tại `e433f5d` đỏ ở `visual` `plan-1280-dark`; cả ba nguyên nhân đã sửa trong PR #21/#22.
- **Toolchain versions:** Windows 10 (`win32 10.0.19045`), Node `v22.22.2`, npm `12.0.2`, TypeScript `5.9.3`, Vite `8.3.4`, Vitest `5.0.3`, Playwright `1.64.0`, React `19.3.0`; CI `ubuntu-24.04`.
- **Exact commands + exit codes (G2, local, trên `51da517`, 2026-11-17):**

| Lệnh | Exit | Kết quả |
| --- | ---: | --- |
| `npm run check` | `0` | lint PASS; typecheck PASS; `node:test` **153/153**; Vitest **23 file, 188/188**; `fixtures:run` **6/6**; `dataset.mjs check` OK |
| `npm run verify:bundle` | `0` | `verify-production-bundle: OK (3 JS asset(s), allowUnpublished:!1, _headers + sw.js present, ky-nay-build=0.0.0+51da517, 4 PNG icons, CSP unchanged, 4 precached woff2 + licenses.txt, no gallery, no third-party origins)`; `check-bundle-budget: OK` |
| `node scripts/secret-scan.mjs` | `0` | `346 tracked file(s), 301 scanned, 45 skipped, 0 allowlisted, 0 finding(s)` |
| `npm audit --omit=dev --audit-level=high` | `0` | `found 0 vulnerabilities` |
| `npm run test:e2e` | — | chạy ở G3a (độc lập) và trên CI; lần chạy local gần nhất trước PR #22: 53 passed, 4 skipped (chỉ project `visual`), 1 failed (AC-M6-10, race của test, đã sửa trong PR #21 và chạy lại 6/6) |

### Ngân sách (`scripts/bundle-budget.json`, gzip-9, trên `51da517`)

| Hạng mục | M5 (`main`) | M6 (`51da517`) | Ngưỡng | Kết quả |
| --- | ---: | ---: | ---: | --- |
| JS ban đầu | 108 918 B | **117 990 B** | 119 808 B (AC-M6-17: ≤ 117 KiB) | PASS |
| CSS ban đầu | 3 754 B | **7 123 B** | 12 288 B | PASS |
| JS lazy | `RegistrationImport-` 38 225 B | `RegistrationImport-` + `exporters-` = 44 443 B | mỗi chunk ≤ 43 008 B | PASS |
| Tổng JS | 147 143 B | **162 433 B** | 162 816 B | PASS — **chỉ còn 383 B** |
| Font | — | 67 424 B (4 file woff2) | 90 000 B | PASS |

## Data and artefact integrity

- **Fixture manifest + hash:** `fixtures/redacted-registration/manifest.json` SHA-256 `fe051f49a02e633851d31c536b668ff427b4b412e7290981823ce244acfa0e98` (giống M5; M6 không đổi fixture).
- **Dataset/schema/parser version:** domain schema `0.2.0`, manifest `1.0`, parser `uet-xlsx@0.2.0` — không đổi. IndexedDB `ky-nay` v1, 4 store; M6 chỉ thêm trường tùy chọn trong `settings` (`theme`, `courseColors`, `seenHints`, ADR-0015) — bản M5 bỏ qua chúng.
- **Compatibility/migration note:** không có migration; rollback về M5 giữ phương án (D-M6-10, DESIGN-M6-001 §14).

## Evidence links and results (G2, trước kiểm chứng độc lập)

| AC | Bằng chứng chính | Kết quả G2 |
| --- | --- | --- |
| AC-M6-01 theme | `e2e/m6.spec.ts` AC-M6-01, `styles/contrast.test.ts` | pass |
| AC-M6-02 font | `e2e/m6.spec.ts` AC-M6-02, `scripts/test/fonts.test.mjs` | pass |
| AC-M6-03/04 khung app, chip trạng thái | `e2e/m6.spec.ts` AC-M6-03, AC-M6-04 | pass |
| AC-M6-05..08 Lịch | `e2e/m6.spec.ts` AC-M6-05..08, `model/grid-view.test.ts` | pass |
| AC-M6-09/10 Thêm lớp | `e2e/m6.spec.ts` AC-M6-09, AC-M6-10 (2 test), `qa-m3.test.tsx` (`sectionFits`, Ctrl/⌘ K) | pass |
| AC-M6-11/12 Bắt đầu, chữ, gợi ý, trạng thái rỗng | `e2e/m6.spec.ts` AC-M6-11 (2), AC-M6-12 (3), `e2e/word-count.ts`, `f5-ui.test.tsx` | pass (79 → 20 chữ) |
| AC-M6-13/14 Phương án, xuất, nhập ĐKMH | `e2e/m6.spec.ts` AC-M6-13/14, `e2e/m3.spec.ts` AC-M3-09/10, `e2e/m4.spec.ts` (assertion privacy không đổi; F6 không sửa file) | pass |
| AC-M6-15 poster | `export/poster.test.ts` (8), `e2e/m6.spec.ts` AC-M6-13 (PNG 1080×1350) | pass; kiểm bằng mắt chưa làm |
| AC-M6-16 a11y, chuyển động | `e2e/m6.spec.ts` AC-M6-16 (axe tối 2 test, chuyển động), `e2e/gallery.spec.ts`, `app/motion.test.ts` | pass |
| AC-M6-17 ngân sách | `npm run verify:bundle` | pass |
| AC-M6-18 không bên thứ ba, CSP, offline | `verify-production-bundle`, `e2e/m6.spec.ts` AC-M6-01 (offline), `e2e/m4.spec.ts`, lint (`localStorage`, style sinks) | pass |
| AC-M6-19 ảnh so sánh | `e2e/visual.spec.ts` + 30 mốc, job `visual` | pass trên CI |
| AC-M6-20 quy trình nhánh | PR #11–#22 vào `m6-frontend`; `main` = `990784c` | pass |

## Risk and controls

- **Privacy/security impact and boundary:** không đổi network boundary (`data/loader.ts` vẫn là module mạng duy nhất), CSP không đổi một ký tự, không `localStorage`/cookie, không request bên thứ ba. Thay đổi cần G3b xét: font tự host vào SW precache; trường settings mới trong IndexedDB; poster (đầu vào `PosterInput` không có dữ liệu file ĐKMH); sheet nhập ĐKMH (chỉ đổi markup). C-6: G3b bắt buộc.
- **Findings (ID/severity/status)** — tổng hợp từ G3 và tái kiểm định (chi tiết, repro và đề xuất ở từng báo cáo):

| ID | Mức | Nội dung | Trạng thái |
| --- | --- | --- | --- |
| F-M6-QA-01 | **S2** | Ở 360 px, nút đang focus bằng bàn phím có thể nằm hẳn dưới thanh điều hướng dưới cùng (không có `scroll-padding`), trái AC-M6-16 "focus luôn thấy rõ" / WCAG 2.4.11 | **đóng** (`821fc6b`; e2e đỏ khi bỏ bản sửa) |
| F-RV-M6-01 | **S2** | (tái kiểm định vòng 1) Shift+Tab để control đang focus nằm dưới app bar dính, ở 360 và 1280 px | **đóng** (`bd0d087`, `scroll-padding-top`; e2e 3 khổ đỏ khi bỏ bản sửa) |
| REV-M6-001 | S3 | Poster ghi "0 tín chỉ" (hoặc chỉ tổng đã biết) khi có môn chưa rõ tín chỉ, trái quy tắc "chưa rõ ≠ 0" (AC-M3-11) | **đóng** (`821fc6b` + test ở `bd0d087`, F-RV-M6-02) |
| REV-M6-003 | S3 | Ô mờ xem trước trên desktop không `aria-hidden` (DESIGN §8) và được đếm trong tên ngày | **đóng** (`821fc6b`) |
| REV-M6-004 | S3 | Chạm vùng trống trong sheet cỡ full (sheet nhập ĐKMH) làm đóng sheet | **đóng** (timeout 20 s, `821fc6b`) |
| REV-M6-002 / F-M6-QA-02 | S3 | `m5-ui.test.tsx` "only carries public identifiers…" chập chờn vì timeout 5 s khi máy bận | **đóng** (9 e2e + 1 Vitest, `821fc6b`) |
| F-M6-QA-03 | S3 | Thiếu coverage tự động: axe tối cho Bắt đầu/Lịch và mọi màn ở 768; đường bàn phím ở khổ điện thoại; màu môn sau khi tải lại offline; "Tắt lọc"; sọc trùng trên lưới chính trong mốc ảnh; axe cho DayView | **đóng** (`821fc6b`, phần sót F-RV-M6-03 ở `bd0d087`) |
| REV-M6-005 / F-M6-QA-04 | S3 | Tài liệu lệch code: README (F7 "đang ở PR"), ADR-0015 điểm 1 và DESIGN §2 còn layer `legacy`, DESIGN §10/§13 còn `poster-lazy.ts`, `QA_TEST_PLAN` chưa có M6, hai comment cũ | **đóng** (`821fc6b`; `.course-chip` giữ có chú thích — chỉ gallery dùng, một file CSS) |
| REV-M6-006 | S3 | Hai hiệu ứng §11 (mờ khi đổi view, lớp "rơi" vào lưới) chưa làm | **đóng bằng quyết định** — Owner hoãn sang sau M6 (D-M6-13, chat 2026-11-18; SPEC-M6-001 §6, DESIGN-M6-001 §11) |
| REV-M6-007 | S3 | Code/CSS chết: `PRIVACY_NOTE`, `saveSettings`, `.week-picker`/`.day-section`, `.course-chip`, `IconPalette`/`IconUpload` | mở |
| OBS-M6-01..04 | — | G3b: `verify-production-bundle` chỉ quét JS; `wipe` không chờ hàng đợi lưu settings (có từ trước M6); poster hiển thị phòng sau override (đúng ADR-0013, cần làm rõ chữ trong §10); CI action pin theo tag | ghi nhận |

- Ghi nhận khác: tổng JS chỉ còn 234 B (162 582 B / 162 816 B trên `bd0d087`); `scroll-padding-top: 120px` là hằng số theo chiều cao app bar (OBS-RV-06, test e2e bắt khi app bar cao thêm); kiểm tra thủ công trên thiết bị thật (Safari iOS, Chrome Android, Zalo/Messenger, TalkBack/VoiceOver, poster bằng mắt) chưa làm.
- **Waiver/exception:** `none` ở G2.
- **Rollback/migration trigger and target:** revert merge M6 trên `main` (khi đã merge) hoặc giữ `main` = `990784c`; không migration dữ liệu.
- **Monitoring/canary/alert evidence:** `N/A — chưa deploy production`.

## Remediation sau G3 (PR #23)

| Commit | Nội dung | Kiểm chứng |
| --- | --- | --- |
| `821fc6b` | sửa F-M6-QA-01, REV-M6-001..005/007, F-M6-QA-02..04; thêm 9 e2e + 1 Vitest | local: `npm run check` 0 (Vitest 190/190), `verify:bundle` 0, `test:e2e` 0 (63 passed, 4 skipped); tái kiểm định vòng 1 → tìm thêm F-RV-M6-01 (S2), F-RV-M6-02/03 (S3) |
| **`bd0d087`** | sửa F-RV-M6-01..03 | local: `npm run check` 0 (190/190), `verify:bundle` 0 (JS ban đầu 118 088 B, CSS 7 128 B, tổng JS 162 588 B), `test:e2e` 0 (66 passed, 4 skipped); tái kiểm định vòng 2 độc lập: `check` 0, `verify:bundle` 0, `test:e2e` 0 (66 passed, 4 skipped), mỗi test mới đỏ khi tạm bỏ bản sửa |

| `aa79b3c` | sửa tên step `visual` trong workflow (`: ` trong scalar YAML làm workflow không chạy được — lỗi do chính PR này gây ra ở `821fc6b`) | YAML hợp lệ; CI chạy lại |
| `9daa10c` | 2 mốc `gallery-360-*` mới vì gallery liệt kê mọi icon (bỏ `IconPalette`/`IconUpload`) | sinh bởi run `44129870962` (`update-snapshots`), chỉ 2 mốc đổi, đã xem diff (chỉ vùng "Biểu tượng"); CI của PR trên `9daa10c`: `check`, `e2e`, `visual`, `Cloudflare Pages` đều success |

`e2e/m4.spec.ts` không đổi trong PR #23. Đề xuất cho phần thay đổi `51da517..bd0d087` (gate mở lại theo AGENT_WORKFLOW): G3a `qa-pass`, G3c `review-pass-with-follow-up` (chỉ còn REV-M6-006); G3b không mở lại vì không đổi boundary (CSS, test, tài liệu, nhãn poster).

## Decision and next step

- **Recommendation/gate decision:** G2 `g2-ready-for-verification` trên `51da517`, cập nhật bởi PR #23 (`bd0d087`); G3a `qa-pass-with-follow-up` → sau sửa `qa-pass`; G3b `security-pass`; G3c `review-pass-with-follow-up` → với D-M6-13 (Owner hoãn REV-M6-006), điều kiện nêu ở `REVERIFY-M6-001` đã thỏa, `review-pass`. **Owner ký `2026-11-18T10:49Z` (chat: "Ký G2/G3 M6"): G2 `g2-ready-for-verification`, G3a `qa-pass`, G3b `security-pass`, G3c `review-pass`.**
- **Conditions/follow-up owner + due date:** REV-M6-006 đã có quyết định (D-M6-13, hoãn); PR #23 đã merge (`5ecf11c`, CI push run `44136477700` xanh); sau khi Owner ký G2/G3, một lần merge `m6-frontend` → `main` (D-M6-10). Trước G4a của bản M6: kiểm tra thủ công trên thiết bị thật (SPEC/DESIGN §12) và `SEC-M3-007` (header production).
- **Next owner action:** G2/G3 đã ký (PR #25, `053d416`); `m6-frontend` đã merge vào `main` qua PR #26 (`2058ec3`, D-M6-10). Tiếp theo: kiểm thủ công trên thiết bị thật rồi G4a.
- **Notes:** báo cáo do agent viết được quét máy mọi định danh/đường dẫn trong backtick so với commit đích trước khi đưa vào đây.
