# Release và post-release report template

# Release report — <app/dataset version>

> **Artifact ID:** `RELEASE-XXX`  
> **Artifact status:** `draft | ready | released | follow-up-open | closed | blocked`  
> **Canonical gate:** `G4a | G4b | G5`  
> **Owner:** Release Manager  
> **Last reviewed:** YYYY-MM-DD  
> **Related docs:**  
> **Evidence envelope:** `EVID-XXX`

## Release identity and scope

- Release type: `app | dataset | coordinated | post-release`
- Source PRD/spec/ADR + versions/hashes:
- App commit/build/tag:
- Dataset/parser/schema/manifest version + hashes:
- Compatibility matrix (app ↔ dataset):
- Environment/canary cohort:
- Target/previous known-good version:

## Gate prerequisites

| Gate | Decision | Actor/date | Evidence ID/link | Conditions |
| --- | --- | --- | --- | --- |
| G0 |  |  |  |  |
| G1 |  |  |  |  |
| G2 |  |  |  |  |
| G3a QA |  |  |  |  |
| G3b Security |  |  |  |  |
| G3c Review |  |  |  |  |
| G4a App |  |  |  |  |
| G4b Dataset |  |  |  |  |

S0/S1 hoặc P0 coverage thiếu ⇒ `no-go`. S2/S3 exception phải ghi owner, mitigation, expiry và approving actor.

## Deploy/publish evidence

- Exact deploy/publish commands + exit codes:
- CI/deploy/catalog/canary run IDs and links:
- Source/output/manifest hash verification:
- Two-person dataset approval (first publish):
- Changelog/status message:

## Monitoring and rollback

- Canary duration/criteria:
- Monitoring window and observed metrics:
- Alerts/thresholds:
- Rollback trigger:
- Rollback target and tested drill evidence:
- Incident/communication owner:

## Decision

- G4a decision: `app-released | app-no-go`:
- G4b decision: `dataset-published | dataset-no-go`:
- G5 status: `closed | follow-up-open`:
- Decision actor / UTC timestamp:
- Next owner acknowledgement:

## Post-release review

- User/data/parser errors observed:
- Incidents/findings and severity:
- P0/P1 follow-ups:
- S2/S3 follow-ups with owner/due:
- Docs/fixture/ADR updates:
- Ownership/continuity handoff:
- Retrospective evidence/link:
