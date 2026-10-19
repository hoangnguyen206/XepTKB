# Kế hoạch sản phẩm – Tool xếp TKB cho sinh viên VNU

Oct 19, 2026 · @Hoang

## Tóm tắt

Làm một web app chạy tốt trên điện thoại (PWA), giúp sinh viên UET xếp thời khoá biểu từ file trường phát hành. App giữ chân người dùng quanh năm bằng lịch học, lịch thi và tính GPA. MVP chỉ làm cho UET. Trường không có lịch mở đăng ký cố định, nên mốc nên nhắm là lúc trường công bố TKB học kỳ II 2026-2027: tuần 09–15/11/2026 theo kế hoạch học tập.

- **Người dùng:** sinh viên UET trước, sau đó các trường khác trong ĐHQGHN cùng dùng cổng đăng ký chung, rồi mới đến trường ngoài.
- **Vấn đề:** file TKB của trường dài khoảng 1.800 dòng, khó dò trên điện thoại. Sinh viên tự kẻ bảng, dễ chọn trùng giờ hoặc trùng tuần.
- **Giải pháp cốt lõi:** tìm môn, chạm để chọn lớp, app tự báo trùng và vẽ lưới tuần. Có thể xuất ảnh, Word hoặc lịch Google.
- **Vòng giữ chân:** mỗi ngày mở xem "hôm nay học gì". Giữa kỳ và cuối kỳ có lịch thi và GPA. Làm việc nhóm có tính năng tìm giờ rảnh chung. Mùa đăng ký có ghép đổi lớp.
- **Nguyên tắc:** ưu tiên điện thoại nhưng máy tính cũng phải dùng tốt; file cá nhân xử lý ngay trên máy người dùng; không bao giờ xin mật khẩu cổng sinh viên.
- **Thước đo thành công đợt đầu (đề xuất):** số sinh viên UET tạo TKB trong mùa đăng ký, và tỷ lệ còn mở app hằng tuần sau 1 tháng.

## Dữ liệu đầu vào của UET

Đã có 10 nguồn thật của UET, tất cả đọc được bằng máy, không cần AI. Nhưng các bản TKB **không cùng định dạng**: tên cột, số cột và cách ghi chú đều đổi giữa các kỳ. Vì vậy parser phải nhận cột theo tên, kèm bảng từ đồng nghĩa, không nhận theo vị trí. File lịch thi thì giữ cùng một mẫu ở cả 4 file.

| Nguồn | Định dạng | Nội dung đọc được | Dùng để |
| --- | --- | --- | --- |
| TKB HK I 2026-2027, cập nhật 20/08/2026 (.xlsx) | Excel 17 cột, tiêu đề ở dòng 1 | 1.025 lớp học phần, 331 môn | Dữ liệu chính cho MVP |
| TKB HK II 2025-2026 chính thức, kèm CV 109/ĐT ngày 16/01/2026 (.xlsx và .pdf) | Excel 18 cột, tiêu đề ở dòng 4. PDF có lớp chữ | 1.009 lớp học phần, 308 môn | Dữ liệu test, test khớp với lịch thi |
| TKB dự kiến HK II 2025-2026, bản sinh viên, kèm CV 3019/ĐT ngày 26/12/2025 (.pdf) | PDF 17 cột, không có cột PCGD | Một số buổi khác bản chính thức | Test tính năng so sánh hai phiên bản |
| Kết quả đăng ký môn học HK I 2026-2027 (.doc) | HTML đổi đuôi .doc, xuất từ cổng đăng ký | 7 môn, 20 tín chỉ; không tách buổi LT và TH | Ra TKB cuối cùng |
| Dự kiến lịch thi HK II đợt 1, CV 665/ĐT ngày 02/04/2026 (.pdf) | PDF A4 | Khoảng 260 lớp thi, từ 11/05/2026 | Lịch thi |
| Lịch thi chính thức HK II đợt 1, CV 813/ĐT ngày 22/04/2026 (.pdf) | Cùng mẫu | Khoảng 260 lớp thi, 16/05–30/05/2026 | Lịch thi |
| Lịch thi chính thức HK II đợt 2, CV 1045/ĐT ngày 21/05/2026 (.pdf) | Cùng mẫu | Khoảng 730 lớp thi, 15/06–03/07/2026 | Lịch thi |
| Lịch thi HK hè 2025-2026, CV 1886/ĐT ngày 05/08/2026 (.pdf) | Cùng mẫu | Khoảng 180 lớp thi, 18/08–28/08/2026 | Lịch thi |
| Kế hoạch học tập 2026-2027, KH 1489/KH-ĐHCN ngày 26/06/2026 (.pdf) | PDF A3, bảng theo tuần | Ngày bắt đầu từng kỳ theo khoá; ngày công bố TKB và lịch thi | Tính tuần học, lên lộ trình |
| Ảnh khung giờ | 4 ca, mỗi ca 3 tiết 50 phút | 07:00–19:00 | Cấu hình khung giờ UET |

Bản TKB nào cũng có các cột: Lớp (lớp khoá, ví dụ K70I-IT1), Mã HP, Môn, TC, Mã LHP, Nhóm, loại buổi, Thứ, Ca, phòng, giảng viên và ghi chú. Tên gọi và vị trí của các cột này khác nhau giữa các kỳ, xem bảng "Ba bản TKB khác nhau ở đâu" bên dưới.

Những chỗ parser phải xử lý, lấy từ dữ liệu thật:

