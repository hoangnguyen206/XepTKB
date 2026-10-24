# ADR-0007 — MVP dùng static artifact + CLI admin; Supabase/backend deferred post-MVP

> **Artifact ID:** `ADR-0007`
> **Artifact status:** `approved`
> **Canonical gate:** `G1`
> **Date:** 2026-10-20
> **Owner:** Tech Lead
> **Decision owner:** Product
> **Last reviewed:** 2026-10-20
> **Related docs:** [Tech stack §1](../TECH_STACK.md), [API contracts §1/§4](../API_AND_DATA_CONTRACTS.md), [Architecture §3](../ARCHITECTURE.md), [Data ingestion runbook](../DATA_INGESTION_RUNBOOK.md), [Implementation plan §10 Q-003/Q-004](../IMPLEMENTATION_PLAN.md)
> **Evidence envelope:** `N/A — docs-only`

## Source and context

- Q-003: backend control plane — Supabase hay static-only + CLI admin?
- Q-004: admin ingest có cho phép upload file nguồn lên hệ thống không?
- Cut line §7.3 đã cho phép “Admin UI đẹp (dùng CLI/manual runbook nhưng vẫn audit/validation)”.
- MVP scope: không account/sync; share link P1 là client-side URL encoding.

## Decision

1. **MVP release không có backend control plane.** Dataset publishing pipeline chạy **local/CLI** trên máy admin được uỷ quyền: ingest → validate → diff → review (two-person sign-off trong checklist) → build immutable artifact → push lên CDN (R2/Cloudflare) → cập nhật `manifest.json` atomically.
2. **Không upload raw source file** lên bất kỳ hệ thống nào trong MVP. Source file chỉ nằm trong secure local store của admin; manifest chỉ chứa hash + ref ID.
3. **Share link P1** (nếu được triển trước backend) dùng URL-encoded fragment (`#p=<base64url(SharedPlanDto)>`), không qua server, không persistence server-side.
4. **Supabase/control API** (`/api/v1/*` trong [API contracts](../API_AND_DATA_CONTRACTS.md)) là **target contract sau MVP**, chỉ implement khi có feature cần (account, sync, share persistence, admin UI web). Tất cả row trong bảng control API được đánh dấu `post-MVP` hoặc `MVP = CLI/manual`.
5. **Admin authentication** trong MVP = CLI key/access trên máy admin + CDN write credentials trong secret store. Không có user-facing admin login.

## Scope and non-goals

- In scope: local ingest pipeline, CLI publish/retract, CDN artifact + manifest, URL-encoded share codec, audit log local.
- Not in scope: web admin UI, server-side share persistence, RLS/Postgres, user authentication, external proxy.

## Options considered

| Option | Pros | Cons | Why not/why chosen |
| --- | --- | --- | --- |
| Supabase từ đầu | RBAC server-side, audit DB, share persistence | thêm auth/RLS boundary phải review G1+G3b; tăng scope MVP; giới hạn ai có thể publish | không chọn — tăng trust boundary trước khi cần |
| Static + CLI admin (chọn) | không mở boundary mới; deploy đơn giản; rất ít failure mode | CLI kém UX; hai người approve phải coordinate thủ công; không audit DB | **chosen** — đủ cho mùa đầu, giữ cut line §7.3 |
| Serverless admin API nhỏ (Edge function publish) | cân bằng | vẫn mở auth boundary cho admin | không chọn MVP |

## Consequences

### Positive

- Không PII/vendor/auth boundary mới trong G1/G3b cho MVP → giảm security review scope.
- Publish/retract có audit trail local (log + git tag + manifest version).
- App client không phụ thuộc backend uptime → offline vẫn hoạt động đầy đủ.

### Negative / risks

- Two-person first-publish phải thực hiện bằng **manual checklist + sign-off log** (không enforced bằng RBAC) — cần release runbook chặt.
- CLI key trên máy admin là single point of failure nếu mất — cần 2 admin và credential backup.
- Không audit DB — incident investigation dựa vào git history + CDN audit logs + local ingest report.

### Privacy/security

- Data crossing boundaries: **không mở boundary mới** — không PII lên server, không raw source upload.
- Threat/control:
  - CLI credential = secret, giữ trong secret manager/OS keychain;
  - two-person publish là process control, không technical enforcement — bù bằng audit log + Release Manager accountable;
  - share URL fragment không được log (client-side only, không qua CDN logs vì fragment không gửi HTTP).
- Security review required: đã rà ở G1; G3b verify `no-network` cho local pipeline.

### Operations/migration

- Rollout: M5 implement CLI + runbook drill; G4b publish đầu tiên two-person manual sign-off.
- Compatibility: static manifest contract giữ nguyên — client chỉ đọc `/manifest.json` + artifacts, không quan tâm publisher là CLI hay API.
- Migration trigger: khi Product approve account/sync/share-persistence → tạo ADR mới bật Supabase + RLS; `POST /api/v1/admin/imports/*` implement lúc đó.
- Rollback: giữ artifact cũ + manifest pointer trước; CLI retract = repoint manifest về version trước.
- Owner: Release Manager (publish); Data Parser (CLI producer); Tech Lead (adapter/tooling).

## Reproducible evidence and acceptance

- Spike/test: `N/A — docs-only`. M5 G4b drill sẽ tạo evidence.
- Acceptance:
  - CLI `publish` tạo manifest + artifact hash đúng schema;
  - `manifest.json` có `status=published`, `publishedAt`, `reviewedAt`, `parserVersion`, `source.documentRef` không PII;
  - rollback drill: `retract` repoint manifest về version trước <5 phút;
  - không request HTTP nào chứa raw source bytes trong pipeline.
- Known limitations: không audit DB; two-person publish là process, không technical enforcement.

## Approval and risk acceptance

- Decision: `accepted` — Product chốt 20/10/2026 qua Q-003 + Q-004.
- Accepted by: Product Owner.
- Risk exception: `none`.

## Follow-up and history

| Action | Owner | Due/trigger | Status |
| --- | --- | --- | --- |
| Viết CLI publish/retract + manifest builder | Coder/Data Parser | M5 | open |
| Runbook drill: ingest → publish → rollback với 2 admin | Release Manager | M5 G4b | open |
| Re-evaluate Supabase khi share/sync vào scope | Product + Tech Lead | post-MVP | open |

| Change ID | Date/actor | Reason | Supersedes |
| --- | --- | --- | --- |
| ADR-0007 | 2026-10-20 / Product | Q-003/Q-004: static artifact + CLI admin | ADR-0004 (Supabase deferred) |
