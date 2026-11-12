# M6 spec — Làm mới frontend "Lịch có màu"

> **Artifact ID:** `SPEC-M6-001`  
> **Artifact status:** `g0-approved`  
> **Canonical gate:** `G0`  
> **Owner:** Product Spec  
> **Last reviewed:** 2026-11-12  
> **Related docs:** [PLAN-M6-001](M6-FRONTEND-REFRESH-PLAN.md), [PRD §4/§6/§8](../PRD.md), [Security & privacy](../SECURITY_PRIVACY.md), [QA plan](../QA_TEST_PLAN.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md)  
> **Evidence envelope:** `EVID-M6-001` (tạo ở G2; hiện `N/A — docs-only`)  
> **Decision actor / UTC timestamp:** Approved by Owner (Product / Tech Lead) at `2026-11-12T14:53Z` (chat: "Ký G0")  
> **Receiving owner / acknowledgement:** Tech Lead (G1 `DESIGN-M6-001`), Frontend, Tester, Security Reviewer, Independent Reviewer

## 1. Nguồn và traceability

- **Nguồn:** [PLAN-M6-001](M6-FRONTEND-REFRESH-PLAN.md) §1–§10, kèm canvas phác họa 5 màn mà Owner đã duyệt hướng ngày 2026-11-12 (canvas riêng của Owner, không nằm trong repo); brief SHA-256 `295BB158F14D9C3C23F920A0CFF7A5DBDC1B76FC88885AFE9992FBA55D650B1E`.
- **Yêu cầu P0 bị chạm (chỉ đổi cách hiển thị, không đổi hành vi):** PRD §4 P0 #2–#8, #11, #12; FR-02, FR-03, FR-04, FR-06, FR-07, FR-08, FR-11; §8 NFR (Accessibility, Responsive, Compatibility, Performance, Integrity).
- **Không được thay đổi:** FR-01, FR-05, FR-09, FR-10 (dữ liệu, parser, nhập ĐKMH cục bộ); contract dataset/manifest; schema domain `0.2.0`; ranh giới privacy (AC-04, AC-M4-02, AC-M5-03).
- **Bổ sung do quyết định Owner:** dark mode (NFR mới) và ảnh xuất dạng poster (mở rộng FR-11). Khi G0 được ký, phải cập nhật PRD §8 và FR-11 theo §10 của spec này.

## 2. Outcome

Sinh viên mở app là thấy ngay lịch tuần nhiều màu, thêm lớp trong vài chạm, thấy chỗ trùng trước khi thêm, và xuất được lịch đẹp để chia sẻ. Giao diện ít chữ, hiện đại, nhất quán ở điện thoại lẫn desktop, sáng lẫn tối. Mọi hành vi dữ liệu, privacy và offline giữ nguyên.

**Chỉ số thành công** (đo bằng script trong CI, trên dataset synthetic):

| Chỉ số | Hiện tại | Mục tiêu |
| --- | --- | --- |
| Số chữ hiển thị ở màn Bắt đầu (không tính câu độc lập bắt buộc) | ~70 | ≤ 25 |
| Vị trí bắt đầu của lưới lịch ở 360×780 | ~380 px | ≤ 200 px |
| Số ngày thấy được trong lưới tuần ở 360 px | 3 (phải cuộn ngang) | 6 (T2–T7), không cuộn ngang |
| Số chạm từ màn Bắt đầu tới khi thêm xong lớp đầu tiên | ~7 (đếm tay trên bản hiện tại) | ≤ 5 |
| axe serious/critical (5 màn × 3 khổ × 2 theme) | 0 (chỉ theme sáng) | 0 |

## 3. Phạm vi

### Trong phạm vi

