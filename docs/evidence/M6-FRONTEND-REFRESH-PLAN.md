# M6 — Kế hoạch làm mới frontend "Lịch có màu"

> **Artifact ID:** `PLAN-M6-001`  
> **Status:** accepted as input — Owner duyệt hướng ngày 2026-11-12; phạm vi và tiêu chí chính thức ở [SPEC-M6-001](M6-SPEC.md)  
> **Owner:** Product Spec + Frontend + Tech Lead  
> **Last reviewed:** 2026-11-12  
> **Related docs:** [docs index](../README.md), [PRD](../PRD.md), [Architecture](../ARCHITECTURE.md), [Security & privacy](../SECURITY_PRIVACY.md), [QA plan](../QA_TEST_PLAN.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md)  
> **Evidence envelope:** `N/A — docs-only` (chưa có code; sẽ là `EVID-M6-001` khi vào G2)  
> **Phác họa giao diện:** canvas riêng của Owner (link trong PR), 5 màn: Bắt đầu, Lịch tuần, Thêm lớp, Phương án, Desktop

## 1. Vấn đề hiện tại (đo trên preview HK I thật, 360 px và 1280 px)

- **Nội dung chính bị đẩy xuống:** trên điện thoại, logo, câu miễn trừ trách nhiệm, mã dataset, banner trạng thái, tên phương án, 2 nút và dòng tóm tắt chiếm khoảng 380 px đầu trang, rồi mới tới lịch.
- **Lịch tuần chật:** khổ 360 px chỉ thấy T2–T4, phải cuộn ngang để xem T5–T7. Mọi lớp là ô xám giống nhau.
- **Chữ lặp:** câu "công cụ độc lập…" xuất hiện ở đầu trang, chân trang và trang Giới thiệu. Chân trang luôn hiện 3 đoạn văn.
- **Màn bắt đầu nặng:** 2 ô chọn, 1 nhóm radio, 1 dòng cảnh báo đỏ, 1 hộp thông báo và 1 nút đang khóa, khoảng 70 chữ trước khi làm được gì.
- **Thiếu bản sắc:** giao diện mặc định kiểu form, không có màu nhận diện, không có khoảnh khắc nào đáng nhớ.

## 2. Tham khảo

