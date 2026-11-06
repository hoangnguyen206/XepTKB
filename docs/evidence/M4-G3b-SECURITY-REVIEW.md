# M4 security review — Registration merge UI, local-only PII boundary, override provenance & 2-slot storage (G3b)

> **Artifact ID:** `SEC-REVIEW-M4-001`  
> **Artifact status:** `approved` — G3b độc lập R1 (`12abdbd`) + hậu kiểm R1.1 (`6fd1506`) hoàn tất và được Owner phê duyệt lúc `2026-11-06T07:30Z`; các mục S3 mức code/CI kế thừa từ M3 (`EXC-SEC-M3-R2-B` / `SEC-M3-101(e)`, `EXC-SEC-M3-R2-D` / `SEC-M3-005`, `SEC-M3-003(b/d)`) đã được đóng hoàn toàn trước hạn `2026-11-08` (`0 S0`, `0 S1`, `0 S2`, `0 S3` còn mở ở mức code/CI; chỉ còn mục vận hành `SEC-M3-007` kiểm `curl -I` trên domain production thật ở `G4a`)  
> **Canonical gate:** `G3b` (implementation verification, kèm phụ lục hậu kiểm R1.1 tại `6fd1506` và cập nhật đóng S3 kế thừa ngày `2026-11-06`)  
> **Owner:** Security Reviewer (agent role)  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [Security & privacy](../SECURITY_PRIVACY.md), [M4 spec](M4-SPEC.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [M4 design handoff](M4-DESIGN-HANDOFF.md), [M4 implementation handoff](M4-IMPLEMENTATION-HANDOFF.md), [C-09 registration review](C09-REGISTRATION-SAMPLE-REVIEW.md), [M3 G3b R2 review](M3-G3b-SECURITY-REVIEW-R2.md), [M3 evidence envelope](M3-EVIDENCE-ENVELOPE.md)  
> **Evidence envelope:** [`EVID-M4-001`](M4-EVIDENCE-ENVELOPE.md)  
> **Decision actor / UTC timestamp:** Independent Security Reviewer subagent (R1 lúc `2026-11-06T07:02:00Z` tại `12abdbd`; hậu kiểm R1.1 lúc `2026-11-06T07:20:30Z` tại `6fd1506`); được Owner (Release Manager / Tech Lead / Security) phê duyệt lúc `2026-11-06T07:30:00Z`  
> **Receiving owner / acknowledgement:** Owner (Product / Tech Lead / Release Manager), Frontend/Coder, Data Parser — acknowledged & approved (`2026-11-06T07:30:00Z`)

## Scope and identity

- **Review phase:** `G3b implementation verification` (kiểm chứng độc lập việc triển khai các kiểm soát bảo mật và quyền riêng tư của M4 theo `ADR-0013` và `SECURITY_PRIVACY.md` §§1, 2, 3, 5, 7, 9; kèm hậu kiểm R1.1 tại `6fd1506` và cập nhật đóng các mục S3 kế thừa từ M3).
- **Review type:** threat model & data-flow verification / static boundary & source audit / parser adversarial & XSS/injection probe / dependency & signature audit / privacy & IndexedDB storage review.
- **Base commit:** `3c34c89` (`main` sau khi hợp nhất M3 PR #1 và hoàn tất diễn tập `DRILL-M3-G4b-001`).
- **Target commit:**
  - **R1:** `12abdbd8bf5cd1be7988cf30a1760f811b4b4bf2` (`12abdbd` trên nhánh `m4-registration-ui`).
  - **R1.1 (sau khi sửa `SEC-M4-001` cùng các mục QA/Review):** `6fd15065aad277ba17b6bb0ceb2e0788665abcd4` (`6fd1506` trên nhánh `m4-registration-ui`; đã hợp nhất vào `main` tại `bac83bf`).
- **Source design/spec/ADR + versions:**
  - [`SPEC-M4-001`](M4-SPEC.md) (`G0`, `approved` — `FR-09`, `FR-10`, `AC-04`, `AC-05`, `AC-M4-01..08`, `Q-005`, `Q-007`, `Q-009`, `Q-010`, `D-M4-1..3`).
  - [`ADR-0013`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) (`G1`, `accepted` — ranh giới `@ky-nay/parser/registration`, pipeline loại bỏ PII trong bộ nhớ trình duyệt, áp dụng `plan.overrides` trong `resolvePlanPicks`, hiển thị `from → to`, và quản lý 2 slot `draft`/`final`).
  - [`DESIGN-M4-001`](M4-DESIGN-HANDOFF.md) (`G1`, `approved`) và [`IMPL-M4-001`](M4-IMPLEMENTATION-HANDOFF.md) (`G2`, `ready`).
- **Data boundary / actors:**
  - Sinh viên chọn file “Kết quả đăng ký môn học” (`.doc` HTML hoặc `.htm`/`.html`) từ máy cá nhân qua `<input type="file">` trong `apps/web`.
  - File gốc chứa PII nhạy cảm (`Họ và tên`, `Ngày sinh`, `Mã sinh viên`, `Chương trình đào tạo`, `Khóa`, `Học phí`, chữ ký sinh viên, cùng tên file và mã băm).
  - Ranh giới tin cậy (`Trust boundary`): byte thô của file chỉ tồn tại tạm thời trong bộ nhớ hàm `onFileChange` → `buildRegistrationPreview` → `vnuRegistrationHtmlAdapter.parse` (`localOnly: true`), bị loại bỏ toàn bộ PII trước khi dựng state xem trước (`RegistrationImportPreview`), và chỉ lưu `Plan` (`planKind: "final"`) cùng ghi chú lớp chưa khớp không chứa PII (`TermRegistrationNotes`) vào `IndexedDB` (`plans`, `settings`) sau khi sinh viên bấm xác nhận tường minh. Tuyệt đối không có request mạng phát sinh.
- **Test/tool/run IDs and versions:**
  - Toolchain: Windows 10, Node `22.22.2`, npm `12.0.2`, Vitest `5.0.3`, Playwright `1.64.0`.
  - `node scripts/lint.mjs` (AST + regex) → exit `0` (`lint: foundation and web boundary checks passed`).
  - `npm audit --omit=dev` & `npm audit` → exit `0` (`found 0 vulnerabilities`).
  - `npm audit signatures` → exit `0` (`104 packages have verified registry signatures`, `47 packages have verified attestations`).
  - `npx --workspace @ky-nay/web vitest run src/m4-registration.test.tsx` → exit `0` (`7/7` passed).
  - `npm run check` → exit `0` (`106/106` node tests bao gồm `scripts/test/lint.test.mjs` và `scripts/test/dataset-core.test.mjs`, `68/68` Vitest tests, `6/6` fixtures).
  - `npm run verify:bundle` → exit `0` (`verify-production-bundle: OK (1 JS asset(s), allowUnpublished:!1, _headers + sw.js present)`).
  - `npm run test:e2e` → exit `0` (`19/19` Playwright Chromium E2E tests với `networkGuard` ở cấp `BrowserContext`).

## Data-flow and threat checks

| Check/control | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Registration raw bytes/PII network (`AC-04`, `AC-M4-02`) | Không có bất kỳ request mạng nào khi chọn file, xem trước, xác nhận, hủy hoặc xuất file; không gửi byte thô/PII/tên file/mã băm | `apps/web` chỉ nhập `@ky-nay/parser/registration` (không phụ thuộc Node built-in hay mạng). `scripts/lint.mjs` phân tích cả TypeScript AST (`ts.createSourceFile`) và regex xác nhận `fetch` chỉ xuất hiện duy nhất tại `apps/web/src/data/loader.ts`; `0` tham chiếu tới `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `RTCPeerConnection`, `importScripts`, `new Image`/`Audio`/`Worker`/`SharedWorker`, `window.open`, `location.href`. Trong `apps/web/e2e/fixture.ts` và `apps/web/e2e/m4.spec.ts`, mọi request mạng được giám sát ở cấp `BrowserContext` cho toàn bộ 19/19 bài E2E | **pass** |
| PII stripping & zero retention in DOM / IndexedDB / exports (`AC-04`, `SECURITY_PRIVACY.md` §2) | Loại bỏ hoàn toàn họ tên, ngày sinh, mã SV, chương trình đào tạo, khóa, học phí, trạng thái, tên file, mã băm khỏi state, DOM, IndexedDB và file xuất | (1) `RegistrationImport.tsx` xóa ngay `inputEl.value = ""` sau khi đọc kích thước hoặc `arrayBuffer()` và xóa `setPreview(undefined)` nếu đọc file lỗi, không giữ `file.name` trong DOM hay React state. (2) `vnuRegistrationHtmlAdapter.ts` đặt cứng `id: "local-registration"`, `localOnly: true`, `importedAt: "1970-01-01T00:00:00.000Z"` (không có `fileName`, không băm `sha256`); chỉ đọc bảng có đủ 5 cột lịch học bắt buộc (`courseCode`, `sectionId`, `day`, `periodText`, `room`), bỏ qua hoàn toàn bảng thông tin sinh viên, khối chữ ký chân trang, cột `Trạng thái`, cột `Học phí` và dòng `Tổng`. (3) `m4-registration.test.tsx`, `e2e/m4.spec.ts` và `m4-sec-probe.mjs` kiểm tra toàn bộ `document.documentElement.innerHTML`, cả 4 object store của IndexedDB (`plans`, `datasets`, `settings`, `backups`), `console`, `.ics` và `.doc` đều không chứa bất kỳ token PII hay tên file nào | **pass** |
| Logs/Sentry/analytics scrub | Không ghi log chứa PII/nội dung file; không có tracker/analytics | Quét toàn bộ `apps/web/src`, `packages/domain`, `packages/export`, và `vnu-registration-html-adapter.ts`: `0` lệnh `console.*`. Thông báo lỗi parser (`PARSER_ISSUE_TEXT`) và cảnh báo merge (`formatMergeWarnings`) chỉ dùng chuỗi tiếng Việt cố định kèm số thứ tự dòng (`dòng N`) hoặc mã lớp từ TKB, không bao giờ in giá trị ô thô (`rawValue`) từ file người dùng | **pass** |
| Auth/RBAC/RLS/share token | N/A trong M4 (không có backend/auth/share link) | M4 chỉ xử lý cục bộ trên trình duyệt; không có trường nhập mật khẩu cổng sinh viên hay API xác thực (`SECURITY_PRIVACY.md` §1 #2, §9 #2) | **N/A** |
| File parser guards, XSS & injection (`AC-M4-01`, `AC-M4-05`, `SECURITY_PRIVACY.md` §5) | Kiểm tra kích thước/định dạng trước khi parse; không thực thi script; giới hạn thời gian xử lý; escape đầy đủ trên UI và mọi định dạng xuất (`.doc`, `.ics`, `.png`) | (1) `RegistrationImport.tsx` và `checkRegistrationBytes` chặn sớm file rỗng (`0 B`), file `> 2 MiB` (`MAX_REGISTRATION_BYTES = 2_097_152`), và kiểm tra magic bytes để từ chối `.docx`/`.zip`, `.doc` nhị phân OLE2, `.pdf` trước khi cấp phát DOM parser. (2) `decode` dùng `TextDecoder("utf-8", { fatal: true })`. (3) `@xmldom/xmldom@0.9.12` từ chối ngay payload XML entity expansion với `MALFORMED_INPUT` trong `2,38 ms`, và HTML lồng sâu `5.000` thẻ `<div>` fail-closed an toàn. (4) `splitRooms` giới hạn `MAX_ROOM_TEXT_LENGTH = 128` (`SEC-M4-001`) và bộ chọn bảng ưu tiên bảng có đủ 5 cột `REQUIRED_COLUMNS`. (5) UI chỉ render qua React text node (`0` HTML sink); `buildWordDoc` bọc `escapeHtml`; `buildIcs` bọc `escapeText` và `foldLine` (`<= 75` octets) | **pass** |
| SSRF/rate limit/budget | Không có outbound fetch từ dữ liệu người dùng | Không có hàm mạng nào được gọi từ luồng nhập file ĐKMH; CSP giữ nguyên `connect-src 'self'` | **pass** |
| Secrets/dependencies | Không lộ secret; không thêm dependency mới có lỗ hổng | `apps/web/package.json` chỉ thêm workspace dependency nội bộ `"@ky-nay/parser": "0.0.0"` (sử dụng subpath `@ky-nay/parser/registration`). `npm audit` và `npm audit --omit=dev`: `0 vulnerabilities`; `npm audit signatures`: `104` chữ ký registry hợp lệ, `47` attestations hợp lệ | **pass** |
| Artifact integrity & override precedence (`AC-05`, `ADR-0013` §2.3) | `plan.overrides` được áp dụng đúng thứ tự ưu tiên (`timetable < registration < admin-correction < user`) và giữ nguyên tính bất biến của dữ liệu TKB gốc | `resolvePlanPicks` gọi `applySectionOverrides` trên bản sao (`cloneSession`), không làm biến đổi `catalog.sections`. Mọi giá trị override đều được kiểm tra miền hợp lệ qua `validOverrideValue` trước khi áp dụng; khi nạp từ `IndexedDB`, `isPlanShape` và `isTargetedOverride` kiểm tra cấu trúc bản ghi và cách ly bản ghi hỏng sang `backups`. Khi cập nhật dataset mới, `rebasePlan` cập nhật lại `override.from`, ánh xạ lại `sessionId` tương đương (`findOverrideTargetSession`) và thông báo rõ các override không còn khớp | **pass** |
| Retention, 2-slot isolation & deletion (`Q-005`, `AC-M4-03`, `AC-M4-04`, `AC-M4-07`) | Xem trước cần xác nhận tường minh mới lưu; `draft` không bao giờ bị ghi đè; xóa riêng `final` hoặc xóa toàn bộ dữ liệu trên máy hoạt động sạch sẽ | (1) `RegistrationImportPanel` giữ `preview` trong React state cục bộ; bấm `Hủy` hoặc `Đóng` giải phóng `preview` mà không ghi `IndexedDB`. (2) `Phương án chính thức` lưu với `id = "${draftPlan.id}:final"` và `planKind = "final"`, hoàn toàn tách biệt với `Phương án nháp`. (3) Mọi thao tác ghi `settings` (`selectSlot`, `applyRegistrationImport`, `removeFinalPlan`) đều được tuần tự hóa qua `saveChainRef.current`. (4) Nút “Xóa phương án chính thức” và “Xóa dữ liệu trên máy” dọn sạch dữ liệu tương ứng và đồng bộ đa tab qua `BroadcastChannel` | **pass** |

## Findings and exceptions

### 1. Finding trong M4 (đã đóng ở R1.1 tại `6fd1506`)

| Finding ID | Severity | Scenario/impact | Evidence/repro | Fix/owner/status |
| --- | --- | --- | --- | --- |
| `SEC-M4-001` | `S3` | **Chưa giới hạn độ dài ô `Giảng đường` trước khi backtracking trong `splitRooms` và `splitRows` chọn bảng theo 1 ô khớp đơn lẻ.** | `packages/parser/src/vnu-registration-html-adapter.ts:141-151, 282-287` và `apps/web/src/m4-registration.test.tsx` | **`verified-fixed` (tại `6fd1506`):** Thêm `MAX_ROOM_TEXT_LENGTH = 128` trong `splitRooms` (`20 KB` và `60 KB` hoàn tất trong `1,86 ms` và `2,7 ms`) và ưu tiên bảng có đủ 5 cột `REQUIRED_COLUMNS` |

### 2. Trạng thái 3 gói exception S3 kế thừa từ M3 (`EXC-SEC-M3-R2-B/C/D`, đóng trước hạn `2026-11-08`)

| Exception ID | Finding liên quan | Trạng thái cập nhật ngày `2026-11-06` | Đánh giá & hành động tiếp theo |
| --- | --- | --- | --- |
| `EXC-SEC-M3-R2-B` | `SEC-M3-101(e)` (kiểm tính bất biến của artifact `published` qua lịch sử git trong CI; các mục `SEC-M3-001`, `SEC-M3-103`/`AUD-010`, `SEC-M3-101(a)-(d)` đã `verified-fixed` từ M3 R2.1) | **`verified-fixed` (ĐÃ ĐÓNG)** — `verifyBaseManifestImmutability` (`scripts/lib/dataset-core.mjs`) và `node scripts/dataset.mjs check --base <ref>` đã được tích hợp vào `.github/workflows/m0-foundation.yml` (`fetch-depth: 0`) cùng unit test trong `scripts/test/dataset-core.test.mjs` | Không còn mục tồn đọng |
| `EXC-SEC-M3-R2-C` | `SEC-M3-003(b/d)` (chuẩn hóa fail-closed `allowUnpublished` + kiểm tra bundle production trong CI) và `SEC-M3-007` (kiểm lại HTTP security headers trên domain production ở `G4a`) | **`SEC-M3-003(a)-(d)` & `SEC-M3-104`: `verified-fixed`** — `resolveBuildAllowUnpublished` (`apps/web/vite.config.ts`), `resolveSiteAllowUnpublished` (`scripts/lib/dataset-core.mjs`, `scripts/site-data.mjs`) và `scripts/verify-production-bundle.mjs` (`npm run verify:bundle` trong CI) đã đóng toàn bộ phần code/CI. Chỉ còn mục vận hành `SEC-M3-007` (`curl -I` khi gắn domain production thật ở `G4a`) | Thực hiện bước kiểm `curl -I` trong checklist `G4a` khi mở domain production ở M5 |
| `EXC-SEC-M3-R2-D` | `SEC-M3-006a` (remount `BackupList` khi wipe đa tab) và `SEC-M3-005` (chuyển `scripts/lint.mjs` sang AST + chặn mạng cấp `BrowserContext` cho mọi E2E) | **`verified-fixed` (ĐÃ ĐÓNG)** — `scripts/lint.mjs` đã nâng cấp lên TypeScript AST (`ts.createSourceFile`) + regex, bắt đủ 10/10 mẫu lách C16 (`scripts/test/lint.test.mjs`), và `apps/web/e2e/fixture.ts` áp dụng `networkGuard` cấp `BrowserContext` cho toàn bộ 19/19 bài E2E | Không còn mục tồn đọng |

## Decision

- **Decision:** **`security-approved`** cho toàn bộ code và CI của M3 + M4 (`0 S0`, `0 S1`, `0 S2`, `0 S3` còn mở ở mức code/CI; chỉ còn bước vận hành `SEC-M3-007` chạy `curl -I` kiểm tra HTTP headers khi gắn domain production thật tại cổng `G4a` của M5).
- **Actor/date/UTC:** Independent Security Reviewer subagent (`2026-11-06T07:02:00Z` R1; `2026-11-06T07:20:30Z` R1.1), được Owner phê duyệt lúc `2026-11-06T07:30:00Z` và cập nhật đóng các mục S3 kế thừa lúc `2026-11-06T07:53:00Z`.
