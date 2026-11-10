# M5 release checklist — G4b, G4a, G5

> **Artifact ID:** `CHECKLIST-M5-001`  
> **Artifact status:** `draft` — chưa có mục nào được thực hiện; chờ G0 (`SPEC-M5-001`) và G1 (`DESIGN-M5-001`, ADR-0014) được Owner duyệt  
> **Canonical gate:** `G4b` / `G4a` / `G5` (phối hợp, quyết định riêng)  
> **Owner:** Release Manager (Owner đóng vai Product / Tech Lead / Security / Release Manager / Data Reviewer — D-M5-3)  
> **Last reviewed:** 2026-11-10  
> **Related docs:** [Operations](../OPERATIONS.md), [Data ingestion runbook §12](../DATA_INGESTION_RUNBOOK.md), [Agent workflow](../../.claude/AGENT_WORKFLOW.md), [M5 spec](M5-SPEC.md), [M5 design handoff](M5-DESIGN-HANDOFF.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md), [M5 release report (draft)](M5-RELEASE-REPORT.md), [HK I validation guide](M5-OWNER-HK1-VALIDATION-GUIDE.md), [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md), [EVID-M4-001](M4-EVIDENCE-ENVELOPE.md), [CHANGELOG](../../CHANGELOG.md)  
> **Evidence envelope:** `EVID-M5-001` (tạo ở G2; checklist này `N/A — docs-only` cho tới khi Owner chạy từng bước)  
> **Decision actor / UTC timestamp:** pending — Owner  
> **Receiving owner / acknowledgement:** Owner — chưa acknowledge

## 0. Cách dùng

- **[Owner]** = chỉ Owner được làm (đăng nhập dashboard Cloudflare/GitHub, merge vào `main`, bật production, tạo tag, ký quyết định gate, ký risk acceptance). Agent chỉ chuẩn bị lệnh/tài liệu, **không** điền deploy ID, run ID, URL hay timestamp thay Owner.
- **[RM]** = Release Manager chuẩn bị/kiểm tra (trong dự án một người, cũng là Owner).
- Mỗi ô đánh dấu phải kèm evidence (lệnh + exit code, run ID, ảnh chụp không PII, hoặc link) trong [release report](M5-RELEASE-REPORT.md). Không chạy được thì ghi `not-run` + lý do, không đánh dấu.
- Theo D-M5-1, vòng M5 này **không** deploy production và **không** publish dataset production; §2 chỉ dùng preview. §3–§5 dùng khi Owner quyết định release sau.
- Lệnh `dataset`/`test:real` dưới đây đã đối chiếu với `scripts/dataset.mjs`, `scripts/lib/dataset-core.mjs`, `scripts/test-real.mjs` tại `bcce6c6`. Lệnh `smoke-deploy` theo contract [DESIGN-M5-001 §7](M5-DESIGN-HANDOFF.md) (script đang được WP2 triển khai; xác nhận lại sau khi merge).

## 1. Điều kiện tiên quyết chung (trước G4a và trước G4b production)

