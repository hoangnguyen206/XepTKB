# Báo Cáo Kiểm Thử QA — M4 Registration Merge UI (`G3a`)

- Artifact ID: `TEST-M4-001`
- Canonical gate: `G3a`
- Producer role: `Tester` (`.claude/agents/tester.md` — Independent Verification Agent)
- Review round: `R1` (tại commit `12abdbd`) → `R1.1` (re-verification tại commit `6fd1506`)
- Milestone: `M4 — Registration Merge UI`
- Target commit / branch: `12abdbd` (R1) → `6fd1506` (R1.1 fix verification, base commit `3c34c89` trên `main`) / branch `m4-registration-ui`
- Input handoff artifact(s):
  - `docs/evidence/M4-SPEC.md` (`SPEC-M4-001`)
  - `docs/adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md` (`ADR-0013`)
  - `docs/evidence/M4-DESIGN-HANDOFF.md` (`DESIGN-M4-001`)
  - `docs/evidence/M4-IMPLEMENTATION-HANDOFF.md` (`IMPL-M4-001`)
  - `docs/evidence/M4-G3b-SECURITY-REVIEW.md` (`SEC-REVIEW-M4-001`)
  - `docs/QA_TEST_PLAN.md` (§2 `AC-04`, `AC-05`, §6 `G3a`)
- Test environments:
  - OS: Windows 11 (`win32 10.0.26100`)
  - Runtime: Node.js `v24.12.0`, npm workspaces (`@vnu-tkb/domain`, `@vnu-tkb/parser`, `@vnu-tkb/solver`, `@vnu-tkb/export`, `@vnu-tkb/web`)
  - Unit / Component runner: `node --test` + `vitest v3.2.4` (`jsdom` + fake-indexeddb)
  - E2E runner: `@playwright/test` (`Desktop Chrome` / Chromium headless, Vite preview tại `http://127.0.0.1:4173`)
- Gate decision: `qa-pass` *(đề xuất kỹ thuật từ Tester sau khi xác minh R1.1 tại `6fd1506`; chờ human Owner phê duyệt chính thức tại gate)*
- Release recommendation: `go` *(cho phạm vi M4 sau khi `QA-M4-001`, `QA-M4-002`, `QA-M4-003` và `SEC-M4-001` đã được đóng tại commit `6fd1506`; M5 release gates `G4a`/`G4b` sẽ đánh giá thêm toàn diện trước phát hành)*

---

## 1. Execution Summary

Tester đã thực hiện kiểm thử độc lập trên nhánh `m4-registration-ui` qua 2 vòng:
- **Vòng R1 (tại commit `12abdbd`):** Kiểm tra trực tiếp toàn bộ 29 file thay đổi trong `git diff 3c34c89..12abdbd`, thực thi độc lập bộ lệnh kiểm chứng (`npm run check` và `npm run test:e2e`), rà soát ma trận `AC-M4-01..08`, `AC-04`, `AC-05`, `FR-09`, `FR-10`, `Q-005`, `Q-007`. Phát hiện 1 lỗi mức `S2` (`QA-M4-001`) và 2 lỗi mức `S3` (`QA-M4-002`, `QA-M4-003`), đưa ra khuyến nghị `qa-pass-with-follow-up`.
- **Vòng R1.1 (tại commit `6fd1506`):** Kiểm tra `git diff 12abdbd..6fd1506`, đối chiếu thêm báo cáo bảo mật `docs/evidence/M4-G3b-SECURITY-REVIEW.md` (`SEC-M4-001`), và chạy lại toàn bộ `npm run check` cùng `npm run test:e2e` trên commit `6fd1506`.

### Kết quả thực thi lệnh kiểm chứng độc lập tại R1.1 (`6fd1506`)

1. **`npm run check`** (Task ID `task-76`, exit code `0`):
   - `npm run lint`: **PASS** (`scripts/lint.mjs` kiểm tra cú pháp, cấm pattern nguy hiểm và thực thi guardrail kiến trúc — chỉ `packages/parser/src/vnu-registration-html-adapter.ts` được phép đọc trường nhạy cảm từ trang ĐKMH).
   - `npm run typecheck`: **PASS** (TypeScript `tsc -b` sạch lỗi trên toàn bộ 5 workspace packages).
   - `npm run test:unit`:
     - `node --test`: **`102/102` tests PASS** (`0` fail, `2397.7ms`) trên `@vnu-tkb/domain`, `@vnu-tkb/parser`, `@vnu-tkb/solver`, `@vnu-tkb/export`.
     - `vitest run`: **`68/68` tests PASS** (8 test files, `12.66s`, tăng +3 test so với R1 gồm 1 test PNG override badge trong `png.test.ts` và 2 test mới trong `m4-registration.test.tsx` cùng các khẳng định mở rộng cho `Q-007` & re-import).
   - `npm run fixtures:run`: **`6/6` fixtures PASS** (`fixtures/expected/*.expected.json` khớp 100%).
   - `npm run datasets:check`: **PASS** (`Dataset check passed (0 datasets)`).
