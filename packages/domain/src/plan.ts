/** Plan selection, group resolution and validation for the M2 domain engine. */
import { domainIssue, type DomainIssue } from "./issues.js";
import { canonicalSectionId, normalizeCourseCode, normalizeGroup, normalizeSearchText } from "./normalize.js";
import type { DomainCatalog, Plan, PlanPick, Section, Session, Term } from "./types.js";

export type ResolvedPlanPick = {
  pick: PlanPick;
  section: Section;
  sessions: readonly Session[];
};

export type SessionSelectionResult = {
  sessions: readonly Session[];
  issues: readonly DomainIssue[];
};

export type PlanResolution = {
  picks: readonly ResolvedPlanPick[];
  issues: readonly DomainIssue[];
};

export type CreatePlanInput = {
  id: string;
  term: string;
  datasetVersion: string;
  name: string;
  planKind: Plan["planKind"];
  picks?: readonly PlanPick[];
  cohort?: string;
  week1?: string;
  overrides?: Plan["overrides"];
};

const UTC_RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function sectionGroups(section: Section): string[] {
  return [...new Set(section.sessions.map((session) => normalizeGroup(session.group)).filter((group): group is string => Boolean(group) && group !== "CL"))].sort();
}

export function sessionsForPick(section: Section, pick: PlanPick): SessionSelectionResult {
  const issues: DomainIssue[] = [];
  const requested = normalizeGroup(pick.group);
  const groups = sectionGroups(section);
  if (groups.length > 1 && !requested) {
    issues.push(domainIssue("GROUP_REQUIRED", "error", `section ${section.id} requires an explicit group`, { sectionId: section.id }));
    return { sessions: [], issues };
  }
  if (requested && requested !== "CL" && groups.length > 0 && !groups.includes(requested)) {
    issues.push(domainIssue("GROUP_NOT_FOUND", "error", `group ${requested} is not available in section ${section.id}`, { sectionId: section.id }));
    return { sessions: [], issues };
  }
  const sessions = section.sessions.filter((session) => {
    const group = normalizeGroup(session.group);
    if (requested === "CL") return group === undefined || group === "CL";
    if (requested) return group === undefined || group === "CL" || group === requested;
    return group === undefined || group === "CL" || groups.length <= 1;
  });
  return { sessions, issues };
}

export function resolvePlanPicks(plan: Plan, catalog: DomainCatalog): PlanResolution {
  const issues: DomainIssue[] = [];
  const sectionsById = new Map<string, Section>();
  for (const section of catalog.sections) sectionsById.set(canonicalSectionId(section.id), section);
  const picks: ResolvedPlanPick[] = [];
  const seenSections = new Set<string>();
  const seenCourses = new Set<string>();
  for (const pick of plan.picks) {
    const sectionId = canonicalSectionId(pick.sectionId);
    if (seenSections.has(sectionId)) {
      issues.push(domainIssue("DUPLICATE_PLAN_PICK", "error", `section ${sectionId} is selected more than once`, { sectionId }));
      continue;
    }
    seenSections.add(sectionId);
    const section = sectionsById.get(sectionId);
    if (!section) {
      issues.push(domainIssue("SECTION_NOT_FOUND", "error", `section ${sectionId} is not in the dataset`, { sectionId }));
      continue;
    }
    const courseCode = normalizeCourseCode(section.courseCode);
    if (seenCourses.has(courseCode)) {
      issues.push(domainIssue("DUPLICATE_COURSE_SELECTION", "error", `course ${courseCode} is selected more than once`, { sectionId, courseCode }));
      continue;
    }
    seenCourses.add(courseCode);
    const selection = sessionsForPick(section, pick);
    issues.push(...selection.issues);
    const normalizedGroup = normalizeGroup(pick.group);
    picks.push({ pick: normalizedGroup === undefined ? { sectionId: section.id } : { sectionId: section.id, group: normalizedGroup }, section, sessions: selection.sessions });
  }
  return { picks, issues };
}