| # | Điều kiện | Evidence cần có | Ai | Trạng thái |
| --- | --- | --- | --- | --- |
| P-01 | `SPEC-M5-001` `g0-approved` (gồm OD-M5-1..5 đã quyết hoặc ghi rõ hoãn) | actor + UTC timestamp trong spec | [Owner] | pending |
| P-02 | `DESIGN-M5-001` + ADR-0014 `g1-approved`, gồm OD-M5-5 (lazy-load vs AC-M4-02) | actor + UTC timestamp | [Owner] | pending |
| P-03 | G2: `EVID-M5-001` có commit bất biến, `npm run check`, `npm run test:e2e`, `npm run verify:bundle`, secret scan, `npm audit --omit=dev --audit-level=high` exit `0`, CI run ID thật | run ID + exit code | Coder/Platform | pending |
| P-04 | G3a `qa-pass`: `AC-M5-01..19` có evidence pass | test report M5 | Tester | pending |
| P-05 | `F-M5-001` (S2, M4 G3a evidence integrity) **đóng**: G3a chạy lại `AC-M4-01..08`, `AC-04`, `AC-05` với định danh grep được trên commit G2 M5; G3c xác nhận phần M4 bị ảnh hưởng | báo cáo G3a/G3c M5 | Tester + Independent Reviewer | open — **chặn G4a** |
| P-06 | G3b `security-approved` cho M5-B, M5-E, M5-H, AC-M5-18, `RA-M5-001` | security review M5 | Security Reviewer | pending |
| P-07 | G3c `review-approved` | review report M5 | Independent Reviewer | pending |
| P-08 | Không S0/S1 mở; mọi S2/S3 còn lại có owner, mitigation, due/expiry và được Release Manager chấp thuận | sổ finding trong `EVID-M5-001` | [RM] | pending |
| P-09 | `RA-M5-001` (single reviewer) được Owner ký và **chưa hết hạn** (hết hạn trước G4a public đầu tiên hoặc `2027-01-31`, tùy mốc nào đến trước) — xem §6 | chữ ký + ngày trong spec/report | [Owner] | pending |
| P-10 | Kiểm thủ công Tier 1 trên thiết bị thật: Chrome Android, Safari iOS (2 bản gần nhất), Chrome/Edge desktop — tìm/chọn lớp, conflict, lịch tuần, nhập ĐKMH cục bộ, export PNG/Word/ICS xem bằng mắt, cài PWA (icon), offline | checklist G3a + ảnh không PII | Tester/[Owner] | pending |
| P-11 | Smoke Tier 2: Firefox desktop, Samsung Internet, in-app browser (Facebook/Messenger/Zalo) có nudge "Mở bằng trình duyệt" | checklist G3a | Tester/[Owner] | pending |
| P-12 | Trình đọc màn hình: TalkBack (Android) hoặc VoiceOver (iOS/macOS) đi qua tìm lớp, chọn lớp, báo lỗi, trang giới thiệu, màn hình lỗi | ghi chú G3a | Tester/[Owner] | pending |
| P-13 | Owner hoàn tất HK I validation ([guide](M5-OWNER-HK1-VALIDATION-GUIDE.md)): `test:real` exit `0`, checklist preview đạt, `main` vẫn `datasets: []` | ghi chú trong release report §Post-release | [Owner] | pending |
| P-14 | Wording disclaimer/privacy/Giới thiệu đã rà soát (OD-M5-3, PRD §11) và domain production đã chốt (OD-M5-2, D-001) | decision record | [Owner] | open |
| P-15 | Ngân sách bundle được Owner duyệt (OD-M5-4) và `scripts/bundle-budget.json` đã freeze | PR + CI pass | [Owner] | pending |
| P-16 | Monitoring window đã chốt (đề xuất 72 h, [OPERATIONS §5.3](../OPERATIONS.md)) và người trực trong window đã xác định | decision record | [Owner] | open |

## 2. G4b-HK1 — beta trên preview bằng TKB HK I (tùy chọn, không production)

Mục đích: thử bản M5 bằng dữ liệu thật (D-M5-1) và, nếu Owner muốn, chia link không công khai cho nhóm nhỏ. **Không** merge vào `main`, **không** production. Lệnh đầy đủ: [HK I validation guide](M5-OWNER-HK1-VALIDATION-GUIDE.md).

- [ ] [Owner] P-03 đạt (bản build thử là commit G2 M5); nếu thử sớm hơn, ghi rõ commit và các mục M5 chưa có.
- [ ] [Owner] Tạo nhánh `m5-hk1-validation` từ `m5-release-hardening`; ghi `sha7` gốc.
- [ ] [Owner] `test:real` exit `0` (`unaccounted 0`, format `reviewed`); exit `2` → dừng, không dùng `--accept-new-format` khi chưa review bộ cột.
- [ ] [Owner] `dataset import` với `--term 2026-2027-h1`, `--start "K67,K68,K69,K70=2026-09-07"`, `--start "K71=2026-10-12"`, `--weeks 15` → entry `candidate`; đọc `data/reports/<version>.md`.
- [ ] [Owner] Commit `data/` **chỉ trên nhánh này**, push → preview build thành công trong dashboard Pages.
- [ ] [Owner] Smoke preview (không `--production`) với `--expect-commit <sha7 của commit đã push>` → PASS (khi script đã có).
- [ ] [Owner] Checklist điện thoại/desktop trong guide §7 đạt; banner "chưa được công bố" hiện khi dataset chưa `published`.
- [ ] [Owner] `validate` với `--accept-single-reviewer "<lý do>"`; tùy chọn `publish` với `--accept-single-reviewer` để diễn tập; `status` + `check` OK.
- [ ] [Owner] Nếu chia beta link: chỉ gửi riêng, ghi rõ là bản thử, kèm hướng dẫn "Báo sai dữ liệu"; ghi số người/khoảng thời gian (không tên) vào report.
- [ ] [Owner] Dọn dẹp theo guide §11; xác nhận `git show main:data/published/manifest.json` vẫn `"datasets": []`.