2. **`npm run test:e2e`** (Task ID `task-87`, exit code `0`):
   - `playwright test`: **`19/19` E2E tests PASS** (`56.0s` trên Desktop Chrome), bao gồm `15` kịch bản M2/M3 regression (`apps/web/e2e/m3.spec.ts`) và `4` kịch bản E2E mới của M4 (`apps/web/e2e/m4.spec.ts`: `E2E-M4-01..04`).

### Bảng tổng hợp số lượng phát hiện theo mức độ nghiêm trọng

| Severity | Số lượng phát hiện (R1) | Đã xác minh sửa tại R1.1 (`6fd1506`) | Còn mở (Open) | Ghi chú |
| --- | --- | --- | --- | --- |
| `S0` (Catastrophic / Privacy Breach) | `0` | `0` | `0` | Ranh giới quyền riêng tư `ADR-0013` được đảm bảo chặt chẽ. |
| `S1` (Blocker / Core Failure) | `0` | `0` | `0` | Luồng import ĐKMH, preview 3 nhóm, tạo/cập nhật `"Phương án chính thức"`, warning badge và export TXT/MD/ICS/DOCX/PNG hoạt động đúng. |
| `S2` (Major / Edge-case Functional Defect) | `1` (`QA-M4-001`) | `1` (`verified-fixed`) | `0` | `findOverrideTargetSession` tự động rebind `sessionId` khi `.xlsx` mới dịch dòng `sourceRow`; `StalePlanNotice` hiển thị cảnh báo nếu buổi học bị cấu trúc lại không tương thích. |
| `S3` (Minor / Polish / Test Coverage Gap) | `2` (`QA-M4-002`, `QA-M4-003`) + `1` (`SEC-M4-001` từ G3b) | `3` (`verified-fixed`) | `0` | PNG export đã vẽ `★ ${overrideBadges}` + chi tiết `from → to`; `RegistrationImport` xóa preview cũ khi lỗi đọc file; `updateSettings` nối chuỗi vào `saveChainRef`; bổ sung test `Q-007` banner, re-import UI và giới hạn `splitRooms` / chọn bảng ĐKMH. |

---

## 2. Coverage Against Acceptance Criteria

