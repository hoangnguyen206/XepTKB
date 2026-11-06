# Test report — M4 Registration merge UI (G3a QA verification)

> **Artifact ID:** `TEST-M4-001`  
> **Artifact status:** `needs_review`  
> **Canonical gate:** `G3a`  
> **Owner:** Tester  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [M4 spec](M4-SPEC.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [M4 design handoff](M4-DESIGN-HANDOFF.md), [M4 implementation handoff](M4-IMPLEMENTATION-HANDOFF.md), [QA test plan](../QA_TEST_PLAN.md), [PRD](../PRD.md), [Security & privacy](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** `EVID-M4-001` ([M4-EVIDENCE-ENVELOPE.md](M4-EVIDENCE-ENVELOPE.md))  
> **Tester sign-off actor / UTC timestamp:** Independent Tester subagent (`G3a`), not a human sign-off / `2026-11-06T06:57:00Z` (Pending human Owner sign-off)

## Scope and immutable identity

- **Source spec/PRD/ADR + versions:**
  - [`SPEC-M4-001`](M4-SPEC.md) (`in-review`, `G0`, `AC-M4-01`..`AC-M4-08`, `D-M4-1`..`D-M4-3`)
  - [`ADR-0013`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) (`in-review`, `G1`)
  - [`DESIGN-M4-001`](M4-DESIGN-HANDOFF.md) (`in-review`, `G1`)
  - [`IMPL-M4-001`](M4-IMPLEMENTATION-HANDOFF.md) (`needs_review`, `G2`)
  - [`PRD.md`](../PRD.md) §4 P0 #7, #9, #10; §6 `FR-09`, `FR-10`; §7 `AC-04`, `AC-05`; §8 `NFR-03`, `Q-005`, `Q-007`, `Q-009`, `Q-010`
  - [`QA_TEST_PLAN.md`](../QA_TEST_PLAN.md) §2, §4, §5, §7 (`G3a`), §8
- **Base/target commit/build/diff:**
  - Base commit: `3c34c89` (`main`)
  - Target commit: `12abdbd` (`m4-registration-ui`, 29 files changed, `+2236 / -76`)
- **Dataset/parser/schema version:**
  - Domain schema: `0.2.0`
  - Plan storage record version (`PLAN_RECORD_VERSION`): `0.2.0`
  - Registration parser: `vnu-registration-html@0.2.0` (subpath `@ky-nay/parser/registration`)
  - Synthetic web dataset: `synthetic-uet-2026-2027-h2.1` / `synthetic-uet-2026-2027-h1.1`
- **Fixture manifest + hash:** [`fixtures/manifest.json`](../../fixtures/manifest.json) (6/6 passed):
  - `registration-portal-format-redacted` (`fixtures/redacted-registration/portal-format.doc`): sha256 `4937d9964e2c64112e58b8bf753c5966a55f3982dfdb4cf0f46b7d484d959fb4`
  - `registration-local-synthetic` (`fixtures/synthetic/registration-local.html`): sha256 `357da7470b18dd26386c16bdcc5537c213fd9e3b875645e29cb5b19b2651f8c3`
- **Environment/device/browser:** Windows 10 (`win32`), PowerShell; Playwright Chromium headless (`1.64.0`) trên bản build production (`dist-e2e`, port `4380`).
- **Runner/tool versions:** Node `22.22.2`, npm `12.0.2`, TypeScript `5.9.3`, Vite `8.3.4`, Vitest `5.0.3`, Playwright `1.64.0`, `@axe-core/playwright` `4.13.0`.
- **Test run IDs/links:** Local independent verification runs `task-43` (`npm run check`) và `task-55` (`npm run test:e2e`) tại commit `12abdbd`.
- **Exact commands + exit codes:**
  - `npm run check` → exit `0`
  - `npm run test:e2e` → exit `0`
- **Requirement/AC/P0 coverage:** all committed P0 covered? `yes` cho phạm vi M4 (`FR-09`, `FR-10`, `AC-04`, `AC-05`, `AC-M4-01`..`AC-M4-08`); `no` cho toàn bộ sản phẩm MVP cho tới khi hoàn tất M5 (`G4a/G4b/G5`) và kiểm thử thiết bị vật lý Tier 1.

## Scope and risk focus

- **Features/requirements:**
  - Bộ chọn file kết quả ĐKMH (`.doc` HTML / `.htm` / `.html`) với giới hạn `<= 2 MiB` và kiểm tra magic bytes từ chối `.docx` (ZIP), `.doc` nhị phân (OLE2), `.pdf`, file rỗng (`AC-M4-01`, `FR-09`).
  - Xử lý hoàn toàn cục bộ trong bộ nhớ trình duyệt (`localOnly: true`), loại bỏ toàn bộ PII (họ tên, ngày sinh, MSSV, khóa, CTĐT, học phí, tên file) và không phát sinh bất kỳ request mạng nào (`AC-M4-02`, `AC-04`).
  - Khung Xem trước (Preview) hiển thị lớp khớp TKB, chi tiết thay đổi `from → to`, lớp/buổi không khớp và cảnh báo trước khi xác nhận hoặc hủy (`AC-M4-03`, `FR-09`).
  - Quản lý 2 slot phương án độc lập (`Phương án nháp` và `Phương án chính thức`), kế thừa nhóm/tuần 1 (`D-M4-1`), chọn nhóm trực tiếp cho lớp `GROUP_REQUIRED`, nhập lại hoặc xóa riêng `Phương án chính thức` (`AC-M4-04`, `AC-M4-06`, `AC-M4-07`, `Q-005`).
  - Áp dụng `plan.overrides` trong `resolvePlanPicks` (`@ky-nay/domain`) và hiển thị nhãn `"Đã đổi…"` kèm chi tiết `từ TKB → sang ĐKMH` trên lưới tuần, lịch ngày, tóm tắt phương án, bản in và file xuất `.ics`/`.doc` (`AC-M4-05`, `AC-05`, `FR-10`).
  - Khả năng tiếp cận WCAG 2.1 A/AA và hiển thị responsive tại `360px`, `768px`, `1200px` (`AC-M4-08`).
- **Highest-risk scenarios:**
  - Rò rỉ PII từ file `.doc` ĐKMH qua network, Service Worker, `DOM`, `IndexedDB`, `console`, hoặc file xuất (`.ics`, `.doc`).
  - False-negative conflict khi buổi học trong `Phương án chính thức` đổi thứ/tiết theo ĐKMH và được tải lại từ `IndexedDB`.
  - Ghi đè hoặc làm hỏng `Phương án nháp` khi xem trước, xác nhận, nhập lại hoặc xóa `Phương án chính thức`.
  - Mất `overrides` khi rebase `Phương án chính thức` sang phiên bản dataset TKB mới.
- **Out of scope:** Chỉnh sửa thủ công từng buổi (`source = "user"`), đồng bộ tự động cổng đào tạo, nhiều hơn 2 slot phương án (`P1`), vận hành/release M5 (`G4a/G4b/G5`).

## Commands and summary

| Suite/command | Tool/run ID | Exit code | Result | Count | Evidence link |
| --- | --- | ---: | --- | --- | --- |
| `npm run check` (`lint`) | `node scripts/lint.mjs` (`task-43`) | `0` | `pass` | Foundation + web boundary rules passed | [`scripts/lint.mjs`](../../scripts/lint.mjs) |
| `npm run check` (`typecheck`) | `tsc` (`task-43`) | `0` | `pass` | All packages + `apps/web` (`tsconfig*.json`) | [`tsconfig.build.json`](../../tsconfig.build.json) |
| `npm run check` (`node:test`) | `scripts/run-node-tests.mjs` (`task-43`) | `0` | `pass` | `102/102` passed (`domain`, `parser`, `export`) | [`registration-merge.test.ts`](../../packages/domain/test/registration-merge.test.ts), [`export.test.ts`](../../packages/export/test/export.test.ts) |
| `npm run check` (`vitest`) | `vitest run` (`task-43`) | `0` | `pass` | `65/65` passed (8 test files) | [`m4-registration.test.tsx`](../../apps/web/src/m4-registration.test.tsx) |
| `npm run check` (`fixtures:run`) | `run-fixtures.js` (`task-43`) | `0` | `pass` | `6/6` fixtures passed | [`fixtures/manifest.json`](../../fixtures/manifest.json) |
| `npm run check` (`dataset check`) | `scripts/dataset.mjs check` (`task-43`) | `0` | `pass` | `0 datasets (0 published)` | `scripts/dataset.mjs` |
| `npm run test:e2e` | Playwright Chromium (`task-55`) | `0` | `pass` | `19/19` passed (`m3.spec.ts` 13, `m4.spec.ts` 2, `qa-m3.spec.ts` 4) | [`apps/web/e2e/m4.spec.ts`](../../apps/web/e2e/m4.spec.ts) |

## Requirement/AC matrix

| Requirement/AC/P0 | Test case | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| `AC-M4-01` (`FR-09`, `Q-007`) — Bộ chọn file, chặn định dạng/kích thước & cảnh báo in-app browser | `m4-registration.test.tsx` (`rejects empty, >2 MiB, .docx, binary .doc, .pdf and table-less HTML`); `e2e/m4.spec.ts` (`.docx` rejection); kiểm tra code `RegistrationImport.tsx:90-94` | Chấp nhận `.doc`/`.htm`/`.html` `<= 2 MiB`; từ chối file rỗng, `> 2 MiB`, `.docx` ZIP, `.doc` OLE2, `.pdf`, HTML không có bảng với thông báo tiếng Việt rõ ràng; hiện cảnh báo khi `isInAppBrowser()` | Mọi trường hợp file rỗng, `> 2 MiB`, `.docx`, `.doc` OLE2, `.pdf`, HTML không bảng đều bị chặn sớm với thông báo tiếng Việt chuẩn; `RegistrationImportPanel` gọi `isInAppBrowser()` hiển thị `Notice` cảnh báo (chưa có test UI riêng giả lập UA trong `RegistrationImportPanel`, xem `QA-M4-003`) | `pass` | [`registration.ts`](../../apps/web/src/model/registration.ts), [`m4-registration.test.tsx`](../../apps/web/src/m4-registration.test.tsx) |
| `AC-M4-02` (`AC-04`, `FR-09`, `NFR-03`) — Xử lý local-only & zero PII | `m4-registration.test.tsx` (`portal-format.doc` + UI DOM/IDB scan); `e2e/m4.spec.ts` (`postImportRequests === []`, quét DOM/IDB/console/`.ics`/`.doc`); `scripts/lint.mjs` | 0 network request khi chọn file, xem trước, xác nhận, xuất lịch; 0 chuỗi PII / tên file / mã băm trong React state, `DOM`, `IndexedDB`, `console`, hay file xuất | `postImportRequests` = `[]` (kể cả sau khi Service Worker active); `inputEl.value = ""` xóa ngay tên file; quét 16 token PII trong `portal-format.doc` và E2E fixture đều không xuất hiện trong `DOM`, 4 store `IndexedDB`, `console`, `.ics`, `.doc` | `pass` | [`e2e/m4.spec.ts`](../../apps/web/e2e/m4.spec.ts), [`m4-registration.test.tsx`](../../apps/web/src/m4-registration.test.tsx) |
| `AC-M4-03` (`FR-09`, `AC-04`) — Xem trước (Preview) trước khi xác nhận & Hủy an toàn | `m4-registration.test.tsx` (upload → kiểm tra preview → bấm `Hủy` → kiểm tra không tạo slot `final`); `e2e/m4.spec.ts` | Hiện số lớp khớp, danh sách thay đổi `from → to`, lớp không khớp và lưu ý; bấm `Hủy` không ghi vào `IndexedDB` và không đổi `Phương án nháp` | Preview hiển thị đúng `2 lớp khớp TKB · 3 thay đổi phòng/giờ/tuần · 1 lớp không khớp`; bấm `Hủy` đóng bảng và không tạo `Phương án chính thức` | `pass` | [`RegistrationImport.tsx`](../../apps/web/src/components/RegistrationImport.tsx), [`m4-registration.test.tsx`](../../apps/web/src/m4-registration.test.tsx) |
| `AC-M4-04` (`Q-005`) — Hai slot `draft` và `final` độc lập, lưu bền vững qua reload | `m4-registration.test.tsx` + `e2e/m4.spec.ts` (chuyển đổi `Phương án nháp (1)` ↔ `Phương án chính thức (2)` và `page.reload()`) | Tạo/cập nhật `Phương án chính thức` giữ nguyên `Phương án nháp`; chuyển qua lại giữa 2 slot và giữ nguyên slot đang chọn sau khi reload | `Phương án nháp` giữ nguyên lớp đã chọn (`SYN4001 1` / `SYN2004 1`); sau khi reload trang vẫn mở đúng `Phương án chính thức` kèm đầy đủ `overrides` và cảnh báo `unmatched` | `pass` | [`controller.ts`](../../apps/web/src/app/controller.ts), [`Workspace.tsx`](../../apps/web/src/components/Workspace.tsx), [`e2e/m4.spec.ts`](../../apps/web/e2e/m4.spec.ts) |
| `AC-M4-05` (`AC-05`, `FR-10`) — Áp dụng `plan.overrides` & gắn nhãn `"Đã đổi…"` kèm `from → to` | `registration-merge.test.ts`, `export.test.ts`, `m4-registration.test.tsx`, `e2e/m4.spec.ts` | Giá trị từ ĐKMH thắng trên lưới tuần, lịch ngày, kiểm tra trùng lịch và mọi file xuất; hiển thị nhãn `Đã đổi phòng`/`Đã đổi giờ` và chi tiết `from → to` | `resolvePlanPicks` áp dụng `applySectionOverrides` đúng thứ tự ưu tiên (`registration < admin-correction < user`); `WeekGrid`, `DayList`, `PlanSummary`, `PrintSheet`, `.ics`, `.doc` hiển thị nhãn `Đã đổi…` và `from → to`. Riêng ảnh `.png` vẽ đúng phòng/giờ mới nhưng chưa in dòng badge `"Đã đổi…"` trên ô lưới (`QA-M4-002`, S3) | `pass with follow-up` | [`plan.ts`](../../packages/domain/src/plan.ts), [`schedule.ts`](../../packages/export/src/schedule.ts), [`png.ts`](../../apps/web/src/export/png.ts) |
| `AC-M4-06` (`FR-09`, `FR-10`, `D-M4-1`, `D-M4-3`) — Cảnh báo lớp không khớp (`unmatched`) & chọn nhóm trực tiếp (`GROUP_REQUIRED`) | `m4-registration.test.tsx` (kế thừa nhóm từ `draftPlan`, cảnh báo `unmatched`, chọn nhóm trực tiếp trong `PlanSummary` giữ nguyên `overrides`); `e2e/m4.spec.ts` | Lớp `unmatched` không bị chèn mù vào `picks`, hiển thị cảnh báo ở cả Preview và `PlanSummary` của `Phương án chính thức`; chọn nhóm trực tiếp giải quyết `GROUP_REQUIRED` mà không mất `overrides` | Đúng hoàn toàn: `INT9999 1` / `MAT9999 1` / `UNMATCHED999 1` chỉ nằm trong `registrationNotes.unmatched`; chọn `Nhóm 2` cho `SYN1001 1` trong `PlanSummary` xóa cảnh báo `1 lớp cần xử lý` và giữ nguyên override phòng của `SYN1003 1` | `pass` | [`PlanSummary.tsx`](../../apps/web/src/components/PlanSummary.tsx), [`m4-registration.test.tsx`](../../apps/web/src/m4-registration.test.tsx) |
| `AC-M4-07` — Nhập lại (Re-import), Rebase & Xóa dữ liệu | `registration-merge.test.ts` (re-import + user override precedence); `m4-registration.test.tsx` (rebase drop redundant override + xóa `Phương án chính thức`) | Nhập lại thay thế override `registration` cũ; xóa `Phương án chính thức` quay về `Phương án nháp`; `wipeLocalData` xóa sạch `plans` và `settings` | Xóa `Phương án chính thức` và re-import hoạt động đúng khi `session.id` giữ nguyên. Tuy nhiên khi dataset TKB mới đổi `session.id` (do dịch dòng `.xlsx`), `rebasePlan` làm rơi `overrides` mà `rebasePreview` không cảnh báo (`QA-M4-001`, S2) | `pass with follow-up` | [`plan-view.ts`](../../apps/web/src/model/plan-view.ts), [`m4-registration.test.tsx`](../../apps/web/src/m4-registration.test.tsx) |
| `AC-M4-08` — Accessibility WCAG 2.1 A/AA & Responsive `360px`/`768px`/`1200px` | `e2e/m4.spec.ts` (`AC-M4-08 — no horizontal overflow and zero serious/critical axe violations at 360/768/1200 px`) | Không tràn ngang trang (`pageOverflow <= 0`) và 0 lỗi axe `serious`/`critical` ở cả `360px`, `768px`, `1200px` trên bảng Preview và 3 tab của `Phương án chính thức` | `pageOverflow <= 0` và `axeSerious = []` tại cả 3 viewport `360`, `768`, `1200` trên mọi trạng thái kiểm tra | `pass` | [`e2e/m4.spec.ts`](../../apps/web/e2e/m4.spec.ts) |

## Quality checks

| Area | Expected/control | Actual/evidence | Result |
| --- | --- | --- | --- |
| Privacy/network/log/Sentry | Không gửi network request khi nhập ĐKMH; không lưu PII, tên file hoặc hash vào DOM/IDB/console/exports | `scripts/lint.mjs` chặn import ngoài `@ky-nay/parser/registration` và chặn mọi network API ngoài `loader.ts`; Playwright E2E xác nhận `postImportRequests = []` và 0 token PII trong DOM, IndexedDB, console, `.ics`, `.doc` | `pass` |
| Security/auth/RBAC/share/file | Chặn file rỗng, `> 2 MiB`, `.docx` ZIP, `.doc` OLE2, `.pdf`; chống XSS trong HTML ĐKMH | `checkRegistrationBytes` kiểm tra kích thước + magic bytes trước khi parse DOM; `@xmldom/xmldom` không thực thi script; payload `<script>evil()</script>` trong `m4-registration.test.tsx` chỉ hiển thị dạng text | `pass` |
| Accessibility/keyboard/contrast | WCAG 2.1 A/AA (0 lỗi `serious`/`critical`), điều khiển được bằng bàn phím, nhãn form/region đầy đủ | `@axe-core/playwright` đạt 0 violation `serious`/`critical` ở `360/768/1200px`; các nút chuyển slot có `aria-pressed`, nút mở bảng nhập có `aria-expanded`, vùng preview có `role="region"` + `aria-labelledby` | `pass` |
| Responsive/mobile/desktop | Không tràn ngang ở `360px`, `768px`, `1200px` | Đã kiểm chứng tự động bằng Playwright ở `360×780`, `768×1024`, `1200×900` (`e2e/m4.spec.ts:245-274`) | `pass` |
| Offline/cache/update | Lưu `Phương án chính thức` và `registrationNotes` trong IndexedDB; đồng bộ đa tab qua `BroadcastChannel` | Reload giữ nguyên `Phương án chính thức`, `activeSlots` và `registrationNotes`; xóa dữ liệu thiết bị xóa toàn bộ `plans` và `settings` | `pass` |
| Export/calendar | `.ics`, `.doc`, `.png`, bản in phản ánh đúng phòng/giờ/tuần sau override từ ĐKMH | `.ics`, `.doc`, `PrintSheet` có đầy đủ phòng/giờ mới và ghi chú `from → to`; `.png` có đúng phòng/giờ mới nhưng thiếu dòng badge `"Đã đổi…"` (`QA-M4-002`, S3) | `pass with follow-up` |
| Performance budgets | Phân tích cú pháp file ĐKMH không gây treo UI | Toàn bộ bài test E2E M4 (gồm dựng phương án, nạp `.doc`, preview, confirm, kiểm tra 3 tab, xuất `.ics`/`.doc`, reload) chạy hoàn tất trong `1.4s` | `pass` |

## Findings

| Finding ID | Severity | Repro/evidence | Impact | Owner/status/expiry |
| --- | --- | --- | --- | --- |
| `QA-M4-001` | `S2` | Xem chi tiết 1 bên dưới (`apps/web/src/model/plan-view.ts:91-124`, `packages/parser/src/uet-xlsx-adapter.ts:457`) | Khi nhà trường phát hành phiên bản TKB `.xlsx` mới có chèn/xóa dòng làm đổi `sourceRow` (nên đổi `session.id`), `rebasePlan` trên `Phương án chính thức` âm thầm bỏ các `overrides` không khớp `sessionId` cũ mà `StalePlanNotice` (`rebasePreview`) không cảnh báo. Workaround sẵn có: bấm `"Cập nhật từ file ĐKMH"` để nạp lại file ĐKMH | **Owner:** Frontend/Coder + Tech Lead · **Status:** `open` (mitigated bởi banner stale + nút `"Cập nhật từ file ĐKMH"`) · **Expiry:** `2026-11-15` (trước `G4a`) |
| `QA-M4-002` | `S3` | Xem chi tiết 2 bên dưới (`apps/web/src/export/png.ts:125-132` vs `SPEC-M4-001` `AC-M4-05`) | Khi xuất ảnh `.png` từ `Phương án chính thức`, ô lưới trên ảnh vẽ đúng thứ/tiết và phòng học mới theo ĐKMH nhưng không in dòng nhãn `"Đã đổi phòng"` / `"Đã đổi giờ"` như trên `WeekGrid` web và bản in | **Owner:** Frontend/Coder · **Status:** `open` · **Expiry:** `2026-11-15` (trước `G4a`) |
| `QA-M4-003` | `S3` | Xem chi tiết 3 bên dưới (`apps/web/src/components/RegistrationImport.tsx:78-81`, `apps/web/src/m4-registration.test.tsx`, `apps/web/e2e/m4.spec.ts`) | (a) Khi `readFileBytes` ném lỗi trong khối `catch`, `RegistrationImportPanel` chưa xóa `preview` của lần chọn file trước đó; (b) Chưa có test UI riêng cho nút `"Cập nhật từ file ĐKMH"` (re-import trên UI khi đã có `finalPlan`) và banner `isInAppBrowser()` bên trong `RegistrationImportPanel` | **Owner:** Frontend/Coder + Tester · **Status:** `open` · **Expiry:** `2026-11-15` (trước `G4a`) |

S0/S1 luôn block. S2/S3 chỉ pass-with-follow-up khi có risk acceptance, owner, mitigation và expiry. Không có lỗi `S0` hoặc `S1` nào trong M4.

### Chi tiết các phát hiện (Finding details)

1. **`QA-M4-001` (S2) — `rebasePlan` và `rebasePreview` chưa cảnh báo hoặc ánh xạ lại khi `plan.overrides` bị rơi do `session.id` thay đổi giữa hai phiên bản TKB:**
   - **Bằng chứng mã nguồn:** Trong `packages/parser/src/uet-xlsx-adapter.ts:457`, mỗi buổi học từ file Excel được gán `id = "${section.id}:${record.sourceRow}:${range.startPeriod}-${range.endPeriod}"`. Trong `apps/web/src/model/plan-view.ts:106-114`, `rebasePlan` tìm buổi học gốc bằng `section?.sessions.find((session) => session.id === override.target.sessionId)` và bỏ qua (`continue`) nếu không tìm thấy. Đồng thời `rebasePreview` (`plan-view.ts:91-99`) chỉ trả về `{ removed, groupCleared, needsGroup }` mà không kiểm tra số `overrides` bị rơi.
   - **Tác động & Giảm thiểu (Mitigation):** Nếu trường phát hành file Excel TKB mới có thêm/bớt dòng phía trên làm dịch `sourceRow`, sinh viên bấm `"Cập nhật phương án"` trên `Phương án chính thức` sẽ thấy thông báo `"Mọi lớp và nhóm đã chọn vẫn còn trong dữ liệu mới"` nhưng các `overrides` từ ĐKMH bị rơi về giá trị TKB mới. Giảm thiểu hiện tại: banner `StalePlanNotice` đã nhắc `"Hãy kiểm tra lại phòng/giờ các lớp đã chọn"` và sinh viên có thể bấm ngay nút `"Cập nhật từ file ĐKMH"` để ghép lại theo `day`/`periods`.
   - **Khuyến nghị sửa:** Trong `rebasePreview` / `StalePlanNotice`, liệt kê các lớp có thay đổi từ ĐKMH cần nạp lại file ĐKMH khi `baseSession` không còn khớp `sessionId` (hoặc ghép fallback theo `day`/`startPeriod`/`endPeriod`/`group` trong `rebasePlan`).

2. **`QA-M4-002` (S3) — Xuất ảnh `.png` (`renderPng`) chưa vẽ nhãn `"Đã đổi…"` trên ô lưới:**
   - **Bằng chứng mã nguồn:** `apps/web/src/export/png.ts:125-132` chỉ dựng 4 dòng văn bản (`courseCode`, `courseName`, `kind/group`, `room`) mà chưa đọc `block.session.overrides` để hiển thị badge `"Đã đổi phòng"` / `"Đã đổi giờ"` hoặc ghi chú ở chân ảnh như `WeekGrid` (`Schedule.tsx:110`), `PrintSheet` (`Workspace.tsx:42`), `buildWordDoc` (`word.ts:30`) và `buildIcs` (`ics.ts:84`).
   - **Khuyến nghị sửa:** Bổ sung dòng badge `block.session.overrides` vào `renderPng` hoặc thêm tóm tắt thay đổi từ ĐKMH vào `footerLines` khi xuất PNG từ `Phương án chính thức`.

3. **`QA-M4-003` (S3) — Xóa `preview` cũ khi đọc file lỗi trong `RegistrationImportPanel` và bổ sung test UI cho nhánh re-import / in-app browser:**
   - **Bằng chứng mã nguồn:** Tại `apps/web/src/components/RegistrationImport.tsx:78-81`, khối `catch` khi `readFileBytes(file)` thất bại chỉ gọi `setReadingError(...)` mà chưa gọi `setPreview(undefined)`. Ngoài ra, `m4-registration.test.tsx` và `e2e/m4.spec.ts` mới kiểm thử re-import ở tầng domain (`registration-merge.test.ts:105-116`) mà chưa bấm luồng `"Cập nhật từ file ĐKMH"` → `"Xác nhận cập nhật Phương án chính thức"` trên giao diện.

## Limitations and skipped tests

| Test | Why skipped | Owner | Due/expiry | Re-entry trigger |
| --- | --- | --- | --- | --- |
| Kiểm thử thủ công trên thiết bị thật Tier 1 (Safari iOS, Chrome Android) và trình duyệt nhúng thật (Zalo, Messenger, Facebook) | Môi trường kiểm thử hiện tại chỉ chạy headless Chromium trên Windows 10 | Owner + Tester | Trước `G4a` (`2026-11-15`) | Khi chuẩn bị phát hành M5 / `G4a` |
| Chạy `test:real` với thêm nhiều file Kết quả ĐKMH thực tế của các học kỳ khác ngoài repo | Theo chính sách bảo mật PII (`QA_TEST_PLAN.md` §3), file thật chứa PII không lưu trong repo; trong repo đã kiểm thử với `fixtures/redacted-registration/portal-format.doc` | Owner / Data Reviewer | Trước `G4a` (`2026-11-15`) | Khi có mẫu file ĐKMH học kỳ mới |
| Kiểm tra bằng mắt bản xuất `.png`, `.doc` mở trong MS Word và nhập `.ics` vào ứng dụng lịch thực tế từ `Phương án chính thức` | Đã kiểm chứng tự động nội dung văn bản `.ics`/`.doc` và cấu trúc PNG trong Playwright | Owner + Tester | Trước `G4a` (`2026-11-15`) | Khi sửa module `@ky-nay/export` |

## Gate decision

- **Decision:** `qa-pass-with-follow-up`
- **Tester actor/date/evidence:** Independent Tester subagent (`G3a`), not a human sign-off / `2026-11-06T06:57:00Z` / Evidence: `npm run check` (exit `0`, `102/102` node tests, `65/65` Vitest tests, `6/6` fixtures) và `npm run test:e2e` (exit `0`, `19/19` Playwright Chromium tests) trên commit `12abdbd`. **Lưu ý:** Quyết định đóng cổng chính thức vẫn chờ **Owner (human sign-off)** phê duyệt.
- **Release recommendation:** `follow-up-open` (Đạt yêu cầu kỹ thuật của Milestone M4 với 0 lỗi `S0`/`S1`; các mục `QA-M4-001` [S2], `QA-M4-002` [S3], `QA-M4-003` [S3] cần được xử lý hoặc nghiệm thu trước cổng phát hành `G4a` ở M5).
- **Conditions/next owner:**
  1. **Owner (Product / Tech Lead):** Xem xét và ký duyệt các cổng `G0` (`SPEC-M4-001`), `G1` (`ADR-0013`, `DESIGN-M4-001`) và `G3a`/`G3b`/`G3c`.
  2. **Frontend/Coder:** Xử lý `QA-M4-001` (cảnh báo hoặc ánh xạ lại `overrides` khi `rebasePlan` gặp thay đổi `session.id`), `QA-M4-002` (hiển thị nhãn/ghi chú override trên ảnh `.png`) và `QA-M4-003` (reset `preview` trong `catch` + thêm test UI cho re-import) trước cổng `G4a` (`2026-11-15`).
