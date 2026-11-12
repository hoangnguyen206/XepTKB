# M5 spec — Release hardening và launch readiness

> **Artifact ID:** `SPEC-M5-001`  
> **Artifact status:** `g0-approved`  
> **Canonical gate:** `G0`  
> **Owner:** Product Spec  
> **Last reviewed:** 2026-11-10  
> **Related docs:** [Implementation plan §2/§7/§10](../IMPLEMENTATION_PLAN.md), [PRD](../PRD.md), [Operations](../OPERATIONS.md), [Security & privacy](../SECURITY_PRIVACY.md), [QA plan](../QA_TEST_PLAN.md), [ADR-0007](../adr/ADR-0007-static-artifact-cli-admin.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [M5 design handoff](M5-DESIGN-HANDOFF.md), [M4 spec](M4-SPEC.md), [EVID-M4-001](M4-EVIDENCE-ENVELOPE.md), [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md)  
> **Evidence envelope:** `EVID-M5-001` ([M5-EVIDENCE-ENVELOPE.md](M5-EVIDENCE-ENVELOPE.md) — chưa tạo; `N/A — docs-only` cho tới G2)  
> **Decision actor / UTC timestamp:** Approved by Owner (Product / Tech Lead / Security / Release Manager) at `2026-11-12T04:19Z` (chat)  
> **Receiving owner / acknowledgement:** Tech Lead (G1, `DESIGN-M5-001`), Frontend/Coder, Tester, Security Reviewer, Independent Reviewer, Release Manager — chưa acknowledge

## 1. Source and traceability

- **Base:** nhánh `m5-release-hardening` tách từ `main` @ `0e849f1` (M0–M4 đã merge). Brief gốc SHA-256 `295BB158F14D9C3C23F920A0CFF7A5DBDC1B76FC88885AFE9992FBA55D650B1E` (theo `CLAUDE.md` §2).
- **Source sections:** `PRD.md` §4 P0 #1 (dataset preload + CLI ingest theo ADR-0007), P0 #12 (version/thời điểm cập nhật/nguồn/cảnh báo đối chiếu), §6 FR-01, FR-12, §8 NFR (performance, availability/offline, privacy, accessibility, responsive, compatibility, integrity), §9 analytics/feedback, §10 rủi ro (“dữ liệu stale”, “bị hiểu là official”), §11 open questions (tên/domain, disclaimer, analytics); `IMPLEMENTATION_PLAN.md` §2 hàng M5 (exit `G4b` drill + `G3a/G3b/G3c` → `G4a` → `G5`), §7 cut line (không cắt local-only, validation, source attribution, rollback, accessibility smoke), §10 Q-008, Q-011; `OPERATIONS.md` §§1–6; `SECURITY_PRIVACY.md` §§2, 5, 7, 9; `QA_TEST_PLAN.md` §§2, 5, 6; `ADR-0007` (static artifact + CLI admin); `ADR-0012` (publish pipeline, `--accept-single-reviewer`).
- **Requirement IDs:** P0 #1, #12, FR-01, FR-12 (P0); NFR §8 (P0 cho release); PRD §9 counters → **P1** theo D-M5-2.
- **Change history:** `2026-11-10` — tạo bản nháp từ scope brief của orchestrator và quyết định Owner trong chat (D-M5-1..3); actor: Product Spec agent. Các quyết định này **thay đổi** Q-011 (beta “chỉ M3”), PRD §9 / Q-008 (counter), `OPERATIONS.md` §1 (staging), §5 (client error), §6 (“hai admin”) và hàng M5 của plan (“two-person first publish”, “observability”, “staged release”). Theo `CLAUDE.md` §4, sau khi G0 được duyệt phải cập nhật PRD §9/§11, IMPLEMENTATION_PLAN Q-011 + hàng M5, SECURITY §7, OPERATIONS §§1/5/6/10 và docs/README (D-001/D-004/D-008) — việc này thuộc M5-I/M5-J, không sửa trong file này.

## 2. Outcome

Bản build M5 sẵn sàng cho Owner thử bằng dữ liệu thật HK I và cho quyết định `G4a` sau G3: người dùng thấy rõ phiên bản app/dữ liệu và độ cũ của dữ liệu, có cách báo sai dữ liệu mà **không có bất kỳ telemetry nào**, đọc được trang giới thiệu/quyền riêng tư đầy đủ, app tự phục hồi khi lỗi giao diện, tải nhanh hơn, cài PWA đúng chuẩn; vận hành có quy trình release/rollback/smoke có thể lặp lại; evidence M4 được kiểm chứng lại.

**Success metrics (đo ở G2/G3, owner trong ngoặc):**

1. Initial JS (gzip) sau M5 **nhỏ hơn** baseline trước M5 đo tại `0e849f1` bằng cùng script; CI fail khi vượt ngân sách §8 (Frontend/Coder).
2. `0` request mạng tới origin khác `self` và `0` request mang dữ liệu người dùng trong toàn bộ e2e mới và cũ (Security Reviewer).
3. 100% `AC-M5-01..19` có evidence `pass`; `npm run check` và `npm run test:e2e` exit `0` trên commit G2 bất biến (Tester).
4. 10/10 AC M4 (`AC-M4-01..08`, `AC-04`, `AC-05`) được G3a chạy lại với trích dẫn định danh có thật trong code (Tester; đóng `F-M5-001`).
5. Owner hoàn tất một lượt HK I validation (flow 5) với `test:real` `0` lỗi và checklist preview đạt, có ghi audit (Owner/Release Manager).

## 3. Scope

### In scope

| ID | Hạng mục | Priority |
| --- | --- | --- |
| M5-A | **Build identity:** app version (`package.json`), short commit, build time (UTC) nhúng lúc build, hiển thị ở footer + trang giới thiệu, có trong nội dung báo lỗi; `CHANGELOG.md` ở root theo quy ước tag `v0.x.y` | P0 |
| M5-B | **Báo sai dữ liệu không telemetry:** hành động “Báo sai dữ liệu” trên thẻ lớp và mục chung; dựng văn bản báo cáo không PII; nút “Sao chép”; link tùy chọn `VITE_REPORT_ISSUE_URL` (chỉ `http(s)`, validate lúc build; không đặt thì chỉ sao chép + hướng dẫn); không `fetch`/`sendBeacon`, không gửi tự động | P0 |
| M5-C | **Giới thiệu / FAQ / quyền riêng tư:** công cụ độc lập (không phải sản phẩm của nhà trường), nguồn và cách cập nhật dữ liệu (provenance), privacy notice đầy đủ (xử lý cục bộ, nội dung IndexedDB, cách xóa, không telemetry), cách báo lỗi, trình duyệt hỗ trợ (PRD §8 Tier 1/2), giới hạn đã biết | P0 |
| M5-C2 | Ô thông báo trạng thái (status message) đọc từ manifest đã publish — **không đổi schema manifest trong M5** trừ khi G1 chứng minh cần | P1 |
| M5-D | **Chỉ báo dữ liệu cũ:** cảnh báo khi `expiresAt` của dataset đang dùng đã qua; khi offline và dùng dataset đã lưu, hiện tuổi dữ liệu (`publishedAt`/thời điểm lưu) ở vị trí nhìn thấy được, không chỉ trong panel nguồn; không thêm request mạng | P0 |
| M5-E | **Error boundary:** UI phục hồi cục bộ (tải lại / xóa dữ liệu trên máy có xác nhận), không gửi báo cáo | P0 |
| M5-F | **Hiệu năng:** lazy-load luồng nhập ĐKMH (`@ky-nay/parser/registration` qua dynamic import); script ngân sách bundle chạy trong CI; ghi số đo thật ở G2 | P0 |
| M5-G | **PWA icons:** PNG 192/512, maskable 512, `apple-touch-icon` 180, sinh tái lập bằng script từ `icon.svg` hiện có (dùng Playwright Chromium đã cài), commit kèm | P0 |
| M5-H | **CI hardening:** bước `npm audit --omit=dev --audit-level=high`; script secret-scan regex trong repo (không action bên thứ ba); base kiểm tra immutability khi `push` = `github.event.before` (fallback `HEAD~1` khi SHA toàn số 0/không có) | P0 |
| M5-I | **OPERATIONS.md:** release + rollback app trên Cloudflare Pages (rollback về deployment trước / revert commit), quy ước tag + changelog, script smoke sau deploy (header `curl -I`, `manifest.json`, hash dataset) cho preview và production, định nghĩa monitoring window không telemetry, staged-release thay thế (preview URL + link beta trước khi bật production), cập nhật §1 (không có staging), §5, §6, §10 | P0 |
| M5-J | **Gói release readiness:** `docs/evidence/M5-RELEASE-CHECKLIST.md` (G4a/G4b/G5, bước chỉ Owner làm) + bản nháp release report từ template (`draft`, không bịa deploy ID) | P0 |
| M5-K | **Hướng dẫn Owner chạy HK I validation** trên nhánh preview (không phải `main`) và cách dọn dẹp | P0 |
| M5-L | **Kiểm chứng lại evidence M4** (`F-M5-001`) + checklist thiết bị Tier 1/2, trình đọc màn hình, xem export bằng mắt — **thực hiện ở G3a/G3c của M5**, không ở G2 | P0 |

### Out of scope

- Telemetry, counter, client error reporting tới bất kỳ server nào (P1, cần legal review — D-M5-2); script bên thứ ba.
- Web admin UI; kho quarantine riêng (quarantine hiện = file thô ngoài repo + trạng thái `candidate`, ADR-0012); môi trường staging.
- Custom domain / thương hiệu (D-001); deploy production `G4a` và publish `G4b` thật (bước của Owner sau G3 + có dữ liệu).
- Cấu hình term HK II (chờ file trường + lịch năm học); đa trường; mọi thay đổi parser rule hoặc dataset schema.

## 4. Actors, decisions, findings

- **Actors:** sinh viên (mobile/desktop, online/offline); Owner (đóng vai Product / Tech Lead / Security / Release Manager / Data Reviewer); agent role (Coder, Tester, Security Reviewer, Independent Reviewer).
- **Owner decisions (ghi nhận từ chat ngày 2026-11-10, chưa có UTC timestamp riêng):**
  - **D-M5-1 (mục tiêu release):** làm M5 ngay. Chưa có TKB HK II thật; Owner sẽ thử bản M5 bằng file HK I 2026–2027 thật (term `2026-2027-h1`) qua CLI trên bản preview. G4b HK II chạy khi trường phát file. Public launch (`G4a`) do Owner quyết sau M5 G3 + Owner test. **Thay thế** câu “beta nội bộ chỉ với M3” của Q-011 (M4 đã merge, beta có thể gồm nhập ĐKMH). Không deploy/publish production trong vòng triển khai M5 này.
  - **D-M5-2 (observability):** release đầu **không** có runtime telemetry: không analytics, không counter, không gửi lỗi client, không script bên thứ ba. Monitoring = trạng thái build/deploy Cloudflare Pages + smoke script sau deploy + checklist thủ công + báo lỗi do người dùng chủ động. Counter PRD §9 / Q-008 hoãn tới sau legal review → P1.
  - **D-M5-3 (two-person rule):** một maintainer. Lần publish đầu dùng `--accept-single-reviewer "<lý do>"` (đã có trong `scripts/lib/dataset-core.mjs`), được ghi vào audit; kèm risk acceptance `RA-M5-001` dưới đây.
- **Risk acceptance `RA-M5-001` (single reviewer, **accepted** by Owner at `2026-11-12T04:19Z`):** rủi ro: dataset sai lọt publish khi người nạp = người duyệt (vi phạm SECURITY §6 / ADR-0012 §4). **Owner:** Release Manager. **Mitigation:** checklist review preview trên điện thoại, đọc diff report `dataset` trước `publish`, rollback `retract`/`restore` đã diễn tập (`DRILL-M3-G4b-001`) và được kiểm lại trong flow 6. **Expiry:** trước `G4a` public đầu tiên hoặc `2027-01-31`, tùy mốc nào đến trước; sau đó phải có người duyệt thứ hai hoặc gia hạn bằng decision mới.
- **Finding `F-M5-001` — M4 G3a evidence integrity:** severity **S2 (process/evidence)**; **chặn G4a cho tới khi được kiểm chứng lại**. Kiểm tra tại `0e849f1` bằng `grep -rl --exclude-dir=node_modules --exclude-dir=dist <id> apps packages scripts`: `0` kết quả cho `formatScheduleAsText`, `formatScheduleAsMarkdown`, `generateIcsCalendar`, `generateWordDocument`, `reconcileRegistration`, `registrationOverlay`, `unmappedEntries`, `RegistrationSessionOverride`, `role: "official"`, nhãn `Đổi phòng từ ĐKMH`, tên test `rebases official plan overrides cleanly…`, file `packages/parser/src/vnu-xlsx-adapter.ts` (adapter thật: `uet-xlsx-adapter.ts`), tab “So khớp ĐKMH”, luồng nạp `.xlsx` trong app. `sectionOverrides` chỉ là biến cục bộ ở `apps/web/src/model/registration.ts:256`, không phải trường Plan được lưu như báo cáo mô tả. `M4-G3c-INDEPENDENT-REVIEW.md:64` cũng trích `vnu-xlsx-adapter.ts` → evidence G3c M4 bị ảnh hưởng một phần. Không reopen merge M4; xử lý bằng M5-L. Owner: Tester (G3a) + Independent Reviewer (G3c); hạn: trong M5 G3.
- **Open decisions cần Owner xác nhận ở G0/G1 (không tự chốt):**
  - **OD-M5-1 — đích link báo lỗi:** GitHub Issues (công khai, ai cũng đọc được ghi chú) / form (bên thứ ba, cần privacy review) / không có link (chỉ sao chép). Mặc định spec: app mở URL **nguyên trạng**, không nối nội dung báo cáo vào query string. **Owner 2026-11-11 (chat):** hướng tới **Google Form**; tab quản lý phản hồi trong trang admin để sau (cần backend lưu dữ liệu người dùng → boundary mới ngoài [ADR-0007](../adr/ADR-0007-static-artifact-cli-admin.md), P1). Khi có form: đặt `VITE_REPORT_ISSUE_URL` = URL https của form trên Cloudflare Pages, form không bắt buộc đăng nhập/thu email, và trang Giới thiệu nêu rằng nội dung gửi qua form do Google lưu (thay đổi copy nhỏ, cần chạy lại G3a phần M5-C). Chưa có URL form → app giữ chế độ chỉ sao chép.
  - **OD-M5-2 — domain production** (D-001); ảnh hưởng `SEC-M3-007` `curl -I` ở G4a. **Owner 2026-11-12 (chat):** dùng `xeptkb-63v.pages.dev` (Cloudflare Pages, miễn phí) làm domain production; brand/domain riêng (D-001) để sau. Đóng.
  - **OD-M5-3 — wording disclaimer/privacy** cần rà soát pháp lý (PRD §11, D-004) trước G4a; G2 dùng bản nháp. **Owner 2026-11-11 (chat):** chấp nhận bản câu chữ hiện tại do AI soạn, không qua rà soát pháp lý riêng; Owner tự chịu rủi ro này (PRD §11). Đóng.
  - **OD-M5-4 — ngưỡng bundle budget:** Owner duyệt con số sau khi G2 đo (§8). **Owner 2026-11-11 (chat): đã duyệt** ngưỡng trong `scripts/bundle-budget.json` — initial JS gzip ≤ `119,808 B` (đo `108,920 B`), initial CSS ≤ `5,120 B` (đo `3,754 B`), chunk `RegistrationImport-*` ≤ `43,008 B` (đo `38,224 B`), tổng JS ≤ `162,816 B` (đo `147,144 B`). Đóng.
  - **OD-M5-5 (Tech Lead, G1) — lazy-load vs AC-M4-02:** *đã được đề xuất giải ở [DESIGN-M5-001 §5](M5-DESIGN-HANDOFF.md): prefetch chunk khi `Workspace` mount (idle), không tải khi bấm nút; `e2e/m4.spec.ts` giữ nguyên, không nới assertion. Chờ Owner xác nhận ở G1.* Bối cảnh: e2e `apps/web/e2e/m4.spec.ts:131–201` bắt đầu ghi request **trước** khi bấm “Nhập kết quả ĐKMH” và yêu cầu `[]`. Lazy chunk tải khi mở panel sẽ phá assertion này. G1 phải chọn: prefetch chunk lúc idle trước khi mở panel, hoặc cho phép đúng một GET cùng origin tới chunk `assets/*.js` đã hash **trước** khi chọn file; từ lúc chọn file trở đi vẫn `0` request. Không được nới assertion âm thầm. **Owner 2026-11-11 (chat): đồng ý** phương án prefetch khi `Workspace` mount. Đóng.

## 5. Flows

1. **Báo sai dữ liệu (M5-B):** sinh viên bấm “Báo sai dữ liệu” trên thẻ lớp (hoặc mục chung ở footer/trang giới thiệu) → hộp thoại hiện văn bản dựng sẵn: `app` (version, commit, build time), `dataset` (`datasetVersion`, term, status), `section` (mã lớp/mã môn/nhóm từ dataset công khai, nếu mở từ thẻ lớp), `field` (người dùng chọn: phòng/thứ/tiết/tuần/giảng viên/khác) và ô ghi chú **trống mặc định** kèm cảnh báo “không nhập họ tên, mã sinh viên, ngày sinh” → “Sao chép” ghi vào clipboard (lỗi clipboard → hiện văn bản chọn được + hướng dẫn) → nếu có `VITE_REPORT_ISSUE_URL` hợp lệ, link “Mở trang báo lỗi” (`rel="noopener noreferrer"`) do người dùng tự bấm. Không có request nào do app khởi tạo. Văn bản không chứa danh sách lớp đã chọn, giá trị override từ ĐKMH, tên file, user agent.
2. **Đọc giới thiệu/quyền riêng tư (M5-C):** từ header/footer mở “Giới thiệu & quyền riêng tư” → đọc các mục §3 M5-C → link nội bộ tới “Xóa dữ liệu trên máy” và “Báo sai dữ liệu”; hoạt động offline (nằm trong app shell được precache).
3. **Dữ liệu cũ/offline (M5-D):** khi tải dataset (online hoặc từ bộ nhớ) → nếu `now > expiresAt` hiện cảnh báo “Dữ liệu đã hết hiệu lực từ <ngày> — đối chiếu cổng trường” → nếu offline và dùng bản đã lưu, hiện banner “Đang dùng dữ liệu lưu trên máy, cập nhật <N ngày> trước”; trở lại online thì banner offline biến mất, cảnh báo `expiresAt` vẫn giữ nếu còn đúng. Trạng thái trống: không có `expiresAt` → không cảnh báo.
4. **Lỗi giao diện (M5-E):** lỗi render bị error boundary bắt → màn hình “Ứng dụng gặp lỗi” chung chung (không hiện `error.message`/stack) với “Tải lại” và “Xóa dữ liệu trên máy” (bước xác nhận, dùng lại luồng wipe hiện có) → không gửi gì ra ngoài; phương án vẫn còn nếu chỉ tải lại.
5. **Owner HK I validation (M5-K, bước Owner ngoài G2):** tạo nhánh không phải `main` → `npm run test:real -- "<HK I.xlsx>" --term 2026-2027-h1` (file thô ngoài repo, `assertOutsideRepo`) → `npm run dataset -- import …` → commit `data/` **chỉ trên nhánh đó** → push → preview `<nhánh>.xeptkb.pages.dev` (banner “chưa được công bố”) → thử trên điện thoại Tier 1 theo checklist → `validate`/`publish` với `--accept-single-reviewer` nếu muốn diễn tập → `status`/`check` → dọn dẹp: không merge nhánh (hoặc `retract`), xóa nhánh; `main` không chứa dữ liệu HK I trừ khi Owner quyết định khác.
6. **Release/rollback (M5-I/M5-J; thực thi G4a/G4b là bước Owner ngoài vòng G2 này):** **G4a** — G3a/b/c đạt → cập nhật `CHANGELOG.md`, tag `v0.x.y` → Owner bật production deployment trên Pages → smoke script trên URL production (header CSP/X-Frame-Options/HSTS…, `manifest.json`, hash dataset) → monitoring window theo OPERATIONS → rollback: “Rollback to this deployment” về bản trước trên Pages hoặc revert commit + redeploy. **G4b** — khi có file HK II: `test:real` → `import` → preview → `validate` → `publish` (`RA-M5-001`) → deploy → smoke; rollback bằng `retract`/`restore` (không xóa audit, không ghi đè artifact cũ).

## 6. Acceptance criteria

| ID | Given / When / Then (rút gọn) | Scope | Test |
| --- | --- | --- | --- |
| AC-M5-01 | Bản build từ commit `X` → footer và trang giới thiệu hiện `version`, 7 ký tự đầu của `X`, build time UTC; `CHANGELOG.md` tồn tại có mục cho version đó | M5-A | Vitest + e2e |
| AC-M5-02 | Mở báo lỗi từ thẻ lớp → văn bản chỉ gồm trường đã liệt kê ở flow 1; với Plan chứa override ĐKMH và fixture PII `fixtures/redacted-registration/portal-format.doc`, văn bản không chứa chuỗi PII, tên file, giá trị override, danh sách lớp; ô ghi chú trống trừ khi người dùng gõ | M5-B | Vitest |
| AC-M5-03 | Trong e2e ghi request từ lúc mở báo lỗi tới sau “Sao chép” và bấm link → `0` request do app khởi tạo (`fetch`/XHR/`sendBeacon`/SW); chỉ có điều hướng do người dùng tới đúng URL cấu hình, URL không chứa nội dung báo cáo | M5-B | e2e (Playwright) |
| AC-M5-04 | `VITE_REPORT_ISSUE_URL` không đặt / không phải `http(s)` tuyệt đối (ví dụ `javascript:`, `data:`, tương đối) → không render link, chỉ sao chép + hướng dẫn; hợp lệ → link có `rel="noopener noreferrer"` | M5-B | Vitest |
| AC-M5-05 | Clipboard API thiếu hoặc bị từ chối → hiện văn bản chọn được + hướng dẫn sao chép thủ công, không lỗi trắng màn hình | M5-B | Vitest |
| AC-M5-06 | Trang giới thiệu có đủ mục M5-C, mở được bằng bàn phím từ header/footer, hiển thị khi offline sau lần tải đầu | M5-C | Vitest + e2e + review copy thủ công |
| AC-M5-07 | Dataset có `expiresAt` < hiện tại (đồng hồ giả) → cảnh báo hiển thị bằng chữ (không chỉ màu), có `role="status"`; `expiresAt` tương lai hoặc không có → không cảnh báo | M5-D | Vitest |
| AC-M5-08 | Offline, dataset từ bộ nhớ → banner tuổi dữ liệu hiển thị ngoài panel nguồn; không phát sinh request mới so với hành vi offline M3 | M5-D | Vitest + e2e offline |
| AC-M5-09 | Component ném lỗi chứa chuỗi đánh dấu PII giả → boundary hiện UI phục hồi; chuỗi không có trong DOM, IndexedDB, request; boundary không tự gọi `console`/mạng; “Tải lại” giữ Plan; “Xóa dữ liệu” cần xác nhận | M5-E | Vitest + e2e |
| AC-M5-10 | Build production → entry chunk không chứa module registration parser (kiểm bằng chuỗi đánh dấu); chunk riêng có trong SW precache; nhập ĐKMH chạy được offline; từ lúc chọn file tới export vẫn `0` request (AC-M4-02), theo phương án OD-M5-5 | M5-F | build test + e2e |
| AC-M5-11 | Script bundle budget chạy trong CI, in số đo (raw + gzip) của initial JS/CSS và chunk ĐKMH, exit ≠ 0 khi vượt ngưỡng §8 | M5-F | CI + node:test |
| AC-M5-12 | `manifest.webmanifest` tham chiếu PNG 192×192, 512×512, maskable 512×512 (`purpose: "maskable"`); `index.html` có `apple-touch-icon` 180×180; mỗi file là PNG hợp lệ đúng kích thước; chạy lại script sinh ra cùng kích thước/định dạng | M5-G | node:test |
| AC-M5-13 | CI có bước `npm audit --omit=dev --audit-level=high`; secret-scan fail trên fixture bí mật tổng hợp và pass trên repo; base immutability khi `push` = `github.event.before`, fallback `HEAD~1` khi SHA rỗng/toàn 0 (unit test hàm chọn base) | M5-H | CI + node:test |
| AC-M5-14 | `OPERATIONS.md` có quy trình release/rollback Pages, quy ước tag/changelog, monitoring window không telemetry, staged-release thay thế, §1/§5/§6/§10 cập nhật theo D-M5-1..3; smoke script chạy pass trên `vite preview` cục bộ (header, manifest, hash) | M5-I | review tài liệu + chạy script |
| AC-M5-15 | `M5-RELEASE-CHECKLIST.md` và release report nháp tồn tại, status `draft`, đánh dấu bước Owner, không có deploy ID/URL/run ID bịa | M5-J | review tài liệu |
| AC-M5-16 | Hướng dẫn HK I liệt kê đúng lệnh flow 5, file thô ngoài repo, bước dọn dẹp; `main` không có dataset HK I sau vòng G2 (`data/published/manifest.json` `datasets: []` trừ khi Owner quyết) | M5-K | review + `dataset status` |
| AC-M5-17 | Mọi UI mới (báo lỗi, giới thiệu, banner, error boundary) → axe `0` lỗi `serious`/`critical`, không tràn ngang ở 360/768/1200 px, dùng được hoàn toàn bằng bàn phím, focus nhìn thấy | M5-B..E | e2e (axe) |
| AC-M5-18 | Không telemetry: bundle production không chứa origin bên thứ ba, `sendBeacon`, analytics; CSP `connect-src 'self'` giữ nguyên (`verify:bundle` mở rộng) | D-M5-2 | build check + e2e |
| AC-M5-19 | G3a chạy lại `AC-M4-01..08`, `AC-04`, `AC-05` trên commit G2 của M5, mọi định danh trích dẫn đều grep được; chạy checklist thiết bị Tier 1/2 + screen reader + xem export bằng mắt; `F-M5-001` chỉ đóng khi báo cáo mới đạt | M5-L | G3a thủ công + tự động |

## 7. Test and evidence plan

- **Lệnh bắt buộc ở G2:** `npm run check`, `npm run test:e2e`, `npm run verify:bundle`, script bundle budget, secret-scan, `npm audit --omit=dev --audit-level=high`; ghi exit code, số test, commit bất biến vào `EVID-M5-001`. Không chạy được thì ghi `not-run` kèm lý do.
- **Vitest/Testing Library:** dựng văn bản báo lỗi + validate URL, clipboard fallback, `expiresAt`/offline banner với đồng hồ giả, error boundary với chuỗi đánh dấu PII, trang giới thiệu.
- **node:test:** icon PNG (header + kích thước), hàm chọn base immutability, secret-scan trên fixture tổng hợp, budget script trên thư mục `dist` giả.
- **Playwright:** zero-network cho báo lỗi, offline banner, error boundary, lazy chunk + AC-M4-02 hồi quy, axe + 360/768/1200 cho UI mới; WebKit opt-in như M3.
- **Fixture:** chỉ synthetic/redacted (`fixtures/redacted-registration/portal-format.doc`, dataset tổng hợp); không dùng file HK I thật trong CI.
- **Thủ công (G3a, Owner/Tester):** Tier 1 thật (Chrome Android, Safari iOS), Tier 2 smoke, screen reader, cài PWA (icon), PNG/Word/bản in, flow 5 HK I.

## 8. NFR thresholds

- **Bundle budget (đề xuất, OD-M5-4):** `B_pre` = initial JS gzip đo tại `0e849f1`; `B_post` = đo tại commit G2 sau lazy-split, cùng script. Yêu cầu `B_post < B_pre`; ngưỡng CI = `B_post × 1.10` làm tròn lên 1 KiB (initial JS gzip), CSS = `CSS_post × 1.10` (thống nhất với [DESIGN-M5-001 §5](M5-DESIGN-HANDOFF.md)). Số thật điền ở G2: `B_pre = <đo ở G2>`, `B_post = <đo ở G2>`. Số 443.9 KB / ≈140 KB gzip trong brief chỉ là audit tham khảo, không phải số đo của spec.
- **First paint:** đo baseline bằng Playwright trên profile mobile ở G2, chỉ ghi nhận (QA §6), chưa làm ngưỡng chặn.
- **Privacy:** `0` request tới origin ≠ `self`; `0` request do báo lỗi/error boundary khởi tạo; không PII trong DOM/IndexedDB/console/request.
- **Accessibility/responsive:** WCAG 2.1 A/AA (axe `0` serious/critical), 360/768/1200 px không tràn ngang, bàn phím đầy đủ, không dùng màu làm tín hiệu duy nhất.
- **Offline:** app shell, trang giới thiệu và chunk ĐKMH có trong precache; banner offline không cần mạng.

## 9. Handoff and G0 decision

- **Implementer:** Frontend/Coder (M5-A..H), Release Manager + Tech Lead (M5-I..K); sau `G1` của `DESIGN-M5-001`.
- **Tester:** G3a gồm AC-M5-01..19 và M5-L. **Security Reviewer:** G3b cho M5-B, M5-E, M5-H, AC-M5-18, `RA-M5-001`. **Independent Reviewer:** G3c, gồm phần G3c M4 bị `F-M5-001` ảnh hưởng.
- **Release impact:** không deploy production, không publish dataset trong vòng này; G4a/G4b/G5 là bước Owner theo M5-J.
- **Definition of Ready:** `ready` — G0 và G1 đã được Owner ký (`2026-11-12T04:19Z`); OD-M5-5 đã chốt.
- **G0 decision:** `g0-approved` — Owner (Product / Tech Lead / Security / Release Manager), `2026-11-12T04:19Z` (chat).
- **Approver actor/date/evidence:** Owner (Product / Tech Lead / Security / Release Manager), `2026-11-12T04:19Z`, câu trả lời "Tôi duyệt tất cả" trong chat; [EVID-M5-001](M5-EVIDENCE-ENVELOPE.md).
- **Blockers/questions:** không còn cho G0. OD-M5-1…5 đã chốt (§4); `RA-M5-001` accepted; `F-M5-001` đóng khi Owner ký G3 cùng thời điểm.