| Vấn đề | Ví dụ trong file | Cách xử lý |
| --- | --- | --- |
| Tên và vị trí cột đổi theo kỳ | "GĐ" và "Giảng đường"; "LT/TH" và "LT/BT/TH"; tiêu đề ở dòng 4 hoặc dòng 1 | Tìm dòng có ô "Mã LHP", rồi nhận cột theo bảng từ đồng nghĩa |
| Dòng chèn giữa dữ liệu | "Tổng TC", "Các học phần bắt buộc", "Định hướng Vi điện tử và hệ thống nhúng" | Bỏ dòng không có Mã LHP hợp lệ |
| Ô gộp | 151 vùng ô gộp trong file HK II | Điền giá trị xuống các ô bị gộp |
| Mã môn ghi không thống nhất | "PES 1075", "INT 3103" có dấu cách; "UET.MAT1051" có tiền tố; "AIT3040\*\*" có dấu sao | Chuẩn hoá: bỏ dấu cách và dấu sao, viết hoa, so khớp có và không có tiền tố |
| Cột Ca có nhiều kiểu | 1–4, "1-2", "1 - 2", "2-3", "Sáng", "Chiều" | Quy tất cả về tiết bắt đầu và tiết kết thúc |
| Giáo dục thể chất | Ca "Sáng", cột GĐ ghi "Tiết 1-2", giảng viên ghi "TT GDTC". File HK I 2026-2027 không có lớp GDTC | Bỏ qua trong MVP vì GDTC do đơn vị khác tổ chức. File nào có lớp GDTC thì vẫn hiện, dùng khung giờ thường |
| Ghi chú đè lên giờ học | "Học tiết 9-12", "Học tiết 2-5" (phòng thí nghiệm tại ĐHKHTN) | Ghi chú được ưu tiên hơn cột Ca |
| Lớp chỉ học một số tuần | "Học tuần 11-15", "Học từ tuần 14", "Học tuần 4,7,10,14,15", "Học 1 ca/10 tuần", "2/3 - 19/4" | Lưu danh sách tuần; chỉ báo trùng khi trùng cả giờ lẫn tuần. Ghi chú dạng ngày được quy ra tuần theo ngày bắt đầu kỳ |
| Không ghi tuần học | File HK I 2026-2027 không ghi "10 tuần" hay "thi đợt 1" cho các môn như PHI1002, HIS1001 | Mặc định tuần 1–15; buổi thực hành (TH) từ tuần 2. Bổ sung bằng lịch thi đợt 1, vì đợt này chỉ gồm lớp học 10 tuần |
| Lớp không có lịch cố định | LT/TH = "ONL", đồ án, thực tập, "Học trên hệ thống LMS" | Hiển thị riêng, không chiếm ô trên lưới |
| Nhóm thực hành | Nhóm = CL (cả lớp) hoặc 1, 2, 3 | Sinh viên chọn một lớp và một nhóm |
| Một lớp học nhiều buổi, nhiều dòng trùng | FLF1108 1 có 2 buổi; THL1057 1 lặp lại 18 lần cho 18 lớp khoá | Gom theo Mã LHP, bỏ buổi trùng |
| Phòng ở cơ sở khác | "803-T5 ĐHKHTN", "PTN Hòa Lạc" | Gắn phòng với cơ sở, cảnh báo khi phải di chuyển |
| Giảng viên | "Nguyễn Thái Dương+Đỗ Quang Huy"; tên tạm như "Ngoại ngữ 4", "Chủ nghĩa 3", "Khoa CNTT" | Tách theo dấu "+". Tên tạm thì không đem đi khớp với dhqg.xyz |
| Lỗi gõ | "TL+TH" | Bảng từ đồng nghĩa |
| Có học thứ 7 | 56 dòng (HK II), 104 dòng (HK I) | Lưới có T7; các trường khác có thể cần thêm CN |
| File đăng ký ghi nhiều buổi vào một ô | "T2,T6" · "4 - 6,1 - 3" · "301-B306-B" | Tách theo dấu phẩy. Phòng dính liền thì đối chiếu với danh sách phòng trong file TKB |
| File đăng ký dùng Tiết, file TKB dùng Ca | "4 - 6" tương ứng Ca 2 | Lấy tiết làm đơn vị gốc |
| File đăng ký mới hơn file TKB | 3/7 lớp đã đổi phòng so với TKB ngày 20/08: UET1002 7, FLF1108 3, INT3103 1 | Ưu tiên phòng và giờ trong file đăng ký; đánh dấu "phòng đã đổi" |

### Ba bản TKB khác nhau ở đâu

| Điểm khác | HK II 2025-2026 chính thức (.xlsx) | HK II 2025-2026 dự kiến (.pdf) | HK I 2026-2027 (.xlsx) |
| --- | --- | --- | --- |
| Dòng tiêu đề cột | Dòng 4, sau 3 dòng tiêu đề văn bản | Lặp lại ở mỗi trang | Dòng 1 |
| Số cột | 18 | 17, không có PCGD | 17 |
| Tên cột riêng | TH, Tự học, LT/TH, GĐ, GV | Giảng viên | BT/TH, Th, LT/BT/TH, Giảng đường, Giảng viên |
| Ghi chú | 2 cột: tuần học và đợt thi | 2 cột | 1 cột "Ghi chú học", hầu như trống; không có đợt thi |
| Cột Ca | 1–4, "1-2", Sáng/Chiều | Giống bản chính thức | 1–4, "1 - 2" có dấu cách |
| Giáo dục thể chất | Có | Có | Không có |
| Loại buổi | LT, TH, LT+TH, ONL | LT, TH, LT+TH, ONL | Thêm BT và LT+BT |

Các bản khác nhau cả về nội dung. Ví dụ buổi TH của INT2213 1: bản dự kiến ghi T2 ca 4 phòng 307-A, bản chính thức ghi T4 ca 3 phòng 407-A. Đây là lý do cần lưu mỗi lần nạp thành một phiên bản và báo thay đổi.

### Kết quả chạy thử parser

Một parser nháp đã được chạy trên toàn bộ các file để kiểm tra tính khả thi. Code thật vẫn sẽ viết sau.

- **TKB:** đọc được 1.009 lớp (HK II) và 1.025 lớp (HK I). Mọi buổi học đều ra được tiết hợp lệ. Có 33 và 57 lớp không có lịch cố định (học online, đồ án, thực tập).
- **File đăng ký:** cả 7/7 lớp khớp với TKB HK I. Trong đó 3 lớp đã đổi phòng so với file TKB. Không giữ lại mã sinh viên hay ngày sinh.
- **Lịch thi:** 182/192 lớp thi có giờ của đợt 1 và 506/523 của đợt 2 khớp mã lớp với TKB HK II. Phần còn lại chủ yếu là lớp mở bổ sung, không có trong file TKB.
- **Kế hoạch học tập:** lấy đúng ngày đầu tuần 1. HK I là 07/09/2026 cho K67–K70 và 12/10/2026 cho K71. HK II là 15/02/2027, HK phụ là 05/07/2027. Bảng gốc có lỗi gõ ngày ở tuần 12 HK II (ghi 11/05–17/05/2027). Vì vậy app chỉ lấy ngày tuần 1 rồi cộng dần 7 ngày, không đọc ngày ở từng dòng.

Ba điểm đáng tận dụng:

- Cột Lớp cho biết TKB "chuẩn" của từng lớp khoá.
- File lịch thi đợt 1 chỉ gồm các lớp học 10 tuần. Từ đó suy ra tuần học của những lớp mà file TKB không ghi.
- File đăng ký chứa họ tên, ngày sinh và mã sinh viên, nên chỉ được đọc trên máy người dùng (xem phần Rủi ro).

## Mô hình dữ liệu chung

Quyết định quan trọng nhất: **tiết là đơn vị gốc**, còn ca chỉ là một nhóm tiết. Cách này khớp được cả "Ca 2" (file TKB), "4 - 6" (file đăng ký) và "Tiết 9-12" (phòng thí nghiệm). Mỗi trường chỉ cần hai thứ riêng: một file cấu hình khung giờ, và một bảng từ đồng nghĩa cho tên cột (ví dụ "GĐ" = "Giảng đường"). Phần còn lại của parser dùng chung, nên khi trường đổi mẫu file, thường chỉ cần thêm từ đồng nghĩa. File kết quả đăng ký xuất từ cổng chung của ĐHQGHN nên có thể dùng chung một parser cho mọi trường thành viên. Cần kiểm chứng bằng file của trường thứ hai.

