# Release report — Kỳ Này 0.1.0 (M5 + M6) (app `pending` / dataset `pending`)

> **Artifact ID:** `RELEASE-M5-001`  
> **Artifact status:** `draft` — đã chuẩn bị G4a (version `0.1.0`, preview dữ liệu thật đạt smoke); chưa deploy production, chưa có quyết định G4a/G4b/G5  
> **Canonical gate:** `G4a` + `G4b` (phối hợp, quyết định riêng) → `G5`  
> **Owner:** Release Manager  
> **Last reviewed:** 2026-11-20  
> **Related docs:** [M5 release checklist](M5-RELEASE-CHECKLIST.md), [Operations](../OPERATIONS.md), [M5 spec](M5-SPEC.md), [M5 design handoff](M5-DESIGN-HANDOFF.md), [M6 spec](M6-SPEC.md), [M6 design handoff](M6-DESIGN-HANDOFF.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md), [ADR-0015](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md), [HK I validation guide](M5-OWNER-HK1-VALIDATION-GUIDE.md), [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md), [CHANGELOG](../../CHANGELOG.md), [template](../../.claude/templates/RELEASE_REPORT.md)  
> **Evidence envelope:** `EVID-M5-001` ([M5](M5-EVIDENCE-ENVELOPE.md)) và `EVID-M6-001` ([M6](M6-EVIDENCE-ENVELOPE.md)); report này `N/A — docs-only`

Chỉ ghi giá trị của bước đã thực sự chạy. Từ 2026-11-20 Owner giao cho agent (chat) chạy và ghi các bước agent tự làm được (PR, merge, smoke, kiểm tự động); mỗi giá trị ghi rõ ai chạy. Bước cần đăng nhập Cloudflare (kích hoạt production, nút rollback) và mọi quyết định gate vẫn là của Owner; agent không tự ghi quyết định.

## Release identity and scope

- Release type: `app` trước (G4a, bản `0.1.0`); `dataset` sau (G4b, TKB HK II 2026–2027 chưa được trường công bố — kiểm trang "Thông báo người học" của trường ngày 2026-11-20, chưa có).
- Source PRD/spec/ADR: [SPEC-M5-001](M5-SPEC.md) `g0-approved` và [DESIGN-M5-001](M5-DESIGN-HANDOFF.md) + [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md) `g1-approved` (Owner `2026-11-12T04:19Z`); [SPEC-M6-001](M6-SPEC.md) `g0-approved` (Owner `2026-11-12T14:53Z`); [DESIGN-M6-001](M6-DESIGN-HANDOFF.md) + [ADR-0015](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md) `g1-approved` (Owner `2026-11-12T15:28Z`); [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md) `approved`.
- App commit/build/tag: version `0.1.0` từ PR #28 (`ac94396`); commit release ứng viên `main` `75975c5` (PR #29, chỉ thêm `data/published/** -text` vào `.gitattributes`). Code app giống hệt bản đã ký G2/G3 của M6 (`bd0d087`): từ đó tới `75975c5` chỉ đổi tài liệu, tên bước workflow, 2 ảnh mốc gallery, version, CHANGELOG và `.gitattributes`. Tag `v0.1.0` chỉ đặt sau quyết định G4a `app-released`.
- Dataset/parser/schema/manifest: production chưa có dataset (`data/published/manifest.json` trên `main`: `datasets: []`); parser `uet-xlsx@0.2.0`, domain schema `0.2.0`, manifest schema `1.0`. Dataset HK I `uet-2026-2027-h1-20261112-33843d5f` (`validated`, Owner 2026-11-12) chỉ nằm trên nhánh preview `m6-device-check`, không merge vào `main`.
- Compatibility matrix (app ↔ dataset): M5 và M6 không đổi schema manifest/domain; M6 thêm bản ghi settings giao diện trong IndexedDB và đọc được dữ liệu M5 (ADR-0015, `storage/local-data.test.ts`). Kiểm chứng trên dữ liệu thật: preview `m6-device-check` mục "Deploy/publish evidence".
- Environment/canary cohort: preview `m6-device-check` (dữ liệu HK I, banner "Bản thử") → production `xeptkb-63v.pages.dev` (D-M5-1). Chưa chia beta link.
- Target/previous known-good version: chưa có production deployment trước đó (G4a đầu tiên) → không có rollback target app; diễn tập rollback lần này chỉ xác minh nhãn nút trong dashboard ([checklist §4](M5-RELEASE-CHECKLIST.md)). Dataset rollback target: không có (chưa publish).

