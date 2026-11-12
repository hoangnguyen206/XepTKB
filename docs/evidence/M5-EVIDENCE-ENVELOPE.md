# M5 evidence envelope — Release hardening và launch readiness

> **Artifact ID:** `EVID-M5-001`  
> **Artifact status:** `approved` — G0 (`SPEC-M5-001`) và G1 (`DESIGN-M5-001`, `ADR-0014`) **Owner ký `2026-11-12T04:19Z`**; G2 hoàn tất trên commit cố định `5f735fc18ebd01bf02710ecd5ae0f239a158dd3c` (`5f735fc`, nhánh `m5-release-hardening`); cả ba cổng kiểm chứng độc lập G3a (`TEST-M5-001` → `qa-pass`), G3b (`SEC-REVIEW-M5-001` → `security-design-pass` cho G1 & `security-pass-with-exception` cho G3b), G3c (`REVIEW-M5-001` → `review-pass-with-follow-up`) đã hoàn tất trên `5f735fc` với `0` lỗi S0/S1/S2 trong code/CI và đã tái kiểm định toàn bộ M4 để giải quyết `F-M5-001`; Owner đã ký G0/G1/G3 + `RA-M5-001` (`2026-11-12T04:19Z`); còn chờ các bước của Owner (`M5-K` HK I validation, `G4a/G4b/G5`)  
> **Canonical gate/sub-gate:** `G0 | G1 | G2 | G3a | G3b | G3c` (cổng `G4a | G4b | G5` theo dõi tại [`CHECKLIST-M5-001`](M5-RELEASE-CHECKLIST.md) và [`RELEASE-M5-001`](M5-RELEASE-REPORT.md))  
> **Owner:** Tech Lead + Release Manager  
> **Last reviewed:** 2026-11-11  
> **Related docs:** [M5 spec](M5-SPEC.md), [M5 design handoff](M5-DESIGN-HANDOFF.md), [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md), [M5 G3a QA report](M5-G3a-QA-REPORT.md), [M5 G3b security review](M5-G3b-SECURITY-REVIEW.md), [M5 G3c independent review](M5-G3c-INDEPENDENT-REVIEW.md), [Operations](../OPERATIONS.md), [M5 release checklist](M5-RELEASE-CHECKLIST.md), [M5 release report (draft)](M5-RELEASE-REPORT.md), [HK I validation guide](M5-OWNER-HK1-VALIDATION-GUIDE.md), [CHANGELOG](../../CHANGELOG.md), [M4 evidence envelope](M4-EVIDENCE-ENVELOPE.md), [M3 G4b drill report](M3-G4b-DRILL-REPORT.md)  
> **Decision actor / UTC timestamp:** G2 recorded by orchestrator on `2026-11-11T06:32:00Z` for commit `5f735fc`; independent G3a/G3b/G3c completed on `2026-11-11T14:03:12Z` on `5f735fc`; Owner signed off `G0`/`G1`/`G3` and `RA-M5-001` at `2026-11-12T04:19Z` (chat); GitHub CI run `43153778627` trên `98325ae` (`check` + `e2e` pass)  
> **Receiving owner / acknowledgement:** Tester (`G3a` — `qa-pass`), Security Reviewer (`G3b` — `security-design-pass` & `security-pass-with-exception`), Independent Reviewer (`G3c` — `review-pass-with-follow-up`), Owner (Product `G0`, Tech Lead + Security `G1`, Release Manager `G3`/`G4a`/`G4b`/`G5` — `pending Owner sign-off`)

## Source and traceability

