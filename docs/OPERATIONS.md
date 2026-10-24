# Operations và release runbook

> **Status:** proposed  
> **Owner:** Release Manager  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md), [Security](SECURITY_PRIVACY.md), [Tech stack](TECH_STACK.md)

## 1. Environment

| Environment | Deploy | Data rule | Approval |
| --- | --- | --- | --- |
| local | developer machine | synthetic/redacted | owner |
| preview | per PR | synthetic/candidate | Coder + Reviewer |
| staging | stable branch | approved non-PII artifact | Tech Lead + Tester |
| production | release tag/promotion | published immutable artifact | Release Manager + data reviewer |

Không commit secret; production secrets chỉ qua secret manager/CI protected variables. `.env.example` chỉ mô tả key names.

## 2. CI quality gates

CI target khi code bắt đầu:

1. formatting/lint/typecheck;
2. unit/property/domain tests;
3. parser golden fixtures và artifact schema check;
4. component/e2e smoke trên mobile + desktop;
5. accessibility check;
6. security secret/dependency scan;
7. build/PWA manifest/service-worker check;
8. bundle/performance budget report.

CI không tải file trường/private fixture từ nguồn ngoài trong lúc chạy nếu không có explicit approved store. Failure phải fail closed, không tự bỏ qua test.

## 3. Release sequence

1. Product/Tech Lead freeze scope và version.
2. Tester chạy QA gates, attach report.
3. Security Reviewer sign-off hoặc ghi exception có expiry/owner.
4. Data Reviewer publish artifact candidate/manifest.
5. Release Manager deploy preview → smoke → production canary.
6. Kiểm tra health, catalog, dataset fetch/hash, Plan local/offline, export.
7. Theo dõi error/latency/budget window; mở rộng traffic nếu ổn.
8. Ghi changelog, dataset version, known limitations và rollback point.

## 4. Rollback

### App deploy

- promote last known-good build/tag;
- giữ dataset compatibility hoặc pin catalog về supported version;
- purge CDN chỉ khi asset hỏng/nhạy cảm; tránh purge làm mất offline path.

### Dataset

- retract version lỗi, repoint manifest atomically về bản tốt;
- thông báo app/user theo section nếu có capability;
- tạo incident/change record và regression fixture.

Rollback không xóa audit hoặc overwrite artifact cũ.

## 5. Monitoring

Theo dõi tối thiểu:

- uptime/health và CDN artifact 4xx/5xx;
- schema/hash rejection;
- parser candidate valid/error/warning rate;
- client error theo app/dataset version (đã scrub);
- API latency/rate-limit/share abuse;
- external/LLM spend và quota (nếu bật);
- export/import error rate và offline failures.

Alert phải có owner, severity, threshold, runbook link; không gửi raw schedule/PII vào alert channel.

## 6. Mùa đăng ký

Trước cửa sổ TKB:

- xác nhận hai admin/data reviewer và release contact;
- diễn tập ingest + rollback + bad-format fallback;
- prewarm/cache catalog; kiểm tra bundle/PWA;
- freeze risky dependency upgrade;
- chuẩn bị status message và FAQ “không phải công cụ chính thức”.

Trong cửa sổ:

- theo dõi ingest queue và error rate;
- không publish file chưa review vì áp lực thời gian;
- ưu tiên static/core path, tắt feature external nếu quota/incident;
- ghi mọi manual correction.

Sau cửa sổ:

- review metrics/feedback/report issue;
- cập nhật fixture và parser rules;
- rotate temporary access, close candidate artifacts, postmortem nhẹ.

## 7. Incident severity

- **S0:** PII/credential/secret leak, malicious deploy, widespread wrong timetable.
- **S1:** core unavailable, dataset integrity failure, admin publish/rollback broken.
- **S2:** feature degradation, stale data indicator, external proxy/quota issue.
- **S3:** cosmetic/docs/isolated non-critical error.

S0/S1: contain/rollback ngay, gọi Security + Release Manager, không chờ sprint. S2/S3 tạo ticket với owner/date.

## 8. Budget guardrails

- External API/LLM disabled by default.
- Per-user/per-day and global quotas; circuit breaker khi vượt.
- Cost dashboard không chứa prompt/raw file/PII.
- Xóa ảnh/file tạm sau processing theo policy; hash/cache không được trở thành cách tái dựng PII.

## 9. Handoff sau khi founder ra trường

- có hai người có quyền admin và release;
- tài liệu runbook/fixture/parser quirks được đọc và drill;
- credentials không gắn email cá nhân duy nhất;
- domain/hosting/billing/alert ownership chuyển sang tổ chức/project account;
- kiểm tra quyền truy cập cũ đã revoke;
- lịch review mỗi học kỳ và người chịu trách nhiệm nạp dữ liệu đã chỉ định.

## 10. Chưa áp dụng vì chưa có app code

Repository hiện có M0–M1 package code và local evidence; chưa có app deploy, monitoring runtime, dataset publish hoặc release. Khi tạo app, cập nhật tài liệu này bằng provider/project IDs ở secret-safe location và link dashboard không công khai.