## Gate prerequisites

| Gate | Decision | Actor/date | Evidence ID/link | Conditions |
| --- | --- | --- | --- | --- |
| G0 M5 | `g0-approved` | Owner (`2026-11-12T04:19Z`) | [SPEC-M5-001](M5-SPEC.md) | OD-M5-1…5 đã chốt; `RA-M5-001` accepted |
| G1 M5 | `g1-approved` (`security-design-pass` bởi G3b) | Owner (`2026-11-12T04:19Z`) | [DESIGN-M5-001](M5-DESIGN-HANDOFF.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md) | — |
| G2/G3 M5 | G2 `g2-ready-for-verification`; G3a `qa-pass`; G3b `security-pass-with-exception`; G3c `review-pass-with-follow-up` | Owner ký G3 `2026-11-12T04:19Z` | [EVID-M5-001](M5-EVIDENCE-ENVELOPE.md) | `F-M5-001` đóng; `SEC-M3-007` kiểm ở G4a |
| G0/G1 M6 | `g0-approved` / `g1-approved` | Owner (`2026-11-12T14:53Z` / `2026-11-12T15:28Z`) | [SPEC-M6-001](M6-SPEC.md), [DESIGN-M6-001](M6-DESIGN-HANDOFF.md) | — |
| G2/G3 M6 | G2 `g2-ready-for-verification` (`bd0d087`); G3a `qa-pass`; G3b `security-pass`; G3c `review-pass` | Owner (`2026-11-18T10:49Z`) | [EVID-M6-001](M6-EVIDENCE-ENVELOPE.md) | REV-M6-006 hoãn (D-M6-13); kiểm thủ công thiết bị thật trước G4a (DESIGN-M6-001 §12) |
| G4a App | pending — not executed | pending | [checklist §4](M5-RELEASE-CHECKLIST.md) | cần Owner kích hoạt production, smoke `--production`, `SEC-M3-007`, quyết định |
| G4b Dataset | pending — not executed | pending | [checklist §3](M5-RELEASE-CHECKLIST.md) | TKB HK II chưa có |

S0/S1 hoặc P0 coverage thiếu ⇒ `no-go`. S2/S3 exception phải ghi owner, mitigation, expiry và approving actor.

Finding/exception đã biết:

- `F-M5-001` — S2 (process/evidence): **đóng** khi Owner ký G3 của M5 (`2026-11-12T04:19Z`).
- `RA-M5-001` — single reviewer (`--accept-single-reviewer`); owner Release Manager; mitigation và expiry ở [checklist §6](M5-RELEASE-CHECKLIST.md). Trạng thái: **accepted** — Owner `2026-11-12T04:19Z`. Hết hạn "trước G4a public đầu tiên hoặc 2027-01-31" → **cần Owner gia hạn (ghi lý do) khi quyết định G4a**, nếu không G4a là no-go.
- `SEC-M3-007` — kiểm `curl -I` header trên domain production ở G4a. Trạng thái: open (vận hành). Trên preview, smoke đã PASS toàn bộ header (mục dưới).
- `P-14` (checklist §1) — Owner rà lời văn tuyên bố độc lập/quyền riêng tư/Giới thiệu (`apps/web/src/model/about-content.ts`). Trạng thái: open; domain đã chốt (`xeptkb-63v.pages.dev`).
- `OBS-M6-DC-01`, `OBS-M6-DC-02` — S3 giao diện, thấy khi kiểm preview dữ liệu thật ([EVID-M6-001](M6-EVIDENCE-ENVELOPE.md)); owner Frontend, sửa ở `0.1.1`; không chặn G4a.

## Deploy/publish evidence

