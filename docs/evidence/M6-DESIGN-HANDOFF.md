# M6 design handoff — "Lịch có màu": design system, khung app và luồng mới

> **Artifact ID:** `DESIGN-M6-001`  
> **Artifact status:** `g1-approved`  
> **Canonical gate:** `G1`  
> **Owner:** Tech Lead (+ Frontend, Platform theo work package §13)  
> **Last reviewed:** 2026-11-12  
> **Related docs:** [SPEC-M6-001](M6-SPEC.md), [PLAN-M6-001](M6-FRONTEND-REFRESH-PLAN.md), [ADR-0015](../adr/ADR-0015-m6-design-system-and-local-ui-settings.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0013](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md), [DESIGN-M5-001](M5-DESIGN-HANDOFF.md), [Architecture](../ARCHITECTURE.md), [Security & privacy](../SECURITY_PRIVACY.md), [QA plan](../QA_TEST_PLAN.md)  
> **Evidence envelope:** `EVID-M6-001` — `N/A — docs-only` (tạo ở G2). Số đo ở §1 là lệnh đọc để lấy baseline, không phải bằng chứng G2.  
> **Decision actor / UTC timestamp:** Approved by Owner (Tech Lead; Security consulted) at `2026-11-12T15:28Z` (chat: "Ký G1")

## 1. Nguồn, ràng buộc và baseline

- **Nguồn:** `SPEC-M6-001` (`g0-approved`, Owner `2026-11-12T14:53Z`): M6-A…J, AC-M6-01…20, D-M6-1…8, A-M6-1…3. `PLAN-M6-001` §4–§8 (F0–F7). Brief SHA-256 `295BB158F14D9C3C23F920A0CFF7A5DBDC1B76FC88885AFE9992FBA55D650B1E`. Code đọc tại nhánh docs/m6-frontend-plan @ `5fdce55`. Quy ước: đường dẫn ngắn tính từ `apps/web/src/` (code) hoặc `apps/web/` (`e2e/`, `gallery.html`); mọi file, identifier, token CSS, thuộc tính, key hay script chưa có ở `5fdce55` được đánh dấu **new**.
- **Giữ nguyên:** `apps/web/src/data/loader.ts` là module mạng duy nhất; CSP `CSP` trong `apps/web/vite.config.ts` không đổi một ký tự; không `localStorage`/cookie (`scripts/lint.mjs`); IndexedDB `ky-nay` v1, 4 store (`STORE_NAMES`); schema domain `0.2.0`, manifest `1.0`; ICS/Word không đổi định dạng (`icsFile`, `wordFile` không bị sửa); chunk `RegistrationImport-` vẫn lazy và prefetch khi `Workspace` mount; mọi assertion privacy của `apps/web/e2e/m4.spec.ts`.
- **Ngoài phạm vi:** parser/domain/export ICS-Word, màn "Hôm nay"/đếm ngược (vì vậy Lịch ngày **không** có đếm ngược dù PLAN §5 nhắc), đổi icon PWA, telemetry, font/script bên thứ ba.
- **Baseline đo** (Windows, Node v22.22.2, `npm run build:web` rồi `node scripts/check-bundle-budget.mjs`, cả hai exit 0, gzip mức 9):

| Asset | Raw | Gzip-9 | Ngân sách hiện tại → M6 |
| --- | --- | --- | --- |
| `assets/index-*.css` (CSS ban đầu, 1 file) | 14 412 B | **3 771 B** | `initialCssGzipMax` 5 120 → **12 288** (D-M6-6) |
| `assets/index-*.js` (JS ban đầu) | 358 610 B | **109 226 B** | `initialJsGzipMax` 119 808 (giữ) — còn trống 10 582 B |
| `assets/RegistrationImport-*.js` (lazy) | 107 682 B | 38 225 B | `lazyChunkGzipMax` 43 008 (giữ) |
| Font | 0 | — | **new** `fontsMaxBytes` 90 000 B raw woff2 (đọc "90 KB" theo nghĩa chặt). Đo ở F1a: 6 file 400/600/800 = 101 632 B, vượt; Owner chọn bỏ 600 (D-M6-12) → 4 file = 67 424 B |

- **Precache hiện tại** (`serviceWorker()` trong `apps/web/vite.config.ts`: `./` + `Object.keys(bundle)` trừ `.map` và `NOT_PRECACHED`, cộng `PUBLIC_SHELL`), đọc lại từ `dist/sw.js` vừa build: ./ · ./assets/RegistrationImport-[hash].js · ./assets/index-[hash].css · ./assets/index-[hash].js · ./icon.svg · ./manifest.webmanifest · ./icons/icon-192.png · ./icons/icon-512.png · ./icons/icon-maskable-512.png · ./icons/apple-touch-icon.png (10 mục). M6 thêm 4 file woff2 (tự động qua bundle; D-M6-12), chunk poster (lazy) và **new** licenses.txt (qua `PUBLIC_SHELL`).

## 2. Token, CSS và theme (M6-A)

- **Cấu trúc CSS:** **new** `apps/web/src/styles/index.css` là entry duy nhất, `main.tsx` chỉ import file này. Thứ tự cascade layer: tokens → base → legacy → components → screens → print (sửa ở F1b: bản G1 ghi legacy thấp nhất, nhưng rule phần tử của base như `button { color: inherit }` ở layer cao hơn sẽ đè class của legacy bất kể specificity, làm `.button.primary` mất màu chữ; component mới vẫn đè legacy). File **new**: `styles/tokens.css`, `styles/fonts.css`, `styles/base.css`, `styles/print.css`, `styles/components/<thành phần>.css`, `styles/screens/<màn>.css`. `apps/web/src/styles.css` chuyển thành **new** `styles/legacy.css` bọc trong layer legacy; mỗi phase xóa phần mình thay; F7 xóa hẳn.
- **Không import CSS trong module component.** Lý do: Vite tách CSS của module lazy thành chunk riêng, chunk ĐKMH sẽ kéo thêm request và thoát ngân sách. Ngân sách thêm khóa **new** `requireSingleCss: true` (đúng một file CSS trong `dist/assets` và nó thuộc tập ban đầu).
- **Token:** màu (bảng §2.1), chữ (Be Vietnam Pro 400/800 — D-M6-12 bỏ 600, mọi chỗ trong tài liệu này ghi độ đậm 600 thì dùng 800; thang 12/14/16/20/28/40), khoảng cách lưới 4 px, bo góc **new** `--r-sm`/`--r-md`/`--r-lg` = 10/16/24 px, 2 mức bóng, chuyển động 150/250 ms, **new** `--tap` 44 px. Mã màu hex chỉ được nằm trong `styles/tokens.css`, `styles/print.css` và `model/palette.ts`; test tương phản (§12) quét các file CSS khác và fail nếu thấy hex.
- **Sáng/tối:** giá trị sáng trên `:root`. Khối tối viết ở hai chỗ: trong media query prefers-color-scheme dark, áp cho :root khi data-theme khác "light"; và cho :root có data-theme="dark". Gzip gần như không tính phí phần lặp; test tương phản kiểm hai khối giống hệt nhau. `color-scheme` đổi theo để control gốc (ô ngày, thanh cuộn) đúng theme. In luôn dùng giá trị sáng (**new** `styles/print.css`).
- **Áp theme đã lưu, không script inline:** **new** `apps/web/src/app/theme.ts` có **new** `applyTheme(pref)`: đặt hoặc xóa thuộc tính **new** `data-theme` trên thẻ html và cập nhật 2 thẻ meta theme-color (`index.html` thêm biến thể theo media). `useAppController` gọi hàm này ngay sau `loadSettings` trong effect khởi động, **trước** khi tải dataset; gọi lại khi đổi theme, khi nhận `settings-changed`, và sau xóa dữ liệu (về "Hệ thống"). Người dùng để "Hệ thống" (mặc định) không bị nháy theme. Ai chọn theme ngược với hệ điều hành sẽ thấy theme hệ điều hành trong lúc chờ đọc IndexedDB (màn "Đang tải…", thường dưới vài chục ms). Rủi ro này được chấp nhận vì CSP cấm script inline và lint cấm `localStorage` (ADR-0015).

