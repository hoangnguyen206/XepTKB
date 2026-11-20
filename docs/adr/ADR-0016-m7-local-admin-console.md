# ADR-0016 — Trang quản trị chạy trên máy (localhost) bọc CLI dataset; vẫn không có admin trên Internet

> **Artifact ID:** `ADR-0016`  
> **Artifact status:** `proposed` — chờ Owner ký G1 (cùng `DESIGN-M7-001`)  
> **Canonical gate:** `G1`  
> **Date:** 2026-11-20  
> **Owner:** Tech Lead + Platform  
> **Decision owner:** Owner (Product + Tech Lead); Security Reviewer được tham vấn ở G3b  
> **Last reviewed:** 2026-11-20  
> **Related docs:** [SPEC-M7-001](../evidence/M7-SPEC.md), [DESIGN-M7-001](../evidence/M7-DESIGN-HANDOFF.md), [ADR-0007](ADR-0007-static-artifact-cli-admin.md), [ADR-0012](ADR-0012-dataset-publish-pipeline.md), [Security & privacy](../SECURITY_PRIVACY.md), [Runbook §12](../DATA_INGESTION_RUNBOOK.md)  
> **Evidence envelope:** `EVID-M7-001` — `N/A — docs-only`  
> **Supersedes:** none. Bổ sung ADR-0007 (không thay): admin vẫn cục bộ, chỉ thêm giao diện.

## Source and context

- **Nguồn:** `SPEC-M7-001` — Owner muốn quản lý dữ liệu và web bằng giao diện trực quan thay vì gõ lệnh, và chọn (2026-11-20) cho admin chạy trên máy mình.
- **Hiện trạng:** ADR-0007 chốt static artifact + admin bằng CLI cục bộ, không backend; PRD §4 ghi "không có trang admin web trong release đầu". Pipeline ADR-0012 (CLI `scripts/dataset.mjs`) đã có đủ import/validate/publish/retract/restore/check và đã diễn tập (DRILL-M3-G4b-001).
- **Ràng buộc:** không backend công khai, không secret phía server, không dependency mới, production chỉ có dữ liệu `published`, audit và luật vòng đời giữ nguyên, file gốc không vào repo.

## Options considered

1. **Giữ CLI, chỉ viết thêm hướng dẫn.** Không tốn công, nhưng không đáp ứng yêu cầu "dễ dàng và trực quan".
2. **Trang quản trị chạy trên máy (localhost) gọi đúng CLI.** Giao diện cho mọi bước; không có gì mới trên Internet; dùng `git`/`gh` sẵn có của Owner để đưa lên qua PR + CI. Nhược điểm: chỉ dùng được trên máy tính có repo.
3. **Trang admin online** (Cloudflare Workers + Cloudflare Access + token GitHub). Dùng ở mọi nơi, nhưng thêm backend, secret, đăng nhập, bề mặt tấn công đầu độc dữ liệu công khai; phải thay ADR-0007 và đổi threat model.

## Decision

Chọn **phương án 2**:

1. `npm run admin` khởi động server `node:http` chỉ nghe `127.0.0.1`, bảo vệ bằng mã phiên ngẫu nhiên + kiểm `Host`/`Origin`; giao diện là trang tĩnh của chính server (HTML + JS module, không build, không dependency mới), CSP chặt (`DESIGN-M7-001` §5).
2. Mọi thay đổi dữ liệu đi qua **đúng CLI** `scripts/dataset.mjs` (không viết lại logic), trong một git worktree riêng ngoài repo; luật vòng đời, audit, báo cáo nạp và kiểm tra bất biến giữ nguyên.
3. Đưa lên web chỉ qua **nhánh dữ liệu → PR → CI xanh → merge thường**; không force-push, không push thẳng `main`; sau deploy chạy smoke production.
4. Không có trang admin trên Internet, không lưu token/secret; admin dùng phiên `gh` có sẵn của Owner và không đọc token đó.
5. Không gọi API Cloudflare; rollback app vẫn làm trong dashboard (OPERATIONS §4.1).
6. Mở rộng sau (admin online, nhiều người duyệt) cần ADR mới thay ADR-0007.

## Consequences

- PRD §4 điểm 1 đổi câu chữ (SPEC-M7-001 §1); FR-12 có thêm giao diện, không đổi priority.
- SECURITY_PRIVACY: thêm mục "admin cục bộ" (bind localhost, mã phiên, upload, spawn) — ghi khi G3b chạy.
- Runbook §12 thêm cách làm bằng admin; CLI vẫn là đường dự phòng và là nguồn sự thật của luật.
- Web app không đổi: bundle, CSP, IndexedDB, e2e privacy.

## Security/privacy impact

- Bề mặt mới chỉ trên máy Owner: một cổng localhost nhận file `.xlsx` công khai của trường và chạy `git`/`gh`/`node`. Kiểm soát ở `DESIGN-M7-001` §5; G3b bắt buộc.
- Không dữ liệu cá nhân: admin không đọc file ĐKMH của sinh viên; file TKB là văn bản công khai; tên người vận hành nằm trong audit như CLI hiện nay.

## Validation and rollback

- Kiểm: `DESIGN-M7-001` §7 (node:test bảo mật + luồng với CLI thật trên thư mục tạm, Playwright giao diện, `verify:bundle`).
- Rollback: ngừng dùng admin, quay lại CLI; không có thay đổi nào trên production cần gỡ.

## Approval

- Decision: `proposed` — chờ Owner ký G1.