| ID | Hạng mục | Ưu tiên |
| --- | --- | --- |
| M6-A | Design token (màu, chữ, khoảng cách, bo góc, bóng, chuyển động); theme sáng/tối theo hệ điều hành + nút chuyển; bảng màu môn 8–10 cặp | P0 |
| M6-B | Font Be Vietnam Pro tự host (400/600/800, subset vietnamese + latin, woff2); bộ icon SVG nhúng (Lucide, ISC) | P0 |
| M6-C | Thành phần dùng chung: AppBar, BottomNav, SegmentedControl, Chip, Button, Sheet (`<dialog>`), CourseBlock, DayStrip, WeekGrid, SearchField, ListRow, StatCard, Toast, EmptyState | P0 |
| M6-D | Khung app: mobile thanh dưới cùng 3 mục (Lịch · Thêm lớp · Phương án); AppBar có chip học kỳ + nút (i); chip trạng thái thay banner; desktop 2 cột; bỏ footer luôn hiện | P0 |
| M6-E | Lịch tuần/ngày: đủ T2–T7 ở 360 px, màu theo môn, dải ngày, "hôm nay", vạch giờ hiện tại, vuốt đổi tuần, chạm ô mở sheet chi tiết, đổi màu môn | P0 |
| M6-F | Thêm lớp: trang tìm, bộ lọc "Không trùng lịch", sheet lớp có mini-lịch xem trước, chip nhóm, desktop rê chuột xem trước, `Ctrl/⌘ K` | P0 |
| M6-G | Màn Bắt đầu một màn (chip khóa), trạng thái rỗng, gợi ý một lần, rà toàn bộ microcopy | P0 |
| M6-H | Phương án: khối tín chỉ + thanh màu, chip trùng, danh sách gọn, 4 ô xuất; nhập ĐKMH đổi giao diện, giữ nguyên hành vi | P0 |
| M6-I | Ảnh xuất dạng poster theo màu môn (1080×1350), bên cạnh ảnh lịch hiện có | P0 trong M6 (D-M6-7), ngoài P0 của MVP |
| M6-J | Chất lượng: ảnh chụp so sánh, ngân sách CSS/font, script đếm chữ, script kiểm tương phản, cập nhật e2e | P0 |

### Ngoài phạm vi

- Thay đổi parser, domain, export ICS/Word, contract dữ liệu, schema domain hay manifest.
- Màn "Hôm nay"/đếm ngược, thông báo đẩy, chia sẻ link, nhiều phương án nháp (Roadmap giai đoạn 1–2).
- Telemetry, tài khoản, đồng bộ, script hay font bên thứ ba.
- Bộ theme tùy biến ngoài bảng màu môn.

## 4. Quyết định và giả định

| ID | Quyết định | Nguồn |
| --- | --- | --- |
| D-M6-1 | Hướng thiết kế "Lịch có màu" theo canvas | Owner, chat 2026-11-12 |
| D-M6-2 | Màu nhấn chàm `#4F46E5` | Owner duyệt canvas, 2026-11-12 |
| D-M6-3 | Điện thoại: thanh dưới cùng 3 mục; desktop: 2 cột | Owner duyệt canvas, 2026-11-12 |
| D-M6-4 | Font Be Vietnam Pro tự host | Owner duyệt canvas, 2026-11-12 |
| D-M6-5 | Dark mode trong M6, mặc định theo hệ điều hành, có nút chuyển | Owner, chat 2026-11-12 |
| D-M6-6 | Ngân sách: CSS gzip ≤ 12 KiB (từ 5 KiB), font ≤ 90 KB, JS ban đầu giữ ≤ 117 KiB | Owner, chat 2026-11-12 |
| D-M6-7 | Ảnh poster làm trong M6 (bước F7) | Owner, chat 2026-11-12 |
| D-M6-8 | G4a không phụ thuộc M6: có TKB HK II đã duyệt thì lên production bằng giao diện hiện tại | Owner, chat 2026-11-12 |
| D-M6-9 | Giới hạn 25 chữ ở màn Bắt đầu không tính câu độc lập bắt buộc; câu này kiểm riêng | Owner, chat 2026-11-12T15:28Z |
| D-M6-10 | PR phase merge vào nhánh tích hợp `m6-frontend`; merge vào `main` một lần sau G3 của M6 | Owner, chat 2026-11-12T15:28Z |
| D-M6-11 | Phiên bản chuyển từ footer vào sheet (i), màn lỗi và thẻ meta; banner dữ liệu chưa công bố thành chip luôn hiện (sửa ADR-0014 điểm 3, AC-M5-01, ADR-0010 §2 quy tắc 4) | Owner, chat 2026-11-12T15:28Z |

**Giả định đã được Owner xác nhận cùng G0 (`2026-11-12T14:53Z`):**

