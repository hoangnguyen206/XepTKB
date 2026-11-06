# C-09 — registration sample review and redacted fixture

> **Artifact ID:** `REVIEW-C09-001`
> **Artifact status:** `ready-for-verification` — Data Reviewer and Security acknowledgement pending
> **Canonical gate/sub-gate:** `G1` (parser contract for `vnu-registration-html`) + `G2` (adapter 0.2.0, domain merge change)
> **Owner:** Data Parser
> **Last reviewed:** 2026-10-29
> **Related docs:** [Parser spec §7](../PARSER_SPEC.md), [Fixture policy](M0-FIXTURE-POLICY.md), [ADR-0008 amendment 2026-10-29](../adr/ADR-0008-m1-parser-dependencies-local-provenance.md), [ADR-0009 amendment 2026-10-29](../adr/ADR-0009-m2-domain-engine-schema.md), [Audit M0–M2 AUD-002](M0-M2-AUDIT-2026-10-25.md), [Implementation plan §10 C-09](../IMPLEMENTATION_PLAN.md), [Security & privacy](../SECURITY_PRIVACY.md)
> **Evidence envelope:** this file (source, method, commands, results, residual risk); M3 code evidence stays in [EVID-M3-001](M3-EVIDENCE-ENVELOPE.md)
> **Decision actor / UTC timestamp:** Claude Code agent acting as Data Parser on the owner's request, 2026-10-29 — not an independent Data Reviewer sign-off

## Source

- One real export of the student portal's "kết quả đăng ký môn học", HK I 2026–2027, supplied by the owner (the data subject) on 2026-10-29.
- The raw file stays outside the repository. A copy the owner placed in the repository root was not tracked; `.gitignore` now blocks `ket-qua-dang-ky*`, `/*.doc`, `/*.htm` and `/*.html`. The raw bytes, their hash and every identity value are not recorded here or in any committed file.
- Size class: under 16 KB, valid UTF-8, no declared charset.

## Method (no personal value printed)

1. Inspection scripts ran locally from a scratch directory outside the repository. They printed tag structure, column headers, labels and the schedule vocabulary only; every other value was reduced to a character shape (`A`/`a`/`9`), so name, birth date, student id, programme, cohort and fees never reached a console or log.
2. The fixture was produced by replacing all 56 value tokens of the real markup (identity, programme, cohort, print date, fees, course codes, course names, section codes, days, periods, rooms, signature) with synthetic values. The school names in the letterhead were replaced too. Markup, inline styles, numeric entities, `&nbsp;` cell prefixes, the Word `<xml>` block and the portal's wrong `<title>` were kept.
3. An automatic check compared the output with every replaced original value and with each identity word of three letters or more; only shared vocabulary may remain (a single standard period range such as `1 - 3`). Result: pass.
4. The complete text and attribute list of the fixture were then read in full before commit: only synthetic values, column labels, the status `Đăng ký lần đầu` and generic letterhead text remain. No comment, author or document-property metadata exists in the source.

Days, periods and rooms were changed as well, because course codes plus day/period/room could be matched against the public timetable to recover the student's section set (an indirect identifier).

## Format findings

| Finding | Effect on adapter 0.1.0 | Resolution (0.2.0) |
| --- | --- | --- |
| Headers are `STT, Mã môn học, Môn học, Số tín chỉ, Trạng thái, Học phí, Lớp môn học, Thứ, Tiết, Giảng đường` | `Mã môn học`/`Lớp môn học` unknown → `MISSING_REQUIRED_COLUMN`, **0 sections from a real file** | synonyms `ma mon hoc`, `lop mon hoc`, `mon hoc` |
| A row with two days lists one period range per day in the same order (`T2,T6` + `4 - 6,1 - 3`) | Cartesian product: 4 sessions, 2 of them nonexistent (AUD-002, S1) | zip by position; one day or one range is shared; any other count mismatch → row skipped with `REGISTRATION_OVERRIDE_UNMATCHED` (`field=periodText`) |
| Rooms of such a row are concatenated with no separator (`301-B306-B`) | one room string for both sessions | split only when exactly one segmentation into room tokens `ddd-X…` exists (or an explicit separator gives the right count); otherwise rooms are left to the timetable with a `field=room` warning |
| Course code can contain a space (`AAA 9999`, section `AAA 9999 9`) | non-canonical section id | section id rebuilt from the normalized course code (`AAA9999 9`) |
| No session-kind and no group column | every session `OTHER`; domain match filtered on kind → nothing matched | domain matches `OTHER` sessions by day/periods and takes the group of the uniquely matched timetable sessions (ADR-0009 amendment) |
| `Tổng` summary row with credits and fees | spurious `REGISTRATION_OVERRIDE_UNMATCHED` | rows with neither course nor section are skipped |
| Status column, one value seen: `Đăng ký lần đầu` | not read | not read; see residual risk |
| Identity table (`Họ và tên`, `Ngày sinh`, `Mã sinh viên`, `Chương trình đào tạo`, `Khóa`) and the name again in the signature block | not extracted | not extracted; test asserts the fixture's identity strings never reach the parse result |

## Commands and results

| Command | Result |
| --- | --- |
| adapter 0.1.0 on the real file (counts only) | 0 sections; `MISSING_REQUIRED_COLUMN` (courseCode, sectionId) |
| adapter 0.2.0 on the real file (counts only) | 7 sections, 9 sessions (2,1,1,1,1,2,1), 9/9 rooms split, canonical ids, 0 issues |
| adapter 0.2.0 on `fixtures/redacted-registration/portal-format.doc` | 7 sections, 9 sessions, 0 issues (same shape as the real file) |
| `npm run check` (2026-10-29, Windows, Node 22.22.2) | exit 0: node:test 84/84 (4 new registration/merge tests), Vitest 43/43, fixtures 6/6 (new `registration-portal-format-redacted`; `registration-local-synthetic` now 3 sessions instead of 5); CI run of the commit is linked from PR #1 |

## Residual risk and open items

- One sample, one student, one term. Other portal states (retake `Đăng ký học lại`, cancelled rows, online classes, a row with three days) are not observed. The adapter does not filter on `Trạng thái`; if the portal can list cancelled rows, they would be merged. Owner: Data Parser; ask for a second sample before M4 G3a.
- Room tokens seen are `ddd-X`. Other UET room shapes (for example lab names) in a multi-day row fall back to timetable rooms with a warning, which is fail-closed but loses the registration room.
- When the registration time differs from the timetable and the section has several sessions, a kind-less portal row cannot be paired (no kind to narrow by) and is reported `REGISTRATION_OVERRIDE_UNMATCHED`/`_AMBIGUOUS` instead of overriding. Acceptable for M4 if the UI shows the warning (FR-06 unmatched flow).
- The `uet-xlsx` adapter would still emit a non-canonical id for a timetable section written `AAA 9999 9`; no real timetable sample confirms how such codes appear there.
- This review is by the implementing agent. Data Reviewer must independently confirm the redaction before the fixture counts as `redacted` evidence for a gate; Security should confirm the `.gitignore` guard.
