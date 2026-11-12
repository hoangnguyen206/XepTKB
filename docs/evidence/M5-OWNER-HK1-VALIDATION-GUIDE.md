# Hướng dẫn Owner kiểm thử M5 bằng TKB HK I 2026–2027 trên nhánh preview

> **Artifact ID:** `GUIDE-M5-HK1-001`  
> **Artifact status:** `draft` — chưa được thực hiện; chờ G0/G1 của M5 và commit G2 trên `m5-release-hardening`  
> **Canonical gate:** bước Owner thuộc `SPEC-M5-001` flow 5 (M5-K, AC-M5-16); đầu vào cho P-13 của [release checklist](M5-RELEASE-CHECKLIST.md); **không** phải G4a/G4b production  
> **Owner:** Release Manager (người thực hiện: Owner)  
> **Last reviewed:** 2026-11-10  
> **Related docs:** [M5 spec §4–§5](M5-SPEC.md), [M5 design handoff §10](M5-DESIGN-HANDOFF.md), [Data ingestion runbook §12](../DATA_INGESTION_RUNBOOK.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [Operations](../OPERATIONS.md), [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md), [M5 release report (draft)](M5-RELEASE-REPORT.md), [M0 fixture policy](M0-FIXTURE-POLICY.md)  
> **Evidence envelope:** `EVID-M5-001` (kết quả ghi vào [release report](M5-RELEASE-REPORT.md) mục Post-release; tài liệu này `N/A — docs-only`)

## 0. Mục đích và giới hạn

- Thử bản M5 bằng dữ liệu thật (D-M5-1) trên **URL preview Cloudflare** của một nhánh riêng, trên điện thoại và desktop.
- Dataset HK I chỉ nằm trên nhánh `m5-hk1-validation`. **Không** merge nhánh này vào `m5-release-hardening` hay `main`; `main` phải giữ `data/published/manifest.json` với `"datasets": []` (AC-M5-16).
- Không deploy production, không tạo tag.
- Mọi lệnh đã đối chiếu với `scripts/test-real.mjs`, `scripts/dataset.mjs`, `scripts/lib/dataset-core.mjs` tại `bcce6c6`. Lệnh `smoke-deploy` theo contract [DESIGN-M5-001 §7](M5-DESIGN-HANDOFF.md); script đang được WP2 viết — nếu chưa có trong nhánh của bạn, bỏ qua bước §6 và ghi `not-run`.

## 1. Chuẩn bị

1. Node `22.22.2` trở lên (`node --version`), đã `npm ci` trong repo.
2. Working tree sạch: `git status` không có thay đổi.
3. Commit G2 của M5 đã có trên `m5-release-hardening` (footer phiên bản, trang Giới thiệu, báo lỗi, banner dữ liệu cũ, icon). Nếu bạn thử sớm hơn, các mục §7 đánh dấu (M5) sẽ chưa có — ghi rõ commit đã thử.
4. File TKB HK I `.xlsx` để **ngoài repo**, ví dụ `C:\Users\<bạn>\Downloads\` hoặc `~/Downloads/`. Đặt tên file **không chứa thông tin cá nhân** — tên file được ghi vào báo cáo import (`data/reports/<version>.md`).
5. (Tùy chọn) File kết quả ĐKMH `.doc` của chính bạn, cũng để **ngoài repo**. File này chứa họ tên, mã sinh viên, ngày sinh: chỉ mở trong app trên trình duyệt, không bao giờ copy vào repo, commit, gửi kèm báo lỗi hay chụp màn hình có thông tin đó.

Trong các lệnh dưới đây, thay `<HK1.xlsx>` bằng đường dẫn đầy đủ của file.

> **Ghi chú PowerShell:** `npm run <script> -- <args>` gọi `npm run build` rồi `node scripts/<script>.mjs <args>`. Trên PowerShell, để tránh khác biệt khi truyền `--` qua `npm`, hướng dẫn dùng hai bước tương đương: `npm run build` một lần, sau đó gọi thẳng `node scripts/...`. Trong PowerShell 5.1, `curl` là alias của `Invoke-WebRequest`; dùng `curl.exe`.

## 2. Tạo nhánh

PowerShell và bash giống nhau:

```text
git fetch origin
git switch m5-release-hardening
git pull --ff-only
git switch -c m5-hk1-validation
git rev-parse --short=7 HEAD
```

Ghi lại `sha7` gốc (commit M5 đang được thử).

## 3. Thử parser, không ghi gì (`test:real`)

PowerShell:

```powershell
npm run build
node scripts/test-real.mjs "C:\Users\<bạn>\Downloads\<HK1.xlsx>" --term 2026-2027-h1
```

bash:

```bash
npm run test:real -- "$HOME/Downloads/<HK1.xlsx>" --term 2026-2027-h1
```

Kết quả phải là exit `0`: `format reviewed`, `unaccounted 0`, không dòng `error`. Mốc tham chiếu từ [DRILL-M3-G4b-001](M3-G4b-DRILL-REPORT.md) cho file "TKB HKI 2026-2027 SAU ĐKH 04.09.2026": 354 courses, 1,077 sections, 1,467 sessions (file khác phiên bản sẽ có số khác).

- Exit `1` (lỗi hoặc dòng chưa giải thích) → **dừng**, không import.
- Exit `2` (bộ cột mới) → **dừng**; không dùng `--accept-new-format` khi chưa đọc bộ cột ([ADR-0011](../adr/ADR-0011-timetable-format-variability.md)).

Kiểm tra file ĐKMH của bạn (tùy chọn; chỉ in số đếm và mã lỗi, không in giá trị ô):

```powershell
node scripts/test-real.mjs "C:\Users\<bạn>\Downloads\<ket-qua-dkmh>.doc" --adapter vnu-registration-html
```

```bash
npm run test:real -- "$HOME/Downloads/<ket-qua-dkmh>.doc" --adapter vnu-registration-html
```

## 4. Import thành `candidate`

Ngày thứ Hai tuần 1 của HK I theo [PRD §4 P0 #2](../PRD.md) và đã dùng trong [drill](M3-G4b-DRILL-REPORT.md): **K67, K68, K69, K70 = 2026-09-07**, **K71 = 2026-10-12**; 15 tuần học.

PowerShell (dòng kết thúc bằng dấu backtick `` ` `` để xuống dòng — không để khoảng trắng sau dấu này):

```powershell
node scripts/dataset.mjs import "C:\Users\<bạn>\Downloads\<HK1.xlsx>" `
  --term 2026-2027-h1 `
  --term-name "Học kỳ I năm học 2026–2027" `
  --source-type official-timetable `
  --document-ref "<tên thông báo TKB, ví dụ TKB HKI 2026-2027 SAU ĐKH 04.09.2026>" `
  --published-by "<đơn vị phát hành, ví dụ Phòng Đào tạo UET>" `
  --actor "Owner" `
  --weeks 15 `
  --start "K67,K68,K69,K70=2026-09-07" `
  --start "K71=2026-10-12"
```

bash:

```bash
npm run dataset -- import "$HOME/Downloads/<HK1.xlsx>" \
  --term 2026-2027-h1 \
  --term-name "Học kỳ I năm học 2026–2027" \
  --source-type official-timetable \
  --document-ref "<tên thông báo TKB, ví dụ TKB HKI 2026-2027 SAU ĐKH 04.09.2026>" \
  --published-by "<đơn vị phát hành, ví dụ Phòng Đào tạo UET>" \
  --actor "Owner" \
  --weeks 15 \
  --start "K67,K68,K69,K70=2026-09-07" \
  --start "K71=2026-10-12"
```

Lệnh in `dataset: imported <version> as candidate` với `<version>` dạng `uet-2026-2027-h1-<YYYYMMDD>-<8 hex>`; ghi lại `<version>`. Các trường văn bản phải một dòng, không ký tự điều khiển, ≤ 240 ký tự; `--actor` dùng tên vai trò, không cần tên thật.

Đọc `data/reports/<version>.md`: tiêu đề tiếng Việt hiển thị đúng, ngày tuần 1, cột `info`, ghi chú "tuần", warnings. Nếu có gì sai **trước khi commit**, hủy import rồi chạy lại:

```text
git restore data/
git clean -fd -- data/
```

(`git clean` không đụng file bị ignore như `data/raw/`; vẫn kiểm `git status` trước.)

## 5. Commit dữ liệu trên nhánh và push

```text
git add data/
git status
git commit -m "data(hk1-validation): import <version> as candidate (preview only, do not merge)"
git push -u origin m5-hk1-validation
git rev-parse --short=7 HEAD
```

`git status` trước khi commit chỉ được có file dưới `data/` (`data/published/manifest.json`, `data/published/schools/uet/terms/2026-2027-h1/<version>/…`, `data/reports/<version>.md`, `data/audit.jsonl`). Không mở PR: workflow CI chỉ chạy trên `push` vào `main` và `pull_request`, còn Cloudflare tự build preview cho nhánh.

Trong dashboard Cloudflare Pages → project → Deployments: đợi build của nhánh `m5-hk1-validation` thành công; lấy URL nhánh dạng `https://m5-hk1-validation.<project-subdomain>.pages.dev` (subdomain chính xác hiển thị trong dashboard).