- **A-M6-1:** câu "công cụ độc lập của sinh viên, không phải sản phẩm của nhà trường" hiện ở màn Bắt đầu, trong sheet Giới thiệu (mở từ nút (i) trên mọi màn) và trong mọi file xuất. Như vậy vẫn đáp ứng CLAUDE.md §3, dù không lặp lại trên màn Lịch.
- **A-M6-2:** thông tin nguồn dữ liệu (PRD P0 #12, Integrity) xem được trong ≤ 2 chạm: chip học kỳ → sheet nguồn dữ liệu.
- **A-M6-3:** settings trên máy có thêm 3 trường tùy chọn: `theme`, `courseColors`, `seenHints`. Không tăng version IndexedDB, bản cũ đọc vẫn được. Chi tiết chốt ở G1 (DESIGN/ADR).

## 5. Luồng chính

1. **Lần đầu:** màn Bắt đầu → chọn chip khóa (hoặc "Tự chọn ngày") → "Bắt đầu" → màn Lịch tuần hiện tại (rỗng) với trạng thái rỗng có một nút "Thêm lớp".
2. **Thêm lớp:** "Thêm lớp" → gõ mã/tên (không dấu) → chạm một môn → sheet lớp: buổi học, mini-lịch xem trước, chip nhóm → "Thêm vào lịch". Nếu trùng: phần trùng tô đỏ, nút đổi thành "Vẫn thêm lớp này".
3. **Xem lịch:** vuốt hoặc bấm mũi tên để đổi tuần, "Tuần này" để quay lại; chạm ô → sheet chi tiết (tên đầy đủ, tiết + giờ, tuần, phòng, giảng viên, nhóm, nhãn đổi từ ĐKMH, đổi màu, bỏ lớp).
4. **Phương án:** xem tín chỉ, chạm chip trùng để tới đúng ô; chọn nhóm; xuất lịch bằng 4 ô: Điện thoại `.ics`, Ảnh (lịch PNG hoặc poster), Word, In.
5. **Nhập ĐKMH:** từ Phương án → sheet các bước (chọn file → xem trước → xác nhận), hành vi y như M4.
6. **Trạng thái dữ liệu:** bản thử, ngoại tuyến, dữ liệu cũ, hết hiệu lực đều hiện thành chip trên AppBar; chạm chip để xem chi tiết.

## 6. Contract

- **Dữ liệu và export:** không thay đổi. File ICS/Word giữ nguyên định dạng; ảnh lịch đổi sang dùng màu môn; poster là đầu ra PNG mới.
- **Lưu trên máy:** 3 trường settings tùy chọn (A-M6-3); xóa dữ liệu trên máy thì xóa luôn cả 3.
- **Không request mạng mới;** CSP giữ nguyên (`font-src 'self'`, `style-src 'self'`, `connect-src 'self'`).

## 7. Acceptance criteria

| ID | Tiêu chí | Hạng mục | Kiểm bằng |
| --- | --- | --- | --- |
| AC-M6-01 | Theme theo `prefers-color-scheme`, nút chuyển (Hệ thống/Sáng/Tối) lưu vào settings; mọi cặp chữ/nền và mọi cặp màu môn ≥ 4.5:1 ở cả hai theme | M6-A | script tương phản + Vitest |
| AC-M6-02 | Font tải từ cùng origin, được precache, tổng woff2 ≤ 90 KB; không có request bên thứ ba | M6-B | build check + e2e |
| AC-M6-03 | Ở 360×780, lưới lịch bắt đầu trong 200 px đầu; thanh dưới cùng 3 mục, vùng chạm ≥ 44 px, có trạng thái đang chọn | M6-D | e2e đo vị trí |
| AC-M6-04 | Banner bản thử/ngoại tuyến/dữ liệu cũ/hết hiệu lực được thay bằng chip; chạm chip mở chi tiết; nguồn dữ liệu xem được trong ≤ 2 chạm | M6-D | Vitest + e2e |
| AC-M6-05 | Ở 360 px thấy đủ T2–T7, không cuộn ngang trang hay lưới; ô hiện mã môn + phòng, màu theo môn; ô trùng có viền đỏ + sọc + biểu tượng + chữ trong tên truy cập | M6-E | e2e + ảnh chụp so sánh |
| AC-M6-06 | Đổi tuần bằng nút, vuốt (cảm ứng), phím; có "Tuần này"; ngày hôm nay và vạch giờ hiện tại chỉ hiện ở tuần hiện tại | M6-E | e2e (đồng hồ giả) |
| AC-M6-07 | Chạm ô mở sheet chi tiết đủ thông tin và nhãn đổi từ ĐKMH (M4); đổi màu môn được và màu lưu lại sau khi tải lại | M6-E | Vitest + e2e |
| AC-M6-08 | Lịch ngày dùng cùng màu; lớp không giờ cố định (ONL) vẫn có mục riêng, không lên lưới, vẫn cộng tín chỉ | M6-E | e2e |
| AC-M6-09 | Tìm không dấu như cũ; bộ lọc "Không trùng lịch" ẩn đúng các lớp trùng; sheet lớp có mini-lịch đánh dấu chỗ trùng; thêm lớp trùng bắt buộc bấm "Vẫn thêm lớp này" | M6-F | Vitest + e2e |
| AC-M6-10 | Desktop ≥ 1200 px: 2 cột; `Ctrl/⌘ K` đưa con trỏ vào ô tìm; rê chuột hoặc focus một lớp thì lưới hiện ô xem trước | M6-F | e2e |
| AC-M6-11 | Màn Bắt đầu là một màn, chip khóa lấy từ `Term.starts`, có link tự chọn ngày, ≤ 25 chữ hiển thị không tính câu độc lập bắt buộc (câu này kiểm riêng: có đúng 1 lần, nguyên văn `INDEPENDENCE_NOTE`), 2 chạm để vào lịch | M6-G | script đếm chữ + e2e |
| AC-M6-12 | Câu "công cụ độc lập" có ở màn Bắt đầu, sheet Giới thiệu và file xuất; không lặp trên màn Lịch; gợi ý chỉ hiện một lần và tắt được; mỗi trạng thái rỗng có đúng một nút hành động | M6-G | Vitest + e2e |
| AC-M6-13 | Phương án: khối tín chỉ + thanh màu đúng tổng; chip trùng dẫn tới đúng ô; chọn nhóm; 4 ô xuất cho ra đúng file như trước | M6-H | e2e (so nội dung file) |
| AC-M6-14 | Nhập ĐKMH: mọi assertion của `e2e/m4.spec.ts` về 0 request, PII và override vẫn qua, không nới lỏng | M6-H | e2e M4 |
| AC-M6-15 | Poster PNG 1080×1350: màu môn, chữ Việt đúng font, có phiên bản dataset và câu "công cụ độc lập", không có PII | M6-I | Vitest (canvas) + kiểm bằng mắt |
| AC-M6-16 | axe 0 serious/critical ở 5 màn × 360/768/1280 × sáng/tối; dùng được hoàn toàn bằng bàn phím; focus luôn thấy rõ; `prefers-reduced-motion` tắt chuyển động; tên truy cập của ô lịch gồm mã, tên môn, thứ, tiết, phòng và trạng thái trùng | M6-J | e2e axe + Vitest |
| AC-M6-17 | JS ban đầu ≤ 117 KiB gzip; CSS ≤ 12 KiB gzip; font ≤ 90 KB; chunk ĐKMH vẫn lazy | M6-J | `check-bundle-budget` |
| AC-M6-18 | 0 request bên thứ ba; CSP không đổi; không dùng `localStorage`; offline tải lại vẫn giữ phương án, theme và màu | M6-J | `verify:bundle` + e2e |
| AC-M6-19 | Ảnh chụp so sánh của 5 màn × 3 khổ × 2 theme được commit làm mốc; CI so khác biệt | M6-J | Playwright `toHaveScreenshot` |
| AC-M6-20 | Mỗi PR phase của M6 merge vào nhánh tích hợp `m6-frontend` và qua đủ `npm run check`, `verify:bundle`, `test:e2e`; `main` giữ bản M5 cho G4a và chỉ nhận M6 một lần sau G3 của M6 (D-M6-8, D-M6-10) | M6-J | CI |

## 8. Kế hoạch kiểm thử

- **Vitest:** thành phần mới, logic màu môn, đếm tín chỉ, bộ lọc trùng, settings mới.
- **Playwright:** viết lại luồng M3/M5 theo giao diện mới; giữ nguyên `m4.spec.ts` (chỉ đổi selector nếu tên thay đổi, assertion privacy giữ nguyên); thêm `m6.spec.ts` cho AC-M6-03…13; ảnh chụp so sánh; axe ở cả hai theme.
- **Script:** đếm chữ hiển thị, kiểm tương phản bảng màu, ngân sách CSS/font (mở rộng `check-bundle-budget`).
- **Thủ công trước G4a của bản dùng M6:** Safari iOS, Chrome Android, Zalo/Messenger, TalkBack/VoiceOver, kiểm poster bằng mắt.

## 9. Bàn giao và quyết định G0

- **Implementer:** Frontend (M6-A…I), Coder/Platform (font precache, ngân sách, script), theo bước F1–F7 của PLAN-M6-001.
- **G1 kế tiếp:** `DESIGN-M6-001` (module, token, settings mới, lazy, test) + ADR nếu settings mới cần ghi quyết định.
- **Tác động release:** không đổi luồng G4a/G4b (D-M6-8).
- **Definition of Ready:** G0 đạt; implementation vẫn `blocked` tới khi G1 (`DESIGN-M6-001`) được ký.
- **G0 decision:** `g0-approved` — Owner, `2026-11-12T14:53Z`.
- **Approver actor/date/evidence:** Owner (Product / Tech Lead), `2026-11-12T14:53Z`, câu trả lời "Ký G0" trong chat; A-M6-1…3 được xác nhận cùng lúc.

## 10. Cập nhật tài liệu khi G0 được ký (đã làm `2026-11-12T14:53Z`)

- PRD §8: thêm NFR "Theme: sáng/tối theo hệ điều hành" và nguyên tắc "giao diện ít chữ, thông tin phụ sau một chạm"; FR-11: thêm poster PNG.
- IMPLEMENTATION_PLAN §2: thêm dòng M6; §7: thêm D-M6-1…8.
- README "Trạng thái hiện tại": M6 G0 đã ký.
