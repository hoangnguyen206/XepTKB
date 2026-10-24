# ADR-0006 — Default `weeks = [2..teachingWeeks]` cho session `kind=TH` khi merge registration

> **Artifact ID:** `ADR-0006`
> **Artifact status:** `approved`
> **Canonical gate:** `G1`
> **Date:** 2026-10-20
> **Owner:** Data Parser + Tech Lead
> **Decision owner:** Product
> **Last reviewed:** 2026-10-20
> **Related docs:** [Domain model §7](../DOMAIN_MODEL.md), [Parser spec §6](../PARSER_SPEC.md), [Implementation plan §10 C-03](../IMPLEMENTATION_PLAN.md)
> **Evidence envelope:** `N/A — docs-only`

## Source and context

- Brief `Kế hoạch sản phẩm – Tool xếp TKB cho sinh viên VNU.md` §“Kế hoạch học tập”: buổi thực hành (TH) bắt đầu từ tuần 2.
- PARSER_SPEC §6 đã ghi `TH từ tuần 2 khi merge registration → [2..15]` như “approved rule” nhưng chưa có ADR xác nhận.
- DOMAIN_MODEL §7 trước đây nói “TH mặc định từ tuần 2 theo brief khi merge registration” mà không tách scope áp dụng.
- Requirement: FR-09/FR-10 (registration parse + override), AC-05.

## Decision

1. Khi **merge file registration** vào Plan, session `kind=TH` **không có `weeks` explicit** được default `weeks = [2..term.teachingWeeks]` và phải ghi `warning: DEFAULT_WEEKS_APPLIED` + `inferenceReason`.
2. Rule này **chỉ áp** cho merge path registration. TKB ingest (`.xlsx`) vẫn default `[1..15]` khi không ghi tuần trừ khi adapter `uet-xlsx` config nói rõ khác.
3. Có thể thay đổi bằng config `uet-xlsx`/`vnu-registration-html` nếu fixture học kỳ sau cho thấy rule khác; mỗi thay đổi phải kèm fixture golden mới.

## Scope and non-goals

- In scope: TH session trong registration merge; warning/inference tracking.
- Not in scope: suy luận tuần từ `Đợt thi`, `Học 1 ca/10 tuần`, hoặc các pattern chưa có fixture evidence — những case này vẫn trả `AMBIGUOUS_NOTE`/`UNPARSED_NOTE` và không auto-publish.

## Options considered

| Option | Pros | Cons | Why not/why chosen |
| --- | --- | --- | --- |
| Áp `[2..15]` cho cả TKB ingest | đơn giản | sai với TKB đã ghi tuần explicit; merge path khác ingestion | không áp chung — giữ scope merge |
| Không default, bắt user chọn | không đoán | mỗi TH lại hỏi 1 lần, UX tệ | không chọn |
| Áp `[2..15]` + warning (chọn) | giữ flow, có provenance để audit | phải đảm bảo warning hiện rõ | **chosen** — provenance + warning đủ để Data Reviewer phát hiện drift |

## Consequences

### Positive

- Match quy ước UET trong brief; tránh báo conflict sai cho TH tuần 1.
- Provenance rõ: `sourceType=registration`, `confidence=deterministic` + `DEFAULT_WEEKS_APPLIED` warning.

### Negative / risks

- Nếu học kỳ sau trường cho TH học từ tuần 1, rule sẽ sai — cần config/fixture mới. Mitigation: config per term, không hardcode 2.

### Privacy/security

- Data crossing boundaries: không — rule chạy local trong browser.
- Threat/control: không mở boundary mới.
- Security review required: không thêm.

### Operations/migration

- Rollout: M1 implement adapter + fixture golden; M4 merge UI dùng rule.
- Compatibility: `weeks` vẫn là `number[]` explicit sau merge; không schema change.
- Rollback: nếu rule sai, sửa config + publish dataset version mới; Plan cũ giữ overrides đã lưu.
- Owner: Data Parser.

## Reproducible evidence and acceptance

- Spike/test: `N/A — docs-only`. Sẽ được tạo trong M1 golden fixture `vnu-registration-html`.
- Acceptance:
  - fixture TH không có weeks → `weeks=[2..15]` + `DEFAULT_WEEKS_APPLIED` warning;
  - fixture TH có weeks explicit → không override;
  - TKB `.xlsx` TH không ghi tuần → `[1..15]` (không áp rule merge).
- Known limitations: rule gắn với HK II 2026–27 UET; học kỳ sau cần fixture mới để confirm.

## Approval and risk acceptance

- Decision: `accepted` — Product chốt 20/10/2026 qua Q-006/C-03.
- Accepted by: Product Owner.
- Risk exception: `none`.

## Follow-up and history

| Action | Owner | Due/trigger | Status |
| --- | --- | --- | --- |
| Tạo fixture `vnu-registration-html` cover rule | Data Parser | M1 | open |
| Verify rule với file registration thật (redacted) | Data Reviewer | M1 G3a | open |

| Change ID | Date/actor | Reason | Supersedes |
| --- | --- | --- | --- |
| ADR-0006 | 2026-10-20 / Product | Chốt rule TH default từ brief thành contract | — |
