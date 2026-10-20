# Implementation plan — docs-first đến MVP UET

> **Status:** draft — Q-001..Q-008 đã approve 20/10/2026; milestone M0–M5 chờ Product sign-off G0
> **Owner:** Tech Lead + Release Manager
> **Last reviewed:** 2026-10-20
> **Related docs:** [PRD](PRD.md), [QA plan](QA_TEST_PLAN.md), [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md)

## 1. Nguyên tắc lập kế hoạch

- Làm vertical slice có giá trị sớm: load dataset → search → select → conflict → view → export.
- Parser và domain engine là critical path; UI đẹp, Premium, LLM và tích hợp ngoài không được chen trước.
- Mọi phase có gate và evidence. Không dùng “đã viết code” làm tiêu chí hoàn thành.
- Dữ liệu thật chỉ nằm trong vùng được phê duyệt; CI dùng fixture redacted/synthetic.
- Nếu scope phải cắt, cắt theo thứ tự ở mục 7, không cắt privacy, validation hoặc regression tests.

## 2. Timeline và release gates

Mốc mục tiêu kinh doanh là cửa sổ trường công bố TKB HK II 2026–2027 **09–15/11/2026**. Ngày release kỹ thuật cụ thể chỉ chốt sau khi có thông báo trường và capacity đội.

| Milestone | Kết quả | Dependency | Exit gate |
| --- | --- | --- | --- |
| M0. Foundation & decisions | repo/monorepo shell, ADR stack/backend chốt, CI lint+typecheck, threat/data-flow G1 review, fixture policy + synthetic fixture đầu tiên | Q-001..Q-008 ở §10 có decision | **G0+G1**: scope/ADR/contract/threat evidence |
| M1. Parser & fixtures UET | canonical schema validator, `uet-xlsx` adapter (header row 1/4, merged cells, synonyms), `vnu-registration-html` adapter local-only, notes→weeks/period-override, error/warning taxonomy, fixture manifest redacted/synthetic | M0; sample file được phê duyệt/redact | **G1+G3a**: fixture manifest + golden/validation evidence; registration adapter: no-network evidence (phần G3b) |
| M2. Domain engine | search index (không dấu, alias), Section/Session/Plan, conflict `day × period × weeks`, week1/date `Asia/Ho_Chi_Minh`, registration merge + override precedence, tín chỉ | M1 canonical model frozen | **G2+G3a**: golden conflict matrix 100%, unit/property evidence |
| M3. Core UI & export | onboarding school/term/cohort/week1, course/section picker + conflict explanation, day list + week grid responsive 360/768/1200, Plan local (IndexedDB), export ICS/PNG/Word (`.doc` HTML) + browser print CSS A4 ngang, provenance/version display, offline view | M2 + artifact manifest contract | **G2+G3a/G3c**: accessibility + viewport + ICS import evidence |
| M4. Registration merge UI | file picker `.doc`, local preview không PII, user confirm, merge vào Plan, nhãn “phòng/giờ đã đổi”, unmatched-warning flow | M1 registration adapter + M3 Plan | **G2+G3a/G3b**: AC-04/AC-05, network-interception evidence không PII |
| M5. Admin ingest, publish, hardening, launch | admin upload/quarantine → validate → diff → review → publish/rollback; two-person first publish; CDN artifact + catalog; perf/PWA/security/observability; staged release + rollback drill | M1–M4 | **G4b** drill + **G3a/G3b/G3c** green → **G4a** → **G5** |

Thứ tự phụ thuộc cứng: M0 → M1 → M2 → M3 → M4 → M5. Trong từng milestone, spec/sketch song song được nhưng contract chỉ freeze sau G1 của milestone đó. M5 có thể khởi động thiết kế admin song song với M3 nhưng không publish trước khi M1–M4 qua gate tương ứng.

**M1 checkpoint (20/10/2026):** parser/fixture implementation và local evidence đã có; `npm run check` xanh với 28 tests và 5/5 fixture entries, dependency audit không có production vulnerability. Trạng thái là `ready-for-verification`, chưa phải `g1-approved`, `qa-pass`, `security-pass`, `review-pass`, dataset publish hoặc release. Remote CI, approved real-UET validation và browser network evidence còn pending. Registration adapter hiện dừng ở candidate extraction; matching/override/persistence thuộc M2/M4.

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

## 10. Quyết định blocking trước khi code (M0) — đã chốt 20/10/2026

Tất cả 8 quyết định đã được Product Owner approve. Chi tiết sửa đổi đã lan vào các docs tương ứng; bảng dưới là record của decision.

