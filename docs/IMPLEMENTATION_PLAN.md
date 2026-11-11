# Implementation plan — docs-first đến MVP UET

> **Status:** draft — Q-001..Q-008 đã approve 20/10/2026; M3 và M4 đã được Owner approve G0+G1+G3; M5 đã xong G2 và G3a/G3b/G3c (local, `5f735fc`), chờ Owner ký G0/G1/G3 và chạy `G4a/G4b/G5`
> **Owner:** Tech Lead + Release Manager
> **Last reviewed:** 2026-11-11
> **Related docs:** [PRD](PRD.md), [QA plan](QA_TEST_PLAN.md), [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md), [Audit M0–M2](evidence/M0-M2-AUDIT-2026-10-25.md)

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
| M5. Admin ingest, publish, hardening, launch | admin upload/quarantine → validate → diff → review → publish/rollback (CLI, [ADR-0012](adr/ADR-0012-dataset-publish-pipeline.md)); two-person first publish (tạm thời một người + ngoại lệ ghi audit `RA-M5-001`, D-M5-3); CDN artifact + catalog; perf/PWA/security; observability **không telemetry** (D-M5-2, [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md)); staged release = preview → link beta → production (chưa có staging) + rollback drill. Chi tiết: [SPEC-M5-001](evidence/M5-SPEC.md) | M1–M4 | **G4b** drill + **G3a/G3b/G3c** green → **G4a** → **G5** |

Thứ tự phụ thuộc cứng: M0 → M1 → M2 → M3 → M4 → M5. Trong từng milestone, spec/sketch song song được nhưng contract chỉ freeze sau G1 của milestone đó. M5 có thể khởi động thiết kế admin song song với M3 nhưng không publish trước khi M1–M4 qua gate tương ứng.

**M1 checkpoint (20/10/2026):** parser/fixture implementation và local evidence đã có; `npm run check` xanh với 28 tests và 5/5 fixture entries, dependency audit không có production vulnerability. Trạng thái là `ready-for-verification`, chưa phải `g1-approved`, `qa-pass`, `security-pass`, `review-pass`, dataset publish hoặc release. Remote CI, approved real-UET validation và browser network evidence còn pending. Registration adapter hiện dừng ở candidate extraction; matching/override/persistence thuộc M2/M4.

**M2 checkpoint (20/10/2026):** pure domain engine implementation và local evidence với schema `0.2.0`; `npm run lint`, `npm run typecheck`, `npm test` (54/54) và `npm run fixtures:run` (5/5) đã pass ở local. M2 bao phủ search/alias, Plan/group, conflict theo tuần, week1/date, registration field-level merge và credits; JSONL/UET parser regression được giữ. M3 UI/PWA/IndexedDB/export chưa làm.

**M0–M2 checkpoint (25/10/2026):** M0+M1 commit `22bf934`, M2 commit `61ee300` + `7faccaf`, merge vào `main` local tại `aba04b0` (chưa push `origin/main` tại thời điểm này; lần chạy GitHub Actions đầu tiên là trên `4681c63` sau khi push — xem M3 checkpoint). `npm run check` chạy lại tại `aba04b0` vẫn xanh (54/54, 5/5) và `npm audit --omit=dev` = 0. G1 của M0/M1/M2 **chưa được approve** (design handoff/ADR vẫn ghi pending hoặc `g1-blocked`). Các báo cáo G3a/G3b/G3c của M2 (`4057589`) do agent role tự soạn, không độc lập, và đã được **reopen** bởi [audit M0–M2](evidence/M0-M2-AUDIT-2026-10-25.md): 2 finding đề xuất S1 ở luồng registration → Plan chính thức, thiếu coverage P0 FR-06 ở parser, chưa có golden conflict matrix/property test theo exit gate M2. Trạng thái M1/M2: `g2-ready-for-verification`, không phải `verified`; M3 có thể bắt đầu G0/G1 song song nhưng phải sửa các finding audit trước khi G3 chạy lại. Fix round 1–3 cùng ngày (commit `e41a806`, `4681c63`; đã push `origin/main` 25/10/2026) đã sửa AUD-001, AUD-004…009 và AUD-016, áp quyết định Q-009 (`ONL` không giờ cố định, vẫn tính tín chỉ) và Q-010 (tuần TKB thắng default TH), kèm ADR-0006/0008/0009 amendment; `npm run check` 70/70 + 5/5. Còn mở: AUD-002 (chờ C-09), golden matrix/property test, kết quả CI trên GitHub chưa xác minh, gate độc lập và các S3.

