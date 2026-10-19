# Review report template

# Review — <PR/artefact>

> **Artifact ID:** `REVIEW-XXX`  
> **Artifact status:** `draft | needs_review | approved | blocked | superseded`  
> **Canonical gate:** `G3c`  
> **Owner:** Independent Reviewer  
> **Last reviewed:** YYYY-MM-DD  
> **Related docs:**  
> **Evidence envelope:** `EVID-XXX`  
> **Independent reviewer / approval UTC timestamp:**

## Scope and identity

- Review type: correctness / parser / architecture / security-adjacent / maintainability
- Source spec/ADR/PRD + versions:
- Base commit/diff ID:
- Target commit/PR/build ID:
- Dataset/parser/schema/fixture versions:
- Tested commands/tool/run IDs/exit codes:
- Requirement/AC/P0 coverage:

## Verdict

`review-pass | review-pass-with-follow-up | review-no-go`

## Structured checks

| Check | Expected | Actual/evidence | Result |
| --- | --- | --- | --- |
| Correctness/domain invariants | contract holds |  | pass/fail/NA |
| Parser/data provenance | deterministic/traceable |  | pass/fail/NA |
| Scope/contract/migration | no silent drift |  | pass/fail/NA |
| Privacy/security boundary | no unsafe crossing |  | pass/fail/NA |
| Performance/maintainability | thresholds/design |  | pass/fail/NA |
| Tests/docs/observability | evidence complete |  | pass/fail/NA |

## Findings

> Chỉ ghi finding có evidence hoặc failure scenario cụ thể. Xếp severity cao nhất trước.

### `REV-XXX` — [S0/S1/S2/S3] `<short summary>`

- **File/line/artefact:**
- **Failure scenario:**
- **Expected / actual:**
- **Impact:**
- **Evidence/repro/run ID:**
- **Recommended fix:**
- **Owner / status / due:**

## Waivers and limitations

- Waiver/exception: scope, mitigation, owner, expiry, approving actor/date (or `none`).
- Limitations: fixture thiếu, code chưa chạy, environment, scope chưa review.
- S0/S1 không được waive; S2/S3 phải có risk acceptance.

## Approval and re-review

- Reviewer decision actor/date/evidence:
- Next owner/action:
- Fix commit/target:
- Retest command/evidence:
- Finding outcomes: `fixed | still-open | superseded-with-reason`.