| Requirement / AC ID | Mô tả yêu cầu | Trạng thái (R1 → R1.1) | Bằng chứng kiểm chứng (Files / Tests) |
| --- | --- | --- | --- |
| `AC-04` (`docs/QA_TEST_PLAN.md`) | Given registration HTML + base Excel timetable, when merged, then rooms/teachers/delivery modes update and non-matching classes are flagged cleanly. | `pass` | `packages/domain/src/registration-merge.ts`, `packages/domain/test/registration-merge.test.ts` (4 unit tests), `apps/web/src/m4-registration.test.tsx`, `apps/web/e2e/m4.spec.ts` (`E2E-M4-01`). |
| `AC-05` (`docs/QA_TEST_PLAN.md`) | Given a registration-merged timetable, when exported or reloaded, then room/teacher/delivery-mode overrides and unmapped warnings persist accurately. | `pass` | `packages/export/test/export.test.ts`, `apps/web/src/export/png.test.ts`, `apps/web/e2e/m4.spec.ts` (`E2E-M4-02`, `E2E-M4-03`). |
| `AC-M4-01` (`SPEC-M4-001`) | Privacy Boundary & Stripping: Không lưu/render/export/log MSSV, họ tên, ngày sinh, ngành, khóa, lớp hành chính, trạng thái ĐKMH, học phí, raw HTML. | `pass` | `packages/parser/src/vnu-registration-html-adapter.ts` (chỉ trích xuất 7 trường học phần), `scripts/lint.mjs` (`enforceRegistrationPrivacyBoundary`), `apps/web/src/m4-registration.test.tsx` (test canary `PII_SENTINEL_23029999` & `PII_STUDENT_NAME_NGUYEN_VAN_AN`), `apps/web/e2e/m4.spec.ts` (`E2E-M4-04`). |
| `AC-M4-02` (`SPEC-M4-001`) | 3-Bucket Reconciliation Preview: Phân loại chính xác Nhóm 1 (`matched` + `matched-with-overrides`), Nhóm 2 (`missing-section` + `schedule-mismatch` + `ambiguous-match`), Nhóm 3 (`dropped-from-registration`), không âm thầm tự đoán lớp, hỗ trợ nút `"Hủy"`. | `pass` | `packages/domain/src/registration-merge.ts` (`reconcileRegistration`), `apps/web/src/components/RegistrationImport.tsx`, `apps/web/e2e/m4.spec.ts` (`E2E-M4-01`). |
| `AC-M4-03` (`SPEC-M4-001`) | Official Plan Creation & Update (`Q-005`): Tạo `"Phương án chính thức"` (`role: "official"`), gắn badge `"CHÍNH THỨC"`, lưu `forkedFromPlanId` và không ghi đè phương án nháp gốc; khi đã có phương án chính thức thì cập nhật tại chỗ và bảo toàn các khóa học tự chọn không có trong bảng ĐKMH. | `pass` | `apps/web/src/model/registration.ts` (`commitRegistrationToPlans`), `apps/web/src/m4-registration.test.tsx` (test fork + test update giữ `CUSTOM101` + test UI re-import qua nút `"Cập nhật từ file ĐKMH"`), `apps/web/e2e/m4.spec.ts` (`E2E-M4-01`). |
| `AC-M4-04` (`SPEC-M4-001`) | Effective Override Rendering: Hiển thị giá trị hiệu lực cho phòng học, giảng viên, hình thức học cùng badge `"Đổi phòng từ ĐKMH"`, `"Đổi GV từ ĐKMH"`, `"Đổi hình thức từ ĐKMH"` và giữ giá trị gốc `.xlsx` trong chú thích phụ (`Gốc TKB: from → ĐKMH: to`). | `pass` | `apps/web/src/model/plan-view.ts` (`applySectionOverrides`, `buildScheduledBlocks`), `apps/web/src/components/Schedule.tsx`, `apps/web/e2e/m4.spec.ts` (`E2E-M4-01`, `E2E-M4-02`). |
| `AC-M4-05` (`SPEC-M4-001`) | Reload Persistence & Stale Timetable Rebase: Lưu/khôi phục đầy đủ `role`, `registrationOverlay`, `sectionOverrides`, `unmappedEntries` qua IndexedDB (`0.2.0`) và tự động миграция từ `0.1.0`; rebase đúng khi nạp `.xlsx` mới hơn kể cả khi dòng `sourceRow` dịch chuyển. | `pass` *(R1: `partial` do `QA-M4-001` → R1.1: `pass` tại `6fd1506`)* | Lưu/reload & migration `0.1.0 -> 0.2.0` PASS (`apps/web/src/m4-registration.test.tsx`, `E2E-M4-02`). Tại `6fd1506`, `findOverrideTargetSession` (`packages/domain/src/registration-merge.ts:232-254`) và `resolveOverrideTargets` (`apps/web/src/model/plan-view.ts:91-121`) tự động rebind `sessionId` khi `.xlsx` mới dịch dòng `sourceRow` và hiển thị cảnh báo trong `StalePlanNotice` nếu có override không tương thích (được kiểm chứng bởi unit test mới tại `apps/web/src/m4-registration.test.tsx:202-250`). |
| `AC-M4-06` (`SPEC-M4-001`) | Unmapped Entry Actionability: Hiển thị banner `"Cần xử lý N lớp từ ĐKMH"` trên phương án chính thức và nút `"Mở học phần trong danh sách chọn"` dẫn tới đúng học phần trong tab `"Xếp lịch & Tinh chỉnh"`. | `pass` | `apps/web/src/components/PlanSummary.tsx`, `apps/web/src/app/controller.ts` (`focusCourseInBuilder`), `apps/web/e2e/m4.spec.ts` (`E2E-M4-01`, `E2E-M4-02`). |
| `AC-M4-07` (`SPEC-M4-001`) | Export Fidelity: TXT, Markdown, ICS, Word (`.docx`) và PNG xuất từ phương án chính thức phản ánh đúng thông tin đã hợp nhất và nhãn ghi đè. | `pass` *(R1: `partial` do `QA-M4-002` → R1.1: `pass` tại `6fd1506`)* | TXT, Markdown, ICS, Word (`.docx`) PASS (`packages/export/test/export.test.ts`, `E2E-M4-03`). Tại `6fd1506`, `renderPng` (`apps/web/src/export/png.ts:126-137`) đã vẽ đầy đủ `★ ${overrideBadges.join(", ")}` cùng dòng chi tiết `from → to`, được kiểm chứng bởi `apps/web/src/export/png.test.ts:42-83`. |
| `AC-M4-08` (`SPEC-M4-001`) | Mobile / In-App Browser Guidance (`Q-007`): Hướng dẫn rõ cách tải file `.html`/`.htm` trên desktop & di động và hiển thị cảnh báo khi mở trong Zalo/Messenger/Facebook WebView. | `pass` | `apps/web/src/components/RegistrationImport.tsx` (`isInAppBrowser`), `apps/web/src/export/download.ts`, `apps/web/src/m4-registration.test.tsx:284-312` (test `isInAppBrowser` + test render banner cảnh báo trong `RegistrationImportPanel`). |

