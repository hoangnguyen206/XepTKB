# Canonical domain model

> **Status:** draft / proposed  
> **Owner:** Data Parser + Tech Lead  
> **Last reviewed:** 2026-10-20
> **Related docs:** [Parser spec](PARSER_SPEC.md), [PRD](PRD.md), [API contracts](API_AND_DATA_CONTRACTS.md)
> **Schema implementation:** `0.2.0` on M2 branch; see [ADR-0009](adr/ADR-0009-m2-domain-engine-schema.md) and [M2 design handoff](evidence/M2-DESIGN-HANDOFF.md)

## 1. Quy tắc nền

- `period` (tiết) là đơn vị thời gian chuẩn; `shift`/Ca chỉ là input alias.
- Mọi session có `weeks` explicit hoặc được resolve thành explicit default trước khi conflict.
- `Section` là lớp học phần người dùng chọn; một Section có thể có nhiều Session.
- `Course` là môn học, không phải lớp cụ thể.
- Raw value giữ để trace/debug; normalized value mới dùng trong domain engine.
- Không suy luận ngầm khi dữ liệu không đủ: dùng `unknown`/warning và yêu cầu review.

## 2. TypeScript contract

```ts
type SchoolCode = string;          // canonical: "uet"
type TermId = string;              // e.g. "2026-2027-h2"
type DatasetVersion = string;
type Period = number;              // 1..12 in UET fixture
type WeekNo = number;              // 1..N
type DayNo = 2 | 3 | 4 | 5 | 6 | 7 | 8; // T2..CN

type SourceRef = {
  artifactId: string;
  sourceType: "timetable" | "registration" | "exam" | "study-plan" | "manual";
  sourceVersion?: string;
  sourceRow?: number;
  sourcePage?: number;
  rawHash?: string;
};

type TimeFrame = {
  id: string;
  school: SchoolCode;
  periods: { no: Period; start: string; end: string }[];
  shifts: { name: string; periods: Period[] }[];
  timezone: "Asia/Ho_Chi_Minh";
};

type School = {
  code: SchoolCode;
  name: string;
  frames: TimeFrame[];
  defaultFrame: string;
  campuses: { code: string; name: string; roomPattern?: string }[];
};

type Course = {
  code: string;
  altCodes: string[];
  name: string;
  normalizedName: string;
  credits?: number;                 // absent means unknown, never zero by default
  school: SchoolCode;
};

type WeekOrigin = "explicit" | "parser-default" | "registration-default";

type SessionBase = {
  id: string;
  frame: string;
  weeks: WeekNo[];
  weekOrigin?: WeekOrigin;
  kind: "LT" | "TH" | "BT" | "ONL" | "OTHER";
  group?: string;                   // "CL", "1", "2"
  room?: string;
  campus?: string;
  lecturers: string[];
  rawNote?: string;
  source: SourceRef;
  confidence: "deterministic" | "reviewed-fallback" | "manual";
};

type FixedSession = SessionBase & {
  fixedTime?: true;                 // omitted is accepted for the legacy 0.1.0 shape
  day: DayNo;
  startPeriod: Period;
  endPeriod: Period;
};

type NonFixedSession = SessionBase & {
  fixedTime: false;
  day?: DayNo;
};

type Session = FixedSession | NonFixedSession;

type Section = {
  id: string;                     // normalized e.g. "INT2213 1"
  courseCode: string;
  homeClasses: string[];
  capacity?: number;
  examRound?: 1 | 2;
  online: boolean;
  sessions: Session[];
  source: SourceRef;
  datasetVersion: DatasetVersion;
  warnings: string[];
};

type Term = {
  id: TermId;
  school: SchoolCode;
  name: string;
  teachingWeeks: number;          // UET default 15
  starts: { cohorts: string[]; week1: string }[];
  timezone: "Asia/Ho_Chi_Minh";
};

type DomainCatalog = {
  courses: readonly Course[];
  sections: readonly Section[];
  datasetVersion?: DatasetVersion;
  timeFrames?: readonly TimeFrame[]; // optional runtime frame definitions for override validation
};

type PlanPick = { sectionId: string; group?: string };

type Override = {
  target: { sectionId: string; sessionId: string };
  field: "room" | "campus" | "day" | "periods" | "weeks" | "lecturer";
  from?: unknown;
  to: unknown;
  source: "registration" | "user" | "admin-correction";
  reason?: string;
};

type Plan = {
  id: string;
  term: TermId;
  datasetVersion: DatasetVersion;
  name: string;                    // "Phương án A"
  planKind: "draft" | "final";   // P0 UI: tối đa 1 draft + 1 final; model hỗ trợ N
  picks: PlanPick[];
  final: boolean;                  // mirror của planKind === "final"
  cohort?: string;
  week1?: string;
  overrides: Override[];
  createdAt: string;
  updatedAt: string;
};

type Exam = {
  id: string;
  sectionId?: string;
  courseCode: string;
  date: string;
  startTime: string;
  endTime?: string;
  room?: string;
  campus?: string;
  mode?: string;
  round?: 1 | 2;
  status: "expected" | "official" | "user";
  source: SourceRef;
};

type ImportArtifact = {
  id: string;
  sourceType: SourceRef["sourceType"];
  fileName?: string;                // approved non-PII metadata only; omit for local registration
  sha256?: string;                  // required for approved non-PII artifacts; omit for local registration
  localOnly?: boolean;              // only registration input may set true
  parserVersion: string;
  schemaVersion: string;
  status: "candidate" | "hold" | "validated" | "published" | "rejected" | "retracted";
  importedAt: string;
  reviewedAt?: string;
  errors: string[];
  warnings: string[];
};
```

