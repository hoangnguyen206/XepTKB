# M4 spec — Registration merge UI

> **Artifact ID:** `SPEC-M4-001`  
> **Artifact status:** `in-review`  
> **Canonical gate:** `G0`  
> **Owner:** Product Spec  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [Implementation plan §2/§4](../IMPLEMENTATION_PLAN.md), [PRD](../PRD.md), [Security & privacy](../SECURITY_PRIVACY.md), [C-09 registration review](C09-REGISTRATION-SAMPLE-REVIEW.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [M4 design handoff](M4-DESIGN-HANDOFF.md)  
> **Evidence envelope:** `EVID-M4-001` ([M4-EVIDENCE-ENVELOPE.md](M4-EVIDENCE-ENVELOPE.md))  
> **Decision actor / UTC timestamp:** Pending Owner (Product / Tech Lead) human sign-off  
> **Receiving owner / acknowledgement:** Frontend/Coder (implementation), Tester, Security Reviewer, Independent Reviewer

## 1. Source and traceability

- **Source:** `IMPLEMENTATION_PLAN.md` §2 hàng M4 và §4 bước 8; `PRD.md` §4 P0 #7, #9, #10, §5 journey bước 5–6, §6 FR-09, FR-10, §7 AC-04, AC-05, §8 NFR; `DOMAIN_MODEL.md` §§3, 5, 7, 9; `SECURITY_PRIVACY.md` §§1 (#8), 2, 3, 5, 7; `QA_TEST_PLAN.md` §§2, 4, 5; `C09-REGISTRATION-SAMPLE-REVIEW.md` (`REVIEW-C09-001`).
- **Product decisions dùng trong M4:**
  - **Q-005 (`PRD.md` §4 #7):** UI P0 có đúng hai slot phương án cố định cho mỗi học kỳ — **Slot 1: `Phương án nháp`** (`planKind = "draft"`, do sinh viên tự chọn môn/lớp) và **Slot 2: `Phương án chính thức`** (`planKind = "final"`, tạo hoặc cập nhật từ file kết quả đăng ký môn học). Import kết quả đăng ký không bao giờ ghi đè `Phương án nháp`.
  - **Q-007 (`PRD.md` §8):** phát hiện trình duyệt nhúng trong ứng dụng (Facebook, Messenger, Zalo, Instagram, Line) và hiện thông báo hướng dẫn “Mở bằng trình duyệt” ngay tại khu vực chọn file ĐKMH cũng như khu vực tải file.
  - **Q-009 (`PRD.md` §4 #3/#9):** lớp `ONL` / không giờ cố định trong kết quả đăng ký vẫn được đưa vào `Phương án chính thức`, cộng tín chỉ và hiển thị ở mục không có giờ cố định, không tạo ô lưới hay báo trùng lịch.
  - **Q-010 (`ADR-0006`, `DOMAIN_MODEL.md` §7):** buổi `TH` trong kết quả đăng ký không ghi tuần rõ ràng chỉ mặc định tuần `2..teachingWeeks` khi buổi `TH` tương ứng trên TKB cũng là `weekOrigin = "parser-default"`; nếu TKB có tuần tường minh (`explicit`), tuần của TKB được giữ nguyên.
- **Requirement IDs (P0):** FR-09 (Import kết quả đăng ký `.doc`/HTML local-only), FR-10 (Hiển thị override phòng/giờ/tuần/giảng viên theo kết quả ĐKMH), PRD §4 #7, #9, #10; AC-04, AC-05.

## 2. Outcome

Sau đợt đăng ký môn học trên cổng đào tạo (`daotao.vnu.edu.vn`), sinh viên tải file “Kết quả đăng ký môn học” (`.doc` HTML hoặc `.htm`/`.html`) về máy và chọn file đó ngay trong ứng dụng **Kỳ Này**. Ứng dụng phân tích cú pháp hoàn toàn trong bộ nhớ trình duyệt bằng `@ky-nay/parser/registration`, loại bỏ toàn bộ thông tin cá nhân (họ tên, ngày sinh, mã sinh viên, lớp khóa/chương trình đào tạo, học phí, tên file, mã băm), hiển thị **bản xem trước (preview)** gồm các lớp khớp TKB, các thay đổi phòng/giờ/tuần so với TKB và các lớp/buổi không khớp để sinh viên kiểm tra. Khi sinh viên bấm **Xác nhận**, ứng dụng tạo hoặc cập nhật **Phương án chính thức** (`planKind = "final"`) mà không làm thay đổi **Phương án nháp** (`planKind = "draft"`), gắn nhãn rõ các buổi có phòng/giờ/tuần đã đổi theo ĐKMH trên lịch tuần, lịch ngày, tóm tắt phương án và các file xuất (`.ics`, `.png`, `.doc`, bản in).

## 3. Scope

### In scope

- **Bộ chọn file kết quả ĐKMH (`.doc` / `.htm` / `.html`) trong `apps/web`:**
  - Chấp nhận file HTML xuất từ cổng đào tạo (`.doc` bản chất HTML hoặc `.htm`/`.html`), giới hạn kích thước `<= 2 MiB` (`MAX_REGISTRATION_BYTES`).
  - Từ chối sớm file rỗng, file vượt `2 MiB`, hoặc file nhị phân không phải HTML cổng đào tạo (`.docx`/`ZIP`, `.doc` nhị phân `OLE/CFBF`, `.pdf`) với thông báo tiếng Việt rõ cách tải đúng file từ cổng đào tạo.
  - Phát hiện in-app browser (Facebook/Messenger/Zalo…) tại khu vực nhập file ĐKMH và nhắc mở bằng trình duyệt ngoài.
- **Xử lý local-only và bảo vệ PII tuyệt đối (`AC-04`, `SECURITY_PRIVACY.md` §2):**
  - Chỉ nhập `@ky-nay/parser/registration` trong `apps/web` (bắt buộc bằng quy tắc lint trong `scripts/lint.mjs`).
  - Không gửi bất kỳ request mạng nào khi chọn file, xem trước, xác nhận hoặc hủy; không lưu tên file (`file.name`), nội dung nguyên bản, hay mã băm (`sha256`) vào `IndexedDB`, `DOM`, `URL`, hay `console`.
- **Màn hình/khung Xem trước (Preview) trước khi áp dụng (`FR-09`, `PRD.md` §4 #9):**
  - Hiển thị danh sách lớp học phần khớp với bộ dữ liệu TKB đang dùng (`matched`), nhóm thực hành suy ra từ thứ/tiết (hoặc báo cần chọn nhóm sau khi lưu nếu file cổng đào tạo không phân biệt được nhóm).
  - Hiển thị chi tiết từng thay đổi (`Override`) phát hiện được so với TKB (`from → to` cho phòng, cơ sở, thứ, tiết, tuần, giảng viên).
  - Hiển thị cảnh báo rõ ràng cho các lớp hoặc buổi trong file ĐKMH không khớp hoặc khớp mơ hồ với TKB (`unmatched`, `REGISTRATION_OVERRIDE_UNMATCHED`, `REGISTRATION_OVERRIDE_AMBIGUOUS`), cảnh báo tuần thực hành mặc định (`REGISTRATION_DEFAULT_WEEKS`), và lỗi/cảnh báo từ parser.
  - Bắt buộc sinh viên bấm nút xác nhận tường minh mới ghi `Phương án chính thức` vào `IndexedDB`; nút Hủy bỏ toàn bộ dữ liệu tạm trong bộ nhớ.
- **Hai slot phương án cố định (`draft` vs `final`, `Q-005`):**
  - Thanh chuyển đổi giữa `Phương án nháp` và `Phương án chính thức` trong `Workspace`.
  - Tạo mới hoặc cập nhật (nhập lại file ĐKMH mới) `Phương án chính thức` giữ nguyên `Phương án nháp`; khi nhập lại file ĐKMH, các override `source = "registration"` cũ được thay bằng kết quả mới.
  - Cho phép chọn/đổi nhóm trực tiếp cho các lớp nhiều nhóm chưa xác định nhóm (`GROUP_REQUIRED`) trên cả `Phương án chính thức` và `Phương án nháp`.
  - Cho phép xóa riêng `Phương án chính thức` (quay về `Phương án nháp`), bên cạnh nút “Xóa dữ liệu trên máy” ở chân trang xóa toàn bộ dữ liệu thiết bị.
- **Áp dụng `plan.overrides` và hiển thị nhãn “Đã đổi…” (`AC-05`, `FR-10`):**
  - `resolvePlanPicks` (`@ky-nay/domain`) áp dụng `plan.overrides` theo đúng thứ tự ưu tiên (`timetable < registration < admin-correction < user`) để mọi luồng tính trùng lịch, lưới tuần, danh sách ngày và xuất file đều dùng giá trị sau override.
  - `ScheduledSession` (`@ky-nay/export`) và UI (`WeekGrid`, `DayList`, `PlanSummary`, `PrintSheet`, `buildWordDoc`, `buildIcs`) hiển thị nhãn thay đổi (ví dụ: `Đã đổi phòng`, `Đã đổi giờ`, `Đã đổi tuần`) kèm chi tiết `giá trị TKB → giá trị ĐKMH`.

### Out of scope

- Chỉnh sửa thủ công từng buổi (`source = "user"` / buổi bù tự nhập): thuộc phạm vi mở rộng sau P0.
- Đồng bộ tự động với cổng đào tạo hoặc đăng nhập tài khoản sinh viên (bị cấm theo `PRD.md` §4 Non-goals).
- Lưu nhiều hơn 1 phương án nháp hoặc nhiều hơn 1 phương án chính thức trên mỗi học kỳ.

## 4. Actors và decisions

- **Actors:** sinh viên (mobile/desktop), người kiểm thử (QA/Security/Reviewer).
- **Decisions trong M4 (cần Owner xác nhận ở G0):**
  - **D-M4-1 (Kế thừa nhóm và tuần 1 khi merge):** Khi tạo `Phương án chính thức` lần đầu từ `Phương án nháp`, `cohort` và `week1` được kế thừa từ `Phương án nháp`. Nếu một lớp nhiều nhóm trong file ĐKMH không chỉ rõ buổi nhóm (chỉ có buổi chung `CL`), ứng dụng giữ nhóm mà sinh viên đã chọn cho đúng lớp đó ở `Phương án chính thức` (nếu đang cập nhật) hoặc `Phương án nháp` (nếu tạo mới); nếu chưa chọn hoặc buổi trong file ĐKMH khớp đúng một nhóm cụ thể trên TKB thì dùng nhóm khớp từ ĐKMH.
  - **D-M4-2 (Quyền chỉnh trên Phương án chính thức):** `Phương án chính thức` phản ánh kết quả ĐKMH nhưng sinh viên vẫn có thể: (a) chọn/đổi nhóm cho lớp nhiều nhóm, (b) chỉnh tuần 1, (c) bỏ hoặc thêm lớp nếu muốn kiểm tra thử, (d) nhập lại file ĐKMH để đồng bộ lại theo kết quả mới nhất, hoặc (e) xóa `Phương án chính thức` mà không ảnh hưởng `Phương án nháp`.
  - **D-M4-3 (Xử lý lớp không khớp `unmatched`):** Theo invariant của `@ky-nay/domain` (`mergeRegistration`), lớp trong file ĐKMH không tồn tại hoặc mơ hồ trong dataset TKB hiện tại không được tự động chèn mù vào `picks` của `Phương án chính thức`, mà phải hiển thị cảnh báo rõ ở cả bước Xem trước và trong tab `Phương án` của `Phương án chính thức` (kèm thông tin mã lớp, thứ/tiết/phòng từ file ĐKMH) để sinh viên biết và đối chiếu hoặc cập nhật dữ liệu TKB mới hơn.

## 5. Flow

1. Sinh viên đang ở màn hình làm việc (`Workspace`) của học kỳ (đã có `Phương án nháp`) → bấm **“Nhập kết quả ĐKMH”** trên thanh phương án.
2. Sinh viên chọn file `.doc` / `.htm` / `.html` tải từ cổng đào tạo.
3. Ứng dụng kiểm tra kích thước/định dạng ngay trên máy, gọi `vnuRegistrationHtmlAdapter.parse` và `mergeRegistration` trong bộ nhớ, rồi mở bảng **Xem trước kết quả nhập ĐKMH** (không ghi gì vào `IndexedDB`).
4. Sinh viên kiểm tra:
   - Các lớp khớp TKB (`matched`) và nhóm tương ứng;
   - Các buổi có thay đổi phòng/giờ/tuần so với TKB (`overrides` với `from → to`);
   - Các lớp/buổi không khớp (`unmatched` / cảnh báo).
5. Sinh viên bấm **“Áp dụng vào Phương án chính thức”**:
   - Ứng dụng lưu `Phương án chính thức` (`planKind = "final"`) vào `IndexedDB` và chuyển sang hiển thị slot **Phương án chính thức**.
   - `Phương án nháp` giữ nguyên toàn bộ lớp đã chọn trước đó.
6. Sinh viên chuyển qua lại giữa **Phương án nháp** và **Phương án chính thức**, xem lịch tuần/ngày với nhãn `Đã đổi phòng`/`Đã đổi giờ`, chọn nhóm nếu còn lớp `GROUP_REQUIRED`, và xuất `.ics` / `.png` / `.doc` hoặc in.

## 6. Acceptance criteria

- **AC-M4-01 — File picker & guardrails:** Chấp nhận file `.doc`/`.htm`/`.html` HTML cổng đào tạo `<= 2 MiB`; từ chối file rỗng, file `> 2 MiB`, hoặc file nhị phân (`.docx` ZIP, `.doc` OLE, `.pdf`) kèm thông báo tiếng Việt dễ hiểu; hiện cảnh báo in-app browser khi mở trong Facebook/Messenger/Zalo.
- **AC-M4-02 — Local-only & zero PII (`AC-04`):** Khi nạp file kết quả đăng ký có chứa họ tên, ngày sinh, mã sinh viên, chương trình đào tạo, khóa, học phí (như `fixtures/redacted-registration/portal-format.doc`), không có bất kỳ request mạng nào được gửi đi (kể cả từ Service Worker), và các chuỗi PII / tên file / mã băm không xuất hiện trong `DOM`, `IndexedDB`, `console`, hay các file xuất (`.ics`, `.doc`, `.png`).
- **AC-M4-03 — Preview trước khi xác nhận (`FR-09`):** Trước khi bấm xác nhận, UI hiện bảng xem trước gồm số lớp khớp, danh sách thay đổi `from → to`, và cảnh báo lớp/buổi không khớp; nếu bấm **Hủy**, không có thay đổi nào được lưu vào `IndexedDB` và `Phương án nháp` không đổi.
- **AC-M4-04 — Hai slot `draft` và `final` độc lập (`Q-005`):** Sau khi xác nhận nhập ĐKMH, slot `Phương án chính thức` được tạo/cập nhật và kích hoạt; chuyển về slot `Phương án nháp` vẫn thấy nguyên vẹn các lớp nháp ban đầu; tải lại trang giữ nguyên cả hai phương án và slot đang xem.
- **AC-M4-05 — Áp dụng override & gắn nhãn “Đã đổi…” (`AC-05`, `FR-10`):** Khi kết quả ĐKMH đổi phòng, cơ sở, thứ, tiết, tuần hoặc giảng viên so với TKB, giá trị từ ĐKMH thắng trên lưới tuần, danh sách ngày, kiểm tra trùng lịch và mọi file xuất; UI gắn nhãn rõ (ví dụ: `Đã đổi phòng`, `Đã đổi giờ`, `Đã đổi tuần`) kèm chi tiết `từ giá trị TKB → sang giá trị ĐKMH`.
- **AC-M4-06 — Lớp không khớp (`unmatched`) & chọn nhóm (`GROUP_REQUIRED`):** Lớp trong file ĐKMH không có trong TKB được cảnh báo rõ ở bước Xem trước và được ghi nhận cảnh báo trên giao diện `Phương án chính thức`; lớp nhiều nhóm chưa xác định được nhóm từ file ĐKMH cho phép sinh viên chọn nhóm ngay trong `Phương án chính thức` (tại tab `Phương án` hoặc `Tìm môn`) mà không làm mất các `overrides` từ ĐKMH.
- **AC-M4-07 — Nhập lại (Re-import) & Xóa dữ liệu:** Nhập lại file ĐKMH mới thay thế các override `source = "registration"` cũ bằng kết quả mới; xóa riêng `Phương án chính thức` chỉ xóa slot `final` và giữ nguyên `Phương án nháp`; “Xóa dữ liệu trên máy” ở chân trang xóa sạch cả `Phương án nháp`, `Phương án chính thức`, danh sách lớp không khớp và bộ nhớ đệm.
- **AC-M4-08 — Accessibility & Responsive:** Bảng Xem trước, thanh chuyển đổi 2 slot và nhãn override đạt chuẩn WCAG 2.1 A/AA (axe 0 lỗi `serious`/`critical`), điều khiển được hoàn toàn bằng bàn phím, và không gây tràn ngang trang ở viewport `360px`, `768px`, `1200px`.

## 7. Test and verification plan

- **Package unit tests (`node:test`):**
  - `@ky-nay/domain`: kiểm tra `resolvePlanPicks` áp dụng `plan.overrides` (phòng, thứ, tiết, tuần, giảng viên) và tương tác với `findConflicts`.
  - `@ky-nay/export`: kiểm tra `scheduledSessions`, `buildWordDoc`, `buildIcs` hiển thị đúng thông tin sau override và ghi chú `from → to`.
- **Web unit/component tests (`Vitest` + `Testing Library`):**
  - Phân tích `fixtures/redacted-registration/portal-format.doc` và các biến thể lỗi (file quá lớn, file `.docx` ZIP, file không có bảng, lớp đổi phòng/giờ, lớp không khớp, lớp nhiều nhóm).
  - Kiểm tra luồng Preview → Hủy (không lưu) và Preview → Xác nhận (tạo `Phương án chính thức`, giữ nguyên `Phương án nháp`, chuyển đổi 2 slot, chọn nhóm, xóa `Phương án chính thức`).
  - Kiểm tra zero PII trong `DOM` và `IndexedDB`.
- **End-to-end tests (`Playwright`):**
  - E2E nạp file `.doc` có PII giả lập, kiểm tra network interception (0 request phát sinh, kể cả Service Worker), kiểm tra `IndexedDB`/`DOM`/file xuất không chứa PII (`AC-04`), kiểm tra hiển thị nhãn `Đã đổi phòng`/`Đã đổi giờ` (`AC-05`), kiểm tra chuyển đổi `Phương án nháp` ↔ `Phương án chính thức`, kiểm tra axe A/AA và responsive `360px`/`768px`/`1200px`.
