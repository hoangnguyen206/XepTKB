# Parser specification — UET và adapter nhiều trường

> **Status:** draft  
> **Owner:** Data Parser  
> **Last reviewed:** 2026-10-25
> **Related docs:** [Domain model](DOMAIN_MODEL.md), [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md), [QA plan](QA_TEST_PLAN.md)

## 1. Mục tiêu và nguyên tắc

Parser biến file nguồn thành canonical `Course/Section/Session/Term/Exam` có provenance và validation. Parser phải **deterministic-first**: rule, synonym, regex và schema validator chạy trước mọi AI fallback. Không publish output chỉ dựa trên confidence của model.

Mỗi lần import là một `ImportArtifact` có source hash (chỉ khi source được phép và không chứa PII), parser version, source reference, warnings/errors và trạng thái `candidate|hold|validated|published|rejected|retracted`. Với registration local-only, `sha256` và `fileName` đều bỏ trống; artifact dùng marker không định danh. Raw source chỉ giữ ở nơi được phép; file kết quả đăng ký của user không rời browser và không được hash/log để nhận diện người dùng.

## 2. Pipeline chuẩn

```text
identify source + approved-source hash (or local-only marker)
  → quarantine/type/size checks
  → detect format/header/page
  → fill merged cells / repeat page context
  → map columns by canonical names + synonyms
  → filter valid rows / skip subtotal headings
  → normalize codes, names, day, periods, kind, group, room, lecturer
  → parse notes into weeks/period override/exam round
  → infer only approved defaults (with warning)
  → group/deduplicate sessions by Section
  → validate schema + domain invariants
  → generate quality report + diff
  → human review
  → build immutable artifact / local preview
```

Không thay đổi thứ tự bằng cách đưa LLM lên trước rule. Bất kỳ bước inference nào phải ghi `inferenceReason`/warning.

## 3. Input adapters

| Source | Adapter | Header/content rule | MVP |
| --- | --- | --- | --- |
| UET TKB `.xlsx` | `uet-xlsx` | tìm row có “Mã LHP”; header row 1 hoặc 4 | P0 |
| UET TKB `.pdf` text | `uet-pdf-text` | page-level repeated header; neo theo Mã LHP | fixture/test, P2 upload |
| Registration `.doc` HTML | `vnu-registration-html` | DOM table; không tin extension | P0 local |
| Exam schedule PDF | `uet-exam-pdf` | neo Mã LHP, gộp lecturer/room rows | P1 |
| Study-plan PDF | `uet-study-plan-pdf` | chỉ lấy week 1/cohort | P1 |

PDF scan/image không nằm trong MVP; nếu dùng OCR/LLM, output là candidate cần user/admin duyệt.

## 4. Canonical column mapping

| Canonical | Synonyms / examples | Required |
| --- | --- | --- |
| `homeClass` | `Lớp`, `Lớp khóa`, `Lop` | recommended |
| `courseCode` | `Mã HP`, `Mã môn`, `Ma hoc phan` | yes |
| `courseName` | `Môn`, `Tên học phần`, `Ten mon` | yes |
| `credits` | `TC`, `Tín chỉ` | recommended |
| `sectionId` | `Mã LHP`, `Mã lớp học phần` | yes |
| `group` | `Nhóm`, `Nhom` | recommended |
| `kind` | `LT/TH`, `BT/TH`, `LT+BT/TH`, `Loại buổi` | yes |
| `day` | `Thứ`, `Thu` | conditional |
| `shift` | `Ca`, `C`, `Sáng`, `Chiều` | conditional |
| `periodText` | `Tiết`, `Tiết học` | conditional |
| `room` | `GĐ`, `Giảng đường`, `Phòng` | optional |
| `lecturer` | `GV`, `Giảng viên` | optional |
| `note` | `Ghi chú`, `Ghi chú học`, `Tuần học` | optional |
| `examRound` | `Đợt thi` | optional |

Unknown columns được giữ trong raw metadata nhưng không được tự gán canonical field. Header recognition dùng normalized Unicode/case/whitespace, không dùng index cột.

## 5. Normalization rules

### Course/Section code

- trim, Unicode normalize, uppercase;
- bỏ dấu sao `*` và whitespace thừa;
- giữ mapping giữa `PES 1075`/`PES1075`, `UET.MAT1051`/`MAT1051` trong alias;
- không bỏ prefix nếu collision; lưu cả canonical và alt code;
- `sectionId` phải có course code + suffix hợp lệ; row thiếu Mã LHP bị loại hoặc warning tùy source.

### Day/period

