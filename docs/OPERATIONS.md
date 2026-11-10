# Operations và release runbook

> **Status:** proposed — cập nhật cho M5 (`SPEC-M5-001` §3 M5-I, `DESIGN-M5-001` §7); chờ Owner duyệt G0 của spec và G1 của design/ADR-0014  
> **Owner:** Release Manager  
> **Last reviewed:** 2026-11-10  
> **Related docs:** [Data ingestion runbook](DATA_INGESTION_RUNBOOK.md), [Security](SECURITY_PRIVACY.md), [Tech stack](TECH_STACK.md), [ADR-0012](adr/ADR-0012-dataset-publish-pipeline.md), [ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md), [M5 spec](evidence/M5-SPEC.md), [M5 design handoff](evidence/M5-DESIGN-HANDOFF.md), [M5 release checklist](evidence/M5-RELEASE-CHECKLIST.md), [M5 release report (draft)](evidence/M5-RELEASE-REPORT.md), [HK I validation guide](evidence/M5-OWNER-HK1-VALIDATION-GUIDE.md), [CHANGELOG](../CHANGELOG.md)  
> **Evidence envelope:** `EVID-M5-001` (tạo ở G2; tài liệu này `N/A — docs-only`, chưa có deploy/run nào được thực hiện theo nó)

Quyết định Owner áp dụng cho tài liệu này (chat 2026-11-10, ghi ở [SPEC-M5-001 §4](evidence/M5-SPEC.md)): **D-M5-1** không deploy/publish production trong vòng M5 này, Owner thử bằng TKB HK I thật trên nhánh preview; **D-M5-2** không có runtime telemetry ([ADR-0014](adr/ADR-0014-m5-release-observability-without-telemetry.md)); **D-M5-3** một maintainer, publish đầu dùng `--accept-single-reviewer` với risk acceptance `RA-M5-001`.

## 1. Environment

| Environment | Deploy | Data rule | Approval |
| --- | --- | --- | --- |
| local | máy của maintainer (`npm run dev`, `vite preview`) | synthetic/redacted; file thật chỉ qua `test:real`/`dataset import` từ đường dẫn **ngoài repo** | Owner |
| preview | Cloudflare Pages tự build **mọi nhánh khác `main`** → `<nhánh>.<project-subdomain>.pages.dev` | `candidate`/`validated`/`published` trong `data/published` của nhánh, có banner "chưa được công bố" khi chưa publish; không PII | Owner (Coder + Reviewer khi có người thứ hai) |
| staging | **không được cấp phát (not provisioned).** URL preview của một nhánh là bản thay thế cho staged release (D-M5-1) | — | — |
| beta link | URL preview của một nhánh được Owner chỉ định, chia sẻ riêng cho nhóm nhỏ, không quảng bá (Q-011 / D-M5-1) | chỉ dataset đã `validated` hoặc `published` trên nhánh đó | Owner (Product + Release Manager) |
| production | nhánh `main`; **automatic production deployments đang tắt** tới G4a đầu tiên, Owner kích hoạt thủ công | chỉ `published` (SEC-M3-003); immutable artifact | Owner sau G4a ([checklist](evidence/M5-RELEASE-CHECKLIST.md)) |

Trình tự promote (D-M5-1): **preview → beta link → production**. Không bỏ bước: một build chỉ lên production khi cùng commit (hoặc commit chỉ khác ở `data/`/docs đã review) đã chạy trên preview và qua smoke §5.2.

Không commit secret; production secrets chỉ qua secret manager/CI protected variables. `.env.example` chỉ mô tả key names. Biến build duy nhất M5 thêm là `VITE_REPORT_ISSUE_URL` (tùy chọn, không phải secret; mặc định không đặt → báo lỗi chỉ sao chép, ADR-0014 §4).

### Hosting — Cloudflare Pages (D-004 hosting, owner 31/10/2026)

Cấu hình project Pages (Git integration với `hoangnguyen206/XepTKB`):