## 6. Smoke preview (khi `scripts/smoke-deploy.mjs` đã có)

```text
node scripts/smoke-deploy.mjs https://m5-hk1-validation.<project-subdomain>.pages.dev --expect-commit <sha7 của commit vừa push>
```

Không dùng `--production` (preview có dataset `candidate`). Mong đợi toàn bộ PASS: header bảo mật, commit trong `meta ky-nay-build`, `sw.js`/`manifest.json` `no-cache`, icon PNG, hash artifact khớp. FAIL → ghi lại, không validate.

## 7. Checklist trên điện thoại và desktop

Thiết bị: ít nhất một Tier 1 thật (Chrome Android hoặc Safari iOS) và Chrome/Edge desktop; thêm 360 px và ~1200 px trên desktop nếu được.

| # | Kiểm tra | Mong đợi |
| --- | --- | --- |
| 1 | Mở URL nhánh lần đầu | Banner "Dữ liệu chưa được công bố" (trạng thái `candidate`/`validated`); không có banner "Dữ liệu mẫu" |
| 2 | Onboarding: chọn khóa (ví dụ K68, rồi thử K71) | Ngày tuần 1 gợi ý là 07/09/2026 (K67–K70) hoặc 12/10/2026 (K71), sửa được |
| 3 | Tìm theo mã môn và tên môn (ví dụ một mã có thật trong file) | Ra kết quả nhanh; đối chiếu 3–5 lớp với file nguồn: thứ, tiết, phòng, giảng viên, tuần |
| 4 | Chọn hai lớp trùng giờ cùng tuần | Cảnh báo trùng hiện bằng chữ; hai lớp trùng giờ nhưng khác tuần không bị báo |
| 5 | Lịch tuần / xem theo ngày, chuyển tuần | Đúng tuần học; lớp `Ca` nhiều tiết, lớp online/không cố định giờ, lớp nhóm thực hành hiển thị đúng; lớp bị hủy không xuất hiện |
| 6 | Nhập kết quả ĐKMH bằng file `.doc` của bạn ("Nhập kết quả ĐKMH") | Parse trên máy; Plan chính thức có huy hiệu đổi phòng/giờ khi khác TKB. Trên desktop mở DevTools → Network trước khi chọn file: **không** có request nào từ lúc chọn file tới khi xuất |
| 7 | Export PNG / Word / ICS, in | Mở file xuất ra, xem bằng mắt; ICS nhập vào ứng dụng lịch đúng ngày |
| 8 | (M5) Footer | Hiện version + `sha7` khớp commit vừa push + thời điểm build |
| 9 | (M5) "Giới thiệu, quyền riêng tư & báo lỗi" | Ghi rõ công cụ độc lập, không phải sản phẩm của nhà trường; nguồn dữ liệu; quyền riêng tư; cách xóa dữ liệu; trình duyệt hỗ trợ |
| 10 | (M5) "Báo sai dữ liệu" trên một thẻ lớp → "Sao chép" | Văn bản chỉ gồm version app, dataset, mã lớp/môn, trường bị sai, ghi chú bạn gõ; **không** có họ tên/MSSV/ngày sinh, danh sách lớp đã chọn, tên file. Không gửi gì tự động |
| 11 | Offline: mở app online một lần, đợi tải xong, bật chế độ máy bay, mở lại | App và dữ liệu vẫn dùng được; banner "Đang ngoại tuyến" hiện, (M5) kèm tuổi dữ liệu; nhập ĐKMH vẫn mở được |
| 12 | Cập nhật: sau lần push tiếp theo (ví dụ commit `validate` ở §8), mở lại app đã mở trước đó | Thông báo "Có phiên bản mới của ứng dụng" + nút "Tải lại"; sau khi tải lại, footer hiện `sha7` mới |
| 13 | (M5) Cài PWA (Add to Home Screen / Install) | Icon PNG đúng, không bị cắt (maskable) |
| 14 | Dọn dữ liệu trên máy thử: "Xóa dữ liệu trên máy" | Plan và dữ liệu nhập bị xóa sau bước xác nhận |

Cảnh báo `expiresAt` (M5-D) sẽ **không** hiện: `dataset import` không đặt `expiresAt`. Hành vi này được kiểm bằng test tự động, không phải lỗi.

Ghi kết quả từng dòng (đạt / không đạt + mô tả ngắn, không PII). Lỗi dữ liệu → so với file nguồn trước khi kết luận parser sai.

