# Agent team workflow

> **Status:** draft / not operational until gates are approved  
> **Owner:** Tech Lead  
> **Last reviewed:** 2026-10-20
> **Related docs:** [root CLAUDE.md](../CLAUDE.md), [Documentation index](../docs/README.md), [Implementation plan](../docs/IMPLEMENTATION_PLAN.md), [QA plan](../docs/QA_TEST_PLAN.md), [Evidence envelope](templates/EVIDENCE_ENVELOPE.md)

## 1. Mục tiêu và trạng thái hiện tại

Đây là protocol làm việc cho đội Agent xây Kỳ Này. Agent không thay thế quyết định của Product, Tech Lead, Security hoặc Release Manager; mỗi role có boundary, artefact và gate rõ ràng.

Workspace hiện có M0–M2 foundation/parser/domain packages và local test/fixture evidence; chưa có mã nguồn ứng dụng web/PWA, deploy, dataset publish hoặc release evidence. Không được dùng tài liệu này để ngụ ý rằng G0–G5 đã đạt.

Protocol này dùng một namespace gate duy nhất. Những bảng cũ ghi `QA G0–G6` hoặc `phase gate` phải được đọc theo [crosswalk](../docs/QA_TEST_PLAN.md#7-canonical-release-gates-và-crosswalk), không tạo thêm nghĩa mới.

## 2. Canonical lifecycle và gate matrix

```text
G0 Scope/spec
  → G1 Design/contracts
  → G2 Implementation complete
  → G3a QA verification ┐
  → G3b Security/privacy ├─ chạy song song sau G2; cả ba bắt buộc
  → G3c Independent review ┘
  → G4a App release and G4b Dataset publish (coordinated, separate decisions)
  → G5 Post-release / closeout
```

Các sketch/design có thể chạy song song trước G1, nhưng chỉ là `draft`; không được freeze contract hoặc bắt đầu implementation dựa trên sketch chưa được G1 approve.

| Gate | Entry artifacts | Required evidence | Approver/accountable | Exit status | Re-open trigger |
| --- | --- | --- | --- | --- | --- |
| **G0 — Scope/spec** | brief/source, PRD/spec, non-goals, P0 IDs | source ref + hash, requirement traceability, acceptance/NFR, Product decision | Product | `g0-approved` hoặc `g0-blocked` | scope/P0/persona/acceptance đổi |
| **G1 — Design/contracts** | G0-approved spec, ADR/design, domain/API/schema, fixtures | design handoff, schema/version, data-flow/privacy impact, migration/rollback, test plan; **Security approval bắt buộc nếu mở boundary PII/vendor/auth/external**; Data Parser chỉ chuẩn bị fixture/provenance | Tech Lead; Security approval for new boundary; independent Data Reviewer validates fixture/provenance when applicable | `g1-approved` hoặc `g1-blocked` | contract/schema/privacy/parser rule/fixture semantics đổi |
| **G2 — Implementation** | G1-approved contracts + implementation handoff | immutable commit/PR/build, changed files, tests, fixture/output hashes, known gaps | Implementer responsible; Tech Lead accepts readiness | `g2-ready-for-verification` hoặc `g2-blocked` | implementation changes after handoff, contract drift |
| **G3a — QA** | G2 evidence/build | test run IDs/commands/exit codes, P0 completeness, fixture/device matrix, findings | Tester | `qa-pass`, `qa-pass-with-follow-up`, hoặc `qa-no-go` | code/data/fixture/test changes affecting coverage |
| **G3b — Security/privacy** | G1 design approval (including boundary review) + G2 implementation evidence | threat/data-flow checks, network/log evidence, dependency/secret checks, exceptions; verify that approved G1 controls are implemented | Security Reviewer | `security-pass`, `security-pass-with-exception`, hoặc `security-no-go` | any boundary/data/vendor/auth/privacy change |
| **G3c — Independent review** | G2 evidence + frozen source/contract; final decision must record relevant G3a/G3b findings | diff/base/target IDs, finding IDs, repro/evidence, review decision | Independent Reviewer | `review-pass`, `review-pass-with-follow-up`, hoặc `review-no-go` | code/contract changes or unresolved finding |
| **G4a — App release** | G3a/b/c required pass/approved exceptions | release report, app↔dataset compatibility, canary, monitoring window, rollback drill/target, changelog | Release Manager | `app-released` hoặc `app-no-go` | rollback/monitoring failure, bad deploy, incompatible dataset |
| **G4b — Dataset publish** | validated candidate + G1 parser contract + G3 evidence where applicable | source SHA, normalized artifact/manifest hashes, diff, **independent Data Reviewer validation**, two-person first-publish approval, rollback target | Release Manager is accountable; Data Parser produces; Data Reviewer validates; Security sign-off when applicable | `dataset-published` hoặc `dataset-no-go` | source/parser/config/fixture drift or bad artifact |
| **G5 — Post-release** | G4a/b decision, monitoring window | post-release report, metrics/errors, incident/follow-up, docs/retro, ownership handoff | Release Manager + Product | `closed` hoặc `follow-up-open` | incident, newly found S0/S1, incomplete follow-up |

**No-skip rule:** G4a/G4b không được đạt nếu bất kỳ G3a/G3b/G3c nào là `no-go`, thiếu evidence bắt buộc, hoặc exception không có owner + expiry + mitigation. S0/S1 luôn là no-go. G4a và G4b có thể được thực hiện theo thứ tự khác nhau, nhưng mỗi quyết định phải xác nhận compatibility với version còn lại; không gọi release hoàn tất nếu dependency tương ứng chưa được publish/approved.

## 3. Gate decision và state machine

Phân biệt ba thứ sau:

1. **Artifact status:** trạng thái tài liệu/code/data candidate (`draft`, `ready`, `in_progress`, `needs_review`, `blocked`, `superseded`, `archived`).
2. **Gate decision:** kết quả của gate canonical (`g0-approved`, `g1-approved`, `g2-ready-for-verification`, `qa-pass`, `security-pass`, `review-pass`, `app-released`, `dataset-published`, `closed`).
3. **Recommendation:** lời khuyên role-specific (`ready-for-test`, `ready-for-review`, `request-changes`, `go`, `no-go`, `follow-up-open`). Không dùng `done` hoặc `approved` một mình để thay cho gate decision.

Mọi transition phải ghi `actor`, UTC timestamp, evidence IDs, decision và next owner. `blocked` không phải trạng thái chờ chung chung: phải có blocker, impact và điều kiện gỡ.

### Mapping role decision

| Role/report | Pass mapping | Block mapping |
| --- | --- | --- |
| Product Spec | `g0-approved` | `g0-blocked` |
| Design/Tech Lead | `g1-approved` | `g1-blocked` |
| Coder/Frontend/Data Parser | `g2-ready-for-verification` | `g2-blocked` |
| Tester | `qa-pass` / `qa-pass-with-follow-up` | `qa-no-go` |
| Security Reviewer | `security-pass` / time-bound exception | `security-no-go` |
| Reviewer | `review-pass` / `review-pass-with-follow-up` | `review-no-go` |
| Release Manager | `app-released`, `dataset-published`, `closed` | corresponding `*-no-go` / `follow-up-open` |

A `pass-with-follow-up` chỉ được chuyển tiếp nếu follow-up là S2/S3, có owner/date, không ảnh hưởng P0/privacy/integrity và được Release Manager ghi nhận. Không dùng exception để hợp thức hóa S0/S1.

## 4. Shared evidence envelope

Mọi spec, ADR, implementation handoff, test report, review report, import report và release report phải có hoặc link tới [EVIDENCE_ENVELOPE.md](templates/EVIDENCE_ENVELOPE.md), gồm tối thiểu:

- task/artefact ID và canonical gate/sub-gate;
- source docs, section, version hoặc SHA-256;
- immutable commit/PR/diff/build/test/import run IDs;
- exact commands, tool versions, exit codes và evidence links;
- requirement/AC/P0 traceability và completeness claim;
- fixture manifest/hash, source hash và output/artifact/manifest hash nếu có;
- changed files/contracts/schema và compatibility/migration;
- privacy/security impact, data boundary và sign-off;
- findings, waivers/exceptions (owner, mitigation, expiry);
- rollback/monitoring/canary evidence;
- decision, actor, UTC timestamp, next owner và receiving acknowledgement.

Evidence không chứa raw PII, secret, credential hoặc raw registration file. Dùng synthetic fixture IDs, row/page numbers và redacted values; không dùng hash trần của họ tên/mã sinh viên/ngày sinh vì vẫn có thể link hoặc brute-force ra danh tính. Chỉ dùng keyed digest đã được Security phê duyệt, có retention/access control, khi thật sự cần đối chiếu. Nếu chưa có app code/run ID, ghi `N/A — docs-only` cùng lý do; không điền giả.

## 5. Parallelization và dependency

Có thể chạy song song:

- Product Spec refine acceptance và Tech Lead sketch architecture trước G1;
- Coder domain và Frontend UI mock sau khi contract G1 đã frozen;
- G3a, G3b, G3c sau G2, vì mỗi role có evidence/input độc lập;
- review các module không chạm cùng contract.

Phải chạy nối tiếp:

- G0 trước G1; G1 trước code/data implementation;
- parser rule trước golden expected update;
- G2 trước verification gates;
- G3a + G3b + G3c trước G4a/G4b;
- compatibility/canary trước app release hoặc dataset publish tương ứng.

Không cho hai Agent ghi cùng một contract/file đồng thời. Nếu conflict, giữ bản hiện hành, chuyển task `blocked`, để Tech Lead quyết định bằng ADR.

## 6. Re-entry rules

Thay đổi sau khi gate đã đạt phải mở lại gate sớm nhất bị ảnh hưởng:

- scope/P0/acceptance → reopen G0 và toàn bộ downstream;
- domain/API/schema/architecture → reopen G1, G2 và các test/review liên quan;
- parser rule/synonym/fixture semantics → reopen G1, G2, G3a và G4b;
- privacy/data boundary/vendor/auth → reopen G1, G3b và mọi release liên quan;
- code/build/UI → reopen G2 và G3a/G3c; G3b nếu boundary đổi;
- source artifact/version → reopen G4b và compatibility check G4a;
- production incident/S0/S1 → reopen G5, có thể retract G4a/G4b.

Không chỉ sửa report cũ; phải tạo evidence/run mới và link superseded decision.

## 7. RACI cho MVP

- **Data Parser:** produces parser output, fixture/provenance report, diff và artifact manifest; không approve candidate của chính mình.
- **Data Reviewer:** độc lập xác nhận raw-vs-normalized, counts, drift, provenance và first-publish/new-parser evidence; có thể được chỉ định theo từng import, nhưng không được là người tạo candidate.

| Deliverable/gate | Product | Tech Lead | Data Parser | Data Reviewer | Coder/FE | Tester | Security | Reviewer | Release |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G0 scope/spec | **A/R** | C | C | C | I | C | C | I | I |
| G1 design/contracts | C | **A** | R nếu data | R validation nếu data | C | C | **R/approval nếu boundary** | I | I |
| G2 implementation readiness | I | **A** | R theo module | C | **R** | C | C | I | I |
| G3a QA | I | C | C | C | C | **A/R** | C | I | C |
| G3b security/privacy | I | C | C | C | C | C | **A/R** | C | I |
| G3c independent review | I | C | C | C | I | C | C | **A/R** | I |
| G4a app release | C | C | I | I | C | C | C | C | **A/R** |
| G4b dataset publish | I | C | **R (producer)** | **R validation** | C | C | **C/required** | I | **A** |
| G5 post-release/continuity | C | C | R | C | I | C | C | I | **A/R** |

A = accountable, R = responsible, C = consulted, I = informed. Release Manager là một accountable duy nhất cho quyết định publish/release; first publish dataset cần thêm hai người phê duyệt theo policy, nhưng không tạo thêm A.

## 8. Handoff protocol

Mỗi Agent trả artefact theo template phù hợp và một evidence envelope chung. Handoff tối thiểu phải nêu source/versions, gate, change set, acceptance mapping, test/evidence, privacy/security, risk/rollback, decision, next owner và acknowledgement.

Người nhận phải xác nhận `accepted` hoặc `blocked` bằng actor/time/evidence; im lặng không được coi là sign-off. Handoff không được ghi “done” nếu chưa có gate decision tương ứng.

## 9. Escalation và stop conditions

Escalate Tech Lead + Security ngay nếu có PII/credential/raw file qua boundary mới, parser phải đoán dữ liệu, LLM output chưa validate, breaking contract, dataset drift, secret leak, XSS/SSRF hoặc sai conflict/date.

Escalate Product nếu scope/P0/mốc thay đổi. Escalate Release Manager nếu rollback, ownership, monitoring hoặc dataset approval chưa sẵn.

Agent phải dừng `blocked` khi thiếu source/fixture, acceptance mâu thuẫn, privacy risk, version/precedence chưa rõ hoặc test fail liên quan contract mà không có owner. Không xóa test, nới validator, tắt security check hay fake evidence để đi tiếp.

## 10. Artefact index

- Scope/spec: `.claude/templates/SPEC_TEMPLATE.md`.
- Design: `.claude/templates/DESIGN_HANDOFF.md` và `.claude/templates/ADR_TEMPLATE.md`.
- Shared evidence: `.claude/templates/EVIDENCE_ENVELOPE.md`.
- Implementation: `.claude/templates/IMPLEMENTATION_HANDOFF.md`.
- Test: `.claude/templates/TEST_REPORT_TEMPLATE.md`.
- Security: `.claude/templates/SECURITY_REVIEW_REPORT.md`.
- Review: `.claude/templates/REVIEW_REPORT_TEMPLATE.md`.
- Import: `.claude/templates/DATA_IMPORT_REPORT.md`.
- Release/post-release: `.claude/templates/RELEASE_REPORT.md`.

## 11. Canonical review/release decisions

- `request-changes`: thiếu correctness/evidence hoặc có lỗi cần sửa; không được promote.
- `no-go`: gate blocker, S0/S1, hoặc evidence bắt buộc thiếu.
- `pass-with-follow-up`: chỉ S2/S3 được chấp thuận, có owner/date/mitigation.
- `go`: tất cả gate prerequisites đạt và release checklist đầy đủ.
- `follow-up-open`: release đã chạy nhưng G5 còn action có owner/date; không gọi là close.

Tech Lead/Product/Release Manager không được biến `request-changes`/`no-go` thành `go` vì gần deadline. Exception bắt buộc phải là decision có phạm vi, mitigation, owner, expiry và sign-off đúng role.

## 12. Prompt khởi tạo Agent

```text
Bạn là <ROLE>. Đọc CLAUDE.md, docs/README.md, PRD và role contract của bạn.
Task: <ID + outcome>.
Canonical gate: <G0|G1|G2|G3a|G3b|G3c|G4a|G4b|G5>.
In scope: <...>. Out of scope: <...>.
Source of truth + version/hash: <...>.
Acceptance criteria: <Given/When/Then>.
Không sửa contract ngoài scope. Không sử dụng PII/secret thật.
Trả về template tương ứng + Evidence Envelope; ghi command/exit code/run ID trung thực.
```

## 13. Definition of Done chung

- artefact đúng role, metadata và source links đầy đủ;
- evidence envelope hoàn chỉnh hoặc ghi `N/A — docs-only` có lý do;
- requirement/P0 traceability và tests/evidence đã cập nhật;
- không có S0/S1; exception có owner/expiry/mitigation;
- downstream re-entry đã thực hiện khi contract/data/privacy đổi;
- receiving owner acknowledgement và canonical gate decision đã ghi.
