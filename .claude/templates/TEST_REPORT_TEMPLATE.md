# Test report template

# Test report — <build/feature>

> **Artifact ID:** `TEST-XXX`  
> **Artifact status:** `draft | needs_review | approved | blocked | superseded`  
> **Canonical gate:** `G3a`  
> **Owner:** Tester  
> **Last reviewed:** YYYY-MM-DD  
> **Related docs:**  
> **Evidence envelope:** `EVID-XXX`  
> **Tester sign-off actor / UTC timestamp:**

## Scope and immutable identity

- Source spec/PRD/ADR + versions:
- Base/target commit/build/diff:
- Dataset/parser/schema version:
- Fixture manifest + hash:
- Environment/device/browser:
- Runner/tool versions:
- Test run IDs/links:
- Exact commands + exit codes:
- Requirement/AC/P0 coverage: all committed P0 covered? `yes | no | N/A — docs-only`

## Scope and risk focus

- Features/requirements:
- Highest-risk scenarios:
- Out of scope:

## Commands and summary

| Suite/command | Tool/run ID | Exit code | Result | Count | Evidence link |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Requirement/AC matrix

| Requirement/AC/P0 | Test case | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Quality checks

| Area | Expected/control | Actual/evidence | Result |
| --- | --- | --- | --- |
| Privacy/network/log/Sentry | no PII/raw registration |  | pass/fail/NA |
| Security/auth/RBAC/share/file | controls enforced |  | pass/fail/NA |
| Accessibility/keyboard/contrast | no blocking issue |  | pass/fail/NA |
| Responsive/mobile/desktop | supported viewports usable |  | pass/fail/NA |
| Offline/cache/update | safe stale/fallback |  | pass/fail/NA |
| Export/calendar | correct dates/content |  | pass/fail/NA |
| Performance budgets | thresholds in spec |  | pass/fail/NA |

## Findings

| Finding ID | Severity | Repro/evidence | Impact | Owner/status/expiry |
| --- | --- | --- | --- | --- |
|  | S0/S1/S2/S3 |  |  |  |

S0/S1 luôn block. S2/S3 chỉ pass-with-follow-up khi có risk acceptance, owner, mitigation và expiry.

## Limitations and skipped tests

| Test | Why skipped | Owner | Due/expiry | Re-entry trigger |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Gate decision

- Decision: `qa-pass | qa-pass-with-follow-up | qa-no-go`:
- Tester actor/date/evidence:
- Release recommendation: `go | follow-up-open | no-go`:
- Conditions/next owner:
