# Review — M4 Registration merge UI (G3c independent review)

> **Artifact ID:** `REVIEW-M4-001`  
> **Artifact status:** `needs_review`  
> **Canonical gate:** `G3c`  
> **Owner:** Independent Reviewer  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [M4 spec](M4-SPEC.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [M4 design handoff](M4-DESIGN-HANDOFF.md), [M4 implementation handoff](M4-IMPLEMENTATION-HANDOFF.md), [M4 QA report](M4-G3a-QA-REPORT.md), [QA test plan](../QA_TEST_PLAN.md), [PRD](../PRD.md), [Domain model](../DOMAIN_MODEL.md), [Security & privacy](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** `EVID-M4-001` ([M4-EVIDENCE-ENVELOPE.md](M4-EVIDENCE-ENVELOPE.md))  
> **Independent reviewer / approval UTC timestamp:** Independent Reviewer subagent (`G3c`), not a human sign-off / `2026-11-06T06:57:00Z` (Pending human Owner sign-off)

## Scope and identity

- **Review type:** correctness / domain invariants / parser & browser boundary / security & privacy (`AC-04`) / maintainability / test & documentation fidelity.
- **Source spec/ADR/PRD + versions:**
  - [`SPEC-M4-001`](M4-SPEC.md) (`in-review`, `G0`, `AC-M4-01`..`AC-M4-08`, `D-M4-1`..`D-M4-3`)
  - [`ADR-0013`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) (`in-review`, `G1`)
  - [`DESIGN-M4-001`](M4-DESIGN-HANDOFF.md) (`in-review`, `G1`)
  - [`IMPL-M4-001`](M4-IMPLEMENTATION-HANDOFF.md) (`needs_review`, `G2`)
  - [`PRD.md`](../PRD.md) §4 P0 #7, #9, #10; §6 `FR-09`, `FR-10`; §7 `AC-04`, `AC-05`; §8 `NFR-03`, `Q-005`, `Q-007`, `Q-009`, `Q-010`
- **Base commit/diff ID:** `3c34c89` (`main`).
- **Target commit/PR/build ID:** `12abdbd` (`m4-registration-ui`, 29 files changed, `+2236 / -76`).
- **Dataset/parser/schema/fixture versions:**
  - Domain schema: `0.2.0`
  - Plan record schema (`PLAN_RECORD_VERSION`): `0.2.0`
  - Registration HTML parser: `vnu-registration-html@0.2.0` (`@ky-nay/parser/registration`)
  - Fixtures: `registration-portal-format-redacted` (`4937d996...`), `registration-local-synthetic` (`357da747...`), cùng 4 fixture TKB (`6/6` passed).
- **Tested commands/tool/run IDs/exit codes:**
  - `npm run check` (`task-43`) → exit `0` (`lint` pass, `typecheck` pass, `node:test` `102/102`, `vitest` `65/65`, `fixtures:run` `6/6`, `dataset.mjs check` pass).
  - `npm run test:e2e` (`task-55`) → exit `0` (Playwright Chromium `19/19` passed, gồm `e2e/m4.spec.ts` `2/2`, `e2e/m3.spec.ts` `13/13`, `e2e/qa-m3.spec.ts` `4/4`).
- **Requirement/AC/P0 coverage:** Toàn bộ yêu cầu P0 thuộc phạm vi M4 (`FR-09`, `FR-10`, `AC-04`, `AC-05`, `AC-M4-01`..`AC-M4-08`, `Q-005`, `Q-007`) đã được hiện thực hóa và có bằng chứng kiểm thử tự động.

## Verdict

`review-pass-with-follow-up`

*(Không có lỗi `S0` hay `S1`. Có 1 phát hiện mức `S2` (`REV-M4-001`) về việc `rebasePlan`/`rebasePreview` làm rơi âm thầm các `overrides` của `Phương án chính thức` khi phiên bản TKB mới đổi `session.id`, và 3 phát hiện mức `S3` (`REV-M4-002`..`004`). Tất cả đều có biện pháp giảm thiểu, người chịu trách nhiệm và hạn xử lý trước cổng `G4a`. Quyết định đóng cổng chính thức vẫn chờ **Owner (human sign-off)** phê duyệt.)*

## Structured checks

| Check | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Correctness/domain invariants | `resolvePlanPicks` áp dụng `plan.overrides` đúng thứ tự ưu tiên (`registration < admin-correction < user`); `findConflicts`, `previewPick`, `scheduledSessions` dùng đúng phiên học sau override; `draft` không bao giờ bị ghi đè bởi import ĐKMH (`Q-005`) | `packages/domain/src/plan.ts:98` gọi `applySectionOverrides(rawSection, plan.overrides, catalog)` trước `sessionsForPick`; `registration-merge.test.ts` và `m4-registration.test.tsx` chứng minh `draftPlan` bất biến và `finalPlan` sau khi tải lại từ IndexedDB vẫn giữ nguyên phòng/thứ/tiết đã đổi. Lưu ý edge case khi rebase qua dataset đổi `session.id` (`REV-M4-001`, S2) | `pass with finding` |
| Parser/data provenance | Phân tích `.doc`/HTML cổng đào tạo tất định, giữ provenance `sourceType = "registration"`, `artifactId = "local-registration"`, báo cáo rõ `from → to` (`AC-05`) | `vnu-registration-html-adapter.ts` chỉ đọc bảng lịch học, đặt `localOnly: true`, không lưu `fileName`/`sha256`; `packages/export/src/schedule.ts` và `format.ts` gắn `SessionOverride` (`badge`, `detail`) hiển thị nhất quán trên `WeekGrid`, `DayList`, `PlanSummary`, `PrintSheet`, `.ics`, `.doc` | `pass` |
| Scope/contract/migration | Tuân thủ `SPEC-M4-001`, `ADR-0013`, `DESIGN-M4-001`; tương thích ngược với dữ liệu `IndexedDB` của M3 | `Settings` mở rộng tương thích ngược với `activeSlots` và `registrationNotes` tùy chọn; `Plan` schema giữ nguyên `0.2.0`. Có 2 điểm lệch nhỏ: `renderPng` chưa vẽ badge `"Đã đổi…"` (`REV-M4-002`, S3) và tài liệu handoff/envelope ghi nhầm chuỗi version (`REV-M4-004`, S3) | `pass with finding` |
| Privacy/security boundary | Ranh giới trình duyệt local-only tuyệt đối (`AC-04`): 0 network request, 0 PII trong state/DOM/IDB/console/exports, chặn file quá cỡ/nhị phân, chống XSS | `scripts/lint.mjs:29-30` chặn mọi import `@ky-nay/parser` ngoài `@ky-nay/parser/registration` và chặn `node:*` trong `apps/web/src`; `checkRegistrationBytes` chặn sớm file rỗng, `> 2 MiB`, `.docx` ZIP, `.doc` OLE2, `.pdf`; `inputEl.value = ""` xóa ngay tên file; E2E xác nhận 0 network request và 0 token PII ở mọi nơi | `pass` |
| Performance/maintainability | Thiết kế module tách biệt rõ (`domain` → `export` → `web/model` → `web/components`), không đóng băng UI | Mã nguồn sạch, tách biệt rõ logic thuần (`apps/web/src/model/registration.ts`) và component (`RegistrationImport.tsx`); thời gian chạy E2E toàn luồng M4 chỉ `1.4s` | `pass` |
| Tests/docs/observability | Đầy đủ unit, integration, E2E, accessibility (`axe`) và responsive (`360/768/1200px`) | `102/102` node tests, `65/65` Vitest tests, `6/6` fixtures, `19/19` Playwright E2E tests đều pass; còn thiếu vài test UI phụ cho re-import và in-app browser banner trong `RegistrationImportPanel` (`REV-M4-003`, S3) | `pass with finding` |

## Findings

> Chỉ ghi finding có evidence hoặc failure scenario cụ thể. Xếp severity cao nhất trước.

### `REV-M4-001` — [S2] `rebasePlan` và `rebasePreview` làm rơi âm thầm các `overrides` của `Phương án chính thức` khi phiên bản TKB mới đổi `session.id`

- **File/line/artefact:** [`apps/web/src/model/plan-view.ts`](../../apps/web/src/model/plan-view.ts) dòng `91-99` (`rebasePreview`) và dòng `102-124` (`rebasePlan`); [`apps/web/src/components/PlanSummary.tsx`](../../apps/web/src/components/PlanSummary.tsx) dòng `20-45` (`StalePlanNotice`); liên đới [`packages/parser/src/uet-xlsx-adapter.ts`](../../packages/parser/src/uet-xlsx-adapter.ts) dòng `457`.
- **Failure scenario:** Sinh viên đã nhập file kết quả ĐKMH để tạo `Phương án chính thức` (`planKind === "final"`) có các `plan.overrides` (ví dụ đổi phòng hoặc đổi tiết). Sau đó nhà trường phát hành phiên bản TKB `.xlsx` mới mà trong bảng tính có chèn hoặc xóa dòng ở phía trên lớp học đó. Vì `uetXlsxAdapter` tạo `session.id` theo mẫu `${section.id}:${record.sourceRow}:${range.startPeriod}-${range.endPeriod}`, `session.id` của buổi học trong dataset mới sẽ thay đổi dù buổi học vẫn tồn tại.
- **Expected / actual:**
  - **Expected:** Khi sinh viên bấm `"Cập nhật phương án"` trên `StalePlanNotice`, `rebasePreview` phải cảnh báo nếu có `plan.overrides` không còn khớp `sessionId` trong dữ liệu mới (hoặc `rebasePlan` phải ánh xạ lại sang buổi học tương ứng của cùng `sectionId`), để sinh viên biết cần bấm `"Cập nhật từ file ĐKMH"`.
  - **Actual:** `rebasePreview` chỉ kiểm tra `removed`, `groupCleared`, `needsGroup` nên báo `"Mọi lớp và nhóm đã chọn vẫn còn trong dữ liệu mới."`; khi xác nhận rebase, vòng lặp tại `plan-view.ts:108-109` (`const baseSession = section?.sessions.find((session) => session.id === override.target.sessionId); if (!section || !baseSession) continue;`) âm thầm loại bỏ các `overrides` đó.
- **Impact:** Trong trường hợp file Excel TKB mới bị dịch dòng, `Phương án chính thức` sau khi rebase sẽ quay về phòng/giờ của TKB thay vì phòng/giờ của ĐKMH mà không có cảnh báo cụ thể trong hộp thoại rebase. Tuy nhiên, sinh viên đã có cảnh báo ở `StalePlanNotice` (`"Hãy kiểm tra lại phòng/giờ các lớp đã chọn"`) và có workaround trực tiếp bằng nút `"Cập nhật từ file ĐKMH"` ngay trên thanh phương án (vốn ghép theo `day`/`periods` chứ không phụ thuộc `session.id`).
- **Evidence/repro/run ID:** Phân tích tĩnh `apps/web/src/model/plan-view.ts:91-124` kết hợp `packages/parser/src/uet-xlsx-adapter.ts:457`; đối chiếu với `QA-M4-001` trong [`M4-G3a-QA-REPORT.md`](M4-G3a-QA-REPORT.md).
- **Recommended fix:** Bổ sung trường `droppedOverrides: string[]` vào `RebasePreview` (khi `plan.overrides` có mục không tìm thấy `baseSession` trong dataset mới) và hiển thị cảnh báo trong `StalePlanNotice` nhắc sinh viên nạp lại file ĐKMH sau khi cập nhật (hoặc fallback khớp buổi học duy nhất theo `kind`/`group`/`day`/`periods` khi `session.id` đổi).
- **Owner / status / due:** Frontend/Coder + Tech Lead / `still-open` / hạn xử lý `2026-11-15` (trước cổng `G4a`).

### `REV-M4-002` — [S3] Xuất ảnh `.png` (`renderPng`) chưa hiển thị nhãn `"Đã đổi…"` trên ô lưới của `Phương án chính thức`

- **File/line/artefact:** [`apps/web/src/export/png.ts`](../../apps/web/src/export/png.ts) dòng `125-132`, đối chiếu [`docs/evidence/M4-SPEC.md`](M4-SPEC.md) dòng `25, 86` (`AC-M4-05`).
- **Failure scenario:** Sinh viên đang ở `Phương án chính thức` có buổi học đã đổi phòng/giờ theo ĐKMH và bấm `"Tải ảnh (.png)"`.
- **Expected / actual:**
  - **Expected:** `SPEC-M4-001` §2 và `AC-M4-05` nêu nhãn thay đổi xuất hiện trên lịch tuần, lịch ngày, tóm tắt phương án và các file xuất (`.ics`, `.png`, `.doc`, bản in).
  - **Actual:** `renderPng` vẽ đúng buổi học ở thứ/tiết mới và in đúng phòng học mới (`block.session.room`) từ ĐKMH, nhưng mảng `lines` trong `png.ts:125-132` chưa đọc `block.session.overrides` để vẽ nhãn `"Đã đổi phòng"` / `"Đã đổi giờ"` hoặc ghi chú ở `footerLines`.
- **Impact:** Dữ liệu thời gian và phòng học trên ảnh `.png` hoàn toàn chính xác theo ĐKMH, chỉ thiếu nhãn chú thích `"Đã đổi…"` trên mặt ảnh.
- **Evidence/repro/run ID:** Đối chiếu `apps/web/src/export/png.ts:125-132` với `apps/web/src/components/Schedule.tsx:110` và `packages/export/src/word.ts:30`.
- **Recommended fix:** Thêm dòng badge `block.session.overrides` vào `lines` trong `renderPng` (hoặc thêm dòng tóm tắt các thay đổi từ ĐKMH vào `footerLines` trong `ExportPanel.tsx:49`).
- **Owner / status / due:** Frontend/Coder / `still-open` / hạn xử lý `2026-11-15` (trước cổng `G4a`).

### `REV-M4-003` — [S3] Thứ tự cập nhật trạng thái trong `RegistrationImportPanel` / `controller.ts` và độ phủ test cho nhánh UI phụ

- **File/line/artefact:** [`apps/web/src/components/RegistrationImport.tsx`](../../apps/web/src/components/RegistrationImport.tsx) dòng `78-81`; [`apps/web/src/app/controller.ts`](../../apps/web/src/app/controller.ts) dòng `177-202`; [`apps/web/src/m4-registration.test.tsx`](../../apps/web/src/m4-registration.test.tsx); [`apps/web/e2e/m4.spec.ts`](../../apps/web/e2e/m4.spec.ts).
- **Failure scenario:**
  1. Trong `RegistrationImport.tsx:78-81`, nếu người dùng đã tải một file hợp lệ (state `preview` đang giữ kết quả xem trước), rồi chọn tiếp một file thứ hai khiến `readFileBytes(file)` ném ngoại lệ vào khối `catch`, hàm chỉ gọi `setReadingError(...)` mà không gọi `setPreview(undefined)`, làm bản xem trước của file đầu tiên vẫn hiển thị bên dưới thông báo lỗi.
  2. Trong `controller.ts:177-202` (`applyRegistrationImport`), `updateSettings(db, ...)` được gọi trực tiếp trước `persistPlan(finalPlan)` thay vì nằm trong chuỗi tuần tự `saveChainRef` sau khi `savePlanIfUnchanged` thành công.
  3. Các bài test trong `m4-registration.test.tsx` và `e2e/m4.spec.ts` chưa có kịch bản UI bấm nút `"Cập nhật từ file ĐKMH"` → `"Xác nhận cập nhật Phương án chính thức"` khi đã có `finalPlan` (mới chỉ test ở tầng domain trong `registration-merge.test.ts:105-116`) và chưa assert banner `isInAppBrowser()` bên trong `RegistrationImportPanel`.
- **Expected / actual:** Khi đọc file lỗi phải xóa `preview` cũ; lưu `settings` và `plan` nên đồng bộ trong `saveChainRef`; có test UI cho luồng cập nhật lại từ file ĐKMH.
- **Impact:** Rủi ro thấp trên nhánh lỗi đọc file hiếm gặp và độ phủ test phụ; không ảnh hưởng luồng chính.
- **Evidence/repro/run ID:** Đọc mã nguồn `RegistrationImport.tsx:78-81`, `controller.ts:177-202`, `m4-registration.test.tsx`, `e2e/m4.spec.ts`.
- **Recommended fix:** Gọi `setPreview(undefined)` trong khối `catch` của `onFileChange`; đưa `updateSettings` vào cùng chuỗi lưu với `persistPlan`; bổ sung 1 bước re-import trên UI trong `m4-registration.test.tsx`.
- **Owner / status / due:** Frontend/Coder + Tester / `still-open` / hạn xử lý `2026-11-15` (trước cổng `G4a`).

### `REV-M4-004` — [S3] Sai lệch nhỏ về chuỗi phiên bản trong tài liệu bàn giao M4 (`M4-EVIDENCE-ENVELOPE.md`, `M4-IMPLEMENTATION-HANDOFF.md`)

- **File/line/artefact:** [`docs/evidence/M4-EVIDENCE-ENVELOPE.md`](M4-EVIDENCE-ENVELOPE.md) dòng `43` và [`docs/evidence/M4-IMPLEMENTATION-HANDOFF.md`](M4-IMPLEMENTATION-HANDOFF.md) dòng `56`, đối chiếu [`packages/parser/src/vnu-registration-html-adapter.ts`](../../packages/parser/src/vnu-registration-html-adapter.ts) dòng `27` và [`apps/web/src/storage/plan-store.ts`](../../apps/web/src/storage/plan-store.ts) dòng `9`.
- **Failure scenario:** Tài liệu `M4-EVIDENCE-ENVELOPE.md:43` ghi `Plan storage envelope 1.0.0, registration parser vnu-registration-html@0.1.0` (và `M4-IMPLEMENTATION-HANDOFF.md:56` ghi `Plan storage envelope: 1.0.0`), trong khi mã nguồn thực tế có `ADAPTER_VERSION = "0.2.0"` (`vnu-registration-html@0.2.0`) và `PLAN_RECORD_VERSION = SCHEMA_VERSION = "0.2.0"`.
- **Expected / actual:** Thông tin phiên bản trong tài liệu bàn giao và evidence envelope phải khớp chính xác với hằng số trong mã nguồn.
- **Impact:** Chỉ ảnh hưởng tính chính xác của văn bản tài liệu, không ảnh hưởng hành vi phần mềm.
- **Evidence/repro/run ID:** Đối chiếu trực tiếp các dòng nêu trên.
- **Recommended fix:** Cập nhật `M4-EVIDENCE-ENVELOPE.md` và `M4-IMPLEMENTATION-HANDOFF.md` thành `Plan storage envelope 0.2.0` và `vnu-registration-html@0.2.0`.
- **Owner / status / due:** Tech Lead / `still-open` / hạn xử lý `2026-11-15` (trước cổng `G4a`).

## Waivers and limitations

- **Waiver/exception:** `none` cho `S0`/`S1` (không có lỗi `S0`/`S1`). Phát hiện `REV-M4-001` (`S2`) và `REV-M4-002`..`004` (`S3`) được đề xuất `review-pass-with-follow-up` với owner, mitigation và hạn xử lý rõ ràng trước cổng phát hành `G4a` (`2026-11-15`).
- **Limitations:** Kiểm thử E2E thực thi trên Playwright Chromium (Windows 10); kiểm thử thủ công trên thiết bị thật Tier 1 (Safari iOS, Chrome Android) và webview Zalo/Messenger thật thuộc phạm vi chuẩn bị phát hành M5 (`G4a`).
- S0/S1 không được waive; S2/S3 phải có risk acceptance.

## Approval and re-review

- **Reviewer decision actor/date/evidence:** Independent Reviewer subagent (`G3c`), not a human sign-off / `2026-11-06T06:57:00Z` / Verdict: `review-pass-with-follow-up` dựa trên kiểm tra độc lập toàn bộ 29 file trong `git diff 3c34c89..12abdbd` và kết quả chạy thực tế `npm run check` (exit `0`) + `npm run test:e2e` (exit `0`). **Lưu ý:** Quyết định đóng cổng chính thức vẫn chờ **Owner (human sign-off)** phê duyệt.
- **Next owner/action:**
  1. **Owner (Product / Tech Lead):** Xem xét phê duyệt `G0`, `G1` và xác nhận risk acceptance cho các mục follow-up `S2`/`S3` ở `G3a`/`G3c`.
  2. **Frontend/Coder & Tech Lead:** Khắc phục `REV-M4-001`..`004` trước cổng `G4a` (M5).
- **Fix commit/target:** `pending` (dành cho đợt hoàn thiện trước `G4a`).
- **Retest command/evidence:** `npm run check` và `npm run test:e2e`.
- **Finding outcomes:**
  - `REV-M4-001` (`S2`): `still-open`
  - `REV-M4-002` (`S3`): `still-open`
  - `REV-M4-003` (`S3`): `still-open`
  - `REV-M4-004` (`S3`): `still-open`
