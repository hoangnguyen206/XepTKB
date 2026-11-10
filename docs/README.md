# Documentation index

> **Status:** draft / docs-first  
> **Owner:** Product + Tech Lead  
> **Last reviewed:** 2026-11-10
> **Related docs:** [root CLAUDE.md](../CLAUDE.md)

## Mục đích

Mọi tài liệu sản phẩm hiện là `draft`/`proposed`; các gate G0–G5 chưa được phê duyệt đầy đủ ở cấp toàn sản phẩm (M5 còn lại). M1 parser và M2 domain engine đã được commit và push lên `main` với local evidence, nhưng chưa phải bằng chứng publish/release; xem [audit M0–M2](evidence/M0-M2-AUDIT-2026-10-25.md) cho các finding còn mở. M3 (web app + CLI publish pipeline ADR-0012) đã merge vào `main` (`3c34c89`) và hoàn tất **G4b drill (`DRILL-M3-G4b-001`)** ngày 06/11/2026; xem [EVID-M3-001](evidence/M3-EVIDENCE-ENVELOPE.md). M4 (registration merge UI + 2-slot Plans + override badges, [ADR-0013](adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md)) đã hoàn tất G0/G1/G2, kiểm định độc lập **G3a/G3b/G3c (`R1` `12abdbd` + `R1.1` `6fd1506`)**, được **Owner (Product / Tech Lead / Security / Release Manager) phê duyệt G0, G1 và G3 lúc `2026-11-06T07:30Z`** với G3a **`qa-pass`**, G3b **`security-approved`** (`0` finding code/CI mở cho cả M3 và M4), G3c **`review-approved`**, và đã merge vào `main` (`bac83bf` → `c2e93b9`); xem [EVID-M4-001](evidence/M4-EVIDENCE-ENVELOPE.md). M5 (release hardening) đang ở nhánh `m5-release-hardening`: spec/design/ADR-0014 và tài liệu vận hành là `draft`/`proposed`, **G0/G1 chờ Owner duyệt**, chưa có G2/G3/G4/G5; xem [M5 evidence hiện tại](#m5-evidence-hiện-tại). Không được coi bộ docs này là bằng chứng deploy production/release công khai hoàn chỉnh.

Đây là bản đồ tài liệu source of truth cho Kỳ Này. Bản brief `Kế hoạch sản phẩm – Tool xếp TKB cho sinh viên VNU.md` là nguồn nghiên cứu ban đầu; khi brief và tài liệu dự án khác nhau, phải mở decision/ADR hoặc hỏi Product/Tech Lead, không tự chọn theo trí nhớ.

## Cây tài liệu

| Tài liệu | Dùng cho | Owner role | Trạng thái |
| --- | --- | --- | --- |
| [PRD](PRD.md) | scope, user journey, requirements, acceptance criteria | Product Spec | Draft |
| [Implementation plan](IMPLEMENTATION_PLAN.md) | phase, dependency, gates, traceability | Tech Lead | Draft |
| [Roadmap](ROADMAP.md) | phạm vi sau MVP và điều kiện mở | Product | Draft |
| [Tech stack](TECH_STACK.md) | công nghệ, boundary, lựa chọn và spike | Tech Lead | Proposed |
| [Architecture](ARCHITECTURE.md) | luồng hệ thống, trust boundary, failure modes | Tech Lead | Proposed |
| [Domain model](DOMAIN_MODEL.md) | model chuẩn và invariant | Data Parser + Tech Lead | Draft |
| [Parser spec](PARSER_SPEC.md) | ingest, normalization, validation, fixtures | Data Parser | Draft |
| [API/data contracts](API_AND_DATA_CONTRACTS.md) | artifact và backend contract tối thiểu | Tech Lead | Proposed |
| [Security & privacy](SECURITY_PRIVACY.md) | data inventory, threat model, security gate | Security Reviewer | Draft |
| [QA test plan](QA_TEST_PLAN.md) | test matrix, release gate, evidence | Tester | Draft |
| [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md) | nạp, duyệt, publish, rollback | Release/Data Ops | Draft |
| [Operations](OPERATIONS.md) | môi trường, deploy, rollback, tag/changelog, monitoring không telemetry, incident | Release Manager | Proposed (cập nhật M5 2026-11-10, chờ G0/G1 M5) |
| [CHANGELOG](../CHANGELOG.md) | thay đổi theo version (Keep a Changelog), lịch sử milestone M0–M4 | Release Manager | Draft — chưa có release/tag |

## Đội Agent

- [Agent workflow](../.claude/AGENT_WORKFLOW.md) — lifecycle, handoff, escalation, RACI.
- [Tech Lead](../.claude/agents/tech_lead.md)
- [Product Spec](../.claude/agents/product_spec.md)
- [Coder](../.claude/agents/coder.md)
- [Data Parser](../.claude/agents/data_parser.md)
- [Data Reviewer](../.claude/agents/data_reviewer.md)
- [Frontend](../.claude/agents/frontend.md)
- [Tester](../.claude/agents/tester.md)
- [Security Reviewer](../.claude/agents/security_reviewer.md)
- [Reviewer](../.claude/agents/reviewer.md)
- [Release Manager](../.claude/agents/release_manager.md)
- Templates: [`../.claude/templates/`](../.claude/templates/)

## Cross-document invariants

Các giá trị sau phải nhất quán ở mọi tài liệu:

1. MVP chỉ phục vụ UET; TKB admin preload, file kết quả đăng ký parse local.
2. P0 gồm: versioned TKB upload, search/select lớp, conflict theo giờ + tuần, week 1 theo cohort/tự chọn, grid/day view, responsive, local registration merge, PNG/Word/.ics export.
3. Tiết là đơn vị gốc; `Section` có nhiều `Session`; `weeks` là tập tuần explicit.
4. Registration result có thể mới hơn TKB: phòng/giờ từ registration thắng, phải đánh dấu override.
5. Không upload PII, không xin mật khẩu portal, không external call trực tiếp từ browser.
6. LLM, dhqg.xyz, nhóm, Premium, multi-school, email intake và PDF scan là post-MVP/fallback, không chặn core release.
7. Dataset phải có provenance/version; không publish parser output chưa qua validation/review.
8. Gate canonical là `G0 → G1 → G2 → G3a/G3b/G3c → G4a/G4b → G5`; G3a/b/c chạy song song sau G2 nhưng đều bắt buộc trước release.
9. P0/P1/P2 là product priority; S0–S3 là defect severity. Mọi P0 committed phải có evidence; S0/S1 no-go; S2/S3 cần owner/mitigation/due/expiry.
10. Data Parser tạo candidate; Data Reviewer độc lập validate; Release Manager là accountable cho publish/rollback.
11. Mốc mục tiêu là công bố TKB HK II 2026–2027 trong tuần 09–15/11/2026; có fallback release nếu trễ.

## Quyết định cần chốt trước production

| ID | Quyết định | Trạng thái | Người chốt / điều kiện |
| --- | --- | --- | --- |
| D-001 | Tên thương hiệu cuối cùng và domain | Open (domain production = OD-M5-2, cần trước `SEC-M3-007` ở G4a) | Product, kiểm tra tên miền/nhãn hiệu |
| D-002 | Chốt React+Vite hay framework khác | Proposed | Tech Lead sau spike PWA/SSR |
| D-003 | Backend: **static artifact + CLI admin**; Supabase deferred | **Closed** (Q-003) | Tech Lead + Security 20/10/2026 |
| D-004 | Hosting/data region và vendor/legal review | **Một phần** (31/10/2026): hosting = **Cloudflare Pages** (owner), cấu hình ở [OPERATIONS §1](OPERATIONS.md); data region/legal review còn mở | Owner + tư vấn pháp lý |
| D-005 | Browser matrix Tier 1/2 + analytics cookieless aggregate | **Closed** (Q-007/Q-008); **đề xuất thu hẹp** bởi D-M5-2 / [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md) (`proposed`): release đầu không có runtime telemetry, counter → P1 sau legal review — chờ G0/G1 M5 | Product + Security 20/10/2026 |
| D-006 | Có tài khoản/sync trong release đầu không | **Closed**: không | Product 20/10/2026 |
| D-007 | Fixture policy: synthetic + `test:real` ngoài repo; registration file xóa PII trước khi lưu | **Closed** (Q-006) | Data Ops + Security 20/10/2026 |
| D-008 | Lịch phát hành cụ thể ngoài cửa sổ 09–15/11/2026 | **Một phần** (Q-011, 29/10/2026): tháng 11/2026 là beta nội bộ chỉ M3, không public; ngày public còn mở. D-M5-1 (chat 2026-11-10, chờ G0 M5) đề xuất thay câu "chỉ M3": beta có thể gồm M4, Owner thử bằng HK I trên preview, không production trong vòng M5; public launch do Owner quyết sau M5 G3 | Product theo thông báo trường |
| D-009 | Plan slots P0: 1 draft + 1 final (từ file đăng ký); nhiều nháp P1 | **Closed** (Q-005) | Product 20/10/2026 |
| D-010 | Export: `.doc` HTML + PNG + ICS + print CSS; không PDF generator | **Closed** (Q-002) | Product 20/10/2026 |
| D-011 | Week 1 fixture HK II = 15/02/2027 (HK I giữ fixture riêng) | **Closed** (Q-001) | Product 20/10/2026 |

## M0 evidence hiện tại

- [ADR-0001 — monorepo và React/Vite baseline](adr/ADR-0001-react-vite-monorepo.md) — `ready`, chờ Product/Tech Lead G1 acknowledgement.
- [ADR-0006 — default TH weeks](adr/ADR-0006-default-th-weeks.md) — decision đã ghi trong docs.
- [ADR-0007 — static artifact + CLI admin](adr/ADR-0007-static-artifact-cli-admin.md) — decision đã ghi trong docs.
- [M0 fixture policy](evidence/M0-FIXTURE-POLICY.md) — synthetic/redacted only.
- [M0 G1 threat/data-flow review](evidence/M0-G1-threat-data-flow.md) — draft, chờ Security acknowledgement.
- [M0 implementation handoff](evidence/M0-IMPLEMENTATION-HANDOFF.md) — local checks pass, independent verification pending.
- [M0 evidence envelope](evidence/M0-EVIDENCE-ENVELOPE.md) — traceability and execution record; gate approval pending.

## M1 evidence hiện tại

- [ADR-0008 — M1 parser dependencies and local registration provenance](adr/ADR-0008-m1-parser-dependencies-local-provenance.md) — ready; G1 acknowledgement pending.
- [M1 design handoff](evidence/M1-DESIGN-HANDOFF.md) — contract, dependency and privacy boundary; verification pending.
- [M1 implementation handoff](evidence/M1-IMPLEMENTATION-HANDOFF.md) — local implementation and scope handoff; independent review pending.
- [M1 test report](evidence/M1-TEST-REPORT.md) — local G3a evidence and skipped browser/real-source checks.
- [M1 security review](evidence/M1-SECURITY-REVIEW.md) — parser/privacy controls; browser G3b evidence remains pending.
- [M1 evidence envelope](evidence/M1-EVIDENCE-ENVELOPE.md) — fixture hashes, commands and gate conditions.

## M2 evidence hiện tại

- [ADR-0009 — M2 domain engine contract and schema migration](adr/ADR-0009-m2-domain-engine-schema.md) — schema `0.2.0`; G1 acknowledgement pending (chưa có actor/date).
- [M2 design handoff](evidence/M2-DESIGN-HANDOFF.md) — pure domain contract, alternatives and verification plan; decision `g1-blocked` chờ acknowledgement.
- [M2 implementation handoff](evidence/M2-IMPLEMENTATION-HANDOFF.md) — search/Plan/conflict/date/merge/credits; viết trước commit, code nằm ở `61ee300` + `7faccaf`.
- [M2 test report (draft)](evidence/M2-TEST-REPORT.md) — superseded by G3a report.
- [M2 G3a QA report](evidence/M2-G3a-QA-REPORT.md) — `qa-pass-with-follow-up` do agent role tự soạn; **reopened** bởi audit.
- [M2 G3b security review](evidence/M2-G3b-SECURITY-REVIEW.md) — `security-pass-with-exception` do agent role tự soạn; **reopened** bởi audit.
- [M2 G3c independent review](evidence/M2-G3c-INDEPENDENT-REVIEW.md) — `review-pass-with-follow-up` do agent role tự soạn; **reopened** bởi audit.
- [M2 evidence envelope v2](evidence/M2-EVIDENCE-ENVELOPE-v2.md) — tổng hợp các quyết định trên; không còn hiệu lực cho tới khi G3 chạy lại.

M2 đã merge vào `main` (`aba04b0`) và đã push cùng fix round audit (`e41a806`, `4681c63`), nhưng G1 chưa approve và G3 cần chạy lại sau khi sửa finding audit. M2 chưa bao gồm UI/PWA, IndexedDB, export, browser interception, artifact loader, backend/admin publish hoặc real-source validation. G4a/G4b (release) vẫn require M3–M5 completion.

## Audit M0–M2 (25/10/2026)

- [REVIEW-M0M2-AUDIT-001](evidence/M0-M2-AUDIT-2026-10-25.md) — `review-no-go` cho trạng thái "M2 verified": 2 finding đề xuất S1 (Plan chính thức dựng từ nháp; ghép thứ/tiết registration theo tích Descartes), thiếu coverage P0 FR-06 ở parser, 10 finding S2/process, 8 finding S3. Fix round 1–3 (cùng ngày, commit `e41a806` + `4681c63`, đã push) đã sửa AUD-001, AUD-004…009, AUD-016, áp quyết định Q-009 (lớp `ONL` không hiện trên TKB tuần nhưng vẫn tính tín chỉ) và Q-010 (tuần TKB thắng default TH), cập nhật [ADR-0006](adr/ADR-0006-default-th-weeks.md)/[ADR-0008](adr/ADR-0008-m1-parser-dependencies-local-provenance.md)/[ADR-0009](adr/ADR-0009-m2-domain-engine-schema.md); cần verify độc lập.

## M3 evidence hiện tại

- [M3 spec](evidence/M3-SPEC.md) (`SPEC-M3-001`, G0) — scope, AC-M3-01…13, quyết định D-M3-1…4 (đóng C-08, C-02); **`g0-approved`** bởi Owner (Product) lúc `2026-11-06T05:50Z`.
- [ADR-0011 — TKB đổi bộ cột theo kỳ: một adapter, import profile, dấu vân tay định dạng](adr/ADR-0011-timetable-format-variability.md) — **`g1-approved`** bởi Owner (Tech Lead, Data Reviewer) lúc `2026-11-06T05:50Z`.
- [ADR-0012 — Quy trình nạp/publish dữ liệu: CLI, `data/published` trong repo, deploy cùng site](adr/ADR-0012-dataset-publish-pipeline.md) — **`g1-approved`** bởi Owner (Tech Lead, Release Manager, Data Reviewer) lúc `2026-11-06T05:50Z`; cách dùng ở [runbook §12](DATA_INGESTION_RUNBOOK.md).
- [ADR-0010 — web app, artifact loader contract, local storage, export](adr/ADR-0010-m3-web-app-artifact-storage-export.md) và [M3 design handoff](evidence/M3-DESIGN-HANDOFF.md) (G1) — **`g1-approved`** bởi Owner (Tech Lead) lúc `2026-11-06T05:50Z`.
- [M3 implementation handoff](evidence/M3-IMPLEMENTATION-HANDOFF.md) (G2) — viết ban đầu trên `4681c63`, cập nhật qua các fix round tới target `2ab03cd` và `d51c65b` (nhánh `m3-web-app`).
- G3 lần 1 (25/10/2026, superseded bởi R2): [M3 G3a QA R1](evidence/M3-G3a-QA-REPORT.md) (`qa-no-go`), [M3 G3b security R1](evidence/M3-G3b-SECURITY-REVIEW.md) (`security-pass-with-exception`), [M3 G3c review R1](evidence/M3-G3c-INDEPENDENT-REVIEW.md) (`review-no-go`).
- **G3 lần 2 — R2 (`2ab03cd`) + R2.1 (`d51c65b`, 05–06/11/2026):** [M3 G3a QA R2](evidence/M3-G3a-QA-REPORT-R2.md) (`TEST-M3-002`, nâng từ `qa-pass-with-follow-up` lên **`qa-pass`** tại `d51c65b`: 0 S0/S1/S2/S3 mở ở phía QA); [M3 G3b security R2](evidence/M3-G3b-SECURITY-REVIEW-R2.md) (`SEC-REVIEW-M3-002`, **`security-pass-with-exception`** tại `d51c65b`, **đã gỡ bỏ `security-no-go` trên G4b dữ liệu thật** và được Owner / Release Manager phê duyệt gói exception S3 thu hẹp `EXC-SEC-M3-R2-B/C/D`); [M3 G3c review R2](evidence/M3-G3c-INDEPENDENT-REVIEW-R2.md) (`REVIEW-M3-002`, đã kết hợp G3a/G3b R2.1, nâng từ `review-no-go` lên **`review-approved`** tại `d51c65b` sau khi đóng cả 12/12 finding kỹ thuật và quy trình `REV-M3-103`).
- [M3 evidence envelope](evidence/M3-EVIDENCE-ENVELOPE.md) (`EVID-M3-001`) — **`approved`** (`2026-11-06T05:50Z`), tổng hợp lệnh/kết quả, sổ 22 finding R1 + 13 finding R2 đã gộp trùng (#1–#35).
- **[M3 G4b dataset publish & rollback drill](evidence/M3-G4b-DRILL-REPORT.md) (`DRILL-M3-G4b-001`, 06/11/2026):** **`g4b-drill-pass`** trên `main` @ `4915a86` (`import → preview check → validate → publish → production check → diff v2 → retract → restore → re-publish → check`).
- [Ảnh màn hình 360/768/1280](evidence/m3-screens/) — dữ liệu mẫu.

M3 (web app + parser ADR-0011 + CLI publish pipeline ADR-0012) đã vượt qua trọn bộ cổng **G0 + G1 + G2 + G3a/G3b/G3c** tại `d51c65b`, đã được Owner phê duyệt lúc `2026-11-06T05:50Z`, merge vào `main` (`3c34c89`) và hoàn tất diễn tập **G4b (`DRILL-M3-G4b-001`)**.

## M4 evidence hiện tại

- [M4 spec](evidence/M4-SPEC.md) (`SPEC-M4-001`, G0) — scope, `AC-M4-01…08` (`FR-09`, `FR-10`, `AC-04`, `AC-05`, `Q-005` / `D-009`, `Q-007` / `D-005`), quyết định `D-M4-1…3`; **`g0-approved`** bởi Owner (Product) lúc `2026-11-06T07:30Z`.
- [ADR-0013 — M4 registration merge UI, 2-slot Plans, and local privacy boundary](adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) và [M4 design handoff](evidence/M4-DESIGN-HANDOFF.md) (`DESIGN-M4-001`, G1) — ranh giới `@ky-nay/parser/registration`, áp dụng `plan.overrides` trong `resolvePlanPicks` & `findOverrideTargetSession`, 2 slot cố định `Phương án nháp` / `Phương án chính thức` trong IndexedDB, hiển thị huy hiệu & `from → to` trên mọi chế độ xem/xuất; **`g1-approved`** bởi Owner (Tech Lead + Security) lúc `2026-11-06T07:30Z`.
- [M4 implementation handoff](evidence/M4-IMPLEMENTATION-HANDOFF.md) (`IMPL-M4-001`, G2) — triển khai trên nhánh `m4-registration-ui` (`12abdbd` → `6fd1506`); `npm run check` exit `0` (`102/102` node tests, `68/68` Vitest tests, `6/6` fixtures, `dataset check` OK) và `npm run test:e2e` exit `0` (`19/19` Playwright Chromium E2E).
- **G3 độc lập — R1 (`12abdbd`) + R1.1 (`6fd1506`, 06/11/2026):**
  - [M4 G3a QA report](evidence/M4-G3a-QA-REPORT.md) (`TEST-M4-001`, G3a) — **`qa-pass`** tại `6fd1506` (`0` S0/S1/S2/S3 còn mở; đã xác nhận `QA-M4-001..003` `verified-fixed`).
  - [M4 G3b security review](evidence/M4-G3b-SECURITY-REVIEW.md) (`SEC-REVIEW-M4-001`, G3b) — **`security-approved`** (`0` S0/S1/S2/S3 còn mở ở mức code/CI cho cả M3 và M4 sau khi đóng `SEC-M4-001`, `EXC-SEC-M3-R2-B` / `SEC-M3-101(e)`, `EXC-SEC-M3-R2-D` / `SEC-M3-005`, và `SEC-M3-003(b/d)` trước hạn `2026-11-08`; chỉ còn bước vận hành `SEC-M3-007` kiểm `curl -I` khi gắn domain production thật ở `G4a`).
  - [M4 G3c independent review](evidence/M4-G3c-INDEPENDENT-REVIEW.md) (`REVIEW-M4-001`, G3c) — **`review-approved`** tại `6fd1506` (đã tổng hợp G3a + G3b và xác nhận cả `5/5` phát hiện `REV-M4-001..004` + `SEC-M4-001` đều `verified-fixed`).
- [M4 evidence envelope](evidence/M4-EVIDENCE-ENVELOPE.md) (`EVID-M4-001`) — **`approved`** (`2026-11-06T07:30Z`), tổng hợp trọn bộ bằng chứng `G0 → G1 → G2 → G3a/G3b/G3c` của M4.

## M5 evidence hiện tại

Nhánh `m5-release-hardening` (tách từ `main` @ `0e849f1`). Quyết định Owner trong chat ngày 2026-11-10: D-M5-1 (làm M5 ngay, thử bằng HK I trên preview, không production vòng này), D-M5-2 (không telemetry), D-M5-3 (một maintainer, `--accept-single-reviewer` + `RA-M5-001`). Tất cả artefact dưới đây là bản nháp; **chưa có gate nào của M5 được duyệt**, chưa có deploy/publish/run ID.

- [M5 spec](evidence/M5-SPEC.md) (`SPEC-M5-001`, G0) — `draft`, **chờ Owner G0**; scope M5-A…M5-L, `AC-M5-01…19`, OD-M5-1…5, `RA-M5-001`.
- [M5 design handoff](evidence/M5-DESIGN-HANDOFF.md) (`DESIGN-M5-001`, G1) — `draft`, **chờ Owner G1**; module design, work packages WP1–WP3, contract smoke script.
- [ADR-0014 — observability không telemetry, kênh báo lỗi không egress](adr/ADR-0014-m5-release-observability-without-telemetry.md) — `proposed`, chờ G1.
- [M5 release checklist](evidence/M5-RELEASE-CHECKLIST.md) (`CHECKLIST-M5-001`) — `draft`; G4b (HK I preview tùy chọn, HK II), G4a, G5, bước chỉ Owner làm.
- [M5 release report](evidence/M5-RELEASE-REPORT.md) (`RELEASE-M5-001`) — `draft`; mọi trường thực thi `pending — not executed`.
- [Hướng dẫn Owner kiểm thử HK I](evidence/M5-OWNER-HK1-VALIDATION-GUIDE.md) (`GUIDE-M5-HK1-001`) — `draft`; nhánh `m5-hk1-validation`, dọn dẹp để `main` giữ `datasets: []`.
- [Operations](OPERATIONS.md) và [CHANGELOG](../CHANGELOG.md) — cập nhật cho M5 (M5-I), chờ G0/G1.
- `EVID-M5-001` (`M5-EVIDENCE-ENVELOPE.md`) — **chưa tạo**, tạo ở G2.
- **Finding `F-M5-001`** (S2 process/evidence): một số định danh mà [M4 G3a](evidence/M4-G3a-QA-REPORT.md) (và một dòng của [M4 G3c](evidence/M4-G3c-INDEPENDENT-REVIEW.md)) trích dẫn không tồn tại trong code tại `0e849f1`; không reopen merge M4, nhưng **chặn G4a** cho tới khi G3a/G3c M5 kiểm chứng lại `AC-M4-01…08`, `AC-04`, `AC-05` (M5-L). Chi tiết ở [SPEC-M5-001 §4](evidence/M5-SPEC.md).

## Cách dùng

- Product cập nhật PRD và roadmap.
- Tech Lead cập nhật architecture/stack/ADR và traceability.
- Data Parser chịu trách nhiệm domain/parser/fixtures và tạo candidate.
- Data Reviewer độc lập validate import/diff/provenance trước G4b.
- Tester dùng QA plan để tạo bằng chứng release.
- Release Manager là người kiểm tra cuối cùng rằng dataset và docs có provenance/rollback.

## Templates và evidence

- [Evidence envelope](../.claude/templates/EVIDENCE_ENVELOPE.md) — bắt buộc cho mọi gate artifact.
- [Spec](../.claude/templates/SPEC_TEMPLATE.md), [design](../.claude/templates/DESIGN_HANDOFF.md), [ADR](../.claude/templates/ADR_TEMPLATE.md).
- [Implementation handoff](../.claude/templates/IMPLEMENTATION_HANDOFF.md), [test report](../.claude/templates/TEST_REPORT_TEMPLATE.md), [review report](../.claude/templates/REVIEW_REPORT_TEMPLATE.md), [security report](../.claude/templates/SECURITY_REVIEW_REPORT.md).
- [Data import](../.claude/templates/DATA_IMPORT_REPORT.md), [release/post-release](../.claude/templates/RELEASE_REPORT.md).

Các report phải ghi `N/A — docs-only` khi chưa có code/run thực tế; không được điền giả evidence.
