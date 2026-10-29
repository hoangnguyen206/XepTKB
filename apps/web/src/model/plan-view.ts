/** Derived view of the active Plan: resolved sessions, conflicts, credits, week1 and staleness. */
import {
  calculatePlanCredits,
  canonicalSectionId,
  findConflicts,
  resolvePlanPicks,
  resolvePlanWeek1,
  type CreditSummary,
  type DomainIssue,
  type HardConflict,
  type CampusWarning,
  type Plan,
  type PlanResolution,
} from "@ky-nay/domain";
import { scheduledSessions, type ScheduledSession } from "@ky-nay/export";
import type { AppCatalog } from "./catalog.js";

export type CreditCheck = { kind: "below" | "above"; limit: number } | undefined;

export type PlanView = {
  resolution: PlanResolution;
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
    sessions: scheduledSessions(resolution.picks, catalog.domain.courses),
    conflicts: report.conflicts,
    campusWarnings: report.warnings,
    credits,
    creditCheck,
    ...("code" in week1 ? { week1Issue: week1 } : { week1: { date: week1.date, source: week1.source } }),
    stale: plan.datasetVersion !== catalog.entry.datasetVersion,
  };
}

/** Picks that no longer exist in the current dataset (shown before the user confirms a rebase). */
export function missingPicks(plan: Plan, catalog: AppCatalog): string[] {
  return plan.picks.filter((pick) => !catalog.sectionById.has(canonicalSectionId(pick.sectionId))).map((pick) => pick.sectionId);
}

/** Moves the Plan to the current dataset version, dropping picks and overrides that no longer resolve. */
export function rebasePlan(plan: Plan, catalog: AppCatalog, now: string): Plan {
  const missing = new Set(missingPicks(plan, catalog).map((id) => canonicalSectionId(id)));
  return {
    ...plan,
    datasetVersion: catalog.entry.datasetVersion,
    picks: plan.picks.filter((pick) => !missing.has(canonicalSectionId(pick.sectionId))),
    overrides: plan.overrides.filter((override) => {
      const section = catalog.sectionById.get(canonicalSectionId(override.target.sectionId));
      return section?.sessions.some((session) => session.id === override.target.sessionId) ?? false;
    }),
    updatedAt: now,
  };
}