- **Source docs/sections:**
  - [`docs/PRD.md`](../PRD.md) §4 P0 #1 (dataset preload + CLI ingest theo ADR-0007), P0 #12 (version/thời điểm cập nhật/nguồn/cảnh báo đối chiếu), §6 `FR-01`, `FR-12`, §8 NFR (performance, availability/offline, privacy, accessibility, responsive, compatibility, integrity), §9 analytics/feedback (counters hoãn sang P1 theo `D-M5-2`), §10 rủi ro (“dữ liệu stale”, “bị hiểu là official”), §11 open questions
  - [`docs/IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) §2 hàng `M5`, §7 cut line, §10 `Q-008`, `Q-011`
  - [`docs/OPERATIONS.md`](../OPERATIONS.md) §§1–6, §9, §10
  - [`docs/SECURITY_PRIVACY.md`](../SECURITY_PRIVACY.md) §§2, 5, 6, 7, 9
  - [`docs/QA_TEST_PLAN.md`](../QA_TEST_PLAN.md) §§2, 5, 6
  - [`docs/adr/ADR-0007-static-artifact-cli-admin.md`](../adr/ADR-0007-static-artifact-cli-admin.md), [`docs/adr/ADR-0010-m3-web-app-artifact-storage-export.md`](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [`docs/adr/ADR-0012-dataset-publish-pipeline.md`](../adr/ADR-0012-dataset-publish-pipeline.md), [`docs/adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md`](../adr/ADR-0013-m4-registration-merge-ui-and-privacy-boundary.md), [`docs/adr/ADR-0014-m5-release-observability-without-telemetry.md`](../adr/ADR-0014-m5-release-observability-without-telemetry.md)
- **Source version or SHA-256:**
  - Base commit on `main`: `0e849f1f5cd810ba7d915fb7e60fb3cb07be2c91` (`0e849f1`).
  - Brief gốc `Kế hoạch sản phẩm – Tool xếp TKB cho sinh viên VNU.md`: SHA-256 `295BB158F14D9C3C23F920A0CFF7A5DBDC1B76FC88885AFE9992FBA55D650B1E`.
- **PRD requirement IDs / AC IDs:**
  - M5 scope: `P0 #1`, `P0 #12`, `FR-01`, `FR-12`, `PRD §8` NFRs, `AC-M5-01`..`AC-M5-19` (`M5-A`..`M5-L`, `D-M5-1..3`).
  - M4 re-verification scope (`M5-L` / `F-M5-001`): `FR-09`, `FR-10`, `NFR-03`, `AC-04`, `AC-05`, `AC-M4-01`..`AC-M4-08`.
- **P0 completeness claim:** `yes` cho toàn bộ phạm vi kỹ thuật/code/test/tài liệu chuẩn bị của M0–M5 trên `5f735fc` (`19/19` `AC-M5-01..19` và `10/10` `AC-M4-01..08`, `AC-04`, `AC-05` đã được kiểm chứng độc lập đạt `pass` tại G3a/G3b/G3c); ở cấp phát hành sản phẩm vẫn cần Owner ký duyệt `G0`/`G1`/`G3`, hoàn tất checklist thiết bị thật + chạy thử HK I trên nhánh preview (`M5-K`), và thực thi các cổng vận hành `G4a`/`G4b`/`G5`.
- **Related ADR/design/spec/handoff/G3 IDs:**
  - `SPEC-M5-001`: [`docs/evidence/M5-SPEC.md`](M5-SPEC.md) (`G0`, `draft`)
  - `DESIGN-M5-001`: [`docs/evidence/M5-DESIGN-HANDOFF.md`](M5-DESIGN-HANDOFF.md) (`G1`, `draft`)
  - `ADR-0014`: [`docs/adr/ADR-0014-m5-release-observability-without-telemetry.md`](../adr/ADR-0014-m5-release-observability-without-telemetry.md) (`G1`, `accepted`)
  - `TEST-M5-001`: [`docs/evidence/M5-G3a-QA-REPORT.md`](M5-G3a-QA-REPORT.md) (`G3a`, `needs_review` — `qa-pass`)
  - `SEC-REVIEW-M5-001`: [`docs/evidence/M5-G3b-SECURITY-REVIEW.md`](M5-G3b-SECURITY-REVIEW.md) (`G1 + G3b`, `needs_review` — `security-design-pass` & `security-pass-with-exception`)
  - `REVIEW-M5-001`: [`docs/evidence/M5-G3c-INDEPENDENT-REVIEW.md`](M5-G3c-INDEPENDENT-REVIEW.md) (`G3c`, `needs_review` — `review-pass-with-follow-up`)
  - `CHECKLIST-M5-001`: [`docs/evidence/M5-RELEASE-CHECKLIST.md`](M5-RELEASE-CHECKLIST.md) (`G4a/G4b/G5`, `draft`)
  - `RELEASE-M5-001`: [`docs/evidence/M5-RELEASE-REPORT.md`](M5-RELEASE-REPORT.md) (`G4a/G4b/G5`, `draft`)
  - `GUIDE-M5-HK1-001`: [`docs/evidence/M5-OWNER-HK1-VALIDATION-GUIDE.md`](M5-OWNER-HK1-VALIDATION-GUIDE.md) (`M5-K`, `draft`)

## Immutable execution identity

- **Branch:** `m5-release-hardening` (tách từ `main` @ `0e849f1`, chưa push, chưa mở PR).
- **Commit chain (`0e849f1..5f735fc`):**
  - `bcce6c6d1624721ca213d1261cb10e782e0bca3a` (`bcce6c6`): `docs(m5): draft SPEC-M5-001 (G0), DESIGN-M5-001 (G1) and ADR-0014`
  - `5f6692bb6aa47c43cfe9a3038eda35e2bb87f3f5` (`5f6692b`): `docs(m5): WP3 operations runbook, changelog, release checklist and HK I guide`
  - `0a6bed088855ac0af725ac3c1c2f239f8e9947af` (`0a6bed0`): `feat(m5): WP2 build identity, PWA icons, bundle budget, secret scan, CI hardening and smoke script`
  - `004e9d09514c6fb12e1acdb7a043900ce349cf49` (`004e9d0`): `feat(m5): WP1 build info, issue reports, about/privacy, freshness, error boundary, lazy registration import`
  - `7afd8e0a69e7cf0fd37f7a839f082d33bf9d943e` (`7afd8e0`): `Merge WP2 build/PWA/CI hardening into m5-release-hardening`
  - **`5f735fc18ebd01bf02710ecd5ae0f239a158dd3c` (`5f735fc` — G2 & G3 frozen target):** `build(m5): freeze bundle budget after lazy split and require RegistrationImport chunk`
- **Build ID:** `ky-nay-build=0.0.0+5f735fc` (`channel: "local"`, nhúng qua `resolveBuildIdentity` trong `scripts/lib/build-identity.mjs` và kiểm chứng bởi `scripts/verify-production-bundle.mjs`).
- **Test/import/review run ID(s):**
  - Local G2 run trên `5f735fc` (`2026-11-10` và `2026-11-11`).
  - Independent G3a (`TEST-M5-001`, cổng `E2E_PORT=4381`), G3b (`SEC-REVIEW-M5-001`, cổng `E2E_PORT=4382`), G3c (`REVIEW-M5-001`, cổng `E2E_PORT=4383`) chạy độc lập trên 3 worktree cô lập cùng trỏ tới `5f735fc` ngày `2026-11-11`.
  - GitHub Actions CI run ID: `not-run — branch m5-release-hardening has not been pushed yet`.
- **Toolchain versions:** Windows 10 (`win32 10.0.19045`), Node `v22.22.2`, npm `12.0.2`, TypeScript `5.9.3`, Vite `8.3.4`, Vitest `5.0.3`, Playwright `1.64.0` (Chromium headless + WebKit opt-in probe).
- **Exact commands + exit codes (kiểm chứng độc lập ở G2 và lặp lại bởi G3a/G3b/G3c trên `5f735fc`):**

| Lệnh | Exit code | Kết quả |
| --- | ---: | --- |
| `node scripts/secret-scan.mjs` | `0` | `secret-scan: 266 tracked file(s), 252 scanned, 14 skipped, 0 allowlisted, 0 finding(s)` |
| `npm audit --omit=dev --audit-level=high` & `npm audit` | `0` | `found 0 vulnerabilities` |
| `npm audit signatures` (G3b) | `0` | `104 packages have verified registry signatures`, `47 packages have verified attestations` |
| `npm run check` | `0` | `lint` (AST + regex, gồm rule giới hạn `__KY_NAY_BUILD__`/`__KY_NAY_REPORT_URL__` trong `apps/web/src/app/build-info.ts`) PASS; `typecheck` PASS; `node:test` **142/142** PASS; `vitest` **13/13** files, **105/105** tests PASS; `fixtures:run` **6/6** PASS; `node scripts/dataset.mjs check` `data/published OK — 0 datasets (0 published)` |
| `npm run verify:bundle` | `0` | `build:web` → `verify-production-bundle: OK (2 JS asset(s), allowUnpublished:!1, _headers + sw.js present, ky-nay-build=0.0.0+5f735fc, 4 PNG icons, no third-party origins)` → `check-bundle-budget: OK` |
| `npm run test:e2e` (`E2E_PORT=4381/4382/4383`) | `0` | Playwright Chromium **25/25** PASS ở cả 3 worktree G3a/G3b/G3c (`m3.spec.ts` `13/13`, `m4.spec.ts` `2/2` giữ nguyên không sửa, `m5.spec.ts` `6/6`, `qa-m3.spec.ts` `4/4`), kèm `networkGuard` cấp `BrowserContext` |
| `node scripts/smoke-deploy.mjs <localPreviewUrl> --production --expect-commit 5f735fc` (G3a & G3b) | `0` | `smoke-deploy: PASS (16/16 checks)` trên `dist/` (`0` datasets) và `19/19 checks` trên `dist-e2e/` (khớp `bytes` + SHA-256 của 4 file artifact dữ liệu mẫu) |

### Số đo bundle tại G2/G3 (`SPEC-M5-001` §8, `DESIGN-M5-001` §5, `scripts/bundle-budget.json`)

| Hạng mục | Trước M5 (`0e849f1`, gzip-9) | Sau M5 (`5f735fc`, raw) | Sau M5 (`5f735fc`, gzip-9) | Ngưỡng CI (`bundle-budget.json`) | Kết quả |
| --- | ---: | ---: | ---: | ---: | --- |
| Initial JS (`assets/index-*.js`) | `140,140 B` (`B_pre`) | `357,737 B` | **`108,918 B`** (`B_post`, giảm `31,222 B` / `-22.28%`) | `119,808 B` (`117 KiB`) | **PASS** (`B_post < B_pre`) |
| Initial CSS (`assets/index-*.css`) | `3,474 B` (gzip-6) | `14,341 B` | **`3,754 B`** | `5,120 B` (`5 KiB`) | **PASS** |
| Lazy chunk (`assets/RegistrationImport-*.js`) | *(gộp trong initial JS)* | `107,682 B` | **`38,225 B`** | `43,008 B` (`42 KiB`) | **PASS** (tách riêng, có trong SW precache) |
| Total JS | `140,140 B` | `465,419 B` | **`147,143 B`** | `162,816 B` (`159 KiB`) | **PASS** |
| Forbidden markers trong initial JS (`xmldom`, `vnu-registration-html`) | có trong entry chunk | `0` | `0` | cấm hoàn toàn (`initialForbiddenMarkers`) | **PASS** |

## Data and artefact integrity

- **Fixture manifests + SHA-256 (kiểm chứng trực tiếp trên cây `5f735fc`):**
  - `fixtures/redacted-registration/manifest.json`: `fe051f49a02e633851d31c536b668ff427b4b412e7290981823ce244acfa0e98`
  - `fixtures/redacted-registration/portal-format.doc`: `8016e5c1d4e2ff061212f111d60b3254ea572a372fa69f6ac7c7be0318bd3a79`
  - `fixtures/synthetic-registration/manifest.json`: `6e86f39061a1fede05e8f519e72142e5d38e88de3e346f884ccbfc1132224b0f`
  - `fixtures/synthetic-registration/registration.doc`: `6dd7499880ebf84c0e8da9a91b604b307e36173b2c5d9c9d2abe46c3cc76a49e`
  - `fixtures/synthetic-uet-xlsx/manifest.json`: `7f602cd0264e82b581e7a556cf74ed68ed47224962ebc60bd51d9ca088bc92d7`
  - `fixtures/synthetic-uet-xlsx/hk1-row1.xlsx`: `28165264a93cc29635ef50bd1672fa997b3f66b2b1bc43c7812bfc9a6f1e46f8`
  - `fixtures/synthetic-uet-xlsx/hk2-row4.xlsx`: `e4417afe7d5c77d99d0c0ffd9d7268f3e43bc5b7f159dd324b161513531fa550`
  - `fixtures/smoke/manifest.json`: `dcacc704d5f7ce312fcedbef8f5c21395cfe5de7b639196292d4e3e84583ac16`
  - `fixtures/synthetic-adversarial/manifest.json`: `0dee79ee272d010a14049579efb5be176d72642b60b761767705699731467d5c`
- **PWA icon artifacts + SHA-256 (`apps/web/public/icons/`, sinh bởi `scripts/generate-icons.mjs`):**
  - `apps/web/public/icons/icon-192.png` (`192×192`, `2,957 B`): `8cdcf99d7beea54da691f9da0998f2da8b32a4a4cfc64dde6abcc3345908b953`
  - `apps/web/public/icons/icon-512.png` (`512×512`, `9,874 B`): `52fa573290223360ce4d38c47c5297a0efd525fe68e1af2b52748cb10c060912`
  - `apps/web/public/icons/icon-maskable-512.png` (`512×512`, `5,405 B`): `f53ecdb699f3ac98e3be9e56eb89078153e31486077a1a4ff2093446c2a1a5f3`
  - `apps/web/public/icons/apple-touch-icon.png` (`180×180`, `1,517 B`): `1597e92205e9ee5e130d55449234a00b7f4b39c0fa53501b0099dfe720b24ddf`
- **Published dataset manifest (`data/published/manifest.json`):** `97 B`, `"datasets": []`, SHA-256 `746f9b8710ed3f49ec0bc00610df4dbd76b43b6fdf412ef7b7407201e1aab74e` (không có dữ liệu HK I trên nhánh `m5-release-hardening` hay `main`).
- **Dataset/schema/parser version:** manifest schema `1.0`, domain schema `0.2.0`, Plan storage envelope `0.2.0`, IndexedDB `ky-nay` v1 (`plans`, `datasets`, `settings`, `backups`), timetable parser `uet-xlsx@0.2.0`, registration parser `vnu-registration-html@0.2.0`.
- **Compatibility/migration note:** Không thay đổi schema manifest, domain hay IndexedDB; không thêm trường mới vào `Settings` (bản nháp báo lỗi và trạng thái mở trang Giới thiệu chỉ giữ trong React state). Toàn bộ `Plan` (`draft` và `final`) đã lưu từ M3/M4 đọc lại nguyên vẹn.

## Evidence links and results

| Evidence ID/link | Check | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| [`SPEC-M5-001`](M5-SPEC.md) | `G0` M5 specification (`M5-A..L`, `AC-M5-01..19`, `D-M5-1..3`, `RA-M5-001`, `F-M5-001`) | Đầy đủ outcome, non-goals, AC kiểm thử được, NFR thresholds và câu hỏi mở `OD-M5-1..5` | Bản nháp hoàn chỉnh tại `bcce6c6`; chờ Owner ký quyết định `G0` và chốt `OD-M5-1..5` | `pending Owner sign-off` (`draft`) |
| [`DESIGN-M5-001`](M5-DESIGN-HANDOFF.md) & [`ADR-0014`](../adr/ADR-0014-m5-release-observability-without-telemetry.md) | `G1` architecture, zero-telemetry observability, report-issue privacy boundary & lazy-chunk design (`OD-M5-5`) | Thiết kế giữ nguyên ranh giới `loader.ts`, không telemetry, prefetch chunk lúc `Workspace` mount để giữ nguyên `e2e/m4.spec.ts` | Đã được Security Reviewer (`SEC-REVIEW-M5-001`) xác nhận **`security-design-pass`**; chờ Owner ký quyết định `G1` | `security-design-pass` (`pending Owner sign-off`) |
| `EVID-M5-001` (tài liệu này, mục *Immutable execution identity*) | `G2` implementation + automated checks trên commit `5f735fc` | `npm run check`, `npm run verify:bundle`, `node scripts/secret-scan.mjs`, `npm audit --omit=dev --audit-level=high`, `npm run test:e2e` đều exit `0`; `B_post < B_pre` | `node:test` `142/142`, `vitest` `105/105`, `fixtures` `6/6`, `e2e` `25/25`, `secret-scan` `0` findings, `npm audit` `0` vulns; initial JS giảm từ `140,140 B` xuống `108,918 B` gzip-9 | **`g2-ready-for-verification`** |
| [`TEST-M5-001`](M5-G3a-QA-REPORT.md) | `G3a` independent QA verification trên `5f735fc` (`AC-M5-01..19` + `M5-L` kiểm định lại `AC-M4-01..08`, `AC-04`, `AC-05` để đóng `F-M5-001`) | Mọi AC của M5 và M4 được kiểm chứng độc lập trên code thật với 100% định danh grep được | `19/19` `AC-M5-01..19` PASS; `10/10` AC của M4 tái kiểm định PASS với `95/95` định danh thật; `0` lỗi S0/S1/S2/S3 trong code; `F-M5-001` `verified-closed-in-g3a` | **`qa-pass`** *(chờ Owner sign-off & checklist thiết bị thật trước `G4a`)* |
| [`SEC-REVIEW-M5-001`](M5-G3b-SECURITY-REVIEW.md) | `G3b` independent security & privacy review trên `5f735fc` (`M5-B`, `M5-E`, `M5-H`, `AC-M5-18`, `RA-M5-001`, `ADR-0014`) | Xác nhận không có egress mới, không rò rỉ PII qua báo lỗi / error boundary, CI hardening & bundle verification | `0` S0/S1/S2/S3 ở mức code/CI; `104` chữ ký gói npm hợp lệ; `smoke-deploy` `16/16` & `19/19` PASS; ngoại lệ vận hành `RA-M5-001` đủ điều kiện kỹ thuật | **`security-pass-with-exception`** *(chờ Owner ký `RA-M5-001` & kiểm `SEC-M3-007` ở `G4a`)* |
| [`REVIEW-M5-001`](M5-G3c-INDEPENDENT-REVIEW.md) | `G3c` independent code & architecture review trên `5f735fc` (kèm rà soát lại phần `M4-G3c` bị ảnh hưởng bởi `F-M5-001`) | Đối chiếu diff `0e849f1..5f735fc` với `SPEC-M5-001`, `DESIGN-M5-001`, `ADR-0014` và tái kiểm định M4 `3c34c89..6fd1506` | `0` S0/S1/S2, `1` S3 non-blocking (`REV-M5-001` đồng bộ tài liệu hậu G0/G1/G2); tái kiểm định toàn bộ M4 với `52/52` đường dẫn và `100%` định danh thật (`F-M5-001` đóng ở G3c) | **`review-pass-with-follow-up`** (`approved-with-follow-up`) |
| [`CHECKLIST-M5-001`](M5-RELEASE-CHECKLIST.md), [`RELEASE-M5-001`](M5-RELEASE-REPORT.md), [`GUIDE-M5-HK1-001`](M5-OWNER-HK1-VALIDATION-GUIDE.md) | `G4a` / `G4b` / `G5` release readiness & hướng dẫn Owner chạy thử HK I trên nhánh preview | Tài liệu sẵn sàng, đánh dấu rõ bước `[Owner]`, không điền giả deploy ID/run ID | Đã tạo tại `5f6692b`; thực thi `G4a`/`G4b`/`G5` là bước của Owner sau G3 | `pending — not executed` (`draft`) |

## Findings ledger (M5 G3 tại `5f735fc`)

| # | ID | Severity | Summary | Resolution / Mitigation tại `5f735fc` | Owner & Due | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `F-M5-001` | `S2` (process / evidence) | `M4-G3a-QA-REPORT.md` (và một phần `M4-G3c-INDEPENDENT-REVIEW.md`, `M4-EVIDENCE-ENVELOPE.md`) trích dẫn một số tên hàm/kiểu/file không tồn tại trong code (`reconcileRegistration`, `generateIcsCalendar`, `vnu-xlsx-adapter.ts`...) | Đã tái kiểm định độc lập toàn bộ `10/10` tiêu chí M4 (`AC-M4-01..08`, `AC-04`, `AC-05`) tại [`TEST-M5-001` §4](M5-G3a-QA-REPORT.md) (`95/95` định danh thật) và tái kiểm định toàn bộ kiến trúc/code/5 findings của M4 tại [`REVIEW-M5-001` §6](M5-G3c-INDEPENDENT-REVIEW.md) (`52/52` đường dẫn file và `100%` định danh grep được trên `5f735fc`) | Tester + Independent Reviewer (xác nhận đóng bởi Owner khi ký G3) | **closed** — Owner ký G3 `2026-11-12T04:19Z` |
| 2 | `REV-M5-001` | `S3` (docs sync) | Đồng bộ `docs/PRD.md` (§§9, 11) và `docs/IMPLEMENTATION_PLAN.md` (§2 hàng M5, §10 `Q-008`, `Q-011`) sau khi Owner ký duyệt `G0`/`G1` (theo `SPEC-M5-001` §1), và cập nhật 3 câu chữ trạng thái trước G2 trong `docs/README.md`, `docs/OPERATIONS.md`, `docs/evidence/M5-RELEASE-REPORT.md` | Không ảnh hưởng code, bundle hay privacy boundary. `docs/README.md`, `docs/OPERATIONS.md`, `M5-RELEASE-CHECKLIST.md` và `M5-RELEASE-REPORT.md` được cập nhật trạng thái G2/G3 ngay trong commit hồ sơ G3; `PRD.md` và `IMPLEMENTATION_PLAN.md` cập nhật ngay khi Owner ký duyệt `G0`/`G1` | Product + Tech Lead (hạn: khi Owner ký `G0`/`G1`, trước `G4a`) | **closed** — sửa `47836a3`, Owner ký G3 `2026-11-12T04:19Z` |
| 3 | `OBS-M5-001` | `low` (observation, test-only) | `apps/web/e2e/m5.spec.ts:55` gọi `context.grantPermissions(["clipboard-read", "clipboard-write"])` của Chromium nên khi chạy tùy chọn `E2E_WEBKIT=1` thì `5/6` bài `m5.spec.ts` pass trên WebKit, còn bài clipboard dừng ở bước cấp quyền của Playwright | Hành vi fallback clipboard của ứng dụng khi thiếu quyền đã được kiểm chứng đầy đủ bằng Vitest tại `apps/web/src/m5-ui.test.tsx:155-177` (`AC-M5-05`) | Tester (tùy chọn bọc `grantPermissions` khi mở rộng WebKit E2E) | `recorded (non-blocking)` |
| 4 | `OBS-M5-002` | `low` (observation, test-only) | `apps/web/src/m4-registration.test.tsx:284` là bài test tích hợp JSDOM lớn (~3–3,7s ở điều kiện thường), có thể sát ngưỡng timeout mặc định `5000ms` khi máy chạy tải nặng song song | Đã pass `105/105` trong mọi lượt chạy `npm run check` của G2, G3a, G3b, G3c | Tester (tùy chọn tăng timeout của bài test đơn lẻ nếu cần) | `recorded (non-blocking)` |
| 5 | `F-M5-002` | `S2` (process / evidence) | Bản R1 của `TEST-M5-001` (`ca907cc`) tự nhận "100% định danh có thật" nhưng §4–§5 còn 6 trích dẫn không tồn tại (`packages/{parser,domain,export}/src/*.test.ts`, `apps/web/src/styles/app.css`, `storage.savePlan`, `ReportSubject`, `updatedHtml`), 1 chi tiết sai (`306-G2` thay vì `409-G2`) và metadata sai (`Date 2026-04-20`, `Status approved`). Phát hiện bằng quét tự động backtick → `git grep`/`git ls-tree` trên `5f735fc` (2026-11-11). | `TEST-M5-001` R1.1 (§10) đính chính toàn bộ, chạy lại đúng các test được dẫn: node:test `43/43`, Vitest `16/16`; `npm run check` trên `ca907cc` exit `0`. Kết quả PASS không đổi. G3b/G3c đã được quét cùng cách: không có trích dẫn code sai ngoài bảng đối chiếu M4. | Tester + Owner; trước `G4a` | **closed** — R1.1 `1ab37d3`, Owner ký G3 `2026-11-12T04:19Z` |

## Risk and controls

- **Privacy/security impact and boundary:**
  - Giữ nguyên ranh giới mạng duy nhất tại `apps/web/src/data/loader.ts` (`lines 84-147`, chỉ `GET` cùng origin cho `data/*`); CSP giữ nguyên `connect-src 'self'`, `form-action 'none'`, `frame-ancestors 'none'`.
  - **Không có runtime telemetry (`D-M5-2`, `ADR-0014`):** không có analytics, counter, client error reporting hay script bên thứ ba; `verify-production-bundle.mjs` kiểm tra không có origin bên thứ ba hoặc marker telemetry trong bản build production.
  - **Báo sai dữ liệu (`M5-B`):** văn bản báo lỗi dựng thuần trên máy bởi `buildIssueReport` (`apps/web/src/model/report-issue.ts`), chỉ gồm thông tin bản build, dataset công khai, mã lớp/môn (nếu mở từ thẻ lớp), tên trường bị sai từ danh sách cố định và ghi chú tối đa 500 ký tự kèm cảnh báo PII (`looksLikePersonalInfo`). Sao chép qua clipboard cục bộ (`navigator.clipboard.writeText` + `<textarea readOnly>` fallback). Nếu `VITE_REPORT_ISSUE_URL` được cấu hình, được kiểm tra ở cả lúc build (`scripts/lib/build-identity.mjs`) và lúc chạy (`apps/web/src/app/build-info.ts`: chỉ `https:`, hoặc `http:` trên `localhost`/`127.0.0.1`, không userinfo, `<= 2048` ký tự), và chỉ render `<a target="_blank" rel="noopener noreferrer">` tới đúng URL tĩnh mà **không bao giờ nối nội dung báo cáo hay tham số vào URL**.
  - **Error boundary (`M5-E`):** `AppErrorBoundary` và `LocalErrorBoundary` (`apps/web/src/components/ErrorBoundary.tsx`) cùng `ROOT_OPTIONS` (`apps/web/src/main.tsx:8`) chỉ hiển thị `safeErrorName(error)` và mã build, tuyệt đối không render `error.message` hay stack trace ra DOM, không ghi console, không gửi mạng; hỗ trợ tải lại trang hoặc xóa dữ liệu cục bộ có bước xác nhận.
  - **AST lint guard (`scripts/lint.mjs`):** bổ sung quy tắc chỉ cho phép đọc `__KY_NAY_BUILD__` và `__KY_NAY_REPORT_URL__` trong `apps/web/src/app/build-info.ts` (cùng file khai báo kiểu và test).
- **Findings (ID/severity/status):** `0 S0`, `0 S1`, `0 S2` mở ở mức code/CI; `F-M5-001` (`S2` process/evidence) đã được G3a và G3c tái kiểm định trên `5f735fc` (`verified-resolved`; phía G3a có hiệu lực từ bản đính chính R1.1); `F-M5-002` (`S2` process/evidence: trích dẫn sai trong R1 của `TEST-M5-001`) `verified-fixed` ở R1.1; `1 S3` non-blocking về đồng bộ tài liệu hậu G0/G1 (`REV-M5-001`, đã sửa 2026-11-11).
- **Waiver/exception:**
  - **`RA-M5-001` (single-reviewer exception theo `D-M5-3`, trạng thái: `accepted` by Owner `2026-11-12T04:19Z`, đã được G3b xác nhận đủ điều kiện kỹ thuật):** Dự án hiện có một maintainer nên lần publish đầu tiên dùng cờ `--accept-single-reviewer "<lý do>"` (đã hỗ trợ trong `scripts/lib/dataset-core.mjs`). **Owner:** Release Manager. **Mitigation:** kiểm thử trên preview URL bằng điện thoại, đọc báo cáo import và diff trước khi `publish`, kiểm tra immutability trong CI (`ci-immutability-base.mjs`), quy trình `retract`/`restore` đã diễn tập (`DRILL-M3-G4b-001`). **Expiry:** trước lần `G4a` public đầu tiên hoặc `2027-01-31` (tùy mốc nào đến trước).
  - **`SEC-M3-007` (vận hành, mở cho tới `G4a`):** chạy `curl.exe -sI` và `node scripts/smoke-deploy.mjs <productionUrl> --production --expect-commit <sha7>` trên domain production thật khi thực hiện `G4a`.
- **Rollback/migration trigger and target:**
  - Trigger: phát hiện bất kỳ lỗi `S0`/`S1` sau deploy, `smoke-deploy.mjs` báo FAIL, chunk nhập ĐKMH không hoạt động offline sau khi SW cài đặt, hoặc có bất kỳ request mạng ngoài ý muốn.
  - Target: với app trên Cloudflare Pages — rollback về deployment production trước đó trên dashboard hoặc `git revert` commit merge trên `main` rồi redeploy; với dataset — dùng `npm run dataset -- retract <version> --by "<RM>" --reason "<lý do>"` theo `OPERATIONS.md` §4.2. Không có migration dữ liệu người dùng cần hoàn tác.
- **Monitoring/canary/alert evidence:**
  - Thiết kế theo `ADR-0014` và `OPERATIONS.md` §5: không có runtime telemetry; sử dụng preview URL + beta link riêng trước khi bật production (`D-M5-1`), chạy `scripts/smoke-deploy.mjs` sau mỗi lần deploy, và theo dõi thủ công trong cửa sổ giám sát (đề xuất 72 giờ sau `G4a`). Trạng thái thực thi hiện tại: `N/A — chưa deploy production trong vòng G2/G3 này`.

## Decision and next step

- **Recommendation/gate decision (sau khi hoàn tất G2 + G3a/G3b/G3c trên `5f735fc`):**
  - `G0` (`SPEC-M5-001`): **`g0-approved`** (Owner, `2026-11-12T04:19Z`)
  - `G1` (`DESIGN-M5-001`, `ADR-0014`): **`security-design-pass`** bởi G3b (`SEC-REVIEW-M5-001`); **`g1-approved`** (Owner, `2026-11-12T04:19Z`)
  - `G2` (`5f735fc`): **`g2-ready-for-verification`**; GitHub CI run `43153778627` trên `98325ae` (`check` + `e2e` pass)
  - `G3a` (`TEST-M5-001`): **`qa-pass`** (`19/19` AC của M5 + `10/10` AC của M4 PASS trên code thật; `F-M5-001` đã được giải quyết ở G3a; trích dẫn được đính chính ở R1.1 theo `F-M5-002`) — Owner ký `2026-11-12T04:19Z`
  - `G3b` (`SEC-REVIEW-M5-001`): **`security-pass-with-exception`** (`0` lỗi S0/S1/S2/S3 ở mức code/CI; kèm `RA-M5-001` Owner chấp nhận và `SEC-M3-007` kiểm tại `G4a`) — Owner ký `2026-11-12T04:19Z`
  - `G3c` (`REVIEW-M5-001`): **`review-pass-with-follow-up`** (`0` S0/S1/S2, `1` S3 doc sync `REV-M5-001`; `F-M5-001` đã được giải quyết ở G3c) — Owner ký `2026-11-12T04:19Z`
  - `G4a` / `G4b` / `G5`: `pending — not executed` (bước của Owner theo [`CHECKLIST-M5-001`](M5-RELEASE-CHECKLIST.md))
- **Conditions/follow-up owner + due date:**
  1. **Owner sign-off (`G0`/`G1`/`G3` + `RA-M5-001`):** **xong** `2026-11-12T04:19Z`; OD-M5-1…5 đã chốt (xem [SPEC-M5-001 §4](M5-SPEC.md)).
  2. **Follow-up `REV-M5-001` (`S3`, Product + Tech Lead):** **xong** — `47836a3` (2026-11-11).
  3. **Kiểm thử thủ công của Owner trước `G4a` (`CHECKLIST-M5-001` P-10..P-13):** Chạy thử bản M5 với file TKB HK I thật trên nhánh preview riêng theo [`GUIDE-M5-HK1-001`](M5-OWNER-HK1-VALIDATION-GUIDE.md) và kiểm trên thiết bị thật Tier 1/Tier 2 + trình đọc màn hình + nhìn trực quan file xuất.
- **Next owner action:** Owner xem xét kết quả `EVID-M5-001` cùng 3 báo cáo [`M5-G3a-QA-REPORT.md`](M5-G3a-QA-REPORT.md), [`M5-G3b-SECURITY-REVIEW.md`](M5-G3b-SECURITY-REVIEW.md), [`M5-G3c-INDEPENDENT-REVIEW.md`](M5-G3c-INDEPENDENT-REVIEW.md), trả lời 6 quyết định mở (`OD-M5-1..5`, `RA-M5-001`) và ký duyệt `G0`/`G1`/`G3`.

## Việc tồn đọng (cập nhật 2026-11-11, cuối phiên)

Trạng thái: [PR #3](https://github.com/hoangnguyen206/XepTKB/pull/3) đã merge vào `main` (`ba43867`, 2026-11-12; CI trên `main` run `43155073708` xanh). Production deploy vẫn tắt cho tới G4a.

### Owner phải quyết / ký

| # | Việc | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| B-01 | Ký `G0` ([SPEC-M5-001](M5-SPEC.md)), `G1` ([DESIGN-M5-001](M5-DESIGN-HANDOFF.md) + [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md)), `G3` (3 báo cáo G3a/G3b/G3c, đóng `F-M5-001`, `F-M5-002`, `REV-M5-001`) và `RA-M5-001` | **done 2026-11-12T04:19Z** | Owner trả lời "duyệt" → ghi actor + UTC timestamp vào từng file, rồi bỏ draft PR #3 |
| B-02 | `OD-M5-2` — domain production | **decided 2026-11-12: `xeptkb-63v.pages.dev`** | Phương án: `*.pages.dev` miễn phí (có thể tạo project Pages mới để có subdomain gọn); `.id.vn` miễn phí cho 18–23 tuổi nhưng đợt mới dự kiến từ 01/01/2027 và đứng tên cá nhân; không dùng chữ VNU/UET. Cần trước `SEC-M3-007` ở G4a |
| B-03 | Tag đầu tiên (`v0.1.0` đề xuất) và cửa sổ theo dõi sau release (72 h đề xuất) | **decided 2026-11-12: `v0.1.0` + 72 h** | [Operations §4.3/§5](../OPERATIONS.md) |
| B-04 | Người vận hành thứ hai (hết hạn `RA-M5-001`: trước G4a public đầu tiên hoặc 31/01/2027) | **decided 2026-11-12** | Owner (chat): tạm thời chỉ Owner vận hành → giữ `RA-M5-001` một người; xem lại khi ngoại lệ hết hạn. Lưu ý điều kiện "trước G4a public đầu tiên": nếu public trước 31/01/2027 thì Owner phải gia hạn `RA-M5-001` có ghi lý do khi ký G4a |

Đã chốt trong chat 2026-11-11: `OD-M5-1` (hướng Google Form), `OD-M5-3` (chấp nhận câu chữ AI soạn), `OD-M5-4` (ngưỡng bundle), `OD-M5-5` (prefetch khi `Workspace` mount) — xem [SPEC-M5-001 §4](M5-SPEC.md).

### Việc kỹ thuật chờ đầu vào

| # | Việc | Phụ thuộc | Cách làm |
| --- | --- | --- | --- |
| B-05 | Link báo lỗi tới Google Form | Owner tạo form (tắt thu email, không bắt đăng nhập) | Đặt `VITE_REPORT_ISSUE_URL` (https) cho Preview + Production trên Cloudflare Pages; thêm câu "nội dung gửi qua form do Google lưu" vào `apps/web/src/model/about-content.ts`; chạy lại G3a phần M5-B/M5-C |
| B-06 | CI GitHub Actions xanh trên PR #3 và ghi run ID vào envelope này | CI đang chạy | Run `43048214214` (`47836a3`): job `check` **pass**, job `e2e` **fail ở bước "Install Playwright Chromium"** do runner không phân giải DNS (`Temporary failure resolving 'azure.archive.ubuntu.com'`) — lỗi hạ tầng, không phải code. Run `43049268789` (`10f9976`) và `43049921103` (`45fe0e7`) đang chạy lúc ghi. Nếu lỗi hạ tầng lặp lại: `gh run rerun <id> --failed`. **2026-11-12:** chạy lại run `43050357462` (attempt 2) cài được Chromium nhưng lộ race trong `e2e/m4.spec.ts:241` (reload trước khi `activeSlots` ghi xong IndexedDB); sửa ở `674cd4c` (chờ slot được lưu; CI thử lại cài Playwright 3 lần, upload `test-results` khi fail). **Xanh:** run `43153778627` trên `98325ae` (`check` + `e2e` pass). Đóng. |
| B-07 | Owner thử TKB HK I trên preview + kiểm thủ công thiết bị/screen reader | Owner | [GUIDE-M5-HK1-001](M5-OWNER-HK1-VALIDATION-GUIDE.md), [CHECKLIST-M5-001](M5-RELEASE-CHECKLIST.md) P-10…P-13 |
| B-08 | G4b dataset TKB HK II 2026–2027 | Trường công bố file + lịch tuần 1 theo khóa | [Runbook §12](../DATA_INGESTION_RUNBOOK.md), `--accept-single-reviewer` theo `RA-M5-001` |
| B-09 | G4a deploy production | B-01, B-02, B-06, B-07 | Bật production deploy trên Pages, `smoke-deploy --production`, `curl -I` (`SEC-M3-007`), diễn tập rollback app trên Pages, tag, theo dõi; điền [RELEASE-M5-001](M5-RELEASE-REPORT.md) |

### Bằng chứng ghi thêm trong phiên 2026-11-11

- `node scripts/smoke-deploy.mjs https://m5-release-hardening.xeptkb-63v.pages.dev/ --expect-commit 47836a3` → **PASS 15/15** (header CSP/XFO/nosniff/Referrer-Policy/HSTS/Permissions-Policy, meta `ky-nay-build` = `0.0.0+47836a3`, `sw.js` và `data/manifest.json` no-cache, 4 icon PNG, `datasets=0`). Xác nhận subdomain Pages của project là `xeptkb-63v`.

### Hoãn sang P1 (không chặn M5)

- Counter/telemetry cookieless (Q-008) sau legal review — [ADR-0014](../adr/ADR-0014-m5-release-observability-without-telemetry.md).
- Tab quản lý phản hồi trong trang admin — cần backend lưu dữ liệu người dùng, ngoài [ADR-0007](../adr/ADR-0007-static-artifact-cli-admin.md).
- Dọn các worktree `.claude/worktrees/agent-*` cũ trên máy local; xác nhận nốt G1 của M0–M2 đang ghi "pending" trong [docs/README.md](../README.md).
