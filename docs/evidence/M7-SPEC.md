# M7 spec — Trang quản trị chạy trên máy (Kỳ Này Admin)

> **Artifact ID:** `SPEC-M7-001`  
> **Artifact status:** `draft` — chờ Owner ký G0  
> **Canonical gate:** `G0`  
> **Owner:** Product Spec  
> **Last reviewed:** 2026-11-20  
> **Related docs:** [PRD §4/§6 FR-12](../PRD.md), [ADR-0007](../adr/ADR-0007-static-artifact-cli-admin.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [Data ingestion runbook §12](../DATA_INGESTION_RUNBOOK.md), [Operations](../OPERATIONS.md), [Security & privacy](../SECURITY_PRIVACY.md), [DESIGN-M7-001](M7-DESIGN-HANDOFF.md), [ADR-0016](../adr/ADR-0016-m7-local-admin-console.md)  
> **Evidence envelope:** `EVID-M7-001` (tạo ở G2; hiện `N/A — docs-only`)  
> **Decision actor / UTC timestamp:** `pending` — Owner  
> **Receiving owner / acknowledgement:** Tech Lead (G1 `DESIGN-M7-001`, `ADR-0016`), Platform, Tester, Security Reviewer, Independent Reviewer

## 1. Nguồn và traceability

- **Yêu cầu của Owner (chat, 2026-11-20):** "làm thêm 1 trang admin cho tôi để tôi quản lí, thao tác upload data hoặc các thao tác khác với web được dễ dàng và trực quan hơn". Owner chọn (cùng ngày): admin **chạy trên máy Owner**, gồm 4 nhóm chức năng — nạp và duyệt TKB; rút/khôi phục dữ liệu; trạng thái và kiểm tra; đưa lên web (commit, PR, merge).
- **Requirement:** FR-12 (P0, đã có qua CLI) — M7 chỉ thêm giao diện cho FR-12, không đổi pipeline.
- **Ràng buộc kế thừa:** ADR-0007 (static artifact + admin cục bộ, không backend), ADR-0012 (vòng đời `candidate → validated → published → retracted`, artifact bất biến, audit), runbook §12, SEC-M3-003 (production chỉ dữ liệu `published`), `RA-M5-001` (một người duyệt).
- **Thay đổi cần ghi khi ký G0:** PRD §4 điểm 1 hiện ghi "không có trang admin web trong release đầu" — đổi thành "admin ingest/review/publish qua local CLI **hoặc trang quản trị chạy trên máy (localhost) bọc đúng CLI đó** (ADR-0016); không có trang admin trên Internet".

## 2. Outcome

Owner làm được toàn bộ vòng đời dữ liệu TKB và theo dõi trạng thái web **bằng giao diện trên trình duyệt của máy mình**, không cần gõ lệnh, không cần nhớ thứ tự runbook, và không cần nhờ agent:

- chọn file `.xlsx` của trường → xem báo cáo nạp → xem thử trên preview → duyệt → publish lên production → thấy smoke production PASS;
- rút (retract) một bản sai, khôi phục (restore) một bản đã rút;
- xem ngay: các bộ dữ liệu và trạng thái, nhật ký audit, version/commit đang chạy trên production, CI của `main`, PR dữ liệu đang mở.

Thước đo: từ lúc có file của trường tới khi dữ liệu lên production, Owner chỉ thao tác trong admin (trừ việc tự mở preview trên điện thoại để xem bằng mắt); mỗi bước có một nút, có xác nhận trước bước đưa lên production.

## 3. Phạm vi

### Trong phạm vi

- **M7-A Khởi động an toàn:** `npm run admin` mở server chỉ nghe `127.0.0.1`, in URL có mã phiên ngẫu nhiên; trang từ chối yêu cầu không có mã, sai `Host` hoặc sai `Origin`.
- **M7-B Trạng thái:** bảng dataset (`manifest.json`), 20 dòng audit gần nhất, version + commit production (thẻ `ky-nay-build`), trạng thái CI gần nhất của `main`, PR dữ liệu đang mở; nút "Chạy smoke production" và "Chạy smoke preview".
- **M7-C Nạp:** chọn file `.xlsx` (≤ 20 MB) và điền: mã kỳ, tên kỳ, loại nguồn (chính thức/dự kiến), tên văn bản nguồn, đơn vị phát hành, số tuần, ngày tuần 1 theo khóa. Admin gọi `dataset import`, hiện báo cáo (số môn/lớp/buổi, lỗi, dòng bỏ, cột lạ/định dạng mới, khác biệt so với bản trước). File gốc chỉ nằm ở thư mục tạm ngoài repo và bị xóa ngay sau khi nạp.
- **M7-D Preview:** đẩy bản `candidate` lên nhánh dữ liệu riêng → chờ Cloudflare build → hiện link preview và kết quả smoke preview. Không đụng `main`.
- **M7-E Duyệt:** `dataset validate` với tên người duyệt, ghi chú; bắt buộc lý do khi người duyệt trùng người nạp (`RA-M5-001`) hoặc khi file có định dạng mới.
- **M7-F Publish:** xác nhận → `dataset publish` → PR vào `main` → chờ CI xanh → merge → chờ production deploy → smoke `--production` với commit mới; hiện rõ từng bước và cách xử lý khi một bước hỏng.
- **M7-G Rút/khôi phục:** `retract`/`restore` (bắt buộc lý do) theo cùng luồng PR → production → smoke.
- **M7-H An toàn thao tác:** mỗi lúc chỉ một thao tác; admin làm việc trong một git worktree riêng, không đụng thư mục làm việc của Owner; không bao giờ push thẳng hay force-push vào `main`.
- **M7-I Tài liệu:** runbook §12 thêm cách làm bằng admin; OPERATIONS ghi lệnh khởi động và giới hạn.

### Ngoài phạm vi

- Trang admin trên Internet, đăng nhập, nhiều người dùng, phân quyền (cần ADR thay ADR-0007; xem ROADMAP).
- Gọi API Cloudflare (danh sách deployment, nút rollback app): admin chỉ đưa link tới dashboard.
- Sửa tay từng lớp/buổi trong dataset; hàng chờ người dùng gửi file; LLM.
- Dùng admin trên điện thoại.
- Thay đổi web app sinh viên (bundle, CSP, IndexedDB giữ nguyên).

## 4. Quyết định và giả định

| ID | Nội dung | Trạng thái |
| --- | --- | --- |
| D-M7-1 | Admin chạy trên máy Owner (localhost), không phải trang online | Owner chọn 2026-11-20 |
| D-M7-2 | 4 nhóm chức năng: nạp + duyệt; rút/khôi phục; trạng thái + kiểm tra; đưa lên web | Owner chọn 2026-11-20 |
| D-M7-3 | Admin gọi đúng CLI `scripts/dataset.mjs` (không viết lại logic), nên audit, kiểm tra và luật vòng đời giữ nguyên | đề xuất |
| D-M7-4 | Đưa lên `main` chỉ qua PR + CI xanh + merge thường (`--merge`); không force-push | đề xuất |
| D-M7-5 | Code M7 làm trên nhánh tích hợp `m7-admin`, merge vào `main` một lần sau G3 (như D-M6-10), vì từ 2026-11-20 mỗi merge vào `main` là một production deploy | đề xuất — Q-M7-1 |
| D-M7-6 | Không thêm dependency (server `node:http`, giao diện HTML + JS module không cần build, dùng lại `tokens.css` của web) | đề xuất |
| A-M7-1 | Máy Owner có Node 22, `git` và `gh` đã đăng nhập GitHub (đang dùng cho repo này) | giả định — kiểm lúc khởi động |
| A-M7-2 | Cloudflare tạo preview cho mọi nhánh khác `main` và báo check run "Cloudflare Pages" lên GitHub (đã thấy ở PR #28–#32) | giả định đã quan sát |

**Câu hỏi cho Owner:** Q-M7-1 — đồng ý làm trên nhánh `m7-admin` rồi merge một lần (khuyến nghị), hay mỗi phần merge thẳng vào `main`?

## 5. Luồng chính

1. **Mở admin:** Owner chạy `npm run admin` trong repo → trình duyệt mở `http://127.0.0.1:<port>/#<mã phiên>` → màn Trạng thái.
2. **Nạp TKB mới:** Nạp → chọn file, điền thông tin → "Nạp" → báo cáo → "Đưa lên preview" → link preview + smoke PASS → Owner mở link trên điện thoại, đối chiếu vài lớp với file gốc.
3. **Duyệt và publish:** Duyệt → điền tên + lý do một người duyệt → "Duyệt" → Publish → hộp xác nhận ("Dữ liệu sẽ hiện cho mọi người dùng") → admin mở PR, chờ CI, merge, chờ deploy, chạy smoke production → "Đã lên production: <version>, smoke 16/16".
4. **Phát hiện sai:** Trạng thái → dataset đang publish → "Rút" → lý do → cùng luồng PR → app quay về bản published trước (hoặc "chưa có dữ liệu").
5. **Kiểm nhanh:** Trạng thái → "Chạy smoke production" → bảng PASS/FAIL như CLI.

## 6. Contract

- Không đổi: schema manifest `1.0`, domain `0.2.0`, định dạng `audit.jsonl`, báo cáo nạp, luật `nextStatus` (ADR-0012), CSP và bundle của web app.
- Mới: lệnh `npm run admin`; API nội bộ của admin (chỉ localhost, mô tả trong DESIGN-M7-001 §4) — không phải contract công khai.

## 7. Acceptance criteria

| ID | Tiêu chí kiểm được |
| --- | --- |
| AC-M7-01 | `npm run admin` chỉ nghe `127.0.0.1`; mọi `/api/*` không có mã phiên đúng, hoặc `Host`/`Origin` không phải `127.0.0.1:<port>`/`localhost:<port>` → 403; trang không gửi header CORS |
| AC-M7-02 | Màn Trạng thái hiện đúng các dataset của `manifest.json` (version, kỳ, trạng thái, ngày nạp/duyệt/publish), 20 dòng audit cuối, version + commit production, CI gần nhất của `main`; nút smoke trả bảng giống `scripts/smoke-deploy.mjs` |
| AC-M7-03 | Nạp file `.xlsx` hợp lệ (fixture tổng hợp) tạo `candidate` giống hệt khi chạy CLI cùng tham số; báo cáo hiện số môn/lớp/buổi, lỗi, cảnh báo định dạng mới; file tạm bị xóa; repo và log không chứa file gốc hay tên file gốc |
| AC-M7-04 | File không phải `.xlsx` (sai chữ ký ZIP) hoặc > 20 MB bị từ chối trước khi gọi CLI, có thông báo tiếng Việt |
| AC-M7-05 | "Đưa lên preview" tạo nhánh dữ liệu từ `origin/main`, commit chỉ thay đổi `data/`, push, hiện link preview và smoke preview sau khi check "Cloudflare Pages" xong; `main` không đổi |
| AC-M7-06 | "Duyệt" từ chối khi người duyệt trùng người nạp mà không có lý do, và khi định dạng mới mà không có lý do; audit giống CLI |
| AC-M7-07 | "Publish" có hộp xác nhận; mở PR vào `main`; chỉ merge khi mọi check xanh; sau deploy chạy smoke `--production --expect-commit <merge sha7>`; bước hỏng hiện lý do và việc cần làm, không merge |
| AC-M7-08 | "Rút"/"Khôi phục" bắt buộc lý do; đi đúng luồng PR; sau deploy manifest production không còn bản đã rút |
| AC-M7-09 | Hai thao tác cùng lúc → thao tác sau bị từ chối; thư mục làm việc của Owner (`git status`) không đổi sau mọi thao tác; không có lệnh `push --force` hay push vào `main` |
| AC-M7-10 | Giao diện tiếng Việt, dùng được bằng bàn phím, axe 0 serious/critical ở 1280×800, theme sáng/tối theo máy |
| AC-M7-11 | `npm run verify:bundle` chứng minh không file admin nào nằm trong `apps/web/dist`; e2e privacy/network của web app giữ nguyên |

## 8. Kế hoạch kiểm thử

- `node:test` cho server: bind, mã phiên, `Host`/`Origin`, giới hạn upload, khóa một thao tác, lệnh git/gh sinh ra (bằng runner giả).
- Luồng nạp → duyệt → publish → rút chạy thật với CLI trên thư mục dữ liệu tạm (`DATASET_ROOT_DIR`) và fixture tổng hợp `fixtures/synthetic-uet-xlsx/hk1-row1.xlsx`; git/gh/Cloudflare được giả lập.
- Playwright cho giao diện admin (Chromium 1280, sáng/tối, axe, bàn phím).
- Thử thật một lần trên repo với dataset HK I đã `validated` (publish lên production) khi Owner quyết định G4b — đó là G4b, không phải test.
- G3b bắt buộc: server cục bộ nhận file và chạy lệnh git/gh.

## 9. Bàn giao và quyết định G0

- **Next owner:** Tech Lead — `DESIGN-M7-001` + `ADR-0016` (G1, viết cùng lúc để Owner ký một lượt).
- **Decision:** `pending` — Owner trả lời "Ký G0" (kèm Q-M7-1) hoặc nêu chỗ cần sửa.

## 10. Cập nhật tài liệu khi G0 được ký

- PRD §4 điểm 1 (câu ở §1 trên) và hàng FR-12 thêm "giao diện admin cục bộ (M7)".
- IMPLEMENTATION_PLAN §2 thêm hàng M7.
- `docs/README.md` › Trạng thái hiện tại.
