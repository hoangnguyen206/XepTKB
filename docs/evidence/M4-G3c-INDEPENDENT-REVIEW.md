# Báo Cáo Đánh Giá Độc Lập — M4 Registration Merge UI (`G3c`)

- Artifact ID: `REVIEW-M4-001`
- Canonical gate: `G3c`
- Producer role: `Independent Reviewer` (`.claude/agents/reviewer.md` — Independent Verification Agent)
- Review round: `R1` (tại commit `12abdbd`) → `R1.1` (re-verification & synthesis tại commit `6fd1506`)
- Milestone: `M4 — Registration Merge UI`
- Target commit / branch: `12abdbd` (R1) → `6fd1506` (R1.1 fix verification, base commit `3c34c89` trên `main`) / branch `m4-registration-ui`
- Reviewed artifacts:
  - Đặc tả & Kiến trúc: `docs/evidence/M4-SPEC.md` (`SPEC-M4-001`), `docs/adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md` (`ADR-0013`)
  - Thiết kế & Bàn giao triển khai: `docs/evidence/M4-DESIGN-HANDOFF.md` (`DESIGN-M4-001`), `docs/evidence/M4-IMPLEMENTATION-HANDOFF.md` (`IMPL-M4-001`), `docs/evidence/M4-EVIDENCE-ENVELOPE.md` (`EVIDENCE-M4-001`)
  - Báo cáo kiểm chứng song song: `docs/evidence/M4-G3a-QA-REPORT.md` (`TEST-M4-001` — Gate `G3a`), `docs/evidence/M4-G3b-SECURITY-REVIEW.md` (`SEC-REVIEW-M4-001` — Gate `G3b`)
  - Mã nguồn & Kiểm thử: Toàn bộ các file thay đổi trong `git diff 3c34c89..6fd1506` (`packages/domain`, `packages/export`, `packages/parser`, `scripts/lint.mjs`, `apps/web`).
- Verdict: `review-approved` (`review-pass` — đề xuất kỹ thuật từ Independent Reviewer sau khi xác minh R1.1 tại commit `6fd1506`; chờ human Owner phê duyệt chính thức tại gate)

---

## 1. Review Scope

Independent Reviewer đã thực hiện đánh giá độc lập toàn diện cho **Milestone M4 — Registration Merge UI** qua 2 vòng:
1. **Vòng R1 (tại commit `12abdbd`):** Đối chiếu mã nguồn thực tế (`git diff 3c34c89..12abdbd`) với `SPEC-M4-001`, `ADR-0013`, `DESIGN-M4-001` và `IMPL-M4-001`. Phát hiện 1 lỗi mức `S2` (`REV-M4-001`) và 3 lỗi mức `S3` (`REV-M4-002`, `REV-M4-003`, `REV-M4-004`), đưa ra khuyến nghị `review-pass-with-follow-up`.
2. **Vòng R1.1 (tại commit `6fd1506`):** Kiểm tra độc lập bản vá `git diff 12abdbd..6fd1506`, tổng hợp chéo kết quả từ `G3a` (`TEST-M4-001`) và `G3b` (`SEC-REVIEW-M4-001`), đồng thời chạy lại toàn bộ `npm run check` (`102/102` node tests, `68/68` Vitest tests, `6/6` fixtures) và `npm run test:e2e` (`19/19` Playwright E2E tests) để xác minh tất cả các điểm tồn đọng đã được giải quyết triệt để.

---

## 2. Structured Findings

