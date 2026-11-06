# Review — M3 Core UI & export, G3c independent review (lần 2)

> **Artifact ID:** `REVIEW-M3-002` (thay thế quyết định của [REVIEW-M3-001](M3-G3c-INDEPENDENT-REVIEW.md) ngày 2026-10-25)
> **Artifact status:** `needs_review` — báo cáo do agent ở vai trò Independent Reviewer viết, đã kết hợp kết quả G3a R2 và G3b R2; cần người (Tech Lead/Release Manager) xác nhận.
> **Status:** `review-approved` (về mặt kỹ thuật tại `d51c65b`; nâng từ `review-no-go` tại `2ab03cd` sau khi toàn bộ `REV-M3-101`, `REV-M3-102`, `REV-M3-104`…`107`, `REV-M3-008` đã `verified-fixed`; chỉ còn điều kiện sign-off G0/G1 của người `REV-M3-103` trước G4a/G4b — xem phụ lục R2.1 cuối báo cáo)
> **Canonical gate:** `G3c`
> **Owner:** Independent Reviewer (agent role)
> **Last reviewed:** 2026-11-06 (kèm phụ lục hậu kiểm R2.1 tại `d51c65b`)
> **Related docs:** [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md), [IMPL-M3-001](M3-IMPLEMENTATION-HANDOFF.md), [SPEC-M3-001](M3-SPEC.md), [DESIGN-M3-001](M3-DESIGN-HANDOFF.md), [REVIEW-M3-001](M3-G3c-INDEPENDENT-REVIEW.md), [ADR-0009](../adr/ADR-0009-m2-domain-engine-schema.md), [ADR-0010](../adr/ADR-0010-m3-web-app-artifact-storage-export.md), [ADR-0011](../adr/ADR-0011-timetable-format-variability.md), [ADR-0012](../adr/ADR-0012-dataset-publish-pipeline.md), [DOMAIN_MODEL](../DOMAIN_MODEL.md), [PARSER_SPEC](../PARSER_SPEC.md), [API_AND_DATA_CONTRACTS](../API_AND_DATA_CONTRACTS.md), [IMPLEMENTATION_PLAN §10](../IMPLEMENTATION_PLAN.md), [DATA_INGESTION_RUNBOOK](../DATA_INGESTION_RUNBOOK.md), [Agent workflow](../../.claude/AGENT_WORKFLOW.md), [G3a R2 (TEST-M3-002)](M3-G3a-QA-REPORT-R2.md), [G3b R2 (SEC-REVIEW-M3-002)](M3-G3b-SECURITY-REVIEW-R2.md)
> **Evidence envelope:** mục [Evidence Envelope](#evidence-envelope) ở cuối file; ledger của M3 là [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md)
> **Independent reviewer / approval UTC timestamp:** một Claude agent đóng vai Independent Reviewer, **không phải sign-off của người**, 2026-11-05T17:05Z (kết hợp G3a/G3b R2: 2026-11-06T04:30Z; phụ lục hậu kiểm R2.1 tại `d51c65b`: 2026-11-06T05:33Z). Báo cáo này cần một người (Tech Lead hoặc Release Manager) xác nhận.

## Scope and identity

- **Loại review:** correctness, contract fidelity (ADR-0009 (13)–(15), ADR-0010, ADR-0011, ADR-0012, DOMAIN_MODEL), parser và pipeline dữ liệu, độ phủ test so với acceptance, docs/process. Re-verify REV-M3-001…010 và các dòng ledger tương ứng.
- **Source spec/ADR/PRD:** SPEC-M3-001 (AC-M3-01…13); ADR-0009 kèm amendment (13)(14)(15); ADR-0010 (2026-10-25); ADR-0011 (2026-10-30/31); ADR-0012 (2026-11-01); IMPLEMENTATION_PLAN Q-011…Q-013, C-02, C-08, C-10. Tất cả vẫn `ready`, G0/G1 chưa có actor/date.
- **Base:** `4681c633af9344a7c541fa91bd45a8a9f4a904be` (`main`).
- **Target (immutable):** commit `2ab03cd7385eb5eafd64251621158e45bed181ba` (tree `771f2ff9a639d4dfbc47b9450176e1fdecf42a55`), nhánh `m3-web-app`, draft PR #1. Change set: `4681c63..2ab03cd` (129 file, +10880/−252). Khoảng soi kỹ: `82cb85b..2ab03cd` (84 file, +2673/−315).
- **Dataset/parser/schema/fixture:** dataset tổng hợp (`synthetic-fixture`, `candidate`) do `scripts/build-synthetic-dataset.mjs` sinh. Parser `uet-xlsx@0.2.0`, domain schema `0.2.0`, manifest/metadata `1.0`. `data/published/manifest.json` có **0 dataset**. Review không dùng dữ liệu thật, không dùng PII.
- **Môi trường:** Windows 10 Pro 19045, Node 22.22.2, npm 12.0.2, TypeScript 5.9.3, Playwright 1.64.0 (Chromium cài sẵn trên máy).
- **Lệnh và kết quả.** Chạy trong worktree riêng, detached tại `2ab03cd`, sau `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci`:

| Lệnh | Exit | Kết quả |
| --- | ---: | --- |
| `npm ci` | 0 | 0 vulnerabilities |
| `npm run check` | 0 | lint + typecheck pass; node:test **94/94**; Vitest **54/54** (7 file); fixtures **6/6**; `dataset check`: `data/published OK — 0 datasets (0 published)` |
| `npm run test:e2e`, với `PORT` trong `apps/web/playwright.config.ts` đổi 4180 → **4383** (chỉ trong worktree của review; Windows giữ dải cổng 4143–4242; không commit) | 0 | Playwright **17/17** (Chromium, bản build production `dist-e2e` có service worker + CSP) |
| Probe ghi chú tuần: `node probe-notes.mjs` gọi `packages/parser/dist/src/weeks.js` | 0 | kết quả ở REV-M3-101 |
| Probe dấu vân tay định dạng: `node probe-format.mjs`, dùng `syntheticXlsx` của parser + `uetXlsxAdapter` | 0 | kết quả ở REV-M3-102 |
| Probe loader (file Vitest tạm `apps/web/src/zz-g3c-probe.test.ts`, xóa sau khi chạy) | 0 | `cache.get` ném lỗi → `loadDataset` **rejected:UnknownError** (REV-M3-104) |
| `gh run list --branch m3-web-app` | 0 | CI "CI checks" [run 42069057252](https://github.com/hoangnguyen206/XepTKB/actions/runs/42069057252) tại `2ab03cd`: `success` (2026-11-05T16:53Z) |

- **Chưa chạy:** WebKit/Firefox, thiết bị thật, import `.ics` vào ứng dụng lịch, `npm run test:real` (file TKB thật nằm ngoài repo và review không có), `npm run dataset -- import` trên file thật, `vite preview` trên host Cloudflare. Probe REV-M3-001 gốc của lần trước (trong scratchpad cũ) không được chạy lại; hành vi đó được kiểm qua unit test và e2e tương ứng trong repo.
- **Phạm vi requirement:** M3 slice của FR-01–FR-08, FR-11, AC-01, AC-06, AC-07 (AC-M3-01…13), cộng parser ADR-0011 và pipeline ADR-0012 nằm trong cùng change set. P0 tổng thể: `no`, vì M4/M5 còn mở.

## Verdict

**`review-no-go`** (đề xuất của agent Reviewer sau khi kết hợp G3a R2 và G3b R2; chờ người xác nhận)

Lý do, ngắn gọn:

- **Không còn S0/S1 ở cả ba cổng G3a, G3b, G3c.** REV-M3-001 (S1) và các S2 cũ của web app đã được sửa đúng contract ADR-0009 (13)(14). Unit test, e2e và CI đều xanh tại `2ab03cd`, và cả ba agent G3a/G3b/G3c đã chạy lại độc lập trên cùng commit `2ab03cd`.
- **No-go không đến từ web app M3.** Nó đến từ hai finding **S2 về toàn vẹn và ranh giới dữ liệu** trong đường parser/pipeline mà change set này mở cho dữ liệu thật (ADR-0011/ADR-0012):
  - **REV-M3-101:** ghi chú tuần chỉ khớp một phần mà vẫn sinh tuần `explicit` sai, không có cảnh báo.
  - **REV-M3-102 (= SEC-M3-102 của G3b, = QA-M3-105 của G3a):** dấu vân tay định dạng bỏ qua cột mới không thuộc tên chuẩn (kể cả cột ẩn trong OOXML theo G3b), nên một bố cục mới có thông tin tuần hoặc cột dữ liệu nhạy cảm ngoài danh sách vẫn được coi là "đã duyệt" và công bố qua `info`.
- Theo AGENT_WORKFLOW §3, `pass-with-follow-up` chỉ được chuyển tiếp khi follow-up **không ảnh hưởng integrity/privacy**. Hai finding trên có thể làm sai tuần học (dẫn tới conflict và ngày trong file `.ics` sai) hoặc làm lộ cột ngoài ý muốn trong file TKB thật, nên không thể ghi chúng thành follow-up thông thường. Đây là gate blocker theo §11 (tương ứng với kết luận `security-no-go` cho G4b dữ liệu thật của G3b R2).
- **Điều kiện mở lại, phạm vi hẹp** (xem mục Approval): sửa REV-M3-101 và REV-M3-102/SEC-M3-102, hoặc làm cho Data Reviewer *nhìn thấy và phải ký* từng ghi chú có chữ "tuần" chưa hiểu hết và từng cột ngoài danh sách chuẩn (bao gồm bỏ ẩn cột/hàng/sheet theo EXC-SEC-M3-R2-A của G3b), kèm test. Sau đó review lại có giới hạn trên commit mới. Các finding còn lại (S2 process, S3 của G3a/G3b/G3c) có thể là follow-up có owner/hạn được Release Manager chấp thuận.

## Structured checks

| Check | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Correctness/domain invariants | Conflict theo `day × period × weeks` từ domain; không false negative; lớp chưa giải được vẫn giữ buổi chung | Đạt cho web app: `sessionsForPick` trả buổi chung kèm lỗi (`packages/domain/src/plan.ts:51-62`); `PlanView.unresolved`, rebase preview, UI và export cảnh báo. Parser sinh tuần sai từ ghi chú khớp một phần (REV-M3-101) | **fail** (parser) / pass (app) |
| Parser/data provenance | Deterministic, traceable, fail closed | Manifest có `importHash`, `parserVersion`, `importedAt`, `reviewedAt` (lúc validate), `publishedAt`, `status`; artifact bất biến + `dataset check`. Fingerprint không fail closed với cột mới không chuẩn (REV-M3-102); `--accept-new-format` lệch ADR-0011 §2 | **fail** |
| Scope/contract/migration | Không drift im lặng | ADR-0009 (13)(14)(15) khớp code. ADR-0010 §4 và bảng "Status after G3" đã cũ; runbook §7 nói có `hold`/`rejected` nhưng CLI không có (REV-M3-106, REV-M3-107). G0/G1 vẫn chưa có actor/date (REV-M3-103) | **pass with finding** |
| Privacy/security boundary | Không vượt ranh giới | Không PII trong web app M3; 275/275 request runtime trong G3b là GET cùng origin; `assertOutsideRepo` chặn file thật trong repo. Đường nạp TKB thật có SEC-M3-102 (S2, cột ngoài danh sách/cột ẩn thành `info`) và các S3 SEC-M3-101/103/104, SEC-M3-001/003/005/006a (xem G3b R2) | **pass with finding** (app pass; G4b dữ liệu thật bị chặn bởi SEC-M3-102) |
| Performance/maintainability | Search p95 < 100 ms, conflict p95 < 50 ms | Không chạy lại bench. ADR-0012 ghi dry run thật: tải 215 ms, search 15 ms. `groupOptions` (web) và `sectionGroups` (domain) vẫn là hai quy tắc song song, nhất quán trong các kịch bản đã xét | **pass** |
| Tests/docs/observability | Evidence đầy đủ; test bắt được lỗi được nêu | Test cho REV-M3-001…004/006/007/010 có ý nghĩa, không tautological. Còn thiếu: test cảnh báo khác cơ sở, đường bàn phím tới bước xuất file, `published.test.ts` chỉ chạy policy preview, chưa có test import → loader (REV-M3-105). Envelope/handoff chưa ghi `b705104`…`2ab03cd` (REV-M3-107) | **pass with finding** |

## Re-verification REV-M3-001…010

Ledger # theo [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md). Trạng thái: `verified-fixed` / `partially-fixed` / `still-open` / `regressed`.

| ID (ledger #) | Sev gốc | Trạng thái | Evidence (file:line @ `2ab03cd`) | Ghi chú |
| --- | --- | --- | --- | --- |
| REV-M3-001 (#1, = QA-M3-001) | S1 | **verified-fixed** | Domain: `packages/domain/src/plan.ts:51-62` (buổi chung + `GROUP_REQUIRED`/`GROUP_NOT_FOUND`). Web: `apps/web/src/model/plan-view.ts:51,62-72` (`unresolved`), `:79-114` (`rebasePreview`, rebase xóa nhóm không còn); `components/PlanSummary.tsx:97-106` (không hiện "✓ Không có lớp nào trùng lịch" khi còn lớp chưa giải được), `:88` (thông báo lỗi theo từng lớp); `Workspace.tsx` plan bar "⚠ N lớp cần xử lý"; `ExportPanel.tsx` cảnh báo; `export/files.ts` ghi chú trong Word. Test: `packages/domain/test/plan.test.ts` (3 test), `apps/web/src/model/model.test.ts` khối "dataset revision that changes a picked section's groups" (4 test), e2e `m3.spec.ts:351` | Đúng theo khuyến nghị (1)–(4) của lần trước. Review đã chạy e2e #12: trước và sau rebase vẫn còn "1 chỗ trùng lịch", có "1 lớp cần xử lý", màn xác nhận liệt kê "sẽ bỏ nhóm của" và "cần chọn lại nhóm cho". File `.ics` vẫn xuất khi còn lớp chưa giải được, nhưng có cảnh báo (cho phép theo khuyến nghị "warn or block") |
| REV-M3-002 (#3, = QA-M3-003) | S2 | **verified-fixed** | `apps/web/src/storage/local-data.ts:27-41` (gỡ đăng ký service worker sau khi xóa cache); e2e `m3.spec.ts:244` | E2e #8 pass trong lần chạy của review: wipe → 0 registration → online → offline vẫn mở được Plan |
| REV-M3-003 (#2, = QA-M3-002) | S2 | **verified-fixed** | `packages/domain/src/plan.ts:158-166` (chỉ chặn lỗi của chính lớp mới chọn); test `addPlanPick rejects only on errors of the new pick`, model test "does not block an unrelated pick", e2e `m3.spec.ts:351` (chọn SYN2004 1 khi SYN1001 1 đang chờ nhóm) | Khớp ADR-0009 (14) |
| REV-M3-004 (#4) | S2 | **verified-fixed** (theo phạm vi cũ) | `apps/web/src/data/loader.ts:67-70` (`INSECURE_CONTEXT`), `:185-201` (`put` lỗi vẫn trả dataset kèm `notCached`); `controller.ts` hiện thông báo; `loader.test.ts:103,111` | Còn một nhánh lỗi lưu trữ khác chưa xử lý: `cache.get` → REV-M3-104 (S3) |
| REV-M3-005 (#7, = QA-M3-010) | S2 | **verified-fixed** (theo phạm vi cũ) | Có `EVID-M3-001`; target là commit cố định `2ab03cd`; CI [run 42069057252](https://github.com/hoangnguyen206/XepTKB/actions/runs/42069057252) success | Envelope và handoff chưa cập nhật cho `b705104`…`2ab03cd` → REV-M3-107 (S3) |
| REV-M3-006 (#17, = QA-M3-008) | S3 | **verified-fixed** | `apps/web/src/components/Workspace.tsx` plan bar: "chưa rõ" / "+ N môn chưa rõ tín chỉ"; `App.test.tsx:56-66` | Nhận xét (không thành finding): tab Phương án vẫn hiện `0 (chưa rõ tín chỉ: …)` khi mọi môn đều chưa rõ tín chỉ (`PlanSummary.tsx:65-66`). Lần trước không phản đối dạng này; Product có thể muốn đổi thành "chưa rõ" cho thống nhất với AC-M3-11 |
| REV-M3-007 (#16, = QA-M3-007) | S3 | **verified-fixed** | `apps/web/src/components/SectionCard.tsx` (preview cũng tính cho thẻ đã chọn; nút "Vẫn đổi nhóm (đang trùng lịch)"; badge "⚠ Cần chọn lại nhóm") | E2e #12 kiểm nút. Chưa có assertion trực tiếp cho badge "⚠ Trùng lịch" trên thẻ đã chọn cùng nhóm; badge đúng theo đọc code |
| REV-M3-008 (#19) | S3 | **partially-fixed** | Đã thêm: viewport 1200 (`m3.spec.ts:11-17`), nhóm đổi khi stale, wipe → offline, ghi cache lỗi. Còn thiếu: **0** test cảnh báo khác cơ sở (grep `cơ sở\|campus` trong test web/e2e: 0 kết quả); đường bàn phím vẫn dừng ở bước chọn lớp (`m3.spec.ts:131`), trong khi AC-M3-05 yêu cầu "tìm → chọn → xuất" | Owner Tester + Frontend; vẫn S3 |
| REV-M3-009 (#20) | S3 | **verified-fixed** (các mục a–f) | (a) ADR-0010 §2 rule 4 có `import.meta.env.DEV`; (b) ADR-0010 §3 nêu `isPlanShape`; (c) `apps/web/src/storage/plan-store.ts:80-106` đưa bản ghi mâu thuẫn vào backups, test trong `plan-store.test.ts`; (d) `App.tsx` hiện banner "chưa được công bố" cho cả dữ liệu mẫu; (e) ADR-0010 §4 có `font-src`; (f) TECH_STACK/ARCHITECTURE ghi phần thực tế M3 | Drift mới sinh ra sau đó → REV-M3-107 |
| REV-M3-010 (#21) | S3 | **verified-fixed** | `apps/web/src/export/png.ts:124-131` (cảnh báo nằm ở dòng đầu khối); `apps/web/src/export/png.test.ts` (khối 1 tiết có `⚠ TRÙNG LỊCH · SYN1`) | Test dùng canvas proxy ghi lại `fillText`, có ý nghĩa |

Các dòng ledger khác do G3a/G3b sở hữu (#5, #6, #8–#15, #18, #22) đã được G3a R2 ([TEST-M3-002](M3-G3a-QA-REPORT-R2.md)) và G3b R2 ([SEC-REVIEW-M3-002](M3-G3b-SECURITY-REVIEW-R2.md)) kiểm chứng trên cùng commit `2ab03cd`:

- **Đã đóng (`verified-fixed`):** #5 (`QA-M3-004` banner cập nhật giả trên WebKit: 0/12 ở G3a R2 + iPhone 12 thật của owner), #6 (`QA-M3-005` + `SEC-M3-006b` hai tab compare-and-put, kể cả khi tắt `BroadcastChannel`), #9 (`SEC-M3-002` `%2e%2e`), #11 (`SEC-M3-004` giới hạn kích thước qua stream không có `Content-Length`), #14 (`SEC-M3-007` header/CSP/framing trên preview thật; kiểm lại trên production ở G4a), #15 (`QA-M3-006` chuyển kỳ khi offline), #18 (`QA-M3-009` SHA-256 dataset mẫu tái lập được qua 4 lần dựng khác múi giờ), #22 (`HOST-M3-001` offline khi host redirect `/index.html` → `/`, đạt trên Chromium và WebKit).
- **Còn mở một phần (`partially-fixed`, đều là S3):** #8 (`SEC-M3-001`: kỳ active đã xóa cache khi `retracted`, nhưng kỳ không active đã cache từ trước vẫn mở được khi offline), #10 (`SEC-M3-003`: nhánh `main` ẩn `candidate` đúng trên trình duyệt, nhưng `NODE_ENV=development` vẫn bật cờ, `site-data.mjs` vẫn copy cả thư mục `data/published`, và chưa có test tự động trong CI), #12 (`SEC-M3-005`: runtime cùng origin 100%, nhưng lint tĩnh còn đường lách qua `stripComments`/dynamic property), #13 (`SEC-M3-006a`: tab bấm wipe đã xóa danh sách backup, nhưng tab thứ hai đang mở vẫn hiển thị và tải được bản sao lưu cũ).

## Contract conformance

| Contract | Yêu cầu | Code @ `2ab03cd` | Kết luận |
| --- | --- | --- | --- |
| ADR-0009 (13) | `sessionsForPick` trả buổi chung kèm `GROUP_REQUIRED`/`GROUP_NOT_FOUND`; caller coi là "partially resolved" | `plan.ts:51-62`; caller: `plan-view.ts:51` (`unresolved` từ mọi lỗi severity error có `sectionId`), UI/export xử lý | **conform** |
| ADR-0009 (14) | `addPlanPick` chỉ từ chối khi lỗi thuộc lớp mới (hoặc lỗi không có section) | `plan.ts:161-164`; `resolvePlanPicks` không sinh lỗi thiếu `sectionId` | **conform** |
| ADR-0009 (15) | Buổi không giờ kiểu `OTHER` hợp lệ; LT/TH/BT phải có giờ; như ONL: không lên lưới, không conflict, vẫn tính tín chỉ | `validate.ts:41-45`; parser: `uet-xlsx-adapter.ts` nhánh `noTime` khi không có cột loại buổi; `findConflicts` bỏ qua buổi non-fixed; `kindText` ẩn chữ "Khác" | **conform**. DOMAIN_MODEL §3 dòng 187 nói chung "không có fixed time", chưa nêu `OTHER` không giờ (drift nhỏ, gộp vào REV-M3-107) |
| ADR-0010 §2 loader | Giới hạn kích thước, SHA-256 trước khi parse, khớp header, invariants, status policy, cache | `loader.ts`, `contract.ts`; giới hạn qua stream (`fetchBytes`); từ chối `%`; xóa cache khi bị retract; `isInfoList` giới hạn 30 mục / nhãn 100 / giá trị 300, khớp parser (`uet-xlsx-adapter.ts:156-182`) | **conform**; lỗi đọc cache → REV-M3-104 |
| ADR-0010 §2 rule 4 + ADR-0012 §5 | Production chỉ dữ liệu `published`; preview/dev được xem dữ liệu chưa công bố, có banner | `vite.config.ts:11-15` (`CF_PAGES_BRANCH !== "main"`), `controller.ts` `ALLOW_UNPUBLISHED`, `loader.ts:55-61`; test `loader.test.ts:133` | **conform**; chưa có test trình duyệt với cờ tắt (SEC-M3-003, G3b) |
| ADR-0010 §3 storage | Envelope `{schemaVersion, storedAt, plan}`, migration 0.1.0, backups, wipe | `plan-store.ts`, `db.ts`, `local-data.ts`; thêm compare-and-put | **conform** |
| ADR-0010 §4 service worker/CSP | Network-first, fallback "cached `index.html`"; CSP như liệt kê | Code fallback `./`, không precache `index.html` (từ `08401c4`); CSP trùng với danh sách | **drift docs** (REV-M3-107) |
| ADR-0010 §5 export | ICS UTC, Word escaped, PNG, print | Không đổi về hành vi; `kindText` thay `kindLabel`; Word có ghi chú khi còn lớp chưa giải được | **conform** |
| ADR-0011 §1 | Header-driven; bắt buộc `courseCode, courseName, sectionId, day` + `shift` hoặc `periodText` | `uet-config.ts:86` + kiểm tra shift/periodText | **conform** |
| ADR-0011 §2 | Bộ cột chưa duyệt → `hold`, không publish được cho tới khi thêm vào `KNOWN_FORMATS`; "a layout change stops the pipeline" | Fingerprint chỉ gồm *trường chuẩn* (`uet-xlsx-adapter.ts:227-231`), nên cột mới không chuẩn không làm đổi fingerprint. CLI cho bộ cột chuẩn chưa duyệt đi tiếp thành `candidate` khi có `--accept-new-format` (`scripts/dataset.mjs:121-123`) | **non-conform** (REV-M3-102) |
| ADR-0011 §3–§5 | Profile, độ phủ dòng, các quirk | `adapter.ts` `ImportProfile`/`ParseCoverage`; CLI dừng khi có dòng chưa giải thích (`dataset.mjs:118-120`); có test cho từng quirk | **conform**. Profile JSON không được kiểm schema (khóa lạ bị bỏ qua); rủi ro thấp vì do operator đưa vào |
| ADR-0011 §6 / Q-012 | Chỉ pattern tuần/tiết *rõ ràng* mới đổi buổi học; phần còn lại là thông tin | Regex không neo nên khớp một phần thành tuần `explicit` sai; cảnh báo `UNPARSED_NOTE` đã bị bỏ (`weeks.ts:20-23, 41-61`) | **non-conform** với chữ "rõ ràng" (REV-M3-101) |
| ADR-0011 §8 | Cột không dùng → `info`, chỉ là thông tin | `infoColumns`/`rowInfo`; UI hiện qua `formatSessionExtras` | **conform**, nhưng xem REV-M3-102: cột "thông tin" mới không được ai duyệt |
| ADR-0012 §1–§2 | `data/published` append-only, artifact bất biến, import từ chối lỗi/dòng chưa giải thích/hash trùng/bộ cột chưa duyệt; report + audit | `dataset.mjs:43-50` (không ghi đè), `:100-101`, `:110-123`, `:161-244`, `:52-55` | **conform**, trừ "bộ cột chưa duyệt" (REV-M3-102) |
| ADR-0012 §3 lifecycle | `candidate → validated → published`, mọi trạng thái → `retracted`; bản hiện hành = mục cuối được phép | `dataset-core.mjs:50-68`; `loader.ts:55-61` | **conform**; runbook §7 nhắc `hold`/`rejected` mà CLI không có; G4b drill "retract → publish lại" không làm được (REV-M3-106) |
| ADR-0012 §4 hai người | Validate từ chối importer, trừ khi có exception được ghi lại | `dataset-core.mjs:52-56`; importer lấy từ `audit.jsonl` (`dataset.mjs:250`). Nếu audit thiếu dòng import thì không kiểm được | **conform** (quy trình, không cưỡng chế bằng kỹ thuật, như ADR đã nêu) |
| ADR-0012 §6 integrity trong CI | `dataset check`; `published.test.ts` nạp mọi dataset hiện hành bằng loader của app | Có cả hai, nhưng test chỉ dùng `allowUnpublished: true`, và hiện có 0 dataset nên test rỗng | **partial** (REV-M3-105) |
| ADR-0012 §7 | Tên version `uet-<term>-<YYYYMMDD VN>-<8 hex>` | `dataset-core.mjs:7-10` + test | **conform** |
| DOMAIN_MODEL: period là đơn vị gốc | Ca → tiết qua TimeFrame; conflict theo tiết | `periodsFromShiftCell` (`normalize.ts`) đổi `Ca a - b` thành tiết theo `UET_CONFIG.frame`; engine không đổi | **conform** |
| DOMAIN_MODEL: conflict = day × period × overlapping weeks | | Domain không đổi; đúng với tuần đầu vào. Tuần đầu vào có thể sai do REV-M3-101/102 | **conform** (engine) |
| DOMAIN_MODEL §5: override precedence | Field-level, registration < admin < user | Merge (M4) giữ precedence (`registration-merge.ts`). M3 không có đường nào tạo override; `buildPlanView` dựng từ timetable gốc và không áp `Plan.overrides` | **N/A trong M3**; M4 cần một hàm domain áp override cho Plan đã lưu trước khi hiển thị/xuất Plan chính thức (ghi để M4 G1 xét, không lập finding) |
| DOMAIN_MODEL: ONL/non-fixed (Q-009/Q-012) | Không lên lưới, không conflict, vẫn tính tín chỉ | `NonFixedList`, `scheduledSessions`, `calculatePlanCredits`; test trong `uet-xlsx.test.ts` (SYN1057 ONL, SYN3132 OTHER) | **conform** |
| Provenance bắt buộc | Source document, hash, parser version, imported/reviewed time, status | Entry từ CLI có `documentRef`, `importHash`, `parserVersion`, `importedAt`; `reviewedAt` khi validate; `publishedAt`; `status`. Report có SHA-256 của artifact | **conform**. `documentRef`/`publishedBy` là text tự do, không kiểm PII (để G3b xét) |

## Findings

> Xếp theo severity. Mỗi finding đều có probe hoặc đọc code với kịch bản cụ thể.

### `REV-M3-101` — [S2] Ghi chú tuần khớp một phần vẫn cho tuần "explicit" sai, không có cảnh báo nào cho Data Reviewer hay sinh viên

- **File/line/artefact:** `packages/parser/src/weeks.ts:20-23` (`WEEK_RANGE`, `WEEK_FROM`, `WEEK_LIST` không neo đầu/cuối và không kiểm phần chữ còn lại), `:41-61` (khớp đúng một pattern là chấp nhận, `weekOrigin = "explicit"`). Thay đổi trong diff này (`82cb85b..2ab03cd`, Q-012) đã bỏ `UNPARSED_NOTE`/`DEFAULT_WEEKS_APPLIED`. Import report (`scripts/dataset.mjs:161-244`) không liệt kê ghi chú nào. `docs/PARSER_SPEC.md` §6 (bảng pattern) không có dạng "đến tuần".
- **Failure scenario:** TKB HK II (bố cục 17 cột có hai cột "Ghi chú", theo ADR-0011) có ghi chú dạng tự nhiên, ví dụ "Học tuần 1 đến tuần 8" hoặc "Học từ tuần 3 đến tuần 10".
- **Expected / actual:** Expected (ADR-0011 §6 "chỉ pattern tuần rõ ràng mới đổi buổi học"; CLAUDE.md §3 fail closed): ghi chú không hiểu hết thì giữ mặc định *và* báo cho reviewer, hoặc đưa vào review. Actual (probe `probe-notes.mjs`, teachingWeeks 15):
  - `"Học tuần 1 đến tuần 8"` → `[1]` `explicit`, 0 issue;
  - `"Học tuần 1 đến 8"` → `[1]` `explicit`;
  - `"Học tuần 9 đến hết"` → `[9]` `explicit`;
  - `"Học từ tuần 3 đến tuần 10"` → `[3..15]` `explicit`;
  - `"Học các tuần 1-8"` và `"Tuần 1-8"` → `[1..15]` `parser-default`, không warning.
- **Impact:**
  - Tuần sai làm sai kết quả trùng lịch. Ví dụ `[1]` thay cho `[1..8]` gây **false negative** trong các tuần 2–8.
  - File `.ics` thiếu hoặc thừa buổi học với ngày cụ thể.
  - Không có tín hiệu nào cho Data Reviewer. Sinh viên chỉ thấy `rawNote` nếu tự đọc.
  - Theo reviewer contract, đây là loại lỗi "wrong week/date". Regex có từ M1, nhưng diff này bỏ tín hiệu review và mở đường nạp dữ liệu thật (ADR-0012) ngay trước cửa sổ HK II 09–15/11/2026.
  - Nâng lên **S1** nếu bất kỳ dataset thật nào chứa dạng ghi chú như vậy.
- **Evidence/repro/run ID:** `node probe-notes.mjs file:///…/packages/parser/dist/src/weeks.js` (scratchpad của review). Output đã trích ở trên.
- **Recommended fix:**
  1. Chỉ coi một pattern là explicit khi nó tiêu thụ hết đoạn chữ nói về tuần, ví dụ không còn từ "tuần"/"đến"/"hết" chưa dùng. Nếu không, trả warning `NOTE_WEEKS_UNCERTAIN`, giữ default `parser-default` hoặc đưa vào review.
  2. Thêm pattern `từ tuần a đến (tuần) b` và `tuần a đến (tuần) b` sau khi Product xác nhận bằng dữ liệu thật.
  3. Import report liệt kê mọi ghi chú khác nhau có chứa "tuần", kèm tuần đã suy ra, để Data Reviewer ký.
  4. Thêm test cho các chuỗi trên.
- **Owner / status / due:** Data Parser (sửa) + Product (xác nhận pattern) / open / trước khi `validate` dataset thật đầu tiên (HK II, dự kiến 09–15/11/2026), và trước khi chạy lại G3c có giới hạn.

### `REV-M3-102` — [S2] Dấu vân tay định dạng bỏ qua cột mới không thuộc tên chuẩn; import report không nêu tên các cột đó; `--accept-new-format` lệch ADR-0011 §2

- **File/line/artefact:**
  - `packages/parser/src/uet-xlsx-adapter.ts:227-231`: `formatFingerprint` chỉ dùng key của `mapping`, tức trường chuẩn.
  - `:145`: `UNKNOWN_COLUMN` không có `rawValue`, và message vẫn ghi "retained only as source input" dù cột nay được hiện cho sinh viên.
  - `:163-174`: `infoColumns`.
  - `packages/parser/src/uet-config.ts:65-79` (`COLUMN_SYNONYMS`), `:104` (`KNOWN_FORMATS`).
  - `scripts/dataset.mjs:121-123`: `--accept-new-format` tạo `candidate`.
  - `docs/adr/ADR-0011-timetable-format-variability.md:26` (§2) và bảng Alternatives: lý do loại phương án "accept any header that has the required columns" chính là "a new column carrying week information would be published without anyone noticing".
  - IMPLEMENTATION_PLAN Q-013 (4): cột khác "có thì **xem xét**".
- **Failure scenario:** File HK II thêm một cột như "Tuần", "Thời gian học" hoặc "Tuần bắt đầu", không trùng synonym nào. Synonym "tuần học" thì được map sang `note`.
- **Expected / actual:** Expected: bố cục đổi thì pipeline dừng (`hold`, CLI exit 2) cho tới khi reviewer duyệt. Actual (probe `probe-format.mjs`, bố cục HK I + một cột thêm, giá trị `1-8`): với cả ba tên cột đều cho `status candidate knownFormat true weeks 1..15 parser-default info [{"label":"Tuần","value":"1-8"}]`. Warning chỉ có `UNKNOWN_COLUMN` (không kèm tên cột) và `ROOM_CAMPUS_UNKNOWN`. CLI do đó không dừng, và report chỉ ghi `columns:` gồm các trường chuẩn. Ngược lại, với bộ trường chuẩn chưa duyệt, `--accept-new-format "<lý do>"` cho importer đưa thẳng thành `candidate` rồi `validated`/`published`, trong khi ADR-0011 §2 nói "cannot be published until a Data Reviewer … adds the set to the list". Runbook §7 còn nêu trạng thái `hold`, mà manifest/CLI không có trạng thái này.
- **Impact:** Thông tin tuần nằm trong cột mới bị bỏ qua. Buổi học nhận tuần mặc định `[1..teachingWeeks]`, gây conflict giả và sự kiện `.ics` cho cả những tuần không học. Đúng kịch bản mà ADR-0011 tuyên bố đã chặn. Control "fail closed" của pipeline mạnh yếu hơn mô tả.
- **Evidence/repro/run ID:** `node probe-format.mjs <worktree>` (scratchpad của review). Test `uet-xlsx.test.ts` "an unreviewed column set is held…" cũng cho thấy bố cục HK II với `LT`, `TH`, `Tự học`, `SS` không thuộc tên chuẩn vẫn là `known`.
- **Recommended fix:**
  1. Đưa *tên hiển thị đã chuẩn hóa của mọi cột* (kể cả cột thông tin) vào fingerprint, hoặc thêm vào `KNOWN_FORMATS` danh sách cột thông tin đã duyệt. Cột lạ thì `hold`, CLI exit 2.
  2. `UNKNOWN_COLUMN` mang `rawValue` = header, sửa message, và report liệt kê header lạ.
  3. Quyết định `--accept-new-format`: hoặc chỉ Data Reviewer khác importer được dùng ở bước `validate`, hoặc sửa ADR-0011 §2 cho đúng code. Thống nhất runbook §7 với các trạng thái CLI.
  4. Thêm test cho cột mới có thông tin tuần.
- **Owner / status / due:** Data Parser + Tech Lead / open / như REV-M3-101.

### `REV-M3-103` — [S2, process] G0/G1 vẫn chưa có actor/date trong khi contract đã được sửa nhiều lần

- **File/line/artefact:**
  - `docs/evidence/M3-SPEC.md:10`: "chưa có G0 sign-off chính thức".
  - ADR-0010 ("g1-blocked pending Tech Lead acknowledgement"), ADR-0011, ADR-0012 ("G1 acknowledgement pending").
  - ADR-0009 amendment (13)(14)(15): "G1 acknowledgement".
  - `IMPLEMENTATION_PLAN.md:194,200`: C-02/C-08 "chờ Product xác nhận".
  - D-M3-1…4 vẫn chờ Product (`M3-SPEC.md:106`).
- **Failure scenario:** Tính đến commit `2ab03cd`, sau 25/10 đã có 4 lần sửa contract (ADR-0009 (13)–(15), ADR-0010, ADR-0011 mới, ADR-0012 mới). Mỗi lần sửa mở lại G1 theo AGENT_WORKFLOW §6, nhưng chưa có lần acknowledgement nào được ghi.
- **Expected / actual:** Expected (CLAUDE.md §5 DoR; AGENT_WORKFLOW §2, §6): contract đã freeze ở G1 trước khi review và release. Actual: G3 chạy trên contract chưa được G1 chấp thuận. Review này **không điền thay** các mục đó.
- **Impact:** G4a/G4b không thể dựa trên contract chưa được duyệt. Q-011 yêu cầu dữ liệu thật đã được review trước khi mời người dùng beta. Không ảnh hưởng tính đúng của code đã review.
- **Evidence/repro/run ID:** đọc các dòng metadata nêu trên.
- **Recommended fix:** Product ghi G0 (SPEC-M3-001, D-M3-1…4, C-02, C-08). Tech Lead ghi G1 cho ADR-0009 amendment, ADR-0010, ADR-0011, ADR-0012, kèm actor, ngày UTC và evidence. Data Reviewer ký fixture/provenance cho ADR-0011/0012 theo hàng G1.
- **Owner / status / due:** Product + Tech Lead / open / trước G4a/G4b và trước khi mời người dùng beta (Q-011).

### `REV-M3-104` — [S3] Lỗi đọc IndexedDB trong loader làm app kẹt ở trạng thái "đang tải"

- **File/line/artefact:**
  - `apps/web/src/data/loader.ts:178` và `:182`: `options.cache.get(...)` nằm ngoài `try`. Đường offline thì có `.catch` (`:168`).
  - `apps/web/src/app/controller.ts:59-81`: `load` không có `try/catch`.
  - `:101`: `await load(activeTerm)` trong một IIFE không bắt lỗi.
- **Failure scenario:** Đang online, manifest đọc được, nhưng `datasets.get` ném lỗi (IndexedDB hỏng hoặc bị đóng kết nối; Safari có các lỗi `UnknownError` đã biết).
- **Expected / actual:** Expected (cùng tinh thần sửa REV-M3-004): bỏ qua cache, tải và kiểm tra dữ liệu mới, kèm thông báo. Actual (probe Vitest tạm): `loadDataset` → `rejected:UnknownError`. Controller không bắt lỗi nên `state` giữ `{status: "loading"}` và không có nút "Thử lại".
- **Impact:** App không dùng được trên thiết bị bị ảnh hưởng, không có thông báo. Hiếm gặp.
- **Evidence/repro/run ID:** file tạm `apps/web/src/zz-g3c-probe.test.ts` trong worktree của review (đã xóa), output `PROBE cache.get throws → rejected:UnknownError`.
- **Recommended fix:** bọc `cache.get` bằng `.catch(() => undefined)` ở cả hai chỗ. Trong controller, bắt lỗi của `loadDataset` và chuyển sang trạng thái `unavailable` có nút "Thử lại". Thêm unit test với cache có `get` ném lỗi.
- **Owner / status / due:** Frontend/Coder / open / trước khi mời người dùng beta (Q-011), tối đa 2026-11-13.

### `REV-M3-105` — [S3] Test của pipeline dữ liệu chưa phủ đúng đường production và đường import

- **File/line/artefact:**
  - `apps/web/src/data/published.test.ts:37-49`: chỉ `allowUnpublished: true`.
  - `data/published/manifest.json`: 0 dataset, nên vòng `for` không sinh test nào.
  - `scripts/test/dataset-core.test.mjs`: chỉ test hàm thuần. `importDataset` (`scripts/dataset.mjs:84-159`) không có test tự động.
- **Failure scenario:**
  1. Kỳ có bản `published` cũ và bản `candidate` mới hơn. Test chỉ nạp bản candidate, vì đó là bản hiện hành của preview. Bản production thực sự phục vụ (`allowUnpublished: false`) không được nạp lại. Nếu app đổi validator (ví dụ giới hạn `info`), bản published cũ có thể bị production từ chối mà CI vẫn xanh.
  2. Shape artifact do CLI ghi (metadata `term.starts`, timetable) chỉ được kiểm bằng dry run thủ công ngày 31/10. Lỗi chỉ lộ khi commit dataset thật, lúc Cloudflare đã dựng preview song song với CI.
- **Expected / actual:** Expected (ADR-0012 §6 "CI proves that what ships loads in the app"): test theo cả hai policy, và một round trip import → loader trên workbook tổng hợp. Actual: như trên.
- **Impact:** Nếu xảy ra thì loader fail closed ("Dữ liệu vi phạm…"), không có dữ liệu sai lọt ra, nhưng có thể mất dữ liệu trên production đúng lúc cần.
- **Evidence/repro/run ID:** đọc code; Vitest 54/54, trong đó `published.test.ts` chỉ chạy test "has a manifest the app accepts".
- **Recommended fix:**
  - Lặp `published.test.ts` với cả `allowUnpublished: false` (bản `published` cuối của mỗi kỳ) và `true`.
  - Thêm test node: `dataset import` trên workbook tổng hợp vào một thư mục tạm (tham số hóa `DATA_DIR`), sau đó nạp bằng loader của app.
  - Thêm assertion cho manifest rỗng để test không âm thầm thành rỗng khi đã có dữ liệu.
- **Owner / status / due:** Tester + Tech Lead / open / trước G4b đầu tiên.

### `REV-M3-106` — [S3] Vòng đời dataset: "retract → publish lại" không làm được; runbook và CLI lệch nhau

- **File/line/artefact:**
  - `scripts/lib/dataset-core.mjs:59-66`: chỉ `validated → published`; `retracted` là trạng thái cuối.
  - `scripts/dataset.mjs:100-101`: từ chối file có hash đã nạp, kể cả khi bản cũ đã bị `retracted`.
  - ADR-0012 Verification: "G4b drill … validate → publish → retract → publish again".
  - `docs/DATA_INGESTION_RUNBOOK.md` §7: có `hold` và `rejected`.
- **Failure scenario:** Release Manager retract nhầm, hoặc retract tạm rồi muốn khôi phục cùng một bản.
- **Expected / actual:** Expected: drill theo ADR chạy được bằng CLI, có audit. Actual: cách duy nhất là sửa tay `manifest.json`. `dataset check` không phát hiện việc sửa tay trạng thái, và audit log không có dòng tương ứng.
- **Impact:** Rollback-of-rollback phải làm thủ công, không có dấu vết trong audit log, đúng lúc có sự cố. Drill G4b như ADR mô tả không thực hiện được.
- **Evidence/repro/run ID:** đọc code (`nextStatus`: publish chỉ từ `validated`; import chặn hash trùng).
- **Recommended fix:** thêm lệnh `restore <version>` (`retracted → validated` hoặc `→ published`, cần lý do, có audit), hoặc sửa ADR-0012/runbook cho đúng quy trình thật (nạp lại bản sửa). Đồng bộ runbook §7 (`hold`/`rejected`) với enum của manifest.
- **Owner / status / due:** Tech Lead + Release Manager / open / trước G4b drill.

### `REV-M3-107` — [S3] Evidence và docs chưa theo kịp target `2ab03cd`

- **File/line/artefact:**
  - (a) `docs/evidence/M3-EVIDENCE-ENVELOPE.md:4,7` và `M3-IMPLEMENTATION-HANDOFF.md:4,9`: status `blocked`, Last reviewed 2026-10-25. Không có mục nào cho `b705104` (cột `info`, Cloudflare), `f384f7b`/`08401c4` (chỉ ghi trong ledger #10/#22), `2ab03cd` (pipeline ADR-0012, `kindText`). Không ghi [CI run 42069057252](https://github.com/hoangnguyen206/XepTKB/actions/runs/42069057252).
  - (b) `docs/adr/ADR-0010-m3-web-app-artifact-storage-export.md:87`: "cached `index.html` fallback"; code dùng `./` và không precache `index.html`.
  - (c) cùng file `:160-161`: bảng "Status after G3" vẫn mô tả code cũ cho REV-M3-009 (c)(d), dù đã sửa.
  - (d) `apps/web/e2e/m3.spec.ts:94`: tên test "360/768/1280", trong khi vòng lặp đã gồm 1200.
  - (e) `docs/IMPLEMENTATION_PLAN.md:201,203`: hai dòng cùng ID `C-10`.
  - (f) DOMAIN_MODEL §3 chưa nêu buổi `OTHER` không giờ (ADR-0009 (15)).
- **Failure scenario:** G3a/G3b/G4 và Release Manager đọc envelope để biết target nào đã được kiểm; M4 dựa theo ADR-0010 §4.
- **Expected / actual:** Expected (CLAUDE.md §4–§6): handoff và evidence ghi mọi thay đổi sau lần handoff trước, kèm lệnh, exit code và run ID. Actual: kết quả của hai commit cuối chỉ có trong commit message.
- **Impact:** Truy vết gate yếu; không ảnh hưởng hành vi app.
- **Evidence/repro/run ID:** đọc các file nêu trên; `git log 82cb85b..2ab03cd`.
- **Recommended fix:** Tech Lead cập nhật IMPL-M3-001 (fix round 31/10–01/11) và EVID-M3-001 (target `2ab03cd`, CI run, kết quả G3 R2), sửa ADR-0010 §4 và bảng Status, đổi tên test e2e, đánh lại ID trùng `C-10`, bổ sung DOMAIN_MODEL §3.
- **Owner / status / due:** Tech Lead / open / cùng lúc ghi nhận kết quả G3 R2.

### Finding cũ còn mở

- `REV-M3-008` [S3]: **partially-fixed**, còn thiếu test cảnh báo khác cơ sở và đường bàn phím tới bước xuất `.ics`. Owner Tester + Frontend/Coder, hạn đề xuất 2026-11-13.

## Clean areas verified

- **Unresolved picks, đầu cuối:** domain → `PlanView` → plan bar / tóm tắt / thẻ lớp / export panel / Word. Không còn trường hợp "✓ Không có lớp nào trùng lịch" khi một lớp chưa giải được. Rebase liệt kê lớp bị bỏ, nhóm bị xóa và lớp cần chọn nhóm (model test + e2e #12).
- **Hai tab:** compare-and-put trong một transaction, chuỗi lưu tuần tự, `BroadcastChannel` cho `plans-changed`/`wiped` (unit test + e2e #9).
- **Loader:** giới hạn kích thước qua stream, từ chối `%` trong URL, xóa cache khi bị retract, offline mở được mọi kỳ đã lưu, `INSECURE_CONTEXT` (unit test).
- **Parser ADR-0011:** id lớp dựng lại từ mã môn (`EMA 3062 1` → `EMA3062 1`; mã khác thì fail closed qua `CONFLICTING_NORMALIZED_FIELDS`); `#` giữ nguyên ở cả parser và domain `normalizeCourseCode`, nên `AIT3003#` và `AIT3003` là hai môn khác nhau; sheet lớp hủy; `Ca a - b` = ca; độ phủ dòng; giới hạn `info` ở parser khớp loader.
- **Registration merge (C-09, M4):** buổi kiểu `OTHER` khớp mọi kiểu buổi theo ngày/tiết; nhóm lấy từ các buổi TKB khớp duy nhất; mặc định TH dùng kiểu buổi của TKB. Khớp ADR-0009 (10)–(12) và có test. Chưa review sâu phần privacy của adapter HTML (thuộc G3b / M4).
- **Pipeline:** artifact không bị ghi đè, `dataset check` phát hiện file lạ và hash sai, tên version theo ngày Việt Nam, quy tắc hai người có ghi exception.

## Kết hợp G3a/G3b

Cả ba cổng G3a R2 ([TEST-M3-002](M3-G3a-QA-REPORT-R2.md)), G3b R2 ([SEC-REVIEW-M3-002](M3-G3b-SECURITY-REVIEW-R2.md)) và G3c R2 (`REVIEW-M3-002`, báo cáo này) đã chạy độc lập trên cùng target bất biến `2ab03cd7385eb5eafd64251621158e45bed181ba`:

1. **Tóm tắt quyết định của G3a R2 và G3b R2:**
   - **G3a R2 (`TEST-M3-002`):** đề xuất **`qa-pass-with-follow-up`** — 0 S0/S1/S2 mở; mọi S1/S2 cũ trong phạm vi QA/Frontend (#1–#7, #22) đã `verified-fixed`; phát hiện 5 finding S3 mới (`QA-M3-101`…`105`) và giữ 2 mục S3 cũ ở mức `partially-fixed` (#10 `SEC-M3-003`, #19 `REV-M3-008`).
   - **G3b R2 (`SEC-REVIEW-M3-002`):** đề xuất **`security-pass-with-exception`** cho code web app M3 tại `2ab03cd`, nhưng **`security-no-go` cho G4b (mọi lần `import`/`validate`/`publish` dữ liệu thật)** cho tới khi `SEC-M3-102` (S2) được sửa hoặc `EXC-SEC-M3-R2-A` được Release Manager phê duyệt và thực hiện mitigation. Có 1 S2 mới (`SEC-M3-102`), 3 S3 mới (`SEC-M3-101`, `SEC-M3-103`, `SEC-M3-104`), và 4 S3 cũ ở mức `partially-fixed` (`SEC-M3-001`, `SEC-M3-003`, `SEC-M3-005`, `SEC-M3-006a`). Các exception R1 hết hạn ngày **2026-11-08**.
2. **Đối chiếu trùng lặp và giao thoa giữa ba báo cáo:**
   - **`REV-M3-102` (S2, G3c) = `SEC-M3-102` (S2, G3b) = `QA-M3-105` (S3, G3a):** cả ba agent độc lập phát hiện cùng một lỗ hổng thiết kế/triển khai ở `packages/parser/src/uet-xlsx-adapter.ts` (`formatFingerprint` chỉ tính các trường chuẩn) và `scripts/dataset.mjs` (báo cáo chỉ in tên trường chuẩn, cảnh báo `UNKNOWN_COLUMN` không kèm tên cột, và `--accept-new-format` cho phép người nạp vượt `hold`). G3c và G3a chứng minh rủi ro **integrity** (cột mới mang thông tin tuần như `"Tuần áp dụng" = "1-8"` bị đẩy vào `info`, buổi học vẫn nhận tuần mặc định `1..15` trong khi báo cáo ghi `format reviewed`); G3b chứng minh thêm rủi ro **privacy** (parser `ooxml.ts` không bỏ qua cột/hàng/sheet `hidden` và không có deny-list tiêu đề PII như SĐT/email giảng viên). Khi gộp ở cấp gate, đây là **1 lỗi S2 chung chặn cả G3c lẫn G4b của G3b**.
   - **`REV-M3-106` (S3, G3c) ↔ `SEC-M3-101` (S3, G3b):** cùng chỉ ra khoảng hở trong vòng đời `scripts/dataset.mjs` / `dataset-core.mjs`: `dataset check` không đối chiếu trạng thái trong `manifest.json` với `data/audit.jsonl`, quy tắc hai người có thể bị lách (khoảng trắng trong tên actor hoặc khi thiếu dòng `import` trong `audit.jsonl`), `publish` không ràng buộc actor, và trạng thái `retracted` không có lệnh khôi phục có audit để chạy drill G4b như ADR-0012 mô tả.
   - **`REV-M3-105` (S3, G3c) ↔ `SEC-M3-003` (S3, G3b) & `QA-M3-104` (S3, G3a):** cùng chỉ ra khoảng trống test tự động trong CI (`published.test.ts` chỉ kiểm `allowUnpublished: true` trên manifest đang rỗng, thiếu test trình duyệt khi cờ tắt trong CI, thiếu project WebKit trong CI).
   - **Các finding độc lập khác cần ghi nhận vào sổ chung (`EVID-M3-001`):**
     - Từ G3a R2: `QA-M3-101` (S3, thẻ lớp đang mở trên desktop giữ state nhóm cũ sau khi rebase xóa nhóm), `QA-M3-102` (S3, xóa dữ liệu rồi tiếp tục dùng ngay trong cùng trang không tải lại thì worker chưa đăng ký lại nên offline hỏng tới lần tải online sau), `QA-M3-103` (S3, cổng 4180 trong `playwright.config.ts` nằm trong dải TCP bị Windows loại trừ), `QA-M3-104` (S3, coverage E2E WebKit và bước `page.reload()` thừa trước `startPlan` trong test `REV-M3-002` gây kẹt worker `installing` 3/6 lần trên Playwright WebKit Windows).
     - Từ G3b R2: `SEC-M3-103` (S3 trên CLI M3 / giữ S2 cho `AUD-010` trong sổ audit M0–M2: DoS/OOM trong `ooxml.ts` qua `mergeCell` lớn hoặc chỉ số cột dài như `FXSHRXW2`), `SEC-M3-104` (S3, chèn dòng giả vào báo cáo Markdown qua ký tự xuống dòng trong tham số CLI, `dataset check` thiếu `isSafeRelativeUrl`, `site-data.mjs` copy toàn bộ `data/published` kể cả bản chưa công bố), cùng phần còn mở của `SEC-M3-001`, `SEC-M3-005`, `SEC-M3-006a`.
3. **Kết luận tổng hợp của G3c sau khi kết hợp G3a/G3b:**
   - Không có S0/S1 nào ở cả ba báo cáo.
   - Điều kiện thứ 3 trong mục Approval bên dưới ("Kết quả G3a/G3b R2 không có S0/S1 mới") **đã đạt**.
   - Quyết định của G3c giữ nguyên là **`review-no-go`** (chốt ở cấp agent role, chờ người xác nhận), do hai lỗi S2 về toàn vẹn dữ liệu trong đường parser/pipeline (`REV-M3-101` và `REV-M3-102` = `SEC-M3-102` = `QA-M3-105`). Kết luận này hoàn toàn nhất quán với điều kiện chặn G4b dữ liệu thật của G3b R2.

## Waivers and limitations

- **Waiver/exception:** none ở G3c. Không đề xuất exception cho REV-M3-101/102 vì ảnh hưởng trực tiếp tới integrity của lịch học (AGENT_WORKFLOW §3); lưu ý G3b có đề xuất `EXC-SEC-M3-R2-A` (quy trình Data Reviewer bỏ ẩn mọi cột/hàng/sheet và ghi danh sách nhãn `info` vào Decision log trước khi `validate`) cho khía cạnh privacy của `SEC-M3-102` nếu chưa kịp sửa code trước đợt nạp HK II. REV-M3-103…107 và REV-M3-008 là S2 process/S3, có thể thành follow-up nếu Release Manager ghi nhận owner, mitigation và hạn.
- **Limitations:**
  - Không có file TKB thật. Các kịch bản REV-M3-101/102 là chuỗi và header hợp lý, chưa được chứng minh là có trong dữ liệu UET thật.
  - G3c chỉ chạy e2e trên Chromium; phần chạy WebKit và probe trình duyệt bổ sung do G3a R2 và G3b R2 thực hiện.
  - G3c không tự kiểm host Cloudflare; G3b R2 đã kiểm header và framing trên preview host thật (`https://m3-web-app.xeptkb-63v.pages.dev`).
  - Probe REV-M3-001 gốc được G3a R2 dựng và chạy lại độc lập trên cả Chromium và WebKit (Probe B, 34/34 ×2).
  - Không review sâu adapter đăng ký HTML (M4) và `sw-client.ts` (#5, đã được G3a R2 kiểm 0/12 banner giả trên WebKit + cập nhật thật).
  - E2e chạy với cổng 4383 thay cho 4180 (thay đổi local, không commit) do Windows giữ dải cổng 4143–4242 (`QA-M3-103`).
- **File tạm:** worktree `…/scratchpad/g3c-r2/wt` (đã gỡ sau review), `probe-notes.mjs`, `probe-format.mjs`, log `check.log`/`e2e.log` trong `…/scratchpad/g3c-r2/`. Review không ghi gì vào repo ngoài báo cáo này.

## Approval and re-review

- **Reviewer decision actor/date/evidence:** một Claude agent đóng vai Independent Reviewer, **không phải sign-off của người**; 2026-11-05T17:05Z (chốt kết hợp G3a/G3b R2 lúc 2026-11-06T04:30Z); quyết định **`review-no-go`**; evidence là báo cáo này cùng [TEST-M3-002](M3-G3a-QA-REPORT-R2.md) và [SEC-REVIEW-M3-002](M3-G3b-SECURITY-REVIEW-R2.md). Cần Tech Lead hoặc Release Manager xác nhận.
- **Điều kiện để chuyển sang `review-pass-with-follow-up`** (phạm vi hẹp):
  1. Sửa REV-M3-101 và REV-M3-102 (= SEC-M3-102 = QA-M3-105) kèm test, **hoặc** Product/Tech Lead quyết định rõ cách giảm thiểu khiến mọi ghi chú có chữ "tuần" chưa hiểu hết và mọi header lạ (kể cả cột ẩn) đều hiện trong import report, CLI dừng cho tới khi Data Reviewer xác nhận (kết hợp với quy trình ở `EXC-SEC-M3-R2-A`). Ghi quyết định bằng ADR-0011 amendment.
  2. Có owner và hạn cho REV-M3-103…107, REV-M3-008, cùng các S3 của G3a (`QA-M3-101`…`104`) và G3b (`SEC-M3-101`, `103`, `104`, `001`, `003`, `005`, `006a`), được Release Manager ghi nhận (trước ngày **2026-11-08** cho các exception bảo mật).
  3. Kết quả G3a/G3b R2 không có S0/S1 mới — **đã thỏa mãn** (`TEST-M3-002` và `SEC-REVIEW-M3-002` đều có 0 S0/S1).
- **Next owner/action:**
  - Data Parser + Product (+ Data Reviewer): REV-M3-101, REV-M3-102 / SEC-M3-102 / QA-M3-105, SEC-M3-103.
  - Tech Lead + Release Manager: REV-M3-103 (cùng Product), REV-M3-106 / SEC-M3-101, REV-M3-107, SEC-M3-104, và phê duyệt exception G3b trước 2026-11-08.
  - Frontend/Coder: REV-M3-104, QA-M3-101, QA-M3-102, SEC-M3-001, SEC-M3-003, SEC-M3-005, SEC-M3-006a.
  - Tester (+ Frontend): REV-M3-105, REV-M3-008, QA-M3-103, QA-M3-104.
- **Fix commit/target:** pending.
- **Retest command/evidence:** `npm run check`, `npm run test:e2e`, `probe-notes.mjs` và `probe-format.mjs` (hoặc test tương đương trong repo), `npm run test:real` trên file TKB thật với import report liệt kê ghi chú/cột lạ.
- **Finding outcomes:**
  - REV-M3-001, 002, 003, 004, 005, 006, 007, 009, 010: `verified-fixed` (004 và 005 theo phạm vi cũ; phần mới tách thành REV-M3-104/107).
  - REV-M3-008: `partially-fixed` (still-open phần còn lại).
  - REV-M3-101…107: `open` (trong đó REV-M3-102 trùng với SEC-M3-102 và QA-M3-105).

## Evidence Envelope

- **Artifact ID / gate:** `REVIEW-M3-002` / `G3c`. Status `needs_review`, quyết định `review-no-go` (đã kết hợp G3a/G3b R2, chờ người xác nhận).
- **Source and traceability:** SPEC-M3-001 AC-M3-01…13; ADR-0009 (13)–(15); ADR-0010; ADR-0011; ADR-0012; DOMAIN_MODEL §3, §5, §6; PARSER_SPEC §4–§6; IMPLEMENTATION_PLAN Q-011…Q-013, C-02, C-08, C-10; [TEST-M3-002](M3-G3a-QA-REPORT-R2.md); [SEC-REVIEW-M3-002](M3-G3b-SECURITY-REVIEW-R2.md). P0 completeness claim: `no` (M4/M5 còn mở).
- **Immutable execution identity:**
  - base `4681c633af9344a7c541fa91bd45a8a9f4a904be`;
  - target `2ab03cd7385eb5eafd64251621158e45bed181ba` (tree `771f2ff9a639d4dfbc47b9450176e1fdecf42a55`);
  - khoảng soi kỹ từ `82cb85b0b5e2c25e88918ea8b309889562c688e6`;
  - CI [run 42069057252](https://github.com/hoangnguyen206/XepTKB/actions/runs/42069057252) success.
- **Toolchain:** Windows 10 Pro 19045, Node 22.22.2, npm 12.0.2, TypeScript 5.9.3, Playwright 1.64.0 (Chromium).
- **Exact commands + exit codes:** `npm ci` 0; `npm run check` 0 (node:test 94/94, Vitest 54/54, fixtures 6/6, dataset check OK với 0 dataset); `npm run test:e2e` 0 (17/17, cổng local 4383); probe ghi chú, probe định dạng, probe loader như trên; cộng kết quả chạy độc lập của G3a R2 và G3b R2 trên cùng commit `2ab03cd`.
- **Data and artefact integrity:** chỉ dữ liệu tổng hợp; `data/published` rỗng; không dùng file thật, không PII.
- **Risk and controls:** finding của G3c: REV-M3-101 (S2), 102 (S2, = SEC-M3-102 = QA-M3-105), 103 (S2 process), 104…107 (S3), REV-M3-008 (S3, partially-fixed); cộng các S3 của G3a (`QA-M3-101`…`104`) và G3b (`SEC-M3-101`, `103`, `104`, `001`, `003`, `005`, `006a`). Waiver ở G3c: none. Rollback: N/A (review không thay đổi code).
- **Decision and next step:** `review-no-go` tại `2ab03cd`; nâng lên **`review-approved` (về mặt kỹ thuật)** tại `d51c65b` (xem phụ lục R2.1 bên dưới). Bước tiếp theo: Product + Tech Lead + Release Manager thực hiện sign-off G0/G1 (`REV-M3-103`) và xác nhận bộ báo cáo G3 R2 trước khi mở G4a/G4b.

---

## Phụ lục R2.1 — Tái kiểm chứng hậu sửa lỗi tại `d51c65bc10f91ed7cd23462bdef901f5a81d5acc` (2026-11-06T05:33Z)

- **Target bất biến:** `d51c65bc10f91ed7cd23462bdef901f5a81d5acc` (`db0058c..d51c65b` trên nhánh `m3-web-app`).
- **Kết quả kiểm chứng độc lập cho từng finding của G3c:**
  - **`REV-M3-101` (S2):** **`verified-fixed`** — `packages/parser/src/weeks.ts:24-32,55-112` chỉ nhận `weekOrigin: "explicit"` khi mệnh đề tuần tiêu thụ trọn vẹn (`isCompleteClause`) và không còn từ `"tuần"` trong phần dư (ngoài cụm tần suất `N ca/M tuần`); 6/6 chuỗi đối kháng (`"Học tuần 1 đến tuần 8"`, `"Học tuần 9 đến hết"`, `"Học từ tuần 3 đến tuần 10"`, `"Tuần 1-8"`, `"Học tuần 1-5 (trừ tuần 3)"`, `"Nghỉ tuần 5"`) đều trả `weekOrigin: "parser-default"`, `[1..15]` và phát `UNPARSED_NOTE` kèm `rawValue`; `scripts/dataset.mjs` in bảng `Week notes ("tuần")` và mục checklist cho Data Reviewer.
  - **`REV-M3-102 = SEC-M3-102 = QA-M3-105` (S2):** **`verified-fixed`** — `uet-xlsx-adapter.ts` đưa `infoColumns` vào `formatFingerprint` + `ParseCoverage`, gắn `rawValue` cho `UNKNOWN_COLUMN`, chặn tiêu đề PII bằng `UNSUPPORTED_INPUT`; `ooxml.ts` bỏ qua sheet/cột/hàng `hidden`; `dataset.mjs` + `dataset-core.mjs` in bảng `Extra (info) columns` và bắt buộc Data Reviewer truyền `--accept-new-format "<reason>"` khi `validate`.
  - **`REV-M3-104` (S3):** **`verified-fixed`** — `loader.ts:182,186` bọc `.catch(() => undefined)` cho cả hai lệnh `options.cache.get(...)`; `controller.ts:63-70` bắt lỗi `loadDataset` và chuyển sang trạng thái `unavailable` có nút "Thử lại"; thêm unit test trong `loader.test.ts:103-113`.
  - **`REV-M3-105` (S3):** **`verified-fixed`** — `published.test.ts:46-133` kiểm tra cả `allowUnpublished: true` và `false`, đồng thời chạy round-trip `scripts/dataset.mjs import/validate/publish` → `loadDataset` trên workbook tổng hợp.
  - **`REV-M3-106` (S3):** **`verified-fixed`** — thêm lệnh `restore <version> --by <name> --reason <text>` (`retracted → validated`) trong `dataset-core.mjs` & `dataset.mjs`, đồng bộ với `DATA_INGESTION_RUNBOOK.md` §7/§12 và `ADR-0012` §2/§3; kiểm chứng bằng test round-trip trong `dataset-core.test.mjs:133-139`.
  - **`REV-M3-107` (S3):** **`verified-fixed`** — đã đồng bộ `ADR-0010` §4 + bảng Status, `DOMAIN_MODEL` §3, `IMPLEMENTATION_PLAN` (`C-11`), tên test `m3.spec.ts:94`, `M3-IMPLEMENTATION-HANDOFF.md` và `M3-EVIDENCE-ENVELOPE.md`.
  - **`REV-M3-008` (S3):** **`verified-fixed`** — đã bổ sung test tự động cho cảnh báo chuyển cơ sở trong ngày (`model.test.ts:42-53`, `App.test.tsx:142-162`) và đường bàn phím tới bước tải `.ics` (`m3.spec.ts:161-170`).
  - **`REV-M3-103` (S2 process):** **open (human gate action)** — việc ghi nhận actor/date của người cho G0 (`SPEC-M3-001`, `D-M3-1…4`, `C-02`, `C-08`) và G1 (`ADR-0009` amendment, `ADR-0010`, `ADR-0011`, `ADR-0012`) thuộc thẩm quyền của Product / Tech Lead / Data Reviewer trước khi mở G4a/G4b.
- **Kết hợp với G3a R2.1 và G3b R2.1 tại `d51c65b`:**
  - G3a R2.1: **`qa-pass`** (0 S0/S1/S2/S3 mở).
  - G3b R2.1: **`security-pass-with-exception`**, **gỡ bỏ `security-no-go` cho G4b** (0 S0/S1/S2 mở; 3 mục S3 phần dư nhẹ cho CI/G4a/M4).
  - **Quyết định G3c cập nhật tại `d51c65b`:** **`review-approved`** cho toàn bộ phần kỹ thuật (code, parser, pipeline, test, tài liệu), chờ người (Product / Tech Lead / Release Manager) ghi nhận `REV-M3-103` (G0/G1) và xác nhận báo cáo gate.