- **NUSMods** (planner TKB do sinh viên NUS làm, không chính thức): ô lớp nhiều màu là tính năng được yêu thích nhất, có 32 bộ màu, có dark mode và phím tắt ([blog](https://blog.nusmods.com/5-nusmods-features-you-might-not-know-about), [NUSMods R](https://blog.nusmods.com/nusmods-r-rethought-redesigned-rewritten-reborn)).
- **Case study lịch học sinh viên:** sinh viên muốn xem theo tuần như sổ planner, lớp tô màu để phân biệt; lịch được dùng nhiều nhất trong 2 tuần đầu kỳ ([Medium](https://medium.com/ux-station/ui-ux-case-study-for-a-student-portal-schedule-feature-74c5aef03193)).
- **Mẫu lịch trên điện thoại:** vuốt để đổi tuần, nút quay về tuần hiện tại, dải ngày làm thanh điều hướng ([Teamup](https://calendar.teamup.com/?p=8551), [Canonical](https://canonical.com/blog/app-patterns-applied-calendar-key-journeys?format=md), [SwiftUI day strip](https://vp0.com/blogs/horizontal-calendar-scroll-swiftui)).
- **Điều hướng dưới cùng:** 3–5 mục chính, nằm trong tầm ngón cái; tab trên đầu chỉ dùng để đổi kiểu xem ([UX Planet](https://uxplanet.org/bottom-tab-bar-navigation-design-best-practices-48d46a3b0c36), [UXPin](https://www.uxpin.com/studio/blog/mobile-navigation-patterns-pros-and-cons/)).
- **Bớt chữ:** progressive disclosure; gợi ý chỉ hiện một lần, một câu, đặt cạnh thứ nó giải thích, tắt được; trạng thái rỗng phải dẫn tới hành động ([LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases), [Userpilot](https://userpilot.com/blog/progressive-disclosure/), [Setproduct](https://setproduct.com/blog/empty-state-ui-design), [Toptal](https://www.toptal.com/designers/ux/empty-state-ux-design)).
- **Xu hướng 2026:** "bold minimalism": bố cục gọn, chữ đậm, điểm màu có chọn lọc; bento grid cho khối thống kê ([Netguru](https://www.netguru.com/blog/top-web-design-trends), [Line25](https://line25.com/articles/web-design-trends-2026/)). Lịch kiểu Notion Calendar/Cron: tối giản, phím tắt là trung tâm ([Cron](https://cron.com/blog/2022-11-04-best-design-in-a-calendar-app)).
- **Font:** Be Vietnam Pro, giấy phép SIL OFL, thiết kế riêng cho dấu tiếng Việt, có gói tự host ([Fontsource](https://fontsource.org/fonts/be-vietnam-pro/install)).

## 3. Hướng thiết kế "Lịch có màu"

1. **Lịch là màn chính.** Mở app là thấy tuần hiện tại; mọi thứ khác là thao tác phụ.
2. **Mỗi môn một màu.** Màu gán tự động theo mã môn, người dùng đổi được; màu dùng xuyên suốt: ô lịch, danh sách, thanh tín chỉ, file ảnh xuất.
3. **Một màn, một việc.** Bắt đầu = chọn khóa. Thêm lớp = tìm và xem trước. Phương án = tổng kết và xuất.
4. **Chữ chỉ khi cần.** Thông tin phụ nằm sau nút hoặc trong sheet; cảnh báo là chip ngắn, bấm vào mới xem chi tiết.
5. **Không bỏ chất lượng:** local-only, không telemetry, không giả dạng chính thức, a11y AA, chạy offline, giữ ngân sách bundle.

## 4. Hệ thiết kế

- **Màu:** nền `#F5F6FA`, chữ `#15172A`, màu nhấn chàm `#4F46E5` (chữ trắng trên nền này ≥ 4.5:1), đỏ cho trùng lịch `#B91C1C`/`#DC2626`. **Bảng màu môn:** 8–10 cặp nền nhạt + viền đậm + chữ đậm, mỗi cặp chữ/nền ≥ 4.5:1, kèm phiên bản dark mode. Trùng lịch không chỉ báo bằng màu: luôn có viền đỏ, sọc chéo, biểu tượng và chữ "Trùng".
- **Chữ:** Be Vietnam Pro tự host (400/600/800, subset vietnamese + latin, woff2), số lớn đậm cho điểm nhấn (tuần, tín chỉ).
- **Hình khối:** bo góc 10/16/24 px, 2 mức bóng đổ, vùng chạm ≥ 44 px.
- **Chuyển động:** 150–250 ms; ô lớp "rơi" vào lịch khi thêm (View Transitions, có fallback); tắt khi `prefers-reduced-motion`.
- **Biểu tượng:** khoảng 15 SVG nét mảnh, nhúng trong code (bộ Lucide, giấy phép ISC), không tải icon font.
- **Dark mode:** theo hệ điều hành, có nút chuyển.
- **Thành phần dùng chung:** AppBar, BottomNav, SegmentedControl, Chip, Button (primary/secondary/danger/ghost), Sheet (`<dialog>` gốc), CourseBlock, DayStrip, WeekGrid, SearchField, ListRow, StatCard, Toast, EmptyState.

## 5. Cấu trúc và màn hình

- **Điện thoại:** thanh dưới cùng 3 mục: **Lịch** · **Thêm lớp** (nút nổi bật) · **Phương án**. Học kỳ là chip trên AppBar; nút (i) mở Giới thiệu, dữ liệu trên máy, phiên bản và báo lỗi.
- **Desktop:** 2 cột, trái là tìm môn và tổng tín chỉ, phải là lịch lớn; `Ctrl K` để tìm; rê chuột lên lớp thì lịch hiện trước vị trí và chỗ trùng.

| Màn | Hiện tại | Mới |
| --- | --- | --- |
| Bắt đầu | 2 ô chọn + radio + 2 thông báo | Minh họa lịch màu, "Bạn khóa mấy?" với 5 chip, nút "Bắt đầu"; "Tự chọn ngày" là link nhỏ |
| Lịch tuần | Lưới xám, 360 px chỉ thấy 3 ngày | Đủ T2–T7 trong 360 px, ô màu, dải ngày có "hôm nay", vạch giờ hiện tại, vuốt đổi tuần, chạm ô mở sheet chi tiết |
| Lịch ngày | Danh sách chữ | Thẻ theo giờ, cùng màu môn, đếm ngược tới tiết kế tiếp (nếu là hôm nay) |
| Thêm lớp | Thẻ dài nhiều dòng, nút đỏ to | Danh sách gọn (mã, tên, TC); bộ lọc "Không trùng lịch"; sheet lớp có mini-lịch xem trước chỗ rơi và chỗ trùng |
| Phương án | Danh sách chữ dài | Khối tín chỉ lớn + thanh màu theo môn, chip "trùng" bấm được, danh sách gọn có chip nhóm, 4 ô xuất (Điện thoại/Ảnh/Word/In) |
| Nhập ĐKMH | Panel nhiều chữ | Giữ nguyên luồng và ranh giới privacy (M4), chỉ đổi giao diện sang sheet + bước rõ ràng |
| Giới thiệu | Footer luôn hiện + panel | Chỉ mở từ nút (i); câu "công cụ độc lập" còn ở màn Bắt đầu, trang Giới thiệu và file xuất |
| Trạng thái dữ liệu | Banner to | Chip nhỏ trên AppBar ("Bản thử", "Ngoại tuyến", "Dữ liệu cũ"), bấm để xem chi tiết |

## 6. Mục tiêu đo được

- Màn Bắt đầu hiển thị ≤ 25 chữ (hiện khoảng 70).
- Trên 360 px, lịch bắt đầu trong 200 px đầu (hiện khoảng 380 px); thấy đủ 6 ngày, không cuộn ngang.
- Từ lúc mở app tới khi thêm xong lớp đầu tiên: ≤ 5 lần chạm.
- axe 0 lỗi serious/critical, không tràn ngang ở 360/768/1280, cả light lẫn dark.
- JS tải lúc mở app vẫn ≤ 117 KiB gzip; font ≤ 90 KB; CSS theo ngưỡng mới ở §11.

## 7. Ràng buộc kỹ thuật

- **Giữ nguyên:** React + Vite, các package `domain`/`parser`/`export`, contract dữ liệu, IndexedDB schema, luồng privacy của M4, lazy chunk ĐKMH. Chỉ làm lại `apps/web/src/components`, `styles` và lớp view-model.
- **Không thêm runtime dependency** nếu tránh được (không Tailwind, không thư viện UI): CSS thuần với design token trong `:root`, file CSS theo thành phần, `@layer`.
- **CSP hiện tại vẫn đáp ứng:** `font-src 'self'` (font tự host), `style-src 'self'` (React `style` đi qua CSSOM nên không bị chặn; không dùng thẻ `<style>` inline), không có request bên thứ ba.
- **Không dùng `localStorage`:** trạng thái "đã xem gợi ý" và màu tự chọn lưu trong `settings` của IndexedDB.
- **Service worker precache font**, để offline vẫn đúng giao diện.
- **E2E:** giữ nguyên các assertion về privacy/network/PII (AC-04, AC-M4-02, AC-M5-03); cập nhật selector theo tên mới; thêm test chụp màn hình so sánh (360/768/1280 × light/dark).

## 8. Lộ trình (mỗi bước một PR, chạy G2 → G3 theo quy trình)

| Bước | Nội dung | Xong khi |
| --- | --- | --- |
| F0 | Chốt hướng trên canvas; `SPEC-M6-001` (G0), `DESIGN-M6-001` (G1) | Owner ký G0/G1 |
| F1 Nền móng | Token màu/chữ/khoảng cách, font tự host, bộ icon, các thành phần cơ bản, dark mode, test chụp màn hình gốc | Trang mẫu thành phần qua axe; ngân sách font đạt |
| F2 Khung app | AppBar, BottomNav (mobile), bố cục 2 cột (desktop), chip trạng thái, bỏ footer luôn hiện | Lịch bắt đầu trong 200 px đầu ở 360 px |
| F3 Lịch | WeekGrid màu đủ 6 ngày ở 360 px, DayStrip, vạch giờ, vuốt đổi tuần, sheet chi tiết lớp, lịch ngày | Không cuộn ngang; e2e M3 lịch/trùng qua |
| F4 Thêm lớp | Trang tìm + bộ lọc, sheet lớp có mini-lịch xem trước, chọn nhóm bằng chip, rê chuột xem trước trên desktop, `Ctrl K` | ≤ 5 chạm tới lớp đầu tiên |
| F5 Bắt đầu & rà chữ | Màn Bắt đầu mới, trạng thái rỗng, gợi ý một lần, rà toàn bộ microcopy | Màn Bắt đầu ≤ 25 chữ |
| F6 Phương án & xuất | Khối tín chỉ, danh sách gọn, 4 ô xuất, giao diện mới cho nhập ĐKMH | e2e M4/M5 qua, assertion privacy không đổi |
| F7 Hoàn thiện | Chuyển động, rà dark mode, ảnh PNG xuất theo màu môn (dạng "poster" để chia sẻ), đo hiệu năng, kiểm trên máy thật | G3a/G3b/G3c |

## 9. Kiểm thử

- Vitest cho thành phần mới; Playwright e2e theo luồng; ảnh chụp so sánh ở 360/768/1280 × light/dark.
- axe ở mọi màn chính; kiểm độ tương phản của từng cặp màu môn bằng script.
- Ngân sách bundle/CSS/font trong CI.
- Script đếm chữ hiển thị ở màn Bắt đầu và phần đầu màn Lịch.
- Kiểm lại trên máy thật (Safari iOS, Chrome Android, Zalo/Messenger, TalkBack/VoiceOver).

## 10. Rủi ro

- **Trùng lịch với G4a/HK II:** làm M6 trong lúc chờ TKB HK II có thể đè lên đợt release. Đề xuất: không để G4a phụ thuộc M6; nếu HK II ra sớm, lên production bằng giao diện hiện tại rồi cập nhật sau.
- **E2E phải viết lại nhiều:** chia nhỏ theo F2–F6, giữ nguyên các assertion privacy.
- **Màu môn kém tương phản hoặc khó phân biệt với người mù màu:** dùng bảng màu đã kiểm, luôn kèm mã môn bằng chữ, trùng lịch có sọc + biểu tượng.
- **Phình CSS/font:** đặt ngân sách từ F1; chỉ dùng 3 độ đậm.

## 11. Quyết định của Owner (2026-11-12)

Đã chốt cả 8 điểm, ghi thành D-M6-1…8 trong [SPEC-M6-001 §4](M6-SPEC.md): hướng "Lịch có màu"; màu nhấn chàm `#4F46E5`; thanh dưới cùng 3 mục; Be Vietnam Pro tự host; dark mode trong M6; CSS ≤ 12 KiB, font ≤ 90 KB; poster làm trong M6 (F7); G4a không phụ thuộc M6.
