# Documentation index

> **Status:** draft / docs-first  
> **Owner:** Product + Tech Lead  
> **Last reviewed:** 2026-10-25
> **Related docs:** [root CLAUDE.md](../CLAUDE.md)

## Mục đích

Mọi tài liệu sản phẩm hiện là `draft`/`proposed`; các gate G0–G5 chưa được phê duyệt đầy đủ vì còn thiếu actor/sign-off độc lập ở các bước tương ứng. M1 parser và M2 domain engine đã được commit và merge vào `main` local (`aba04b0`) với local evidence, nhưng chưa phải bằng chứng publish/release; xem [audit M0–M2](evidence/M0-M2-AUDIT-2026-10-25.md) cho các finding còn mở. Không được coi bộ docs này là bằng chứng build/test/deploy/release hoàn chỉnh.

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
| [Operations](OPERATIONS.md) | môi trường, deploy, monitoring, incident | Release Manager | Proposed |

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
| D-001 | Tên thương hiệu cuối cùng và domain | Open | Product, kiểm tra tên miền/nhãn hiệu |
| D-002 | Chốt React+Vite hay framework khác | Proposed | Tech Lead sau spike PWA/SSR |
| D-003 | Backend: **static artifact + CLI admin**; Supabase deferred | **Closed** (Q-003) | Tech Lead + Security 20/10/2026 |
| D-004 | Hosting/data region và vendor/legal review | Open | Owner + tư vấn pháp lý |
| D-005 | Browser matrix Tier 1/2 + analytics cookieless aggregate | **Closed** (Q-007/Q-008) | Product + Security 20/10/2026 |
| D-006 | Có tài khoản/sync trong release đầu không | **Closed**: không | Product 20/10/2026 |
| D-007 | Fixture policy: synthetic + `test:real` ngoài repo; registration file xóa PII trước khi lưu | **Closed** (Q-006) | Data Ops + Security 20/10/2026 |
| D-008 | Lịch phát hành cụ thể ngoài cửa sổ 09–15/11/2026 | Open | Product theo thông báo trường |
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

M2 đã merge vào `main` local (`aba04b0`, chưa push), nhưng G1 chưa approve và G3 cần chạy lại sau khi sửa finding audit. M2 chưa bao gồm UI/PWA, IndexedDB, export, browser interception, artifact loader, backend/admin publish hoặc real-source validation. G4a/G4b (release) vẫn require M3–M5 completion.

## Audit M0–M2 (25/10/2026)

- [REVIEW-M0M2-AUDIT-001](evidence/M0-M2-AUDIT-2026-10-25.md) — `review-no-go` cho trạng thái "M2 verified": 2 finding đề xuất S1 (Plan chính thức dựng từ nháp; ghép thứ/tiết registration theo tích Descartes), thiếu coverage P0 FR-06 ở parser, 10 finding S2/process, 8 finding S3. Fix round 1–2 (cùng ngày, chưa commit) đã sửa AUD-001, AUD-004…009, AUD-016, áp quyết định Q-009 (loại lớp `ONL`) và Q-010 (tuần TKB thắng default TH), cập nhật [ADR-0006](adr/ADR-0006-default-th-weeks.md)/[ADR-0008](adr/ADR-0008-m1-parser-dependencies-local-provenance.md)/[ADR-0009](adr/ADR-0009-m2-domain-engine-schema.md); cần verify độc lập.

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
