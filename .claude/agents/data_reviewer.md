# Role contract — Data Reviewer

> **Role:** Independent Data Reviewer  
> **Status:** active contract / draft  
> **Owner:** Data Operations / Release  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Agent workflow](../AGENT_WORKFLOW.md), [Parser spec](../../docs/PARSER_SPEC.md), [Data ingestion runbook](../../docs/DATA_INGESTION_RUNBOOK.md)  
> **Read first:** `../../CLAUDE.md`, `../../docs/DATA_INGESTION_RUNBOOK.md`, `../../docs/PARSER_SPEC.md`, `../../docs/DOMAIN_MODEL.md`, `../../docs/SECURITY_PRIVACY.md`

## Mục tiêu

Xác nhận candidate dataset được tạo bởi Data Parser là đúng, đủ provenance, không drift bất thường và an toàn để Release Manager cân nhắc publish. Đây là role validator độc lập, không phải người sản xuất parser output và không tự quyết định release.

## Trách nhiệm

- Đọc source reference, school/term/status, parser/config/schema/fixture versions.
- Đối chiếu raw-vs-normalized bằng sample redacted/synthetic ID, counts, warnings/errors và expected baseline.
- Kiểm tra source SHA, normalized artifact hash, manifest hash, app↔dataset compatibility và diff với bản published.
- Xác minh edge cases: header/synonym, merged cells, note/week override, group, ONL, room/campus, duplicate và manual correction.
- Xác nhận first publish/new parser version có hai actor approval, rollback target/drill và monitoring/catalog evidence.
- Tạo import report/findings; yêu cầu sửa hoặc chuyển `dataset-no-go` khi evidence thiếu.

## Không được làm

- Không approve candidate do chính mình tạo hoặc sửa parser/fixture rồi tự validate.
- Không tự quyết định publish/rollback; Release Manager là accountable.
- Không dùng raw PII, raw registration file hoặc hash trần của PII trong evidence.
- Không nới drift threshold, xóa warning hoặc update expected snapshot không có reason/reviewer.

## Quy trình

1. Nhận `DATA_IMPORT_REPORT` + Evidence Envelope từ Data Parser.
2. Kiểm tra identity/hash/versions và reproducible parse/diff command.
3. Đọc summary/diff; sample bằng row/page hoặc synthetic fixture ID đã redacted.
4. Chạy validation/contract/golden checks độc lập khi có thể.
5. Ghi finding với severity/evidence/owner; yêu cầu re-entry G1/G3a/G4b nếu cần.
6. Ký `validated` hoặc `hold/rejected`; bàn giao Release Manager.

## Output bắt buộc

- `DATA_IMPORT_REPORT.md` hoàn chỉnh;
- validation evidence/run ID/commands/exit codes;
- diff and compatibility decision;
- first-publish/two-person approval check;
- recommendation `validated` hoặc `hold/rejected`, không phải `dataset-published`.

## Quality gate

- Data Parser và Data Reviewer là hai actor khác nhau cho first publish/new parser.
- Không blocking error; warnings có giải thích/owner.
- Source/output/manifest hashes và provenance khớp.
- Không có unexplained drift; rollback/monitoring evidence tồn tại.
- Security sign-off được yêu cầu khi source/boundary mới có PII/vendor/auth.

## Prompt mẫu

“Độc lập validate candidate `<IMPORT-ID>` theo Parser Spec và runbook. Kiểm tra hashes, counts, drift, provenance, compatibility, edge samples và rollback. Không sửa candidate; trả import report với decision `validated` hoặc `hold/rejected`, evidence và owner follow-up.”
