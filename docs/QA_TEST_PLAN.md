# QA và test plan

> **Status:** draft / release gate  
> **Owner:** Tester  
> **Last reviewed:** 2026-10-19  
> **Related docs:** [PRD](PRD.md), [Parser spec](PARSER_SPEC.md), [Security](SECURITY_PRIVACY.md), [Implementation plan](IMPLEMENTATION_PLAN.md)

## 1. Mục tiêu

Chứng minh Kỳ Này đúng với dữ liệu UET biến thiên, an toàn với file cá nhân, dùng được ở mobile/desktop và có thể rollback khi trường sửa dữ liệu. Không coi coverage code là thay thế cho golden fixture và manual evidence.

## 2. Test pyramid

| Level | Nội dung | Tool/approach | Gate |
| --- | --- | --- | --- |
| Unit | normalize code/day/period/week, conflict, merge, GPA/date | Vitest | mỗi PR |
| Property/fuzz | range/Unicode/duplicate/malformed rows | fast-check | parser/domain PR |
| Golden parser | input metadata → expected summary/issues | fixtures, snapshots | parser change |
| Contract | artifact/API DTO/schema/error/RBAC | JSON schema + mock server | contract change |
| Component/UI | search/select/grid/day/warnings/export states | Testing Library | feature PR |
| E2E | onboarding → choose → export → local import | Playwright | release candidate |
| Accessibility | keyboard, focus, labels, contrast, touch | axe + manual | UI gate |
| PWA/offline | cache/update/stale/offline Plan | Playwright/browser | release |
| Security | PII network, XSS/file, auth/RLS, secret scan | automated + manual | blocking |
| Performance | parse/search/render/bundle/mobile | scripted budget | release |

## 3. Fixture policy

- Raw files thật chỉ nằm trong secure local/admin fixture store nếu được phép; repo/CI dùng redacted or synthetic fixture.
- Mỗi fixture manifest ghi source family, schema version, expected counts, issue codes, hash; không ghi tên/mã SV.
- Khi source document chưa được phép commit, tạo minimized synthetic reproducer giữ đúng lỗi format.
- Thay đổi expected output phải có reason/reviewer, không update snapshot để làm xanh test mù.

## 4. UET source matrix

| Source family | Test focus | Expected gate |
| --- | --- | --- |
| TKB HK I 2026–2027 `.xlsx` | header row 1, 17 col, 1,025 sections, aliases, T7 | count/valid sessions + no blocker |
| TKB HK II official `.xlsx` | header row 4, 18 col, merged cells/PCGD | fill-down/section grouping |
| TKB HK II planned `.pdf` | repeated page header, 17 col, content difference | adapter fixture or explicit P2 block |
| Registration result `.doc` HTML | PII fields, 7 classes, multi-day, 3 room changes | local-only + override |
| Exam planned PDF | date/time/room/merged cells | P1 fixture/quality report |
| Exam official round 1 PDF | official date differences | diff/status |
| Exam official round 2 PDF | larger set, match misses | unmatched warning, no false match |
| Summer exam PDF | same template, different term | schema/reuse |
| Study plan PDF | cohort week 1, typo later rows | week1-only rule |
| Time-frame image/config | periods, breaks, shifts | config/golden time mapping |

Số lượng nêu trong brief là sanity signal, không được hard-code làm pass condition nếu source/version khác; fixture manifest phải là authority cho từng version.

## 5. Critical test cases

### Domain

- same day/overlap period/overlap week → hard conflict;
- same period but disjoint weeks → no conflict;
- adjacent periods (3 and 4) → no overlap;
- ONL/no fixed time → no grid conflict, list warning;
- group `CL` vs numbered group; duplicate section rows;
- Saturday support, Sunday config extension;
- week 1 cohort vs manual override; date across timezone/DST assumptions;
- campus transition warning vs hard conflict;
- old TKB + newer registration room/time precedence.

### Parser

- header row 1/4, unknown column, synonym typo;
- merged cells and inserted subtotal/heading rows;
- `Ca 1`, `1-2`, `1 - 2`, `Sáng/Chiều`, note period override;
- weeks range/list/from/date and no-week default;
- code whitespace/prefix/asterisk;
- lecturer `+`, temporary lecturer, room/campus patterns;
- malformed file, huge file, deceptive extension, invalid Unicode;
- ambiguous note must not auto-publish.

### Privacy/security

- intercept browser requests while importing `.doc`: no bytes/PII;
- PII never in console/Sentry/analytics/export unless explicitly required;
- malicious HTML/XSS strings displayed as text;
- file size/type limits and parser crash containment;
- anonymous cannot admin publish; share token expiry/revoke;
- secrets absent from bundle/source map/log.

### UI/PWA/export

