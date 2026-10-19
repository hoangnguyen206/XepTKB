# Security, privacy và threat model

> **Status:** draft / required gate  
> **Owner:** Security Reviewer  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Architecture](ARCHITECTURE.md), [Tech stack](TECH_STACK.md), [Operations](OPERATIONS.md)

> Tài liệu này là baseline kỹ thuật, không phải tư vấn pháp lý. Trước khi thu tiền, lưu account hoặc mở vendor/cross-border processing, cần rà soát với người có chuyên môn và quy định hiện hành.

## 1. Security objectives

- Không để file kết quả đăng ký và PII rời thiết bị trong core flow.
- Không xin/nhận mật khẩu cổng sinh viên, không tự động đăng ký.
- Dataset public không chứa PII và có integrity/provenance.
- Admin ingestion fail closed; chỉ publish sau validation và review.
- Share/sync là opt-in, minh bạch field/expiry/revoke.
- Secret, external API key và admin capability chỉ ở server/secret manager.
- Design-time threat/data-flow review ở **G1** là bắt buộc khi feature mở boundary PII/vendor/auth/external mới.
- Implementation-time verification ở **G3b** phải chứng minh controls đã triển khai; G1 không thay thế G3b.
- Incident có owner, evidence và khả năng rollback/notify.
- Data Reviewer xác nhận candidate dataset độc lập; Release Manager là accountable cho publish/retract/rollback.

## 2. Data inventory và classification

| Data | Ví dụ | Classification | Nơi được phép | Retention mặc định |
| --- | --- | --- | --- | --- |
| Public timetable | course/section/session/room | Public/Integrity-sensitive | CDN, browser cache | đến khi superseded/retracted |
| Source document metadata | hash, source ref, parser version | Internal/Public subset | admin store/manifest | theo provenance policy |
| Registration PII | họ tên, ngày sinh, mã SV | Sensitive personal | browser memory/IndexedDB user-controlled | xóa khi user xóa/import cleanup |
| Derived personal Plan | môn/giờ/phòng user chọn | Personal | local; server chỉ khi share consent | user-controlled/expiry |
| Admin identity/audit | user id, action, timestamp | Restricted | control plane | policy/legal review |
| Analytics | aggregate event, app/dataset version | Low sensitivity | Umami/Sentry scrubbed | shortest useful period |
| Secrets | API keys, signing keys | Secret | secret manager only | rotation schedule |

CI/repository không chứa raw source có PII, `.env`, token hoặc fixture chưa redacted.

## 3. Data-flow controls

```mermaid
flowchart LR
  File[Registration file\nwith PII] --> Picker[Browser file picker]
  Picker --> Parse[Local parser]
  Parse --> Redact[Drop PII fields]
  Redact --> Preview[User preview/confirm]
  Preview --> Local[(IndexedDB)]
  Local -. opt-in selected DTO .-> API[Backend share/sync]
  API --> DB[(Minimal control data)]
  API -. server-only redacted .-> External[External service]
  Source[Approved school source] --> Quarantine[Admin quarantine]
  Quarantine --> Validate[Parser + validation]
  Validate --> Review[Human review]
  Review --> CDN[Immutable public artifact]
```

Raw registration bytes không có mũi tên đến API/DB/log/analytics. Browser network test phải chứng minh điều này.

## 4. Threat model