### 2.1 Token màu (tỉ lệ WCAG tính bằng script, chưa đo trên màn hình)

Đã có trong `styles.css` (giữ tên, đổi giá trị): `--bg`, `--surface`, `--muted`, `--danger`, `--danger-weak`, `--success`, `--focus`. Mọi token khác trong bảng là **new**.

| Token | Sáng | Tối | Cặp kiểm (sáng / tối) |
| --- | --- | --- | --- |
| `--bg` / `--surface` / `--surface-2` | #F5F6FA / #FFFFFF / #EEF0F6 | #0E1020 / #181A2E / #22253D | — |
| `--ink` | #15172A | #ECEDF7 | trên bg 16.37 / 16.18; trên surface-2 15.52 / 12.87 |
| `--muted` | #5B5F78 | #A3A7C2 | trên bg 5.80 / 7.96; trên surface-2 5.50 / 6.33 |
| `--accent` + `--accent-ink` | #4F46E5 + #FFFFFF | #818CF8 + #0E1020 | 6.29 / 6.32 |
| `--accent-text` (chữ nhấn) | #4338CA | #A5B4FC | trên surface 7.90 / 8.59 |
| `--danger` (chữ) / `--danger-weak` | #B91C1C / #FEE2E2 | #F87171 / #3B1219 | 5.30 / 5.90 |
| `--warning` / `--warning-weak` | #92400E / #FEF3C7 | #FCD34D / #3A2A0A | 6.37 / 9.61 |
| `--success` / `--success-weak` | #15803D / #DCFCE7 | #4ADE80 / #0B2E1A | 4.57 / 8.49 |
| `--line-strong` (viền ô nhập), `--focus` | #8A8EA8, #4F46E5 | #6B6F8E, #A5B4FC | 3.22 / 3.50 (≥ 3:1); focus trên bg 5.82 / 9.46 |
| Trùng lịch | viền #DC2626, nhãn chữ trắng trên #B91C1C | viền #F87171, nhãn như sáng | nhãn 6.47 ở cả hai theme |

## 3. Bảng màu môn — một nguồn duy nhất (M6-A)

- **new** `apps/web/src/model/palette.ts` export `COURSE_PALETTE` (10 mục `{ id, light: { bg, edge, ink }, dark: { bg, edge, ink } }`), kiểu **new** `CourseColorId`, `CourseColor`, các hàm **new** `isCourseColorId`, `assignCourseColors`, `courseOrder`, `courseColorStyle`.

| id | Sáng bg / edge / ink | Tối bg / edge / ink | ink/bg sáng / tối |
| --- | --- | --- | --- |
| violet | #EDE9FE / #7C3AED / #4C1D95 | #2E1065 / #A78BFA / #EDE9FE | 9.23 / 12.83 |
| blue | #DBEAFE / #2563EB / #1E3A8A | #172554 / #60A5FA / #DBEAFE | 8.49 / 12.04 |
| cyan | #CFFAFE / #0E7490 / #164E63 | #083344 / #22D3EE / #CFFAFE | 8.14 / 11.97 |
| teal | #CCFBF1 / #0F766E / #134E4A | #042F2E / #2DD4BF / #CCFBF1 | 8.41 / 12.84 |
| green | #DCFCE7 / #15803D / #14532D | #052E16 / #4ADE80 / #DCFCE7 | 8.30 / 13.57 |
| lime | #ECFCCB / #4D7C0F / #365314 | #1A2E05 / #A3E635 / #ECFCCB | 8.05 / 13.47 |
| amber | #FEF3C7 / #B45309 / #78350F | #451A03 / #FBBF24 / #FEF3C7 | 8.15 / 13.45 |
| orange | #FFEDD5 / #C2410C / #7C2D12 | #431407 / #FB923C / #FFEDD5 | 8.18 / 13.66 |
| fuchsia | #FAE8FF / #C026D3 / #701A75 | #4A044E / #E879F9 / #FAE8FF | 8.62 / 12.73 |
| slate | #E2E8F0 / #475569 / #0F172A | #1E293B / #94A3B8 / #F1F5F9 | 14.48 / 13.35 |

- Không dùng sắc đỏ/hồng để khỏi lẫn với trùng lịch. Mọi edge so với nền của chính nó ≥ 4.0 (sáng) và ≥ 5.6 (tối); chữ đỏ #B91C1C trên mọi nền sáng ≥ 5.25.
- **Đưa màu tới CSS:** `courseColorStyle(color)` trả 6 custom property **new** (`--c-bg`, `--c-edge`, `--c-ink` và 3 biến cùng tên có hậu tố -dark), truyền qua prop `style` của React (đi qua CSSOM nên `style-src 'self'` cho phép; tiền lệ là `--periods` trong `WeekGrid` của `Schedule.tsx`). **new** `styles/components/course-block.css` chọn biến tối trong hai selector tối. Canvas (PNG, poster) import thẳng `COURSE_PALETTE` và luôn dùng màu sáng. Test tương phản đọc chính module này.
- **Gán màu (tất định, ổn định):** `courseOrder(draftPlan, finalPlan, catalog)` lấy mã môn chuẩn (`courseOf`, alias đã gộp) theo thứ tự pick của nháp rồi tới chính thức, bỏ trùng. `assignCourseColors(order, overrides)`: màu tự động = FNV-1a 32-bit của mã môn mod 10. Nếu màu đó đã bị một môn **đứng trước** dùng thì dò tuyến tính sang màu kế; chỉ cho trùng màu khi đã dùng hết 10. Màu cuối = màu người dùng chọn trong `courseColors` nếu có, không thì màu tự động.
- **Hệ quả** (đều có Vitest): một môn có cùng màu ở nháp và chính thức; thêm môn không đổi màu các môn đã có; đổi màu một môn chỉ ảnh hưởng môn đó; bỏ một môn chỉ có thể đổi màu những môn từng phải dò qua nó. Lớp xem trước (sheet lớp, ô mờ trên desktop) hiện đúng màu môn sẽ nhận nếu được thêm vào.
- **Trùng lịch không phụ thuộc màu môn:** class `is-conflict` (giữ tên), viền đỏ 3 px, sọc chéo CSS, icon, nhãn "Trùng", và chữ "đang trùng lịch" trong tên truy cập.

## 4. Settings contract (A-M6-3)