```typescript
// Cấu hình trường: admin nhập một lần, người dùng có thể sửa
type TimeFrame = {
  id: string;                 // "uet-2025", "vnu-gdtc"
  periods: { no: number; start: string; end: string }[];   // tiết 1..12
  shifts: { name: string; periods: number[] }[];          // Ca 1 = [1,2,3]
};
type School = { code: string; name: string; frames: TimeFrame[]; defaultFrame: string;
                campuses: { code: string; name: string; roomPattern: string }[] };

// Dữ liệu TKB một học kỳ (parser sinh ra, lưu dạng JSON tĩnh)
type Course  = { code: string; altCodes: string[]; name: string; credits: number };
type Section = { id: string;            // Mã LHP chuẩn hoá: "INT2213 1"
                 courseCode: string; homeClasses: string[];  // K69I-IT1...
                 capacity?: number; examRound?: 1 | 2; online: boolean;
                 sessions: Session[] };
type Session = { day: 2|3|4|5|6|7|8;   // 8 = Chủ nhật
                 startPeriod: number; endPeriod: number; frame: string;
                 weeks: number[];      // [1..15], [11..15]; TH mặc định [2..15]
                 kind: "LT" | "TH" | "BT" | "ONL"; group?: string;  // "CL", "1", "2"
                 room?: string; campus?: string; lecturers: string[]; rawNote?: string };

// Học kỳ: ngày đầu tuần 1 có thể khác theo khoá (HK I 2026-2027: K71 vào muộn 5 tuần)
type Term = { id: string; name: string; teachingWeeks: number;      // 15
              starts: { cohorts: string; week1: string }[] };     // lấy từ kế hoạch học tập

// Dữ liệu người dùng (week1 = ngày người dùng tự chọn nếu chưa có kế hoạch)
type Plan = { id: string; semester: string; name: string;   // "Phương án A"
              picks: { sectionId: string; group?: string }[]; final: boolean; week1?: string };
```

Khung giờ UET tính từ ảnh bạn gửi: tiết 50 phút, nghỉ 5 phút giữa các tiết, nghỉ 10 phút giữa hai ca cùng buổi.

| Ca | Tiết | Giờ từng tiết |
| --- | --- | --- |
| 1 | 1–3 | 07:00–07:50 · 07:55–08:45 · 08:50–09:40 |
| 2 | 4–6 | 09:50–10:40 · 10:45–11:35 · 11:40–12:30 |
| 3 | 7–9 | 13:30–14:20 · 14:25–15:15 · 15:20–16:10 |
| 4 | 10–12 | 16:20–17:10 · 17:15–18:05 · 18:10–19:00 |

Màn hình nhập khung giờ nên có hai cách. Cách thứ nhất là chọn trường có sẵn. Cách thứ hai là nhập 5 thông số để app tự sinh bảng: số ca, số tiết mỗi ca, số phút mỗi tiết, số phút nghỉ và giờ bắt đầu từng ca. Sau đó người dùng vẫn sửa được từng dòng. Mỗi trường có thể có nhiều khung giờ. Giáo dục thể chất do đơn vị khác tổ chức nên MVP bỏ qua; khi cần, chỉ việc thêm một khung giờ mới.

## Tính năng MVP cho UET

Trong MVP, admin nạp sẵn TKB của trường, nên sinh viên không phải tự tải file. Mỗi kỳ chỉ cần một người upload, mọi người cùng dùng. Chức năng upload file vẫn giữ để dự phòng và để mở rộng sang trường mới.

Luồng sử dụng trên điện thoại:

1. Chọn trường, học kỳ và ngày đầu tuần 1. Ngày này lấy từ kế hoạch học tập theo khoá (HK I 2026-2027: 07/09/2026, riêng K71 là 12/10/2026). Nếu chưa có kế hoạch thì người dùng tự chọn ngày. Nếu muốn, chọn thêm lớp khoá (ví dụ K69I-CS1) để app nạp sẵn TKB chuẩn của lớp đó.
2. Tìm môn theo mã hoặc tên, không cần gõ dấu. Mỗi môn hiện danh sách lớp dạng thẻ, gồm thứ, ca, tuần, phòng, giảng viên và sĩ số.
3. Chạm để chọn lớp. Lớp bị trùng sẽ mờ đi và ghi rõ lý do, ví dụ "trùng INT2213 · T3 ca 2 · tuần 1–15". Môn có nhóm thực hành thì hỏi thêm nhóm.
4. Xem kết quả ở dạng lưới tuần (T2–T7 × 4 ca) hoặc danh sách theo ngày. Danh sách theo ngày dễ đọc hơn trên màn hình nhỏ. Một thanh luôn hiện tổng tín chỉ.
5. Lưu nhiều phương án (A, B, C) phòng khi lớp đầy lúc đăng ký.
6. Xuất ảnh PNG (có cả cỡ hình nền điện thoại), file Word, PDF hoặc file .ics để đưa vào Google Calendar hay Apple Calendar.
7. Sau khi đăng ký xong, tải file "kết quả đăng ký" (.doc) lên để có TKB cuối cùng. App tự khớp với dữ liệu TKB để lấy thêm giảng viên, tuần học và đợt thi, những thông tin file đăng ký không có. Phòng và giờ trong file đăng ký được ưu tiên vì mới hơn, lớp đã đổi phòng sẽ được đánh dấu. File đăng ký không tách LT và TH. Buổi nào khớp với buổi TH trong TKB thì tính từ tuần 2.

| Tính năng | Ưu tiên | Ghi chú |
| --- | --- | --- |
| Dữ liệu TKB UET nạp sẵn, trang admin upload Excel | P0 | Mỗi bản upload là một phiên bản; nhận cột theo tên |
| Tìm môn, chọn lớp, báo trùng theo cả giờ và tuần | P0 | Phần lõi của sản phẩm |
| Ngày đầu tuần 1 theo khoá, hoặc tự chọn | P0 | Cần cho tuần học, màn hình Hôm nay và file .ics |
| Lưới tuần và chế độ xem theo ngày | P0 |  |
| Bố cục co giãn cho điện thoại và máy tính | P0 | Xem bảng bên dưới |
| Upload kết quả đăng ký để ra TKB cuối | P0 | Đọc ngay trên máy; bỏ phần thông tin cá nhân |
| Xuất ảnh, Word, .ics | P0 | Ảnh có dòng tên miền nhỏ ở góc để lan truyền |
| Nhiều phương án, chia sẻ bằng link | P1 | Link chỉ đọc, không cần đăng nhập |
| Admin nạp kế hoạch học tập (PDF) | P1 | Tự lấy ngày tuần 1 của từng khoá; trước đó admin nhập tay |
| Nhập khung giờ tuỳ chỉnh | P1 | UET đã có sẵn cấu hình; tính năng này phục vụ trường khác |
| Upload file TKB dạng PDF | P2 | Dùng vị trí chữ trong PDF để dựng lại cột |

### Bố cục trên điện thoại và máy tính

Thiết kế cho màn hình 360 px trước rồi mở rộng dần. Nhiều bạn xếp lịch trên laptop đúng lúc đăng ký, nên bản máy tính phải tận dụng được màn hình rộng, không chỉ kéo dãn giao diện điện thoại.

| Màn hình | Bố cục | Điểm riêng |
| --- | --- | --- |
| Điện thoại (dưới 768 px) | 1 cột, thanh tab ở đáy: Xếp lịch · Hôm nay · Lịch thi · Thêm | Mặc định xem theo ngày; lưới tuần cuộn ngang; nút đủ lớn để bấm bằng ngón cái |
| Máy tính bảng (768–1199 px) | 2 cột: danh sách môn bên trái, lưới tuần bên phải | Thanh tab chuyển lên trên |
| Máy tính (từ 1200 px) | 3 vùng: danh sách môn, lưới tuần, chi tiết lớp và cảnh báo | Rê chuột lên một lớp để xem trước trên lưới; phím tắt "/" để tìm môn; in khổ A4 ngang |

MVP chưa cần tài khoản. Dữ liệu lưu trên máy. Đăng nhập Google chỉ cần khi người dùng muốn đồng bộ giữa các thiết bị hoặc dùng tính năng nhóm.

## Tính năng giữ chân người dùng

Mỗi tính năng dưới đây gắn với một thời điểm trong học kỳ. Nhờ vậy, ngoài mùa đăng ký người dùng vẫn có lý do quay lại. Tất cả dùng chung dữ liệu là TKB cuối cùng của người dùng.

