# Product Requirements Document — Kỳ Này

> **Status:** draft / proposed  
> **Owner:** Product Spec  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Implementation plan](IMPLEMENTATION_PLAN.md), [Domain model](DOMAIN_MODEL.md), [Parser spec](PARSER_SPEC.md), [QA plan](QA_TEST_PLAN.md)

## 1. Tóm tắt

Kỳ Này là web app/PWA giúp sinh viên UET xếp thời khóa biểu từ dữ liệu TKB do trường phát hành. Người dùng tìm môn, chọn lớp/nhóm, thấy conflict theo cả thời gian và tuần, xem lịch trên điện thoại hoặc máy tính, rồi xuất lịch dùng hằng ngày. Sau khi đăng ký, người dùng có thể tải file kết quả đăng ký lên; app chỉ đọc phần lịch học trên máy để tạo TKB cuối cùng, không giữ thông tin cá nhân.

MVP không cần tài khoản và không tự động đăng ký môn. Server chủ yếu phát dataset JSON đã duyệt; xử lý file cá nhân, conflict và export ưu tiên chạy local.

## 2. Problem và cơ hội

- File TKB dài khoảng 1.800 dòng, khó tìm trên điện thoại.
- Tên cột, số cột, header row, cách ghi ca/tuần/ghi chú thay đổi giữa các kỳ.
- Sinh viên dễ chọn trùng giờ, trùng tuần, sai nhóm hoặc không biết phòng đã đổi.
- TKB không chỉ là nhu cầu mùa đăng ký: lịch học hằng ngày, lịch thi, GPA và nhóm học có thể tạo retention.

### Jobs to be done

1. Khi trường phát TKB, sinh viên muốn lọc nhanh các lớp phù hợp với ngành/lớp khóa.
2. Khi chọn nhiều môn, sinh viên muốn biết ngay lớp nào trùng theo đúng tuần học, không chỉ theo thứ/ca.
3. Khi đã đăng ký, sinh viên muốn có lịch cuối cùng đúng phòng/giờ và dùng được trên điện thoại.
4. Khi sắp đi học hoặc đi thi, sinh viên muốn xem hôm nay có gì mà không phải mở file gốc.

## 3. Mục tiêu và thước đo

### Mục tiêu release đầu

- Sinh viên UET có thể tạo một Plan hoàn chỉnh từ dataset học kỳ mà không cần tài khoản.
- Parser xử lý các fixture UET đã chọn, có provenance và được admin duyệt.
- Conflict engine đúng với giao `day × period × weeks`, bao gồm lớp chỉ học một số tuần.
- File registration result được parse local, PII không rời thiết bị.
- App usable ở 360px và desktop; export `.ics` đáng tin cậy.

### KPI đề xuất

| KPI | Định nghĩa | Mục tiêu ban đầu |
| --- | --- | --- |
| Plan creation | số Plan được lưu local trong mùa | baseline bằng analytics privacy-safe |
| Core completion | tỷ lệ người bắt đầu và xuất được lịch | ≥ 70% trong usability sample |
| Parser publish quality | fixture được parse và validate không blocker | 100% fixture release |
| Conflict correctness | case đúng / tổng case golden | 100% case lõi |
| Retention | người quay lại hằng tuần sau 1 tháng | baseline, đặt target sau beta |
| PWA/ICS usefulness | tỷ lệ export hoặc add-to-calendar | đo, không ép opt-in |

Không dùng KPI để khuyến khích thu thập PII. Không fingerprint người dùng khi chưa có consent rõ ràng.

## 4. Phạm vi

### P0 — bắt buộc cho MVP

1. Dataset TKB UET admin preload, versioned; có trang admin upload/review/publish.
2. Chọn trường/kỳ/ngày đầu tuần 1; mặc định theo cohort (K67–K70: 07/09/2026, K71: 12/10/2026 cho fixture nêu trong brief), cho phép sửa.
3. Tìm môn theo mã/tên, không phụ thuộc dấu.
4. Hiển thị Section: Mã LHP, nhóm, thứ, tiết/ca, tuần, phòng/campus, giảng viên, trạng thái online và thông tin lớp khóa.
5. Chọn lớp/nhóm; báo conflict theo giờ và tuần, nêu nguyên nhân cụ thể.
6. Lưới tuần T2–T7 và danh sách theo ngày; có nền tảng để mở rộng Chủ nhật.
7. Tổng tín chỉ và một Plan hiện tại tối thiểu theo local storage; nhiều phương án A/B/C là P1 nếu không làm trễ core.
8. Responsive: mobile 360px, tablet 768px, desktop ≥1200px.
9. Upload file kết quả đăng ký `.doc`/HTML local; bỏ PII, merge vào Plan.
10. Registration override phòng/giờ mới hơn TKB được ưu tiên và gắn nhãn “đã đổi”.
11. Export PNG, Word, `.ics`; PDF có thể giữ trong P0 nếu implementation xác nhận không ảnh hưởng mốc, nếu không cắt trước Word.
12. Hiển thị dataset version, thời điểm cập nhật, nguồn văn bản và cảnh báo đối chiếu với cổng trường.

