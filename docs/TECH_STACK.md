# Tech stack và tiêu chuẩn kỹ thuật

> **Status:** proposed  
> **Owner:** Tech Lead  
> **Last reviewed:** 2026-10-25
> **Related docs:** [Architecture](ARCHITECTURE.md), [Domain model](DOMAIN_MODEL.md), [Security & privacy](SECURITY_PRIVACY.md)

## 1. Quyết định stack đề xuất cho MVP

| Layer | Lựa chọn | Lý do / boundary |
| --- | --- | --- |
| Language | TypeScript, strict mode | Chia sẻ type giữa parser/domain/UI; giảm lỗi field/mã dữ liệu |
| Web app | React + Vite | SPA/PWA nhẹ, parser chạy trong browser, không cần SSR cho MVP |
| UI | Tailwind CSS + component primitives nội bộ | mobile-first, responsive tokens, không khóa vào design vendor. **M3 thực tế:** CSS thuần với custom properties (ADR-0010 §1) |
| PWA | `vite-plugin-pwa` + Workbox | precache app shell, runtime cache dataset có version, offline Plan. **M3 thực tế:** service worker tự viết + plugin Vite nhỏ sinh danh sách precache; dataset nằm trong IndexedDB (ADR-0010 §4); hardening ở M5 |
| Local storage | IndexedDB qua Dexie | lưu Plan, user overrides, parser index; dễ version/migrate. **M3 thực tế:** wrapper IndexedDB tự viết + envelope `schemaVersion`/migration (ADR-0010 §3) |
| Static data | JSON artifacts trên Cloudflare CDN/R2 | tải nhanh, immutable version/hash, không chứa PII |
| Parser | `fflate` + `@xmldom/xmldom` for bounded local OOXML/HTML parsing in M1; M2 domain engine is pure TypeScript with no parser/network dependency; browser `DOMParser`/future reviewed adapter as appropriate; pdf.js (P1/P2) | deterministic local parser/domain boundary; no formula/external-link execution; dependency audit and browser spike required before production |
| Export | `.doc` HTML-based (Word), browser Canvas (PNG; M3 vẽ trực tiếp, không dùng html-to-image), tự tạo RFC 5545 `.ics` (package `@ky-nay/export`); **không** PDF generator — “In / Lưu PDF” = print CSS A4 ngang | không cần server; ICS là ưu tiên tương thích iPhone |
| Backend optional | Supabase Postgres + Auth + Edge Functions | **deferred post-MVP**: Q-003/Q-004 chọn static artifact + CLI admin; share P1 dùng client-side URL encoding; Supabase chỉ quay lại nếu account/sync được approve |
| Hosting | Cloudflare Pages + versioned static artifact CDN/R2 cho web và dataset | MVP không có Supabase control plane; vendor/data-region/legal review vẫn là gate mở |
| Observability | privacy-safe aggregate counters và scrubbed client errors theo policy; vendor cụ thể deferred | không GA/tracker bên thứ ba; cookieless, no user ID/IP, privacy notice + opt-out; legal review trước per-user |
| Tests | Vitest, Testing Library, Playwright, axe, fast-check | unit/domain, UI/accessibility, browser/offline/property. **M3 thực tế:** package dùng `node:test`; web dùng Vitest + Testing Library + jsdom + fake-indexeddb; e2e Playwright + `@axe-core/playwright`; fast-check chưa dùng |

