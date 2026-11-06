/** Derived view of the active Plan: resolved sessions, conflicts, credits, week1 and staleness. */
import {
  calculatePlanCredits,
  canonicalSectionId,
  findConflicts,
  findOverrideTargetSession,
  normalizeGroup,
  resolvePlanPicks,
  resolvePlanWeek1,
  sessionFieldValue,
  type CreditSummary,
  type DomainIssue,
  type HardConflict,
  type CampusWarning,
  type Override,
  type Plan,
  type PlanResolution,
} from "@ky-nay/domain";
import { scheduledSessions, type ScheduledSession } from "@ky-nay/export";
import type { AppCatalog } from "./catalog.js";

export type CreditCheck = { kind: "below" | "above"; limit: number } | undefined;

/** A pick whose sessions are not fully known (group missing/renamed, section gone, duplicate). */
export type UnresolvedPick = { sectionId: string; codes: string[] };

export type PlanView = {
  resolution: PlanResolution;
  /** Non-empty means conflicts, grid and exports cover only the sessions that could be resolved (REV-M3-001). */
  unresolved: UnresolvedPick[];
  sessions: ScheduledSession[];
  conflicts: readonly HardConflict[];
  campusWarnings: readonly CampusWarning[];
  credits: CreditSummary;
  creditCheck: CreditCheck;
  week1?: { date: string; source: "term" | "user" };
  week1Issue?: DomainIssue;
  stale: boolean;
};

export function buildPlanView(plan: Plan, catalog: AppCatalog): PlanView {
  const resolution = resolvePlanPicks(plan, catalog.domain);
  const report = findConflicts(resolution.picks);
  const credits = calculatePlanCredits(plan, catalog.domain);
  const week1 = resolvePlanWeek1(plan, catalog.term);
  const policy = catalog.creditPolicy;
  // C-02: warn only when the dataset configures a policy; never invent thresholds.
  const creditCheck: CreditCheck = policy?.minCredits !== undefined && credits.knownTotal < policy.minCredits
    ? { kind: "below", limit: policy.minCredits }
    : policy?.maxCredits !== undefined && credits.knownTotal > policy.maxCredits
      ? { kind: "above", limit: policy.maxCredits }
      : undefined;
  return {
    resolution,
    unresolved: unresolvedPicks(resolution.issues),
    sessions: scheduledSessions(resolution.picks, catalog.domain.courses, plan.overrides),
    conflicts: report.conflicts,
    campusWarnings: report.warnings,
    credits,
    creditCheck,
    ...("code" in week1 ? { week1Issue: week1 } : { week1: { date: week1.date, source: week1.source } }),
    stale: plan.datasetVersion !== catalog.entry.datasetVersion,
  };
}

function unresolvedPicks(issues: readonly DomainIssue[]): UnresolvedPick[] {
  const bySection = new Map<string, UnresolvedPick>();
  for (const issue of issues) {
    if (issue.severity !== "error" || issue.sectionId === undefined) continue;
    const key = canonicalSectionId(issue.sectionId);
    const entry = bySection.get(key) ?? { sectionId: issue.sectionId, codes: [] };
    if (!entry.codes.includes(issue.code)) entry.codes.push(issue.code);
    bySection.set(key, entry);
  }
  return [...bySection.values()];
}

/** Picks that no longer exist in the current dataset (shown before the user confirms a rebase). */
export function missingPicks(plan: Plan, catalog: AppCatalog): string[] {
  return plan.picks.filter((pick) => !catalog.sectionById.has(canonicalSectionId(pick.sectionId))).map((pick) => pick.sectionId);
}

/** Picks whose chosen group is not in the current dataset; rebasing clears the group so the user picks again. */
function invalidGroupPicks(plan: Plan, catalog: AppCatalog): Set<string> {
  const invalid = resolvePlanPicks(plan, catalog.domain).issues.filter((issue) => issue.code === "GROUP_NOT_FOUND" && issue.sectionId !== undefined);
  return new Set(invalid.map((issue) => canonicalSectionId(issue.sectionId!)));
}