| Mục | Giá trị |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build:web` (copies `data/published` into the site, [ADR-0012](adr/ADR-0012-dataset-publish-pipeline.md); dev/e2e use synthetic data) |
| Build output directory | `apps/web/dist` |
| Node | `.node-version` = 22 (repo root) |
| Production branch | `main`, **tắt automatic production deployments** cho tới G4a đầu tiên |
| Preview deployments | mọi nhánh khác (ví dụ `m5-release-hardening`, `m5-hk1-validation`) |
| Dữ liệu chưa công bố | **Không cần biến dashboard.** `apps/web/vite.config.ts` và `scripts/site-data.mjs` đọc `CF_PAGES_BRANCH` do Cloudflare cung cấp: nhánh preview → cho phép dữ liệu `candidate`/`validated` (có banner "chưa được công bố"); nhánh `main` → **luôn tắt**, kể cả khi dashboard đặt `VITE_ALLOW_UNPUBLISHED=true` (SEC-M3-003) |
| Header | `apps/web/dist/_headers` sinh lúc build từ CSP (SEC-M3-007): CSP + `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`; `Cache-Control: no-cache` cho `/sw.js` và `/data/manifest.json`. Kiểm bằng smoke (§5.2) trên preview và trên domain production ở G4a |
| Build identity (M5-A) | commit lấy từ `CF_PAGES_COMMIT_SHA` (fallback `WORKERS_CI_COMMIT_SHA` → `GITHUB_SHA` → `git` → `unknown`), hiện ở footer và `<meta name="ky-nay-build">` (DESIGN-M5-001 §4) |

Project `xeptkb` được owner tạo ngày 31/10/2026 qua luồng Pages (Cloudflare gọi là "legacy Pages workflow"; nếu Pages bị ngừng, chuyển sang Workers static assets với cùng thư mục `apps/web/dist` và `_headers`). Subdomain `*.pages.dev` chính xác của project hiển thị trong dashboard Pages; các tài liệu cũ ghi hai dạng khác nhau (`xeptkb.pages.dev` ở bản trước của file này, `xeptkb-63v.pages.dev` ở [runbook §12](DATA_INGESTION_RUNBOOK.md)) — luôn lấy URL từ dashboard/log deploy, không đoán. Preview URL dùng để thử trên điện thoại thật (Safari iOS, Chrome Android), vì service worker và WebCrypto cần HTTPS. URL preview không được quảng bá; không có PII. Data region/legal review của D-004 vẫn mở: app chỉ phục vụ file tĩnh công khai, không có backend lưu dữ liệu người dùng.

## 2. CI quality gates

CI target:

1. formatting/lint/typecheck;
2. unit/property/domain tests;
3. parser golden fixtures và artifact schema check;
4. component/e2e smoke trên mobile + desktop;
5. accessibility check;
6. security secret/dependency scan;
7. build/PWA manifest/service-worker check;
8. bundle/performance budget report.

Trạng thái (2026-11-10): workflow `.github/workflows/m0-foundation.yml` chạy trên `push` vào `main` và mọi `pull_request` — job `check` (`npm run check` = lint + typecheck + test + fixtures + `dataset check`, kiểm immutability manifest, `npm run verify:bundle`) và job `e2e`. Mục 6 và 8 (secret scan, `npm audit --omit=dev --audit-level=high`, bundle budget) cùng sửa base immutability khi `push` thuộc M5-H, đang triển khai (WP2, [DESIGN-M5-001 §6](evidence/M5-DESIGN-HANDOFF.md)); chưa được coi là có cho tới khi `EVID-M5-001` ghi run CI pass. Push lên một nhánh không có PR **không** chạy CI; Cloudflare vẫn build preview.

CI không tải file trường/private fixture từ nguồn ngoài trong lúc chạy nếu không có explicit approved store. Failure phải fail closed, không tự bỏ qua test. `scripts/smoke-deploy.mjs` **không bao giờ** chạy trong CI đối với production (ADR-0014 §2).

## 3. Release sequence

Có hai quyết định riêng nhưng phối hợp: **G4a** (app) và **G4b** (dataset), sau đó **G5** ([Agent workflow](../.claude/AGENT_WORKFLOW.md)). Mọi bước ghi là **[Owner]** chỉ Owner được làm (đăng nhập dashboard, merge vào `main`, bật production, tạo tag, ký quyết định); agent chỉ chuẩn bị tài liệu/lệnh và không điền deploy ID thay Owner. Checklist chi tiết, go/no-go và rollback trigger: [M5-RELEASE-CHECKLIST](evidence/M5-RELEASE-CHECKLIST.md).

### 3.1 App release (G4a)

1. Product/Tech Lead freeze scope và version; điều kiện vào: G3a/G3b/G3c của milestone đạt, `F-M5-001` đóng, không S0/S1, S2/S3 có owner/mitigation/expiry, `RA-M5-001` còn hiệu lực.
2. Chuyển mục `Unreleased` trong [CHANGELOG](../CHANGELOG.md) sang `## [X.Y.Z] - YYYY-MM-DD`; `package.json` `version` = `X.Y.Z` (PR riêng, qua CI).
3. Deploy preview của commit release → smoke §5.2 (không `--production`) → kiểm thủ công Tier 1 trên điện thoại.
4. Tùy Owner: chia beta link (URL preview) cho nhóm nhỏ, theo dõi báo lỗi.
5. **[Owner]** merge vào `main` (CI xanh) → trong dashboard Pages bật/kích hoạt production deployment cho commit đó.
6. **[Owner]** smoke production: `node scripts/smoke-deploy.mjs <productionUrl> --production --expect-commit <sha7>` và `curl -I` kiểm header trên domain production (SEC-M3-007).
7. **[Owner]** go → tạo tag annotated `vX.Y.Z` trên commit `main` đã deploy (§4.3); ghi release report; bắt đầu monitoring window (§5.3).
8. No-go hoặc smoke FAIL → rollback §4.1 ngay, ghi incident.