- map `T2..T7`, `Thứ 2..7`, `CN` thành 2..8;
- map `Ca 1..4`, `1-2`, `1 - 2`, `Sáng/Chiều` qua TimeFrame;
- parse `Tiết 9-12`, `9 – 12`, `9,10,11,12` thành range/explicit periods;
- note period override thắng shift/cột Ca và phải ghi warning trace.

### Kind/group

- `TL+TH` → alias đã cấu hình, không đoán ngoài bảng;
- canonical kind: `LT`, `TH`, `BT`, `ONL`, `OTHER`;
- `CL` là group đặc biệt “cả lớp”; nhóm số giữ string để không mất leading zero;
- Dòng có kind `ONL` (gồm alias chứa `online`) bị loại khỏi dataset và khỏi candidate registration, kèm warning `ONLINE_SECTION_EXCLUDED` theo `sourceRow` (Q-009: học tự do theo giảng viên). Section chỉ có dòng `ONL` không được tạo.
- Đồ án, thực tập/LMS không có fixed period thì session `fixedTime=false`, không chiếm grid. **Chưa** có rule nhận diện cho các dòng này; cần dữ liệu thật và quyết định trước khi thêm từ khóa (không nới validator). Hiện dòng thiếu thứ/tiết vẫn là error.

### Room/campus/lecturer

- giữ raw room; tách campus bằng config/pattern (`ĐHKHTN`, `Hòa Lạc`, ...), không parse địa chỉ bằng LLM trong P0;
- lecturer split dấu `+`, trim, bỏ học hàm khi tạo matching key nhưng giữ display name;
- tên tạm (`Ngoại ngữ 4`, `Khoa CNTT`) không gửi đi matching external;
- nhiều room dạng `(105,107,109)-B` giữ display string và `roomAliases` nếu cần.

## 6. Notes và weeks

Parser tuần phải trả `weeks: number[]`, không giữ range string làm logic chính.

| Pattern | Kết quả |
| --- | --- |
| `Học tuần 11-15` | `[11..15]` |
| `Học từ tuần 14` | `[14..teachingWeeks]` |
| `Học tuần 4,7,10,14,15` | explicit list |
| `Học 1 ca/10 tuần` | candidate + warning, cần rule source/round |
| date range `2/3 - 19/4` | quy đổi theo `Term.week1`, timezone, cần test |
| `Học tiết 9-12` | period override 9..12 |
| không ghi tuần | default `[1..teachingWeeks]`, warning, `weekOrigin=parser-default` |
| pattern tuần khớp nhưng số ngoài `1..teachingWeeks` hoặc đảo ngược (`Học tuần 11-20`, `15-11`) | error `INVALID_DAY_OR_PERIOD`, không default |
| TH từ tuần 2 khi merge registration | `[2..teachingWeeks]` theo approved rule, chỉ khi tuần TKB của session đó cũng là default; tuần explicit của TKB thắng (Q-010) |

Không được suy luận tuần 10 từ “thi đợt 1” nếu không có config/fixture evidence; rule UET được lưu trong adapter và phải test. Nếu nhiều pattern mâu thuẫn, trả error `AMBIGUOUS_NOTE`.

## 7. Registration `.doc` local adapter

1. Kiểm tra extension nhưng quyết định parser theo magic/content (`text/html`/table), giới hạn size.
2. Tìm bảng môn/lớp và tách multi-value: `T2,T6`, `4 - 6,1 - 3`, phòng dính liền.
3. Chuẩn hóa periods; đối chiếu danh sách phòng từ TKB nếu có.
4. Loại field họ tên, ngày sinh, mã sinh viên ngay sau extraction; không ghi raw HTML vào telemetry. Adapter M1 phải trả artifact `localOnly=true`, không có `sha256`/`fileName`; mọi issue chỉ dùng row/field an toàn.
5. **M1 boundary:** the adapter only extracts schedule candidates, never mutates a `Plan`, and does not create overrides. M2's pure domain layer performs deterministic Section/Session matching, field-level `Override` creation and a separate final Plan; user confirmation and IndexedDB persistence remain deferred to M4. M1 returns schedule candidates only.
6. Match/merge must be fail-closed: if a candidate cannot be matched deterministically, keep the safe candidate and emit `REGISTRATION_OVERRIDE_UNMATCHED`; do not guess a section/session.
7. Only after a later user-confirmation flow may normalized registration data be persisted locally.

### M2 domain boundary

