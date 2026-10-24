# API và data contracts

> **Status:** proposed  
> **Owner:** Tech Lead  
> **Last reviewed:** 2026-10-20
> **Related docs:** [Architecture](ARCHITECTURE.md), [Domain model](DOMAIN_MODEL.md), [Security](SECURITY_PRIVACY.md)

## 1. Phạm vi

MVP chỉ dùng **static artifact contract** (Q-003/Q-004): admin chạy local pipeline → push immutable artifact + manifest lên CDN; **không** có backend control plane trong release đầu. Share link P1 dùng client-side URL encoding, không cần server.

M1 cung cấp parser package và local candidate output; M2 bổ sung pure domain engine cho search/Plan/conflict/date/registration merge/credits. Static artifact loader, public catalog validation và các control API dưới đây chưa được triển khai. Các `POST /api/v1/*` là **target contract** cho giai đoạn sau (account/sync), không implement trong MVP — được giữ để frontend/QA mock trước và không thay đổi boundary.

## 2. Versioning rules

- Base path: `/api/v1` cho control API; static artifacts có `schemaVersion` riêng.
- Breaking change tăng major/API version hoặc tạo endpoint mới; additive field phải có default/optional.
- Mọi response có `requestId`, `apiVersion`, `serverTime` (UTC) nếu đi qua API.
- Dataset version bất biến; không overwrite URL của version đã publish.
- `ETag`/`If-None-Match` cho manifest/artifact; `Cache-Control` khác nhau cho manifest và immutable artifact.

## 3. Static artifact manifest

### Example (không phải dữ liệu thật)

```json
{
  "schemaVersion": "1.0",
  "datasetVersion": "uet-2026-2027-h2-2026-11-01.1",
  "school": "uet",
  "term": "2026-2027-h2",
  "status": "published",
  "source": {
    "type": "official-timetable",
    "documentRef": "UET-CV-REDACTED",
    "publishedBy": "data-steward",
    "importHash": "sha256:REDACTED"
  },
  "parserVersion": "uet-xlsx@0.1.0",
  "importedAt": "2026-10-19T00:00:00Z",
  "reviewedAt": "2026-10-19T00:00:00Z",
  "artifacts": [
    { "kind": "timetable", "url": ".../timetable.json", "sha256": "...", "bytes": 0 },
    { "kind": "metadata", "url": ".../metadata.json", "sha256": "...", "bytes": 0 }
  ]
}
```

`documentRef` không chứa email hoặc PII. `source.status` và link văn bản gốc có thể được hiển thị cho user nếu được phép.

### Artifact validation

Client phải validate schema, school/term, version và hash trước khi đưa data vào domain engine. Nếu artifact thiếu field bắt buộc hoặc hash mismatch, giữ cache cũ và hiển thị lỗi stale.

## 4. Control API target

| Method/path | Mục đích | Auth | PII/raw file |
| --- | --- | --- | --- |
| `GET /api/v1/health` | liveness/readiness | public | none |
| `GET /api/v1/catalog?school=uet` | danh sách school/term/version published | public | none |
| `GET /api/v1/share/{token}` | read-only Plan DTO (post-MVP) | token + rate limit | no raw file; only user-shared fields |
| `POST /api/v1/share` | tạo link share (post-MVP; MVP dùng URL-encoded §4) | optional session | DTO tối thiểu, consent |
| `DELETE /api/v1/share/{id}` | revoke share (post-MVP) | owner/admin | none |
| `POST /api/v1/admin/imports` | đăng ký candidate artifact (post-MVP; MVP = CLI) | admin | approved source only; no user registration file |
| `POST /api/v1/admin/imports/{id}/validate` | chạy validation/diff (post-MVP; MVP = CLI) | admin | candidate metadata |
| `POST /api/v1/admin/imports/{id}/publish` | publish sau approval (post-MVP; MVP = CLI + manual two-person) | two-person/admin policy | artifact only |
| `POST /api/v1/admin/imports/{id}/retract` | retraction/rollback (post-MVP; MVP = CLI) | admin | audit |
| `POST /api/v1/external/ratings/lookup` | proxy aggregate ratings | server only | course/lecturer canonical IDs, no PII |

Share/sync endpoints không được nhận `file`, `document`, `studentId`, `birthDate`, `fullName`, raw HTML hoặc raw timetable upload. Tên field bị cấm phải có request validation và test.

### Share link P1 — client-side only (Q-003)

Không cần backend: encode `{ schemaVersion, school, termId, datasetVersion, planName, picks[], overrides[] }` vào URL fragment (ví dụ `#p=<base64url>`). Fragment không được gửi lên server/log — không vi phạm boundary. Khi share được implement, giới hạn length (ước <4KB) và fail safe nếu URL quá dài.

## 5. DTO tối thiểu cho share (post-MVP)

```ts
type SharedPlanDto = {
  schemaVersion: "1.0";
  school: "uet";
  termId: string;
  datasetVersion: string;
  planName?: string;
  picks: { sectionId: string; group?: string }[];
  userOverrides?: {
    field: "room" | "campus" | "day" | "periods" | "weeks";
    value: unknown;
  }[];
  expiresAt: string;
  disclosure: "schedule-only" | "schedule-and-rooms";
};
```

Server không cần lưu course search history hoặc raw source. Share token phải random, không tuần tự; response không expose owner email.

## 6. Error envelope

```json
{
  "error": {
    "code": "INVALID_ARTIFACT",
    "message": "Artifact could not be validated",
    "details": [{ "field": "schemaVersion", "reason": "unsupported" }]
  },
  "requestId": "opaque-id",
  "apiVersion": "v1"
}
```

Message cho user không leak stack/path/secret/PII. `details` chỉ có field/code an toàn; log server mới có diagnostic đã scrub.

## 7. Idempotency, rate limit và cache

- Admin import/publish nhận `Idempotency-Key`; cùng key + payload trả kết quả cũ, payload khác bị reject.
- Share create rate-limit theo session/IP và abuse detection; không lưu IP lâu hơn policy cần thiết.
- Public catalog/cache có ETag và stale-if-error.
- External proxy có server cache theo canonical request + `since`, timeout, circuit breaker, budget cap.
- Retry client chỉ cho GET/idempotent operation; exponential backoff, không retry publish mù.

## 8. Auth/RBAC dự kiến

| Role | Catalog/share | Import candidate | Validate | Publish/retract |
| --- | --- | --- | --- | --- |
| anonymous | read public | no | no | no |
| signed-in user | own share | no | no | no |
| data steward | read + own admin jobs | yes | yes | theo two-person policy |
| release manager | read | yes | yes | yes |
| security reviewer | audit/read | no | security gate | block/recommend |

Chi tiết enforcement dùng RLS/Edge authorization và được kiểm thử bằng role matrix; không dựa vào UI ẩn nút.

## 9. Compatibility checklist

Trước khi đổi contract:

1. tìm consumer và version;
2. thêm fixture request/response/error;
3. ghi ADR/migration/default;
4. chạy contract tests trong CI;
5. publish docs/changelog;
6. chỉ remove field sau deprecation window.
