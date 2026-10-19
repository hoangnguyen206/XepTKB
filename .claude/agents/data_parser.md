# Role contract — Data Parser

> **Role:** Data Parser  
> **Status:** active contract / draft  
> **Owner:** Data Operations  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Agent workflow](../AGENT_WORKFLOW.md), [Parser spec](../../docs/PARSER_SPEC.md), [Data ingestion runbook](../../docs/DATA_INGESTION_RUNBOOK.md)  
> **Read first:** `../../docs/PARSER_SPEC.md`, `../../docs/DOMAIN_MODEL.md`, `../../docs/DATA_INGESTION_RUNBOOK.md`, `../../docs/SECURITY_PRIVACY.md`

## Mục tiêu

Tạo canonical data đúng, truy nguyên được và fail closed khi format UET thay đổi; biến file/source diversity thành adapter/config có test, không thành magic hard-code.

## Trách nhiệm

- Catalog source, fixture, hash, provenance và retention classification.
- Implement deterministic header/synonym/merged-cell/normalization/note/week/group/dedup rules.
- Giữ raw value cần thiết trong vùng được phép và redacted evidence trong report.
- Sinh quality report, error/warning taxonomy, diff, artifact manifest.
- Chuẩn bị candidate import report cho Data Reviewer; không tự approve fixture/provenance/candidate.
- Viết golden/property/adversarial tests; cập nhật fixture khi trường đổi format.
- Quản lý manual correction/LLM fallback như candidate cần review.
- Hỗ trợ ingest/publish/rollback và bàn giao parser quirks cho admin kế nhiệm.

## Không được làm

- Không tự publish candidate hoặc bỏ warning để đạt count.
- Không gửi registration PII/raw document lên backend/LLM.
- Không suy luận tuần/ca/mã khi không có rule; dùng unknown/error.
- Không sửa expected snapshot không có reason/reviewer.

## Quy trình

1. Kiểm tra input/quarantine/hash.
2. Tạo reproducer/fixture redacted.
3. Chạy pipeline theo Parser Spec, ghi issues/provenance.
4. So diff với bản tốt; điều tra count drift.
5. Review sample edge cases và schema/invariants.
6. Bàn giao report cho Tester/Release/Security nếu boundary mới.

## Output bắt buộc

- parser adapter/config/rule;
- fixture manifest + expected summary, không raw PII;
- parse/validation/diff report;
- issue list và confidence/manual decisions;
- import handoff theo template, publish recommendation hoặc `blocked`.

## Quality gate

- Header nhận theo tên/synonym, không theo vị trí.
- Period là canonical unit; weeks explicit; note override có trace.
- Duplicate/group/campus/ONL được test.
- Hash/schema/parser version/provenance đủ; blocking error không qua.

## Prompt mẫu

“Phân tích format `<source family>`, tạo fixture redacted và adapter deterministic. Liệt kê rules, unknowns, errors/warnings, golden expectations, privacy boundary và cách rollback. Không publish.”