### 3.2 Dataset publish (G4b)

Theo [runbook §12](DATA_INGESTION_RUNBOOK.md) và [ADR-0012](adr/ADR-0012-dataset-publish-pipeline.md): `test:real` → `dataset import` (candidate) → commit/push trên nhánh không phải `main` → review trên preview → `validate` → `publish` → `check` → merge vào `main` → production deploy (cần G4a đã cho phép production). Khi chỉ có một maintainer, `validate` và `publish` phải kèm `--accept-single-reviewer "<lý do>"` (ghi vào `data/audit.jsonl` và báo cáo import) theo `RA-M5-001`. Lệnh đầy đủ cho HK I (dữ liệu thử, không lên `main`): [HK I validation guide](evidence/M5-OWNER-HK1-VALIDATION-GUIDE.md).

## 4. Rollback

### 4.1 App deploy (Cloudflare Pages)

Hai cách, chọn cách nhanh hơn trong tình huống:

1. **Rollback trong dashboard (nhanh nhất, không cần build):** Pages project → Deployments → chọn production deployment tốt trước đó → hành động "Rollback to this deployment" (hoặc tên tương đương). **Nhãn chính xác phải được xác minh ở lần diễn tập G4a đầu tiên** và ghi lại vào đây. Lưu ý: bản rollback dùng nguyên build cũ, gồm cả `data/published` của build cũ.
2. **`git revert` + redeploy:** revert commit/merge lỗi trên `main` qua PR (CI xanh) → production deploy mới. Dùng khi cần giữ dataset mới nhưng bỏ thay đổi app, hoặc khi dashboard rollback không khả dụng.

Sau rollback: chạy lại smoke §5.2 với `--expect-commit` = commit của bản đích; ghi deployment đích, thời điểm và lý do vào release report.

Hành vi service worker (`apps/web/src/app/sw-client.ts`): bản build mới (kể cả bản rollback, vì build identity đổi cache name) được SW tải về nhưng **chờ**; trang đang mở hiện thông báo "Có phiên bản mới của ứng dụng" với nút "Tải lại" — người dùng tự chọn khi nào chuyển, trang không trộn asset của hai build. Người chưa mở lại app vẫn chạy bản cũ cho tới lần mở sau. Plan trong IndexedDB không bị ảnh hưởng (không đổi schema IndexedDB trong M5). Không purge cache CDN trừ khi asset hỏng/nhạy cảm; purge không thay được rollback và có thể làm mất đường offline.

### 4.2 Dataset

- `npm run dataset -- retract <version> --by "<RM>" --reason "<lý do>"` → commit + push → deploy; app quay về bản `published` trước đó của kỳ (hoặc "chưa có dữ liệu" nếu không còn bản nào).
- Khôi phục bản đã retract: `npm run dataset -- restore <version> --by "<RM>" --reason "<lý do>"` (→ `validated`) rồi `npm run dataset -- publish <version> --by "<RM>"` (thêm `--accept-single-reviewer "<lý do>"` nếu người publish là người nạp).
- Đã diễn tập trọn vòng ở [DRILL-M3-G4b-001](evidence/M3-G4b-DRILL-REPORT.md).
- Tạo incident/change record và regression fixture (synthetic) khi rollback do lỗi parser.

Rollback không xóa audit hoặc overwrite artifact cũ.

### 4.3 Version, tag và changelog