export function validatePlan(plan: Plan, catalog: DomainCatalog, term: Term): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (plan.term !== term.id) issues.push(domainIssue("PLAN_TERM_MISMATCH", "error", `plan term ${plan.term} does not match ${term.id}`, { field: "term" }));
  if (catalog.datasetVersion !== undefined && plan.datasetVersion !== catalog.datasetVersion) {
    issues.push(domainIssue("PLAN_DATASET_MISMATCH", "error", `plan dataset ${plan.datasetVersion} does not match ${catalog.datasetVersion}`, { field: "datasetVersion" }));
  }
  if (plan.final !== (plan.planKind === "final")) issues.push(domainIssue("PLAN_STATUS_MISMATCH", "error", "Plan.final must mirror planKind", { field: "final" }));
  if (!UTC_RFC3339.test(plan.createdAt) || Number.isNaN(Date.parse(plan.createdAt))) issues.push(domainIssue("INVALID_PLAN", "error", "createdAt must be an RFC3339 UTC timestamp", { field: "createdAt" }));
  if (!UTC_RFC3339.test(plan.updatedAt) || Number.isNaN(Date.parse(plan.updatedAt))) issues.push(domainIssue("INVALID_PLAN", "error", "updatedAt must be an RFC3339 UTC timestamp", { field: "updatedAt" }));
  if (plan.week1 !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(plan.week1)) issues.push(domainIssue("INVALID_WEEK1", "error", "plan week1 must be an ISO date", { field: "week1" }));
  const resolution = resolvePlanPicks(plan, catalog);
  issues.push(...resolution.issues);
  const targets = new Set<string>();
  for (const override of plan.overrides) {
    const targetKey = `${canonicalSectionId(override.target.sectionId)}|${override.target.sessionId}|${override.field}`;
    if (targets.has(targetKey)) continue;
    targets.add(targetKey);
    const section = catalog.sections.find((candidate) => canonicalSectionId(candidate.id) === canonicalSectionId(override.target.sectionId));
    const session = section?.sessions.find((candidate) => candidate.id === override.target.sessionId);
    if (!section || !session) issues.push(domainIssue("INVALID_OVERRIDE_TARGET", "error", `override target ${targetKey} does not exist`, { sectionId: override.target.sectionId, sessionId: override.target.sessionId }));
  }
  return issues;
}

export function createPlan(input: CreatePlanInput, now: string): Plan {
  const planKind = input.planKind;
  return {
    id: input.id,
    term: input.term,
    datasetVersion: input.datasetVersion,
    name: input.name,
    planKind,
    picks: [...(input.picks ?? [])],
    final: planKind === "final",
    ...(input.cohort ? { cohort: input.cohort } : {}),
    ...(input.week1 ? { week1: input.week1 } : {}),
    overrides: [...(input.overrides ?? [])],
    createdAt: now,
    updatedAt: now,
  };
}

export function materializePlan(plan: Plan, catalog: DomainCatalog): PlanResolution {
  return resolvePlanPicks(plan, catalog);
}

export function addPlanPick(plan: Plan, pick: PlanPick, catalog: DomainCatalog): { plan?: Plan; issues: readonly DomainIssue[] } {
  const candidate = { ...plan, picks: [...plan.picks, pick] };
  const resolution = resolvePlanPicks(candidate, catalog);
  if (resolution.issues.some((issue) => issue.severity === "error")) return { issues: resolution.issues };
  return { plan: candidate, issues: resolution.issues };
}

export function removePlanPick(plan: Plan, sectionId: string): Plan {
  const canonical = canonicalSectionId(sectionId);
  return { ...plan, picks: plan.picks.filter((pick) => canonicalSectionId(pick.sectionId) !== canonical), overrides: [...plan.overrides] };
}

export function normalizePlanName(value: string): string {
  return normalizeSearchText(value);
}