**M3 checkpoint (25/10/2026):** đã implement theo [SPEC-M3-001](evidence/M3-SPEC.md) + [ADR-0010](adr/ADR-0010-m3-web-app-artifact-storage-export.md): web app `apps/web` (React + Vite; loader artifact có kiểm tra SHA-256/schema/domain, onboarding theo khóa hoặc ngày, tìm/chọn lớp + giải thích conflict, lưới tuần/theo ngày, Plan lưu IndexedDB có migration, offline qua service worker, xuất ICS/PNG/Word + in A4 ngang, provenance), package `packages/export`, dataset mẫu tổng hợp qua adapter `uet-xlsx`. Code **chưa commit** (working tree trên `4681c63`). Local: `npm run check` xanh (node 78/78, Vitest 39/39, fixtures 5/5), `npm run test:e2e` 14/14. Ba agent role kiểm tra độc lập: G3a `qa-no-go`, G3b `security-pass-with-exception`, G3c `review-no-go` — 1 S1 (dataset mới đổi nhóm làm lớp đã chọn rơi khỏi kiểm tra trùng lịch/lưới/file xuất trong khi app báo "không trùng"), 6 S2, 14 S3; sổ tổng hợp ở [EVID-M3-001](evidence/M3-EVIDENCE-ENVELOPE.md). G0/G1 của M3 chưa có actor/date. Owner sẽ tự sửa; M3 chưa qua G3 nên chưa được sang G4. M4 chưa bắt đầu.

