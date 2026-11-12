# Changelog

> **Status:** draft — chưa có release nào được tag  
> **Owner:** Release Manager  
> **Last reviewed:** 2026-11-10  
> **Related docs:** [Operations §4.3](docs/OPERATIONS.md), [M5 spec (M5-A)](docs/evidence/M5-SPEC.md), [M5 release checklist](docs/evidence/M5-RELEASE-CHECKLIST.md), [docs index](docs/README.md)  
> **Evidence envelope:** `EVID-M5-001` (tạo ở G2; `N/A — docs-only`)

Mọi thay đổi đáng chú ý với người dùng hoặc người vận hành Kỳ Này được ghi ở đây. Định dạng theo [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/); version theo [Semantic Versioning](https://semver.org/) với tag `vX.Y.Z`.

Quy ước (chi tiết ở [OPERATIONS §4.3](docs/OPERATIONS.md)):

- Mỗi PR có thay đổi nhìn thấy được thêm dòng vào `## [Unreleased]` dưới `Added`/`Changed`/`Fixed`/`Security`/`Removed`.
- Khi Owner quyết định G4a `app-released`, mục `Unreleased` được đổi thành `## [X.Y.Z] - YYYY-MM-DD`; `package.json` `version` = `X.Y.Z` = version hiện ở footer; tag `vX.Y.Z` do Owner tạo sau G4a.
- Không ghi PII, tên file thật, URL preview hay secret.
- Dataset không có mục riêng ở đây; định danh `datasetVersion` được ghi trong release report.

## [Unreleased]

Thay đổi M5 (release hardening) đã merge vào `main` qua PR #3 (`ba43867`, 2026-11-12) theo [SPEC-M5-001](docs/evidence/M5-SPEC.md) / [DESIGN-M5-001](docs/evidence/M5-DESIGN-HANDOFF.md). G0/G1/G3 đã được Owner duyệt ngày 2026-11-12; chưa deploy production. Dòng nào chưa được merge khi release thì phải bỏ khỏi mục version.

### Added

- Build identity: version, commit rút gọn và thời điểm build hiển thị ở footer, trang giới thiệu và văn bản báo lỗi; thẻ `<meta name="ky-nay-build">` cho smoke (M5-A).
- "Báo sai dữ liệu" trên thẻ lớp và trang giới thiệu: dựng văn bản không chứa dữ liệu cá nhân, nút "Sao chép", link tùy chọn tới trang báo lỗi do Owner cấu hình; không gửi gì tự động (M5-B, ADR-0014).
- Trang "Giới thiệu, quyền riêng tư & báo lỗi": tuyên bố công cụ độc lập, nguồn dữ liệu, quyền riêng tư, trình duyệt hỗ trợ, giới hạn đã biết (M5-C).
- Cảnh báo dữ liệu hết hiệu lực (`expiresAt`) và banner tuổi dữ liệu khi offline (M5-D).
- Màn hình phục hồi khi giao diện gặp lỗi: tải lại hoặc xóa dữ liệu trên máy, không gửi báo cáo (M5-E).
- Icon PWA PNG 192/512, maskable 512 và `apple-touch-icon` 180 (M5-G).
- Script smoke sau deploy `scripts/smoke-deploy.mjs` chạy tay (M5-I).
- Tài liệu vận hành M5: release checklist, release report nháp, hướng dẫn Owner kiểm thử bằng TKB HK I (M5-J, M5-K).

### Changed

- Luồng nhập kết quả ĐKMH được tải lười (chunk riêng, prefetch khi rảnh, vẫn có trong precache offline); ngân sách bundle kiểm trong CI (M5-F).
- CI: secret scan, `npm audit --omit=dev --audit-level=high`, base kiểm immutability khi `push` dùng `github.event.before` (M5-H).
- `docs/OPERATIONS.md`: bỏ môi trường staging (preview URL thay thế), quy trình release/rollback Cloudflare Pages, quy ước tag/changelog, monitoring không telemetry (M5-I).

### Security

- Xác nhận không có runtime telemetry trong release đầu: không analytics, counter, gửi lỗi client hay script bên thứ ba; CSP `connect-src 'self'` giữ nguyên (ADR-0014, D-M5-2).

## Lịch sử milestone trước khi có version

Các milestone dưới đây đã merge vào `main` nhưng **không phải release**: không có tag, không có production deploy, không có dataset publish thật. Chỉ ghi để tra cứu; số version đầu tiên sẽ được gán ở G4a.

| Milestone | Commit trên `main` | Ngày | Nội dung chính | Evidence |
| --- | --- | --- | --- | --- |
| M0 + M1 | `22bf934` (vào `main` qua merge M2 `aba04b0`) | 2026-10-20 | Monorepo TypeScript, fixture policy, CI nền; parser deterministic TKB `.xlsx` UET và file kết quả ĐKMH (local) | [EVID M0](docs/evidence/M0-EVIDENCE-ENVELOPE.md), [EVID M1](docs/evidence/M1-EVIDENCE-ENVELOPE.md) |
| M2 | `aba04b0`; fix audit `e41a806`, `4681c63` | 2026-10-25 | Domain engine thuần: tìm kiếm, Plan, conflict theo thứ × tiết × tuần, ngày tuần 1, merge, tín chỉ (schema `0.2.0`) | [EVID M2 v2](docs/evidence/M2-EVIDENCE-ENVELOPE-v2.md), [audit M0–M2](docs/evidence/M0-M2-AUDIT-2026-10-25.md) |
| M3 | `4915a86` (PR #1); drill `3c34c89` | 2026-11-06 | Web app/PWA, artifact loader, IndexedDB, export PNG/Word/ICS, CLI publish dữ liệu (ADR-0012), diễn tập G4b | [EVID-M3-001](docs/evidence/M3-EVIDENCE-ENVELOPE.md), [DRILL-M3-G4b-001](docs/evidence/M3-G4b-DRILL-REPORT.md) |
| M4 | `bac83bf` (PR #2); đóng S3 `c2e93b9`; docs sync `0e849f1` | 2026-11-06 | Nhập kết quả ĐKMH cục bộ, 2 slot Plan nháp/chính thức, huy hiệu override phòng/giờ | [EVID-M4-001](docs/evidence/M4-EVIDENCE-ENVELOPE.md) |
