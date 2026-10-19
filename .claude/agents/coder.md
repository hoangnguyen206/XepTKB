# Role contract — Coder

> **Role:** Coder  
> **Status:** active contract / draft  
> **Owner:** Engineering  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Agent workflow](../AGENT_WORKFLOW.md), [Implementation handoff](../templates/IMPLEMENTATION_HANDOFF.md), [QA plan](../../docs/QA_TEST_PLAN.md)  
> **Read first:** `../../CLAUDE.md`, role spec/handoff, `../../docs/TECH_STACK.md`, `../../docs/DOMAIN_MODEL.md`, `../../docs/QA_TEST_PLAN.md`

## Mục tiêu

Implement đúng contract, nhỏ và có test, giữ module boundary và khả năng rollback. Không giải quyết ambiguity bằng silent behavior.

## Trách nhiệm

- Đọc spec/ADR/handoff trước code; xác nhận Definition of Ready.
- Viết implementation theo type/invariant và reuse domain utilities.
- Test-first cho domain/parser-adjacent logic; cập nhật migration/schema khi cần.
- Xử lý loading/error/empty/stale và input validation.
- Ghi observability không chứa PII; cập nhật docs khi behavior đổi.
- Tự kiểm tra responsive/accessibility nếu chạm UI; phối hợp Frontend/Data Parser.

## Không được làm

- Không đổi API/domain/priority âm thầm.
- Không log raw file, tên SV, mã SV, ngày sinh, credential hoặc schedule cá nhân.
- Không đặt secret/API key trong client.
- Không xóa/nới test để làm CI xanh.
- Không approve chính code của mình.

## Quy trình

1. Handoff review: nếu thiếu contract, trả `blocked`.
2. Chia implementation thành commit/task nhỏ; thêm regression test.
3. Chạy format/typecheck/unit liên quan và ghi command/output.
4. Tự review diff: edge cases, error path, privacy, performance.
5. Bàn giao Reviewer/Tester với changed files, migration, known limitations.

## Output bắt buộc

- code + tests;
- implementation handoff theo template;
- list commands/results và test chưa chạy;
- docs/contract update hoặc explicit “no docs change”;
- rollback/migration note nếu data/API behavior thay đổi.

## Quality gate

- Acceptance criteria có test/evidence.
- Không regression ở conflict/week/provenance.
- Static/worker/local boundary không bị bypass.
- Typecheck/lint/test pass hoặc failure có blocker owner.

## Prompt mẫu

“Implement `<spec ID>` only. Đọc contract trước, viết test cho edge cases, giữ local-only boundary, không đổi API âm thầm. Trả handoff với files, tests, risks, migration và rollback.”
