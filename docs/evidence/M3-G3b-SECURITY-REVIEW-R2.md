# M3 security review R2 — kiểm lại SEC-M3-001…007, dataset pipeline, parser, privacy boundary (G3b)

> **Artifact ID:** `SEC-REVIEW-M3-002`
> **Trạng thái/Status:** `approved` — đã được Owner (Release Manager / Tech Lead) xác nhận và phê duyệt gói exception S3 thu hẹp `EXC-SEC-M3-R2-B/C/D` lúc `2026-11-06T05:50Z`
> **Canonical gate:** `G3b` (implementation verification), lần chạy lại thứ 2 + hậu kiểm R2.1
> **Owner:** Security Reviewer (agent role)
> **Last reviewed:** 2026-11-06 (kèm phụ lục hậu kiểm R2.1 tại `d51c65b`)
> **Related docs:** [Security & privacy](../SECURITY_PRIVACY.md), [M0 G1 threat/data-flow](M0-G1-threat-data-flow.md), [G3b R1](M3-G3b-SECURITY-REVIEW.md), [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md), [IMPL-M3-001](M3-IMPLEMENTATION-HANDOFF.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0011](../adr/ADR-0011-timetable-format-variability.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [Operations §1](../OPERATIONS.md), [Data ingestion runbook §12](../DATA_INGESTION_RUNBOOK.md), [C-09 review](C09-REGISTRATION-SAMPLE-REVIEW.md), [Audit M0–M2](M0-M2-AUDIT-2026-10-25.md)
> **Evidence envelope:** mục [Evidence Envelope](#evidence-envelope) bên dưới. Ledger tổng là [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md).
> **Decision actor / UTC timestamp:** Claude subagent đóng vai Security Reviewer (quyết định R2 lúc 2026-11-05T17:17Z; phụ lục hậu kiểm R2.1 tại `d51c65b` lúc 2026-11-06T05:39Z); được Owner (Release Manager / Tech Lead) xác nhận và ký duyệt exception S3 thu hẹp lúc `2026-11-06T05:50Z`
> **Receiving owner / acknowledgement:** Owner (Release Manager / Tech Lead / Data Reviewer) — acknowledged (`2026-11-06T05:50Z`)

**Lưu ý.** Báo cáo này do một agent viết khi đóng vai Security Reviewer, không phải Security Reviewer là người. Người trong vai đó cần đọc và xác nhận (acknowledge) quyết định bên dưới. Exception nào đề xuất ở đây cũng chưa có hiệu lực cho tới khi Release Manager chấp thuận.

## Scope and identity

- Review phase: `G3b implementation verification`, chạy lại lần 2.
- Review type: code review, probe động trên trình duyệt (Chromium), probe CLI và parser, dependency/secret check, kiểm header trên preview host thật.
- **Base:** `4681c633af9344a7c541fa91bd45a8a9f4a904be` (`main`).
- **Target (bất biến):** `2ab03cd7385eb5eafd64251621158e45bed181ba` trên nhánh `m3-web-app`, draft PR #1, commit ngày 2026-11-01. Phần mới so với R1 là diff `82cb85b..2ab03cd` (84 file).
- **Môi trường chạy:**
  - worktree detached riêng tại scratchpad của agent (`git worktree add --detach <scratch>/secwt 2ab03cd`), cài bằng `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci`;
  - đã gỡ worktree sau khi chạy (`git worktree remove` rồi xóa thư mục, `git worktree prune`);
  - checkout của repo chỉ bị ghi đúng một file là báo cáo này.
- **Lệch so với target, chỉ tồn tại trong worktree riêng và không commit:** `apps/web/playwright.config.ts` đổi `PORT = 4180` thành `4382`. Lý do: Windows giữ dải cổng TCP 4143–4242 nên `listen EACCES ::1:4180`. Đây là chỉ đạo của coordinator. Server probe của review cũng chạy ở `127.0.0.1:4382`.
- **Toolchain:** Windows 10 Pro 19045, Node 22.22.2, npm 12.0.2, TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0 (Chromium build 1248, headless).
- **Source contract:**
  - SECURITY_PRIVACY §2–§5, §9;
  - ADR-0010 §2–§5;
  - ADR-0011 §2, §8;
  - ADR-0012 §1–§6;
  - SPEC-M3-001 AC-M3-06/-07/-13.
- **Data boundary / actor:**
  - trình duyệt sinh viên ↔ file tĩnh cùng origin `data/*`;
  - IndexedDB `ky-nay`;
  - cache service worker;
  - file tải về (ICS, `.doc`, PNG, backup JSON);
  - máy admin chạy CLI `scripts/dataset.mjs` với file TKB nguồn đặt ngoài repo → `data/published` → Cloudflare Pages.
  - M3 không có backend, không auth, không nhập file đăng ký trên web.
- **Dữ liệu dùng để test:** chỉ dữ liệu tổng hợp, gồm dataset `synthetic-uet-*`, các workbook do probe tự sinh (mã `SYN…`) và chuỗi giả `SYNTHETIC-PHONE-000`. Không dùng file thật, không có PII.

### Commands and results

| # | Lệnh (worktree riêng, trừ khi ghi khác) | Exit | Kết quả |
| --- | --- | ---: | --- |
| C1 | `npm ci` (bỏ qua tải browser) | 0 | 0 vulnerabilities |
| C2 | `npm run check` | 0 | lint pass; typecheck pass; node:test **94/94**; Vitest **54/54** (7 file); fixtures **6/6**; `dataset check`: `0 datasets` |
| C3 | `npm run test:e2e` (port 4382) | 0 | Playwright **17/17** (Chromium) |
| C4 | `npm audit --omit=dev` / `npm audit` | 0 / 0 | **0 vulnerabilities** |
| C5 | `npm audit signatures` | 0 | 104 package có registry signature hợp lệ, 47 có attestation |
| C6 | Quét lockfile (node script) | 0 | 137 entry; mọi `resolved` là `registry.npmjs.org`, ngoại lệ là 4 workspace link; install script duy nhất là `fsevents` (optional); prod tree: `react`/`react-dom` 19.3.0, `scheduler`, `@xmldom/xmldom` 0.9.12, `fflate` 0.8.3 |
| C7 | Quét secret trên diff `4681c63..2ab03cd` (regex key/token/password/private key/AKIA/ghp_/xox/JWT/CF API) | — | **Không có secret.** Chỉ thấy URL `evil.example` trong unit test âm tính và chữ "token" trong docs/CSS |
| C8 | Quét bundle (`dist-e2e`, build production) tìm URL ngoài, `sendBeacon`/XHR/WebSocket/EventSource/localStorage/sessionStorage/cookie | — | Chỉ có namespace W3C và `react.dev/errors`; 0 kênh mạng/lưu trữ cấm |
| C9 | Build với `CF_PAGES=1` và `CF_PAGES_BRANCH`/`NODE_ENV` thay đổi (`npx vite build`), rồi `grep allowUnpublished` | 0 ×5 | `main` → `!1`; `m3-web-app` → `!0`; nhánh rỗng → `!1`; **`main` + `NODE_ENV=development` → `!0`** (xem SEC-M3-003) |
| C10 | `curl -sI` vào preview `https://m3-web-app.xeptkb-63v.pages.dev` cho `/`, `/index.html`, `/sw.js`, `/data/manifest.json`, `/_headers`, `/data/` | 0 | Đủ header (xem SEC-M3-007); `/index.html` → 308 về `/`; `/_headers` không bị lộ (trả shell); manifest đang rỗng (`datasets: []`) |
| C11 | Probe Playwright framing vào preview thật | 0 | Frame bị chặn (`chrome-error://chromewebdata/`) |
| C12 | `browser-probe.mjs` + `browser-probe2.mjs` (Chromium, server probe áp `_headers`, có chế độ stream không `Content-Length`) | 0 | Kết quả P1–P7 ở các mục dưới; tổng **275 request**: 0 khác origin, 0 khác GET, 0 WebSocket |
| C13 | `xlsx-dos.mjs` (parser `uet-xlsx`, workbook ~1 KB) | 0 / **134** | Xem SEC-M3-103 |
| C14 | `xlsx-info.mjs` / `make-xlsx.mjs` (cột ẩn ngoài danh sách) | 0 | Xem SEC-M3-102 |
| C15 | Probe CLI `node scripts/dataset.mjs import/validate/publish/check` trên bản sao `data/` của worktree riêng | xem dưới | Xem SEC-M3-101, SEC-M3-104 |
| C16 | `scripts/lint.mjs` chạy trên cây giả lập chứa 10 mẫu lách + 2 mẫu đối chứng | 0 / 1 | 10/10 mẫu lách **lọt qua**; 2/2 mẫu đối chứng bị bắt (xem SEC-M3-005) |

Script probe nằm trong scratchpad của agent và **không** được copy vào repo.

## Re-verification SEC-M3-001…007 và ledger #6

| Ledger | ID | Probe độc lập | Kết quả quan sát | Phân loại |
| --- | --- | --- | --- | --- |
| #8 | SEC-M3-001 retracted → offline | **P1a:** đang xem h2, manifest đánh dấu h2 `retracted`, rồi manifest bị abort. **P1b2:** Plan nằm ở h1, h2 đã cache từ lần mở đầu, manifest đọc được đánh dấu h2 `retracted`, rồi mất mạng | **P1a:** online thì app báo "Chưa có dữ liệu… được công bố" và **xóa bản cache** (`datasets: []`); offline thì báo "Không kết nối được…" và không hiện h2, **đạt**. **P1b2:** sau khi manifest đọc được đã thu hồi h2, IndexedDB **vẫn giữ** `2026-2027-h2`. Khi offline, ô chọn kỳ hiện cả 2 kỳ; chọn h2 thì app hiện bộ `synthetic-uet-2026-2027-h2.1` đã bị thu hồi, chỉ kèm banner "Đang ngoại tuyến". Nguyên nhân: `loader.ts` chỉ dọn bản cache của **kỳ đang được tải** (nhánh `!entry` khi `term` có giá trị, và nhánh lỗi fetch). Fix QA-M3-006 (offline liệt kê mọi kỳ đã cache) mở lại đúng kịch bản của SEC-M3-001 cho các kỳ không active | **partially-fixed** (đường kỳ active đã sửa; đường kỳ không active **mở lại do QA-M3-006**) |
| #9 | SEC-M3-002 `%2e%2e` | **P2:** 10 biến thể URL artifact: `%2e%2e/`, `%2E%2E/`, `.%2e/`, `..%2f`, `a/../../`, `..\`, `\t../`, `%252e%252e/`, dấu chấm toàn chiều rộng `．．/`, `‥` | 8/10 bị từ chối với "Danh mục dữ liệu không hợp lệ", **không có request artifact nào**. Hai biến thể Unicode không phải dot-segment: trình duyệt percent-encode và request vẫn nằm trong `/data/` (`/data/%EF%BC%8E%EF%BC%8E/icon.svg`), bị 404, nên **không thoát khỏi `data/`**. Request `/icon.svg` thấy trong log là favicon của trang | **verified-fixed** |
| #10 | SEC-M3-003 cờ dữ liệu chưa công bố | **C9:** build theo các biến thể `CF_PAGES_BRANCH`/`NODE_ENV`. **P6:** phục vụ bản build `main` có dữ liệu `candidate` | Logic theo nhánh đúng như mô tả ở `f384f7b`. **P6:** bản `main` báo "Chưa có dữ liệu thời khóa biểu được công bố", 0 request `timetable.json`/`metadata.json`. **Còn hở:** (a) `NODE_ENV=development` trong env build của Pages làm `import.meta.env.DEV = true` nên `allowUnpublished:!0` **ngay trên `main`**, vì nhánh chỉ điều khiển `VITE_ALLOW_UNPUBLISHED`; (b) chưa có gate tự động (CI/release) kiểm tra bundle production có `allowUnpublished:!1`, và chưa có test trình duyệt chạy cờ tắt trong CI; (c) `site-data.mjs` copy **toàn bộ** `data/published`, kể cả entry `candidate`/`validated` và artifact của chúng, lên production, nên dữ liệu chưa duyệt vẫn tải công khai được theo URL trong manifest. Đây là khuyến nghị "manifest production chỉ gồm `published`/`retracted`" của R1, chưa làm; (d) điều kiện phụ thuộc `CF_PAGES === "1"` và chuỗi cứng `"main"`, sẽ mất tác dụng nếu chuyển sang Workers Builds (OPERATIONS có nhắc) hoặc đổi tên nhánh production | **partially-fixed** |
| #11 | SEC-M3-004 stream không `Content-Length` | **P3:** server trả chunked, không `Content-Length`: manifest 64 MB (giới hạn 1 MB) và timetable 256 MB (giới hạn 20 MB) | Manifest: client hủy kết nối khi server mới ghi khoảng 6,8 MB (gồm cả buffer kernel và socket), UI báo "Dữ liệu tải về vượt giới hạn kích thước". Timetable: hủy ở khoảng 29 MB với giới hạn 20 MB, cùng thông báo. Không đọc hết body | **verified-fixed** |
| #12 | SEC-M3-005 lint/network guard | **C16** + quét runtime C12 | **Runtime:** 275 request trên 7 kịch bản (load, onboarding, chọn lớp, đổi kỳ, xuất `.doc`/`.ics`, wipe 2 tab, offline/SW, manifest độc), tất cả cùng origin, GET, 0 WebSocket. E2E đã chuyển sang `context.on("request")` (m3.spec.ts:381) nhưng mới phủ **một** flow. **Static:** 10/10 mẫu lách đều qua, trong đó có **2 đường lách mới do chính hàm `stripComments`**: chuỗi chứa `//` (`const u = "a//"; fetch(u)`) hoặc `"/*"…"*/"` làm phần code sau đó bị xóa trắng trước khi so regex. Các mẫu khác: `globalThis["fe"+"tch"]`, `new Image().src`, `location.href`, `window.open`, `["XML"+"HttpRequest"]`, `new Worker(blob)`, file `.js` (không nằm trong `allowedExtensions`). CSP vẫn chặn `connect-src`/`img-src` khác origin, nhưng **không chặn điều hướng** (`location`, `window.open`) | **partially-fixed** |
| #13 | SEC-M3-006a danh sách backup sau wipe | **P4:** tạo 1 bản backup (bản ghi Plan hỏng), mở tab A và tab B, wipe ở A | Tab A: danh sách biến mất (dựng lại theo `generation`), **đạt**. Tab B: sau broadcast `wiped`, store `backups` trong IndexedDB đã rỗng nhưng tab B **vẫn hiện "Bản sao lưu… (1)"** và nút "Tải về" **tải được bản ghi đã xóa** (`ky-nay-sao-luu-1.json` chứa marker). Nguyên nhân: `resetAfterWipe` không remount `BackupList`, và `generation` chỉ đổi ở tab bấm xóa | **partially-fixed** |
| #6 (+SEC-M3-006b) | Hai tab / BroadcastChannel / wipe | E2E `QA-M3-005 — two tabs…` (pass) + đọc code `savePlanIfUnchanged`/`idbPutIfUnchanged` | Ghi kiểu so sánh-rồi-ghi trong 1 transaction; tab cũ có `base` ≠ undefined không ghi đè được sau wipe (bản lưu đã là `undefined`). Broadcast `wiped` reset state. Tab bị trình duyệt đóng băng (bfcache) hoặc trình duyệt không có `BroadcastChannel` vẫn được CAS bảo vệ; ngoại lệ là Plan **mới** tạo trong tab cũ, và trường hợp này hợp lệ | **verified-fixed** (riêng 006b) |
| #14 | SEC-M3-007 header/CSP | **C10/C11** trên preview thật + server probe áp `_headers` | Preview trả CSP header bằng đúng CSP trong meta, cộng `frame-ancestors 'none'`; có `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS `max-age=31536000`, COOP; `sw.js` và manifest có `no-cache`; preview có `x-robots-tag: noindex`. Không frame được từ origin khác. Quan sát: Pages tự thêm `Access-Control-Allow-Origin: *` (dữ liệu công khai, chấp nhận được); HSTS chưa có `includeSubDomains` (cần xét khi gắn domain riêng) | **verified-fixed** trên preview. Production chưa có deploy nên **kiểm lại ở G4a** |
| #22 | HOST-M3-001 / `08401c4` offline SW | **P7:** sau lần online đầu, `context.setOffline(true)` rồi reload | Mở được Plan offline, có banner "Đang ngoại tuyến". Thử chèn `<script>` inline lúc offline: **không chạy** (CSP meta vẫn còn; response tổng hợp giữ header của bản cache). SW không chặn `/data/*` hay request khác origin, chỉ xử lý GET. Bỏ cờ `redirected` bằng cách tạo `Response` mới từ body và header của bản cache cùng origin, không có đường poison | **pass** |

## Data-flow and threat checks

| Check/control | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Registration raw bytes/PII network | không có | M3 chưa có file picker; quét bundle không thấy parser đăng ký (`apps/web` chỉ phụ thuộc `domain`, `export`); runtime capture C12: 275/275 request cùng origin, GET | **pass** |
| Logs/analytics | không PII, không tracker | Không có `console.*` trong source web/domain/export (chỉ có ở runner fixtures và script CLI); bundle 0 tracker hoặc URL ngoài; `test:real` chỉ in `rawValue` với `uet-xlsx`, không in với file đăng ký | **pass** |
| PII trong fixture/data commit | không có | Fixture `fixtures/redacted-registration/portal-format.doc`: các trường định danh là giá trị tổng hợp (`Sinh Viên Mẫu`, `01/01/2000`, `00000000`, `QH-0000-X/XX`), 0 email, không có metadata tác giả Office; `data/published` chỉ có manifest rỗng; không commit `data/reports`/`audit.jsonl` | **pass** |
| XSS DOM: cột thêm (`info`) và `rawNote` | hiển thị dạng text | **P5:** payload `<img onerror>`, `</script><svg onload>`, nhãn `<b onmouseover>` và CRLF + `BEGIN:VEVENT/UID:evil` đặt vào **mọi** `info`/`rawNote`, hash hợp lệ. Kết quả: 0 cờ `window.__ky*`, 0 node bị chèn, payload hiện như chữ, 0 sự kiện `securitypolicyviolation`, có hover vào khối lưới để kích `title` | **pass** |
| Export `.doc`/`.ics` với info/rawNote độc | không thực thi, không chèn property | **P5:** `.doc` có 0 `<img`/`<svg` thô; `.ics` có 0 dòng `UID:evil`, 0 dòng dài hơn 75 octet. `info`/`note` hiện **không** được đưa vào `.doc`, `.ics` hay PNG (chỉ dùng ở thẻ và lưới) | **pass** |
| Artifact integrity trên client | hash trước parse, URL nằm trong `data/` | Như R1, cộng SEC-M3-002 đã sửa, SEC-M3-004 đã sửa, và `published.test.ts` nạp `data/published` qua chính loader | **pass** |
| Integrity/provenance phía publish (ADR-0012) | vòng đời, hai người, bất biến | Xem **SEC-M3-101** | **finding (S3)** |
| Privacy của dữ liệu công bố | không công bố cột ngoài ý muốn | Xem **SEC-M3-102** | **finding (S2)** |
| Parser DoS (AUD-010) | có giới hạn | Xem **SEC-M3-103** | **finding (S3)** |
| Header/CSP/framing | header + meta khớp nhau | Xem SEC-M3-007 | **pass** (preview) |
| SW offline | không cache `data/*`, giữ CSP | Xem P7 | **pass** |
| Secrets/dependencies | không lộ, đã review | C4–C7 | **pass** |
| CI | quyền tối thiểu | `permissions: contents: read`, `pull_request`, không dùng secret; actions ghim theo tag `@v5`, chưa ghim SHA (quan sát này có từ trước M3) | **pass** |
| Retention/deletion | wipe đầy đủ | Tab đơn: pass. Tab thứ hai: SEC-M3-006a còn hở | **pass with finding** |

## Findings mới

| Finding ID | Severity | Scenario/impact | Evidence/repro | Recommendation / owner / status |
| --- | --- | --- | --- | --- |
| **SEC-M3-101** | S3 | **Quy tắc hai người và vòng đời của dataset bị lách dễ dàng, và CI không phát hiện.** (a) `nextStatus` so tên sau khi `trim().toLowerCase()`, nên `"Importer  A"` (hai dấu cách) khác `"Importer A"` và người nạp tự `validate` được mà **không** ghi exception. (b) Nếu `data/audit.jsonl` thiếu dòng `import` (bị xóa, sửa, hoặc merge conflict) thì `importer` là `undefined` và phép kiểm tra **bị bỏ qua** (fail-open). (c) `publish` không có ràng buộc actor nào, nên người nạp tự công bố được. (d) `dataset check` (chạy trong CI) không đối chiếu trạng thái trong manifest với audit log hay với chuỗi chuyển trạng thái hợp lệ: sửa tay `candidate` thành `published` vẫn `OK`. (e) Tính bất biến của artifact đã công bố không được kiểm qua các commit: ghi lại `timetable.json` của bản `published` rồi sửa hash trong manifest, `check` vẫn `OK`. Tác động: dữ liệu chưa duyệt hoặc đã bị sửa có thể lên production với provenance trông hợp lệ, trái với nguyên tắc "Provenance bắt buộc" và "Fail closed". Hiện chỉ có review PR và G4a cho `main` làm giảm thiểu. ADR-0012 §4 đã nói hai người "không phải enforcement" nên đây là S3, nhưng (b), (d), (e) là control mà ADR §6 ("Integrity in CI") ngụ ý là có | C15 trên worktree riêng: `import --actor "Importer A"` cho `validate --reviewer "importer a"` exit 1 (đúng); `validate --reviewer "Importer  A"` exit 0; `publish --by "Importer A"` exit 0; `: > data/audit.jsonl` rồi `validate --reviewer "Importer A"` exit 0; sửa tay status thành `published` thì `check` exit 0; ghi lại artifact (đổi phòng) và sửa hash thì `check` exit 0. Code: `scripts/lib/dataset-core.mjs:492–509`, `scripts/dataset.mjs:312–340, 351–381` | (1) Chuẩn hóa định danh actor (bỏ mọi khoảng trắng và dấu, hoặc dùng danh sách actor cố định / git author); **fail-closed** khi không tìm thấy importer. (2) Kiểm `publish` khác người nạp, hoặc bắt buộc ghi exception. (3) `dataset check` dựng lại vòng đời từ `audit.jsonl` và so với manifest; trong CI so với nhánh base: entry `published` cùng artifact phải giữ nguyên byte, manifest chỉ được append, và chỉ đổi status theo chuỗi hợp lệ. (4) Cân nhắc yêu cầu PR review bắt buộc (branch protection) cho thay đổi trong `data/`. **Owner:** Tech Lead + Release Manager. **Hạn đề xuất:** trước lần `publish` dữ liệu thật đầu tiên (G4b drill), muộn nhất 2026-11-15. **Status:** open |
| **SEC-M3-102** | **S2** | **Cột ngoài danh sách (kể cả cột ẩn) được công bố tự động dưới dạng `info` mà không qua review.** ADR-0011 §8 biến mọi cột không dùng tới thành `info` hiển thị công khai. Tuy vậy: fingerprint định dạng (`formatFingerprint`) chỉ tính **cột canonical**, nên thêm một cột lạ không làm import bị `hold`; báo cáo import chỉ liệt kê cột canonical (`coverage.columns`) nên **reviewer không thấy nhãn cột `info`**; parser bỏ qua thuộc tính `hidden` của cột, hàng và sheet trong OOXML; không có deny-list cho tiêu đề mang tính PII (SĐT, email, ngày sinh, mã SV…); checklist trong báo cáo không nhắc tới `info`. Một file trường có cột ẩn kiểu "SĐT giảng viên" hay ghi chú nội bộ sẽ lên preview ngay khi push, rồi lên production sau `publish`, trong khi báo cáo vẫn ghi "format reviewed". Đây là dữ liệu cá nhân của bên thứ ba và không thuộc phần trường công bố, nên chạm privacy boundary (SECURITY_PRIVACY §2). Thời điểm: lần nạp TKB HK II dự kiến 09–15/11/2026 | C14: workbook bố cục HK I cộng cột thứ 11 `SĐT giảng viên (ẩn)` có `<col hidden="1">`. `uetXlsxAdapter.parse` cho 0 lỗi, `knownFormat: true`, `info: [{label:"SĐT giảng viên (ẩn)", value:"SYNTHETIC-PHONE-000"}]`. Qua CLI C15: `import` exit 0, `timetable.json` chứa `info` đó, báo cáo dòng 24 ghi "columns: courseCode … shift — format reviewed" và không nhắc tới cột này. Code: `packages/parser/src/uet-xlsx-adapter.ts:150–183, 227–231`, `packages/parser/src/ooxml.ts:181–209`, `scripts/dataset.mjs:259` | (1) Đưa **nhãn cột `info`** vào fingerprint, hoặc ít nhất vào báo cáo và thông báo `import`; nhãn chưa có trong danh sách đã duyệt thì `hold` / cần `--accept-new-format`. (2) Bỏ qua cột, hàng và sheet `hidden`, hoặc tối thiểu cảnh báo và chặn. (3) Đặt deny-list tiêu đề PII (từ khóa `sđt`, `điện thoại`, `email`, `ngày sinh`, `mã sv`, `cccd`…) để chặn import. (4) Thêm một dòng vào checklist reviewer: "Đọc danh sách nhãn `info` và giá trị mẫu". (5) Thêm test. **Owner:** Data Parser (code) + Data Reviewer (checklist). **Hạn đề xuất:** trước lần `import` dữ liệu thật đầu tiên. **Status:** open. Exception đề xuất ở dưới |
| **SEC-M3-103** | S3 (AUD-010 trong register audit vẫn giữ **S2**, không bị hạ) | **AUD-010 vẫn mở, và có thêm đường DoS qua chỉ số cột/hàng.** `fillMergedCells` không có giới hạn; `columnIndex` nhận chuỗi chữ dài tùy ý, nên một ô `r="FXSHRXW2"` tạo mảng thưa dài khoảng 4,29×10⁹ và vòng `headers.forEach` cùng các vòng sau đó chạy theo độ dài này. Tác động: CLI `dataset import`/`test:real` treo hoặc crash. Không ghi gì ra đĩa vì parse chạy trước `writeArtifact`, tức là fail-closed. Parser **không** nằm trong bundle web và đầu vào là file do admin chọn, nên mức phơi nhiễm bảo mật trong M3 là S3. Mức này sẽ thành S2 hoặc cao hơn nếu parser xlsx chạy trong trình duyệt trên file người dùng | C13, workbook khoảng 1 KB: `mergeCell ref="A2:XFD1048576"` làm process **crash OOM sau 5 giây** (exit 134, `--max-old-space-size=2048`); ô `FXSHRXW2` tốn **47,7 giây CPU**; `mergeCell A2:Z200000` tốn 121 ms; `r="4000000000"` tốn 13 ms. Code: `packages/parser/src/ooxml.ts:97–102, 131–152, 193–201` | Giới hạn cột ≤ 16 384 (XFD), hàng ≤ 1 048 576; chặn khi số ô của một merge hoặc tổng số ô fill vượt ngân sách (ví dụ 2×10⁶); từ chối `r` không hợp lệ. Thêm test cho 4 workbook ở trên. **Owner:** Data Parser + Security (theo AUD-010). **Hạn đề xuất:** trước lần `import` dữ liệu thật đầu tiên (hạn mềm), và bắt buộc trước khi parser xlsx chạy trên file người dùng. **Status:** open |
| **SEC-M3-104** | S3 | **Vệ sinh đầu vào của CLI và bước copy site.** (a) Các giá trị tự do `--document-ref`, `--term-name`, `--note`, `--reason`, `--actor` được ghi nguyên vào báo cáo Markdown; một ký tự xuống dòng đủ để giả mạo một dòng "Decision log" (ví dụ dòng "**validated** by Data Reviewer"). `audit.jsonl` thì an toàn vì dùng `JSON.stringify`. (b) `dataset check` ghép `artifact.url` vào `DATA_DIR` mà không dùng `isSafeRelativeUrl`, nên đọc được file ngoài `data/published` (`../../package.json`). Lần thử này bị báo mismatch, và loader của app vẫn từ chối. (c) `site-data.mjs` dùng `cpSync` đệ quy, không lọc symlink và không giới hạn ở các file được manifest tham chiếu, trong khi Cloudflare build không chạy `dataset check` | C15: `--document-ref $'d\n## Decision log\n- forged **validated** by Data Reviewer.'` cho ra dòng giả ở dòng 18 của báo cáo; sửa URL thành `../../package.json` thì `check` báo "does not match… names another datasetVersion". Code: `scripts/dataset.mjs:227–310, 360–368`, `scripts/site-data.mjs:524–525` | Từ chối hoặc escape xuống dòng và ký tự Markdown trong các option tự do, giới hạn độ dài; `check` dùng cùng quy tắc `isSafeRelativeUrl`; `site-data` chỉ copy các file mà manifest tham chiếu và đã khớp hash, từ chối symlink, và với production chỉ đưa entry `published`/`retracted` (gộp với SEC-M3-003 (c)); chạy `dataset check` trong `build:web`. **Owner:** Tech Lead. **Hạn đề xuất:** trước G4a đầu tiên. **Status:** open |

### Finding cũ còn mở (cập nhật)

| ID | Severity | Còn lại | Owner | Hạn đề xuất |
| --- | --- | --- | --- | --- |
| SEC-M3-001 | S3 | Kỳ không active vẫn hiện bản đã thu hồi khi offline (P1b2). Sửa: khi manifest đọc được, quét **mọi** bản trong `cache.all()` và xóa bản có `datasetVersion` đã `retracted` (hoặc không còn trong manifest); nhánh offline từ chối bản đã đánh dấu; thêm unit/e2e cho kịch bản 2 kỳ | Frontend (loader) | trước G4b drill đầu tiên, ≤ 2026-11-15 |
| SEC-M3-003 | S3 | (a) `NODE_ENV=development`; (b) chưa có gate bundle và test trình duyệt khi cờ tắt trong CI; (c) production mang theo entry/artifact chưa công bố; (d) điều kiện gắn với `CF_PAGES`/`"main"`. Sửa: tính `ALLOW_UNPUBLISHED` chỉ từ một biến build đã được chuẩn hóa (bỏ `import.meta.env.DEV` khỏi build, hoặc làm build fail khi `mode !== "production"` trên nhánh production); thêm bước release `grep allowUnpublished:!1`; thêm e2e chạy cờ tắt; lọc manifest khi build production | Frontend + Release Manager | trước G4a đầu tiên |
| SEC-M3-005 | S3 | Lint còn 10/10 đường lách, trong đó có 2 đường mới do `stripComments`; e2e capture mới phủ một flow. Sửa: dùng AST (ESLint `no-restricted-globals`/`-properties`/`-syntax`) hoặc tokenizer TypeScript thay regex; quét cả `.js`/`.jsx`; chuyển capture ở cấp context vào fixture chung cho mọi e2e; cân nhắc Trusted Types | Tech Lead + Frontend | trước khi M4 vào G3b (M4 có file PII) |
| SEC-M3-006a | S3 | Tab khác vẫn hiện và tải được backup đã xóa (P4). Sửa: khi nhận `wiped` thì xóa hoặc remount `BackupList` (đưa `generation` vào controller hoặc dùng key theo một bộ đếm wipe) | Frontend | trước khi M4 vào G3b. Nâng lên S2 nếu tới M4 G3b vẫn mở |
| SEC-M3-007 | S3 → đã sửa trên preview | Kiểm lại header và framing trên production (G4a checklist) | Release Manager | G4a đầu tiên |

## Proposed exceptions (cần Release Manager chấp thuận)

Exception R1 (SEC-M3-001…007) **hết hạn ngày 2026-11-08** và **chưa từng được chấp thuận**. Exception dưới đây chỉ là đề xuất. Báo cáo này không tự phê duyệt.

| Exception | Phạm vi | Mitigation bắt buộc trong thời gian hiệu lực | Owner | Hết hạn đề xuất |
| --- | --- | --- | --- | --- |
| EXC-SEC-M3-R2-A | **SEC-M3-102 (S2)** | Chỉ áp dụng nếu chưa sửa trước lần nạp HK II. Trước **mỗi** lần `import` thật: Data Reviewer mở file nguồn, **bỏ ẩn mọi cột, hàng và sheet**, liệt kê mọi tiêu đề ngoài danh sách canonical; sau `import`, đọc tập nhãn `info` khác nhau trong `timetable.json` và ghi danh sách đó vào Decision log của báo cáo; không có cột mang dữ liệu cá nhân (SĐT, email…). Nếu có, dừng và không push. Không `validate` nếu chưa có dòng ghi đó | Data Reviewer (mitigation), Data Parser (fix) | lần `publish` dữ liệu thật đầu tiên hoặc 2026-11-15, tùy mốc nào tới trước |
| EXC-SEC-M3-R2-B | SEC-M3-001, -101, -103 (S3) | Không `retract` một kỳ khi chưa có bản thay thế, trừ trường hợp khẩn cấp, và nếu phải làm thì kèm thông báo cho người dùng beta; với SEC-M3-101, mọi `validate`/`publish` phải qua PR có người thứ hai review diff `data/`; với SEC-M3-103, chỉ nạp file tải trực tiếp từ nguồn chính thức, chạy `test:real` trước | Release Manager; Tech Lead; Data Parser | G4b drill đầu tiên hoặc 2026-11-15 |
| EXC-SEC-M3-R2-C | SEC-M3-003, -104, -007 (S3) | Không bật automatic production deployment trước G4a (OPERATIONS §1); không đặt `NODE_ENV` trong dashboard Pages; G4a checklist phải có `grep allowUnpublished:!1` trên bundle production và `curl -I` header production | Release Manager + Tech Lead | G4a đầu tiên |
| EXC-SEC-M3-R2-D | SEC-M3-005, -006a (S3) | M4 chưa có file picker; beta nội bộ không chứa dữ liệu từ file đăng ký | Tech Lead + Frontend | trước khi M4 vào G3b |

## Limitations

- **Phạm vi probe:**
  - probe trình duyệt chỉ chạy trên Chromium headless, không chạy WebKit, Firefox hay thiết bị thật;
  - các kịch bản loader và SW chạy trên server probe local có áp `_headers`, không trên Cloudflare;
  - trên preview thật chỉ làm hai việc: `curl -I` và kiểm framing (request đọc, không tải lớn).
- **Biến môi trường Cloudflare:** không tái tạo môi trường build thật của Cloudflare; các biến `CF_PAGES`/`CF_PAGES_BRANCH`/`NODE_ENV` được đặt tay trên máy local.
- **Số byte ở P3:** con số "server đã ghi" gồm cả buffer socket, nên không đo được chính xác số byte client đã đọc. Kết luận dựa vào thông báo UI và việc kết nối bị hủy.
- **Dataset CLI:** chỉ kiểm trên dữ liệu tổng hợp. Chưa chạy G4b drill thật.
- **Kiểm tra tay chưa làm:** không mở `.doc`/`.ics` trong Word hay ứng dụng lịch.
- **Supply chain:** `npm audit` phản ánh registry tại thời điểm chạy. Không xác minh ngày phát hành package.
- **Phạm vi đánh giá:** không đánh giá pháp lý (data region D-004) và không review G1 cho ADR-0011/0012. Cả hai ADR vẫn `G1 acknowledgement pending`.

## Decision

- **Decision: `security-pass-with-exception`**, có điều kiện:
  - Không có S0/S1.
  - Có 1 S2 mới (SEC-M3-102) và các S3 (SEC-M3-001, -003, -005, -006a, -101, -103, -104).
  - Đã xác nhận đóng: SEC-M3-002, SEC-M3-004, SEC-M3-006b/#6. SEC-M3-007 đã đóng trên preview.
  - Privacy boundary của app được giữ:
    - 275/275 request đều cùng origin và là GET;
    - không có analytics;
    - dữ liệu hiển thị dạng text và vô hại trong DOM, `.doc`, `.ics`;
    - không có PII trong repo.
- **Điều kiện ràng buộc:** quyết định này chỉ có hiệu lực cho code M3 tại `2ab03cd`. Với **G4b, tức mọi lần `import`/`validate`/`publish` dữ liệu thật**, quyết định là **`security-no-go`** cho tới khi SEC-M3-102 được sửa, hoặc EXC-SEC-M3-R2-A được Release Manager chấp thuận và mitigation được ghi lại. Các exception S3 cũng cần Release Manager chấp thuận trước ngày 2026-11-08, là ngày exception R1 hết hạn.
- **Remediation và retest:**
  - SEC-M3-001: kịch bản P1b2 (2 kỳ, thu hồi kỳ không active, rồi offline);
  - SEC-M3-003: build với `NODE_ENV=development` trên `main` phải ra `!1` hoặc build fail, cộng một e2e chạy cờ tắt;
  - SEC-M3-005: chạy lại 10 mẫu lách ở C16;
  - SEC-M3-006a: P4;
  - SEC-M3-101: chạy lại 6 bước ở C15;
  - SEC-M3-102: chạy lại C14, workbook cột ẩn phải bị `hold` hoặc chặn;
  - SEC-M3-103: chạy lại 4 workbook ở C13, mỗi cái phải bị từ chối dưới 1 giây;
  - SEC-M3-104: chạy lại các bước tương ứng ở C15;
  - SEC-M3-007: `curl -I` trên production ở G4a.
- **Reopen G3b khi:**
  - đổi loader, storage, SW, CSP hoặc header;
  - đổi vòng đời trong `scripts/dataset.mjs`/`site-data.mjs`;
  - đổi parser có ảnh hưởng tới `info`;
  - M4 thêm file picker.
- **Actor/date:** Claude subagent đóng vai Security Reviewer, 2026-11-05T17:17Z. **Không phải sign-off của người.**
- **Next owner acknowledgement:** Release Manager (EXC-A…D), Data Parser + Data Reviewer (SEC-M3-102/103), Tech Lead (SEC-M3-101/104/005), Frontend (SEC-M3-001/003/006a). Hiện pending.

## Evidence Envelope

> **Artifact ID:** `EVID-SEC-M3-002` · **Status:** `needs_review` · **Canonical gate:** `G3b` · **Owner:** Security Reviewer (agent role) · **Last reviewed:** 2026-11-05 · **Related docs:** [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md), [Evidence envelope template](../../.claude/templates/EVIDENCE_ENVELOPE.md) · **Decision actor:** Claude subagent (Security Reviewer role), không phải người · **Receiving owner:** Release Manager / Tech Lead, chưa xác nhận

- **Source / traceability:**
  - SECURITY_PRIVACY §2–§5, §9;
  - ADR-0010/0011/0012;
  - SPEC-M3-001 AC-M3-06/-07/-13;
  - ledger EVID-M3-001 #6, #8–#14, #22.
  - P0 completeness claim: `NA`, vì G3b không chứng nhận độ phủ P0.
- **Immutable execution identity:**
  - target commit `2ab03cd7385eb5eafd64251621158e45bed181ba`, base `4681c633af9344a7c541fa91bd45a8a9f4a904be`;
  - deviation local duy nhất là cổng Playwright 4382, không commit;
  - không có run ID CI cho lần chạy này vì chạy local;
  - toolchain như ở mục Scope.
- **Lệnh và exit code:** như bảng C1–C16. `npm run check` 0, `npm run test:e2e` 0, `npm audit` 0/0, crash parser OOM exit 134 là kết quả probe mong đợi.
- **Data integrity:**
  - chỉ dùng dataset tổng hợp do `build-synthetic-dataset.mjs` sinh trong worktree riêng (`synthetic-uet-2026-2027-h2.1`, timetable sha256 `2ea99c5e…2b7a7f`);
  - workbook probe do script tự sinh, file nằm ngoài repo và đã xóa cùng worktree;
  - không có file thật.
- **Evidence:** các bảng Re-verification, Findings và Commands ở trên. Script và log nằm trong scratchpad của agent, không commit.
- **Risk:** tại `2ab03cd` có 1 S2 + 7 S3 mở; sau phụ lục R2.1 tại `d51c65b` còn **0 S0, 0 S1, 0 S2** và chỉ còn 3 mục S3 phần dư nhẹ ở mức CI/cấu hình dài hạn (`SEC-M3-101(e)`, `SEC-M3-003(b/d)`, `SEC-M3-005` AST lint cho M4).
- **Decision:** `security-pass-with-exception` tại `d51c65b`; **đã gỡ bỏ `security-no-go` cho G4b dữ liệu thật** sau khi `SEC-M3-102` (S2) và `SEC-M3-103` (`AUD-010`) được xác nhận `verified-fixed` (xem phụ lục R2.1 bên dưới).

---

## Phụ lục R2.1 — Hậu kiểm hẹp tại `d51c65bc10f91ed7cd23462bdef901f5a81d5acc` (2026-11-06T05:39Z)

- **Target bất biến:** `d51c65bc10f91ed7cd23462bdef901f5a81d5acc` (`db0058c..d51c65b` trên nhánh `m3-web-app`).
- **Kết quả hậu kiểm độc lập theo từng finding:**
  - **`SEC-M3-102` (S2):** **`verified-fixed`** — `ooxml.ts` bỏ qua sheet `hidden`/`veryHidden`, cột ẩn `<col hidden="1">` và dòng ẩn `<row hidden="1">` (kể cả trong `fillMergedCells`); `uet-config.ts` chặn tiêu đề PII (`FORBIDDEN_HEADER_PATTERNS`) bằng lỗi `UNSUPPORTED_INPUT` và loại khỏi `info`; `uet-xlsx-adapter.ts` đưa `infoColumns` vào `formatFingerprint` (`status: "hold"` + `FORMAT_UNRECOGNIZED` khi có cột lạ); `dataset.mjs` + `dataset-core.mjs` in bảng `Extra (info) columns` và bắt buộc Data Reviewer truyền `--accept-new-format "<reason>"` khi `validate`. **Không còn cần exception `EXC-SEC-M3-R2-A`; gỡ bỏ trạng thái `security-no-go` cho G4b.**
  - **`SEC-M3-103` / `AUD-010` (S3 / S2):** **`verified-fixed`** — `ooxml.ts` áp giới hạn `MAX_COL_INDEX = 16383`, `MAX_ROW_NUMBER = 100000`, `MAX_MERGED_CELLS = 200000`. Cả 5 mẫu C13 (`mergeCell A2:XFD1048576`, `<c r="FXSHRXW2">`, `mergeCell A2:Z200000`, `<row r="4000000000">`, `mergeCell A2:Z10000`) đều fail-closed với `MALFORMED_INPUT` trong **1,1–5,5 ms** (so với crash OOM 5s và 47,7s CPU ở `2ab03cd`).
  - **`SEC-M3-104` (S3):** **`verified-fixed`** — `sanitizeCliText` chặn newline/control chars trong mọi cờ tự do của CLI; `dataset check` và `site-data.mjs` kiểm `isSafeRelativePath`, chặn symlink và chỉ chép các file được manifest tham chiếu.
  - **`SEC-M3-001` (S3):** **`verified-fixed`** — `loader.ts:173-176` quét toàn bộ `cache.all()` ngay khi tải manifest thành công và xóa mọi bản lưu có `datasetVersion` đã `retracted` ở cả kỳ không active (`loader.test.ts:74-101`).
  - **`SEC-M3-006a` (S3):** **`verified-fixed`** — `wipeGeneration` trong `controller.ts` truyền xuống `Footer` (`Chrome.tsx:84`) remount `BackupList` ở cả tab nhận thông điệp `wiped` qua `BroadcastChannel`.
  - **`SEC-M3-101` (S3):** **`partially-fixed`** (đã đóng (a)(b)(c)(d): `normalizeActor`, fail-closed khi thiếu `importer` trong `audit.jsonl`, kiểm actor khi `publish`, và `verifyAuditTrail` trong `dataset check`; chỉ còn mục (e) mức quy trình/CI đối chiếu `git diff` nhánh base để chặn việc vừa sửa file `timetable.json` đã `published` vừa sửa lại hash trong cùng một PR — giảm thiểu bằng review PR trên `data/` ở G4b).
  - **`SEC-M3-003` (S3):** **`partially-fixed`** (đã đóng (a)(c): `vite.config.ts` ép `NODE_ENV=production` và `VITE_ALLOW_UNPUBLISHED="false"` trên nhánh `main`, `controller.ts` kiểm `VITE_ALLOW_UNPUBLISHED !== "false"`, và `site-data.mjs` lọc bỏ `candidate`/`validated` khỏi bản build production; còn mục (b)(d) giữ trong checklist G4a: `grep allowUnpublished:!1` trên bundle release).
  - **`SEC-M3-005` (S3):** **`partially-fixed`** (đã sửa lỗi `stripComments` xóa nhầm code sau chuỗi có `//` hoặc `/*` và mở rộng quét `.js`/`.jsx`/`.cjs`; việc nâng lên AST lint bằng ESLint giữ đúng lộ trình trước khi M4 vào G3b).
- **Quyết định G3b cập nhật tại `d51c65b`:** **`security-pass-with-exception`** cho cả code M3 và đường nạp dữ liệu G4b (0 S0/S1/S2; chỉ còn 3 mục S3 phần dư nhẹ cho checklist G4a/G4b và M4).