| Tính năng | Cách hoạt động | Lúc dùng nhiều nhất |
| --- | --- | --- |
| Lịch học hằng ngày | Màn hình "Hôm nay" hiện môn, phòng, giờ và đếm ngược đến ca tiếp theo. Tuần học tính từ ngày đầu tuần 1 của đúng khoá. Buổi TH bắt đầu từ tuần 2; lớp chỉ học tuần 11–15 không hiện sớm. Mặc định lịch học chỉ hiện tuần 1–15. Tuần dự phòng (16–17 ở HK I) rất linh hoạt: có lớp học, có lớp nghỉ, có lớp thi riêng. Vì vậy người dùng tự thêm buổi học bù hoặc buổi thi cho từng lớp, có thể gõ một câu tự nhiên như "tuần 16 học bù thứ 5 ca 2". Có thông báo trước giờ học | Mỗi ngày, suốt kỳ |
| Lịch thi và deadline | Đếm ngược, nhắc trước 1 ngày và 1 giờ. Người dùng tự thêm deadline bài tập | Giữa kỳ và cuối kỳ |
| Lịch thi tự động | Admin nạp file lịch thi PDF của trường (dự kiến và chính thức, mỗi đợt một file). Người dùng cũng tự tải lên được. App khớp theo mã lớp học phần trong TKB đã lưu, ra ngay lịch thi cá nhân: ngày, giờ, phòng, hình thức (viết, vấn đáp, thi trên máy). Lớp thi tại Viện Đào tạo số và Khảo thí hiện "thi theo lịch của Viện". App báo khi hai môn thi trùng hoặc sát giờ, và khi bản chính thức khác bản dự kiến | Khi trường công bố lịch thi, mỗi kỳ 2 đợt |
| Tính GPA | Mặc định chuyên cần 10%, giữa kỳ 30%, cuối kỳ 60%. Trọng số sửa được cho từng môn. App quy đổi điểm 10 sang điểm chữ và điểm 4, tính GPA kỳ và GPA tích luỹ. App cũng trả lời "cần bao nhiêu điểm cuối kỳ để được B+" | Sau thi giữa kỳ, khi có điểm |
| Giờ rảnh chung | Tạo nhóm bằng link; mỗi người chia sẻ TKB. Mặc định chỉ lộ khung giờ bận, không lộ tên môn. App vẽ bản đồ nhiệt và gợi ý 3 khung họp | Làm bài tập lớn, câu lạc bộ |
| Ghép đổi lớp | Đăng tin "có INT2213 3, cần INT2213 5". App ghép cặp, hoặc ghép vòng ba người A→B→C→A. Hai bên liên hệ qua link Facebook/Zalo do họ tự nhập. Việc đổi thật vẫn làm trên cổng của trường | Đợt điều chỉnh và đăng ký bổ sung |

File lịch thi có các cột Giờ thi, Thứ, Ngày, Học phần, TC, Mã LHP, Giảng viên, SS, PT, CBCT, Phòng thi, HTT. Mẫu này giống nhau ở cả 4 file. Một ô giảng viên thường chiếm 2–3 dòng và phòng có thể gộp như "(105,107,109)-B". Vì vậy parser neo theo Mã LHP trên từng dòng chữ, không đọc theo cột.

Bản dự kiến và bản chính thức khác nhau thật. Ở đợt 1 HK II 2025-2026, bản dự kiến bắt đầu thi từ 11/05/2026, bản chính thức từ 16/05/2026. Như vậy tính năng "báo thay đổi" có giá trị thật. Các mốc công bố lịch thi của năm học 2026-2027 nằm trong sơ đồ Lộ trình.

Công thức tính điểm cuối kỳ cần đạt, với trọng số mặc định:

```latex
\text{CK}_{\text{cần}} = \frac{\text{Mục tiêu} - 0{,}1 \cdot \text{CC} - 0{,}3 \cdot \text{GK}}{0{,}6}
```

Bảng quy đổi điểm chữ nằm trong cấu hình của từng trường và cần đối chiếu với quy chế đào tạo hiện hành trước khi ra mắt.

Về thông báo: trên Android, web push hoạt động tốt. Trên iPhone, push chỉ chạy khi người dùng đã "Thêm vào Màn hình chính". Vì vậy cần để nút xuất .ics thật nổi bật: lịch của điện thoại là cách nhắc lịch đáng tin nhất trên mọi máy.

## Tích hợp trang review dhqg.xyz

