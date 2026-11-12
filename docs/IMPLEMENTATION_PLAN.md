# Implementation plan — MVP UET

> **Status:** active — kế hoạch và quyết định; trạng thái hiện tại ở [docs/README.md › Trạng thái hiện tại](README.md#trạng-thái-hiện-tại)  
> **Owner:** Tech Lead + Release Manager  
> **Last reviewed:** 2026-11-12  
> **Related docs:** [PRD](PRD.md), [QA plan](QA_TEST_PLAN.md), [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md), [Operations](OPERATIONS.md), [Lịch sử milestone](evidence/HISTORY.md)

## 1. Nguyên tắc lập kế hoạch

- Parser và domain engine là critical path; UI đẹp, Premium, LLM và tích hợp ngoài không chen trước.
- Mọi milestone có gate và evidence; "đã viết code" không phải tiêu chí hoàn thành.
- Dữ liệu thật chỉ nằm trong vùng được phê duyệt; CI dùng fixture redacted/synthetic.
- Nếu phải cắt scope, cắt theo §4, không cắt privacy, validation hay regression test.
- Kế hoạch không chứa đoạn tiến độ/checkpoint: trạng thái ở README, lịch sử ở [HISTORY](evidence/HISTORY.md) (CLAUDE.md §4.7).

## 2. Milestone và release gate

Mốc kinh doanh là cửa sổ trường công bố TKB HK II 2026–2027 (dự kiến 09–15/11/2026); ngày release kỹ thuật do Owner chốt.

| Milestone | Kết quả | Exit gate | Đã đạt |
| --- | --- | --- | --- |
| M0 Foundation & decisions | monorepo, ADR stack/backend, CI lint+typecheck, threat/data-flow, fixture policy | G0+G1 | merge `main`; G0/G1 chưa ký chính thức |
| M1 Parser & fixtures UET | `uet-xlsx` (header theo tên, ô gộp, đồng nghĩa), `vnu-registration-html` local-only, ghi chú tuần/tiết, taxonomy lỗi | G1+G3a | merge `main` |
| M2 Domain engine | search không dấu, Section/Session/Plan, conflict `thứ × tiết × tuần`, week 1, merge đăng ký, tín chỉ | G2+G3a | merge `main` (audit 25/10 mở lại G3) |
| M3 Core UI & export | onboarding, chọn lớp + giải thích trùng, lưới tuần/ngày 360/768/1200, Plan IndexedDB, export ICS/PNG/Word + in A4, provenance, offline; CLI publish dữ liệu (ADR-0012) | G2+G3a/G3c | Owner ký 06/11; G4b drill pass |
| M4 Registration merge UI | chọn file `.doc` cục bộ, xem trước không PII, 2 slot Plan, nhãn override | G2+G3a/G3b | Owner ký 06/11 |
| M5 Admin ingest, hardening, launch | publish/rollback qua CLI, hardening (build info, báo lỗi không egress, lazy chunk, bundle budget, icon PWA, CI audit/secret scan), runbook release | G3a/G3b/G3c → **G4a**, **G4b**, **G5** | G0–G3 Owner ký 12/11; G4a/G4b/G5 chưa chạy |

Thứ tự phụ thuộc cứng M0 → M5. Gate canonical và người duyệt: [QA plan §7](QA_TEST_PLAN.md#7-canonical-release-gates-và-crosswalk), [Agent workflow](../.claude/AGENT_WORKFLOW.md).

**Fallback:** nếu không kịp cửa sổ tháng 11/2026, giữ bản beta không công khai và nhắm kỳ phụ 31/05–06/06/2027 hoặc năm học 2027–2028 (05–11/07/2027). Không public bằng dataset chưa review chỉ để giữ ngày.

## 3. Traceability

| PRD | Spec/domain | Implementer | Test/evidence | Canonical gate |
| --- | --- | --- | --- | --- |
| FR-01 dataset/version | artifact contract | Data + Platform | schema/version tests | G1 → G3a → G4b |
| FR-02 search | domain/search spec | Coder | unit/property/UI | G1 → G2 → G3a |
| FR-03/04 select/conflict | domain model | Coder | golden conflict matrix | G1 → G2 → G3a |
| FR-05 note override | parser spec | Data Parser | fixture/golden | G1 → G2 → G3a |
| FR-06 không giờ cố định; `ONL` (Q-009) | parser + domain/UI | Data Parser + Frontend | parser test + unit/visual | G1 → G2 → G3a/G3c |
| FR-07 responsive views | UX spec | Frontend | a11y/viewport | G2 → G3a/G3c |
| FR-08 credits | PRD/domain | Coder | unit/UI | G2 → G3a |
| FR-09/10 registration | parser + privacy | Data/Frontend | network/security/import | G1 → G2 → G3a/G3b |
| FR-11 export | export contract | Frontend | snapshots/calendar import | G2 → G3a/G3c |
| FR-12 admin ingest | runbook/CLI | Platform/Release | drill/rollback | G1 → G3a/G3b → G4b |

## 4. Cut line khi trễ

Giữ bắt buộc: parser UET deterministic, search/select, conflict theo tuần, week 1, day view, merge ĐKMH cục bộ, ICS/PNG, provenance, privacy/security, regression tests.

Cắt hoặc hoãn theo thứ tự: (1) Word/PDF export (giữ ICS/PNG); (2) nhiều Plan nâng cao/share link; (3) admin UI đẹp (dùng CLI nhưng vẫn audit/validation); (4) P1 study-plan PDF/custom frame; (5) lịch thi/push/GPA/nhóm/dhqg.xyz; (6) AI/Premium/nhiều trường.

Không cắt local-only, no-password, validation, ghi nguồn dữ liệu, rollback hay accessibility smoke.

## 5. Ownership

Tech Lead: architecture/ADR/dependency gate. Product Spec: requirement/AC/priority. Data Parser: fixture/parser/chất lượng dữ liệu. Coder/Frontend: implementation theo contract. Tester: test strategy/evidence. Security Reviewer: privacy/threat/dependency gate. Release Manager: publish, deploy, rollback, handoff. Mỗi milestone đi qua G0/G1 → G2 → G3a/G3b/G3c → G4a/G4b → G5 ([Agent workflow](../.claude/AGENT_WORKFLOW.md)).

## 6. Rủi ro lịch

| Trigger | Hành động trong 24h |
| --- | --- |
| TKB đổi định dạng / chưa có fixture | dừng claim coverage, tạo fixture contract + sample thủ công ([ADR-0011](adr/ADR-0011-timetable-format-variability.md)) |
| Parser golden fail | không publish; so diff raw/normalized, giữ bản cũ |
| PII leak test fail | chặn release, xóa log nếu cần, chạy incident protocol |
| Mốc trường thay đổi | cập nhật README/checklist, không đoán lịch mở đăng ký |

## 7. Quyết định đã chốt

| ID | Quyết định | Phản ánh ở |
| --- | --- | --- |
| Q-001 (20/10) | Week 1 lấy từ `Term.starts[]` theo khóa, người dùng sửa được; fixture HK II = 15/02/2027, HK I = 07/09/2026 (K67–K70), 12/10/2026 (K71) | [PRD §4 #2](PRD.md), [DOMAIN_MODEL §7](DOMAIN_MODEL.md) |
| Q-002 (20/10) | Không PDF generator; "In / Lưu PDF" bằng print CSS A4 ngang; giữ Word `.doc` dạng HTML; cắt Word trước ICS/PNG | [PRD §4 #11](PRD.md), [TECH_STACK](TECH_STACK.md) |
| Q-003 (20/10) | Static artifact + CLI admin; share P1 = section ID trong URL fragment; Supabase hoãn | [ADR-0007](adr/ADR-0007-static-artifact-cli-admin.md) |
| Q-004 (20/10) | Pipeline cục bộ + đẩy artifact; không upload file nguồn trong MVP | [ADR-0007](adr/ADR-0007-static-artifact-cli-admin.md), [Runbook §3](DATA_INGESTION_RUNBOOK.md) |
| Q-005 (20/10) | Model hỗ trợ N Plan; UI P0 = 1 nháp + 1 chính thức (từ file đăng ký, không ghi đè nháp) | [PRD §4 #7](PRD.md), [DOMAIN_MODEL](DOMAIN_MODEL.md) |
| Q-006 (20/10) | Fixture synthetic; `test:real` chạy ngoài repo; file đăng ký xóa PII trước khi lưu | [QA §3](QA_TEST_PLAN.md), [PARSER §11](PARSER_SPEC.md) |
| Q-007 (20/10) | Browser Tier 1: Chrome Android, Safari iOS, Chrome/Edge desktop; Tier 2: Firefox, Samsung Internet, in-app browser (có nhắc "Mở bằng trình duyệt") | [PRD §8](PRD.md), [QA §5](QA_TEST_PLAN.md) |
| Q-008 (20/10) | Analytics chỉ counter tổng hợp cookieless, có privacy notice + nút tắt, legal review trước khi bật — **release đầu thu hẹp thành không telemetry (Q-014)** | [PRD §9](PRD.md), [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md) |
| Q-009 (25/10) | Lớp `ONL`: có trong app, tính tín chỉ, không lên lưới tuần, không tính trùng (`fixedTime=false`) | [PRD FR-06/08](PRD.md), [PARSER_SPEC §5](PARSER_SPEC.md) |
| Q-010 (25/10) | Tuần mặc định của TH khi merge ĐKMH không ghi đè tuần tường minh của TKB | [ADR-0006](adr/ADR-0006-default-th-weeks.md), [DOMAIN_MODEL §7](DOMAIN_MODEL.md) |
| Q-011 (29/10) | Cửa sổ tháng 11 là beta không công khai; public chờ M4+M5 và G3/G4 — **cập nhật bởi Q-014** | README D-008 |
| Q-012 (30/10) | Ghi chú TKB chỉ là thông tin, trừ pattern tuần/tiết rõ ràng; dòng không giờ → buổi không giờ cố định | [ADR-0011](adr/ADR-0011-timetable-format-variability.md), [PARSER_SPEC §5–§6](PARSER_SPEC.md) |
| Q-013 (31/10) | `Ca 1 - 2` = ca 1 và 2 (tiết 1–6), chỉ chữ `Tiết` mới là tiết; số lớp đổi theo phiên bản TKB; hosting Cloudflare Pages; chỉ bắt buộc cột cần thiết, cột khác là thông tin thêm | [ADR-0011](adr/ADR-0011-timetable-format-variability.md), [OPERATIONS §1](OPERATIONS.md) |
| D-M3-1/2 (06/11) | Onboarding: chọn khóa hoặc nhập ngày Thứ Hai tuần 1; ngưỡng tín chỉ là cấu hình tùy chọn `metadata.creditPolicy` | [PRD](PRD.md), [DOMAIN_MODEL](DOMAIN_MODEL.md) |
| Q-014 (10/11) | D-M5-1 làm M5 trước khi có TKB HK II, thử bằng HK I trên preview, ngày public Owner quyết sau; D-M5-2 release đầu không runtime telemetry; D-M5-3 một người vận hành với ngoại lệ `RA-M5-001` | [SPEC-M5-001 §4](evidence/M5-SPEC.md), [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md) |
| M5 (11–12/11) | Link báo lỗi = Google Form của Owner, commit trong repo; domain production `xeptkb-63v.pages.dev`; tag đầu `v0.1.0`; theo dõi 72 h sau G4a; ngưỡng bundle đã duyệt | [SPEC-M5-001 §4](evidence/M5-SPEC.md), [Operations](OPERATIONS.md) |