| Trường (`Settings` trong `apps/web/src/storage/local-data.ts`) | Kiểu | Mặc định khi vắng | Ghi khi |
| --- | --- | --- | --- |
| `theme` (**new**) | **new** `ThemePreference` = `"system" \| "light" \| "dark"` | `"system"` | chọn Hệ thống/Sáng/Tối trong sheet (i) |
| `courseColors` (**new**) | `Record<string, CourseColorId>` (key = mã môn chuẩn, tối đa 100 key, xóa key cũ nhất khi vượt) | `{}` (tự động) | chọn màu trong sheet chi tiết; "Tự động" xóa key |
| `seenHints` (**new**) | `Partial<Record<HintId, true>>` (**new** `HintId` trong **new** `model/hints.ts`) | `{}` | bấm "Đã hiểu" hoặc làm đúng thao tác được gợi ý |

- **Không tăng version DB.** **new** `sanitizeSettings(raw)` chạy trong `loadSettings`: giá trị lạ bị bỏ qua (theme lạ thành `"system"`, mã màu lạ hoặc hint lạ bị loại); các trường cũ giữ nguyên.
- **Ghi:** **new** `idbUpdate(db, store, key, mutate)` trong `storage/db.ts` đọc và ghi trong một transaction readwrite (cùng kiểu với `idbPutIfUnchanged`). `updateSettings` chuyển sang dùng hàm này, hành vi gộp `activeSlots`/`registrationNotes` giữ nguyên. Controller thêm **new** `setTheme`, `setCourseColor`, `markHintSeen`, chạy nối tiếp qua `saveChainRef`. `removeFinalPlan` đổi sang `idbUpdate` để không ghi đè trường UI từ một bản `settingsRef` đã cũ.
- **Nhiều tab:** `TabMessage` thêm biến thể **new** `{ type: "settings-changed" }`. Tab nhận gọi `reloadPlans` (vốn đã đọc lại settings). `showPlans` đẩy `theme`/`courseColors`/`seenHints` vào `Ready` (**new** field) và gọi `applyTheme`.
- **Xóa dữ liệu trên máy:** `idbClearAll` xóa luôn cả 3 trường. `resetAfterWipe` gọi `applyTheme` với "system". Thông điệp `wiped` sẵn có xử lý tab khác.
- **Tương thích ngược:** bản M5 (khi rollback) giữ nguyên các trường này vì `updateSettings` spread `current`, còn `removeFinalPlan` của M5 ghi lại đúng object đã đọc. M5 chỉ bỏ qua chúng. Không có PII: chỉ có mã môn công khai và cờ giao diện, nằm trên máy, không vào export, log hay request.

## 5. Font và icon (M6-B)