- Version theo SemVer, nguồn duy nhất là `version` trong `package.json` gốc; footer hiển thị version này (M5-A) và **phải trùng tag**. Tag đầu tiên đề xuất `v0.1.0` (Owner quyết, DESIGN-M5-001 §11).
- Tag annotated `vX.Y.Z` (ví dụ `git tag -a v0.1.0 -m "Kỳ Này v0.1.0" <sha>` rồi `git push origin v0.1.0`) chỉ đặt trên commit `main` đã deploy production, **chỉ do Owner tạo, chỉ sau quyết định G4a `app-released`**. Không tag preview/beta; không xóa hay dời tag đã push (sửa bằng version mới).
- [CHANGELOG.md](../CHANGELOG.md) theo Keep a Changelog: mỗi PR có thay đổi người dùng/vận hành nhìn thấy thêm dòng vào `## [Unreleased]` (Added/Changed/Fixed/Security/Removed); lúc G4a chuyển thành mục version có ngày. Không ghi PII, raw file, URL preview hay secret vào changelog.
- Dataset không có tag git; định danh là `datasetVersion` (ADR-0012 §7) và được ghi trong release report.

## 5. Monitoring

### 5.1 Nguyên tắc (ADR-0014, D-M5-2)

Release đầu **không có runtime telemetry**: không analytics, counter, gửi lỗi client, beacon hay script bên thứ ba. Observability chỉ dùng tín hiệu ngoài trình duyệt người dùng:

| Tín hiệu | Cách xem | Khi nào | Owner |
| --- | --- | --- | --- |
| Trạng thái build/deploy Cloudflare Pages | dashboard Pages → Deployments (build log, trạng thái success/failed) | mỗi push/deploy | Release Manager |
| Smoke sau deploy | `scripts/smoke-deploy.mjs` chạy tay (§5.2) | sau **mọi** deploy preview dùng để review và mọi production deploy/rollback | Release Manager |
| Checklist thủ công | [M5-RELEASE-CHECKLIST](evidence/M5-RELEASE-CHECKLIST.md) (Tier 1 điện thoại, desktop, offline, screen reader) | trước G4a/G4b, sau rollback | Release Manager + Tester |
| Báo lỗi do người dùng chủ động | văn bản "Báo sai dữ liệu" người dùng dán vào kênh Owner chọn (OD-M5-1); không gửi tự động | đọc hằng ngày trong monitoring window | Release Manager |
| Integrity dữ liệu | `npm run dataset -- check` (cũng trong `npm run check`/CI) | mỗi thay đổi `data/` | Release Manager |

Hậu quả được chấp nhận: lỗi runtime không ai báo sẽ không được thấy; không có số liệu sử dụng. Giảm thiểu: error boundary, banner dữ liệu cũ, smoke sau mỗi deploy, đọc báo lỗi hằng ngày trong tuần đăng ký. Các mục giám sát cũ (client error theo version, parser valid-rate, API latency/rate-limit, external/LLM spend, export/import error rate) là **mục tiêu P1**, chỉ mở lại bằng ADR mới sau legal review (Q-008).

### 5.2 Smoke script sau deploy

CLI theo [DESIGN-M5-001 §7](evidence/M5-DESIGN-HANDOFF.md) (script `scripts/smoke-deploy.mjs` do WP2 triển khai; mô tả dưới đây là contract thiết kế, xác nhận lại khi script được merge và có test):

```text
node scripts/smoke-deploy.mjs <baseUrl> [--production] [--expect-commit <sha7>]
```

- Chạy tay trên máy Owner (Node 22, HTTP client có sẵn), không gửi token/cookie; từ chối URL không phải `https:` trừ `localhost`.
- Kiểm: `/` trả 200 với CSP (có `frame-ancestors 'none'`), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS, `Permissions-Policy`; commit trong `<meta name="ky-nay-build">` = `--expect-commit`; `/sw.js` có `Cache-Control: no-cache`; `/manifest.webmanifest` và 4 icon PNG trả 200 `image/png`; `/data/manifest.json` 200, `no-cache`, và với `--production` chỉ chứa dataset `published`/`retracted`; mỗi artifact của dataset hiện hành tải về khớp `bytes` + SHA-256.
- In bảng PASS/FAIL; exit code ≠ 0 khi có FAIL. Smoke FAIL sau production deploy là rollback trigger (§5.4).
- `<sha7>`: 7 ký tự đầu của commit Cloudflare đã build (xem trong dashboard hoặc `git rev-parse --short=7 HEAD` trên commit đã push).
- Kiểm header bổ sung bằng tay cho SEC-M3-007 trên domain production: `curl -sI https://<domain>/` (bash) hoặc `curl.exe -sI https://<domain>/` (PowerShell 5.1, vì `curl` là alias của `Invoke-WebRequest`).

### 5.3 Monitoring window