Go: mọi ô trên đạt. No-go: `test:real` ≠ 0, lỗi hiển thị dữ liệu sai so với file nguồn, bất kỳ request tới origin khác trong DevTools, PII xuất hiện ở đâu đó ngoài máy người dùng.

## 3. G4b-HK2 — publish TKB HK II 2026–2027 (khi trường phát file)

Điều kiện vào: §1 P-08, P-09 đạt; G4a đã `app-released` **hoặc** được phối hợp cùng G4a (production chỉ hiện dữ liệu sau khi `main` được deploy production).

- [ ] [Owner] File nguồn chính thức tải từ kênh của trường, lưu **ngoài repo**; đặt tên file không chứa thông tin cá nhân (tên file được ghi vào báo cáo import).
- [ ] [Owner] Xác nhận ngày thứ Hai tuần 1 từng khóa theo lịch năm học HK II (fixture D-011 dùng 15/02/2027 — **phải đối chiếu lịch thật**, không mặc định); xác nhận số tuần học.
- [ ] [Owner] Tạo nhánh dữ liệu (ví dụ `data-2026-2027-h2`) từ `main`.
- [ ] [Owner] `npm run test:real -- "<file.xlsx>" --term 2026-2027-h2` → exit `0`.
- [ ] [Owner] `npm run dataset -- import "<file.xlsx>" --term 2026-2027-h2 --term-name "Học kỳ II năm học 2026–2027" --source-type official-timetable --document-ref "<tên thông báo, không PII>" --published-by "<đơn vị phát hành>" --actor "<người nạp>" --weeks <số tuần> --start "<khóa>=<thứ Hai tuần 1>"` (lặp `--start` cho mỗi nhóm khóa).
- [ ] [Owner] Commit + push nhánh → preview; smoke preview PASS; đọc báo cáo import (warnings, cột `info`, ghi chú "tuần", diff).
- [ ] [Owner] Review preview trên điện thoại Tier 1 theo checklist trong báo cáo import.
- [ ] [Owner] `npm run dataset -- validate <version> --reviewer "<người duyệt>" --accept-single-reviewer "<lý do, RA-M5-001>"` (bỏ cờ nếu có người duyệt thứ hai khác người nạp).
- [ ] [Owner] `npm run dataset -- publish <version> --by "<Release Manager>" --accept-single-reviewer "<lý do, RA-M5-001>"`.
- [ ] [Owner] `npm run dataset -- status` và `npm run dataset -- check` OK; commit + push; PR vào `main`, CI xanh, merge.
- [ ] [Owner] Production deploy (bước kích hoạt production deployment ở §4) → `node scripts/smoke-deploy.mjs <productionUrl> --production --expect-commit <sha7>` PASS (artifact hash khớp).
- [ ] [RM] Ghi `datasetVersion`, source SHA-256, artifact hash, rollback target (bản `published` trước đó của kỳ hoặc "không có") vào release report.

Go: tất cả ô đạt, không S0/S1. No-go: `test:real` ≠ 0; định dạng mới chưa review; diff có thay đổi không giải thích được; smoke FAIL; reviewer chưa xem preview.

Rollback: `npm run dataset -- retract <version> --by "<RM>" --reason "<lý do>"` → commit/push → deploy; khôi phục bằng `restore` + `publish` ([OPERATIONS §4.2](../OPERATIONS.md)).

## 4. G4a — app release (production)

Điều kiện vào: toàn bộ §1 đạt (đặc biệt P-05 `F-M5-001` đóng, P-09, P-14).

