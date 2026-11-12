# Lịch sử milestone và bằng chứng đã lưu trữ

> **Status:** active — tóm tắt bất biến cho các milestone đã đóng  
> **Owner:** Release Manager + Tech Lead  
> **Last reviewed:** 2026-11-12  
> **Related docs:** [docs index](../README.md), [Implementation plan](../IMPLEMENTATION_PLAN.md), [CHANGELOG](../../CHANGELOG.md), [EVID-M5-001](M5-EVIDENCE-ENVELOPE.md)  
> **Evidence envelope:** từng milestone giữ envelope riêng trong tag lưu trữ bên dưới; M5 vẫn còn file sống trong thư mục này

## Cách tra bản đầy đủ

Ngày 2026-11-12, toàn bộ bằng chứng M0–M4 (spec, design handoff, test/security/review report, audit, ảnh chụp màn hình) được gom vào file này để `docs/` chỉ còn tài liệu đang dùng. Bản gốc nằm nguyên trong tag `docs-archive-2026-11-12` (commit `1c6acc3`):

```bash
git show docs-archive-2026-11-12:docs/evidence/M4-EVIDENCE-ENVELOPE.md
git ls-tree -r --name-only docs-archive-2026-11-12 docs/evidence
```

File còn giữ trong thư mục này: bộ M5 (`M5-*`, chưa qua G4a/G4b/G5), [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md) (bằng chứng diễn tập publish/rollback dataset mà G4b dùng) và [REVIEW-C09-001](C09-REGISTRATION-SAMPLE-REVIEW.md) (nguồn của fixture `fixtures/redacted-registration`).

## Tóm tắt từng milestone

| Milestone | Merge trên `main` | Gate đã có | Ghi chú quan trọng | File gốc trong tag |
| --- | --- | --- | --- | --- |
| **M0** Foundation | `22bf934` (vào `main` qua `aba04b0`) | G0/G1 `ready-for-verification`, **chưa có sign-off chính thức** | Monorepo TypeScript, CI nền, fixture policy, threat/data-flow G1 | `M0-EVIDENCE-ENVELOPE.md`, `M0-FIXTURE-POLICY.md`, `M0-G1-threat-data-flow.md`, `M0-IMPLEMENTATION-HANDOFF.md` |
| **M1** Parser | `22bf934` | G2 local; G1 acknowledgement ADR-0008 **chưa có actor/date** | Parser `uet-xlsx` + `vnu-registration-html` (local-only), 28 test, 5/5 fixture | `M1-*.md` (5 file) |
| **M2** Domain engine | `aba04b0`; sửa audit `e41a806`, `4681c63` | G3 role-agent (`4057589`) bị **audit mở lại** (`review-no-go` cho "M2 verified"); AUD-001…009, 016 sửa với trạng thái "fixed — pending independent verification"; G1 ADR-0009 chưa có actor/date | Search/alias, Plan, conflict `thứ × tiết × tuần`, ngày tuần 1, merge đăng ký, tín chỉ; schema `0.2.0`. Q-009/Q-010 phát sinh từ audit | `M2-*.md` (8 file), `M0-M2-AUDIT-2026-10-25.md` |
| **M3** Web app + publish CLI | `4915a86` (PR #1); drill `3c34c89` | G0/G1/G3 R2.1 **Owner ký `2026-11-06T05:50Z`** (`qa-pass`, `security-pass-with-exception`, `review-approved` tại `d51c65b`); G4b drill `g4b-drill-pass` | R1 có 1 S1 (lớp đã chọn rơi khỏi kiểm tra trùng khi dataset đổi nhóm), 6 S2 — đều đã sửa ở R2/R2.1. Exception S3 `EXC-SEC-M3-R2-B/C/D` đóng ở `c2e93b9` | `M3-*.md` (10 file), `m3-screens/*.png` |
| **M4** Nhập kết quả ĐKMH | `bac83bf` (PR #2); đóng S3 `c2e93b9`; docs `0e849f1` | G0/G1/G3 **Owner ký `2026-11-06T07:30Z`** (`qa-pass`, `security-approved`, `review-approved`) | Bằng chứng G3 của M4 trích dẫn định danh không có trong code (`F-M5-001`); M5 G3 đã kiểm định lại AC-M4-01…08, AC-04, AC-05 trên code thật | `M4-*.md` (7 file) |
| **M5** Release hardening | `ba43867` (PR #3); B-05 `369eed6`, `719417e`; docs `242013d`, `2fded39`, `1c6acc3` | G0/G1/G3 **Owner ký `2026-11-12T04:19Z`**; G4a/G4b/G5 chưa chạy | Xem [EVID-M5-001](M5-EVIDENCE-ENVELOPE.md) — vẫn là tài liệu sống | (còn trong thư mục này) |

## Quyết định và finding cần nhớ

- **Gate của M0–M2 chưa từng được ký chính thức.** Code M1/M2 được dùng làm nền và đã chạy qua G3 của M3–M5, nhưng không có sign-off G1 riêng cho ADR-0008/ADR-0009. Nếu cần chứng nhận lại, mở lại G1 cho hai ADR này.
- **Bằng chứng do agent viết phải được quét định danh.** `F-M5-001` (M4 G3) và `F-M5-002` (M5 G3a R1) đều là báo cáo dẫn hàm/file không tồn tại. Từ M5: mọi báo cáo G3 phải kèm quét backtick → `git grep`/`git ls-tree` trên commit đích.
- **Biến dashboard Cloudflare Pages không tới bước build** (31/10 với `VITE_ALLOW_UNPUBLISHED`, 12/11 với `VITE_REPORT_ISSUE_URL`). Cấu hình build phải nằm trong repo hoặc suy ra từ nhánh.
- **Dữ liệu thật đã thử:** TKB HK I 2026–2027 (1077 lớp) — dry run 31/10, drill G4b 06/11, validation preview 12/11 (nhánh đã xóa, kết quả ở B-07 trong EVID-M5-001). `main` chưa bao giờ chứa dataset thật.
