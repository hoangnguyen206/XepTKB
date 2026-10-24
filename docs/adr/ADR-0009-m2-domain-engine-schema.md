# ADR-0009 — M2 domain engine contract and schema migration

> **Status:** ready; G1 acknowledgement pending
> **Owner:** Tech Lead + Coder
> **Last reviewed:** 2026-10-25
> **Related docs:** [Implementation plan](../IMPLEMENTATION_PLAN.md), [Domain model](../DOMAIN_MODEL.md), [Parser spec](../PARSER_SPEC.md), [QA plan](../QA_TEST_PLAN.md), [ADR-0006](ADR-0006-default-th-weeks.md)

## Context

M2 adds the pure domain/runtime engine required by `IMPLEMENTATION_PLAN.md` §2: search, Plan resolution, week-aware conflict detection, week1/date arithmetic, local registration merge and credits. M1's `0.1.0` model did not have enough provenance to apply a registration change to one session safely, and mandatory period fields could not represent an online/non-fixed session without sentinel values.

This ADR records the implementation contract. It does not approve a release gate or claim independent review.

## Decisions

1. The domain schema version is `0.2.0`.
2. `Session` is a discriminated runtime union. A fixed session retains `day/startPeriod/endPeriod`; a non-fixed session has `fixedTime: false` and may omit the time slot. Only online/non-fixed sessions may omit fixed time.
3. `Session.weekOrigin` records `explicit`, `parser-default` or `registration-default`. ADR-0006's `[2..teachingWeeks]` TH rule applies only during registration merge when the candidate carries `parser-default`.
4. `Plan` stores `datasetVersion`; `final` must mirror `planKind`. `Override` stores a target `{sectionId, sessionId}` so field changes cannot be applied to the wrong session.
5. Search normalizes Vietnamese diacritics, case, whitespace and configured code aliases. Empty queries return no results. Alias collisions are reported and never resolved by first-wins; result ordering is deterministic.
6. Conflict requires same day, inclusive overlapping periods, and non-empty week intersection. Non-fixed sessions do not conflict. Known-campus adjacent periods produce a warning only; they do not replace a hard conflict.
7. Week/date arithmetic uses validated ISO civil dates and labels results `Asia/Ho_Chi_Minh`; no host-local timestamp parsing is used. A missing or ambiguous week1 fails closed.
8. Registration merge is pure, field-level and fail-closed. It matches only one timetable section/session, preserves unmatched input as a warning, never mutates the timetable or draft Plan, and creates a separate final Plan. Registration is lower precedence than existing admin/user overrides. TH default weeks are applied only when the registration candidate is marked `parser-default`.
9. Credits may be unknown. Unknown credits are not converted to zero; selected courses are counted once and the result reports completeness/unknown course codes. No min/max credit threshold is invented while C-02 remains open.

## Compatibility and migration

- `0.1.0` timetable sessions without `fixedTime` migrate as fixed sessions because their day and periods are present.
- `0.1.0` registration candidates have no `weekOrigin`; they are treated as legacy parser-default only at the registration merge boundary, not as explicit weeks.
- Existing M1 fixtures are manifest-updated to `0.2.0`; no persisted application database exists yet, so no live migration is run.
- Consumers must preserve unknown credits and target overrides. A future IndexedDB migration must validate records, reject contradictory `final/planKind`, and discard or backup invalid records according to user consent.

## Alternatives rejected

- Sentinel day/period values for online sessions: rejected because they can create false conflicts and violate domain bounds.
- Untargeted overrides: rejected because one Section can contain multiple sessions.
- First-match search/merge on alias or session ambiguity: rejected because it can select the wrong class or room.
- Converting missing credits to `0`: rejected because it hides incomplete source data.

## Verification and gate

- Local M2 tests cover search, Plan/group resolution, conflict matrix, date arithmetic, registration merge and credits.
- `npm run check` and dependency audit are implementation evidence only.
- G1 acknowledgement, G2 readiness acceptance and independent G3a/G3b/G3c decisions remain pending.
- Any change to these types, precedence rules, parser metadata or privacy boundary reopens G1 and downstream gates.

## Amendment 2026-10-25 — registration merge semantics (AUD-001, AUD-008, AUD-016)

Source: [audit M0–M2](../evidence/M0-M2-AUDIT-2026-10-25.md). Decision 8 is refined as follows; schema stays `0.2.0` (no type change).

1. The final Plan's `picks` are the timetable sections matched by the registration input, not the draft's picks. A draft pick that was not registered is not carried over; a registered section missing from the draft is added. The draft Plan is still never mutated. This follows PRD §4 #7 / Q-005 ("Plan chính thức tạo từ file đăng ký").
2. A pick's `group` comes only from the registration rows (exactly one non-`CL` group); otherwise it is left empty and `resolvePlanPicks` reports `GROUP_REQUIRED` when the section needs one. The draft's group is not used as a guess.
3. Several registration rows for one section (for example an LT row and a TH row) are merged into one pick and one session-matching pass.
4. `unmatched` lists registration sections with no unique timetable section. A section matched by id but with an unpaired session stays in the final Plan; the session gets a `REGISTRATION_OVERRIDE_UNMATCHED`/`_AMBIGUOUS` warning. `REGISTRATION_NOT_SELECTED` is removed from the domain taxonomy.
5. Re-importing into an existing final Plan replaces all earlier `source="registration"` overrides. `user` and `admin-correction` overrides on registered sections are carried over and still outrank registration.
6. `validatePlan` reports `CONFLICTING_OVERRIDES` when one source has two different values for the same section/session/field. Different sources on the same field remain valid; precedence decides.
7. A registration candidate without `weekOrigin` is treated as `parser-default` at the merge boundary, as the compatibility section above already stated; it no longer overrides timetable weeks for non-TH sessions.

8. Resolved by Product (Q-010, 2026-10-25): explicit timetable weeks win. The ADR-0006 TH default `[2..teachingWeeks]` replaces timetable weeks only when the timetable session's weeks are themselves `parser-default`; a timetable session without `weekOrigin` (legacy) also keeps its weeks. See the [ADR-0006 amendment](ADR-0006-default-th-weeks.md).
9. Q-009 (2026-10-25): `ONL` classes reach the engine as non-fixed sessions (`fixedTime: false`) from both `uet-xlsx` and `vnu-registration-html`. They match into the final Plan, count toward credits and never produce conflicts or grid cells.

Re-entry: this amendment reopens G1 (acknowledgement), G2 and G3a/G3c for M2 per [Agent workflow §6](../../.claude/AGENT_WORKFLOW.md).
