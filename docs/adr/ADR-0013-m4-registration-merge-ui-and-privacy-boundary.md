# ADR-0013: M4 Registration Merge UI, Override Resolution, and Browser Privacy Boundary

> **Artifact ID:** `ADR-0013`  
> **Artifact status:** `g1-approved`  
> **Canonical gate:** `G1`  
> **Owner:** Tech Lead + Security Reviewer  
> **Last reviewed:** 2026-11-06  
> **Related docs:** [SPEC-M4-001](../evidence/HISTORY.md), [M4 design handoff](../evidence/HISTORY.md), [ADR-0008](ADR-0008-m1-parser-dependencies-local-provenance.md), [ADR-0009](ADR-0009-m2-domain-engine-schema.md), [ADR-0010](ADR-0010-m3-web-app-artifact-storage-export.md), [Security & privacy](../SECURITY_PRIVACY.md)  
> **Evidence envelope:** `EVID-M4-001` ([M4-EVIDENCE-ENVELOPE.md](../evidence/HISTORY.md))  
> **Decision actor / UTC timestamp:** Approved by Owner (Tech Lead + Security) at `2026-11-06T07:30Z`  
> **Supersedes:** none

## 1. Context

Milestone M4 adds the student registration import and merge workflow to `apps/web` (`FR-09`, `FR-10`, `AC-04`, `AC-05`, `PRD.md` §4 #7/#9/#10):

1. Students select their exported “Kết quả đăng ký môn học” file (`.doc` HTML or `.htm`/`.html`) from the VNU portal.
2. The file contains sensitive student PII (`Họ và tên`, `Ngày sinh`, `Mã sinh viên`, `Chương trình đào tạo`, `Khóa`, `Học phí`) alongside the schedule table.
3. Per `SECURITY_PRIVACY.md` §1 #8 and §2, any change touching the browser file-input boundary and PII stripping requires a G1 design & security review before release.
4. In addition, once a registration merge produces a `final` Plan containing targeted `Override` records (`plan.overrides`), every downstream consumer (`resolvePlanPicks`, `findConflicts`, `scheduledSessions`, `WeekGrid`, `DayList`, `PlanSummary`, `.ics`/`.doc`/`.png` exports) must reflect the overridden session values AND surface human-readable override provenance (`from → to`) so the student sees what changed relative to the published timetable (`AC-05`).

## 2. Decisions

### 2.1 Browser parser subpath boundary (`@ky-nay/parser/registration`)

- `apps/web` depends on `@ky-nay/parser` solely via its browser-safe subpath export `@ky-nay/parser/registration` (introduced in the `ADR-0008` amendment), which exports `vnuRegistrationHtmlAdapter` and `MAX_REGISTRATION_BYTES` with zero Node built-in dependencies.
- `scripts/lint.mjs` enforces in `apps/web/src` that:
  1. Any import from `@ky-nay/parser` other than `@ky-nay/parser/registration` is rejected.
  2. Any import of `node:*` built-in modules in `apps/web/src` (outside test files) is rejected.
  3. The existing M3 rules (single network module `apps/web/src/data/loader.ts`, no HTML injection sinks, no storage outside IndexedDB, no PII field identifiers `studentId`/`birthDate`/`fullName`) remain strictly enforced.

### 2.2 Local-only registration file ingestion & PII stripping pipeline

1. **Pre-parse guards (`apps/web/src/model/registration.ts`):**
   - Reject files with `size === 0` (`EMPTY_FILE`) or `size > MAX_REGISTRATION_BYTES` (`2 MiB`, `FILE_TOO_LARGE`) before reading bytes into parser DOM memory.
   - Inspect magic bytes of the `Uint8Array`:
     - `PK\x03\x04` (`.docx` / `.xlsx` ZIP container) → reject with `BINARY_OFFICE_FILE`.
     - `\xD0\xCF\x11\xE0` (legacy binary OLE `.doc` / `.xls`) → reject with `BINARY_OFFICE_FILE`.
     - `%PDF-` → reject with `PDF_FILE`.
   - Pass the `Uint8Array` to `vnuRegistrationHtmlAdapter.parse(...)`.
2. **PII stripping (`vnuRegistrationHtmlAdapter`):**
   - Only the schedule table (matched by required headers `Mã môn học`, `Lớp môn học`, `Thứ`, `Tiết`, `Giảng đường`) is read; the student identity table and footer signature blocks are never extracted.
   - Within the schedule table, only schedule columns (`Mã môn học`, `Môn học`, `Số tín chỉ`, `Lớp môn học`, `Thứ`, `Tiết`, `Giảng đường`, optional `Nhóm`/`Tuần`/`Giảng viên`) are read; `Học phí` and `Trạng thái` are ignored.
   - `ImportArtifact` sets `localOnly: true`, `id: "local-registration"`, and omits `fileName` and `sha256`.
3. **Zero retention of raw input or file metadata:**
   - The `File` object, `file.name`, `Uint8Array`, and decoded HTML never enter React state, `IndexedDB`, `URL`, `console`, or error messages.
   - Only the sanitized `RegistrationImportPreview` (containing `Plan`, matched/unmatched `Section` summaries, `Override` descriptors, and `DomainIssue`s/`ParseMessage`s with row numbers only) is held in component state while the preview is open.

### 2.3 Applying `plan.overrides` in `resolvePlanPicks` (`@ky-nay/domain`)

- Previously, `mergeRegistration` returned both `plan` (with `plan.overrides`) and `sections` (with overrides applied in-memory), while `resolvePlanPicks(plan, catalog)` resolved picks against `catalog.sections` without applying `plan.overrides`.
- When a `final` Plan is persisted to `IndexedDB` and reloaded, only `plan` (including `plan.overrides`) and `catalog` exist.
- Therefore, `resolvePlanPicks(plan, catalog)` in `packages/domain/src/plan.ts` is updated to apply `plan.overrides` (via `applyOverridesToCatalogSections(catalog.sections, plan.overrides, catalog.timeFrames)`) before selecting sessions for each pick:
  - Overrides are applied in canonical precedence order: `timetable < registration < admin-correction < user` (`DOMAIN_MODEL.md` §5).
  - Invalid or conflicting overrides continue to be reported by `validatePlan(plan, catalog, term)` without duplicating error codes.
  - Because `applyOverridesToCatalogSections` is idempotent when `override.to` already matches the session's current field value, callers that pass `{ ...catalog, sections: mergeResult.sections }` and callers that pass `catalog` directly both obtain identical resolved sessions.

### 2.4 Surfacing override provenance (`from → to`) in `@ky-nay/export` and `apps/web`

- `packages/export/src/schedule.ts` adds `SessionOverride` metadata to `ScheduledSession`:
  ```ts
  export type SessionOverride = {
    field: OverrideField;
    source: Override["source"];
    from?: unknown;
    to: unknown;
    badge: string;   // e.g. "Đã đổi phòng", "Đã đổi giờ", "Đã đổi tuần"
    detail: string;  // e.g. "Phòng: 203-G2 → 305-G2 (theo ĐKMH)"
  };
  ```
- `scheduledSessions(picks, courses, overrides?)` attaches `overrides?: readonly SessionOverride[]` to each `ScheduledSession` whenever `plan.overrides` has effective changes targeting `(sectionId, sessionId)`.
- `buildPlanView(plan, catalog)` passes `plan.overrides` to `scheduledSessions(resolution.picks, catalog.domain.courses, plan.overrides)`.
- `WeekGrid`, `DayList`, `PlanSummary`, `PrintSheet`, `buildWordDoc`, and `buildIcs` render the override badges and `from → to` details so the student sees both the winning registration value and the original timetable value everywhere.

### 2.5 Two-slot Plan management (`draft` vs `final`) and Unmatched warnings

- Per `Q-005`, each term has at most two Plans in `IndexedDB`:
  - `planKind === "draft"` (`"Phương án nháp"`)
  - `planKind === "final"` (`"Phương án chính thức"`, `id = "${draftPlan.id}:final"`)
- `Settings` in `apps/web/src/storage/local-data.ts` stores `activePlanKind?: "draft" | "final"` (and optional PII-free unmatched registration notes per term so unmatched warnings remain visible on `Phương án chính thức` across reloads until the next import or wipe).
- Re-importing a registration file merges against the existing `final` Plan (replacing old `registration` overrides while preserving any `user`/`admin-correction` overrides) and never mutates `draftPlan`.
- Inheriting group selection (`D-M4-1`): When a matched multi-group timetable section has no group disambiguated by the registration file (e.g. only common `CL` sessions matched), `buildRegistrationPreview` carries over the group already chosen for that exact `sectionId` in `finalPlan` (if re-importing) or `draftPlan` (if first import). If no group was previously chosen, `GROUP_REQUIRED` is surfaced and the student can select the group inline in `PlanSummary` or `SearchPanel`.

## 3. Options Considered

| Area | Option A (Chosen) | Option B | Rationale |
| --- | --- | --- | --- |
| Where to apply `plan.overrides` | Inside `resolvePlanPicks(plan, catalog)` in `@ky-nay/domain` | Only in `apps/web/src/model/plan-view.ts` | Keeps domain conflict detection, `previewPick`, and `buildPlanView` consistent from a single source of truth (`@ky-nay/domain`). |
| Storing unmatched registration sections | Store PII-free unmatched section codes + schedule summary in `Settings` keyed by term (cleared on re-import/delete/wipe), never in `Plan.picks` | Add unmatched sections to `Plan.picks` | Adding unknown sections to `Plan.picks` would violate domain invariant (`SECTION_NOT_FOUND`); keeping a small PII-free summary alongside settings preserves warning visibility after reload. |
| Resolving `GROUP_REQUIRED` on `final` Plan | Inline group selector in `PlanSummary` + existing `SearchPanel` | Only via `SearchPanel` | Students importing a registration file go straight to the schedule/summary; an inline group picker on `PlanSummary` avoids forcing them to search for the course manually. |

## 4. Security & Privacy Review (G1 Threat Analysis)

| Threat / Boundary | Control | Verification |
| --- | --- | --- |
| PII exfiltration over network during registration import (`AC-04`) | No network APIs in `@ky-nay/parser/registration` or `apps/web/src` (except `loader.ts`); CSP `connect-src 'self'`; SW only passes through same-origin requests. | `scripts/lint.mjs` + Playwright E2E network & SW request interception asserting 0 requests during file import. |
| PII persistence in `IndexedDB` or `DOM` (`AC-04`) | `vnuRegistrationHtmlAdapter` reads only schedule columns of the schedule table; raw bytes, filename, and student identity cells are discarded immediately. | Unit & E2E tests inspecting `document.body.textContent`, all `IndexedDB` object stores, `console`, and exported `.ics`/`.doc` blobs for every PII token in `portal-format.doc`. |
| Malicious HTML / XSS in `.doc` registration file | `@xmldom/xmldom` parses HTML without executing scripts or loading external resources; extracted strings are rendered via React text nodes and escaped in exports. | Unit test with `<img src=x onerror=...>` and `<script>` inside registration `.doc` cells verifying text-only rendering and zero execution. |
| Oversized / binary file DoS in browser | `MAX_REGISTRATION_BYTES` (`2 MiB`) and magic-byte checks (`ZIP`, `OLE`, `PDF`) before DOM parsing. | Unit tests for `> 2 MiB` and binary `.docx`/`OLE`/`.pdf` inputs. |
| Residual data on shared device | “Xóa phương án chính thức” deletes the `final` Plan + unmatched notes; “Xóa dữ liệu trên máy” wipes all `IndexedDB` stores and `caches`. | Component & E2E tests verifying complete cleanup. |