- Registration artifact: `sourceType="registration"` bắt buộc `localOnly=true`; id phải không định danh; không giữ `sha256`, `fileName`, raw HTML hoặc identity fields.
- Timetable/artifact công khai không được dùng `localOnly`; provenance hash chỉ áp dụng cho source non-PII đã được phép.
- `Section.id` canonical hóa uppercase, bỏ dấu sao/khoảng trắng thừa; collision phải được report.
- `courseCode` normalized bỏ whitespace/dấu sao, uppercase, đồng thời giữ `altCodes` để search.
- `1 <= startPeriod <= endPeriod <= maxPeriod` của `TimeFrame`.
- `day` chỉ nhận 2–8; thứ 7 được hỗ trợ ở MVP, Chủ nhật mở rộng bằng config.
- `weeks` sorted, unique, trong `1..term.teachingWeeks` hoặc gắn `isReserveWeek` ở model mở rộng; không dùng range string trong engine.
- `ONL`/không có fixed time không tạo cell grid; vẫn hiện trong list và tín chỉ.
- Section có nhiều nhóm phải không cho user chọn hai group incompatible cho cùng requirement.
- `Course.credits` không âm; thiếu credits là warning, không bịa `0` nếu ảnh hưởng tổng.
- Mọi normalized field liên quan lịch phải có `SourceRef`.

## 4. UET time frame baseline

| Ca | Periods |
| --- | --- |
| 1 | 1–3 |
| 2 | 4–6 |
| 3 | 7–9 |
| 4 | 10–12 |

Khung giờ UET fixture: 07:00–09:40, 09:50–12:30, 13:30–16:10, 16:20–19:00; từng tiết 50 phút, nghỉ 5 phút giữa tiết. Cấu hình phải là data, không hard-code trong conflict engine.

## 5. Override precedence

Từ thấp đến cao:

1. TKB version cũ.
2. TKB version mới đã publish.
3. Registration result local (phòng/giờ mới hơn được nêu rõ).
4. Admin correction có provenance.
5. User override/buổi bù.

Precedence chỉ áp dụng field và session tương ứng, không thay toàn bộ Section mù. Nếu registration không match được Section/session, không tự merge; đưa warning để user xác nhận.

## 6. Conflict algorithm

Hai session conflict khi:

```text
same day
AND periods overlap: max(startA,startB) <= min(endA,endB)
AND weeks intersection is non-empty
AND both have fixed time
```

Conflict result phải chứa `leftSection`, `rightSection`, `days`, `periodIntersection`, `weekIntersection`, `reasonCode`. Không conflict nếu chỉ trùng thứ/tiết nhưng tuần tách biệt. Có thể tạo warning `campus-transition` khi hai session liền/overlap ngày học nhưng campus khác; đây không thay thế hard conflict.

## 7. Week/date

- `week1` lấy từ `Term.starts[]` theo cohort; user có thể override nếu chưa có study plan. Config thuộc `Term`, không hardcode.
- `dateFor(week, day) = week1 + (week - 1) * 7 + (day - 2)` ngày.
- Timezone là `Asia/Ho_Chi_Minh`; ICS phải có `VTIMEZONE` hoặc UTC conversion đúng.
- Default TKB không ghi tuần là `[1..term.teachingWeeks]`.
- **TH default weeks**: khi merge registration, session `kind=TH` không có weeks explicit được default `[2..term.teachingWeeks]` (ADR-0006); rule này **không** áp cho TKB ingest thường trừ khi adapter config nói rõ.
- Tuần dự phòng/buổi bù là user/admin record riêng, không sửa raw dataset.

## 8. Search và display

Search index lưu normalized code/name/aliases. Bỏ dấu tiếng Việt và normalize whitespace; kết quả vẫn hiển thị tên gốc. Không dùng raw lecturer name để gọi external service từ client.

## 9. Migration và compatibility

Mọi thay đổi type có `schemaVersion`. Migration phải:

1. đọc version cũ từ IndexedDB;
2. transform deterministic;
3. validate invariants;
4. backup/export hoặc discard theo consent nếu migrate fail;
5. không gửi dữ liệu local lên server để migrate.