---

## 3. Automated & Manual Test Evidence

### 3.1. Unit & Integration Tests (`node --test` & `vitest`)
- `packages/domain/test/registration-merge.test.ts`:
  - Kiểm chứng đầy đủ 6 trạng thái đối chiếu (`matched`, `matched-with-overrides`, `missing-section`, `schedule-mismatch`, `ambiguous-match`, `dropped-from-registration`).
  - Kiểm chứng khớp theo `normalizedSectionCode`, fallback duy nhất theo `courseCode + classNumber`, phát hiện đa nghĩa (`ambiguous-match`) khi thiếu mã lớp và có ≥ 2 lớp cùng lịch, áp dụng override theo từng buổi (`sessionOverrides`) và lọc cảnh báo theo phương án đang chọn.
- `packages/export/test/export.test.ts`:
  - Kiểm chứng `formatScheduleAsText`, `formatScheduleAsMarkdown`, `generateIcsCalendar`, `generateWordDocument` hiển thị phòng/GV/hình thức hiệu lực từ `sectionOverrides`, nhãn `[Đổi phòng từ ĐKMH (Gốc TKB: 301-G2 -> ĐKMH: P.502-E5)]`, `[Đổi GV từ ĐKMH]`, `[Đổi hình thức từ ĐKMH]` và danh sách `"Cần kiểm tra thủ công từ ĐKMH"`.
- `apps/web/src/export/png.test.ts` *(Mới bổ sung tại R1.1 — `6fd1506`)*:
  - Kiểm chứng `renderPng` vẽ đúng nhãn `★ Đổi phòng từ ĐKMH, Đổi GV từ ĐKMH` trên dòng phòng học và dòng chi tiết `301-G2 → P.502-E5` cho các buổi học có override.
- `apps/web/src/m4-registration.test.tsx`:
  - Kiểm chứng migration `PlanStorageEnvelope` từ `0.1.0` sang `0.2.0` giữ nguyên dữ liệu cũ và mặc định `role: "draft"`.
  - Kiểm chứng round-trip IndexedDB cho phương án chính thức (`role: "official"`, `sectionOverrides`, `unmappedEntries`).
  - Kiểm chứng ranh giới quyền riêng tư (Privacy Canary): nạp HTML chứa `PII_SENTINEL_23029999`, `PII_STUDENT_NAME_NGUYEN_VAN_AN`, ngày sinh, lớp khóa học, trạng thái ĐKMH, học phí -> xác nhận toàn bộ state lưu trữ, DOM và nội dung xuất TXT/Markdown/ICS không chứa bất kỳ chuỗi PII nào.
  - Kiểm chứng luồng tạo mới (`fork-official`) và cập nhật tại chỗ (`update-official`) bảo toàn học phần tự chọn ngoài ĐKMH (`CUSTOM101`).
  - *(Mới tại R1.1 — `6fd1506`)* Kiểm chứng `rebasePlan` bảo toàn `sectionOverrides` khi bảng `.xlsx` mới dịch chuyển `sourceRow` (`INT2204 1:10:1-3` → `INT2204 1:42:1-3`).
  - *(Mới tại R1.1 — `6fd1506`)* Kiểm chứng `parseVnuRegistrationHtml` giới hạn độ dài chuỗi phòng (`MAX_ROOM_TEXT_LENGTH = 128`) và ưu tiên bảng có đủ 5 cột `REQUIRED_COLUMNS` khi trang HTML có bảng phụ có `border` đứng trước.
  - *(Mới tại R1.1 — `6fd1506`)* Kiểm chứng UI `RegistrationImportPanel` hiển thị banner cảnh báo in-app browser (`Q-007`) khi mở trong Zalo WebView và kiểm chứng luồng cập nhật lại từ nút `"Cập nhật từ file ĐKMH"` → `"Xác nhận cập nhật Phương án chính thức"`.