- **M1/M2 status:** offline parser and pure domain packages plus synthetic fixtures are implemented and locally verified; M2 search/Plan/conflict/week-date/registration-merge/credits are package-level only.
- **M3 status (2026-10-25):** React 19 + Vite 8 app (`apps/web`), artifact loader, IndexedDB, service worker and ICS/PNG/Word/print export are implemented with the dependency set and deviations recorded in [ADR-0010](adr/ADR-0010-m3-web-app-artifact-storage-export.md); the change set is committed as `82cb85b` on branch `m3-web-app` (draft PR #1, CI green on 2026-10-29, not merged into `main`) and **not through G3** (see [EVID-M3-001](evidence/M3-EVIDENCE-ENVELOPE.md)). Dev tooling needs Node ≥ 22.22.2. The publish path, hosting headers and PWA hardening remain M5.

## 2. Boundary client/server

### Browser/client được phép

- tải static dataset đã duyệt;
- đọc `.xlsx` do admin chọn trong admin flow hoặc `.doc` registration do user chọn;
- normalize/search/conflict/merge/export;
- lưu Plan và file-derived data trong IndexedDB;
- gọi backend cho các API không chứa raw file/PII khi feature đã opt-in.

### Backend/edge bắt buộc

- giữ secret/API key, webhook, auth session và rate limit;
- xử lý admin ingest nếu file nguồn được phép đưa lên hệ thống;
- build/publish artifact versioned sau review;
- proxy dịch vụ bên ngoài (ví dụ dhqg.xyz) nếu có thỏa thuận;
- lưu share/sync data đã consent, theo retention/deletion policy.

**Không được:** browser gọi thẳng dịch vụ ngoài có secret; upload registration result raw; lưu mã sinh viên/ngày sinh chỉ để tiện debug.

## 3. Cấu trúc package dự kiến khi bắt đầu code

```text
apps/web/                 # React/Vite app
packages/domain/          # types, normalization, conflict, week/date
packages/parser/          # adapters and deterministic parser pipeline
packages/export/          # ICS/DOCX/image
packages/config/          # school/time-frame/synonyms
packages/test-fixtures/   # redacted/synthetic fixture metadata only
infra/                    # deployment/config-as-code, no secrets
scripts/                  # validation, artifact build, link/check helpers
```

Nếu bắt đầu bằng một app duy nhất, vẫn giữ module boundaries tương tự để tách sau mà không đổi domain contract.

## 4. Version và dependency policy

- Pin major/minor ở lockfile; cập nhật dependency qua PR có changelog và test.
- Security update ưu tiên trong 7 ngày nếu có exploit ảnh hưởng runtime; critical hotfix ngay theo incident procedure.
- Không đưa package đọc file vào bundle nếu không cần: lazy-load parser/export.
- Không dùng package không rõ nguồn cho parsing PII hoặc crypto.
- Mọi dependency mới phải ghi: purpose, bundle impact, license, data access, alternative considered.
- Build reproducible từ lockfile; CI không gọi network ngoài package registry được phê duyệt.

## 5. Data artifact contract

Dataset công khai gồm:

```text
/manifest.json
/schools/uet/terms/<term>/<version>/timetable.json
/schools/uet/terms/<term>/<version>/exams.json       # nếu có
/schools/uet/terms/<term>/<version>/metadata.json
```

`manifest.json` nêu `schemaVersion`, `datasetVersion`, `sha256`, `sourceRef`, `parserVersion`, `publishedAt`, `reviewedAt`, `status` (`candidate|validated|published|retracted`) và `expiresAt` nếu có. Trạng thái `hold/rejected` chỉ tồn tại trong control/import record, không được đưa thành public catalog. Tên file content-addressed hoặc immutable; không overwrite version đã publish.

## 6. Environment

| Environment | Dữ liệu | Mục đích |
| --- | --- | --- |
| Local | synthetic/redacted | dev, parser, UI |
| Preview | synthetic + approved candidate | review PR, e2e |
| Staging | approved non-PII artifacts | rehearsal ingest/deploy/rollback |
| Production | published artifacts, minimal control data | user-facing |

Secret chỉ trong secret manager/CI environment; `.env.example` chỉ có tên biến và giá trị giả. Không commit `.env`.

## 7. Spike trước khi khóa production

1. PWA cache update/rollback với dataset version lớn.
2. Browser parse `.doc` HTML trên Chrome/Firefox/Safari mobile.
3. ICS recurring/individual events với tuần lẻ và timezone Việt Nam.
4. Supabase RLS + admin RBAC + data-region/legal review.
5. Bundle size và parse performance trên thiết bị Android tầm trung.
6. Export DOCX/PNG ở 360px và desktop.

Mỗi spike trả `decision`, `evidence`, `known limits`, `follow-up ADR`; không kéo spike vào critical path nếu core local flow đã chạy.

## 8. ADR index

| ID | Chủ đề | Trạng thái |
| --- | --- | --- |
| ADR-0001 | TypeScript monorepo + React/Vite/PWA baseline | ready; G1 approval pending |
| ADR-0002 | Local-first và boundary file cá nhân | accepted in product principle |
| ADR-0003 | Static versioned timetable artifacts | proposed |
| ADR-0005 | Deterministic parser trước LLM fallback | accepted in product principle |
| ADR-0006 | Default TH session weeks `[2..teachingWeeks]` khi merge registration | accepted per Q-006/C-03 |
| ADR-0007 | Static artifact + CLI admin (Supabase deferred post-MVP) | accepted per Q-003/Q-004 |
| ADR-0008 | M1 deterministic parser dependencies + local registration provenance | ready; G1 acknowledgement pending |
| ADR-0009 | M2 pure domain engine contract and schema migration `0.2.0` | ready; G1 acknowledgement pending |
| ADR-0010 | M3 web app, artifact loader contract, local storage, service worker and export | ready; G1 acknowledgement pending; G3 open items |
