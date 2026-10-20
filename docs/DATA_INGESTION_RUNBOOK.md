# Data ingestion runbook

> **Status:** draft / operational gate  
> **Owner:** Data Parser + Release Manager  
> **Last reviewed:** 2026-10-20
> **Related docs:** [Parser spec](PARSER_SPEC.md), [Security](SECURITY_PRIVACY.md), [Operations](OPERATIONS.md)

## 1. Mục tiêu

M1 có parser package offline và M2 có pure domain engine cùng synthetic fixture evidence cho UET XLSX/registration HTML candidate extraction và local merge behavior. Quarantine, diff, independent review, immutable artifact build, publish và rollback bên dưới là operational target; chưa có public dataset hoặc admin runtime trong repository.


## 2. Roles

- **Submitter:** đưa file/metadata, không tự approve.
- **Data Parser:** chạy adapter, giải thích issue, tạo candidate/report; không tự approve.
- **Data Reviewer:** độc lập kiểm tra raw-vs-normalized, count, sample, drift, provenance và compatibility; ký `validated`/`hold`.
- **Release Manager:** quyết định publish/rollback, ghi changelog; là accountable duy nhất.
- **Security Reviewer:** gate PII/vendor/access khi loại nguồn hoặc boundary mới.

Data Parser là producer; Data Reviewer không được là người tạo candidate. First publish hoặc parser version mới cần hai actor approval, trong đó một actor là Data Reviewer độc lập. Tối thiểu hai người có quyền release trong mùa đăng ký; danh sách/rotation lưu ở hệ thống quản trị, không ghi contact cá nhân trong repo.

## 3. Intake và quarantine

1. Ghi `sourceType`, school, term, expected status (planned/official), source document ref, received time, submitter.
2. Tạo source SHA-256 trước parse chỉ với approved non-PII source; phát hiện duplicate hash. Không hash họ tên/mã sinh viên/ngày sinh hoặc registration file PII để đưa vào report/log; user registration được xử lý local-only.
3. Kiểm tra file type/size/extension/content; không mở file trong thư mục chứa script không tin cậy; upload vào vùng quarantine không executable.
4. Nếu file có PII ngoài phạm vi được phê duyệt → dừng, không đưa vào parser/server; xóa hoặc chuyển quy trình privacy.
5. Tạo `ImportArtifact(status=candidate)` và report intake.

## 4. Parse và validate

Chạy adapter theo [PARSER_SPEC.md](PARSER_SPEC.md):

- detect header/page;
- map synonym, fill-down merged cells;
- normalize code/day/period/kind/group/room/lecturer;
- parse notes/weeks và áp dụng default có warning;
- group/dedup theo Section;
- validate schema/invariants;
- ghi error/warning theo row/page, không ghi PII.

Nếu có error blocking: giữ candidate, không publish; tạo reproducer/sửa rule hoặc manual correction có provenance.

## 5. Diff với bản đang publish

So sánh:

- Section added/removed/changed;
- session day/period/week/room/campus/kind/group;
- credits/course name/lecturer;
- exam date/status nếu là lịch thi.

Mỗi diff có old/new dataset version và source row/page. Thay đổi lớn bất thường (count giảm mạnh, period invalid, unknown column tăng) phải stop và review, không chỉ “accept snapshot”.

## 6. Review checklist

- [ ] Đúng school/term/source document/status.
- [ ] Hash/parser/schema version có đủ.
- [ ] Required columns được nhận bằng tên, không dựa vị trí.
- [ ] Count/summary so với fixture/source expectation.
- [ ] Sample các edge case: merged, note override, tuần lẻ, ONL, T7, campus, group.
- [ ] Không còn blocking errors; warnings có giải thích/owner.
- [ ] Diff đã đọc; các đổi phòng/giờ có lý do.
- [ ] Link/citation gốc được phép hiển thị.
- [ ] Security review ở G1 nếu source/boundary mới có PII, vendor hoặc auth; G3b verification sau implementation.
- [ ] Data Reviewer độc lập đã validate candidate; Data Parser không tự approve.
- [ ] Reviewer thứ hai và hai actor distinct duyệt khi first publish/parser version mới.

## 7. Publish

1. Build immutable artifact + metadata/manifest.
2. Validate schema/hash sau build, không tin output trước build.
3. Upload candidate prefix, smoke fetch từ preview.
4. Release Manager ký/approve publish; cập nhật catalog pointer/manifest atomically.
5. Giữ bản trước để rollback; ghi publishedAt/reviewer/changelog.
6. Thông báo version/update cho app; không invalidate Plan local mù.

Trạng thái hợp lệ: `candidate → hold` (thiếu evidence/chờ sửa) hoặc `candidate → validated → published`; candidate có lỗi bị `rejected`; published có lỗi bị `retracted`. Không xóa artifact cũ trước khi hết retention/rollback window.

## 8. Rollback và correction

- Nếu sai dữ liệu: đánh dấu bản lỗi `retracted`, trỏ catalog về version cuối cùng đã biết tốt, purge cache chỉ khi cần.
- Nếu user đã dùng bản lỗi, hiện banner/diff dựa trên section bị ảnh hưởng; không cần biết danh tính nếu không có subscription.
- Tạo incident/change report: hash, root cause, affected fields, mitigation, test mới.
- Publish bản sửa với version mới; không mutate version cũ.

## 9. Nguồn kế nhiệm dài hạn

Ưu tiên:

1. user upload candidate → hash/dedup → admin review;
2. hộp thư nhận file với privacy/legal approval, xóa email sau xử lý;
3. 2–3 admin sinh viên theo khóa, bàn giao trước khi người cũ ra trường;
4. dữ liệu registration chỉ gửi phần schedule khi user explicit consent;
5. extension/partnership là roadmap, không phụ thuộc MVP.

Mỗi handoff phải có parser version, known quirks, fixture metadata, release/rollback drill và người kế nhiệm. Không phụ thuộc một email cá nhân hoặc một máy local.

## 10. Khi parser fail mùa đăng ký

1. Giữ artifact đang publish; ghi status và thời điểm.
2. Thu thập file/source reference đã được phép, hash và error summary.
3. Tạo synthetic reproducer nếu raw file không được commit.
4. Data Parser sửa adapter/test; Data Reviewer kiểm tra diff.
5. Nếu cần manual data, nhập tối thiểu có hai người review và gắn `source=manual`.
6. Publish sau gate; cập nhật docs/known limitations.

## 11. Report bắt buộc

Dùng `.claude/templates/DATA_IMPORT_REPORT.md`, gồm intake, parser summary, issue counts, diff, reviewer, decision, artifact/version, rollback point và follow-up.