| Check | Status (R1 → R1.1) | Notes |
| --- | --- | --- |
| Spec alignment (`FR-09`, `FR-10`, `AC-M4-01..08`, `Q-005`, `Q-007`) | `pass` *(R1: `warn` → R1.1: `pass`)* | Tất cả 8 tiêu chí `AC-M4-01..08` hiện đã hoàn thành trọn vẹn. Hai điểm thiếu sót nhỏ ở R1 (`REV-M4-001` khi rebase `.xlsx` dịch dòng `sourceRow` và `REV-M4-002` thiếu nhãn override trên ảnh PNG) đã được khắc phục và kiểm chứng bằng test tự động tại `6fd1506`. |
| Architecture & ADR compliance (`ADR-0013`, package boundaries) | `pass` | Ranh giới quyền riêng tư (Privacy Boundary) và kiến trúc pure-domain (`reconcileRegistration`, `findOverrideTargetSession`, `applySectionOverrides`) tuân thủ đúng `ADR-0013`. Guardrail tự động trong `scripts/lint.mjs` ngăn chặn mọi file ngoài `vnu-registration-html-adapter.ts` truy cập trường nhạy cảm. |
| Code quality & maintainability | `pass` | Code rõ ràng, tách biệt tốt giữa tầng domain (`packages/domain/src/registration-merge.ts`), tầng view-model (`apps/web/src/model/registration.ts`, `plan-view.ts`), tầng lưu trữ (`plan-store.ts` với migration `0.1.0 -> 0.2.0`) và giao diện React (`RegistrationImport.tsx`, `PlanSummary.tsx`, `Schedule.tsx`). Các điểm ở `REV-M4-003` và `SEC-M4-001` đã được làm sạch tại `6fd1506`. |
| Test quality & coverage | `pass` | Bộ test rất mạnh (`102` node unit tests, `68` Vitest tests, `6` fixture snapshots, `19` Playwright E2E tests), bao phủ cả kiểm thử canary chống rò rỉ PII, rebase khi đổi `sourceRow`, vẽ badge override trên PNG, banner in-app browser `Q-007`, luồng re-import UI và chọn bảng HTML ĐKMH. |
| Evidence completeness | `pass` *(R1: `warn` → R1.1: `pass`)* | Toàn bộ bộ hồ sơ `M4-SPEC.md`, `ADR-0013`, `M4-DESIGN-HANDOFF.md`, `M4-IMPLEMENTATION-HANDOFF.md`, `M4-G3a-QA-REPORT.md`, `M4-G3b-SECURITY-REVIEW.md`, `M4-G3c-INDEPENDENT-REVIEW.md` và `M4-EVIDENCE-ENVELOPE.md` đã đầy đủ và đồng nhất số hiệu phiên bản (`REV-M4-004` đã được sửa tại `6fd1506`). |

---

## 3. Synthesis of G3a (`TEST-M4-001`) and G3b (`SEC-REVIEW-M4-001`)

Independent Reviewer đã rà soát chéo hai báo cáo kiểm chứng độc lập song song tại Gate 3:

1. **Tổng hợp từ `G3a` (`docs/evidence/M4-G3a-QA-REPORT.md` — `TEST-M4-001`):**
   - Tại vòng R1 (`12abdbd`), Tester phát hiện `QA-M4-001` (`S2`), `QA-M4-002` (`S3`), `QA-M4-003` (`S3`).
   - Tại vòng R1.1 (`6fd1506`), Tester đã chạy lại `npm run check` (`task-76`: `102/102` node tests, `68/68` Vitest tests, `6/6` fixtures PASS) và `npm run test:e2e` (`task-87`: `19/19` Playwright E2E tests PASS), xác nhận cả 3 phát hiện `QA-M4-001..003` đều đạt trạng thái `verified-fixed` và nâng khuyến nghị Gate `G3a` lên **`qa-pass`**.
