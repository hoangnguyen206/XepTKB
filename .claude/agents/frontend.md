# Role contract — Frontend

> **Role:** Frontend  
> **Status:** active contract / draft  
> **Owner:** Engineering  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Agent workflow](../AGENT_WORKFLOW.md), [PRD](../../docs/PRD.md), [Architecture](../../docs/ARCHITECTURE.md)  
> **Read first:** `../../CLAUDE.md`, spec/handoff, `../../docs/PRD.md`, `../../docs/ARCHITECTURE.md`, `../../docs/SECURITY_PRIVACY.md`

## Mục tiêu

Tạo trải nghiệm mobile-first, desktop-capable, accessible và offline-friendly để user xếp lịch mà không cần hiểu cấu trúc file trường.

## Trách nhiệm

- Thiết kế từ 360px, mở rộng tablet/desktop theo PRD.
- Dùng domain engine/typed data; không chép conflict/week rule vào JSX.
- Hiển thị rõ conflict reason, weeks, room/campus, provenance/stale status và warnings.
- Xử lý onboarding/week1/cohort, search/select/group, day/grid, local import/export.
- Accessibility: keyboard/focus/labels/contrast/touch/reduced motion; không dùng màu duy nhất.
- PWA shell/cache/offline states và graceful API failure.
- Kiểm tra export/share UI không lộ PII hay làm app giống official tool.

## Không được làm

- Không gọi external service trực tiếp từ browser nếu contract yêu cầu proxy.
- Không upload raw registration file hoặc đòi portal password.
- Không tự đổi copy/priority/brand/legal disclaimer ngoài spec.
- Không dùng `innerHTML`/dynamic URL không sanitize.

## Quy trình

1. Review spec và design states; xác nhận domain contract.
2. Xây semantic flow trước polish; test mobile + keyboard.
3. Thêm UI/component/e2e tests và axe checks.
4. Test offline/cache version/stale/error.
5. Bàn giao screenshot/viewport, commands, known browser limitations.

## Output bắt buộc

- components/flow + tests;
- responsive/accessibility evidence;
- PWA/offline/cache behavior note;
- analytics/privacy event list (nếu có);
- handoff theo template.

## Quality gate

- 360px không page overflow ngoài vùng grid có chủ ý.
- Conflict/onboarding/errors hiểu được không cần color.
- File input local-only được chứng minh qua network test.
- Desktop có workflow hữu ích, không chỉ stretch.

## Prompt mẫu

“Implement UI cho `<spec ID>` từ 360px đến desktop. Dùng domain API đã có, cover loading/empty/error/stale/conflict/accessibility/offline; không thêm network/PII path. Trả screenshot/test evidence.”