### 3.2. End-to-End Playwright Verification (`apps/web/e2e/m4.spec.ts`)
- `E2E-M4-01`: Nạp `.xlsx` -> tạo phương án nháp -> chuyển sang tab `"So khớp ĐKMH"` -> nạp file `.html` ĐKMH -> kiểm tra 3 nhóm preview (`Khớp hoàn toàn & tự động cập nhật`, `Cần kiểm tra thủ công`, `Có trong phương án nhưng không có trong ĐKMH`) -> bấm `"Xác nhận tạo Phương án chính thức"` -> kiểm tra tab `"Phương án chính thức ★"`, badge `"CHÍNH THỨC"`, khối lịch hiển thị phòng mới `P.502-E5`, badge `"Đổi phòng từ ĐKMH"`, `"Đổi GV từ ĐKMH"` và thao tác bấm `"Mở học phần trong danh sách chọn"` từ danh sách cảnh báo.
- `E2E-M4-02`: Reload trình duyệt (`page.reload()`) -> kiểm tra `"Phương án chính thức"` tự động khôi phục từ IndexedDB cùng toàn bộ override (`P.502-E5`, `TS. Trần Thị B`, `Trực tuyến`) và banner `"Cần xử lý 1 lớp từ ĐKMH"`.
- `E2E-M4-03`: Mở modal `"Xuất thời khóa biểu"` trên `"Phương án chính thức"` -> kiểm tra nội dung xuất văn bản/Markdown chứa thông tin đã ghi đè, nhãn `[Đổi phòng từ ĐKMH]` và mục `"Cần kiểm tra thủ công từ ĐKMH"`, đồng thời kiểm tra tải file `.ics`, `.docx`, `.png`.
- `E2E-M4-04`: Nạp file HTML có chứa chuỗi nhạy cảm (`23029999`, `NGUYEN VAN AN PII CHECK`, `K68-CNTT-CLC`, `1.250.000`) -> kiểm tra `document.body.innerText` và toàn bộ bản ghi IndexedDB (`vnu-tkb-engine.plans`) hoàn toàn không chứa bất kỳ chuỗi PII nào.

---

## 4. Defect List

### `QA-M4-001` — Mất ghi đè ĐKMH (`sectionOverrides`) mà không có cảnh báo khi rebase phương án chính thức sang file `.xlsx` thời khóa biểu mới có thay đổi số dòng (`sourceRow`)
- **Severity:** `S2` (Major — ảnh hưởng đến một phần yêu cầu `AC-M4-05`: *"and rebases cleanly when a newer `.xlsx` timetable is imported"*)
- **Status:** `verified-fixed` (tại commit `6fd1506`)
- **Location:**
  - `packages/domain/src/registration-merge.ts:232-287` (`findOverrideTargetSession`, `applySectionOverrides`)
  - `apps/web/src/model/plan-view.ts:91-121, 146-218` (`resolveOverrideTargets`, `rebasePreview`, `rebasePlan`)
  - `apps/web/src/components/PlanSummary.tsx:43-47` (`StalePlanNotice`)