export type RebasePreview = { removed: string[]; groupCleared: string[]; needsGroup: string[]; droppedOverrides?: string[] };

function resolveOverrideTargets(overrides: readonly Override[], catalog: AppCatalog): { rebased: Override[]; droppedSections: string[] } {
  const bySession = new Map<string, { sectionId: string; sessionId: string; items: Override[] }>();
  for (const override of overrides) {
    const key = `${canonicalSectionId(override.target.sectionId)}|${override.target.sessionId}`;
    const bucket = bySession.get(key) ?? { sectionId: override.target.sectionId, sessionId: override.target.sessionId, items: [] };
    bucket.items.push(override);
    bySession.set(key, bucket);
  }
  const rebased: Override[] = [];
  const droppedSections = new Set<string>();
  for (const bucket of bySession.values()) {
    const section = catalog.sectionById.get(canonicalSectionId(bucket.sectionId));
    if (!section) continue;
    const baseSession = findOverrideTargetSession(section, bucket.sessionId, bucket.items);
    if (!baseSession) {
      droppedSections.add(section.id);
      continue;
    }
    for (const override of bucket.items) {
      const currentBaseValue = sessionFieldValue(baseSession, override.field);
      // When the newer published timetable caught up with a registration override, the override is no longer needed.
      if (override.source === "registration" && JSON.stringify(currentBaseValue) === JSON.stringify(override.to)) continue;
      rebased.push({
        ...override,
        target: { sectionId: section.id, sessionId: baseSession.id },
        from: currentBaseValue,
      });
    }
  }
  return { rebased, droppedSections: [...droppedSections] };
}

/** What a rebase will change, listed before the user confirms it (AC-M3-12, REV-M4-001). */
export function rebasePreview(plan: Plan, catalog: AppCatalog): RebasePreview {
  const invalid = invalidGroupPicks(plan, catalog);
  const { droppedSections } = resolveOverrideTargets(plan.overrides, catalog);
  const rebased = resolvePlanPicks(rebasePlan(plan, catalog, plan.updatedAt), catalog.domain);
  return {
    removed: missingPicks(plan, catalog),
    groupCleared: plan.picks.filter((pick) => invalid.has(canonicalSectionId(pick.sectionId))).map((pick) => pick.sectionId),
    needsGroup: rebased.issues.filter((issue) => issue.code === "GROUP_REQUIRED" && issue.sectionId !== undefined).map((issue) => issue.sectionId!),
    ...(droppedSections.length > 0 ? { droppedOverrides: droppedSections } : {}),
  };
}

/** Moves the Plan to the current dataset version, dropping picks and overrides that no longer resolve and groups that no longer exist. */
export function rebasePlan(plan: Plan, catalog: AppCatalog, now: string): Plan {
  const missing = new Set(missingPicks(plan, catalog).map((id) => canonicalSectionId(id)));
  const invalid = invalidGroupPicks(plan, catalog);
  const { rebased: rebasedOverrides } = resolveOverrideTargets(plan.overrides, catalog);
  return {
    ...plan,
    datasetVersion: catalog.entry.datasetVersion,
    picks: plan.picks
      .filter((pick) => !missing.has(canonicalSectionId(pick.sectionId)))
      .map((pick) => (invalid.has(canonicalSectionId(pick.sectionId)) ? { sectionId: pick.sectionId } : pick)),
    overrides: rebasedOverrides,
    updatedAt: now,
  };
}

/** Updates the group of an already-picked section in-place without dropping Plan overrides. */
export function setPickedGroup(plan: Plan, sectionId: string, group: string, now: string): Plan {
  const target = canonicalSectionId(sectionId);
  const normalized = normalizeGroup(group);
  return {
    ...plan,
    picks: plan.picks.map((pick) =>
      canonicalSectionId(pick.sectionId) === target
        ? normalized ? { sectionId: pick.sectionId, group: normalized } : { sectionId: pick.sectionId }
        : pick,
    ),
    updatedAt: now,
  };
}
