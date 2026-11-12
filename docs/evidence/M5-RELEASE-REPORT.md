# Release report — Kỳ Này M5 (app `pending` / dataset `pending`)

> **Artifact ID:** `RELEASE-M5-001`  
> **Artifact status:** `draft` — chưa có deploy, publish hay quyết định gate nào; mọi trường thực thi là `pending — not executed`  
> **Canonical gate:** `G4a` + `G4b` (phối hợp, quyết định riêng) → `G5`  
> **Owner:** Release Manager  
> **Last reviewed:** 2026-11-10  
> **Related docs:** [M5 release checklist](M5-RELEASE-CHECKLIST.md), [Operations](../OPERATIONS.md), [M5 spec](M5-SPEC.md), [M5 design handoff](M5-DESIGN-HANDOFF.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md), [HK I validation guide](M5-OWNER-HK1-VALIDATION-GUIDE.md), [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md), [CHANGELOG](../../CHANGELOG.md), [template](../../.claude/templates/RELEASE_REPORT.md)  
> **Evidence envelope:** `EVID-M5-001` (file `M5-EVIDENCE-ENVELOPE.md` tạo ở G2; report này `N/A — docs-only`)

Không điền giá trị nào dưới đây trước khi bước tương ứng thực sự chạy. Agent không được điền deploy ID, run ID, URL, hash hay timestamp; Owner điền sau khi thực hiện và đính kèm evidence.

## Release identity and scope

- Release type: `coordinated` (app M5 + dataset HK II khi có) — đề xuất; có thể tách thành `app` trước, `dataset` sau.
- Source PRD/spec/ADR + versions/hashes: [SPEC-M5-001](M5-SPEC.md) (`draft`, G0 pending), [DESIGN-M5-001](M5-DESIGN-HANDOFF.md) (`draft`, G1 pending), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md) (`proposed`), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md) (`approved`); docs commit `bcce6c6` trên `m5-release-hardening`. Hash file spec/design tại thời điểm G0/G1: `pending — not executed`.
- App commit/build/tag: `pending — not executed` (version đề xuất `0.1.0`, tag `v0.1.0` chỉ sau G4a; `package.json` hiện `0.0.0`).
- Dataset/parser/schema/manifest version + hashes: `pending — not executed` (chưa có TKB HK II 2026–2027; parser `uet-xlsx@0.2.0`, domain schema `0.2.0`, manifest schema `1.0` tại `bcce6c6`; `data/published/manifest.json` trên `main` có `datasets: []`).
- Compatibility matrix (app ↔ dataset): M5 không đổi schema manifest/domain/IndexedDB (DESIGN-M5-001 §8) → app M5 đọc dataset manifest `1.0` / domain `0.2.0`. Kiểm chứng thực tế: `pending — not executed`.
- Environment/canary cohort: preview URL → beta link riêng (tùy chọn) → production (D-M5-1); không staging. Cohort beta: `pending — not executed`.
- Target/previous known-good version: chưa có production deployment trước đó (lần G4a đầu tiên) → rollback target app = `pending — not executed`; dataset rollback target = bản `published` trước của kỳ, hiện không có.

## Gate prerequisites

| Gate | Decision | Actor/date | Evidence ID/link | Conditions |
| --- | --- | --- | --- | --- |
| G0 | `g0-approved` | Owner (`2026-11-12T04:19Z`) | [SPEC-M5-001](M5-SPEC.md) | OD-M5-1…5 đã chốt; `RA-M5-001` accepted |
| G1 | `g1-approved` (`security-design-pass` bởi G3b) | Security Reviewer (`2026-11-11`) / Owner (`2026-11-12T04:19Z`) | [DESIGN-M5-001](M5-DESIGN-HANDOFF.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md), [SEC-REVIEW-M5-001](M5-G3b-SECURITY-REVIEW.md) | OD-M5-5 (lazy-load vs AC-M4-02) đã kiểm chứng; chờ Owner ký |
| G2 | `g2-ready-for-verification` (local tại `5f735fc`) | Orchestrator (`2026-11-11`) | [EVID-M5-001](M5-EVIDENCE-ENVELOPE.md) | GitHub CI run `43153778627` trên `98325ae` (`check` + `e2e` pass) |
| G3a QA | `qa-pass` — Owner ký `2026-11-12T04:19Z` | Tester (`2026-11-11`) | [TEST-M5-001](M5-G3a-QA-REPORT.md) | `19/19` `AC-M5-01..19` & `10/10` AC M4 PASS (`F-M5-001` đóng ở G3a); chờ checklist thiết bị thật trước G4a |
| G3b Security | `security-pass-with-exception` — Owner ký `2026-11-12T04:19Z` | Security Reviewer (`2026-11-11`) | [SEC-REVIEW-M5-001](M5-G3b-SECURITY-REVIEW.md) | `0` S0/S1/S2/S3 code/CI; chờ Owner ký `RA-M5-001` và kiểm `SEC-M3-007` ở G4a |
| G3c Review | `review-pass-with-follow-up` — Owner ký `2026-11-12T04:19Z` | Independent Reviewer (`2026-11-11`) | [REVIEW-M5-001](M5-G3c-INDEPENDENT-REVIEW.md) | `0` S0/S1/S2, `1` S3 (`REV-M5-001`); phần G3c của `F-M5-001` đã đóng |
| G4a App | pending — not executed | pending | [checklist §4](M5-RELEASE-CHECKLIST.md) | không trong vòng M5 này (D-M5-1) |
| G4b Dataset | pending — not executed | pending | [checklist §2–§3](M5-RELEASE-CHECKLIST.md) | HK II chờ file trường; HK I chỉ preview |

