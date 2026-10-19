# Implementation plan — docs-first đến MVP UET

> **Status:** draft  
> **Owner:** Tech Lead + Release Manager  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [PRD](PRD.md), [QA plan](QA_TEST_PLAN.md), [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md)

## 1. Nguyên tắc lập kế hoạch

- Làm vertical slice có giá trị sớm: load dataset → search → select → conflict → view → export.
- Parser và domain engine là critical path; UI đẹp, Premium, LLM và tích hợp ngoài không được chen trước.
- Mọi phase có gate và evidence. Không dùng “đã viết code” làm tiêu chí hoàn thành.
- Dữ liệu thật chỉ nằm trong vùng được phê duyệt; CI dùng fixture redacted/synthetic.
- Nếu scope phải cắt, cắt theo thứ tự ở mục 7, không cắt privacy, validation hoặc regression tests.

## 2. Timeline và release gates

Mốc mục tiêu kinh doanh là cửa sổ trường công bố TKB HK II 2026–2027 **09–15/11/2026**. Ngày release kỹ thuật cụ thể chỉ chốt sau khi có thông báo trường và capacity đội.

| Phase | Kết quả | Dependency | Exit gate |
| --- | --- | --- | --- |
| 0. Foundation | repo/app shell, docs, CI, privacy baseline | docs approved | **G0+G1**: scope/ADR/contract/threat evidence |
| 1. Parser fixtures | canonical schema, UET fixture harness, deterministic parser | sample files/redaction | **G1+G3a**: fixture manifest + golden/validation evidence |
| 2. Domain engine | search/index, merge, conflict, week/date, provenance | canonical model | **G2+G3a**: unit/property evidence |
| 3. Core UI | onboarding, course/section picker, day/grid, Plan | domain engine + artifact manifest | **G2+G3a/G3c**: mobile/desktop accessibility evidence |
| 4. Import/export | local `.doc`, override, PNG/DOCX/ICS | parser/domain/UI | **G2+G3a/G3b**: no-PII network + export evidence |
| 5. Admin/data ops | upload, quarantine, diff, review, publish, rollback | backend/artifact contract | **G4b** drill + two-admin first-publish approval |
| 6. Hardening | perf, PWA/offline, security, observability | all P0 | **G3a/G3b/G3c** release candidate green, no blocker |
| 7. Launch | staged release + feedback loop | hardening | **G4a/G4b/G5**: release decision, rollback rehearsal, owner on-call |

### Fallback

Nếu không kịp cửa sổ tháng 11/2026, giữ core cho beta nội bộ và nhắm kỳ phụ 31/05–06/06/2027 hoặc năm học 2027–2028 05–11/07/2027. Không phát hành public bằng dataset chưa review chỉ để giữ ngày.

## 3. Workstreams

### WS-A — Product/spec

- khóa PRD P0 và acceptance criteria;
- tạo specs nhỏ theo vertical slice;
- duy trì traceability và open decisions.

### WS-B — Data/parser

- catalog source, redaction, fixture manifest;
- canonicalization, note/week parsing, validation và provenance;
- parser report/diff cho admin.

### WS-C — Domain/runtime

- `Section`, `Session`, `Plan`, `Term`, search index;
- conflict/merge/date functions deterministic, timezone explicit.

### WS-D — Frontend/PWA

- mobile-first flow, grid/day, local persistence, accessibility, export UI/offline.

### WS-E — Platform/admin

- static artifact/CDN, admin review queue, auth/RBAC, versioning, rollback;
- external proxy chỉ sau khi có contract và privacy review.

### WS-F — Quality/security/ops

- test matrix, threat model, CI gates, monitoring, incident/ingestion drills.

## 4. Trình tự vertical slice

1. Dữ liệu sample đã redacted → artifact manifest.
2. Load một term/version từ JSON → validate schema.
3. Search `INT2213`/tên không dấu → list Section.
4. Select Section/group → build Plan.
5. Conflict `day × period × weeks` → explain reason.
6. Day view mobile + grid desktop → offline reload.
7. Export ICS/PNG → import/visual check.
8. Chèn registration fixture → local parse/override → export lại.
9. Admin publish second version → diff, update, rollback.

