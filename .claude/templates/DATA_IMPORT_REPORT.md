# Data import report template

# Data import report — <school/term/source>

> **Artifact ID:** `IMPORT-XXX`  
> **Artifact status:** `candidate | validated | published | rejected | retracted | hold`  
> **Canonical gate:** `G4b` (G1/G3a/G3b re-entry evidence when applicable)  
> **Owner:** Data Parser  
> **Last reviewed:** YYYY-MM-DD  
> **Related docs:**  
> **Evidence envelope:** `EVID-XXX`

## Source identity and intake

- School / term / cohort scope:
- Source type/status: `timetable | exam | study-plan | manual-correction`, `planned | official | user-approved`
- Source document reference/link (safe, no PII):
- Source SHA-256 (approved non-PII source):
- File type/size/content validation:
- Submitter actor/date:
- Duplicate/previous artifact:
- Quarantine location/status:

## Parser and fixture identity

- Adapter/parser/config version:
- Schema version:
- Fixture manifest + hash (synthetic/redacted):
- Deterministic command/tool version:
- Parse/diff run ID + exit code/evidence link:
- Drift thresholds/baseline:

## Parse summary

| Metric | Value | Expected/baseline | Result |
| --- | --- | --- | --- |
| Sections |  |  |  |
| Courses |  |  |  |
| Sessions |  |  |  |
| Fixed-time sessions |  |  |  |
| Non-fixed/online |  |  |  |
| Warnings |  |  |  |
| Blocking errors |  |  |  |

## Output integrity and compatibility

- Normalized artifact hash:
- Published manifest/catalog hash (if any):
- Output schema/parser/dataset version:
- App compatibility range:
- Normalized output storage/publish target:
- Source-vs-output diff evidence:

## Quality issues

| Code | Severity | Count | Representative synthetic ID/row/page (redacted) | Resolution/owner |
| --- | --- | --- | --- | --- |
|  | S0/S1/S2/S3 |  |  |  |

## Diff với published version

- Added/removed/changed sections:
- Changed sessions/rooms/weeks/campus:
- Exam/date changes:
- Unexpected drift and investigation:

## Review and sign-off checklist

- [ ] Required columns/header/synonyms validated.
- [ ] Merged/repeated rows/headers handled.
- [ ] Period/week/note/group/room/campus edge cases sampled.
- [ ] Source, fixture, output and manifest hashes complete.
- [ ] No blocking error; warnings have explanation/owner.
- [ ] Source status and user-facing updated-at text correct.
- [ ] Data/security/privacy review completed or marked N/A with reason.
- [ ] App↔dataset compatibility checked.
- [ ] Rollback target identified and rollback drill result attached.
- [ ] Monitoring/catalog/canary evidence attached.
- [ ] First publish has two distinct approving actors/timestamps.

| Responsibility | Actor | UTC timestamp | Decision/evidence |
| --- | --- | --- | --- |
| Parser prepared |  |  |  |
| Independent data reviewer validated |  |  |  |
| Security sign-off (if applicable) |  |  |  |
| Release Manager publish decision |  |  |  |
| Second first-publish approver |  |  |  |

## Decision

- Gate decision: `dataset-published | dataset-no-go`:
- Recommendation: `publish | reject | hold | retract-and-rollback`:
- Rationale:
- Publish/version/catalog action:
- Rollback drill/target/instruction:
- Monitoring window:
- Follow-up fixture/rule/ticket + owner/due:
