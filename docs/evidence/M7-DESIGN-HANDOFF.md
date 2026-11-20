# M7 design handoff — Kỳ Này Admin: trang quản trị chạy trên máy, bọc CLI dataset

> **Artifact ID:** `DESIGN-M7-001`  
> **Artifact status:** `draft` — chờ Owner ký G1 (cùng `ADR-0016`)  
> **Canonical gate:** `G1`  
> **Owner:** Tech Lead + Platform  
> **Last reviewed:** 2026-11-20  
> **Related docs:** [SPEC-M7-001](M7-SPEC.md), [ADR-0016](../adr/ADR-0016-m7-local-admin-console.md), [ADR-0007](../adr/ADR-0007-static-artifact-cli-admin.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [Runbook §12](../DATA_INGESTION_RUNBOOK.md), [Operations](../OPERATIONS.md), [Security & privacy](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** `EVID-M7-001` (tạo ở G2; hiện `N/A — docs-only`)  
> **Decision actor / UTC timestamp:** `pending` — Owner

## 1. Baseline (đọc trên `main` `30d8d4a`)

- CLI `scripts/dataset.mjs`: `import | validate | publish | retract | restore | status | check`; thư mục dữ liệu đổi được bằng biến `DATASET_ROOT_DIR`; file nguồn phải nằm ngoài repo (`assertOutsideRepo` trong `scripts/lib/cli.mjs`); luật vòng đời ở `nextStatus` (`scripts/lib/dataset-core.mjs`); `check --base-manifest` kiểm tính bất biến so với manifest gốc.
- Smoke: `runSmoke(baseUrl, { production, expectCommit })` export từ `scripts/smoke-deploy.mjs`.
- Cloudflare Pages báo check run "Cloudflare Pages" trên mọi commit đã push (nhánh preview và `main`); phần tóm tắt có "Branch Preview URL". Từ 2026-11-20 mỗi merge vào `main` là một production deploy.
- Máy Owner: Windows, Node 22, `git`, `gh` (đã đăng nhập).

## 2. Kiến trúc

```text
Trình duyệt Owner ──HTTP 127.0.0.1──> scripts/admin/server.mjs (node:http, không dependency)
                                         ├─ ui/            index.html + admin.js (ES module, không build) + admin.css
                                         ├─ lib/security    Host/Origin/mã phiên, header CSP
                                         ├─ lib/jobs        khóa một thao tác, nhật ký thao tác trong bộ nhớ
                                         ├─ lib/runner      spawn(shell:false) cho node/git/gh, timeout, runner giả cho test
                                         ├─ lib/workspace   git worktree riêng (~/.ky-nay-admin/worktree), nhánh dữ liệu, commit, push
                                         ├─ lib/github      gh pr create/checks/merge, đọc check run Cloudflare
                                         └─ lib/status      manifest, audit, meta production, runSmoke
CLI dataset (từ checkout của Owner) ── DATASET_ROOT_DIR=<worktree>/data ──> data/ trong worktree
```

- `npm run admin` = `npm run build && node scripts/admin/server.mjs`. Server chọn cổng trống từ 4390, in `http://127.0.0.1:<port>/#<mã phiên>` và mở trình duyệt mặc định (`start` trên Windows; lỗi mở thì chỉ in URL).
- **Worktree riêng ngoài repo** (`~/.ky-nay-admin/worktree`, tạo bằng `git worktree add --detach`): admin không bao giờ đổi nhánh, stage hay sửa file trong thư mục làm việc của Owner. Cài đặt (tên người vận hành) ở `~/.ky-nay-admin/settings.json`, không vào repo.
- **CLI chạy từ checkout của Owner**, dữ liệu trỏ vào worktree. Lúc khởi động và trước mỗi thao tác ghi, admin so `HEAD:scripts` và `HEAD:packages` của checkout với `origin/main`; khác nhau thì khóa mọi thao tác ghi với thông báo "Mã trên máy cũ hơn `main` — chạy `git pull` rồi mở lại admin" (fail closed).

## 3. Màn hình (desktop ≥ 1024 px; tiếng Việt; token màu/chữ của `apps/web/src/styles/tokens.css`, sáng/tối theo máy)

Khung: cột trái 4 mục — **Trạng thái**, **Nạp TKB**, **Duyệt & Publish**, **Rút / Khôi phục**; dưới cùng là bảng **Nhật ký thao tác** (từng lệnh, mã thoát, đầu ra CLI) mở/thu được. Thanh trên ghi "Kỳ Này Admin — chạy trên máy này", tên người vận hành (sửa được) và cảnh báo nếu mã cũ hơn `main`.

| Màn | Nội dung | Nút |
| --- | --- | --- |
| Trạng thái | Production: URL, version + commit (meta `ky-nay-build`), số dataset `published`; CI gần nhất của `main`; bảng dataset (version, kỳ, nguồn, trạng thái, nạp/duyệt/publish bởi ai, lúc nào); PR và nhánh dữ liệu đang mở (link GitHub + link preview); 20 dòng audit cuối | "Chạy smoke production", "Chạy smoke preview" (chọn nhánh), "Làm mới", link dashboard Cloudflare |
| Nạp TKB | Bước 1–2 của thanh tiến trình **Nạp → Preview → Duyệt → Publish → Production**. Form: file `.xlsx`, mã kỳ (gợi ý từ manifest, dạng `2026-2027-h2`), tên kỳ, loại nguồn, tên văn bản nguồn (không dùng tên file), đơn vị phát hành, số tuần (mặc định 15), bảng "khóa → ngày tuần 1" (thêm/bớt dòng). Sau nạp: thẻ báo cáo (số môn/lớp/buổi, lỗi, dòng bỏ, cột lạ, định dạng mới), khác biệt so với bản trước của kỳ, toàn văn `data/reports/<version>.md` | "Nạp", "Đưa lên preview", "Bỏ bản nháp này" (xóa nhánh dữ liệu chưa merge) |
| Duyệt & Publish | Chọn nhánh dữ liệu đang mở → hiện link preview + kết quả smoke preview. Duyệt: tên người duyệt, ghi chú, ô lý do một người duyệt (bắt buộc khi trùng người nạp), ô lý do định dạng mới (khi có). Publish: tên người publish, ghi chú | "Duyệt", "Publish lên production" (mở hộp xác nhận nêu version, kỳ, số lớp; chỉ bật khi bản đã `validated` và smoke preview của đúng commit đó PASS) |
| Rút / Khôi phục | Bảng dataset `published`/`retracted` của mỗi kỳ, nêu bản nào sẽ hiện sau khi rút | "Rút" (lý do bắt buộc, xác nhận), "Khôi phục" (→ `validated`, sau đó đi tiếp ở Duyệt & Publish) |

Trạng thái chạy: mỗi nút ghi đổi thành tiến trình từng bước (ví dụ Publish: commit → push → mở PR #n → chờ CI (check, e2e, visual) → merge → chờ Cloudflare → smoke production) với dấu ✓/✗ và thời gian. Bước hỏng dừng toàn bộ, nêu lý do và việc nên làm (ví dụ "CI e2e đỏ — mở PR #n để xem; dữ liệu chưa lên production").

## 4. API nội bộ (chỉ localhost; mọi request cần header `X-Admin-Token`)

| Method + path | Việc | Ghi chú |
| --- | --- | --- |
| `GET /api/status` | manifest, audit (20), nhánh/PR dữ liệu, CI `main`, meta production | đọc từ `origin/main` qua worktree + `gh` |
| `POST /api/smoke` `{target: "production" \| branch}` | `runSmoke` | URL chỉ trong danh sách cho phép (§5) |
| `POST /api/upload` (thân là byte của file) | lưu file vào `os.tmpdir()/ky-nay-admin-<ngẫu nhiên>/source.xlsx`, trả `uploadId` | ≤ 20 MB, 4 byte đầu `PK\x03\x04`; đường dẫn không trả về trình duyệt |
| `POST /api/import` | `dataset import` trên nhánh mới `data-<kỳ>-import-<yyyymmdd-hhmm>` (từ `origin/main`) | xóa file tạm trong `finally` |
| `POST /api/preview` | commit `data/` → push nhánh → chờ check "Cloudflare Pages" → smoke preview | |
| `POST /api/validate`, `/api/publish`, `/api/retract`, `/api/restore` | gọi CLI tương ứng trên nhánh dữ liệu; publish/retract/restore đi tiếp luồng PR (§6) | tham số qua `sanitizeCliText` của CLI |
| `POST /api/discard` | xóa nhánh dữ liệu chưa merge (remote + local) | chỉ nhánh `data-*`, không có PR đã merge |
| `GET /api/jobs/current` | tiến trình + nhật ký thao tác đang chạy | giao diện hỏi mỗi giây; không WebSocket |

Một thao tác ghi tại một thời điểm (`409` nếu đang bận). Nhật ký chỉ trong bộ nhớ, mất khi tắt admin; không ghi file gốc, tên file gốc hay mã phiên.

## 5. Bảo mật (G3b bắt buộc)

| Mối đe dọa | Kiểm soát |
| --- | --- |
| Trang web khác (CSRF) hoặc DNS rebinding gọi API | server chỉ `listen("127.0.0.1")`; từ chối `Host` khác `127.0.0.1:<port>`/`localhost:<port>`; `Origin` (nếu có) phải trùng; mã phiên 32 byte ngẫu nhiên trong header; không trả header CORS |
| Tiến trình/người dùng khác trên máy | mã phiên chỉ in ra terminal của Owner, nằm sau `#` (không vào log/Referer); giao diện giữ trong bộ nhớ và xóa khỏi thanh địa chỉ bằng `history.replaceState` |
| Trang admin bị chèn script | trang tĩnh của chính admin; CSP `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`; `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; nội dung báo cáo hiển thị bằng `textContent`, không `innerHTML` |
| File `.xlsx` độc | giới hạn 20 MB + chữ ký ZIP; parser chạy trong tiến trình con của CLI (đã có kiểm tra độc hại ở M1); file tạm ngoài repo, xóa ngay |
| Chèn lệnh | `spawn` với mảng tham số, `shell: false`; chỉ `process.execPath` (node), `git`, `gh`; tên nhánh sinh từ mẫu cố định `^data-[a-z0-9-]{1,60}$` |
| Publish nhầm | hộp xác nhận; chỉ publish bản `validated` có smoke preview PASS cho đúng commit; luôn qua PR + CI; merge thường, không force-push, không push vào `main` |
| Hỏng thư mục làm việc của Owner | worktree riêng ngoài repo; admin chỉ chạy `git` với `-C <worktree>` (trừ `fetch` và các lệnh chỉ đọc trên checkout) |
| Mã CLI cũ | so `scripts/` và `packages/` với `origin/main`, khác thì khóa thao tác ghi |
| Lộ dữ liệu ra ngoài | server chỉ gọi GitHub (qua `git`/`gh`) và `https://xeptkb-63v.pages.dev` + `https://<alias>.xeptkb-63v.pages.dev` cho smoke; giao diện `connect-src 'self'` |

Không đổi: CSP/bundle/IndexedDB của web app; quy tắc PII (admin không đọc file ĐKMH của sinh viên).

## 6. Luồng git/GitHub

1. `git -C <repo> fetch origin --prune`.
2. Nạp: `git -C <wt> checkout -B data-<kỳ>-import-<stamp> origin/main` → CLI `import` → `git -C <wt> add data` → commit `data(<kỳ>): import <version> (admin)` → `push -u origin <nhánh>`.
3. Preview: lấy sha vừa push → hỏi `gh api repos/<repo>/commits/<sha>/check-runs` tới khi "Cloudflare Pages" `completed` (tối đa 15 phút) → URL từ "Branch Preview URL" (dự phòng: alias nhánh) → `runSmoke(url, { expectCommit })`.
4. Duyệt: checkout nhánh → CLI `validate` → commit `data(<kỳ>): validate <version> (admin)` → push → preview build lại → smoke preview.
5. Publish: CLI `publish` → commit → push → `gh pr create --base main --head <nhánh>` (thân PR: version, số lớp, audit, link preview, kết quả smoke) → hỏi `gh pr checks` tới khi xong; bất kỳ check nào không `pass` → dừng → `gh pr merge <n> --merge` → lấy merge sha → chờ check "Cloudflare Pages" của sha đó → `runSmoke(production, { production: true, expectCommit })` (thử lại 3 lần, cách 20 s).
6. Rút/Khôi phục: nhánh `data-<kỳ>-retract-<stamp>` / `-restore-` từ `origin/main` → CLI → commit → push → PR → như bước 5 (restore dừng ở `validated`, publish lại ở màn Duyệt & Publish).

CI của PR vẫn chạy `dataset check` với manifest gốc (bất biến artifact), nên một sai sót của admin cũng bị chặn ở CI.

## 7. Kiểm thử

| Bề mặt | Kế hoạch |
| --- | --- |
| `scripts/test/admin-security.test.mjs` (**new**) | bind 127.0.0.1; 403 khi thiếu/sai mã, sai `Host`, sai `Origin`; không header CORS; CSP trên trang; 413 khi > 20 MB; 415 khi không phải ZIP; 409 khi đang bận |
| `scripts/test/admin-flow.test.mjs` (**new**) | luồng nạp → preview → duyệt → publish → rút → khôi phục với CLI thật trên `DATASET_ROOT_DIR` tạm + fixture `fixtures/synthetic-uet-xlsx/hk1-row1.xlsx`; runner giả cho `git`/`gh`/Cloudflare ghi lại lệnh: không có `--force`, không push `main`, merge chỉ sau check xanh, file tạm bị xóa, manifest giống khi chạy CLI tay |
| Playwright (**new** project `admin` trong `apps/web/playwright.config.ts`, server admin ở chế độ giả lập `KY_NAY_ADMIN_FAKE_REMOTE=1`, có dải "CHẾ ĐỘ THỬ" trên giao diện) | đi hết luồng bằng chuột và bằng bàn phím; axe 0 serious/critical sáng/tối ở 1280×800; thông báo lỗi tiếng Việt |
| `scripts/verify-production-bundle.mjs` | thêm kiểm `apps/web/dist` không chứa file/chuỗi của `scripts/admin` |
| Web app | `npm run check`, `verify:bundle`, `test:e2e` không đổi; `e2e/m4.spec.ts` không đụng |

## 8. Work package (mỗi phần một PR vào nhánh tích hợp `m7-admin`; merge vào `main` một lần sau G3 — D-M7-5)

| Phần | Nội dung | AC |
| --- | --- | --- |
| W1 Khung + bảo mật + Trạng thái | server, security, jobs, runner, status, giao diện khung + màn Trạng thái, smoke, lệnh `npm run admin` | 01, 02, 10, 11 |
| W2 Nạp + preview | upload, import, worktree, nhánh dữ liệu, preview + smoke, bỏ bản nháp | 03, 04, 05, 09 |
| W3 Duyệt, publish, rút, khôi phục | validate/publish/retract/restore, luồng PR/CI/merge/production smoke, hộp xác nhận | 06, 07, 08, 09 |
| W4 Tài liệu + bằng chứng | runbook §12 "Làm bằng admin", OPERATIONS, EVID-M7-001 | — |

## 9. Rollback và rủi ro

- Admin là công cụ trên máy; không có gì của admin lên production. Rollback = không dùng admin, quay lại CLI (vẫn nguyên).
- Rủi ro: `gh`/Cloudflare đổi định dạng check run → admin không tìm được link preview → dự phòng alias nhánh + thông báo; CI chậm → hiển thị thời gian chờ, cho phép rời trang (thao tác vẫn chạy trong server).
- Rủi ro: Owner tắt admin giữa chừng → trạng thái nằm trong git (nhánh/PR), mở lại admin thấy nhánh dữ liệu đang mở và đi tiếp.

## 10. Câu hỏi cho Owner

- **Q-M7-1:** nhánh tích hợp `m7-admin` (khuyến nghị) hay merge từng phần vào `main`?
- **Q-M7-2:** bắt buộc "smoke preview PASS cho đúng commit" mới cho publish (khuyến nghị: có)?

## 11. Approval

- Decision: `pending` — Owner trả lời "Ký G1" (cùng `ADR-0016`) hoặc nêu chỗ cần sửa. G3b (Security) bắt buộc ở G3 vì server nhận file và chạy lệnh git/gh.