M2 bổ sung matching/merge thuần trong `packages/domain`: candidate registration được đối chiếu fail-closed với Section/Session đã chọn, tạo `Override` theo từng field/session, áp dụng precedence và tạo Plan `final` riêng mà `picks` là các Section đã đăng ký, không phải picks của nháp ([ADR-0009 amendment](adr/ADR-0009-m2-domain-engine-schema.md)); Section timetable gốc không bị mutate. Code trình duyệt chỉ import `@ky-nay/parser/registration` ([ADR-0008 amendment](adr/ADR-0008-m1-parser-dependencies-local-provenance.md)). Session mang `weekOrigin` (`explicit`, `parser-default`, `registration-default`) để phân biệt tuần nguồn với default. Candidate unmatched/ambiguous chỉ tạo warning, không tự đoán. Đây chưa phải user-confirmation flow, IndexedDB persistence, browser file-picker/network evidence hay export của M3/M4.

## 8. Validation và error taxonomy

- `MISSING_REQUIRED_COLUMN`
- `NO_VALID_SECTION_ROWS`
- `INVALID_SECTION_ID`
- `INVALID_DAY_OR_PERIOD`
- `CONFLICTING_NORMALIZED_FIELDS`
- `AMBIGUOUS_NOTE`
- `SCHEMA_VERSION_UNSUPPORTED`
- `HASH_OR_PROVENANCE_MISSING`
- `INPUT_TOO_LARGE`
- `UNSUPPORTED_INPUT`
- `MALFORMED_INPUT`
- `AMBIGUOUS_HEADER`

### Warnings — cần review/hiển thị

- `UNKNOWN_COLUMN`
- `UNPARSED_NOTE`
- `DEFAULT_WEEKS_APPLIED`
- `GROUP_MISSING`
- `ROOM_CAMPUS_UNKNOWN`
- `LECTURER_ALIAS_UNMATCHED`
- `DUPLICATE_SESSION_COLLAPSED`
- `REGISTRATION_OVERRIDE_UNMATCHED`
- `NON_FIXED_TIME`
- `CREDITS_MISSING`
- `PERIOD_OVERRIDE_APPLIED`
- `ONLINE_SECTION_EXCLUDED` (Q-009)

- `ImportArtifact` của nguồn timetable/non-PII được phép phải có SHA-256 hợp lệ; registration local-only phải có `sourceType=registration`, `localOnly=true`, id không định danh và bỏ trống `sha256`/`fileName`.
- M1 local result chứng minh candidate extraction; M2 local result thêm pure matching/override behavior. Browser network interception, user confirmation, persistence and export remain M3/M4 evidence and không được suy ra từ fixture package tests.

## 9. Dedup/grouping

- Group theo canonical `sectionId`.
- Dedup session khi day/start/end/kind/group/room/weeks/campus giống nhau; giữ `sourceRows[]`.
- Không dedup chỉ vì cùng Mã LHP nếu kind/group/day khác.
- Row lặp do nhiều lớp khóa được biểu diễn bằng `homeClasses[]`, không nhân Section.
- Nếu cùng session normalized nhưng raw khác, giữ provenance và warning để reviewer quyết định.

## 10. LLM fallback (không thuộc critical path)

Chỉ gọi ở admin pipeline khi deterministic parser không xử lý được:

- input là chuỗi header/note đã loại PII;
- output JSON schema nhỏ (`columnMapping`, `weeks`, `periodOverride`, `confidence`);
- validator kiểm tra day/period/week/range và whitelist enum;
- admin xem raw-vs-proposed, approve/reject;
- cache theo hash chuỗi + parser rule version; có budget/circuit breaker;
- approved result được chuyển thành rule deterministic, không gọi lại cho mọi user.

Không gửi file registration, mã sinh viên, họ tên, ngày sinh hoặc raw document lên model.

## 11. Fixtures và acceptance threshold

| Fixture family | Cases tối thiểu |
| --- | --- |
| UET XLSX HK I 2026–27 | header row 1, 17 cột, ca có khoảng trắng, T7, code alias |
| UET XLSX HK II chính thức | header row 4, 18 cột, 151 merged ranges, PCGD, 10-week class |
| UET PDF dự kiến | repeated header/page, 17 cột, khác session INT2213 |
| Registration HTML `.doc` | 7 lớp, multi-day/multi-period, 3 room overrides, PII fields |
| Exam PDF | merged lecturer/room cells, predicted vs official dates |
| Study plan | cohort-specific week 1, typo dates after week 1 |
| Synthetic adversarial | unknown header, duplicate row, ambiguous note, invalid period |

Mỗi fixture có expected summary (counts, hashes nếu là input timetable synthetic/non-PII được phép, issue codes), không commit raw PII. Fixture registration local-only không hash input. Release không publish nếu fixture bắt buộc có error hoặc count drift ngoài threshold được reviewer chấp thuận.

## 12. Change workflow

Định dạng trường đổi → thêm fixture/reproducer → cập nhật synonym/adapter → chạy golden/property tests → review diff/provenance → publish version mới. Không sửa output bằng tay mà không ghi manual correction và source.
