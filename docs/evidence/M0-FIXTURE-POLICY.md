# M0 fixture policy and synthetic fixture note

> **Artifact ID:** `FIXTURE-M0-001`
> **Artifact status:** `ready`
> **Canonical gate:** `G1`
> **Owner:** Data Parser
> **Last reviewed:** 2026-10-20
> **Related docs:** [Parser spec §11](../PARSER_SPEC.md), [QA plan §3](../QA_TEST_PLAN.md), [Security & privacy §2](../SECURITY_PRIVACY.md), [ADR-0001](../adr/ADR-0001-react-vite-monorepo.md)
> **Evidence envelope:** [M0 implementation handoff](M0-IMPLEMENTATION-HANDOFF.md)

## Policy

- Repository and CI contain only synthetic or explicitly redacted fixtures.
- Real source files belong outside the repository under ignored paths (`fixtures/real/`, `fixtures/raw/`, `fixtures/private/`, `data/raw/`, `data/private/`).
- Registration files may be retained only after a documented review removes full name, birth date, student identifier, email, phone and any other direct or indirect personal identifier; when uncertain, do not retain the file. Raw registration bytes are never committed.
- Every committed fixture has a manifest entry with family, adapter, data class, schema version, expected counts/issues and a quirk note.
- A malformed or ambiguous case remains a fixture with expected errors; it is not deleted or normalized to make CI green.
- Real-file count checks, when approved, run through a future `test:real` command with an explicit path outside the repo. No such command or real source is included in M0.

## Committed synthetic coverage

| Fixture | Purpose | Data class | Expected result |
| --- | --- | --- | --- |
| `fixtures/smoke/minimal.json` | One valid canonical section/session and provenance | `synthetic` | 1 section, 1 session, no issues |
| `fixtures/synthetic-adversarial/bad-section.json` | Invalid section id, invalid day, inverted periods and duplicate/unsorted weeks | `synthetic` | Expected validation error codes in manifest |

## Privacy review

- The fixture content contains no student identity fields or raw personal document.
- `source.artifactId` values are synthetic labels, not hashes of personal data.
- The fixture runner is offline and reads only the declared local fixture path.
- M1 will add source-format-specific synthetic rows (header/merged cells/aliases/registration HTML) only after its own G0/G1 contract review.

## Acceptance and limitations

- `npm run fixtures:run` must pass all manifest expectations.
- M0 does not claim UET real-file coverage, XLSX support, registration HTML support, parser golden coverage, or production artifact publication.
- Data Reviewer acknowledgement is still required before using this policy as a G1 approval record.