2. **Tổng hợp từ `G3b` (`docs/evidence/M4-G3b-SECURITY-REVIEW.md` — `SEC-REVIEW-M4-001`):**
   - Security Reviewer xác nhận ranh giới quyền riêng tư `ADR-0013` hoạt động đúng thiết kế (`0` lỗi `S0`/`S1`/`S2`): dữ liệu nhạy cảm của sinh viên (MSSV, họ tên, ngày sinh, lớp hành chính, trạng thái ĐKMH, học phí, raw HTML) bị loại bỏ ngay tại parser boundary, có lint guardrail tĩnh (`scripts/lint.mjs`) và có canary tests ở cả tầng Vitest lẫn Playwright E2E.
   - Phát hiện mới duy nhất của M4 là `SEC-M4-001` (`S3`: giới hạn độ dài đầu vào `splitRooms` trước regex và ưu tiên bảng có đủ 5 cột `REQUIRED_COLUMNS` trong `vnu-registration-html-adapter.ts`). Phát hiện này đã được sửa và kiểm chứng bằng unit test tại commit `6fd1506` (`verified-fixed`).
   - Đối với các ngoại lệ mức `S3` kế thừa từ M3 (`EXC-SEC-M3-R2-A/B/C/D`):
     - `EXC-SEC-M3-R2-A` (strip PII tại parser boundary) đã được đóng hoàn toàn trong M4 (`closed-in-m4`).
     - 3 mục mức `S3` còn lại (`EXC-SEC-M3-R2-B`: giới hạn kích thước lưu trữ `IndexedDB` và kiểm tra schema runtime cho `readSettings()`; `EXC-SEC-M3-R2-C`: bổ sung CSP tường minh trong `apps/web/index.html`; `EXC-SEC-M3-R2-D`: đối chiếu `npm audit` cho dependencies dev/build) không thuộc phạm vi thay đổi bắt buộc của M4 và tiếp tục được theo dõi rõ ràng cho cột mốc đóng gói phát hành **M5 (`G4a` / `G4b`)**.

---

## 4. Detailed Findings

### Finding `REV-M4-001`: Mất `sectionOverrides` âm thầm khi `rebasePlan` chạy trên file `.xlsx` thời khóa biểu mới có dịch chuyển chỉ số dòng `sourceRow`
- **Severity:** `S2` (Major)
- **Category:** `spec` / `logic` (`AC-M4-05` — Stale Timetable Rebase)
- **Location:**
  - `packages/domain/src/registration-merge.ts:232-287` (`findOverrideTargetSession`, `applySectionOverrides`)
  - `apps/web/src/model/plan-view.ts:91-121, 146-218` (`resolveOverrideTargets`, `rebasePreview`, `rebasePlan`)
  - `apps/web/src/components/PlanSummary.tsx:43-47` (`StalePlanNotice`)
- **Description (tại R1 — `12abdbd`):**
  - Định danh buổi học `Session.id` được tạo bởi `vnu-xlsx-adapter.ts` có cấu trúc `${sectionId}:${row.sourceRow}:${periodRange.start}-${periodRange.end}`.
  - Trong `reconcileRegistration`, mỗi `RegistrationSessionOverride` lưu `sessionId: session.id` của bản `.xlsx` tại thời điểm import ĐKMH.
  - Khi người dùng nạp một file `.xlsx` mới hơn mà các dòng trong bảng tính bị xê dịch (`sourceRow` thay đổi dù lớp học phần và thứ/tiết giữ nguyên), `rebasePlan` ở `12abdbd` giữ nguyên `override.sessionId` cũ. Khi `applySectionOverrides` chạy trên dataset mới, phép so sánh `item.sessionId === session.id` trả về `false`, làm mất toàn bộ ghi đè phòng học, giảng viên, hình thức học mà không có cảnh báo.
- **Verification of Fix tại R1.1 (`6fd1506`):**
  1. `findOverrideTargetSession` (`packages/domain/src/registration-merge.ts:232-254`) đã được bổ sung để tìm buổi học khớp trực tiếp theo `session.id`, hoặc fallback sang buổi học duy nhất có cùng hậu tố tiết (`:${start}-${end}`) và tương thích với các trường `from`/`to` của override.
  2. Cả `applySectionOverrides` và `resolveOverrideTargets` trong `rebasePreview` / `rebasePlan` (`apps/web/src/model/plan-view.ts:91-121, 168-211`) đã sử dụng `findOverrideTargetSession` để tự động cập nhật `sessionId` sang `targetSession.id` mới khi rebase.
  3. Trường hợp buổi học bị thay đổi cấu trúc tiết không thể ánh xạ sang buổi mới, `rebasePreview` trả về `droppedOverrides` và `StalePlanNotice` (`apps/web/src/components/PlanSummary.tsx:43-47`) hiển thị cảnh báo rõ ràng cho người dùng trước khi áp dụng rebase.
  4. Unit test `"rebases official plan overrides cleanly when a newer xlsx shifts sourceRow inside session.id"` (`apps/web/src/m4-registration.test.tsx:202-250`) đã kiểm chứng đầy đủ kịch bản này.
