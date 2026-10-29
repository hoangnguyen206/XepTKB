# M3 evidence envelope — Core UI & export

> **Artifact ID:** `EVID-M3-001`  
> **Artifact status:** `blocked` — G3a và G3c `no-go` (1 S1 mở); chờ owner sửa  
> **Canonical gate/sub-gate:** `G0 + G1 + G2 + G3a + G3b + G3c`  
> **Owner:** Tech Lead  
> **Last reviewed:** 2026-10-25  
> **Related docs:** [M3 spec](M3-SPEC.md), [M3 design handoff](M3-DESIGN-HANDOFF.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [M3 implementation handoff](M3-IMPLEMENTATION-HANDOFF.md), [G3a QA](M3-G3a-QA-REPORT.md), [G3b security](M3-G3b-SECURITY-REVIEW.md), [G3c review](M3-G3c-INDEPENDENT-REVIEW.md), [Implementation plan §2](../IMPLEMENTATION_PLAN.md)  
> **Decision actor / UTC timestamp:** tổng hợp bởi Claude Code agent (orchestrator) 2026-10-25 từ ba báo cáo G3 của agent role — không phải sign-off của người  
> **Receiving owner / acknowledgement:** Owner (sẽ tự sửa finding), Product (G0), Tech Lead (G1), Release Manager (exception G3b) — pending

## Source and traceability

- Source docs: SPEC-M3-001 (G0), DESIGN-M3-001 + ADR-0010 (G1), IMPL-M3-001 (G2), TEST-M3-001 (G3a), SEC-REVIEW-M3-001 (G3b), REVIEW-M3-001 (G3c).
- Source version: G3 ngày 2026-10-25 chạy trên working tree **chưa commit** trên `main` @ `4681c63`; từ 2026-10-29 change set nằm ở commit `82cb85b` (xem mục Immutable execution identity).
- Requirement/AC: M3 slice của FR-01–FR-08, FR-11, AC-01, AC-06, AC-07; AC-M3-01…13 trong SPEC-M3-001.
- P0 completeness claim: `no` — M3 là một milestone; M4 (registration UI) và M5 (admin publish, hardening, release) còn lại. Trong phạm vi M3, AC-M3-03 và AC-M3-12 **fail** ở kịch bản dataset mới đổi nhóm (QA-M3-001/REV-M3-001).
- G0/G1: SPEC-M3-001, DESIGN-M3-001, ADR-0010 vẫn `g0/g1-blocked` về hình thức (chưa có actor/date). Implementation làm theo yêu cầu owner ngày 2026-10-25.

## Immutable execution identity

- Commit/PR: `82cb85b` trên nhánh `m3-web-app` (base `4681c63`), [draft PR #1](https://github.com/hoangnguyen206/XepTKB/pull/1), commit ngày 2026-10-29. So với target mà G3 ngày 2026-10-25 đã chạy, commit này chỉ thêm việc nâng `actions/checkout`/`actions/setup-node` từ `v4` lên `v5` trong workflow CI, không đổi code app. Kiểm tra ngày 2026-10-29: 16/16 file có hash trong G3b khớp với nội dung trong `82cb85b`; riêng `apps/web/playwright.config.ts` thì G3b ghi `4eb15909…3331a`, thực tế là `4eb1590b…3331a`, nên đây là lỗi chép tay vì file không đổi từ 25/10 02:50. Sau khi G3a kết thúc (25/10 07:18), file code duy nhất bị sửa là workflow CI. G3 ngày 2026-10-25 vẫn gắn với working tree chưa commit; lần chạy lại G3 phải dùng một commit cố định.
- Thay đổi sau IMPL-M3-001 (trước khi G3 chạy lại lần 2): `apps/web/src/app/controller.ts` (dev server `import.meta.env.DEV` được nạp dữ liệu chưa công bố), script root `dev`, `README.md` viết lại; agent QA thêm `apps/web/src/qa-m3.test.tsx` (8 test) và `apps/web/e2e/qa-m3.spec.ts` (4 test).
- Toolchain: Windows 10 Pro 19045, Node 22.22.2, npm 12.0.2, TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0 (Chromium headless shell 156.0.8078.4; agent QA cài thêm WebKit cho smoke).
- Lệnh và kết quả (chạy lại 2026-10-25 sau khi G3 kết thúc, cùng working tree):

| Lệnh | Exit | Kết quả |
| --- | ---: | --- |
| `npm run check` | 0 | lint (packages + web boundary) pass; typecheck pass; node:test **78/78**; Vitest **39/39** (31 + 8 của QA); parser fixtures **5/5** |
| `npm run test:e2e` | 0 | Playwright **14/14** (10 + 4 của QA), bản build production có service worker + CSP |
| `node scripts/bench-m3.mjs` | 0 | ~1.200 lớp: search p95 2–5 ms, conflict p95 2–5 ms (máy dev; ngân sách chính thức là M5) |
| `npm audit` / `npm audit --omit=dev` | 0 | 0 vulnerabilities (G3b thêm `npm audit signatures`: 104 package verified) |
| Fix round 2026-10-29 (findings 1–2 + C-09), local Windows Node 22.22.2: `npm run check`, `npm run test:e2e` | 0 / 0 | node:test **84/84**, Vitest **43/43**, fixtures **6/6**; Playwright **15/15** (thêm test REV-M3-001/003). CI trên PR #1 tại `8436c0c` (gồm fix `3b628a3`): [run 40914822770](https://github.com/hoangnguyen206/XepTKB/actions/runs/40914822770), Node 22.23.4 — `check` node:test 84/84, Vitest 43/43, fixtures 6/6; `e2e` 15/15 |
| Fix round 2026-10-30 (S2 #3–6, 13 S3, C-10 timetable format, Q-012), local Windows Node 22.22.2: `npm run check`, `npm run test:e2e`, `npm run test:real` (TKB HK I thật, ngoài repo), probe WebKit | 0 / 0 / 0 / 0 | node:test **89/89**, Vitest **52/52**, fixtures **6/6**; Playwright **17/17**; TKB thật 1077 lớp, 0 lỗi, unaccounted 0; WebKit 0/24 banner giả. CI: xem PR #1 |
| GitHub Actions trên PR #1 ([run 40907344256](https://github.com/hoangnguyen206/XepTKB/actions/runs/40907344256), 2026-10-29, merge `82cb85b` vào `4681c63`, ubuntu-24.04, Node 22.23.4, npm 10.9.9) | 0 | job `check`: lint + typecheck pass, node:test **78/78**, Vitest **39/39**, fixtures **5/5**, `npm ci` 0 vulnerabilities; job `e2e`: Playwright **14/14** |

## Data and artefact integrity

- Fixture: dataset tổng hợp sinh bởi `scripts/build-synthetic-dataset.mjs` qua adapter `uet-xlsx` thật; mã môn `SYN…`, `source.type = synthetic-fixture`, status `candidate`. Không có dữ liệu thật.
- Hash: loader kiểm tra byte length + SHA-256 trước khi parse. QA-M3-009 đã sửa 2026-10-30: dataset mẫu tái lập được (cùng SHA-256 giữa các lần build và múi giờ).
- Schema: domain `0.2.0` (không đổi); manifest/metadata `1.0` theo ADR-0010 §2; Plan record envelope `0.2.0` có migration từ `0.1.0`.

## Evidence links and results

| Evidence | Check | Kết quả |
| --- | --- | --- |
| [TEST-M3-001](M3-G3a-QA-REPORT.md) | G3a QA: suite + AC matrix + probe đối kháng (Chromium, WebKit smoke, nhiều múi giờ) | **`qa-no-go`** — QA-M3-001 (S1) |
| [SEC-REVIEW-M3-001](M3-G3b-SECURITY-REVIEW.md) | G3b: XSS (DOM/Word/ICS/PNG), CSP, same-origin, SW cache, integrity, wipe, supply chain | **`security-pass-with-exception`** — 7 × S3, exception hết hạn ở G4a/G4b đầu tiên hoặc 2026-11-08 (chưa có Release Manager chấp thuận) |
| [REVIEW-M3-001](M3-G3c-INDEPENDENT-REVIEW.md) | G3c: đối chiếu contract, hành vi, độ phủ test, docs | **`review-no-go`** — REV-M3-001 (S1) + thiếu envelope (REV-M3-005) |
| [m3-screens/](m3-screens/) | Ảnh màn hình 360/768/1280 (dữ liệu mẫu) | tham khảo |

## Risk and controls

### Finding register (gộp trùng; ID gốc giữ nguyên để tra báo cáo)

| # | Severity | ID gốc | Tóm tắt | Owner đề xuất | Hạn đề xuất | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **S1** | QA-M3-001 = REV-M3-001 | Dataset mới đổi tên nhóm hoặc bắt buộc chọn nhóm cho lớp đã chọn → lớp đó (kể cả buổi CL) rơi khỏi kiểm tra trùng lịch, lưới, danh sách ngày và mọi file xuất, trong khi app báo "✓ Không có lớp nào trùng lịch" và rebase báo "Mọi lớp đã chọn vẫn còn". Gốc: `packages/domain/src/plan.ts:46,50` trả `sessions: []`; `apps/web/src/model/plan-view.ts` bỏ qua `resolution.issues`; `missingPicks` chỉ kiểm tra lớp còn tồn tại; `PlanSummary.tsx` chỉ hiện GROUP_REQUIRED/SECTION_NOT_FOUND | Frontend/Coder + Tech Lead (quyết định contract cho pick không giải được) | trước khi chạy lại G3 | **fixed, chờ G3 chạy lại** (2026-10-29): contract ở [ADR-0009 amendment](../adr/ADR-0009-m2-domain-engine-schema.md) (13), UI theo khuyến nghị REV-M3-001 (1)–(4); test domain/model/e2e theo repro của G3c — xem [IMPL-M3-001 fix round](M3-IMPLEMENTATION-HANDOFF.md) |
| 2 | S2 | QA-M3-002 = REV-M3-003 | Một pick không giải được chặn mọi lần chọn lớp sau; thông báo đổ lỗi cho lớp đang chọn (`picker.ts:92-99` → domain `addPlanPick` từ chối khi có bất kỳ lỗi nào) | Frontend/Coder | cùng finding 1 | **fixed, chờ G3 chạy lại** (2026-10-29): [ADR-0009 amendment](../adr/ADR-0009-m2-domain-engine-schema.md) (14) |
| 3 | S2 | QA-M3-003 = REV-M3-002 | "Xóa dữ liệu trên máy" xóa cache service worker, worker không precache lại → offline hỏng tới lần deploy sau (`local-data.ts:26-31`, `vite.config.ts`) | Frontend/Coder | trước G4a | **fixed, chờ G3** (2026-10-30): wipe gỡ đăng ký service worker; e2e `REV-M3-002 — after 'Xóa dữ liệu trên máy'…` (wipe → online → offline mở được) |
| 4 | S2 | REV-M3-004 | Ghi IndexedDB lỗi (hết dung lượng) làm bỏ dataset đã kiểm tra hợp lệ và báo nhầm "Dữ liệu tải về không hợp lệ"; mở qua HTTP (không HTTPS) cũng báo nhầm như vậy (`loader.ts:119-123,151-161`) | Frontend/Coder | trước G4a | **fixed, chờ G3** (2026-10-30): ghi cache lỗi vẫn dùng dữ liệu đã kiểm tra + thông báo "không lưu được để dùng offline"; thiếu WebCrypto → mã `INSECURE_CONTEXT` "cần HTTPS"; 2 unit test |
| 5 | S2 | QA-M3-004 | WebKit: banner "Có phiên bản mới" giả xuất hiện 9/12 lần mở đầu, nút "Tải lại" không làm gì (`sw-client.ts:23-25,32-33`); cần xác nhận trên iPhone thật | Frontend/Coder + owner (thiết bị thật) | trước G4a | **fixed trên WebKit desktop, chờ iPhone thật + G3** (2026-10-30): chỉ đề nghị cập nhật khi trang được worker cũ điều khiển lúc tải và worker mới đang `installed`; "Tải lại" luôn có tác dụng. Probe Playwright WebKit 2370: 0/24 lần tải có banner giả; bản cập nhật thật vẫn hiện và áp dụng được (Chromium + WebKit). Đánh đổi: cập nhật phát hành giữa lần truy cập đầu tiên chỉ được đề nghị ở lần mở sau |
| 6 | S2 | QA-M3-005 (+ SEC-M3-006b) | Hai tab cùng mở: ghi sau đè ghi trước, mất lớp đã chọn; xóa dữ liệu ở tab này, tab kia ghi lại Plan cũ (`controller.ts:89-108`) | Frontend/Coder | trước M4 G3b (M4 lưu dữ liệu từ file đăng ký) | **fixed, chờ G3** (2026-10-30): lưu kiểu so sánh-rồi-ghi trong một transaction IndexedDB theo phiên bản mà thao tác dựa vào; `BroadcastChannel` báo tab khác tải lại / reset sau wipe; unit test + e2e `QA-M3-005 — two tabs…` |
| 7 | S2 (process) | REV-M3-005 = QA-M3-010 | Thiếu envelope EVID-M3-001 và target G2 chưa bất biến | Tech Lead | trước khi chạy lại G3 | **một phần**: envelope đã tạo (file này); target đã commit `82cb85b` (2026-10-29), nhưng G3 phải chạy lại trên commit cố định mới đóng được |
| 8 | S3 | SEC-M3-001 | Dataset đã bị thu hồi (`retracted`) hiện lại từ cache khi sau đó mất mạng | Frontend (loader) | trước G4b, ≤ 2026-11-08 | **fixed, chờ G3b** (2026-10-30): manifest đọc được mà đánh dấu bản cache là `retracted` thì xóa bản cache; test mất mạng sau thu hồi |
| 9 | S3 | SEC-M3-002 | URL artifact dạng `%2e%2e` lọt qua `isSafeRelativeUrl`, thoát khỏi `data/` (SHA-256 vẫn được kiểm tra) | Frontend | trước G4b, ≤ 2026-11-08 | **fixed, chờ G3b**: từ chối mọi `%` trong URL artifact; test `%2e%2e`, `%2E%2E`, `%2f` |
| 10 | S3 | SEC-M3-003 | Cờ cho phép dữ liệu chưa công bố là cờ build; build e2e ghi vào cùng `apps/web/dist` với bản release; chính sách cờ tắt chưa có test trên trình duyệt | Frontend + Release Manager | trước G4a đầu tiên | **một phần**: build e2e ghi vào `apps/web/dist-e2e` (ignored), `dist/` chỉ còn cho bản release; chưa có test trình duyệt với cờ tắt (chỉ unit test loader `production builds only accept published datasets`) |
| 11 | S3 | SEC-M3-004 | Giới hạn kích thước chỉ kiểm sau khi đọc hết body khi thiếu `Content-Length` | Frontend | M5 hardening (trước G4a) | **fixed, chờ G3b**: đọc stream, dừng khi vượt giới hạn; test response không có `Content-Length` |
| 12 | S3 | SEC-M3-005 | Lint guard là regex theo dòng, dễ lách; không phủ XHR/sendBeacon/WebSocket; mã service worker ngoài phạm vi; e2e bắt request bằng `page.on` bỏ sót request của SW | Tech Lead + Frontend | trước khi M4 bắt đầu | **fixed, chờ G3b**: lint quét cả file (bỏ comment), mọi tham chiếu `fetch`/XHR/`sendBeacon`/WebSocket/EventSource/RTCPeerConnection/`importScripts`, thêm phạm vi mã service worker (`vite.config.ts`, chỉ cho `fetch(request)`); probe 4 kiểu lách đều bị bắt; e2e bắt request ở cấp context. Vẫn là heuristic tĩnh, không thay được kiểm tra mạng lúc chạy |
| 13 | S3 | SEC-M3-006a | Danh sách bản sao lưu vẫn hiện (và tải được) bản ghi đã bị xóa sau khi wipe | Frontend | trước M4 G3b | **fixed, chờ G3b**: danh sách được dựng lại sau wipe |
| 14 | S3 | SEC-M3-007 | CSP chỉ ở thẻ `<meta>` (không có `frame-ancestors`); chưa định nghĩa header khi deploy (XFO, nosniff, Referrer-Policy, HSTS); app nhúng được vào iframe trang khác; WebCrypto cần HTTPS | Release Manager + Tech Lead | trước G4a đầu tiên | **một phần**: build sinh `_headers` (định dạng Cloudflare Pages/Netlify) từ cùng hằng CSP + `frame-ancestors 'none'`, XFO, nosniff, Referrer-Policy, Permissions-Policy, HSTS, COOP; e2e so header với CSP meta. Còn mở: chọn host (D-004) và xác minh header trên host thật |
| 15 | S3 | QA-M3-006 | Offline: không mở được Plan của kỳ khác kỳ xem gần nhất (`loader.ts:139` chỉ trả kỳ đang cache) | Frontend/Coder | 2026-11-08 | **fixed, chờ G3**: offline mở được mọi kỳ đã lưu và liệt kê chúng để chuyển; unit test |
| 16 | S3 | QA-M3-007 = REV-M3-007 | Thẻ lớp đã chọn mất nhãn "⚠ Trùng lịch"; nút "Đổi nhóm" không có chữ báo trùng | Frontend/Coder | 2026-11-08 | **fixed, chờ G3**: thẻ đã chọn vẫn tính trùng; nút thành "Vẫn đổi nhóm (đang trùng lịch)"; e2e REV-M3-001/003 kiểm nhãn này |
| 17 | S3 | QA-M3-008 = REV-M3-006 | Thanh tóm tắt hiện "0 tín chỉ" khi môn chưa rõ tín chỉ (trái AC-M3-11) | Frontend/Coder | 2026-11-08 | **fixed, chờ G3**: "chưa rõ tín chỉ" / "N tín chỉ + M môn chưa rõ tín chỉ"; component test |
| 18 | S3 | QA-M3-009 | Dataset mẫu: cùng `datasetVersion` nhưng SHA-256 khác nhau mỗi lần build (zip không cố định mtime) | Data Parser / Frontend | 2026-11-08 | **fixed** (2026-10-30): mtime ZIP cố định; hai lần build và một lần build dưới `TZ=UTC` cho cùng SHA-256 |
| 19 | S3 | REV-M3-008 | Test thiếu: campus warning, bàn phím tới bước xuất file, viewport 1200 (đúng breakpoint), nhóm đổi khi stale, wipe rồi offline, cache ghi lỗi | Tester + Frontend/Coder | trước khi ký lại G3a | **một phần**: đã thêm nhóm đổi khi stale, wipe rồi offline, cache ghi lỗi, viewport 1200; còn thiếu campus warning và bàn phím tới bước xuất file |
| 20 | S3 | REV-M3-009 | Docs lệch code: (a) chính sách DEV, (b) `validatePlan` vs `isPlanShape`, (c) migration `0.1.0` tự xử lý `planKind`/`final` mâu thuẫn thay vì từ chối như ADR-0009, (d) banner "chưa công bố" bị ẩn với dữ liệu mẫu, (e) CSP có thêm `font-src`, (f) TECH_STACK/ARCHITECTURE/README/plan chưa cập nhật | Tech Lead | cùng G1 acknowledgement | **fixed, chờ G3c**: (a)(b)(e)(f) docs 2026-10-25; (c) code đổi theo ADR-0009 — bản ghi mâu thuẫn vào backups (test); (d) banner "chưa được công bố" hiện cho mọi dataset chưa publish, kể cả dữ liệu mẫu |
| 21 | S3 | REV-M3-010 | PNG: buổi 1 tiết trùng lịch không có chữ "⚠ TRÙNG LỊCH" (chỉ có màu/gạch chéo) | Frontend/Coder | 2026-11-08 | **fixed, chờ G3**: chữ cảnh báo đứng đầu khối (`⚠ TRÙNG LỊCH · <mã>`); unit test canvas với khối 1 tiết |

- Privacy/security: không có PII trong M3; chỉ request GET cùng origin; không analytics; dữ liệu dataset hiển thị như text (G3b kiểm tra động với 9 kiểu payload).
- Waiver/exception: G3b đề xuất exception cho 7 S3 (SEC-M3-001…007), hết hạn ở G4a/G4b đầu tiên hoặc 2026-11-08 — **chưa có Release Manager chấp thuận**. Không có waiver nào cho S1/S2.
- Rollback: revert change set M3; Plan record vẫn schema `0.2.0`; không có deploy.
- Monitoring/canary: `N/A — chưa deploy`.

## Decision and next step

- Gate decision tổng hợp: **M3 chưa qua G3** — G3a `qa-no-go`, G3b `security-pass-with-exception`, G3c `review-no-go`. Không được chuyển sang G4a/G4b.
- Owner đã chọn tự sửa sau (2026-10-25). Điều kiện chạy lại G3:
  1. sửa finding 1–2 (S1/S2) kèm regression test theo repro của QA (probe 2b/2c/7) và REV-M3-001 (đã làm 2026-10-29, chờ G3 xác nhận; probe gốc của QA/G3c nằm trong scratchpad của họ, chưa chạy lại);
  2. sửa hoặc có owner + mitigation + expiry được Release Manager chấp thuận cho finding 3–6 (đã sửa 2026-10-30; #5 còn cần iPhone thật);
  3. commit change set M3 (đã làm: `82cb85b`, 2026-10-29) và cập nhật IMPL-M3-001 (đã làm: các mục fix round 2026-10-29 và 2026-10-30);
  4. Product/Tech Lead ghi actor/date cho G0 (SPEC-M3-001) và G1 (ADR-0010), chốt D-M3-1…4 và deviation (c)(d) của REV-M3-009;
  5. chạy lại `npm run check`, `npm run test:e2e`, các probe của QA/G3b; ba báo cáo G3 mới thay thế bản ngày 2026-10-25.
- Kiểm tra thủ công còn thiếu (owner): import `.ics` vào ứng dụng lịch; xem PNG/Word/bản in; Safari iOS, Chrome Android, trình duyệt trong Zalo/Messenger; trình đọc màn hình. CI trên GitHub đã chạy và xanh trên PR #1 (2026-10-29).