## 8. Validate (và publish tùy chọn) với single reviewer

Bạn vừa là người nạp vừa là người duyệt, nên phải ghi ngoại lệ (D-M5-3, `RA-M5-001`):

PowerShell:

```powershell
node scripts/dataset.mjs validate <version> --reviewer "Owner" `
  --note "HK I validation on preview m5-hk1-validation; checklist §7 done" `
  --accept-single-reviewer "Single maintainer, RA-M5-001; preview-only HK I validation"
```

bash:

```bash
npm run dataset -- validate <version> --reviewer "Owner" \
  --note "HK I validation on preview m5-hk1-validation; checklist §7 done" \
  --accept-single-reviewer "Single maintainer, RA-M5-001; preview-only HK I validation"
```

Tùy chọn — diễn tập publish trên nhánh (vẫn chỉ preview; banner "chưa được công bố" biến mất):

```powershell
node scripts/dataset.mjs publish <version> --by "Owner" --accept-single-reviewer "Single maintainer, RA-M5-001; preview-only HK I drill"
```

```bash
npm run dataset -- publish <version> --by "Owner" --accept-single-reviewer "Single maintainer, RA-M5-001; preview-only HK I drill"
```

Sau mỗi lệnh đổi trạng thái: `git add data/`, commit, push (đây cũng là lần deploy dùng cho kiểm tra #12 ở §7).

## 9. Kiểm trạng thái và integrity

```powershell
node scripts/dataset.mjs status
node scripts/dataset.mjs check
```

```bash
npm run dataset -- status
npm run dataset -- check
```

Mong đợi: `status` liệt kê `<version>` với trạng thái hiện tại; `check` in `data/published OK — 1 datasets (…)`, exit `0`.

## 10. Ghi kết quả

Ghi vào [release report](M5-RELEASE-REPORT.md) dòng "HK I validation": `sha7` gốc và `sha7` các commit dữ liệu, `<version>`, số đếm `test:real`, exit code từng lệnh, kết quả smoke, kết quả checklist §7 theo số dòng, thiết bị/trình duyệt đã dùng, xác nhận dọn dẹp §11. **Không** ghi họ tên, MSSV, ngày sinh, tên file ĐKMH, ảnh chụp có thông tin cá nhân.

## 11. Dọn dẹp

Chọn một:

**A. Xóa nhánh (khuyến nghị khi đã xong):**

```text
git switch m5-release-hardening
git branch -D m5-hk1-validation
git push origin --delete m5-hk1-validation
```

Các preview deployment cũ của nhánh vẫn còn trong dashboard Pages; nếu muốn, xóa chúng trong Deployments (nhãn hành động cụ thể xác minh trong dashboard). Dữ liệu là TKB công khai, không PII, nhưng không quảng bá URL.

**B. Giữ nhánh cho beta link một thời gian:** không merge; khi xong, `retract` rồi xóa nhánh như A:

```powershell
node scripts/dataset.mjs retract <version> --by "Owner" --reason "HK I validation finished"
```

```bash
npm run dataset -- retract <version> --by "Owner" --reason "HK I validation finished"
```

Xác nhận sau dọn dẹp:

```text
git fetch origin
git show origin/main:data/published/manifest.json
git show origin/m5-release-hardening:data/published/manifest.json
```

Cả hai phải có `"datasets": []`. Không bao giờ `git merge m5-hk1-validation` vào `m5-release-hardening` hoặc `main`; nếu lỡ mở PR, đóng PR không merge. Nếu cần code M5 mới hơn trên nhánh thử, merge **từ** `m5-release-hardening` **vào** `m5-hk1-validation`, không làm chiều ngược lại. Dataset HK I chỉ lên `main` khi Owner quyết định khác và ghi decision.

## 12. Nhắc lại về quyền riêng tư

- File TKB thô và file ĐKMH luôn ở ngoài repo (`assertOutsideRepo` từ chối đường dẫn trong repo, trừ các thư mục bị ignore như `data/raw/`, `fixtures/real/`).
- Không commit file `.doc` kết quả đăng ký; `.gitignore` chỉ chặn một số mẫu tên (`ket-qua-dang-ky*`, `/*.doc` ở gốc repo) nên đừng dựa vào nó.
- Không dán thông tin cá nhân vào báo lỗi, commit message, `--note`, `--reason`, `--document-ref` hay release report.
- Sau khi thử trên máy dùng chung, dùng "Xóa dữ liệu trên máy".
- App không có telemetry (ADR-0014); mọi xử lý file ĐKMH diễn ra trong trình duyệt của bạn.
