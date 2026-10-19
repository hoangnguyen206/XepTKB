# Roadmap — từ MVP UET đến nền tảng nhiều trường

> **Status:** proposed  
> **Owner:** Product  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [PRD](PRD.md), [Implementation plan](IMPLEMENTATION_PLAN.md)

## Nguyên tắc

MVP phải tạo được giá trị độc lập ngay cả khi không có tài khoản, nhóm, AI hay tích hợp review. Mỗi giai đoạn sau chỉ mở khi có evidence về correctness, retention, vận hành và pháp lý; không mở rộng vì “có thể làm” nếu làm tăng trust boundary trước khi dữ liệu UET ổn định.

## Giai đoạn 0 — Foundation / beta UET

**Mục tiêu:** kịp mùa TKB HK II 2026–2027, dự kiến 09–15/11/2026.

- TKB UET versioned admin preload.
- Search/select/conflict theo tuần, day/grid, week 1.
- Local registration result merge và override.
- PNG/ICS (Word nếu không ảnh hưởng cut line).
- PWA/offline, provenance, report issue, privacy baseline.

**Mở rộng chỉ khi:** parser fixtures đạt release gate, có ít nhất hai người có thể ingest/review, rollback đã diễn tập.

## Giai đoạn 1 — Retention miễn phí

- Màn hình Hôm nay và tuần hiện tại.
- Lịch thi dự kiến/chính thức với diff.
- Deadline và nhắc lịch qua `.ics`; Web Push chỉ khi consent và platform hỗ trợ.
- GPA/điểm mục tiêu, với quy chế/weight config được xác nhận.
- Custom week 16–17/buổi bù do user nhập, luôn hiển thị là user-created.

**Mở khi:** core user quay lại, dữ liệu lịch thi có owner, notification không thu PII ngoài cần thiết.

## Giai đoạn 2 — Chia sẻ và cộng tác

- Read-only share link cho Plan.
- Nhóm giờ rảnh với default chỉ lộ busy/free, không lộ môn.
- Đồng bộ đa thiết bị tùy chọn, Google login chỉ để opt-in.
- Ghép đổi lớp dạng listing/link, không tự động thao tác portal.

**Mở khi:** threat model/account deletion/rate limit/audit đã được review; user hiểu dữ liệu nào được chia sẻ.

## Giai đoạn 3 — Nhiều trường

- School adapter/config: time frame, aliases, campus, grading.
- Parser contract và fixture harness dùng chung.
- Onboarding trường thứ hai trong ĐHQGHN; sau đó mới cân nhắc ngoài trường.
- User upload candidate → hash/dedup → admin approval; email intake là opt-in sau privacy review.

**Mở khi:** UET ingestion có quy trình kế nhiệm, parser coverage có metrics, không phụ thuộc founder.

## Giai đoạn 4 — Giá trị trả phí / Premium

- Gợi ý tổ hợp lớp tối ưu chạy local.
- Nhóm nâng cao.
- AI đọc PDF/ảnh ở server với consent, redaction, budget cap, draft review.
- Không quảng cáo, hình nền/theme, trợ lý hỏi đáp.
- Tích hợp dhqg.xyz chỉ sau thỏa thuận API/data/attribution.

**Nguyên tắc:** phần miễn phí (xếp lịch, lịch hằng ngày, GPA cơ bản) phải vẫn hữu ích; Premium không được làm core privacy kém đi.

## Các tín hiệu hoãn roadmap

- Parser chưa deterministic hoặc có nhiều false positive.
- Không có admin kế nhiệm và rollback.
- Có security/privacy finding chưa có owner.
- Chi phí API/LLM không đo được hoặc không có circuit breaker.
- Chưa có bằng chứng người dùng cần tính năng thay vì chỉ yêu cầu trên giấy.