S0/S1 hoặc P0 coverage thiếu ⇒ `no-go`. S2/S3 exception phải ghi owner, mitigation, expiry và approving actor.

Finding/exception đã biết:

- `F-M5-001` — S2 (process/evidence), M4 G3a evidence integrity; **chặn G4a** tới khi G3a/G3c M5 kiểm chứng lại. Owner: Tester + Independent Reviewer. Trạng thái: open.
- `RA-M5-001` — single reviewer (`--accept-single-reviewer`); owner Release Manager; mitigation và expiry ở [checklist §6](M5-RELEASE-CHECKLIST.md). Trạng thái: **accepted** — Owner `2026-11-12T04:19Z`.
- `SEC-M3-007` — kiểm `curl -I` header trên domain production ở G4a. Trạng thái: open (vận hành).

## Deploy/publish evidence

- Exact deploy/publish commands + exit codes: `pending — not executed`
- CI/deploy/catalog/canary run IDs and links: `pending — not executed`
- Source/output/manifest hash verification: `pending — not executed`
- Two-person dataset approval (first publish): `pending — not executed` — dự kiến dùng single-reviewer exception `RA-M5-001`; câu lý do ghi trong `data/audit.jsonl` và báo cáo import.
- Changelog/status message: [CHANGELOG](../../CHANGELOG.md) mục `Unreleased` (draft); status message trong manifest là P1 (M5-C2), không có trong release này.
- Smoke production (`node scripts/smoke-deploy.mjs <productionUrl> --production --expect-commit <sha7>`, CLI theo DESIGN-M5-001 §7): `pending — not executed`
- SEC-M3-007 `curl -I` trên domain production: `pending — not executed`

## Monitoring and rollback

- Canary duration/criteria: không có canary theo traffic (static hosting); thay bằng beta link trên preview trước production (D-M5-1). Thời gian/tiêu chí beta: `pending — not executed`.
- Monitoring window and observed metrics: đề xuất 72 h sau G4a ([OPERATIONS §5.3](../OPERATIONS.md), chờ Owner chốt); không có runtime metrics (ADR-0014). Quan sát: `pending — not executed`.
- Alerts/thresholds: không có alert tự động; trigger thủ công ở [OPERATIONS §5.4](../OPERATIONS.md).
- Rollback trigger: [checklist §7](M5-RELEASE-CHECKLIST.md).
- Rollback target and tested drill evidence: dataset — [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md) (`g4b-drill-pass`, 2026-11-06); app (Pages rollback) — `pending — not executed` (diễn tập ở G4a đầu tiên).
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
- P0/P1 follow-ups: counters/client error reporting (P1, Q-008, cần legal review và ADR mới); status message manifest (P1, M5-C2).
- S2/S3 follow-ups with owner/due: `F-M5-001` (Tester + Independent Reviewer, trong M5 G3).
- Docs/fixture/ADR updates: cập nhật nhãn rollback Pages thật vào OPERATIONS §4.1 sau G4a đầu tiên.
- Ownership/continuity handoff: một maintainer; người vận hành thứ hai chưa có (`RA-M5-001`).
- HK I validation (Owner, [guide](M5-OWNER-HK1-VALIDATION-GUIDE.md)): **done 2026-11-12** — nhánh `m5-hk1-validation` (không merge vào `main`): import `c121750`, validate `731c5d7`; dataset `uet-2026-2027-h1-20261112-33843d5f` từ "TKB HKI 2026-2027 SAU ĐKH 04.09.2026" (SHA-256 nguồn `33843d5f…2941`, file để ngoài repo). `test:real` exit 0: 354 môn, 1077 lớp, 1467 buổi, `errors 0`, `unaccounted 0`, 1 lớp hủy bị bỏ. Người nạp: Data Parser (Claude, theo yêu cầu Owner); người duyệt: Owner (`validated` 2026-11-12T10:00Z) sau khi đối chiếu 5 lớp mẫu với file gốc. Preview `m5-hk1-validation.xeptkb-63v.pages.dev`: `smoke-deploy` 17/17 (hash dataset khớp); checklist Playwright tự động 38/38 ở 360/768/1280 px (tìm không dấu 15–35 ms, báo trùng lịch, nhóm TH, lớp không giờ cố định, lưới tuần, ngày tuần 1 K69 = 10/09/2026, xuất .ics/.png/.doc, footer commit, trang Giới thiệu + link Google Forms, axe 0 serious/critical, không tràn ngang, offline reload, 0 request bên thứ ba). Chưa publish.
- Retrospective evidence/link: `pending — not executed`