- Preview dữ liệu thật (agent chạy, 2026-11-20): nhánh `m6-device-check` = `main` (cây giống `75975c5`) + 2 commit dữ liệu HK I (`2e85474`, `0c1a339`); Cloudflare Pages deployment `56f6775a` (check run "Cloudflare Pages" trên `0c1a339`: "Deploy successful"), URL nhánh `https://m6-device-check.xeptkb-63v.pages.dev`.
- Smoke preview: `node scripts/smoke-deploy.mjs https://m6-device-check.xeptkb-63v.pages.dev --expect-commit 0c1a339` → exit `0`, **PASS 17/17** (CSP có `frame-ancestors 'none'` + `connect-src 'self'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS, `Permissions-Policy`, meta `0.1.0+0c1a339`, `/sw.js` và `/data/manifest.json` `no-cache`, 4 icon PNG, 2 artifact HK I khớp bytes + SHA-256).
- Kiểm tự động trên preview (giả lập, không phải thiết bị thật): 50/50 — chi tiết ở [EVID-M6-001](M6-EVIDENCE-ENVELOPE.md).
- CI: PR #28 và PR #29 có `check`, `e2e`, `visual`, Cloudflare Pages đều pass trước khi merge.
- Production deploy ID, smoke `--production`, `SEC-M3-007` `curl -I` trên domain production: `pending — not executed`.
- Two-person dataset approval: không áp dụng cho G4a (không publish dataset).
- Changelog/status message: [CHANGELOG](../../CHANGELOG.md) mục `[0.1.0] - 2026-11-20` (sửa ngày nếu quyết định G4a rơi vào ngày khác).

## Monitoring and rollback

- Canary: không có canary theo traffic (static hosting); preview dữ liệu thật thay cho beta (D-M5-1).
- Monitoring window: 72 h sau G4a `app-released` (Owner chốt 2026-11-12, [OPERATIONS §5.3](../OPERATIONS.md)); người trực: Owner. Không có runtime metrics (ADR-0014). Quan sát: `pending — not executed`.
- Alerts/thresholds: không có alert tự động; trigger thủ công ở [OPERATIONS §5.4](../OPERATIONS.md).
- Rollback trigger: [checklist §7](M5-RELEASE-CHECKLIST.md).
- Rollback target and tested drill evidence: dataset — [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md) (`g4b-drill-pass`, 2026-11-06); app (Pages) — `pending — not executed` (G4a đầu tiên: xác minh nhãn nút, cập nhật OPERATIONS §4.1).
- Incident/communication owner: Release Manager (Owner).

## Decision

- G4a decision: `pending — not executed`
- G4b decision: `pending — not executed`
- G5 status: `pending — not executed`
- Decision actor / UTC timestamp: `pending — not executed`
- Next owner acknowledgement: `pending — not executed`

## Post-release review

- User/data/parser errors observed: `pending — not executed`
- Incidents/findings and severity: `pending — not executed`
- P0/P1 follow-ups: counters/client error reporting (P1, Q-008, cần legal review và ADR mới); status message manifest (P1, M5-C2); hai hiệu ứng DESIGN-M6-001 §11 (D-M6-13).
- S2/S3 follow-ups with owner/due: `OBS-M6-DC-01`, `OBS-M6-DC-02` (Frontend, `0.1.1`); `OBS-M6-01..04` của [SEC-REVIEW-M6-001](M6-G3b-SECURITY-REVIEW.md) (tăng cường, không bắt buộc).
- Docs/fixture/ADR updates: cập nhật nhãn rollback Pages thật vào OPERATIONS §4.1 sau G4a đầu tiên.
- Ownership/continuity handoff: một maintainer; người vận hành thứ hai chưa có (`RA-M5-001`).
- HK I validation (Owner, [guide](M5-OWNER-HK1-VALIDATION-GUIDE.md)): **done 2026-11-12** — nhánh `m5-hk1-validation` (không merge vào `main`): import `c121750`, validate `731c5d7`; dataset `uet-2026-2027-h1-20261112-33843d5f` từ "TKB HKI 2026-2027 SAU ĐKH 04.09.2026" (SHA-256 nguồn `33843d5f…2941`, file để ngoài repo). `test:real` exit 0: 354 môn, 1077 lớp, 1467 buổi, `errors 0`, `unaccounted 0`, 1 lớp hủy bị bỏ. Người nạp: Data Parser (Claude, theo yêu cầu Owner); người duyệt: Owner (`validated` 2026-11-12T10:00Z) sau khi đối chiếu 5 lớp mẫu với file gốc. Preview `m5-hk1-validation.xeptkb-63v.pages.dev`: `smoke-deploy` 17/17 (hash dataset khớp); checklist Playwright tự động 38/38 ở 360/768/1280 px. Chưa publish. Hai commit dữ liệu được dùng lại cho preview `m6-device-check` (2026-11-20).
- Retrospective evidence/link: `pending — not executed`