- 360px portrait/no page horizontal overflow; 768/1200 breakpoints;
- keyboard-only selection and focus; screen-reader labels for conflict;
- offline Plan view/export; stale dataset indicator;
- ICS import in at least one supported calendar; event dates/weeks correct;
- PNG/Word legible with source/version, no unneeded PII.

## 6. Performance budgets (initial proposals)

- app shell first useful paint on representative mobile: measure and baseline before hard target;
- search after index ready: p95 <100ms for UET dataset on target device;
- conflict evaluation for typical Plan: p95 <50ms;
- parsing registration sample: no UI freeze >100ms per chunk; use worker/chunk if needed;
- initial JS and lazy parser budgets documented after first bundle measurement.

Budgets are proposed; a failing measurement opens a performance issue, not silent relaxation.

## 7. Canonical release gates và crosswalk

Dự án dùng **một namespace gate canonical** trong [Agent workflow](../.claude/AGENT_WORKFLOW.md). `P0/P1/P2` là **product priority**; `S0–S3` là **defect severity** — đây là hai trục độc lập. Mọi P0 đã commit phải có coverage/evidence; mọi S0/S1 block release; S2/S3 chỉ được chấp thuận khi có owner, mitigation và due/expiry.

| Canonical gate | Ý nghĩa / entry | Required evidence | Approver / exit |
| --- | --- | --- | --- |
| G0 | Scope/spec, PRD, source refs, non-goals | requirement/AC/P0 traceability, source version/hash | Product → `g0-approved` |
| G1 | Design/contracts, schema/API/domain, fixture semantics | design handoff, data-flow/privacy, migration/rollback, test plan; Security approval bắt buộc nếu boundary mới; Data Parser tạo fixture, Data Reviewer validate | Tech Lead → `g1-approved` |
| G2 | Implementation complete | immutable commit/PR/build, changed files, tests, hashes | Tech Lead readiness → `g2-ready-for-verification` |
| G3a | QA verification | run IDs/commands/exit codes, all-P0 matrix, fixture/device evidence | Tester → `qa-pass`/`qa-no-go` |
| G3b | Security/privacy verification | threat/data-flow, network/log/secret/dependency evidence, exception | Security → `security-pass`/`security-no-go` |
| G3c | Independent review | diff IDs, unique findings, repro/evidence, decision | Reviewer → `review-pass`/`review-no-go` |
| G4a | App release | compatibility, canary, monitoring, rollback drill, changelog | Release Manager → `app-released` |
| G4b | Dataset publish | source/output/manifest hashes, diff, data review, two-person first publish, rollback | Release Manager → `dataset-published` |
| G5 | Post-release closeout | monitoring window, incidents, follow-ups, docs/continuity handoff | Release Manager + Product → `closed` |

G3a/G3b/G3c có thể chạy song song **sau G2**, nhưng cả ba đều bắt buộc trước G4a/G4b; exception phải time-bound và không thể dùng cho S0/S1. G4a và G4b là hai quyết định riêng nhưng phải kiểm tra app↔dataset compatibility. Contract/schema/privacy/parser/data change phải reopen gate sớm nhất bị ảnh hưởng.

### Crosswalk các nhãn cũ

| Nhãn cũ trong tài liệu/notes | Cách hiểu canonical |
| --- | --- |
| QA `G0 docs/contract` | G0 + G1 (không còn dùng làm gate ID) |
| QA `G1 data` | G1 data design + G2 parser implementation + G3a data verification + G4b publication evidence |
| QA `G2 domain` | G2 + G3a |
| QA `G3 UX` | G3a |
| QA `G4 privacy` | G3b |
| QA `G5 ops` | G4a/G4b operational readiness + G5 monitoring/rollback |
| QA `G6 release` | G4a + G4b + G5 |
| Implementation `G2/G3/G4/G5/G6` | thay bằng canonical gate ở trên theo traceability row |

Bảng cũ không phải authority; khi ghi report mới chỉ dùng `G0/G1/G2/G3a/G3b/G3c/G4a/G4b/G5`.

## 8. Defect severity

- **S0 blocker:** PII/credential leak, corrupted/publicly wrong dataset, data loss, security exploit.
- **S1 critical:** core xếp lịch unusable, false-negative conflict, export dates wrong, admin cannot rollback.
- **S2 major:** important edge case with workaround, accessibility major issue, stale indicator missing.
- **S3 minor:** copy/visual issue with no data impact.

S0/S1 block release. S2/S3 chỉ được `pass-with-follow-up` khi có risk acceptance, owner, mitigation và due/expiry. Đây là quy tắc severity, không thay thế việc mọi P0 committed phải có coverage.

## 9. Test report output

Mỗi run ghi commit/build, dataset/parser version, browser/device, test command, pass/fail/skip, evidence links, known limitations, severity and release recommendation theo `.claude/templates/TEST_REPORT_TEMPLATE.md`.