- **Status:** `fixed` (`verified-fixed` tại commit `6fd1506`)

---

### Finding `REV-M4-002`: Xuất ảnh PNG (`renderPng`) chưa vẽ override badges của phương án chính thức
- **Severity:** `S3` (Minor)
- **Category:** `spec` (`AC-M4-07` — Export Fidelity trên PNG)
- **Location:** `apps/web/src/export/png.ts:126-137`, `apps/web/src/export/png.test.ts:42-83`
- **Description (tại R1 — `12abdbd`):**
  - `AC-M4-07` yêu cầu cả 5 định dạng xuất (TXT, Markdown, ICS, Word `.docx`, PNG) phản ánh phòng học, giảng viên, hình thức học đã hợp nhất **và override badges**.
  - Ở `12abdbd`, `renderPng` chỉ vẽ `block.room`, `block.teacher` và `block.deliveryMode` hiệu lực mà chưa vẽ `block.overrideBadges`.
- **Verification of Fix tại R1.1 (`6fd1506`):**
  - `renderPng` (`apps/web/src/export/png.ts:126-137`) đã được bổ sung hiển thị `★ ${block.overrideBadges.join(", ")}` trên dòng phòng học và vẽ thêm dòng chi tiết `overrideDetailText` (`from → to`) cho các khối nhiều tiết, được kiểm chứng bằng unit test mới trong `apps/web/src/export/png.test.ts:42-83`.
- **Status:** `fixed` (`verified-fixed` tại commit `6fd1506`)

---

### Finding `REV-M4-003`: Không xóa `preview` cũ khi đọc file ĐKMH mới bị lỗi, tuần tự hóa `updateSettings` và bổ sung test cho `Q-007` / re-import UI
- **Severity:** `S3` (Minor)
- **Category:** `code` / `test`
- **Location:**
  - `apps/web/src/components/RegistrationImport.tsx:80`
  - `apps/web/src/app/controller.ts:174-207`
  - `apps/web/src/m4-registration.test.tsx:284-364`
- **Description (tại R1 — `12abdbd`):**
  1. Trong `RegistrationImport.tsx`, khi người dùng đã nạp một file ĐKMH hợp lệ (`preview` đã có dữ liệu) rồi chọn tiếp một file thứ hai nhưng quá trình đọc file thứ hai ném lỗi vào khối `catch`, `setPreview(undefined)` chưa được gọi nên giao diện vừa báo lỗi vừa giữ bảng preview của file cũ.
  2. Trong `apps/web/src/app/controller.ts`, `updateSettings` trong `selectSlot` và `applyRegistrationImport` được gọi ngoài chuỗi `saveChainRef.current`.
  3. Trong `apps/web/src/m4-registration.test.tsx`, chưa có test riêng cho `isInAppBrowser()` / banner cảnh báo in-app browser (`Q-007`) và thao tác bấm nút `"Cập nhật từ file ĐKMH"`.
- **Verification of Fix tại R1.1 (`6fd1506`):**
  1. `RegistrationImport.tsx:80` đã gọi `setPreview(undefined)` trong khối `catch`.
  2. `controller.ts:174-207` đã nối `updateSettings` vào bên trong `saveChainRef.current` cho cả `selectSlot` và `applyRegistrationImport`.
  3. `m4-registration.test.tsx:284-364` đã bổ sung unit test cho `isInAppBrowser`, test render banner cảnh báo Zalo WebView trong `RegistrationImportPanel` và test luồng bấm `"Cập nhật từ file ĐKMH"` → `"Xác nhận cập nhật Phương án chính thức"`.
- **Status:** `fixed` (`verified-fixed` tại commit `6fd1506`)

---