| ID | Câu hỏi | Decision (đã approve) | Người chốt | Docs/ADR phản ánh |
| --- | --- | --- | --- | --- |
| Q-001 | Ngày week 1 fixture | **Approved**: lấy từ `Term.starts[]` theo cohort, user override được; fixture HK II = **15/02/2027**, HK I = 07/09/2026 (K67–K70), 12/10/2026 (K71) | Product | [PRD §4 #2](PRD.md), [ADR-0006](adr/ADR-0006-default-th-weeks.md) chỉ cover TH-week; week1 config ở DOMAIN_MODEL §7 |
| Q-002 | Export P0 | **Cắt PDF generator**; thay bằng “In / Lưu PDF” + print CSS A4 ngang. **Giữ Word dạng `.doc` HTML-based** (không phải DOCX generator). Nếu trễ: cắt DOCX trước ICS/PNG | Product | [PRD §4 #11](PRD.md), [TECH_STACK export](TECH_STACK.md), [QA §5](QA_TEST_PLAN.md) |
| Q-003 | Backend | **Static artifact + CLI admin** cho mùa đầu; share P1 = URL-encoded section IDs trong fragment; Supabase deferred | Product + Tech Lead | [ADR-0007](adr/ADR-0007-static-artifact-cli-admin.md), [API_CONTRACTS §1](API_AND_DATA_CONTRACTS.md) |
| Q-004 | Admin ingest boundary | **Local pipeline + push artifact**; không upload raw source trong MVP | Product + Security | [ADR-0007](adr/ADR-0007-static-artifact-cli-admin.md), [RUNBOOK §3](DATA_INGESTION_RUNBOOK.md) |
| Q-005 | Plan slots | Data model hỗ trợ **N `Plan`** (`planKind: draft|final`); UI P0 = **1 nháp + 1 chính thức** (chính thức từ file đăng ký, **không ghi đè nháp**); nhiều nháp là P1 | Product | [PRD §4 #7](PRD.md), [DOMAIN_MODEL Plan](DOMAIN_MODEL.md) |
| Q-006 | Fixture policy | Synthetic + mỗi quirk có 1 synthetic row; `test:real` script ngoài repo assert counts (1.025 / 1.009 section; exam 182/192, 506/523); registration file xóa PII trước khi lưu | Data Ops + Security | [QA §3](QA_TEST_PLAN.md), [PARSER §11](PARSER_SPEC.md) |
| Q-007 | Browser matrix | **Tier 1** = Chrome Android, Safari iOS (2 bản gần nhất), Chrome/Edge desktop; **Tier 2** = Firefox desktop, Samsung Internet, in-app browser FB/Messenger/Zalo; detect in-app → nudge “Mở bằng trình duyệt” | Product + Tester | [PRD §8](PRD.md), [QA §5](QA_TEST_PLAN.md) |
| Q-008 | Analytics | Không GA/tracker; **aggregate counter cookieless** (no user ID, no IP), privacy notice + nút tắt; per-user chỉ khi opt-in; legal review trước khi bật | Product + Security | [PRD §9](PRD.md), [SECURITY §7](SECURITY_PRIVACY.md) |

### Mâu thuẫn/gap đã ghi nhận — trạng thái sau decisions

| # | Vấn đề | Trạng thái |
| --- | --- | --- |
| C-01 | Week-1 example PRD lệch term | **Resolved** — Q-001 approve; PRD §4 #2 đã sửa |
| C-02 | FR-08 không có threshold tín chỉ | **Open** — cần Product thêm config `creditWarning` hoặc giảm AC thành chỉ tổng tín chỉ; chưa blocking G0 |
| C-03 | TH default week rule chưa có ADR | **Resolved** — [ADR-0006](adr/ADR-0006-default-th-weeks.md) |
| C-04 | DayNo=8 (CN) chưa có fixture test | **Resolved in M1 local tests** — `uet-xlsx` covers CN parsing; real-source coverage remains pending |
| C-05 | Plan cũ không map owner/exit | **Resolved** — §2 M0–M5 |
| C-06 | QA hardcode “1.025 sections” | **Resolved** — QA §4 đã nói manifest là authority; `test:real` asserts counts ngoài repo |
| C-07 | Admin endpoints phụ thuộc backend | **Resolved** — ADR-0007 static+CLI; API_CONTRACTS đánh dấu `post-MVP` |
| C-08 | Onboarding cohort vs ngày | **Open** — cần Frontend spec ở M3 vẽ 2 path |
| C-09 | Format registration file thật chưa confirm | **Open** — M1 phải có sample `.doc` redacted trước khi freeze adapter contract |
| C-10 | Thứ tự ưu tiên export | **Resolved** — Q-002: cut order PDF→DOCX; giữ ICS+PNG |

## 11. Traceability update sau decisions (đã thực hiện)

1. PRD §4 #2 (week1 HK II), #7 (2 slot), #11 (export `.doc` HTML + print CSS), §5 journey, §8 browser matrix, §9 analytics — **đã sửa**.
2. DOMAIN_MODEL `Plan.planKind`, §7 default TH/week1 config — **đã sửa**.
3. TECH_STACK backend/export rows + ADR index — **đã sửa**.
4. API_CONTRACTS §1 MVP scope + §4 post-MVP marking + share URL fragment — **đã sửa**.
5. QA_TEST_PLAN §3 fixture policy + §4 authority note + §5 browser matrix — **đã sửa**.
6. SECURITY_PRIVACY §7 analytics/share — **đã sửa**.
7. docs/README §“Quyết định cần chốt” — D-003/D-005/D-006/D-007 → closed; thêm D-009/D-010/D-011.
8. ADR-0006 (TH default weeks), ADR-0007 (static artifact + CLI admin) — **đã tạo**.

**Re-open G0 note:** quyết định Q-001/Q-002/Q-005/Q-007/Q-008 thay đổi requirement và AC — theo [Agent workflow §6](../.claude/AGENT_WORKFLOW.md), các spec/AC liên quan cần re-review trước khi vào implementation. Mỗi milestone M1–M5 sẽ lặp lại G0+G1 riêng cho contract/spec của nó.