[dhqg.xyz](https://dhqg.xyz/) hiện có 4.494 đánh giá cho 333 giảng viên và 167 môn, phần lớn thuộc UET (3.821 đánh giá). Trang chưa có API công khai. Trang cũng chưa có trường điểm số có cấu trúc: điểm chỉ xuất hiện trong nội dung tự do. Vì vậy, "điểm trung bình của giảng viên" chưa lấy được nếu bạn bạn chưa bổ sung trường dữ liệu này.

App TKB chỉ hiển thị số sao trung bình, số lượt đánh giá và link sang dhqg.xyz, không chép nội dung review. Như vậy dhqg.xyz được thêm lượt truy cập, còn app TKB tránh được rủi ro về nội dung nói xấu giảng viên.

Các endpoint đề xuất gửi bạn bạn, xếp theo mức ưu tiên. P0 là đủ cho bản tích hợp đầu tiên. P1 cần dhqg.xyz thêm trường dữ liệu. P2 là trao đổi hai chiều, có lợi cho cả hai bên.

| Ưu tiên | Endpoint | Trả về | Dùng cho |
| --- | --- | --- | --- |
| P0 | `POST /api/v1/ratings/lookup`, gửi danh sách `{course_code, lecturer_name}` | Theo từng cặp môn × giảng viên: số sao trung bình, số đánh giá, phân bố số sao, ngày đánh giá gần nhất, url. Có tham số `since` để chỉ tính đánh giá gần đây | Hiện sao trên từng thẻ lớp. Gọi một lần cho cả học kỳ |
| P0 | `GET /api/v1/lecturers?school=vnu-uet&q=<tên>` | id, slug, tên, các tên gọi khác, trường, khoa, số liệu tổng, url | Khớp tên giảng viên trong file TKB |
| P0 | `GET /api/v1/stats/updated-since?ts=` | Giảng viên và môn có số liệu thay đổi kể từ thời điểm ts | Đồng bộ bộ nhớ đệm hằng ngày |
| P1 | `GET /api/v1/courses?school=vnu-uet&code=INT2213` | id, mã môn (cả mã cũ MAT1051 và mã mới UET.MAT1051), tên, số liệu, url | Thẻ môn học; xử lý mã đổi tiền tố |
| P1 | `GET /api/v1/tags?lecturer=<id>&course=<code>` | Số lượt cho từng thẻ: điểm danh, chấm dễ, bài tập nhiều… | Lọc lớp theo tiêu chí; gợi ý TKB (Premium) |
| P1 | `GET /api/v1/grades?lecturer=<id>&course=<code>` | Phổ điểm chữ (A+, A, B+…) từ những đánh giá có khai điểm, kèm số mẫu | Phổ điểm theo giảng viên, gợi ý lớp |
| P1 | `GET /api/v1/documents?course=<code>` | Số tài liệu, số chủ đề thảo luận, link sang mục Tài liệu và Thảo luận | Hiện "tài liệu ôn thi" cạnh đếm ngược ngày thi |
| P2 | `POST /api/v1/lecturer-aliases` | Gửi các cặp "tên trong TKB → id giảng viên" đã được admin duyệt | Hai bên dùng chung một bảng khớp tên |
| P2 | `POST /api/v1/teaching` | Gửi danh sách "kỳ này giảng viên X dạy lớp nào, môn nào" | dhqg.xyz hiện được lịch dạy kỳ này trên trang giảng viên |

Ngoài API, nên xin thêm hai dạng link có tham số. Chúng không tốn công làm API mà mang lại nhiều giá trị:

- **Link mở form viết đánh giá, điền sẵn môn và giảng viên**, ví dụ `/dang-danh-gia?mon=INT2213&giang-vien=190`. Sau kỳ thi, app nhắc người dùng đánh giá những lớp vừa học và mở thẳng form này. dhqg.xyz có thêm đánh giá, còn app có số liệu tốt hơn cho kỳ sau.
- **Link trang giảng viên lọc theo môn**, ví dụ `/giang-vien/<slug>?mon=INT2213`, để bấm từ thẻ lớp là thấy đúng đánh giá của môn đó.

Những việc cần thống nhất với bạn bạn:

- **Khớp tên giảng viên:** file TKB chỉ có họ tên, có khi ghép nhiều người bằng dấu "+", có khi là tên tạm như "Ngoại ngữ 4". File lịch thi lại kèm học hàm như "TS.", "PGS.TS.". Khớp theo bộ (trường, tên bỏ dấu và bỏ học hàm, mã môn), kèm bảng ánh xạ sửa tay.
- **Trường dữ liệu dhqg.xyz cần thêm khi viết đánh giá:** học kỳ đã học, điểm tổng kết nhận được (tuỳ chọn), vài thẻ có sẵn. Thiếu những trường này thì các API P1 không có dữ liệu.
- **Chỉ trả số liệu khi đủ mẫu**, ví dụ từ 5 đánh giá trở lên. Phổ điểm cần ngưỡng cao hơn để không đoán ra điểm của một người cụ thể.
- **Khoá API và giới hạn số lần gọi.** Server app TKB gọi mỗi ngày một lần rồi lưu lại, không để điện thoại người dùng gọi thẳng sang dhqg.xyz. API có số phiên bản (/v1) và header ETag để lưu đệm.
- **Ghi nguồn:** mọi chỗ hiện số sao đều ghi "theo dhqg.xyz" kèm link.
- **Thỏa thuận bằng văn bản** về việc dùng dữ liệu và chia doanh thu nếu sau này tính năng "gợi ý lớp theo giảng viên" nằm trong gói Premium.

## Kiến trúc kỹ thuật

Phần lớn xử lý chạy ngay trên điện thoại người dùng. Server chỉ làm ba việc: phát file JSON TKB, lưu dữ liệu cần chia sẻ (nhóm, ghép đổi lớp, đồng bộ), và gọi dịch vụ ngoài. Cách này giữ chi phí gần bằng 0 và chịu được lượng truy cập dồn vào ngày mở đăng ký.

&#91;embedded content: Kiến trúc · điện thoại, CDN, backend, dịch vụ ngoài\]

File của sinh viên chỉ đi vào parser trên máy. Mọi lần gọi dịch vụ ngoài đều đi qua proxy của backend, không gọi thẳng từ điện thoại.

| Lớp | Đề xuất | Lý do |
| --- | --- | --- |
| Giao diện | React + Vite (hoặc Next.js), Tailwind, PWA | Cài được lên màn hình chính, xem lịch khi không có mạng |
| Đọc file | SheetJS cho .xlsx, DOMParser cho file .doc dạng HTML, pdf.js cho PDF. Tất cả chạy trong trình duyệt | File cá nhân không rời khỏi máy |
| Dữ liệu TKB | Mỗi trường, mỗi kỳ một bộ JSON tĩnh trên CDN (TKB, lịch thi, ngày đầu tuần 1 theo khoá), có số phiên bản | Tải nhanh. So hai phiên bản để biết trường vừa sửa gì |
| Lưu trên máy | IndexedDB | Dùng được ngay, không cần tài khoản |
| Backend | Supabase (Postgres, đăng nhập Google, realtime) hoặc Firebase | Nhóm giờ rảnh, ghép đổi lớp, đồng bộ. Gói miễn phí đủ cho giai đoạn đầu |
| Thông báo | Web Push (VAPID) và file .ics | .ics thay cho push trên iPhone |
| Xuất file | Thư viện docx cho Word, html-to-image cho PNG, tự sinh file .ics | Chạy trên máy, không tốn server |
| Hosting | Cloudflare Pages hoặc Vercel | Miễn phí, có CDN |
| Theo dõi | Umami hoặc GA4 để đếm lượt dùng; Sentry để bắt lỗi parser | Biết ngay khi file mới của trường làm parser lỗi |

Parser cần một bộ test riêng. Mỗi kỳ lưu lại file mẫu của trường làm dữ liệu test. Khi trường đổi định dạng, test báo lỗi trước khi người dùng gặp. Script quảng cáo chỉ tải sau khi app đã hiển thị xong, để không làm chậm thao tác chính.

### Dùng LLM cho phần quá linh hoạt

Quy tắc (regex, bảng từ đồng nghĩa) chạy trước. LLM chỉ xử lý phần quy tắc không đọc được, và chạy ở phía server khi admin nạp file. LLM chỉ nhận các chuỗi khác nhau, nên chi phí rất nhỏ. Ví dụ file HK I 2026-2027 chỉ có 14 loại ghi chú, file HK II 2025-2026 có khoảng 50. Kết quả được lưu theo từng chuỗi hoặc theo hash file, nên mỗi thứ chỉ gọi một lần, dù có bao nhiêu người dùng.

| Chỗ dùng | Khi nào gọi | Đầu ra | Kiểm soát |
| --- | --- | --- | --- |
| Ghi chú tuần học viết tự do | Regex không nhận ra, ví dụ "Học 1 ca/10 tuần đầu, từ tuần 11 học 2 ca/tuần" | JSON: danh sách tuần, đợt thi, tiết ghi đè | Admin duyệt lần đầu; câu đã duyệt thành quy tắc cố định |
| Tên cột lạ khi trường đổi mẫu file | Không tìm thấy cột bắt buộc qua bảng từ đồng nghĩa | Đề xuất cột nào ứng với trường dữ liệu nào | Admin xác nhận, ánh xạ được thêm vào bảng từ đồng nghĩa; lần sau không cần gọi |
| File của trường mới, PDF lệch cột, ảnh chụp | Parser không đọc được, hoặc nhiều dòng lỗi | Danh sách lớp học phần theo khuôn `Section` | Kiểm tra bằng luật: thứ 2–8, tiết 1–12, mã lớp đúng mẫu. Hiện dạng nháp để duyệt |
| Lịch thi đổi mẫu | Neo theo Mã LHP không ra được ngày và giờ | Danh sách ca thi | Như trên |
| Buổi học bù, tuần dự phòng do người dùng nhập | Người dùng gõ câu tự nhiên, ví dụ "tuần 16 thi riêng thứ 7 ca 1" | Một buổi học hoặc ca thi mới | Người dùng xem lại trước khi lưu |

Nguyên tắc khi dùng LLM:

- Không gửi dữ liệu cá nhân. File kết quả đăng ký vẫn đọc bằng quy tắc trên máy. Nếu buộc phải dùng LLM, bỏ họ tên, ngày sinh, mã sinh viên trước khi gửi.
- Đầu ra phải đúng khuôn JSON và qua các luật kiểm tra. Sai thì báo admin, không tự công khai.
- Dữ liệu do AI suy luận được gắn nhãn riêng trên app, kèm nút "báo sai".
- Gọi qua proxy của backend, có hạn mức chi phí. Ghi chú chữ dùng model rẻ; model đọc ảnh chỉ dùng cho Premium.
- Phần LLM phía admin (ghi chú, tên cột, lịch thi) miễn phí cho người dùng vì chi phí tính theo file, không theo người.

## Lộ trình

Trường không có lịch mở đăng ký cố định, nên lộ trình bám theo các mốc công bố trong kế hoạch học tập 2026-2027. Mốc quan trọng nhất là lúc trường công bố TKB HK II chính thức, tuần 09–15/11/2026: sinh viên bắt đầu xếp lịch từ đó. Nếu trễ tiến độ, cắt phần xuất Word và phần nhiều phương án để vẫn kịp.

&#91;embedded content: Lộ trình · 5 giai đoạn, 2 mốc\]

Nếu bắt đầu code muộn và lỡ mốc tháng 11, có hai mốc dự phòng. Một là TKB học kỳ phụ (31/05–06/06/2027). Hai là TKB năm học 2027-2028 (05–11/07/2027). Mốc thứ hai đáng nhắm hơn vì mở đầu cả năm học và đón thêm một khoá tân sinh viên.

## Phác thảo bản Premium

Xếp TKB cơ bản luôn miễn phí. Premium thu tiền cho những thứ tốn chi phí gọi API hoặc tiết kiệm nhiều thời gian. Chỉ nên mở Premium sau khi app đã qua ít nhất một mùa đăng ký và có người dùng quay lại đều.

| Tính năng | Cách làm | Chi phí vận hành | Miễn phí / Premium |
| --- | --- | --- | --- |
| Gợi ý TKB tối ưu | Người dùng chọn môn và tiêu chí: không học T7, tránh ca 4, dồn vào ít ngày, ít lần lên Hòa Lạc, ưu tiên giảng viên nhiều sao. Thuật toán quay lui (backtracking) duyệt các tổ hợp lớp, chấm điểm rồi trả về 5 phương án tốt nhất. Chạy ngay trên máy | Gần bằng 0 | Miễn phí: 1 gợi ý. Premium: đủ xếp hạng và tiêu chí giảng viên |
| Đọc ảnh hoặc PDF scan bằng AI | Ảnh gửi qua backend đến mô hình đọc ảnh, nhận về JSON đúng khuôn `Section`. Người dùng duyệt và sửa trước khi lưu. Lưu kết quả theo mã hash của file, nên người thứ hai tải cùng file sẽ không tốn thêm | Tính theo lượt gọi API | Miễn phí: vài lượt mỗi kỳ. Premium: nhiều lượt hơn |
| Gói nhóm | Tìm phương án để cả nhóm học chung lớp ở những môn chung, riêng môn khác vẫn không trùng | Gần bằng 0 | Premium, tính theo nhóm |
| Không quảng cáo, giao diện và hình nền riêng | Tắt quảng cáo; thêm mẫu hình nền khoá màn hình và bảng màu | Không có | Premium |
| Trợ lý hỏi đáp | Hỏi "tuần sau mình thi gì", "còn thiếu bao nhiêu tín chỉ" dựa trên dữ liệu của chính người dùng | Tính theo lượt gọi API | Premium, làm sau cùng |

Nguyên tắc kỹ thuật khi gọi API ngoài:

- Khoá API chỉ nằm trên server, không bao giờ để trong code phía trình duyệt.
- Mỗi người dùng có hạn mức riêng, và có nhật ký chi phí theo ngày. Đặt ngưỡng tự tắt khi chi phí vượt ngân sách.
- Kết quả AI luôn hiện ở dạng nháp để người dùng kiểm tra. Ảnh chụp TKB hay bị nghiêng hoặc cắt mất cột.
- Xoá ảnh gốc ngay sau khi đọc xong.

Giá và thanh toán (đề xuất để kiểm chứng):

- Bán theo kỳ vì nhu cầu cũng theo kỳ. Thử mức 29.000–49.000đ/kỳ, chốt giá sau khi khảo sát vài trăm người dùng.
- Thanh toán bằng chuyển khoản VietQR, có đối soát tự động. Trước khi thu tiền, nên hỏi kế toán về việc đăng ký hộ kinh doanh và nghĩa vụ thuế.
- Có gói nhóm (4–5 người) rẻ hơn mua lẻ, để người dùng tự rủ nhau mua.

## Kiếm tiền và tăng trưởng

Nguồn thu chính nên đến từ tài trợ đúng đối tượng và từ Premium. Banner quảng cáo đại trà trả rất ít ở Việt Nam và dễ làm người dùng khó chịu.

| Nguồn thu | Cách làm | Ghi chú |
| --- | --- | --- |
| Tài trợ trực tiếp | Một ô nhà tài trợ mỗi kỳ trên màn hình "Hôm nay": trung tâm tiếng Anh, luyện thi, đơn vị tuyển thực tập | Bán theo kỳ, kèm số liệu lượt xem. Ví dụ nhu cầu có thật: file TKB có Tiếng Anh B2 (FLF1108) |
| Quảng cáo mạng (AdSense) | 1–2 vị trí cố định, không popup, không chèn vào luồng chọn lớp | Nguồn phụ. Tải sau khi app đã hiển thị |
| Affiliate | Laptop, sách giáo trình, phần mềm bản quyền sinh viên | Ghi rõ đây là link affiliate |
| Premium | Xem phần Premium | Bắt đầu từ kỳ thứ hai |

Kênh tăng trưởng, xếp theo mức độ hiệu quả dự kiến:

1. **Đăng đúng lúc.** Ngay khi trường công bố TKB chính thức (vì lịch mở đăng ký không cố định), đăng bài trên confession và group của UET, kèm video 30 giây quay cảnh xếp TKB trên điện thoại.
2. **Ảnh TKB có tên miền.** Ảnh xuất ra có một dòng tên miền nhỏ. Mỗi lần sinh viên khoe TKB hay đặt làm hình nền là một lần quảng cáo miễn phí.
3. **Link nhóm.** Tính năng giờ rảnh chung và ghép đổi lớp chỉ dùng được khi rủ thêm người, nên người dùng sẽ tự mời bạn.
4. **Cộng tác viên theo khoá/ngành.** Mỗi lớp khoá một bạn, đổi lại Premium miễn phí. Họ cũng là người báo lỗi dữ liệu nhanh nhất.
5. **SEO theo môn.** Mỗi môn một trang, ví dụ "INT2213 Mạng máy tính – các lớp HK II 2026-2027". Người dùng tìm trên Google trong mùa đăng ký sẽ vào thẳng app.
6. **Liên kết chéo với dhqg.xyz.** Hai trang đặt link qua lại cho nhau.

Các chỉ số nên theo dõi: số TKB được tạo mỗi mùa, tỷ lệ người dùng mở app hằng tuần ngoài mùa đăng ký, số người cài PWA hoặc bật thông báo, số nhóm được tạo, và tỷ lệ chuyển sang Premium.

## Rủi ro và pháp lý

Rủi ro lớn nhất là dữ liệu cá nhân. [Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://thitruongtaichinhtiente.vn/nhung-diem-chinh-can-luu-y-tai-luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-tu-ngay-1-1-2026-75881.html) có hiệu lực từ 1/1/2026. Mức phạt tối đa với tổ chức là 3 tỷ đồng cho phần lớn vi phạm. Vi phạm về chuyển dữ liệu ra nước ngoài có thể bị phạt đến 5% doanh thu năm trước. Cá nhân vi phạm chịu mức bằng một nửa. Mình không phải luật sư; trước khi thu tiền nên hỏi người có chuyên môn.

| Rủi ro | Biện pháp |
| --- | --- |
| File đăng ký chứa họ tên, ngày sinh, mã sinh viên | Đọc trên máy. Chỉ giữ bảng môn học, bỏ phần thông tin cá nhân, không gửi lên server |
| Server đặt ở nước ngoài (Supabase, Vercel) | Thu ít dữ liệu nhất có thể: email đăng nhập và các mã lớp. Có chính sách riêng tư, hỏi đồng ý, nút xoá tài khoản. Xem xét chọn vùng máy chủ gần Việt Nam |
| Bị hiểu là công cụ chính thức | Không dùng logo hay tên VNU/UET làm thương hiệu. Chân trang ghi "Công cụ của sinh viên, không phải của nhà trường" |
| Truy cập cổng trường | Không xin mật khẩu, không tự động đăng ký hộ, không cào dữ liệu từ [dangkyhoc.vnu.edu.vn](https://dangkyhoc.vnu.edu.vn/) |
| Dữ liệu sai hoặc cũ | Hiện "cập nhật lúc…" và link văn bản gốc. Có nút "báo sai" trên từng lớp. Người dùng luôn đối chiếu lại trên cổng trước khi đăng ký |
| Nội dung review gây tranh cãi | Chỉ hiện số sao tổng hợp và link sang dhqg.xyz. Phần kiểm duyệt nội dung do trang gốc chịu trách nhiệm |
| Trường đổi định dạng file | Parser tách riêng theo trường, có bộ test. Admin nhập tay được nếu parser lỗi |
| Phụ thuộc một người nạp dữ liệu mỗi kỳ | Viết hướng dẫn nạp dữ liệu. Có ít nhất 2 người có quyền admin, kế nhiệm theo khoá (xem mục Nguồn dữ liệu lâu dài) |
| Lượng dùng chỉ tăng vọt theo mùa | Chính là lý do cần các tính năng giữ chân và bán tài trợ theo kỳ |

### Nguồn dữ liệu lâu dài, khi bạn đã ra trường

Khi bạn ra trường, file TKB và lịch thi vẫn được gửi qua email cho từng sinh viên đang học, mỗi kỳ hàng nghìn người nhận. UET không đăng công khai các file này. Việc cần làm là để việc nạp dữ liệu không phụ thuộc vào một người. Nên làm theo thứ tự sau:

1. **Người dùng tự tải file lên.** Bất kỳ sinh viên nào nhận được file TKB, lịch thi hay kế hoạch học tập đều tải lên được. App chạy parser và so với bản đang có. Bản mới chỉ được công khai khi admin duyệt, hoặc khi hai người khác nhau tải lên cùng một file (trùng mã hash). Đây nên là nguồn chính.
2. **Hộp thư nhận file.** Sinh viên chỉ cần chuyển tiếp email của trường đến một địa chỉ riêng của app, ví dụ nop@\<tên miền>. Server lấy file đính kèm, chạy parser và đưa vào hàng chờ duyệt như cách 1. Email chuyển tiếp có tên và địa chỉ người gửi, nên server xoá email ngay sau khi lấy file. Cách này dễ hơn tải lên, vì sinh viên làm được ngay trong app email trên điện thoại.
3. **Admin kế nhiệm theo khoá.** Luôn có 2–3 admin là sinh viên đang học, mỗi khoá ít nhất một người, đổi lại được dùng Premium miễn phí. Bàn giao trước khi bạn ra trường, kèm tài liệu hướng dẫn nạp dữ liệu.
4. **Dữ liệu từ file đăng ký, nếu người dùng đồng ý.** Khi người dùng tải file kết quả đăng ký, app hỏi có cho gửi riêng phần mã lớp, thứ, tiết, phòng không. Phần gửi đi không kèm thông tin cá nhân. Nhờ đó app biết phòng mới nhất và tự phát hiện lớp đổi phòng.
5. **Extension Chrome (làm sau).** Extension lấy danh sách lớp ngay trên cổng đăng ký của chính người dùng, nên dữ liệu luôn mới.
6. **Lâu dài:** bàn giao dự án cho một CLB học thuật của trường. Hoặc đề xuất hợp tác với Đoàn – Hội sinh viên để nhận file chính thức.
7. **Khi mở rộng sang trường khác:** một số trường thành viên ĐHQGHN có đăng công khai file PDF. Ví dụ trường Khoa học liên ngành và Nghệ thuật đăng [lịch trình đào tạo 2025-2026](https://daotao.sis.vnu.edu.vn/wp-content/uploads/2025/08/Lich-trinh-dao-tao-dai-hoc-nam-hoc-2025-2026.pdf), còn ULIS đăng [thông báo lịch thi](https://student.ulis.vnu.edu.vn/files/uploads/2025/09/Lich-thi-HP-CTDT-Thu-2-BK-cac-khoa-cac-NN-HK-HE-23.24-DU-KIEN-15.7.24-1.pdf). Với những trường này, một bot kiểm tra trang thông báo mỗi ngày và báo admin khi có file mới, không cần đăng nhập.

## Góp ý bổ sung và câu hỏi còn mở

Những ý dưới đây chưa có trong danh sách của bạn, sắp theo giá trị so với công sức bỏ ra:

1. **Báo khi trường sửa TKB.** Trường hay ra công văn điều chỉnh TKB. Admin nạp bản mới, app so với bản cũ rồi báo cho đúng những người có lớp bị đổi phòng hay đổi giờ. Đây là lý do rất mạnh để người dùng bật thông báo. (Oke, nhưng cũng tính đến trường hợp tôi ra trường và không còn nhận được tkb nữa thì phải làm sao)
2. **Nạp TKB theo lớp khoá.** Cột Lớp đã có sẵn trong file. Sinh viên năm nhất và năm hai chỉ cần một cú chạm là có TKB. Oke
3. **Cảnh báo di chuyển giữa cơ sở.** File có phòng ở Hòa Lạc và ĐHKHTN. App báo khi hai ca liền nhau nằm ở hai cơ sở khác nhau. oke
4. **Đếm tín chỉ và ước tính học phí.** Cảnh báo khi dưới mức tối thiểu hoặc vượt mức tối đa. File đăng ký có cả cột học phí nên kiểm tra chéo được. oke
5. **Hình nền khoá màn hình.** Xuất TKB đúng tỉ lệ màn hình điện thoại, có nền sáng và nền tối. Sinh viên rất hay dùng kiểu này và hay khoe lên mạng. Oke
6. **Extension Chrome cho cổng đăng ký (làm sau).** Extension xuất danh sách lớp đang mở ngay trên trang đăng ký, giống "CTU Timetable Exporter" của ĐH Cần Thơ. Cách này không cần xin mật khẩu và không cần chờ trường phát file. Oke
7. **Tên thương hiệu trung lập.** Không chứa chữ "VNU", để còn mở rộng ra trường ngoài và tránh nhầm với công cụ chính thức. Oke
8. **Chia đều giá trị giữa bản miễn phí và Premium.** Các tính năng giữ chân (lịch hằng ngày, GPA, nhóm) luôn miễn phí. Chúng tạo ra lượng người dùng mà quảng cáo và tài trợ cần. Oke

### Đề xuất tên

Nên chọn **Kỳ Này**. Tên ngắn, thuần Việt, dễ nói, và bao được cả năm học: "kỳ này học gì, thi gì, được mấy điểm". Điều này khớp với mục tiêu giữ người dùng ngoài mùa đăng ký. Tên cũng không chứa VNU hay UET nên mở rộng được. Các tên gắn với bạn (Hoàng) có câu chuyện hay hơn, nhưng sẽ vướng khi bàn giao dự án cho khoá sau.

| Tên | Ý nghĩa | Điểm mạnh | Điểm yếu |
| --- | --- | --- | --- |
| Kỳ Này | "Kỳ này học gì, thi gì" | Bao cả TKB, lịch thi, GPA; dùng được quanh năm | Cụm từ thông dụng, khó nổi bật khi tìm trên Google; cần logo riêng |
| Huy Hoàng | Chơi chữ tên bạn: "huy hoàng" là rực rỡ, "một học kỳ huy hoàng" | Dễ nhớ, có câu chuyện để kể khi ra mắt | Gắn với một người; trông như trang cá nhân |
| Hoàng Lịch | Tên bạn + "lịch". "Hoàng lịch" cũng là tên cuốn lịch xem ngày thời xưa | Hai lớp nghĩa, dễ gây tò mò | Dễ bị nhầm với app lịch vạn niên, xem ngày tốt xấu |
| TKBee | TKB + "bee": chăm như ong | Linh vật con ong dễ vẽ, hợp để đóng dấu lên ảnh TKB xuất ra | Pha tiếng Anh; chữ "TKB" chỉ nói về thời khoá biểu |
| Săn Slot | Từ lóng của sinh viên mùa đăng ký | Rất dễ lan truyền trong mùa đăng ký | Yếu ngoài mùa; nghe như bot tự đăng ký, đúng thứ app tránh |
| Ca Học | "Ca" là đơn vị quen thuộc ở UET | Ngắn, thuần Việt | Nhiều trường khác dùng "tiết" chứ không dùng "ca" |

Có thể kết hợp: tên sản phẩm là Kỳ Này, còn trang Giới thiệu kể câu chuyện "Huy Hoàng làm ra Kỳ Này". Trước khi chốt, kiểm tra tên miền, tên trùng trên kho ứng dụng và nhãn hiệu đã đăng ký.

Câu hỏi cần trả lời trước khi code:

- [x] Xin một file lịch thi (giữa kỳ và cuối kỳ) của UET để thiết kế tính năng lịch thi
- [x] Xin file TKB HK I 2026-2027 cùng kỳ với file kết quả đăng ký, để test khớp hai file từ đầu đến cuối
- [x] Hỏi giờ thực tế của "Tiết 1-2, 3-4, 7-8, 9-10" bên TT Giáo dục thể chất
- [x] Hỏi ngày bắt đầu tuần 1 của mỗi kỳ, để tính tuần học và đợt thi
- [x] Kiểm tra file kết quả đăng ký có ghi nhóm thực hành không: file mẫu không tách buổi LT và TH
- [x] Hỏi lịch mở đăng ký HK II 2026-2027 của UET. Năm trước, ULIS mở đăng ký lớp học phần chung từ 11/12/2025 ([thông báo ULIS](https://student.ulis.vnu.edu.vn/files/uploads/2025/11/TB-6240-21.11.2025_TB-dang-ky-cac-lop-hoc-phan-chung-HK2-2526.pdf))
- [x] Xin một file kết quả đăng ký của trường khác trong ĐHQGHN, để xác nhận định dạng có giống UET không
- [x] Thống nhất với bạn bạn về API, khoá truy cập và cách chia doanh thu

Đã chốt ngày 19/10/2026:

- Giáo dục thể chất: bỏ qua trong MVP, vì do đơn vị khác tổ chức.
- Ngày đầu tuần 1 lấy từ kế hoạch học tập. Nếu chưa có kế hoạch thì người dùng tự chọn ngày.
- File đăng ký không tách LT và TH. Buổi TH bắt đầu từ tuần 2.
- Mặc định học tuần 1–15. Tuần dự phòng linh hoạt, nên người dùng tự thêm buổi học bù hoặc buổi thi riêng.
- Không có lịch mở đăng ký cố định, nên lộ trình bám theo mốc "TKB HK II" trong kế hoạch học tập.
- UET chỉ gửi TKB và lịch thi qua email cho từng sinh viên, không đăng công khai.
- Được dùng LLM hoặc API ngoài cho phần lịch quá linh hoạt.
- File đăng ký của trường khác, API của dhqg.xyz và tên miền để sau.
- Giao diện tối ưu cả cho máy tính.
- Cả 8 góp ý bổ sung ở trên đều được giữ.

Câu hỏi mới:

- [x] Lịch GDTC của HK I 2026-2027: bỏ qua trong MVP
- [x] UET có đăng công khai file không: không, chỉ gửi email. Đã thêm cách "Hộp thư nhận file"
- [x] Tuần dự phòng: linh hoạt, người dùng tự thêm buổi
- [x] Lớp không ghi số tuần: mặc định tuần 1–15
- [ ] Chọn tên trong mục "Đề xuất tên"; tìm tên miền sau

## Nguồn

- [dhqg.xyz](https://dhqg.xyz/): số đánh giá, giảng viên, môn học, cấu trúc URL
- [Thị trường Tài chính Tiền tệ: Luật Bảo vệ dữ liệu cá nhân có hiệu lực từ 1/1/2026](https://thitruongtaichinhtiente.vn/nhung-diem-chinh-can-luu-y-tai-luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-tu-ngay-1-1-2026-75881.html)
- [ULIS: Thông báo đăng ký lớp học phần chung HK II 2025-2026](https://student.ulis.vnu.edu.vn/files/uploads/2025/11/TB-6240-21.11.2025_TB-dang-ky-cac-lop-hoc-phan-chung-HK2-2526.pdf)
- [ULIS: Thông báo lịch thi HK hè 2023-2024, bản dự kiến](https://student.ulis.vnu.edu.vn/files/uploads/2025/09/Lich-thi-HP-CTDT-Thu-2-BK-cac-khoa-cac-NN-HK-HE-23.24-DU-KIEN-15.7.24-1.pdf)
- [Trường Khoa học liên ngành và Nghệ thuật: Lịch trình đào tạo đại học 2025-2026](https://daotao.sis.vnu.edu.vn/wp-content/uploads/2025/08/Lich-trinh-dao-tao-dai-hoc-nam-hoc-2025-2026.pdf)
- [CTU Timetable Exporter (Chrome Web Store, qua ChromeBoard)](https://chromeboard.com/extension/ctu-timetable-exporter-jbkkdknllghjdfmobfnmeimbgfjmjpag)
- File UET bạn gửi: TKB HK II 2025-2026 chính thức (CV 109/ĐT) và dự kiến (CV 3019/ĐT); TKB HK I 2026-2027 cập nhật 20/08/2026; kết quả đăng ký HK I 2026-2027; lịch thi HK II 2025-2026 (dự kiến đợt 1, chính thức đợt 1 và đợt 2) và HK hè; kế hoạch học tập 2026-2027 (KH 1489/KH-ĐHCN); ảnh khung giờ