- **Nguồn font tái lập được:** **new** devDependency `@fontsource/be-vietnam-pro` trong `apps/web/package.json`, pin đúng version theo quy tắc ≥ 14 ngày của ADR-0010 §1.3. **new** `scripts/sync-fonts.mjs` (script `fonts:sync` **new**) chép 4 file vào **new** `apps/web/src/assets/fonts/`: be-vietnam-pro-{latin,vietnamese}-{400,800}-normal.woff2 (D-M6-12), kèm OFL.txt (đều **new**); các file này được commit. **new** `scripts/test/fonts.test.mjs` kiểm: đúng 4 file, từng byte khớp bản trong `node_modules` (khi đã cài), tổng ≤ `fontsMaxBytes`.
- **Đặt font trong src/assets (new), không tạo thư mục public/fonts:** Vite băm tên file (cache bất biến) và đưa vào `bundle`, nên `serviceWorker()` tự precache, không phải sửa `PUBLIC_SHELL`. Cần một chốt chặn: `vite.config.ts` đặt build assetsInlineLimit là hàm trả false cho `.woff2`, vì font inline dạng data: sẽ bị `font-src 'self'` chặn.
- **styles/fonts.css (new):** 4 khối @font-face, font-display swap, unicode-range chép nguyên từ CSS của Fontsource (subset vietnamese và latin), chỉ có format woff2, không có woff dự phòng (để precache khỏi phình gấp đôi).
- **Nạp sẵn để giữ cửa sổ 0 request:** **new** `apps/web/src/app/fonts.ts` có **new** `warmFonts()` gọi document.fonts.load cho 2 độ đậm (400, 800) với chuỗi mẫu "Aạ" (chạm cả hai subset). Hàm chạy trong `main.tsx` sau khi render. Lý do: `e2e/m4.spec.ts` thu mọi request ở mức context (kể cả request đi qua SW) từ lúc mở phần nhập ĐKMH. Nếu một độ đậm chỉ được nạp lần đầu trong sheet nhập thì test hỏng. Export canvas cũng `await warmFonts()` trước khi vẽ.
- **Kiểm build:** `scripts/check-bundle-budget.mjs` cộng byte `.woff2` so với `fontsMaxBytes`; fail nếu có `.woff`, `.ttf`, `.otf` hoặc CSS chứa url(data: dạng font. `scripts/verify-production-bundle.mjs`: mọi `assets/*.woff2` có trong `sw.js`; CSP meta bằng đúng chuỗi đã chốt (CSP không đổi).
- **Icon:** **new** `apps/web/src/components/icons.tsx`, khoảng 20 component có tên riêng (lịch, thêm, phương án, tìm, đóng, mũi tên trái/phải, info, cảnh báo, check, mặt trời, mặt trăng, màn hình, điện thoại, ảnh, file, máy in, bảng màu, thùng rác, tải lên, mất mạng). Mặc định aria-hidden, focusable false, màu currentColor, nét 2. Path chép từ một release Lucide pin version; đầu file ghi version, tên icon, giấy phép ISC và ghi công Feather (MIT). Mỗi icon export riêng nên chỉ icon được dùng mới vào bundle; không thêm dependency.
- **Giấy phép:** **new** `apps/web/public/licenses.txt` (OFL-1.1 của Be Vietnam Pro, ISC của Lucide kèm ghi chú MIT của Feather). File được thêm vào `PUBLIC_SHELL` và link từ sheet Giới thiệu.

## 6. Thành phần và bản đồ file (M6-C)

| Primitive (**new**, `apps/web/src/components/ui/`) | Props chính | Ghi chú a11y |
| --- | --- | --- |
| `Button.tsx` | `variant: primary\|secondary\|danger\|ghost`, `size`, `icon?` | vùng chạm ≥ 44 px ở mọi size; icon-only bắt buộc có `label` |
| `Chip.tsx` | `Chip` (toggle, aria-pressed), `ChipRadio` (radio gốc ẩn bằng `visually-hidden` + label), `StatusChip` | chip chọn nhóm/khóa là radio thật, nên locator `getByLabel` với nhãn "Nhóm N" trong e2e vẫn chạy |
| `SegmentedControl.tsx` | `label`, `options[{value,label,count?}]`, `value`, `onChange` | role group + nút aria-pressed (giữ ngữ nghĩa của slot switcher) |
| `Sheet.tsx` | `open`, `onClose`, `title`, `size: auto\|full` | dialog gốc + showModal; Esc qua sự kiện cancel; bấm nền để đóng; tự trả focus về phần tử mở sheet; khóa cuộn bằng html:has(dialog[open]); bottom sheet ở < 768 px, hộp giữa ở ≥ 768 px; mỗi lúc chỉ một sheet |
| `Toast.tsx` | `ToastRegion`, `useToast()` | role=status (lỗi dùng role=alert), nằm trên BottomNav, không che lưới |
| `EmptyState.tsx` | `icon`, `title`, `action` (bắt buộc đúng 1) | kiểu dữ liệu ép đúng một nút (AC-M6-12) |
| `StatCard.tsx`, `ListRow.tsx`, `SearchField.tsx`, `Hint.tsx` | `ListRow { color?, title, meta, trailing?, onClick? }`; `SearchField` forwardRef | label "Mã hoặc tên môn" giữ nguyên (ẩn bằng visually-hidden) |

| Hiện có → M6 | Quyết định |
| --- | --- |
| `components/Chrome.tsx` (`Header`, `Footer`, `ProvenancePanel`, `BackupList`) | `Header` → **new** `AppBar.tsx` (chip học kỳ, chip trạng thái, nút (i)); `ProvenancePanel` → **new** `DataSourceSheet.tsx` (nguồn dữ liệu, trạng thái, đổi học kỳ); `Footer` bỏ, nội dung chuyển vào sheet (i); `BackupList` chuyển theo. Phase F7 xóa file |
| `App.tsx` (`DatasetBanners`, `ERROR_TEXT`) | banner → **new** `StatusChips.tsx` + **new** `model/dataset-status.ts` (`datasetStatuses`, giữ điều kiện và câu chữ 1:1); thông báo của controller và `usePendingUpdate` chuyển thành Toast |
| `components/AboutPanel.tsx` | refactor tại chỗ thành sheet (i): Giao diện (Hệ thống/Sáng/Tối), Giới thiệu/quyền riêng tư (`ABOUT_SECTIONS`), Dữ liệu trên máy (xóa + bản sao lưu), Phiên bản (`buildLabel`), Báo lỗi, Giấy phép. `goToLocalData` chuyển thành cuộn trong sheet |
| `components/Workspace.tsx` (`Tabs`, `PrintSheet`) | state view **new** (week, add, plan) + **new** `BottomNav.tsx` (phần tử nav + nút có aria-current; ở ≥ 1200 px nằm trong AppBar); 2 cột ở ≥ 1200 px; giữ `prefetchRegistrationImport` lúc mount và thêm prefetch poster; `PrintSheet` dùng `WeekGrid` bản in |
| `components/Schedule.tsx` (`WeekGrid`, `DayList`, `NonFixedList`) | tách thành **new** `WeekView.tsx`, `WeekGrid.tsx` (prop **new** `variant`: screen, print, compact), `CourseBlock.tsx`, `DayStrip.tsx`, `DayView.tsx`, `SessionSheet.tsx`; `blockDescription` → **new** `sessionAccessibleName` trong **new** `model/grid-view.ts`; F7 xóa `components/Schedule.tsx` |
| `components/SearchPanel.tsx`, `components/SectionCard.tsx` | thay bằng **new** `AddClassView.tsx` + **new** `ClassSheet.tsx`; bảng quyết định nút của `SectionCard` và `ReportIssueForm` chuyển nguyên sang |
| `components/PlanSummary.tsx` (`PlanSummary`, `StalePlanNotice`) | **new** `PlanView.tsx` (StatCard tín chỉ + thanh màu, chip trùng, danh sách gọn có chip nhóm, tuần 1, xóa phương án chính thức); `StalePlanNotice` giữ, đổi giao diện |
| `components/ExportPanel.tsx` | refactor tại chỗ: 4 ô; giữ export `isInAppBrowser` vì `components/RegistrationImport.tsx` (chunk lazy) import nó |
| `components/Onboarding.tsx` | refactor `Onboarding`; giữ `Week1Fields`, `previewWeek1`, `Week1Choice`; export thêm `cohortsOf` |
| `components/common.tsx` | giữ `useMediaQuery`, `Notice` (cảnh báo trong sheet), `WeekChoice`; bỏ `Tabs`, `TabPanel`, `WeekPicker` khi không còn chỗ dùng |
| `components/RegistrationImport.tsx`, `components/registration-lazy.ts`, `components/ErrorBoundary.tsx`, `components/ReportIssue.tsx` | giữ logic và ranh giới privacy; chỉ đổi markup/class; `RegistrationImportPanel` được bọc trong `Sheet` từ `PlanView`; chunk lazy không import CSS |

## 7. Lịch tuần ở 360 px (M6-E)

- **Kích thước:** khe lề trang 16 px; thẻ lịch tràn ra sát mép còn 8 px, nên rộng 344 px ở 360. Lưới CSS: cột giờ 24 px + N cột ngày chia đều (minmax 0 / 1fr, N lấy từ biến **new** `--days`). Mỗi cột ngày rộng 53.3 px (T2–T7) hoặc 45.7 px (khi có CN). Không có min-width, không cuộn ngang (AC-M6-05). Chiều cao hàng `--row` 44/48/52 px ở < 768 / < 1200 / ≥ 1200. Số tiết hiển thị = 1…max(10, tiết cuối lớn nhất của các buổi cố định trong phương án, ở mọi tuần), không vượt `catalog.maxPeriod`. Giá trị này không đổi khi chuyển tuần (**new** `visiblePeriods` trong `model/grid-view.ts`, truyền làm `maxPeriod` cho `buildGridLayout`).
- **Lưới bắt đầu ≤ 200 px:** AppBar 56 + đầu tuần 48 (ô select "Chọn tuần" làm tiêu đề, giữ tên cũ, kèm nút "Tuần trước"/"Tuần sau"/"Tuần này") + DayStrip 48 + khoảng cách 8, nên lưới bắt đầu ở ≈ 160 px. Chip trạng thái nằm trong AppBar, ở < 400 px chỉ hiện 1 chip + "+N". Gợi ý (hint) luôn nằm dưới lưới.
- **Ô lớp:** mã môn (600, cỡ clamp 10–13 px) + phòng. Dòng 2 (loại, nhóm, nhãn đổi từ ĐKMH) chỉ hiện khi ô cao ≥ 2 hàng. Cột ngày khai báo container query: làn < 40 px chỉ còn mã môn (cho ngắt tùy ý) và icon trùng. Chia làn giữ nguyên `lane`/`lanes` của `buildGridLayout`, khe 2 px. Mỗi làn rộng ≥ 24 px (WCAG 2.5.8); ô không bị chia đạt ≥ 44 px. Giữ class `is-overridden`, `is-conflict` mà e2e đang dùng.
- **Tên truy cập:** mỗi ô là `button` trong `li`; aria-label lấy từ `sessionAccessibleName` = "{mã} {tên môn}, {`dayLabel`}, tiết a–b (giờ), phòng R, lớp X nhóm N, {chi tiết đổi từ ĐKMH}, đang trùng lịch với {mã}". Chuỗi bắt đầu bằng mã môn để đạt label-in-name. Region lưới giữ tiền tố "Lưới thời khóa biểu tuần N".
- **Không giờ cố định (ONL):** `nonFixedSessions` hiện thành danh sách ListRow có chấm màu dưới lưới, giữ tiêu đề "Không có giờ cố định (không xếp vào lưới)". Các lớp này vẫn được cộng tín chỉ (`calculatePlanCredits`, không đổi).
- **Vuốt:** **new** `useSwipe` (pointer events, chỉ khi pointerType là touch hoặc pen; touch-action pan-y). Ngưỡng: \|dx\| ≥ max(48 px, 15 % bề rộng), \|dx\| ≥ 1.5·\|dy\|, thời gian ≤ 600 ms. Tuần bị kẹp trong 1…`teachingWeeks`. Phím (chỉ khi focus nằm trong region tuần và không ở ô nhập, đạt WCAG 2.1.4): ←/→ đổi tuần, T về "Tuần này".
- **Hôm nay và vạch giờ:** tuần hiện tại = `weekOfDate` tính trên ngày `todayInVietnam`. Cột hôm nay và vạch giờ chỉ hiện khi tuần đang xem đúng là tuần hiện tại. Vị trí vạch lấy từ **new** `nowInVietnam()` (`model/week.ts`, Intl múi Asia/Ho_Chi_Minh như `todayInVietnam`) và **new** `nowLineOffset(frame, minutes)` (nội suy giữa giờ bắt đầu các tiết; ẩn khi ngoài khoảng giờ học). Cập nhật mỗi 60 s khi trang đang hiện. Vạch có aria-hidden; ô hôm nay trên DayStrip có chữ "hôm nay" trong tên.
- **Sheet chi tiết** (**new** `SessionSheet.tsx`): tên đầy đủ, tiết + giờ (`periodTimes`), tuần (`formatWeeks`), phòng, giảng viên, nhóm, mọi `SessionOverride` dạng "từ → thành", 10 ô màu + "Tự động" (`setCourseColor`), "Bỏ lớp này".

## 8. Thêm lớp (M6-F)

- **Bộ lọc "Không trùng lịch":** **new** `sectionFits(plan, catalog, section)` trong `model/picker.ts`. Nếu `groupOptions` của lớp rỗng: `previewPick` với pick chỉ có sectionId phải trả `conflicts` rỗng. Nếu có nhóm: chỉ cần **một** nhóm thỏa điều kiện. Lớp đã chọn luôn hiện. Một môn bị ẩn khi không lớp nào thỏa; hiện "Ẩn N môn trùng lịch" và trạng thái rỗng có nút "Tắt lọc". Không có rule domain mới: `previewPick` gọi `resolvePlanPicks` + `findConflicts` (tuần cụ thể × tiết × giao tuần). Chỉ tính khi bật lọc, memo theo (`plan.updatedAt`, từ khóa), trên tối đa 30 kết quả của `searchCourses`.
- **Sheet lớp** (**new** `ClassSheet.tsx`, theo môn): chip lớp học phần (lớp trùng có ⚠ kèm chữ; mặc định chọn lớp đầu tiên thỏa bộ lọc), `ChipRadio` nhóm ("Nhóm N"), danh sách buổi (chuyển `sessionText` sang), mini-lịch `WeekGrid` với variant compact (**new**). Mini-lịch tính trên mọi tuần, các buổi đã có tô xám, lớp ứng viên tô màu môn sẽ nhận, chỗ chồng tô sọc đỏ, cả khối có aria-hidden. Trình đọc màn hình nhận phần chữ là `conflictTexts`/`campusTexts` có sẵn. Dữ liệu cho mini-lịch: `applyPick` rồi `buildPlanView` trên plan ứng viên.
- **Nút hành động:** giữ đúng bảng quyết định của `SectionCard`, đổi chữ: "Thêm vào lịch" / "Vẫn thêm lớp này" (danger) / "Đổi sang lớp này" / "Vẫn đổi sang lớp này" / "Đổi nhóm" / "Vẫn đổi nhóm" / "Bỏ lớp này"; nút bị khóa khi chưa chọn nhóm. Thêm lớp trùng chỉ cần bấm nút "Vẫn …", không thêm bước xác nhận nào khác (AC-M6-09).
- **Xem trước trên desktop:** ở ≥ 1200 px, `Workspace` giữ state **new** `previewTarget`, được đặt khi rê chuột (chỉ khi thiết bị có hover) hoặc focus vào một ListRow hay chip lớp (trễ 80 ms) và bị xóa khi rời, blur hoặc Esc. `WeekGrid` bên phải vẽ ô mờ có viền nét đứt (aria-hidden) và viền đỏ chỗ chồng. Nếu lớp không học tuần đang xem thì hiện ghi chú.
- **Ctrl/⌘ K:** **new** `useSearchShortcut` là listener keydown duy nhất ở mức document. Chỉ chạy khi có Ctrl hoặc Meta, không Alt/Shift, phím "k", không đang gõ IME (Telex) (kiểm isComposing), sự kiện chưa bị preventDefault và không có dialog mở. Khi chạy: preventDefault; trên mobile/tablet chuyển sang view Thêm lớp, trên desktop focus và chọn toàn bộ ô tìm ở cột trái.

## 9. Bắt đầu, chữ, gợi ý, trạng thái (M6-D, M6-G)

- **Màn Bắt đầu** (`Onboarding`): legend "Bạn khóa mấy?" và `ChipRadio` lấy từ `cohortsOf` (từ `Term.starts`). "Tự chọn ngày" là nút trông như link, mở ô ngày (kiểm bằng `previewWeek1`, không đổi). "Bắt đầu" được bấm khi `previewWeek1` trả ngày; nếu kỳ chỉ có một ngày tuần 1 thì bấm được ngay, như hành vi hiện nay. Chỉ có ô chọn học kỳ khi `terms.length > 1`. Hình minh họa là SVG trang trí (aria-hidden). `INDEPENDENCE_NOTE` là dòng nhỏ cuối `main`. Từ chip đến lịch mất 2 chạm.
- **Đếm chữ** (**new** `apps/web/e2e/word-count.ts`, `countVisibleWords(page, root)`): duyệt text node trong `main` ở 360×780, bỏ phần tử `visually-hidden`, `hidden`, `aria-hidden` và phần tử có kích thước 0. Tách theo khoảng trắng, đếm token có chữ hoặc số (mỗi tiếng là một chữ). Phải đo lại baseline (~70) bằng đúng cách này ở đầu F5. Xem mâu thuẫn **C-1** ở §15.
- **Câu độc lập (A-M6-1):** có ở màn Bắt đầu, sheet (i) (mục `independent` của `ABOUT_SECTIONS`), mọi file xuất (`exportDisclaimer`), màn lỗi. Không có trên Lịch.
- **Nguồn dữ liệu ≤ 2 chạm (A-M6-2):** chip học kỳ mở `DataSourceSheet` (mọi trường của `ProvenancePanel`), tức 1 chạm.
- **Chip trạng thái thay banner** (`datasetStatuses`): Hết hiệu lực, Dữ liệu mẫu, Bản thử (`status !== "published"`), Ngoại tuyến, Dữ liệu cũ (`cached?.reason === "invalid"`), lấy từ cùng đầu vào với `DatasetBanners` (`datasetFreshness`, `isSynthetic`, `useOnline`). Chip luôn hiện, không đóng được. Chạm vào mở `DataSourceSheet` với câu đầy đủ. Khi một trạng thái mới xuất hiện, live region của Toast thông báo một lần.
- **Gợi ý một lần** (**new** `model/hints.ts`: **new** `HINT_IDS` = week-swipe, block-tap, add-filter, plan-import; **new** `isHintId`; mỗi gợi ý một câu): **new** `Hint` đặt cạnh thứ nó giải thích, mỗi lúc tối đa một gợi ý, đóng bằng "Đã hiểu" hoặc tự đánh dấu khi người dùng làm đúng thao tác (`markHintSeen`). **Trạng thái rỗng:** Lịch rỗng → "Thêm lớp"; tìm không thấy → "Xóa từ khóa"; lọc ẩn hết → "Tắt lọc"; tuần không có buổi → "Tới tuần có lớp"; Phương án rỗng → "Thêm lớp".

## 10. Poster PNG (M6-I) và xuất (M6-H)

- **Renderer:** **new** `apps/web/src/export/poster.ts` có **new** `posterLayout(input)` (thuần, trả danh sách lệnh vẽ) và **new** `renderPoster(input)`. Module được nạp lazy qua **new** `export/poster-lazy.ts` (**new** `loadPoster`, `prefetchPoster`, cùng kiểu `registration-lazy.ts`), prefetch lúc `Workspace` mount cùng chỗ với `prefetchRegistrationImport`. Hàm vẽ dùng chung đưa vào **new** `export/canvas-kit.ts` (**new** `wrapText`, `drawHatch`). `renderPng` chuyển sang màu môn + Be Vietnam Pro; `SCALE` và mọi chữ đang được test giữ nguyên.
- **Bố cục 1080×1350 px** (bitmap đúng kích thước, nền sáng): 0–220 tên học kỳ (800 56 px), dòng tuần hoặc "Tất cả các tuần" (600 28 px), "N tín chỉ · M môn"; 240–1080 lưới `buildGridLayout` của tuần đang chọn (giống PNG), số tiết theo `visiblePeriods`, ô màu môn ghi mã (600 26 px) + phòng, trùng thì viền + sọc + "⚠ Trùng"; 1100–1240 chú thích màu (tối đa 8 môn, rồi "+N môn"); 1250–1330 `provenanceLine` + `exportDisclaimer` của dataset entry (có phiên bản dataset và câu độc lập).
- **Không PII:** đầu vào **new** `PosterInput` chỉ gồm tên học kỳ, nhãn tuần, tín chỉ, layout, màu, chú thích và `DatasetEntry`. Không có ghi chú ĐKMH, lớp chưa khớp hay bất cứ gì của file.
- **Test** (**new** `export/poster.test.ts`): dùng cách mock canvas giống `recordingCanvas` trong `png.test.ts`, kiểm canvas 1080×1350, chữ có phiên bản dataset và `INDEPENDENCE_NOTE`, mọi chữ vẽ ra đều đến từ nguồn cho phép. Plan chính thức dựng từ `fixtures/redacted-registration` không làm lộ chữ nào trong danh sách PII. Kiểm bằng mắt khi thử trên máy thật.
- **4 ô xuất (2×2):** Điện thoại (.ics) dùng `icsFile`; Ảnh mở sheet nhỏ gồm "Ảnh lịch tuần (.png)" và "Poster chia sẻ (.png)"; Word (.doc) dùng `wordFile`; In / Lưu PDF. Tên file và nội dung ICS/Word không đổi (AC-M6-13).

## 11. Chuyển động

- **new** `apps/web/src/app/motion.ts`: **new** `prefersReducedMotion()`; **new** `withViewTransition(update)` dùng View Transitions API nếu có và không bật giảm chuyển động (bọc flushSync của react-dom), nếu không thì gọi update trực tiếp.
- Dùng cho: đổi tuần (vùng có view-transition-name trùng tên class `week-grid` hiện có, trượt 200 ms theo hướng ghi ở thuộc tính **new** `data-nav-dir` trên thẻ html), đổi view (mờ dần 150 ms), lớp "rơi" vào lưới trên desktop (gán view-transition-name cho ô mới qua prop `style`). Khi không có API: dùng keyframes CSS trên ô mới. Sheet mở/đóng bằng CSS transition. Giảm chuyển động: JS bỏ qua, CSS tắt mọi animation và pseudo-element của view transition (luật chung trong **new** `styles/base.css`). Không thêm request nào; CSP không bị ảnh hưởng.

## 12. Kiểm thử

| Bề mặt | Kế hoạch |
| --- | --- |
| `e2e/m4.spec.ts` | chỉ đổi locator và bước điều hướng (ví dụ mở Phương án trước "Nhập kết quả ĐKMH", sheet thay `article`). Mọi `expect` về `postImportRequests`, `PII_TOKENS`, `idbDump`, console và nội dung file giữ nguyên từng byte; G3c so diff để xác nhận |
| `e2e/m3.spec.ts`, `e2e/qa-m3.spec.ts`, `e2e/m5.spec.ts` | viết lại locator và luồng (BottomNav, sheet, view Ngày, xóa dữ liệu trong sheet (i)). Giữ assertion hành vi: chữ trùng, ICS/PNG/Word, offline, 2 tab, artifact bị sửa, rebase, CSP, chuỗi độc hại vô hại. Assertion "lưới cuộn ngang ở 360" thành "không cuộn ngang". AC-M5-01: phiên bản trong sheet (i) + meta (xem **C-3**) |
| **new** `e2e/m6.spec.ts` | AC-M6-01…13 và 18: theme lưu qua reload/offline; 6 font cùng origin ở trạng thái loaded; lưới bắt đầu ≤ 200 px; nav ≥ 44 px có aria-current; chip → sheet; T2–T7 không tràn; tên truy cập; vuốt (pointer events tổng hợp) và phím; đồng hồ cố định bằng page.clock (2027-03-03 09:30 +07, tuần 3 của dataset synthetic HK II); ONL; bộ lọc; Ctrl+K; ô mờ khi rê chuột; ≤ 5 chạm; số chữ; gợi ý; trạng thái rỗng; ô xuất |
| axe | `axeSerious` trên 5 màn (Bắt đầu, Lịch tuần, Thêm lớp, sheet lớp, Phương án) × 360/768/1280 × sáng/tối (giả lập colorScheme) trong **new** `e2e/m6.spec.ts`; **new** `e2e/gallery.spec.ts` chạy axe trên trang mẫu thành phần từ F1 |
| Ảnh so sánh | **new** `e2e/visual.spec.ts`, project Playwright **new** `visual` chỉ chạy trên Linux CI (job **new** `visual`, runner pin ubuntu-24.04, script **new** `test:visual`). Mốc lưu ở **new** `apps/web/e2e/__screenshots__/`, tên file không có hậu tố platform. Chạy cục bộ trên Windows thì bị từ chối, trừ khi dùng image Docker Playwright cùng version. Muốn cập nhật mốc: chạy workflow_dispatch với cờ update-snapshots, tải artifact, duyệt rồi commit. Để ảnh tất định: font tự host, chờ document.fonts.ready, đồng hồ cố định, giảm chuyển động, che phần tử có thuộc tính **new** `data-volatile` (dòng build), maxDiffPixelRatio 0.001. Gallery có mốc từ F1, 30 mốc màn hình ở F7 |
| Trang mẫu | **new** `apps/web/gallery.html` + **new** `src/gallery/main.tsx`, chỉ đưa vào input build khi **new** env `KY_NAY_GALLERY=1` (đặt trong webServer của `playwright.config.ts`). `verify-production-bundle` kiểm `dist` không có `gallery.html` |
| Vitest (mọi file test ở ô này là **new**) | `styles/contrast.test.ts`: đọc `COURSE_PALETTE` + `styles/tokens.css`, kiểm mọi cặp ở §2.1/§3 ≥ 4.5 (viền ô nhập và focus ≥ 3), khối tối giống hệt nhau, không có hex ngoài các file cho phép. `model/palette.test.ts` (tính chất ở §3), `model/dataset-status.test.ts` (khớp `DatasetBanners`), `model/grid-view.test.ts` (tên truy cập, vạch giờ, số tiết), `storage/local-data.test.ts` (sanitize, merge, wipe, đọc bản M5), `components/ui/Sheet.test.tsx` (focus, Esc), `m6-ui.test.tsx`. `export/png.test.ts` (đã có) phải vẫn qua |
| Script và lint | `scripts/check-bundle-budget.mjs` (+ `scripts/test/check-bundle-budget.test.mjs`): CSS 12 288, `fontsMaxBytes`, `requireSingleCss` (**new**). `scripts/lint.mjs` (+ `scripts/test/lint.test.mjs`) thêm luật **new**: cấm tạo phần tử style hoặc constructable stylesheet, cấm constructor FontFace, cấm url() có scheme trong CSS của `apps/web/src`. **new** `scripts/test/fonts.test.mjs` |
| Thủ công trước G4a của bản M6 | Safari iOS, Chrome Android, Zalo/Messenger, TalkBack/VoiceOver, kiểm poster bằng mắt (SPEC §8) |

## 13. Work package (mỗi phase là một PR; mọi PR qua `npm run check`, `verify:bundle`, `test:e2e`, sửa e2e trong cùng PR)

| Phase | Owner | File sở hữu (chỉ phase này sửa) | AC | Phụ thuộc |
| --- | --- | --- | --- | --- |
| **F1a Nền tảng** | Platform | `apps/web/vite.config.ts`, `package.json` (gốc), `package-lock.json`, `apps/web/package.json`, `apps/web/playwright.config.ts`, `.github/workflows/m0-foundation.yml`, `scripts/lint.mjs`, `scripts/check-bundle-budget.mjs`, `scripts/verify-production-bundle.mjs`, `scripts/bundle-budget.json`, **new** `scripts/sync-fonts.mjs`, **new** `apps/web/src/assets/fonts/*`, **new** `apps/web/public/licenses.txt`, **new** `apps/web/gallery.html`, test liên quan trong `scripts/test/` | 02, 17, 18, 19 (hạ tầng), 20 | — |
| **F1b Design system** | Frontend | **new** `styles/**` (gồm việc chuyển `styles.css` sang **new** `styles/legacy.css` và thay mọi màu của legacy bằng token để theme tối chạy được ngay trên các màn cũ), `main.tsx`, `index.html`, `public/manifest.webmanifest`, **new** `components/icons.tsx`, **new** `components/ui/*`, **new** `app/theme.ts` + `app/fonts.ts`, **new** `model/palette.ts` + `model/hints.ts`, `storage/local-data.ts`, `storage/db.ts`, `app/controller.ts`, `components/AboutPanel.tsx` (chỉ thêm mục Giao diện), **new** `src/gallery/*`, **new** `e2e/gallery.spec.ts`, Vitest §12 | 01, 07 (lưu màu), 16 (gallery) | song song với F1a; merge sau F1a (tên file font chốt ở §5) |
| **F2 Khung app** | Frontend | `App.tsx`, **new** `components/AppBar.tsx`, `BottomNav.tsx`, `StatusChips.tsx`, `DataSourceSheet.tsx`, **new** `model/dataset-status.ts`, `components/Chrome.tsx`, `components/AboutPanel.tsx`, `components/Workspace.tsx`, `components/common.tsx`, CSS app-bar/bottom-nav/about (**new**), `App.test.tsx`, `m5-ui.test.tsx`, locator trong `e2e/*.spec.ts` | 03, 04, 12 (vị trí câu độc lập) | F1b |
| **F3 Lịch** | Frontend | `components/Schedule.tsx` → **new** `WeekView`/`WeekGrid.tsx`/`CourseBlock`/`DayStrip`/`DayView`/`SessionSheet`, **new** `components/useSwipe.ts`, **new** `components/useCourseColors.ts`, **new** `model/grid-view.ts`, `model/week.ts`, phần Lịch của `components/Workspace.tsx` | 05, 06, 07, 08 | F2 |
| **F4 Thêm lớp** | Frontend | **new** `components/AddClassView.tsx`, **new** `components/ClassSheet.tsx` (thay `SearchPanel`/`SectionCard`), **new** `components/useSearchShortcut.ts`, `model/picker.ts`, prop ô mờ của `WeekGrid.tsx` (**new**, từ F3), state xem trước trong `components/Workspace.tsx` | 09, 10 | F3 (cùng sửa `WeekGrid.tsx`) |
| **F5 Bắt đầu & chữ** | Frontend + Product | `components/Onboarding.tsx`, **new** `components/ui/Hint.tsx`, cách dùng `EmptyState`, CSS màn start (**new**), **new** `e2e/word-count.ts`, rà chữ trên các view F2–F4 | 11, 12 | phần `components/Onboarding.tsx` song song được với F4; phần rà chữ rebase sau F4 |
| **F6 Phương án & xuất** | Frontend | **new** `components/PlanView.tsx` (thay `components/PlanSummary.tsx`), `components/ExportPanel.tsx`, markup của `components/RegistrationImport.tsx`, sheet nhập trong `components/Workspace.tsx`, `e2e/m4.spec.ts` (chỉ locator) | 13, 14 | F5 |
| **F7 Hoàn thiện** | Frontend + Platform | **new** `app/motion.ts`, **new** `export/poster.ts`, `export/poster-lazy.ts`, `export/canvas-kit.ts`, `export/png.ts`, xóa `styles/legacy.css`, `components/Schedule.tsx`, `components/Chrome.tsx`, **new** `e2e/visual.spec.ts` + 30 mốc, rà lại theme tối | 15, 16, 19, cả bộ 17/18/20 | F6; renderer poster làm song song được từ F3 vì là module thuần |

- **Song song thật sự chỉ có:** F1a ∥ F1b; renderer poster ∥ F3–F6; phần `components/Onboarding.tsx` của F5 ∥ F4. Những phase còn lại cùng sửa `components/Workspace.tsx`, `WeekGrid.tsx` (**new**) hoặc `e2e/*.spec.ts` nên phải đi nối tiếp.
- **Ghi chú triển khai F2 (2026-11-14):** state `view` (week, add, plan) nằm ở `App.tsx` để thanh điều hướng vào được AppBar ở ≥ 1200 px; mỗi view là `section` có tên (region "Lịch", "Thêm lớp", "Phương án") thay cho tabpanel. Trong F2, danh sách "Theo ngày" nằm ngay dưới lưới tuần trong view Lịch (không có nút chuyển Tuần/Ngày, để lưới vẫn bắt đầu trong 200 px khi có 2 chip trạng thái); F3 thay bằng DayStrip/DayView. Thông báo "Có phiên bản mới" và cảnh báo của controller là toast ghim (có nút, không tự tắt). Câu độc lập tạm đặt dưới màn Bắt đầu trong `App.tsx` cho tới khi F5 đưa vào `Onboarding`.
- **Ghi chú triển khai F3 (2026-11-14):** DayStrip nằm trong region "Lưới thời khóa biểu tuần N" (là hàng tiêu đề cột), nên lưới vẫn bắt đầu trong 200 px dù AppBar có thêm hàng chip. Chạm một ngày trên DayStrip mở DayView, có nút "Cả tuần" để quay lại. Ô "Chọn tuần" giữ lựa chọn "Tất cả các tuần". `components/Schedule.tsx` đã xóa ở F3 (thay vì F7) vì không còn chỗ dùng; `NonFixedList` chuyển vào `WeekView.tsx`; bản in dùng `WeekGrid` với variant print. Màu môn trong bản in luôn lấy giá trị sáng (`print.css`). Sau F3, JS ban đầu là 117 106 B gzip (114,4 KiB), đã vượt ngưỡng 112 KiB ở §14 sớm hơn dự kiến.
- **Quy tắc "main luôn release được":** mỗi phase chuyển trọn một tính năng (không có màn hỏng giữa chừng). Màn chưa chuyển vẫn đúng ở hai theme nhờ legacy đã dùng token. Ngân sách và axe tối chạy từ F1. Bộ e2e đã sửa đi cùng PR.

## 14. Rollback và rủi ro

- **Rollback:** revert PR của phase (hoặc revert cả M6). Không có migration dữ liệu vì các trường settings là tùy chọn và bản M5 bỏ qua chúng. Tên cache SW đổi nên client thấy banner cập nhật; cache font cũ bị xóa lúc activate. **Kích hoạt khi:** có S0/S1 ở G3 của M6, smoke fail sau deploy, hoặc chunk/font không mở được offline. **Đích:** commit trước phase đó, hoặc commit M5 cuối cùng.

| Rủi ro | Giảm thiểu / ngưỡng kích hoạt |
| --- | --- |
| JS ban đầu chỉ còn trống 10.3 KiB | poster lazy; icon export riêng từng cái; xóa `Tabs`/`WeekPicker`/`Footer`. Nếu sau F6 JS ban đầu > 112 KiB: F7 dời `icsFile`/`wordFile`/`renderPng` vào chunk lazy prefetch (chunk **new** `exporters-`) |
| Font > 90 KB (6 file chưa đo) | **đã kích hoạt ở F1a:** 6 file = 101 632 B; Owner chọn bỏ độ đậm 600 (D-M6-12, sửa D-M6-4), còn 4 file = 67 424 B |
| Cửa sổ 0 request của M4 bị phá bởi font hoặc chunk | `warmFonts()` lúc khởi động; mọi chunk lazy prefetch lúc `Workspace` mount; `e2e/m4.spec.ts` không nới lỏng |
| Ảnh so sánh chập chờn giữa các OS | mốc chỉ tạo và so trên Linux CI; đồng hồ cố định; chờ fonts.ready; che phần tử volatile |
| Theme tối hỏng giữa chừng | F1b đổi legacy sang token; axe theme tối chạy trên màn cũ từ F1 |
| iOS không mở bàn phím khi focus bằng code | số chạm đo trên Chromium; trên iOS có thể thành 6 chạm (ghi nhận lúc kiểm máy thật) |
| Lỗi của dialog trên iOS (cuộn, focus) | khóa cuộn bằng html:has(dialog[open]); test VoiceOver thủ công |
| M6 chồng lên G4a HK II | xem **Q-2** |

## 15. Mâu thuẫn giữa spec và code, và câu hỏi cho Owner

- **C-1:** AC-M6-11 đòi ≤ 25 chữ, trong khi A-M6-1 bắt câu `INDEPENDENCE_NOTE` (14 chữ) nằm ở màn Bắt đầu. Phần giao diện tối thiểu (legend 3 + 5 chip khóa + "Tự chọn ngày" 3 + "Bắt đầu" 2) đã là 13 chữ, cộng câu độc lập thành 27 > 25.
- **C-2:** SPEC §5 bước 4 kể 5 đầu ra (có Poster), còn M6-H/AC-M6-13 ghi "4 ô xuất". Thiết kế chọn 4 ô, trong đó ô Ảnh chứa cả PNG và poster (§10).
- **C-3:** ADR-0014 điểm 3 và AC-M5-01 (`e2e/m5.spec.ts`) ghi phiên bản hiện ở **footer**; M6-D bỏ footer luôn hiện. Đề xuất: phiên bản hiện ở sheet (i), màn lỗi và thẻ meta `ky-nay-build` (ADR-0015 ghi phần sửa đổi này).
- **C-4:** ADR-0010 §2 quy tắc 4 nói dữ liệu chưa công bố/mẫu có "banner không đóng được"; M6-D đổi thành chip. Chip vẫn luôn hiện, không đóng được và file xuất vẫn được đóng dấu; ADR-0015 ghi cách hiểu này.
- **C-5:** PLAN §5 có "đếm ngược tới tiết kế tiếp" ở Lịch ngày, nhưng SPEC §3 để "Hôm nay/đếm ngược" ngoài phạm vi; thiết kế theo SPEC nên bỏ đếm ngược. Gán màu giữ ý của PLAN §3.2 (theo mã môn: hash + dò, §3), không theo thứ tự chọn.
- **C-6:** ADR-0010 dòng cuối: mọi sửa SW hoặc storage mở lại xác nhận G1 của ADR-0010 và G3a/b/c. M6 thêm font vào precache và thêm trường settings, nên G3b bắt buộc ở cuối M6.
- **Q-1 (C-1):** đếm chữ có bỏ qua câu độc lập bắt buộc không (đề xuất: bỏ qua, nhưng kiểm riêng câu đó có mặt đúng 1 lần), hay Owner rút gọn câu ở màn Bắt đầu?
- **Q-2 (D-M6-8/AC-M6-20):** đề xuất các PR phase merge vào nhánh tích hợp **new** `m6-frontend` (có preview Pages riêng), rồi merge một lần vào `main` sau G3 của M6. Như vậy `main` giữ nguyên trạng thái M5 đã qua G3 cho G4a. Cách khác: PR thẳng vào `main`, và G4a deploy từ tag trước M6 (phải đổi production branch trên Pages).
- **Q-3 (C-3/C-4):** chấp nhận chuyển phiên bản vào sheet (i) và đổi banner thành chip, tức sửa văn bản ADR-0014 điểm 3, AC-M5-01 và ADR-0010 quy tắc 4?

**Owner trả lời (`2026-11-12T15:28Z`, chat):** Q-1 — không tính câu độc lập bắt buộc vào giới hạn 25 chữ; kiểm riêng câu đó có mặt đúng 1 lần, nguyên văn `INDEPENDENCE_NOTE`. Q-2 — các PR phase merge vào nhánh tích hợp `m6-frontend`; `main` giữ bản M5 cho G4a và nhận M6 một lần sau G3 của M6. Q-3 — chấp nhận sửa ADR-0014 điểm 3, AC-M5-01 và ADR-0010 §2 quy tắc 4 (đã ghi amendment trong từng tài liệu). C-2: 4 ô xuất, ô Ảnh gồm lịch PNG và poster (đã sửa SPEC §5). C-5: bỏ đếm ngược theo SPEC.

## 16. Approval

- Product scope (`SPEC-M6-001`, G0): `g0-approved`, Owner, `2026-11-12T14:53Z`.
- Tech Lead design (G1): `g1-approved`, Owner, `2026-11-12T15:28Z`. Security: tham vấn (không mở boundary PII/vendor/auth/external mới); G3b bắt buộc ở cuối M6 (C-6).
- **Decision:** `g1-approved` — Owner, `2026-11-12T15:28Z`, kèm câu trả lời Q-1…Q-3 ở §15 và ADR-0015 `accepted`.
- **Follow-up docs ở G2:** `docs/README.md` (bảng ADR), `docs/TECH_STACK.md`, `docs/SECURITY_PRIVACY.md` §2 (dòng settings UI), `docs/QA_TEST_PLAN.md` (ảnh so sánh, axe tối), `docs/OPERATIONS.md` (cách cập nhật mốc ảnh).
