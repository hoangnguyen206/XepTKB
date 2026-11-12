# ADR-0015 — Design system M6 (token CSS tĩnh, bảng màu TS, font tự host, icon SVG nhúng) và settings giao diện trên máy

> **Artifact ID:** `ADR-0015`  
> **Artifact status:** `accepted` — G1 approved by Owner at `2026-11-12T15:28Z`  
> **Canonical gate:** `G1`  
> **Date:** 2026-11-12  
> **Owner:** Tech Lead + Frontend  
> **Decision owner:** Owner (Product + Tech Lead); Security Reviewer được tham vấn  
> **Last reviewed:** 2026-11-12  
> **Related docs:** [DESIGN-M6-001](../evidence/M6-DESIGN-HANDOFF.md), [SPEC-M6-001](../evidence/M6-SPEC.md), [PLAN-M6-001](../evidence/M6-FRONTEND-REFRESH-PLAN.md), [ADR-0010](ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0013](ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [ADR-0014](ADR-0014-m5-release-observability-without-telemetry.md), [Architecture](../ARCHITECTURE.md), [Security & privacy](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** `EVID-M6-001` — `N/A — docs-only` (chưa chạy code cho ADR này)  
> **Supersedes:** none. Đề xuất sửa câu chữ của ADR-0014 điểm 3 và ADR-0010 §2 quy tắc 4 (mục Decision, điểm 7)

## Source and context

- **Nguồn:** `SPEC-M6-001` (`g0-approved`, Owner `2026-11-12T14:53Z`), gồm M6-A, M6-B, M6-C, D-M6-2/4/5/6 và A-M6-3. Thiết kế chi tiết ở `DESIGN-M6-001` §2–§5.
- **Vấn đề:** M6 cần một hệ thiết kế có theme sáng/tối, bảng màu môn dùng chung cho CSS và canvas, một font tiếng Việt và bộ icon. Ngoài ra cần lưu 3 lựa chọn giao diện trên máy (theme, màu môn, gợi ý đã xem).
- **Ràng buộc phải giữ:**
  - không thêm dependency runtime (ADR-0010 §1 chỉ cho React);
  - CSP giữ nguyên `style-src 'self'`, `font-src 'self'`, `script-src 'self'`; không có script inline;
  - không `localStorage`/cookie (`scripts/lint.mjs`);
  - không request bên thứ ba;
  - IndexedDB `ky-nay` v1 không tăng version;
  - ngân sách D-M6-6: JS ban đầu ≤ 117 KiB gzip, CSS ≤ 12 KiB gzip, font ≤ 90 KB.
- **Requirement/AC:** AC-M6-01, AC-M6-02, AC-M6-07, AC-M6-12 (gợi ý), AC-M6-17, AC-M6-18.
- **Module bị ảnh hưởng:**
  - `apps/web/src/styles.css` (thay bằng thư mục **new** `apps/web/src/styles/`);
  - `apps/web/src/storage/local-data.ts`, `apps/web/src/storage/db.ts`, `apps/web/src/app/controller.ts`;
  - `apps/web/vite.config.ts` (font không bao giờ inline; precache tự có vì font nằm trong bundle);
  - `scripts/check-bundle-budget.mjs`, `scripts/bundle-budget.json`, `scripts/verify-production-bundle.mjs`, `scripts/lint.mjs`.
- **Contract bị ảnh hưởng:** chỉ `Settings` (store `settings`, key `"app"`), thêm 3 trường tùy chọn. Dataset, manifest, schema domain `0.2.0`, record Plan và định dạng ICS/Word giữ nguyên.

## Decision

1. **Token CSS tĩnh.** CSS thuần chia thành nhiều file trong **new** `apps/web/src/styles/`, gom bằng một entry **new** `styles/index.css` (cascade layer: legacy → tokens → base → components → screens → print) và chỉ import từ `main.tsx`. Module component không import CSS, nên build ra đúng một file CSS ban đầu và chunk lazy không có CSS. Mã màu chỉ được nằm trong **new** `styles/tokens.css`, **new** `styles/print.css` và **new** `model/palette.ts`.
2. **Theme.** Giá trị sáng đặt trên :root. Giá trị tối áp khi hệ điều hành ở chế độ tối và data-theme khác "light", hoặc khi data-theme là "dark". Thuộc tính **new** `data-theme` trên thẻ html do **new** `applyTheme` (**new** `app/theme.ts`) đặt sau khi đọc settings. Người dùng "Hệ thống" không bị nháy theme. Người chọn theme ngược với hệ điều hành thấy theme hệ điều hành trong lúc chờ đọc IndexedDB; rủi ro này được chấp nhận vì mọi cách tránh đều phải có script inline hoặc storage đồng bộ.
3. **Bảng màu môn là TS và là nguồn duy nhất.**
   - **new** `COURSE_PALETTE` gồm 10 cặp sáng/tối (giá trị và tỉ lệ ở DESIGN §3).
   - Màu tới CSS bằng custom property qua prop `style` của React. React ghi các thuộc tính này qua CSSOM, mà CSSOM không chịu `style-src` (tiền lệ: `--periods` trong `WeekGrid`).
   - Canvas export và test tương phản import thẳng module.
   - **new** `assignCourseColors` gán màu tất định: hash mã môn + dò theo thứ tự pick, màu người dùng chọn đè lên.
4. **Font tự host.**
   - Nguồn: Be Vietnam Pro 400/600/800, subset vietnamese + latin, chỉ woff2, lấy từ devDependency pin version **new** `@fontsource/be-vietnam-pro`.
   - Lưu trữ: **new** `scripts/sync-fonts.mjs` chép vào **new** `apps/web/src/assets/fonts/`, file được commit kèm giấy phép OFL.
   - Phục vụ: Vite băm tên file và đưa vào bundle, nên `serviceWorker()` precache mà không phải sửa `PUBLIC_SHELL`. Cấm inline dạng data: vì `font-src 'self'` sẽ chặn.
   - Nạp sẵn: **new** `warmFonts` nạp đủ 3 độ đậm lúc khởi động, để luồng nhập ĐKMH (cửa sổ 0 request trong `apps/web/e2e/m4.spec.ts`) không phát sinh request font.
   - Ngân sách: **new** `fontsMaxBytes` (90 000 B).
5. **Icon là component SVG nhúng** (**new** `components/icons.tsx`), path chép từ một release Lucide pin version (ISC, phần gốc Feather theo MIT). Không có icon font, không có file sprite, không có package icon. Giấy phép OFL/ISC/MIT nằm trong **new** `apps/web/public/licenses.txt` (precache).
6. **Settings giao diện trên máy** (trong `Settings`, không tăng version DB):

| Trường | Kiểu | Vắng thì | Xóa khi |
| --- | --- | --- | --- |
| `theme` (**new**) | "system", "light" hoặc "dark" (**new** `ThemePreference`) | "system" | "Xóa dữ liệu trên máy" |
| `courseColors` (**new**) | map mã môn chuẩn → **new** `CourseColorId` (tối đa 100 key) | màu tự động | chọn "Tự động" cho môn đó; "Xóa dữ liệu trên máy" |
| `seenHints` (**new**) | map **new** `HintId` → true | chưa xem gợi ý nào | "Xóa dữ liệu trên máy" |

   - Đọc qua **new** `sanitizeSettings` (giá trị lạ bị bỏ, không lỗi).
   - Ghi qua **new** `idbUpdate`: đọc và ghi trong một transaction readwrite, nên hai tab ghi cùng lúc không làm mất thay đổi của nhau. `updateSettings` và `removeFinalPlan` chuyển sang dùng hàm này.
   - Tab khác được báo bằng biến thể **new** `settings-changed` của `TabMessage` trên kênh BroadcastChannel sẵn có.
   - Xóa: `idbClearAll` xóa cả 3 trường; theme trở về "system".
7. **Câu chữ ở các ADR trước** (chờ Owner, xem DESIGN Q-3):
   - ADR-0014 điểm 3: phiên bản ứng dụng hiện ở sheet Giới thiệu (i), màn lỗi và thẻ meta `ky-nay-build`, thay cho footer luôn hiện (footer bỏ theo M6-D; AC-M5-01 đổi locator).
   - ADR-0010 §2 quy tắc 4: "banner không đóng được" cho dữ liệu chưa công bố/dữ liệu mẫu được thực hiện bằng chip trạng thái luôn hiện, không đóng được, trên mọi màn có dữ liệu; dấu trên file xuất giữ nguyên.

## Scope and non-goals

- **Trong phạm vi:** điểm 1–7 cho mọi bước M6 (F1–F7).
- **Không thuộc phạm vi:** đồng bộ settings giữa thiết bị; theme tùy biến ngoài bảng màu môn; font hay icon tải lúc chạy; đổi icon PWA; telemetry đo dùng theme. Bất kỳ trường settings nào chứa PII hay nội dung file ĐKMH cũng không thuộc phạm vi này.

## Options considered

| Vấn đề | Phương án | Lợi | Hại | Quyết định |
| --- | --- | --- | --- | --- |
| Cách viết style | Tailwind | tiện, quen tay | thêm plugin build; ADR-0010 §1.4 đã loại; khó đọc khi review a11y | loại |
| | CSS-in-JS lúc chạy | gần component | chèn thẻ style lúc chạy, bị `style-src 'self'` chặn; thêm dependency runtime | loại |
| | CSS Modules trong từng component | phạm vi class gọn | CSS của component lazy thành chunk riêng, sinh request và thoát ngân sách | loại |
| | CSS tĩnh + cascade layer, một entry | không dependency; một file CSS; thứ tự rõ; xóa dần legacy được | phải giữ quy ước đặt tên class | **chọn** |
| Bảng màu | class CSS cho từng màu | không cần prop style | phải viết bảng màu hai lần (CSS và canvas), dễ lệch | loại |
| | sinh CSS từ TS bằng plugin Vite | một nguồn | thêm plugin, khó test | loại |
| | TS + custom property qua prop style | một nguồn cho CSS, canvas và test; CSP cho phép | mỗi ô lịch mang 6 custom property | **chọn** |
| Theme tối | hàm CSS light-dark() | một dòng cho mỗi token | trình duyệt cũ thiếu hàm thì token mất hẳn giá trị, cần nhánh @supports | loại |
| | khối tối lặp ở media query và ở data-theme | chạy trên mọi trình duyệt trong matrix | lặp text (gzip gần như không tính phí); test kiểm hai khối giống nhau | **chọn** |
| Tránh nháy theme | script inline trong index.html | không nháy | vi phạm `script-src 'self'` (hoặc phải thêm hash, tức sửa CSP) | loại |
| | cookie hoặc `localStorage` | đọc đồng bộ | lint cấm; không bị `idbClearAll` xóa | loại |
| | chấp nhận nháy khi theme ngược hệ điều hành | không đổi CSP hay boundary | có thể nháy vài khung hình | **chọn** |
| Font | Google Fonts CDN | khỏi lưu file | request bên thứ ba, sửa CSP, lộ IP cho bên thứ ba | loại |
| | font hệ thống | 0 byte | dấu tiếng Việt và độ rộng khác nhau giữa các máy; ảnh so sánh và canvas thiếu nhất quán | loại |
| | tự host trong `public/` | URL ổn định | tên không băm (dễ dính cache cũ); phải tự thêm vào `PUBLIC_SHELL` | loại |
| | tự host trong thư mục src/assets/fonts (**new**, Vite băm tên) | cache bất biến; precache tự động; kiểm ngân sách được | phải chặn inline dạng data: | **chọn** |
| Icon | icon font | một file | thêm request; a11y kém; tải cả bộ | loại |
| | package icon (lucide-react) | dễ cập nhật | thêm dependency runtime | loại |
| | component SVG nhúng, export riêng từng icon | 0 request; chỉ icon được dùng vào bundle | path chép tay, cần ghi version + giấy phép | **chọn** |
| Chỗ lưu settings | `localStorage` | API đơn giản | lint cấm; không nằm trong luồng xóa hiện có | loại |
| | store IndexedDB mới | tách riêng | tăng version DB, cần migration, rủi ro chặn nhiều tab | loại |
| | trường tùy chọn trong record `settings` | không tăng version; xóa cùng dữ liệu; M5 đọc vẫn được | phải sanitize khi đọc | **chọn** |

## Consequences

### Positive

- Không thêm dependency runtime và không thêm request bên thứ ba; CSP giữ nguyên. Có đúng một devDependency (font) và nó có integrity trong lockfile.
- Màu môn đồng nhất giữa lưới, danh sách, ảnh PNG và poster. Độ tương phản được kiểm tự động từ cùng một module.
- Settings mới không cần migration và rollback về M5 không mất dữ liệu.

### Negative / risks

- Người chọn theme ngược với hệ điều hành có thể thấy nháy theme trong lúc tải.
- Bảng token tối được viết hai lần; test kiểm hai bản giống nhau.
- Kích thước 6 file font chưa đo; nếu vượt 90 KB thì Owner phải quyết (bỏ một độ đậm hoặc nới ngân sách).
- JS ban đầu chỉ còn trống khoảng 10.3 KiB (đo ở `5fdce55`). DESIGN-M6-001 §14 có ngưỡng kích hoạt để dời phần export sang chunk lazy.

### Privacy/security

- **Dữ liệu qua boundary:** không có. Ba trường mới chỉ chứa mã môn công khai và cờ giao diện, nằm trong IndexedDB trên máy. Chúng không vào request, log, file xuất, văn bản báo lỗi (`buildIssueReport`) hay URL. Không có PII và không có gì lấy từ file ĐKMH.
- **Control:**
  - lint thêm luật cấm tạo phần tử style, constructable stylesheet, constructor FontFace và url() có scheme trong CSS;
  - `verify-production-bundle` kiểm CSP meta bằng đúng chuỗi đã chốt, mọi woff2 có trong precache và không có trang mẫu (gallery) trong `dist`;
  - các assertion privacy của `apps/web/e2e/m4.spec.ts` giữ nguyên từng byte.
- **Security review:** G1 chỉ cần tham vấn vì không mở boundary PII/vendor/auth/external mới. **G3b bắt buộc** ở cuối M6, vì M6 sửa precache của SW và storage (điều khoản mở lại ở cuối ADR-0010).

### Operations/migration

- **Rollout:** theo các bước F1–F7 của DESIGN-M6-001 §13. Không cần migration.
- **Tương thích:**

| Bản app \ dữ liệu | Settings không có 3 trường | Settings có 3 trường |
| --- | --- | --- |
| M5 (sau rollback) | như hiện nay | bỏ qua; khi ghi vẫn giữ nguyên (spread trong `updateSettings`, `removeFinalPlan` ghi lại đúng object đã đọc) |
| M6 | dùng mặc định | dùng; giá trị lạ bị `sanitizeSettings` loại |

- **Rollback:** revert PR của phase hoặc cả M6. Khi SW mới activate, các cache `ky-nay-shell-*` cũ (cả font) bị xóa. **Kích hoạt khi:** S0/S1 ở G3 của M6, smoke fail, hoặc font/chunk không mở được offline. **Owner:** Release Manager.

## Reproducible evidence and acceptance

- **Đã chạy:** chưa chạy gì cho ADR này (`N/A — docs-only`). Baseline kích thước đọc bằng `npm run build:web` + `node scripts/check-bundle-budget.mjs` được ghi ở DESIGN-M6-001 §1. Tỉ lệ tương phản được tính bằng một script tạm, không nằm trong repo; chúng sẽ được thay bằng kết quả của **new** `apps/web/src/styles/contrast.test.ts` ở G2.
- **Acceptance:**
  - AC-M6-01 (theme lưu, tương phản ≥ 4.5 ở hai theme);
  - AC-M6-02 (font cùng origin, precache, ≤ 90 KB);
  - AC-M6-07 (màu môn còn sau khi tải lại);
  - AC-M6-17/18 (ngân sách, CSP, không `localStorage`, offline giữ theme và màu);
  - các test ở DESIGN-M6-001 §12.
- **Giới hạn đã biết:** có thể nháy theme (điểm 2); trên iOS, focus bằng code không mở bàn phím.

## Approval and risk acceptance

- **Decision:** `g1-approved` cùng DESIGN-M6-001.
- **Accepted by / actor / UTC date:** Owner (Product + Tech Lead; Security consulted), `2026-11-12T15:28Z` (chat). Sửa đổi ADR-0014 điểm 3 và ADR-0010 §2 quy tắc 4 được chấp nhận cùng lúc.
- **Risk exception:** none.

## Follow-up and history

| Action | Owner | Due/trigger | Status |
| --- | --- | --- | --- |
| Pin version `@fontsource/be-vietnam-pro`, đo 6 file woff2 so với 90 KB | Platform | F1a | open |
| Thêm 3 trường settings vào kho dữ liệu cá nhân trong `docs/SECURITY_PRIVACY.md` §2 | Security Reviewer | G2 của F1b | open |
| Sửa câu chữ ADR-0014 điểm 3 và ADR-0010 quy tắc 4 nếu Owner đồng ý (Q-3) | Tech Lead | khi ký G1 | open |
| Thêm ADR-0015 vào bảng ADR của `docs/README.md` và `docs/TECH_STACK.md` | Tech Lead | khi ký G1 | open |

| Change ID | Date/actor | Reason | Supersedes |
| --- | --- | --- | --- |
| ADR-0015-r0 | 2026-11-12, Tech Lead (agent) | Đề xuất ban đầu cho G1 của M6 | — |