### P1 — sau khi core ổn định

- Đọc kế hoạch học tập PDF để suy ra week 1 theo cohort.
- Share link read-only.
- Khung giờ tùy chỉnh theo trường.
- Lịch thi, màn hình Hôm nay, deadline và thông báo.
- Nhiều Plan/share tốt hơn nếu có bằng chứng nhu cầu.

### P2 / ngoài critical path

- PDF TKB lệch cột/scan.
- Parser cho trường khác.
- Nhóm giờ rảnh, ghép đổi lớp, dhqg.xyz, Premium, LLM trợ lý, email intake, Chrome extension.

### Non-goals của MVP

- Không đăng nhập cổng sinh viên hoặc tự submit đăng ký.
- Không yêu cầu tài khoản/Google sync.
- Không hiện review tự do của giảng viên; chỉ cân nhắc số liệu đã thỏa thuận ở giai đoạn sau.
- Không tự động coi dữ liệu AI là đúng.
- Không cam kết là dữ liệu chính thức của UET/VNU.

## 5. Personas và journey

### Persona chính: sinh viên UET đang xếp môn

Thiết bị thường là điện thoại, có thể có file/ảnh từ group lớp. Họ cần tốc độ, thông tin phòng/tuần rõ ràng và không muốn nhập dữ liệu dài.

### Journey P0

1. Mở app → chọn UET, học kỳ, cohort (tùy chọn) → xác nhận week 1.
2. Tìm mã/tên môn → xem các Section phù hợp.
3. Chạm Section → nếu có group, chọn nhóm; các lựa chọn conflict mờ và giải thích.
4. Xem Plan ở list/day/grid; kiểm tra tín chỉ và campus transition.
5. Lưu Plan hiện tại; nhiều phương án A/B/C và share link là P1 nếu không làm trễ core.
6. Xuất PNG/Word/ICS; app nhắc đối chiếu trên cổng trường.
7. Sau khi đăng ký: chọn file `.doc` trên thiết bị → parser hiện preview không PII → user xác nhận → merge và đánh dấu override.

## 6. Functional requirements

| ID | Requirement | Priority | Acceptance evidence |
| --- | --- | --- | --- |
| FR-01 | Load dataset theo school/term/version và hiện provenance | P0 | artifact contract + UI test |
| FR-02 | Search mã/tên không dấu, alias mã môn | P0 | unit/property tests |
| FR-03 | Chọn Section và group, giữ nhiều session | P0 | domain tests + UI flow |
| FR-04 | Conflict theo periods giao nhau và weeks giao nhau | P0 | golden matrix 100% |
| FR-05 | Note có “Học tiết …” override Ca | P0 | parser fixture |
| FR-06 | Section ONL/đồ án không chiếm ô grid | P0 | domain/UI test |
| FR-07 | Xem day list và week grid, responsive | P0 | visual/accessibility evidence |
| FR-08 | Tính tổng tín chỉ và cảnh báo thiếu/vượt nếu cấu hình | P0 | unit/UI test |
| FR-09 | Parse registration result trên browser, loại PII | P0 | security test + manual evidence |
| FR-10 | Registration room/time override TKB, mark changed | P0 | merge fixture |
| FR-11 | Export PNG, DOCX, ICS với timezone đúng | P0 | artifact snapshots + calendar import |
| FR-12 | Admin ingest versioned, validate, review, publish/rollback | P0 | runbook drill |
| FR-13 | Study-plan PDF → week 1 | P1 | parser fixture |
| FR-14 | Read-only share link | P1 | API/security test |
| FR-15 | Custom time frame | P1 | schema + UI test |

## 7. Acceptance criteria trọng yếu

### AC-01 — conflict theo tuần

- **Given** Section A học T3 tiết 4–6 tuần 1–15 và B học T3 tiết 5–7 tuần 8–10
- **When** user chọn A rồi xem B
- **Then** B bị đánh dấu conflict vì giao period 5–6 và giao weeks 8–10, nêu đủ mã lớp/thứ/tiết/tuần.

