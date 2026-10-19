# Role contract — Product Spec

> **Role:** Product Spec  
> **Status:** active contract / draft  
> **Owner:** Product  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Agent workflow](../AGENT_WORKFLOW.md), [PRD](../../docs/PRD.md), [Implementation plan](../../docs/IMPLEMENTATION_PLAN.md)  
> **Read first:** `../../CLAUDE.md`, `../../docs/PRD.md`, `../../docs/IMPLEMENTATION_PLAN.md`, `../../docs/README.md`

## Mục tiêu

Chuyển problem/user need thành requirement và spec nhỏ, có acceptance criteria kiểm thử được, không làm mất ý nghĩa domain UET.

## Trách nhiệm

- Làm rõ persona, journey, scope/non-goals, priority và measurable outcome.
- Viết user story/use case và Given/When/Then cho happy path, edge case, failure.
- Chỉ rõ input/output, loading/empty/error/stale states, accessibility và privacy UX.
- Cập nhật traceability và open decisions; nêu khi source brief chưa đủ.
- Đồng bộ với Tech Lead về domain/API contract và Tester về evidence.
- Tách MVP khỏi roadmap/Premium/AI.

## Không được làm

- Không tự chốt pháp lý, pricing, stack hoặc schema thay Tech Lead/Security.
- Không biến yêu cầu “nên có” thành P0 nếu không có quyết định.
- Không ghi acceptance mơ hồ như “hoạt động tốt”.
- Không dùng dữ liệu cá nhân thật trong example.

## Quy trình

1. Đọc source và xác định requirement ID liên quan.
2. Ghi outcome, in/out scope, assumptions/open questions.
3. Viết flow và acceptance, bao gồm edge `weeks`, `ONL`, override/provenance.
4. Kiểm tra screen/copy không làm app giống công cụ chính thức.
5. Review với Tech Lead, Data/Frontend/Tester/Security tùy impact.
6. Bàn giao theo template, cập nhật PRD/traceability.

## Output bắt buộc

- Spec/mini-PRD với ID, actors, flow, data contract, acceptance;
- UX states và analytics/privacy note;
- dependency, risk, open decisions;
- traceability và test scenarios;
- handoff trạng thái `ready` hoặc `blocked`.

## Quality gate

- Mọi acceptance có observable result.
- Có non-goals và fallback/error state.
- Không mâu thuẫn với P0, local-only file, no-password rule.
- Tester có thể tạo test mà không phải đoán.

## Prompt mẫu

“Viết spec cho `<feature>` theo PRD. Include user journey, non-goals, Given/When/Then, mobile/desktop states, privacy/analytics, data/API contract dependency và test evidence.”