| Threat | Asset/impact | Control | Evidence |
| --- | --- | --- | --- |
| User uploads PII accidentally | privacy/legal | local parse, redaction, CSP/network tests | automated + manual |
| Malicious file/parser payload | browser/client integrity | type/size limit, no execution, sandboxed parsing, dependency update | security test |
| Forged dataset | wrong timetable/trust | hash/schema/signing where feasible, provenance/review | artifact test |
| Admin account takeover | public data poisoning | MFA where supported, RBAC, two-person publish, audit | access test |
| Share token guessing/leak | schedule privacy | high entropy token, expiry/revoke, no owner identity | API test |
| XSS from course/lecturer/room text | browser execution | output encoding, CSP, sanitize HTML, fixture payload | e2e/security |
| SSRF/external abuse | backend | allowlisted outbound, no user URL fetch, timeout | API test |
| API/LLM cost abuse | budget/availability | auth, rate limit, quota, circuit breaker | load/drill |
| Dependency compromise | supply chain | lockfile, provenance, review, SCA | CI evidence |
| Stale/incorrect data | user decisions | updated-at/source link, report issue, rollback | runbook drill |

## 5. Client controls

- CSP, secure headers, no inline dynamic HTML unless sanitized.
- File parsing in isolated module/worker where practical; never evaluate file content as script.
- MIME/extension/size validation; malformed input returns safe error.
- IndexedDB schema migration validates and drops unsupported records safely.
- Sensitive data omitted from errors, console logs, Sentry breadcrumbs and analytics.
- Export filenames and visible text escape user-derived values.
- Service worker update must not silently serve mixed schema/version.

## 6. Server/admin controls

- Secrets only in environment/secret manager; rotate and audit access.
- RBAC enforced server-side; RLS for user-owned share records.
- Admin import quarantine is separate from published bucket/prefix.
- Two-person approval cho first publish/new parser version; Data Parser không phải approver duy nhất, Data Reviewer phải độc lập.
- Design-time Security approval ở G1 cho boundary PII/vendor/auth/external mới; implementation verification ở G3b.
- Upload content-disposition/no execution, size limits, malware scan where server receives source.
- Audit events: actor role, action, artifact id/hash, result, timestamp, reason; no raw file/PII.
- Rate limits and budget caps for share, import, external proxy and LLM.
- Backups encrypted and deletion policy documented; restore drill before production.

## 7. Privacy UX and retention

- Privacy notice explains local processing, optional share/sync, analytics and deletion.
- User sees exactly what a share link reveals; default hides course names if feature design chooses busy/free.
- Share links expire by default and have revoke control.
- “Delete local data” clears Plan/import-derived data/cache according to app capability; provide export first if useful.
- Account deletion removes server-owned share/sync records within policy SLA.
- Do not derive sensitive profiles from schedule or expose student identity through public URL.
- Cross-border/vendor transfer, legal basis/consent and data region are open gates, not assumptions.

## 8. LLM/external service rules

- Disabled for MVP core; rule-based parser remains complete path.
- If enabled for admin fallback: redact, send minimum string set, constrain JSON schema, validate, human approve, cache, budget cap and delete input according to policy.
- No raw registration documents or PII to model.
- External ratings only via server proxy after written data/attribution agreement; show source link and sample threshold.

## 9. Security acceptance criteria

- [ ] No raw registration bytes/PII appear in network requests, analytics, logs or Sentry.
- [ ] Portal credential fields do not exist in UI/API.
- [ ] Dataset hash/schema/provenance validation blocks invalid artifact.
- [ ] Admin role matrix tested; non-admin cannot publish/retract.
- [ ] Share token expiry/revoke/access checks tested.
- [ ] XSS/file parser/SSRF/rate-limit dependency checks pass.
- [ ] Secret scan and dependency audit pass; findings have owner.
- [ ] Backup/restore and artifact rollback drill has evidence.
- [ ] Privacy notice and deletion flow reviewed before account/sync release.

## 10. Incident response

1. Triage severity and contain: disable endpoint/publish/feature; preserve scrubbed evidence.
2. If PII/secret exposure suspected: stop logs/connector, revoke/rotate secret, invalidate tokens, limit access.
3. Identify scope via requestId/artifact/audit without copying raw data.
4. Fix and test; rollback bad artifact or deploy.
5. Notify owner/affected parties/regulator as required by reviewed policy.
6. Post-incident action items, owner and due date; update threat model/runbook.
