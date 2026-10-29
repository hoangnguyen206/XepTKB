# M3 spec — Core UI & export

> **Artifact ID:** `SPEC-M3-001`  
> **Artifact status:** `ready`  
> **Canonical gate:** `G0`  
> **Owner:** Product Spec  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [Implementation plan §2/§4](../IMPLEMENTATION_PLAN.md), [PRD](../PRD.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [M3 design handoff](M3-DESIGN-HANDOFF.md)  
> **Evidence envelope:** [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md)  
> **Decision actor / UTC timestamp:** Owner yêu cầu triển khai M3 trong phiên làm việc 2026-10-25; chưa có G0 sign-off chính thức (actor/date) — xem mục 9  
> **Receiving owner / acknowledgement:** Frontend/Coder (implementation), Tester, Security Reviewer, Independent Reviewer — pending

## 1. Source and traceability

- Source: `IMPLEMENTATION_PLAN.md` §2 hàng M3 và §4 bước 1–7; `PRD.md` §4 P0 #2–#8, #11, #12, §5 journey bước 1–6, §6 FR-01–FR-08, FR-11, §7 AC-01, AC-06, AC-07, §8 NFR; `DOMAIN_MODEL.md` §§3–9; `TECH_STACK.md` §1, §5; `API_AND_DATA_CONTRACTS.md` §3; `SECURITY_PRIVACY.md` §§2, 5, 7; `QA_TEST_PLAN.md` §§2, 5.
- Product decisions dùng trong M3: Q-001 (week1 theo cohort, user sửa được), Q-002 (export `.doc` HTML + PNG + ICS + print CSS, không PDF generator), Q-005 (UI P0 có slot nháp; slot chính thức thuộc M4), Q-007 (browser matrix + nudge in-app browser cho download), Q-008 (không analytics bên thứ ba), Q-009 (`ONL` không có giờ cố định, vẫn tính tín chỉ), Q-010.
- Requirement IDs (P0): FR-01, FR-02, FR-03, FR-04, FR-06, FR-07, FR-08, FR-11; PRD §4 #2–#8, #11, #12. FR-09/FR-10 (registration) là M4; FR-12 (admin ingest) là M5.

## 2. Outcome

Sinh viên mở app trên điện thoại hoặc máy tính, chọn kỳ và tuần 1, tìm môn, chọn lớp/nhóm, thấy conflict theo tuần kèm giải thích, xem lịch theo tuần và theo ngày, lưu phương án trên máy (dùng được offline) và xuất `.ics`/PNG/Word hoặc in A4 ngang. Dataset được nạp qua artifact manifest có kiểm tra hash/schema/provenance.

## 3. Scope

### In scope

- Web app `apps/web` (React + Vite) theo ADR-0001/ADR-0010.
- Artifact loader + validator cho manifest/timetable/metadata (contract cụ thể hóa ở ADR-0010 §2), cache trong IndexedDB.
- Dataset mẫu **tổng hợp (synthetic)** sinh từ workbook giả qua adapter `uet-xlsx`, gắn nhãn rõ trong UI và mọi file export.
- Onboarding: trường (UET), kỳ, week1 theo cohort hoặc tự nhập ngày (C-08).
- Search + section picker + chọn nhóm + conflict explanation + campus warning.
- Lưới tuần (T2–T7, thêm CN khi có buổi CN), danh sách theo ngày, chọn tuần, tổng tín chỉ.
- Plan nháp lưu IndexedDB, có `schemaVersion` và migration; xóa dữ liệu trên máy.
- Export ICS, PNG, Word (`.doc` HTML) và print CSS A4 ngang.
- Hiển thị provenance/version/status; cảnh báo dataset cũ (stale) và rebase phương án.
- Offline view (service worker cho app shell + IndexedDB cho dataset/Plan).
- Package `packages/export` (pure TS) cho ICS/Word/bố cục lưới/định dạng hiển thị.

### Out of scope

- M4: file picker kết quả đăng ký, preview, merge, slot Plan chính thức, nhãn “phòng/giờ đã đổi”.
- M5: admin ingest/publish/rollback, CDN/catalog thật, PWA hardening (install prompt, update strategy production), observability, performance budget chính thức.
- P1: share link, nhiều Plan nháp, lịch thi, màn hình Hôm nay riêng.
- Analytics (Q-008 cần legal review trước khi bật).
- Dữ liệu UET thật.

## 4. Actors và assumptions

- Actors: sinh viên (mobile/desktop), người kiểm thử.
- Assumptions/decisions trong M3 (cần Product xác nhận ở G0):
  - **D-M3-1 (đóng C-08):** onboarding có hai đường — chọn khóa (week1 lấy từ `Term.starts[]`) hoặc tự nhập ngày Thứ Hai của tuần 1; ngày không phải Thứ Hai bị từ chối.
  - **D-M3-2 (C-02):** cảnh báo thiếu/vượt tín chỉ chỉ chạy khi `metadata.creditPolicy` có cấu hình; dataset mẫu không có cấu hình nên chỉ hiện tổng tín chỉ. Không tự đặt ngưỡng.
  - **D-M3-3:** bản build production chỉ nạp dataset `published`; bản dev/preview cho phép `candidate`/`validated` kèm banner không tắt được. `retracted` không bao giờ được nạp.
  - **D-M3-4:** user được phép chọn lớp đang conflict (sinh viên có thể cố ý chọn trùng một phần tuần), nhưng conflict luôn hiện rõ ở picker, lưới và tóm tắt phương án.
- Dependency: M2 domain engine (search/Plan/conflict/week-date/credits); artifact manifest contract (cụ thể hóa trong ADR-0010).

## 5. Flow

1. Mở app → loader tải `data/manifest.json`, chọn dataset hợp lệ, kiểm tra hash/schema, cache vào IndexedDB.
2. Chưa có Plan cho kỳ → onboarding: chọn kỳ, chọn khóa hoặc nhập ngày tuần 1 → tạo Plan nháp.
3. Tìm môn theo mã/tên (không dấu) → danh sách lớp kèm buổi học, tuần, phòng, giảng viên, lớp khóa, trạng thái ONL.
4. Chọn lớp (và nhóm nếu có) → conflict preview hiện trước khi chọn; sau khi chọn, lưới/danh sách/tổng tín chỉ cập nhật và Plan được lưu.
5. Xem lưới tuần hoặc danh sách theo ngày cho tuần được chọn; buổi không có giờ cố định hiện riêng.
6. Xuất ICS/PNG/Word hoặc In; app nhắc đối chiếu với cổng trường.

### Error/empty/loading/stale states

- Đang tải dữ liệu; không tải được và chưa có cache (lần đầu offline); artifact sai hash/schema (giữ cache cũ, báo lỗi); dataset chưa duyệt (banner); dataset mẫu (banner); offline (đang dùng bản đã lưu); Plan tạo từ dataset version khác (stale + rebase); tìm kiếm không có kết quả; Plan rỗng; bản app mới sẵn sàng (banner tải lại); trình duyệt trong app (nudge mở bằng trình duyệt trước khi tải file).

## 6. Contract

- Artifact manifest/timetable/metadata: ADR-0010 §2 (manifest `schemaVersion` `1.0`, domain schema `0.2.0`).
- Plan lưu local: domain `Plan` (`0.2.0`) bọc trong envelope `{ schemaVersion, storedAt, plan }`; migration theo DOMAIN_MODEL §9.
- Export: ICS RFC 5545 (UTF-8, CRLF, folding 75 octet), Word `.doc` HTML, PNG từ canvas.
- Không có input chứa PII trong M3; không có request nào ngoài same-origin `data/*` và tài nguyên app.

## 7. Acceptance and NFR

- **AC-M3-01 — onboarding hai đường:** Given dataset có `Term.starts`, When user chọn khóa thì week1 = ngày cấu hình của khóa; When user nhập ngày, Then ngày phải là Thứ Hai (báo lỗi nếu không) và được lưu làm override; Plan nháp được tạo và còn sau khi tải lại.
- **AC-M3-02 — search/picker:** Given dataset, When tìm `giai tich` hoặc một mã môn, Then kết quả có tên gốc có dấu và mỗi lớp hiện Mã LHP, nhóm, thứ, tiết + giờ, tuần, phòng/campus, giảng viên, lớp khóa và nhãn ONL; lớp nhiều nhóm bắt chọn nhóm.
- **AC-M3-03 — conflict explanation (AC-01):** Given đã chọn lớp A, When xem lớp B giao cả tiết và tuần với A, Then B hiện “Trùng lịch” bằng chữ (không chỉ màu) kèm mã lớp, thứ, tiết, tuần giao nhau; nếu tuần không giao thì không báo conflict; buổi liền kề khác campus hiện cảnh báo di chuyển.
- **AC-M3-04 — lưới/ngày:** lưới tuần đặt đúng thứ × tiết cho tuần được chọn, buổi trùng có ký hiệu chữ; buổi không giờ cố định (ONL) không chiếm ô mà liệt kê riêng; danh sách theo ngày có ngày dương lịch theo week1.
- **AC-M3-05 — responsive/a11y:** ở 360/768/1200 px không có thanh cuộn ngang của trang (lưới cuộn trong vùng riêng); axe (WCAG 2.1 A/AA) không có vi phạm `serious`/`critical`; luồng tìm → chọn → xuất làm được chỉ bằng bàn phím; focus luôn nhìn thấy.
- **AC-M3-06 — lưu/offline:** Plan còn sau khi tải lại; sau lần tải online đầu tiên, tải lại khi offline vẫn xem được Plan và lịch kèm chỉ báo offline; “Xóa dữ liệu trên máy” xóa Plan, cache dataset và cache app.
- **AC-M3-07 — artifact integrity:** artifact sai sha256, sai school/term/version, schema không hỗ trợ hoặc vi phạm invariant domain bị từ chối, cache cũ được giữ và lỗi hiển thị; `retracted` không được nạp; dữ liệu chưa `published` chỉ được nạp ở bản dev/preview kèm banner.
- **AC-M3-08 — provenance:** UI hiện dataset version, trạng thái nguồn (chính thức/dự kiến/mẫu), mã văn bản nguồn, parser version, thời điểm import/review, status pipeline, hash rút gọn, và tuyên bố “công cụ độc lập của sinh viên, không phải sản phẩm của nhà trường; đối chiếu với cổng trường”.
- **AC-M3-09 — ICS (AC-06, AC-07):** mỗi buổi cố định tạo một VEVENT cho mỗi tuần học của nó (buổi học 3 tuần lẻ → đúng 3 event); ngày = `week1 + (week-1)*7 + (day-2)`; giờ theo khung tiết, quy đổi `Asia/Ho_Chi_Minh` (UTC+7, không DST) sang UTC; lịch có tên Plan, kỳ, dataset version, nguồn; không có buổi ONL; không có PII.
- **AC-M3-10 — PNG/Word/In:** PNG có lưới tuần + tên Plan, kỳ, version, nguồn, tuyên bố; Word `.doc` (HTML) có bảng buổi học + cùng metadata, mọi chuỗi được escape; In dùng `@page` A4 ngang và ẩn điều khiển.
- **AC-M3-11 — tín chỉ:** mỗi môn cộng một lần; môn thiếu tín chỉ hiện “chưa rõ”, không tính là 0; ngưỡng chỉ khi có `creditPolicy`.
- **AC-M3-12 — stale Plan:** Plan có `datasetVersion` khác dataset đang dùng → banner; user chọn “Cập nhật” thì thấy lớp không còn tồn tại trước khi xác nhận.
- **AC-M3-13 — privacy/XSS:** app chỉ gửi request same-origin; không analytics; chuỗi từ dataset (kể cả payload HTML) hiện dưới dạng chữ; CSP chặn script inline ở bản build.
- NFR: tìm kiếm p95 < 100 ms và conflict p95 < 50 ms với dataset ~1.000 lớp trên máy dev (đo sơ bộ; ngân sách chính thức là M5).

## 8. Test/evidence plan

- Unit: `packages/export` (node:test) cho ICS/Word/lưới/định dạng; `apps/web` (Vitest + jsdom) cho loader, lưu trữ/migration, model, component.
- E2E: Playwright (Chromium; WebKit smoke nếu có browser) cho luồng chính, viewport 360/768/1200, axe, bàn phím, tải lại/offline, tải file ICS/PNG/Word.
- Fixture: chỉ dataset synthetic sinh bằng `scripts/build-synthetic-dataset.mjs`.
- Thủ công (owner): import ICS vào ít nhất một ứng dụng lịch; xem PNG/Word/bản in; thử trên điện thoại thật Tier 1.

## 9. Handoff and G0 decision

- Implementer: Frontend/Coder (phiên agent). Tester/Security/Reviewer: agent độc lập theo role (không phải sign-off của người).
- Definition of Ready: `ready` theo nội dung spec; các quyết định D-M3-1…4 là giả định chờ Product xác nhận.
- G0 decision: `g0-blocked` về hình thức cho tới khi Product ghi actor/date; owner đã yêu cầu triển khai M3 trong phiên 2026-10-25, nên implementation tiến hành và mọi thay đổi cần Product xác nhận được liệt kê trong handoff.
- Trạng thái sau G3 (2026-10-25): AC-M3-03 và AC-M3-12 **chưa đạt** ở kịch bản dataset mới đổi nhóm của lớp đã chọn (QA-M3-001 = REV-M3-001, S1); AC-M3-06, -07, -11 có finding S2/S3. Danh sách đầy đủ và điều kiện chạy lại G3: [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md). Spec không đổi; các quyết định D-M3-1…4 vẫn chờ Product.