- [ ] [RM] Freeze scope; danh sách commit trong release; mọi PR đã cập nhật `CHANGELOG.md`.
- [ ] [Owner] Chốt version (đề xuất đầu tiên `0.1.0`); PR đổi `## [Unreleased]` → `## [0.1.0] - YYYY-MM-DD` và `package.json` `version`; CI xanh.
- [ ] [Owner] Preview của commit release: smoke (không `--production`) PASS; footer hiện đúng version + `sha7`.
- [ ] [Owner] Tùy chọn beta link: chia URL preview cho nhóm nhỏ, theo dõi ≥ 24 h, không có S0/S1.
- [ ] [Owner] Merge vào `main`; xác nhận CI run ID trên `main`.
- [ ] [Owner] Trong dashboard Pages: kích hoạt production deployment cho commit `main` đó (automatic production deployments đang tắt). Ghi deployment ID thật.
- [ ] [Owner] Gắn custom domain nếu đã chốt (OD-M5-2); nếu chưa, ghi rõ production đang ở `*.pages.dev`.
- [ ] [Owner] `node scripts/smoke-deploy.mjs <productionUrl> --production --expect-commit <sha7>` → PASS.
- [ ] [Owner] **SEC-M3-007:** `curl -sI https://<domain>/` (bash) hoặc `curl.exe -sI https://<domain>/` (PowerShell) — đủ CSP + `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`; `curl -sI https://<domain>/sw.js` và `/data/manifest.json` có `Cache-Control: no-cache`.
- [ ] [Owner] Kiểm thủ công Tier 1 trên production: mở lần đầu, chọn lớp, offline, nhập ĐKMH cục bộ, export; DevTools desktop: chỉ request same-origin.
- [ ] [Owner] **Diễn tập rollback app** lần đầu: xác định production deployment trước đó làm rollback target; xác minh nhãn nút rollback thật trong dashboard và cập nhật [OPERATIONS §4.1](../OPERATIONS.md) (chỉ cần thực hiện rollback thật nếu có deployment trước đó an toàn để thử).
- [ ] [Owner] Quyết định `app-released` / `app-no-go` với UTC timestamp.
- [ ] [Owner] Nếu `app-released`: `git tag -a v0.1.0 -m "Kỳ Này v0.1.0" <sha>` rồi `git push origin v0.1.0`.
- [ ] [RM] Bắt đầu monitoring window (§5); điền release report.

Go: §1 đạt; smoke + `curl -I` PASS; Tier 1 production pass; dataset tương thích (schema manifest `1.0`, domain `0.2.0`) hoặc chưa có dataset và UI "chưa có dữ liệu" đúng. No-go: bất kỳ S0/S1, `F-M5-001` còn mở, `RA-M5-001` hết hạn không gia hạn, smoke/header FAIL, request tới origin khác.

## 5. G5 — post-release

- [ ] [RM] Monitoring window (đề xuất 72 h) kết thúc; mỗi ngày đã: xem trạng thái deploy, đọc báo lỗi người dùng, chạy lại smoke khi có deploy mới.
- [ ] [RM] Phân loại mọi báo lỗi theo S0–S3; S0/S1 → incident + rollback; S2/S3 → finding có owner/due.
- [ ] [RM] Cập nhật docs (OPERATIONS nhãn rollback thật, runbook, known limitations), fixture synthetic cho lỗi parser.
- [ ] [Owner] Rà `RA-M5-001`: còn hạn? cần người duyệt thứ hai hay decision gia hạn?
- [ ] [RM] Retrospective ngắn + trạng thái continuity/handoff ([OPERATIONS §9](../OPERATIONS.md)).
- [ ] [Owner] Quyết định `closed` / `follow-up-open` với UTC timestamp.

## 6. Risk acceptance `RA-M5-001`

| Trường | Giá trị |
| --- | --- |
| Rủi ro | Dataset sai lọt publish khi người nạp = người duyệt (lệch SECURITY §6 / ADR-0012 §4 two-person rule) |
| Owner | Release Manager |
| Mitigation | review preview trên điện thoại; đọc diff/báo cáo import trước `publish`; `retract`/`restore` đã diễn tập (DRILL-M3-G4b-001); `--accept-single-reviewer "<lý do>"` ghi vào audit + báo cáo |
| Expiry | trước G4a public đầu tiên hoặc `2027-01-31`, tùy mốc nào đến trước; sau đó cần người duyệt thứ hai hoặc decision gia hạn mới |
| Trạng thái | đề xuất — chờ Owner ký ở G0 |

## 7. Rollback trigger (tóm tắt)

| Trigger | Hành động | Owner |
| --- | --- | --- |
| S0 (PII/secret lộ, deploy độc hại, sai TKB diện rộng) | rollback app/dataset ngay, incident, Security | [Owner] |
| S1 (core không dùng được, integrity dữ liệu fail, publish/rollback hỏng) | rollback ngay | [Owner] |
| Smoke production FAIL (header, commit, hash) | rollback app (Pages) hoặc `retract` dataset | [Owner] |
| Chunk nhập ĐKMH không dùng được offline sau khi SW cài | rollback app | [Owner] |
| Báo sai dữ liệu xác nhận do parser, ảnh hưởng nhiều lớp | `retract` dataset, finding + fixture | [Owner] |
| Request tới origin khác hoặc dữ liệu cá nhân rời máy người dùng | rollback app, S0 incident | [Owner] |

Cách rollback: [OPERATIONS §4](../OPERATIONS.md).