- **Đề xuất (chờ Owner quyết, DESIGN-M5-001 §11 mục 5):** 72 giờ sau mỗi quyết định G4a `app-released`, và sau mỗi G4b publish trong tuần đăng ký.
- Trong window, Release Manager (Owner) **ít nhất một lần mỗi ngày**: xem trạng thái deploy Pages; chạy lại smoke §5.2 trên production nếu có deploy mới hoặc nghi ngờ; đọc mọi báo lỗi người dùng gửi và phân loại severity §7; đối chiếu ngẫu nhiên vài lớp trên production với file nguồn khi có báo sai dữ liệu.
- Kết thúc window: ghi kết quả vào phần Monitoring/Post-release của release report và chuyển sang G5 (`closed` hoặc `follow-up-open`).

### 5.4 Ngưỡng và rollback trigger (không có alert tự động)

- S0 bất kỳ (PII/secret lộ, deploy độc hại, sai TKB diện rộng) hoặc S1 (core không dùng được, dataset integrity fail, publish/rollback hỏng) → contain/rollback ngay (§4), không chờ hết window.
- Smoke FAIL trên production (header thiếu, commit sai, hash artifact sai) → rollback app hoặc dataset tương ứng.
- Chunk lazy (nhập ĐKMH) không dùng được offline sau khi SW cài → rollback app (DESIGN-M5-001 §8).
- ≥ 1 báo sai dữ liệu được xác nhận là lỗi parser ảnh hưởng nhiều lớp → `retract` dataset, mở finding.

Alert/báo cáo không được chứa raw schedule cá nhân hoặc PII.

## 6. Mùa đăng ký

Trước cửa sổ TKB:

- xác nhận người vận hành: hiện **một maintainer** (D-M5-3) — two-person rule được thay bằng `--accept-single-reviewer` + `RA-M5-001` (hết hạn trước G4a public đầu tiên hoặc `2027-01-31`, tùy mốc nào đến trước); cần người duyệt thứ hai hoặc decision gia hạn sau mốc đó;
- diễn tập ingest + rollback + bad-format fallback (đã có [DRILL-M3-G4b-001](evidence/M3-G4b-DRILL-REPORT.md); lặp lại phần review preview bằng [HK I validation guide](evidence/M5-OWNER-HK1-VALIDATION-GUIDE.md));
- kiểm tra bundle/PWA (M5-F/M5-G) và smoke preview;
- freeze risky dependency upgrade;
- FAQ "không phải công cụ chính thức" nằm trong trang Giới thiệu (M5-C); ô status message đọc từ manifest là P1 (M5-C2), chưa có.

Trong cửa sổ:

- theo dõi deploy và báo lỗi người dùng theo §5.3;
- không publish file chưa review vì áp lực thời gian;
- ưu tiên static/core path; không bật feature external;
- ghi mọi manual correction.

Sau cửa sổ:

- review báo lỗi/feedback (không có metrics tự động);
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

- có hai người có quyền admin và release (hiện chưa đạt — một maintainer, xem `RA-M5-001`);
- tài liệu runbook/fixture/parser quirks được đọc và drill;
- credentials không gắn email cá nhân duy nhất;
- domain/hosting/billing/alert ownership chuyển sang tổ chức/project account;
- kiểm tra quyền truy cập cũ đã revoke;
- lịch review mỗi học kỳ và người chịu trách nhiệm nạp dữ liệu đã chỉ định.

## 10. Trạng thái hiện tại (2026-11-10)

- **Code:** M0–M4 đã merge vào `main` (`c2e93b9`, docs sync `0e849f1`); M5 đang triển khai trên nhánh `m5-release-hardening` (spec/design ở `bcce6c6`, G0/G1 chờ Owner).
- **Hosting:** Cloudflare Pages project đã tạo, preview deployments hoạt động cho nhánh khác `main`; **chưa có production deployment công khai**, automatic production deployments đang tắt; chưa có custom domain (D-001/OD-M5-2).
- **Dữ liệu:** `data/published/manifest.json` trên `main` có `datasets: []`; pipeline đã diễn tập ([DRILL-M3-G4b-001](evidence/M3-G4b-DRILL-REPORT.md)); chưa có TKB HK II 2026–2027 thật.
- **Release:** chưa có tag, chưa có G4a/G4b/G5 nào được quyết định; [release report M5](evidence/M5-RELEASE-REPORT.md) đang `draft`.
- **Monitoring:** chỉ theo §5 (không telemetry). Provider/project ID nội bộ và link dashboard không công khai giữ ngoài repo (secret-safe location của Owner), không ghi vào tài liệu này.
- **Chưa có:** smoke script (WP2, đang triển khai), lần diễn tập rollback app trên Pages (làm ở G4a đầu tiên), người vận hành thứ hai.