Mỗi bước phải có test evidence trước khi bước tiếp theo coi là ready.

## 5. Traceability matrix

| PRD | Spec/domain | Implementer | Test/evidence | Canonical gate |
| --- | --- | --- | --- | --- |
| FR-01 dataset/version | artifact contract | Data + Platform | schema/version tests | G1 → G3a → G4b |
| FR-02 search | domain/search spec | Coder | unit/property/UI | G1 → G2 → G3a |
| FR-03/04 select/conflict | domain model | Coder | golden conflict matrix | G1 → G2 → G3a |
| FR-05 note override | parser spec | Data Parser | fixture/golden | G1 → G2 → G3a |
| FR-06 online/no fixed | domain/UI | Coder/Frontend | unit/visual | G2 → G3a/G3c |
| FR-07 responsive views | UX spec | Frontend | a11y/viewport | G2 → G3a/G3c |
| FR-08 credits | PRD/domain | Coder | unit/UI | G2 → G3a |
| FR-09/10 registration | parser + privacy | Data/Frontend | network/security/import | G1 → G2 → G3a/G3b |
| FR-11 export | export contract | Frontend | snapshots/calendar import | G2 → G3a/G3c |
| FR-12 admin ingest | runbook/API | Platform/Release | drill/rollback | G1 → G3a/G3b → G4b |

Gate names/entry/exit/approver dùng duy nhất theo [QA crosswalk](QA_TEST_PLAN.md#7-canonical-release-gates-và-crosswalk) và [Agent workflow](../.claude/AGENT_WORKFLOW.md).

## 6. Definition of Ready / Done theo phase

### Ready

- task có ID, scope/non-goals, acceptance criteria, input/output contract;
- fixture hoặc dữ liệu synthetic xác định;
- dependency và privacy impact được ghi;
- role owner/reviewer được chỉ định.

### Done

- implementation/spec, tests và docs đã link;
- evidence lưu theo handoff template;
- no known blocker hoặc có risk owner/date;
- reviewer/security/tester đã sign-off theo severity;
- release manager xác nhận rollback/observability nếu production-facing.

## 7. Cut line khi trễ

Giữ bắt buộc: parser UET deterministic, search/select, conflict tuần, week 1, day view, local registration merge, ICS/PNG, provenance, privacy/security, regression tests.

Cắt hoặc hoãn theo thứ tự:

1. Word/PDF export (giữ ICS/PNG).
2. Nhiều Plan nâng cao/share link.
3. Admin UI đẹp (dùng CLI/manual runbook nhưng vẫn audit/validation).
4. P1 study-plan PDF/custom frame.
5. Lịch thi/push/GPA/nhóm/dhqg.xyz.
6. Mọi AI/Premium/multi-school.

Không cắt local-only, no-password, validation, source attribution, rollback hay accessibility smoke.

## 8. Ownership và nhịp làm việc

- Tech Lead: architecture/ADR/dependency gate.
- Product Spec: requirement/acceptance/priority.
- Data Parser: fixture/parser/data quality.
- Coder/Frontend: implementation theo contract.
- Tester: test strategy/evidence/release recommendation.
- Security Reviewer: privacy/threat/dependency gate.
- Release Manager: artifact publish, deploy, rollback, handoff.

Mỗi milestone có: planning checkpoint (G0/G1), implementation checkpoint (G2), independent verification (G3a/G3b/G3c), release decision (G4a/G4b) và post-release closeout (G5). Chi tiết ở [`.claude/AGENT_WORKFLOW.md`](../.claude/AGENT_WORKFLOW.md).

## 9. Rủi ro lịch

| Trigger | Hành động trong 24h |
| --- | --- |
| TKB format chưa có fixture | dừng claim coverage, tạo fixture contract + manual sample |
| Parser golden fail | không publish; so diff raw/normalized, rollback bản cũ |
| PII leak test fail | block release, rotate/clear logs nếu cần, security incident protocol |
| Backend/vendor chưa chốt | giữ local/static path, không chờ integration ngoài |
| Mốc trường thay đổi | cập nhật roadmap/launch checklist, không suy đoán lịch mở đăng ký |