**CI checkpoint (29/10/2026):** lần chạy GitHub Actions đầu tiên ([run 40123890415](https://github.com/hoangnguyen206/XepTKB/actions/runs/40123890415), `main` @ `4681c63`, 25/10) **fail** ở bước test: Node 20.20.2 không mở rộng glob trong `node --test` (`Could not find '.../packages/*/dist/test/*.test.js'`); lint và typecheck pass. Change set M3 đã commit `82cb85b` trên nhánh `m3-web-app`, mở draft PR #1; CI trên PR ([run 40907344256](https://github.com/hoangnguyen206/XepTKB/actions/runs/40907344256), Node 22.23.4, ubuntu-24.04) **xanh**: job `check` (lint, typecheck, node:test 78/78, Vitest 39/39, fixtures 5/5) và job `e2e` (Playwright 14/14). `main` vẫn đỏ cho tới khi merge PR #1, việc này phải chờ M3 qua G3.

**M5-lite checkpoint (01/11/2026, cập nhật G4b drill 06/11/2026, cho beta Q-011):** quy trình nạp/publish theo [ADR-0012](adr/ADR-0012-dataset-publish-pipeline.md): CLI `npm run dataset -- import|validate|publish|retract|restore|status|check`, dữ liệu ở `data/published` deploy cùng site; preview hiện `candidate`, production chỉ `published`; `dataset check` + `published.test.ts` trong CI. **Đã hoàn tất G4b drill ngày 06/11/2026 ([DRILL-M3-G4b-001](evidence/M3-G4b-DRILL-REPORT.md)):** chạy trọn vòng `test:real → import (v1 TKB HK I thật, 1077 lớp) → preview Chromium check → validate → publish → production Chromium check → import/publish v2 (diff) → retract v2 & v1 → restore v1 → re-publish v1 → dataset check` trên `main` @ `4915a86` (tổng 16,77s, các lệnh CLI 75–835 ms/bước). Còn lại: nạp TKB HK II 2026–2027 thật khi trường công bố (09–15/11/2026).

**M3 G3 R2 + R2.1 checkpoint (05–06/11/2026):** chạy lại độc lập G3a/G3b/G3c trên commit cố định `2ab03cd` (CI GitHub [run 42069057252](https://github.com/hoangnguyen206/XepTKB/actions/runs/42069057252) xanh), sau đó sửa 2 lỗi S2 (`db0058c`) + cụm S3 (`d51c65b`) và chạy kiểm chứng hẹp **G3 R2.1 tại `d51c65bc10f91ed7cd23462bdef901f5a81d5acc`** (`npm run check` exit 0: node:test 101/101, Vitest 60/60, fixtures 6/6, `dataset check` OK; `npm run test:e2e` Playwright Chromium 17/17 + WebKit `REV-M3-002` 3/3):
- **G3a R2 → R2.1 ([TEST-M3-002](evidence/M3-G3a-QA-REPORT-R2.md)):** nâng từ `qa-pass-with-follow-up` (`2ab03cd`) lên **`qa-pass` (`d51c65b`)** — đã đóng S1 (`QA-M3-001 = REV-M3-001`), mọi S2 cũ của web app (#2–#7, #22) và toàn bộ 5 S3 mới (`QA-M3-101`…`105`).
- **G3b R2 → R2.1 ([SEC-REVIEW-M3-002](evidence/M3-G3b-SECURITY-REVIEW-R2.md)):** **`security-pass-with-exception`** tại `d51c65b`, **đã gỡ bỏ `security-no-go` trên G4b dữ liệu thật** sau khi xác nhận `SEC-M3-102` (S2), `SEC-M3-103` (`AUD-010`), `SEC-M3-104`, `SEC-M3-001`, `SEC-M3-006a` là `verified-fixed`, và gói exception S3 thu hẹp (`EXC-SEC-M3-R2-B/C/D`) đã được Owner (Release Manager) phê duyệt lúc `2026-11-06T05:50Z` trước hạn **08/11/2026**.
- **G3c R2 → R2.1 ([REVIEW-M3-002](evidence/M3-G3c-INDEPENDENT-REVIEW-R2.md), đã kết hợp G3a/G3b R2.1):** nâng từ `review-no-go` (`2ab03cd`) lên **`review-approved` (`d51c65b`)** — đã xác nhận cả 2 lỗi S2 (`REV-M3-101`, `REV-M3-102`), toàn bộ các S3 (`REV-M3-104`…`107`, `REV-M3-008`) và G0/G1 sign-off của Owner (`REV-M3-103`, `2026-11-06T05:50Z`) đều `verified-fixed`. Chi tiết tổng hợp tại [EVID-M3-001](evidence/M3-EVIDENCE-ENVELOPE.md). Đã merge PR #1 vào `main` (`3c34c89`).

**M4 checkpoint (06/11/2026):** đã triển khai trên nhánh `m4-registration-ui` theo [SPEC-M4-001](evidence/M4-SPEC.md), [ADR-0013](adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) và [DESIGN-M4-001](evidence/M4-DESIGN-HANDOFF.md): chọn file Kết quả ĐKMH (`.doc` HTML / `.htm` / `.html`) xử lý cục bộ trên trình duyệt (`@ky-nay/parser/registration`), xem trước không PII, xác nhận tạo/cập nhật slot `Phương án chính thức` (`final`) tách biệt với `Phương án nháp` (`draft`), áp dụng `plan.overrides` trong `resolvePlanPicks` & `findOverrideTargetSession`, hiển thị huy hiệu `Đã đổi phòng`/`Đã đổi giờ`/`Đã đổi tuần` kèm `from → to` trên lưới tuần, lịch theo ngày, tóm tắt phương án, bản in, `.png`, `.ics`, `.doc`. Kiểm định độc lập **G3a/G3b/G3c** (`R1` tại `12abdbd` + `R1.1` tại `6fd1506`; `npm run check` exit `0` với node `102/102`, Vitest `68/68`, fixtures `6/6`; `npm run test:e2e` Playwright Chromium `19/19`) đạt:
- **G3a ([TEST-M4-001](evidence/M4-G3a-QA-REPORT.md)):** **`qa-pass`** (`0` S0/S1/S2/S3 mở).
- **G3b ([SEC-REVIEW-M4-001](evidence/M4-G3b-SECURITY-REVIEW.md)):** **`security-approved`** (`0` S0/S1/S2/S3 còn mở ở mức code/CI cho cả M3 và M4 sau khi đóng `SEC-M4-001` cùng các mục S3 kế thừa từ M3 `EXC-SEC-M3-R2-B` / `SEC-M3-101(e)`, `EXC-SEC-M3-R2-D` / `SEC-M3-005` và `SEC-M3-003(b/d)` tại `c2e93b9`; chỉ còn bước vận hành `SEC-M3-007` kiểm `curl -I` khi gắn domain production thật ở `G4a`).
- **G3c ([REVIEW-M4-001](evidence/M4-G3c-INDEPENDENT-REVIEW.md)):** **`review-approved`** (`0` S0/S1/S2/S3 mở sau khi đóng cả 5/5 finding `REV-M4-001..004` + `SEC-M4-001`). Chi tiết tổng hợp tại [EVID-M4-001](evidence/M4-EVIDENCE-ENVELOPE.md); đã được Owner ký duyệt `G0`, `G1` và `G3` lúc `2026-11-06T07:30Z` và hợp nhất vào `main` ([PR #2](https://github.com/hoangnguyen206/XepTKB/pull/2) @ `bac83bf`, cập nhật `c2e93b9`).

**M5 checkpoint (10–11/11/2026):** trên nhánh `m5-release-hardening` (tách từ `main` @ `0e849f1`) theo [SPEC-M5-001](evidence/M5-SPEC.md), [DESIGN-M5-001](evidence/M5-DESIGN-HANDOFF.md) và [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md) (cả ba `draft`/`proposed`, **chờ Owner ký G0/G1**): hiện phiên bản/commit, báo sai dữ liệu không gửi mạng, trang Giới thiệu & quyền riêng tư, cảnh báo dữ liệu hết hạn/cũ khi offline, error boundary chỉ khôi phục cục bộ, tách lazy chunk nhập ĐKMH (initial JS gzip `140,140 B` → `108,920 B`) + bundle budget trong CI, icon PNG cho PWA, `npm audit` + secret scan + sửa base immutability trong CI, script `smoke-deploy`, runbook release/rollback, CHANGELOG, checklist G4a/G4b/G5 và hướng dẫn Owner thử bằng TKB HK I trên preview. G2 local tại `5f735fc`: `npm run check` exit `0` (node `142/142`, Vitest `105/105`, fixtures `6/6`), `verify:bundle` OK, `test:e2e` `25/25`. G3 độc lập trên `5f735fc` ([EVID-M5-001](evidence/M5-EVIDENCE-ENVELOPE.md)): G3a `qa-pass` (đính chính trích dẫn R1.1 theo `F-M5-002`), G3b `security-pass-with-exception` (`RA-M5-001`), G3c `review-pass-with-follow-up` (`REV-M5-001`, docs sync). M4 được tái kiểm định trên code thật vì `F-M5-001` (bằng chứng G3 của M4 trích dẫn định danh không có trong code). Chưa có: Owner sign-off, dataset HK II thật (trường chưa công bố), deploy production.

### Fallback

Nếu không kịp cửa sổ tháng 11/2026, giữ core cho beta nội bộ và nhắm kỳ phụ 31/05–06/06/2027 hoặc năm học 2027–2028 05–11/07/2027. **Đã chọn (Q-011, 29/10/2026):** cửa sổ tháng 11/2026 là beta nội bộ chỉ với M3, không public. **Cập nhật bởi Q-014 / D-M5-1 (10/11/2026):** M4 đã merge nên beta có thể gồm cả nhập kết quả ĐKMH; ngày public do Owner quyết sau G3 của M5 và khi có dataset HK II đã review. Không phát hành public bằng dataset chưa review chỉ để giữ ngày.

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
| FR-06 no fixed time; `ONL` non-fixed (Q-009) | parser + domain/UI | Data Parser + Coder/Frontend | parser test + unit/visual | G1 → G2 → G3a/G3c |
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
| Q-005 | Plan slots | Data model hỗ trợ **N `Plan`** (`planKind: draft\|final`); UI P0 = **1 nháp + 1 chính thức** (chính thức từ file đăng ký, **không ghi đè nháp**); nhiều nháp là P1 | Product | [PRD §4 #7](PRD.md), [DOMAIN_MODEL Plan](DOMAIN_MODEL.md) |
| Q-006 | Fixture policy | Synthetic + mỗi quirk có 1 synthetic row; `test:real` script ngoài repo assert counts (1.025 / 1.009 section; exam 182/192, 506/523); registration file xóa PII trước khi lưu | Data Ops + Security | [QA §3](QA_TEST_PLAN.md), [PARSER §11](PARSER_SPEC.md) |
| Q-007 | Browser matrix | **Tier 1** = Chrome Android, Safari iOS (2 bản gần nhất), Chrome/Edge desktop; **Tier 2** = Firefox desktop, Samsung Internet, in-app browser FB/Messenger/Zalo; detect in-app → nudge “Mở bằng trình duyệt” | Product + Tester | [PRD §8](PRD.md), [QA §5](QA_TEST_PLAN.md) |
| Q-008 | Analytics | Không GA/tracker; **aggregate counter cookieless** (no user ID, no IP), privacy notice + nút tắt; per-user chỉ khi opt-in; legal review trước khi bật | Product + Security | [PRD §9](PRD.md), [SECURITY §7](SECURITY_PRIVACY.md); release đầu thu hẹp thành **không telemetry** theo Q-014 / D-M5-2 ([ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md)) |

### Quyết định bổ sung — 25/10/2026

| ID | Câu hỏi | Decision | Người chốt | Docs/ADR phản ánh |
| --- | --- | --- | --- | --- |
| Q-009 | Lớp ghi `ONL` hiển thị thế nào? | **Có trong app, tính tín chỉ, không hiện trên TKB tuần.** Lớp `ONL` học tự do theo từng giảng viên: parser `uet-xlsx` và adapter registration luôn tạo session `fixedTime=false` (warning `NON_FIXED_TIME`), bỏ qua thứ/tiết nếu nguồn có ghi; môn vẫn tìm, chọn, merge đăng ký và cộng tín chỉ được, không chiếm ô grid, không tính conflict | Product (owner) | [PRD §4 #4, FR-06, FR-08](PRD.md), [PARSER_SPEC §5](PARSER_SPEC.md), [DOMAIN_MODEL §3](DOMAIN_MODEL.md) |
| Q-010 | Default TH `[2..teachingWeeks]` khi merge registration có ghi đè tuần explicit của TKB không? | **Không — TKB thắng.** Default TH chỉ áp khi tuần của session TKB cũng là default (`weekOrigin=parser-default`) | Product (owner) | [ADR-0006 amendment](adr/ADR-0006-default-th-weeks.md), [ADR-0009 amendment](adr/ADR-0009-m2-domain-engine-schema.md), [DOMAIN_MODEL §7](DOMAIN_MODEL.md) |
| Q-013 (31/10/2026) | Các câu hỏi mở sau khi đọc TKB thật | Owner trả lời: (1) `Ca 1 - 2` = ca 1 và ca 2 (tiết 1–6); chỉ khi ghi chữ `Tiết` mới là tiết → quy tắc chắc chắn, bỏ warning `SHIFT_RANGE_INTERPRETED`. (2) TKB còn điều chỉnh tới khi đăng ký học hoàn tất → số lớp đổi theo phiên bản, không có con số cố định; mỗi phiên bản có số liệu riêng trong manifest, và luồng "dữ liệu có phiên bản mới" (AC-M3-12) là luồng thường xuyên. (3) Hosting = Cloudflare Pages (D-004). (4) Không có số cột cố định: chỉ bắt buộc cột cần thiết; cột khác có thì xem xét và đưa thành thông tin thêm cho sinh viên, không có thì thôi ([ADR-0011 §8](adr/ADR-0011-timetable-format-variability.md)) | Product (owner) | [ADR-0011](adr/ADR-0011-timetable-format-variability.md), [OPERATIONS §1](OPERATIONS.md), [PARSER_SPEC §4–§5](PARSER_SPEC.md), [QA plan](QA_TEST_PLAN.md) |
| Q-012 (30/10/2026) | Cột "Ghi chú" của TKB dùng thế nào? Dòng không có giờ (đồ án, Học Online) xử lý ra sao? | **Ghi chú chỉ là thông tin cho sinh viên** (owner): chỉ pattern tuần/tiết rõ ràng mới đổi buổi học; mọi nội dung khác giữ ở `rawNote`, hiển thị trên thẻ lớp/danh sách ngày, không sinh warning. **Dòng không giờ** trong file không có cột loại buổi → buổi không giờ cố định (`OTHER`, hoặc `ONL` khi phòng ghi online), không chiếm lưới, vẫn tính tín chỉ (đề xuất của agent theo dữ liệu thật, owner duyệt hướng chung) | Product (owner) | [ADR-0011](adr/ADR-0011-timetable-format-variability.md), [ADR-0009 amendment (15)](adr/ADR-0009-m2-domain-engine-schema.md), [PARSER_SPEC §5–§6](PARSER_SPEC.md) |
| Q-011 (29/10/2026) | Làm gì trong cửa sổ TKB HK II 09–15/11/2026 khi M4/M5 chưa có? | **Beta nội bộ, không public.** Khi trường công bố TKB HK II: nạp và Data Reviewer duyệt dataset thật, cho một nhóm nhỏ dùng tính năng M3 (tìm/chọn lớp, kiểm tra trùng, lịch tuần, xuất file) qua link không công khai, ghi rõ là bản thử. Không có nhập file đăng ký (M4). Public release vẫn chờ M4 + M5 và G3/G4 theo §2; fallback public giữ mốc 31/05–06/06/2027 nếu M4/M5 trễ. Điều kiện trước khi mời người dùng beta: M3 chạy lại G3 không còn S1, S2 #3–6 đã sửa hoặc có owner/mitigation/expiry được Release Manager chấp thuận, dataset thật có provenance và được review, có hosting với header bảo mật (SEC-M3-007) | Product (owner) | §2 Fallback, [docs/README D-008](README.md), [EVID-M3-001](evidence/M3-EVIDENCE-ENVELOPE.md) |

### Quyết định M5 — 10/11/2026

| ID | Câu hỏi | Decision | Người chốt | Docs/ADR phản ánh |
| --- | --- | --- | --- | --- |
| Q-014 (10/11/2026) | Làm M5 thế nào khi TKB HK II chưa có, ai duyệt dữ liệu, giám sát ra sao? | Owner trả lời trong chat: **D-M5-1** làm M5 ngay, Owner tự thử bằng file TKB HK I thật trên nhánh preview, không deploy production/publish trong vòng này, ngày public quyết sau (cập nhật Q-011); **D-M5-2** release đầu **không runtime telemetry** (thu hẹp Q-008, counter là P1 sau legal review); **D-M5-3** một người vận hành, lần publish đầu dùng `--accept-single-reviewer` có ghi audit, rủi ro `RA-M5-001` hết hạn trước G4a public đầu tiên hoặc 31/01/2027 | Product (owner) | [SPEC-M5-001 §4](evidence/M5-SPEC.md), [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md) (`proposed`), [PRD §9/§11](PRD.md), [Operations §1/§5/§6](OPERATIONS.md) — chờ Owner ký G0/G1 M5 |

### Mâu thuẫn/gap đã ghi nhận — trạng thái sau decisions

| # | Vấn đề | Trạng thái |
| --- | --- | --- |
| C-01 | Week-1 example PRD lệch term | **Resolved** — Q-001 approve; PRD §4 #2 đã sửa |
| C-02 | FR-08 không có threshold tín chỉ | **Resolved (D-M3-2 approved by Product on 06/11/2026)** — ngưỡng là cấu hình tùy chọn `metadata.creditPolicy { minCredits?, maxCredits? }`; không có cấu hình thì chỉ hiện tổng tín chỉ (dataset mẫu không có cấu hình) |
| C-03 | TH default week rule chưa có ADR | **Resolved** — [ADR-0006](adr/ADR-0006-default-th-weeks.md) |
| C-04 | DayNo=8 (CN) chưa có fixture test | **Resolved in M1 local tests** — `uet-xlsx` covers CN parsing; real-source coverage remains pending |
| C-05 | Plan cũ không map owner/exit | **Resolved** — §2 M0–M5 |
| C-06 | QA hardcode “1.025 sections” | **Resolved** — QA §4 đã nói manifest là authority; `test:real` asserts counts ngoài repo |
| C-07 | Admin endpoints phụ thuộc backend | **Resolved** — ADR-0007 static+CLI; API_CONTRACTS đánh dấu `post-MVP` |
| C-08 | Onboarding cohort vs ngày | **Resolved (D-M3-1 approved by Product on 06/11/2026)** — onboarding có 2 đường: chọn khóa (week1 từ `Term.starts[]`) hoặc tự nhập ngày Thứ Hai của tuần 1 |
| C-10 | TKB thật đổi bộ cột theo kỳ; adapter `uet-xlsx@0.1.0` đọc TKB HK I 2026–27 thật ra 0 lớp | **Resolved (G1 + G3 R2.1 approved 06/11/2026)** — một adapter + import profile + dấu vân tay định dạng ([ADR-0011](adr/ADR-0011-timetable-format-variability.md)); file thật: 1077 lớp, 1467 buổi, 0 lỗi, độ phủ đủ (`npm run test:real`). `Ca 1 - 2` = ca 1–2 đã được owner xác nhận (Q-013). Còn mở: chưa có file thật định dạng 17 cột (chỉ ảnh chụp; bản tổng hợp cùng bố cục nằm trong test) |
| C-09 | Format registration file thật chưa confirm | **Resolved (pending Data Reviewer verification), 29/10/2026** — owner cung cấp 1 file thật HK I 2026–27 (giữ ngoài repo); fixture markup thật đã thay toàn bộ giá trị ở `fixtures/redacted-registration/`; adapter `0.1.0` đọc file thật ra 0 lớp, `0.2.0` ghép theo vị trí; xem [REVIEW-C09-001](evidence/C09-REGISTRATION-SAMPLE-REVIEW.md). Còn mở: chỉ 1 mẫu (chưa thấy dòng học lại/hủy/ONL/3 thứ) |
| C-11 (trước đây trùng mã C-10) | Thứ tự ưu tiên export | **Resolved** — Q-002: cut order PDF→DOCX; giữ ICS+PNG |

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
