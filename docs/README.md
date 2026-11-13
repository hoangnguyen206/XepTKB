# Documentation index

> **Status:** active — nguồn trạng thái duy nhất của dự án (mục "Trạng thái hiện tại")  
> **Owner:** Product + Tech Lead  
> **Last reviewed:** 2026-11-12  
> **Related docs:** [root CLAUDE.md](../CLAUDE.md), [Agent workflow](../.claude/AGENT_WORKFLOW.md), [Lịch sử milestone](evidence/HISTORY.md)

Bản đồ tài liệu source of truth cho Kỳ Này. Brief `Kế hoạch sản phẩm – Tool xếp TKB cho sinh viên VNU.md` ở thư mục gốc chỉ là nguồn nghiên cứu ban đầu; khi brief và tài liệu dự án khác nhau, mở decision/ADR thay vì sửa ngầm.

## Trạng thái hiện tại

_Cập nhật mục này (và chỉ mục này) khi trạng thái dự án đổi; tài liệu khác link về đây._

- **Code:** M0–M5 đã merge vào `main` (M5 qua PR #3 `ba43867`; link báo lỗi Google Form qua PR #5/#6). Lịch sử từng milestone: [HISTORY](evidence/HISTORY.md).
- **Gate:** M5 đã qua G0/G1/G2/G3a/G3b/G3c, Owner ký `2026-11-12T04:19Z` ([EVID-M5-001](evidence/M5-EVIDENCE-ENVELOPE.md)). Chưa chạy **G4a** (app lên production), **G4b** (publish dataset HK II), **G5**.
- **Hosting:** Cloudflare Pages, domain production đã chốt `xeptkb-63v.pages.dev`; deploy production đang tắt tới G4a. Preview theo nhánh `<nhánh>.xeptkb-63v.pages.dev`.
- **Dữ liệu:** `main` chưa có dataset (`data/published/manifest.json` → `datasets: []`). TKB HK I 2026–2027 đã thử trên preview và được Owner duyệt; Owner đã kiểm trên thiết bị thật (P-10…P-12, 2026-11-12). TKB HK II chờ trường công bố.
- **Việc tồn đọng:** danh sách B-01…B-09 ở cuối [EVID-M5-001](evidence/M5-EVIDENCE-ENVELOPE.md) — còn mở: dataset HK II (B-08), G4a production (B-09).
- **M6 (làm mới frontend "Lịch có màu"):** Owner duyệt hướng và 8 quyết định ngày 2026-11-12; [SPEC-M6-001](evidence/M6-SPEC.md) **G0 Owner ký `2026-11-12T14:53Z`**; **G1 Owner ký `2026-11-12T15:28Z`** ([DESIGN-M6-001](evidence/M6-DESIGN-HANDOFF.md), [ADR-0015](adr/ADR-0015-m6-design-system-and-local-ui-settings.md)). Code M6 làm trên nhánh tích hợp `m6-frontend` theo §13 của design (F1 → F7), mỗi bước một PR vào nhánh đó; `main` giữ bản M5 cho G4a. Kế hoạch: [PLAN-M6-001](evidence/M6-FRONTEND-REFRESH-PLAN.md). M6 không chặn G4a (D-M6-8). Tiến độ: **F1a** (nền tảng) đã merge vào `m6-frontend` qua PR #11; bỏ độ đậm font 600 (D-M6-12). **F1b** (design system) đang ở PR vào `m6-frontend`. Chưa có gate G2/G3 nào của M6 được ký.
- **Vận hành:** một người vận hành theo ngoại lệ `RA-M5-001` (hết hạn trước G4a public đầu tiên hoặc 31/01/2027).

## Cây tài liệu

| Tài liệu | Dùng cho | Owner role |
| --- | --- | --- |
| [PRD](PRD.md) | scope, user journey, requirements, acceptance criteria | Product Spec |
| [Implementation plan](IMPLEMENTATION_PLAN.md) | milestone, gate, quyết định, cut line | Tech Lead |
| [Roadmap](ROADMAP.md) | phạm vi sau MVP và điều kiện mở | Product |
| [Tech stack](TECH_STACK.md) | công nghệ, boundary, lựa chọn | Tech Lead |
| [Architecture](ARCHITECTURE.md) | luồng hệ thống, trust boundary, failure modes | Tech Lead |
| [Domain model](DOMAIN_MODEL.md) | model chuẩn và invariant | Data Parser + Tech Lead |
| [Parser spec](PARSER_SPEC.md) | ingest, normalization, validation, fixtures | Data Parser |
| [API/data contracts](API_AND_DATA_CONTRACTS.md) | artifact và contract tối thiểu | Tech Lead |
| [Security & privacy](SECURITY_PRIVACY.md) | data inventory, threat model, security gate | Security Reviewer |
| [QA test plan](QA_TEST_PLAN.md) | test matrix, release gate, evidence | Tester |
| [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md) | nạp, duyệt, publish, rollback dữ liệu | Release/Data Ops |
| [Operations](OPERATIONS.md) | môi trường, deploy, rollback, tag/changelog, monitoring, incident | Release Manager |
| [CHANGELOG](../CHANGELOG.md) | thay đổi theo version | Release Manager |

## ADR

| ADR | Quyết định | Trạng thái |
| --- | --- | --- |
| [ADR-0001](adr/ADR-0001-react-vite-monorepo.md) | Monorepo, React + Vite | ready (G1 chưa ký riêng) |
| [ADR-0006](adr/ADR-0006-default-th-weeks.md) | Tuần mặc định buổi TH | ghi trong docs (amendment Q-010) |
| [ADR-0007](adr/ADR-0007-static-artifact-cli-admin.md) | Static artifact + CLI admin | ghi trong docs (Q-003) |
| [ADR-0008](adr/ADR-0008-m1-parser-dependencies-local-provenance.md) | Dependency parser M1, provenance local | ready (G1 chưa có actor/date) |
| [ADR-0009](adr/ADR-0009-m2-domain-engine-schema.md) | Domain engine, schema `0.2.0` | ready (G1 chưa có actor/date) |
| [ADR-0010](adr/ADR-0010-m3-web-app-artifact-storage-export.md) | Web app, loader, IndexedDB, export | `g1-approved` |
| [ADR-0011](adr/ADR-0011-timetable-format-variability.md) | TKB đổi bộ cột theo kỳ | `g1-approved` |
| [ADR-0012](adr/ADR-0012-dataset-publish-pipeline.md) | Pipeline nạp/publish dữ liệu | `g1-approved` |
| [ADR-0013](adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md) | UI nhập ĐKMH, 2 slot Plan, ranh giới privacy | `g1-approved` |
| [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md) | Không telemetry, kênh báo lỗi không egress | accepted |
| [ADR-0015](adr/ADR-0015-m6-design-system-and-local-ui-settings.md) | Design system M6 (token CSS, bảng màu TS, font tự host, icon SVG) và settings giao diện trên máy | accepted |

## Bằng chứng còn dùng

- [EVID-M5-001](evidence/M5-EVIDENCE-ENVELOPE.md) — envelope M5 + việc tồn đọng; kèm [spec](evidence/M5-SPEC.md), [design](evidence/M5-DESIGN-HANDOFF.md), [G3a](evidence/M5-G3a-QA-REPORT.md), [G3b](evidence/M5-G3b-SECURITY-REVIEW.md), [G3c](evidence/M5-G3c-INDEPENDENT-REVIEW.md).
- [Release checklist](evidence/M5-RELEASE-CHECKLIST.md), [release report nháp](evidence/M5-RELEASE-REPORT.md), [hướng dẫn thử HK I](evidence/M5-OWNER-HK1-VALIDATION-GUIDE.md) — dùng cho G4a/G4b/G5.
- [DRILL-M3-G4b-001](evidence/M3-G4b-DRILL-REPORT.md) — diễn tập publish/rollback dataset.
- [REVIEW-C09-001](evidence/C09-REGISTRATION-SAMPLE-REVIEW.md) — nguồn của fixture đăng ký đã xóa PII.
- [SPEC-M6-001](evidence/M6-SPEC.md) (G0 đã ký), [DESIGN-M6-001](evidence/M6-DESIGN-HANDOFF.md) (G1 đã ký) và [PLAN-M6-001](evidence/M6-FRONTEND-REFRESH-PLAN.md) — làm mới frontend.
- [HISTORY](evidence/HISTORY.md) — tóm tắt M0–M4; bản đầy đủ trong tag `docs-archive-2026-11-12`.

## Đội Agent và template

- [Agent workflow](../.claude/AGENT_WORKFLOW.md) — lifecycle, handoff, escalation, RACI. Role contract: [Tech Lead](../.claude/agents/tech_lead.md), [Product Spec](../.claude/agents/product_spec.md), [Coder](../.claude/agents/coder.md), [Data Parser](../.claude/agents/data_parser.md), [Data Reviewer](../.claude/agents/data_reviewer.md), [Frontend](../.claude/agents/frontend.md), [Tester](../.claude/agents/tester.md), [Security Reviewer](../.claude/agents/security_reviewer.md), [Reviewer](../.claude/agents/reviewer.md), [Release Manager](../.claude/agents/release_manager.md).
- Template trong [`.claude/templates/`](../.claude/templates/): [evidence envelope](../.claude/templates/EVIDENCE_ENVELOPE.md) (bắt buộc cho mọi gate artifact), spec, design handoff, ADR, implementation handoff, test/review/security report, data import, release report. Report ghi `N/A — docs-only` khi chưa có run thật; không điền giả evidence.

## Cross-document invariants

1. MVP chỉ phục vụ UET; TKB admin preload, file kết quả đăng ký parse local.
2. P0: dataset TKB có version, tìm/chọn lớp, conflict theo giờ + tuần, week 1 theo khóa/tự chọn, lưới tuần/danh sách ngày, responsive, merge kết quả ĐKMH cục bộ, xuất PNG/Word/.ics.
3. Tiết là đơn vị gốc; `Section` có nhiều `Session`; `weeks` là tập tuần tường minh.
4. Kết quả ĐKMH có thể mới hơn TKB: phòng/giờ từ ĐKMH thắng và phải gắn nhãn override.
5. Không upload PII, không xin mật khẩu cổng trường, không gọi dịch vụ ngoài trực tiếp từ trình duyệt.
6. LLM, dhqg.xyz, nhóm, Premium, nhiều trường, email intake, PDF scan là post-MVP, không chặn release.
7. Dataset phải có provenance/version; không publish output parser chưa qua validation/review.
8. Gate canonical `G0 → G1 → G2 → G3a/G3b/G3c → G4a/G4b → G5`; G3a/b/c bắt buộc trước release.
9. P0/P1/P2 là product priority; S0–S3 là defect severity. P0 committed phải có evidence; S0/S1 là no-go; S2/S3 cần owner/mitigation/due/expiry.
10. Data Parser tạo candidate; Data Reviewer độc lập validate; Release Manager chịu trách nhiệm publish/rollback.

## Quyết định còn mở trước production

| ID | Quyết định | Trạng thái |
| --- | --- | --- |
| D-001 | Tên thương hiệu cuối cùng | Mở. Domain production đã chốt `xeptkb-63v.pages.dev` (2026-11-12) |
| D-002 | React + Vite hay framework khác | Proposed; thực tế đang dùng React + Vite (ADR-0001) |
| D-004 | Data region / rà soát pháp lý vendor | Một phần: hosting = Cloudflare Pages; legal review còn mở |
| D-008 | Ngày public | Mở. Q-011 cập nhật bởi Q-014: Owner quyết sau khi có dataset HK II đã duyệt |

Đã chốt (chi tiết ở [Implementation plan §7](IMPLEMENTATION_PLAN.md)): D-003 static + CLI (Q-003), D-005 browser matrix (Q-007) và không telemetry ở release đầu (Q-014/ADR-0014), D-006 không tài khoản/sync, D-007 fixture policy (Q-006), D-009 2 slot Plan (Q-005), D-010 export (Q-002), D-011 week 1 fixture (Q-001).