- **Mô tả & Hiện trạng ban đầu (tại R1 — `12abdbd`):**
  1. Trong `packages/parser/src/vnu-xlsx-adapter.ts:392`, mỗi buổi học (`Session`) được sinh `id` theo mẫu `${sectionId}:${row.sourceRow}:${periodRange.start}-${periodRange.end}` (phụ thuộc trực tiếp vào chỉ số dòng `sourceRow` trong file `.xlsx`).
  2. Khi người dùng import kết quả ĐKMH, `reconcileRegistration` lưu `sessionOverrides` gắn với `sessionId` của file `.xlsx` hiện tại.
  3. Khi nhà trường phát hành file `.xlsx` cập nhật (ví dụ thêm/xóa các lớp học phần ở những dòng phía trên khiến `sourceRow` của lớp `INT2204 1` dịch từ dòng `14` xuống dòng `18`, dù thứ/tiết không đổi), `session.id` trong dataset mới đổi thành `INT2204 1:18:1-3`.
  4. Khi người dùng bấm `"Cập nhật theo dữ liệu mới"` (`rebasePlan`), `rebasePlan` chỉ lọc `plan.sectionOverrides` theo `sectionId` mà **không ánh xạ lại `sessionId`** theo buổi học mới, và `applySectionOverrides` chỉ tra cứu khớp tuyệt đối `override.sessionId === session.id`. Hệ quả là mọi ghi đè phòng học, giảng viên, hình thức học từ ĐKMH bị rơi vào trạng thái mồ côi và biến mất âm thầm.
- **Cách khắc phục & Bằng chứng xác minh tại R1.1 (`6fd1506`):**
  1. Đã bổ sung hàm `findOverrideTargetSession(section, targetSessionId, sessionOverrides)` trong `packages/domain/src/registration-merge.ts:232-254`: ưu tiên khớp trực tiếp `session.id === targetSessionId`, sau đó fallback sang buổi học duy nhất có cùng hậu tố tiết (`:${start}-${end}`) và khớp giá trị `from`/`to` của các trường override.
  2. Đã tích hợp `findOverrideTargetSession` vào cả `applySectionOverrides` (`packages/domain/src/registration-merge.ts:256-287`) và `resolveOverrideTargets` trong `rebasePreview` / `rebasePlan` (`apps/web/src/model/plan-view.ts:91-121, 168-211`) để tự động cập nhật `sessionId` sang `targetSession.id` mới khi rebase.
  3. Đã bổ sung trường `droppedOverrides?: string[]` vào `RebasePreview` và hiển thị cảnh báo tường minh trong `StalePlanNotice` (`apps/web/src/components/PlanSummary.tsx:43-47`) nếu cấu trúc buổi học của lớp bị thay đổi không tương thích.
  4. Đã bổ sung unit test `"rebases official plan overrides cleanly when a newer xlsx shifts sourceRow inside session.id"` tại `apps/web/src/m4-registration.test.tsx:202-250` (`PASS`).

---

### `QA-M4-002` — Bản xuất ảnh PNG (`renderPng`) chưa hiển thị nhãn/badge báo hiệu buổi học có ghi đè từ ĐKMH
- **Severity:** `S3` (Minor — ảnh hưởng nhẹ tới tính đầy đủ trực quan của `AC-M4-07` trên định dạng PNG)
- **Status:** `verified-fixed` (tại commit `6fd1506`)
- **Location:** `apps/web/src/export/png.ts:126-137`, `apps/web/src/export/png.test.ts:42-83`
- **Mô tả & Hiện trạng ban đầu (tại R1 — `12abdbd`):**
  - Theo `SPEC-M4-001` (`AC-M4-07`): *"Exporting the official plan to TXT, Markdown, ICS, Word (`.docx`), or PNG reflects the merged rooms, teachers, delivery modes, and override badges."*
  - Ở `12abdbd`, `renderPng` vẽ đúng phòng hiệu lực (`block.room`), giảng viên hiệu lực (`block.teacher`) và hình thức hiệu lực (`block.deliveryMode`), nhưng bỏ qua `block.overrideBadges` và `block.overrides`.
- **Cách khắc phục & Bằng chứng xác minh tại R1.1 (`6fd1506`):**
  - `renderPng` (`apps/web/src/export/png.ts:126-137`) đã được cập nhật để ghép `★ ${block.overrideBadges.join(", ")}` ngay trên dòng thông tin phòng học và vẽ thêm dòng chi tiết `from → to` (`overrideDetailText`) cho các khối nhiều tiết.
  - Đã bổ sung unit test `"renders registration override badges and details on PNG blocks"` tại `apps/web/src/export/png.test.ts:42-83` (`PASS`).

---

### `QA-M4-003` — Góp ý nhỏ về độ bền UI/Controller và độ phủ test cho banner In-App Browser (`Q-007`) & luồng Re-import UI
- **Severity:** `S3` (Minor / Polish & Test Coverage)
- **Status:** `verified-fixed` (tại commit `6fd1506`)
- **Location:**
  - `apps/web/src/components/RegistrationImport.tsx:80`
  - `apps/web/src/app/controller.ts:174-207`
  - `apps/web/src/m4-registration.test.tsx:284-364`