### Finding `REV-M4-004`: Không khớp nhỏ về số hiệu phiên bản trong tài liệu `M4-IMPLEMENTATION-HANDOFF.md` và `M4-EVIDENCE-ENVELOPE.md`
- **Severity:** `S3` (Minor / Documentation)
- **Category:** `evidence`
- **Location:** `docs/evidence/M4-IMPLEMENTATION-HANDOFF.md:56`, `docs/evidence/M4-EVIDENCE-ENVELOPE.md:43`
- **Description (tại R1 — `12abdbd`):**
  - Mục 3 của `docs/evidence/M4-IMPLEMENTATION-HANDOFF.md` và mục 2 của `docs/evidence/M4-EVIDENCE-ENVELOPE.md` ghi `"Plan storage envelope: 0.1.0 -> 0.2.0"` và `"vnu-registration-html@0.1.0"`, trong khi mã nguồn thực tế là `PLAN_STORAGE_VERSION = "0.2.0"` và `version: "0.2.0"`.
- **Verification of Fix tại R1.1 (`6fd1506`):**
  - Cả hai tài liệu `M4-IMPLEMENTATION-HANDOFF.md:56` và `M4-EVIDENCE-ENVELOPE.md:43` đã được cập nhật chính xác thành `Plan storage envelope 0.2.0` và `vnu-registration-html@0.2.0`.
- **Status:** `fixed` (`verified-fixed` tại commit `6fd1506`)

---

### Finding `SEC-M4-001` (Đồng bộ từ `G3b` — `SEC-REVIEW-M4-001`): Giới hạn độ dài `splitRooms` và ưu tiên bảng có đủ 5 cột `REQUIRED_COLUMNS` trong `vnu-registration-html-adapter.ts`
- **Severity:** `S3` (Minor / Security Hardening)
- **Category:** `security` / `parser`
- **Location:** `packages/parser/src/vnu-registration-html-adapter.ts:141-151, 282-287`, `apps/web/src/m4-registration.test.tsx:252-280`
- **Verification of Fix tại R1.1 (`6fd1506`):**
  - `splitRooms` đã cắt giới hạn chuỗi đầu vào ở `MAX_ROOM_TEXT_LENGTH = 128` trước khi thực thi regex phân tách phòng học, và logic chọn bảng trong `parseVnuRegistrationHtml` đã ưu tiên bảng ứng viên đầu tiên chứa đầy đủ 5 cột bắt buộc (`REQUIRED_COLUMNS`), có unit test xác minh tại `apps/web/src/m4-registration.test.tsx:252-280`.
- **Status:** `fixed` (`verified-fixed` tại commit `6fd1506`)

---

## 5. Sign-Off

- **Đề xuất của Independent Reviewer cho Gate `G3c`:** **`review-approved`** (`review-pass`, nâng từ `review-pass-with-follow-up` ở R1 sau khi xác minh bản vá R1.1 tại commit `6fd1506`).
- **Tóm tắt lý do:**
  1. Thiết kế và triển khai M4 tuân thủ chặt chẽ `ADR-0013` và `SPEC-M4-001`, hoàn thành toàn bộ các tiêu chí nghiệm thu `AC-M4-01..08`, `AC-04`, `AC-05`, `FR-09`, `FR-10`, `Q-005` và `Q-007`.
  2. Tất cả 4 phát hiện từ vòng R1 (`REV-M4-001` mức `S2`, `REV-M4-002..004` mức `S3`) cùng phát hiện bảo mật `SEC-M4-001` (`S3` từ `G3b`) đã được khắc phục triệt để tại commit `6fd1506` và được xác nhận qua bộ kiểm thử tự động (`102/102` node tests, `68/68` Vitest tests, `6/6` fixtures, `19/19` Playwright E2E tests).
  3. Ba mục khuyến nghị mức `S3` kế thừa từ M3 (`EXC-SEC-M3-R2-B/C/D`) không chặn Gate 3 của M4 và đã được ghi nhận rõ trong lộ trình đóng gói phát hành tại M5 (`G4a` / `G4b`).
- **Lưu ý quản trị (Governance Note):** Quyết định `review-approved` trên đây là đề xuất kỹ thuật của subagent `Independent Reviewer` (`G3c`). Quyền phê duyệt đóng cổng chính thức (final gate sign-off) thuộc về **human Owner**.