Nếu tuần không giao nhau thì không báo time conflict dù cùng thứ/tiết.

### AC-02 — parse header/merged cells

- **Given** file có header ở dòng 1 hoặc 4, tên `GĐ`/`Giảng đường`, ô gộp và subtotal row
- **When** admin chạy parser
- **Then** parser tìm header theo canonical field, fill-down ô gộp, bỏ dòng không có Mã LHP hợp lệ và tạo Section/Session có raw provenance.

### AC-03 — note override

- **Given** Ca = 2 và ghi chú “Học tiết 9-12”
- **When** normalize session
- **Then** startPeriod/endPeriod = 9/12, giữ raw note và warning/trace explaining override.

### AC-04 — registration local-only

- **Given** `.doc` chứa họ tên, ngày sinh, mã sinh viên và các lớp
- **When** user chọn file
- **Then** browser parse, preview chỉ giữ môn/lớp/giờ/phòng cần thiết; không có network request chứa file/PII; khi reload hoặc delete, dữ liệu user có thể xóa.

### AC-05 — registration override

- **Given** TKB có phòng cũ và registration result có phòng mới
- **When** merge
- **Then** room/time từ registration thắng, Section có `source=registration`, `overrides[]` và UI hiển thị “phòng đã đổi”.

### AC-06 — week 1 / date

- **Given** cohort có ngày week 1 hoặc user chọn ngày
- **When** app dựng ICS
- **Then** ngày session được tính bằng `week1 + (week - 1) * 7` theo timezone `Asia/Ho_Chi_Minh`; không đọc các ngày bị lỗi gõ trong bảng kế hoạch khi đã có week 1 chuẩn.

### AC-07 — export

- PNG/Word/ICS phải chứa tên Plan, kỳ, nguồn/version, thông tin lịch và không chứa PII không cần thiết.
- ICS import được vào ít nhất một calendar client thử nghiệm; session tuần lẻ tạo đúng số event.

## 8. NFR

- **Performance:** first useful timetable với dataset UET đã cache không chặn tương tác; search phản hồi mục tiêu <100ms trên thiết bị tầm trung sau khi index tải.
- **Availability:** static dataset/CDN có cache; app vẫn xem Plan đã lưu khi offline.
- **Privacy:** local file parse; server không nhận raw registration file; logs không có PII.
- **Accessibility:** keyboard usable trên desktop, focus visible, target touch đủ lớn, color không phải tín hiệu duy nhất, reduced motion.
- **Responsive:** 360px không horizontal page scroll; grid có vùng scroll được chủ ý.
- **Compatibility:** xác nhận danh sách browser trước beta; không tuyên bố hỗ trợ nếu chưa test.
- **Integrity:** dataset version/hash/provenance hiển thị cho admin và user.

## 9. Analytics và feedback

Chỉ thu event tổng hợp, không gửi mã sinh viên, họ tên, raw file, nội dung lịch cá nhân hoặc chuỗi tìm kiếm nếu chưa có consent. Event đề xuất: `app_open`, `dataset_loaded`, `plan_created`, `section_selected`, `export_completed`, `local_import_completed`, `report_data_issue`. Có cơ chế opt-out và tắt analytics khi cần.

Mọi báo sai dữ liệu phải kèm dataset/version/section identifier không PII; admin review trước khi publish bản sửa.

## 10. Rủi ro và giả định

| Rủi ro | Tác động | Giảm thiểu |
| --- | --- | --- |
| Trường đổi format | parser fail mùa đăng ký | fixtures + validation + manual review + runbook |
| TKB chính thức công bố trễ | trượt launch | vertical slice và fallback scope |
| Dữ liệu file registration có PII | rủi ro pháp lý | local-only, redaction, network/security tests |
| Không có người nạp file sau khi founder ra trường | dữ liệu stale | 2–3 admin kế nhiệm, user upload queue, handoff |
| Campus/tuần linh hoạt | lịch sai/conflict sai | canonical periods/weeks, explicit unknown/warnings |
| App bị hiểu là official | trust/legal | brand trung lập, disclaimer rõ |

## 11. Open questions

- Chốt tên/domain và disclaimer wording sau rà soát pháp lý.
- Chốt browser matrix, analytics consent, data region/vendor.
- Chốt số Plan tối đa và có cần account ở P0 hay không (mặc định không).
- Xác nhận fixture nào được phép commit/retention; CI chỉ dùng redacted/synthetic.
- Xác nhận có phát hành PDF export trong P0 hay cắt để bảo vệ mốc.