- **Mô tả & Hiện trạng ban đầu (tại R1 — `12abdbd`):**
  1. **Stale preview khi nạp file lỗi tiếp theo:** Trong `RegistrationImport.tsx`, khi lần nạp file thứ hai gặp ngoại lệ trong khối `catch`, `setPreview(undefined)` chưa được gọi nên màn hình vẫn hiển thị preview của file hợp lệ trước đó bên dưới thông báo lỗi.
  2. **Thứ tự ghi `updateSettings` trong `controller.ts`:** Trong `selectSlot` và `applyRegistrationImport`, `updateSettings` được gọi trực tiếp ngoài `saveChainRef.current`.
  3. **Khoảng trống test nhỏ:** Chưa có unit test cho `isInAppBrowser()` / banner cảnh báo in-app browser (`Q-007`) và thao tác bấm nút `"Cập nhật từ file ĐKMH"` trên UI.
- **Cách khắc phục & Bằng chứng xác minh tại R1.1 (`6fd1506`):**
  1. Đã thêm `setPreview(undefined)` trong khối `catch` của `RegistrationImport.tsx:80`.
  2. Đã đưa `updateSettings` vào chuỗi `saveChainRef.current` trong cả `selectSlot` và `applyRegistrationImport` (`apps/web/src/app/controller.ts:174-207`).
  3. Đã bổ sung kiểm thử `isInAppBrowser`, kiểm thử hiển thị banner cảnh báo Zalo WebView trong `RegistrationImportPanel` và kiểm thử luồng cập nhật `"Cập nhật từ file ĐKMH"` → `"Xác nhận cập nhật Phương án chính thức"` tại `apps/web/src/m4-registration.test.tsx:284-364` (`PASS`).

---

### `SEC-M4-001` (Đồng bộ từ `G3b` — `SEC-REVIEW-M4-001`) — Giới hạn độ dài `splitRooms` và ưu tiên bảng có đủ 5 cột `REQUIRED_COLUMNS` trong `vnu-registration-html-adapter.ts`
- **Severity:** `S3` (Low / Hardening từ báo cáo `G3b`)
- **Status:** `verified-fixed` (tại commit `6fd1506`)
- **Location:** `packages/parser/src/vnu-registration-html-adapter.ts:141-151, 282-287`, `apps/web/src/m4-registration.test.tsx:252-280`
- **Bằng chứng xác minh tại R1.1 (`6fd1506`):**
  - `splitRooms` đã giới hạn đầu vào ở `MAX_ROOM_TEXT_LENGTH = 128` trước khi chạy biểu thức chính quy phân tách phòng học, và hàm chọn bảng trong `parseVnuRegistrationHtml` đã ưu tiên bảng ứng viên chứa đầy đủ 5 cột bắt buộc (`REQUIRED_COLUMNS`), được kiểm chứng bởi unit test tại `apps/web/src/m4-registration.test.tsx:252-280` (`PASS`).

---

## 5. Gate Recommendation

- **Đề xuất của Tester cho Gate `G3a`:** **`qa-pass`** *(Nâng từ `qa-pass-with-follow-up` ở R1 lên `qa-pass` sau khi xác minh R1.1 tại commit `6fd1506`)*
  - **Lý do:**
    1. Toàn bộ các tiêu chí nghiệm thu của M4 (`AC-M4-01..08`, `AC-04`, `AC-05`, `FR-09`, `FR-10`, `Q-005`, `Q-007`) hiện đều đạt `pass` hoàn toàn.
    2. Toàn bộ các phát hiện từ vòng R1 (`QA-M4-001` mức `S2`, `QA-M4-002` mức `S3`, `QA-M4-003` mức `S3`) cũng như phát hiện bảo mật `SEC-M4-001` (`S3` từ `G3b`) đã được khắc phục triệt để tại commit `6fd1506` và có bài kiểm thử tự động đi kèm.
    3. Bộ kiểm thử tự động trên `6fd1506` vượt qua 100%: `102/102` node tests, `68/68` Vitest component/integration tests, `6/6` fixture snapshots, và `19/19` Playwright E2E tests.
- **Lưu ý quản trị (Governance Note):** Quyết định `qa-pass` trên đây là đề xuất kỹ thuật của subagent `Tester` (`G3a`). Quyền phê duyệt đóng cổng chính thức (final gate sign-off) thuộc về **human Owner**.
