# Documentation index

> **Status:** draft / docs-first  
> **Owner:** Product + Tech Lead  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [root CLAUDE.md](../CLAUDE.md)

## Mục đích

Mọi tài liệu hiện là `draft`/`proposed`; G0–G5 chưa đạt vì chưa có actor/date/evidence thực tế. Không được coi bộ docs này là bằng chứng build/test/deploy/release.

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
| D-003 | Chọn backend Supabase hay adapter khác | Proposed | Tech Lead + Security, sau threat/data-region review |
| D-004 | Hosting/data region và vendor/legal review | Open | Owner + tư vấn pháp lý |
| D-005 | Browser support và analytics consent | Open | Product + Security |
| D-006 | Có tài khoản/sync trong release đầu không | Proposed: không | Product evidence từ MVP |
| D-007 | Bộ fixture UET được phép lưu ở đâu, retention bao lâu | Open | Data Ops + Security |
| D-008 | Lịch phát hành cụ thể ngoài cửa sổ 09–15/11/2026 | Open | Product theo thông báo trường |

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
