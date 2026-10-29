/** Section selection: group options, conflict preview and Plan updates — all through the domain engine. */
import {
  addPlanPick,
  canonicalSectionId,
  findConflicts,
  normalizeCourseCode,
  normalizeGroup,
  removePlanPick,
  resolvePlanPicks,
  type CampusWarning,
  type DomainIssue,
  type HardConflict,
  type Plan,
  type PlanPick,
  type Section,
} from "@ky-nay/domain";
import { describeConflict, dayLabel, formatWeeks } from "@ky-nay/export";
import { courseOf, type AppCatalog } from "./catalog.js";

/** Numbered groups of a section (CL sessions are common to every group). Empty when no choice is needed. */
export function groupOptions(section: Section): string[] {
  const groups = new Set<string>();
  for (const session of section.sessions) {
    const group = normalizeGroup(session.group);
    if (group && group !== "CL") groups.add(group);
  }
  return groups.size > 1 ? [...groups].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })) : [];
}

function courseKey(catalog: AppCatalog, courseCode: string): string {
  const code = normalizeCourseCode(courseCode);
  return catalog.aliases.get(code) ?? code;
}

/** The current pick for the same course as `section`, if any (a course is taken in one section only). */
export function pickForCourse(plan: Plan, catalog: AppCatalog, section: Section): PlanPick | undefined {
  const key = courseKey(catalog, section.courseCode);
  return plan.picks.find((pick) => {
    const picked = catalog.sectionById.get(canonicalSectionId(pick.sectionId));
    return picked !== undefined && courseKey(catalog, picked.courseCode) === key;
  });
}

export function isPicked(plan: Plan, section: Section): PlanPick | undefined {
  const id = canonicalSectionId(section.id);
  return plan.picks.find((pick) => canonicalSectionId(pick.sectionId) === id);
}

function withPick(plan: Plan, catalog: AppCatalog, pick: PlanPick): Plan {
  const section = catalog.sectionById.get(canonicalSectionId(pick.sectionId));
  const existing = section ? pickForCourse(plan, catalog, section) : undefined;
  const base = existing ? removePlanPick(plan, existing.sectionId) : plan;
  return { ...base, picks: [...base.picks, pick] };
}

export type PickPreview = {
  conflicts: HardConflict[];
  conflictTexts: string[];
  campusTexts: string[];
  issues: readonly DomainIssue[];
};

export function describeCampus(warning: CampusWarning, perspectiveSectionId?: string): string {
  const where = `khác cơ sở (${warning.fromCampus} ↔ ${warning.toCampus}), ${dayLabel(warning.day)}, tuần ${formatWeeks(warning.weekIntersection)}`;
  if (perspectiveSectionId === undefined) return `${warning.left.sectionId} và ${warning.right.sectionId} học liền tiết nhưng ${where}`;
  const other = warning.left.sectionId === perspectiveSectionId ? warning.right.sectionId : warning.left.sectionId;
  return `Học liền tiết với ${other} nhưng ${where}`;
}

/** What would happen if `pick` were added (replacing another section of the same course). */
export function previewPick(plan: Plan, catalog: AppCatalog, pick: PlanPick): PickPreview {
  const candidate = withPick(plan, catalog, pick);
  const resolution = resolvePlanPicks(candidate, catalog.domain);
  const report = findConflicts(resolution.picks);
  const id = canonicalSectionId(pick.sectionId);
  const involves = (sectionId: string) => canonicalSectionId(sectionId) === id;
  const conflicts = report.conflicts.filter((conflict) => involves(conflict.left.sectionId) || involves(conflict.right.sectionId));
  const lookup = (sectionId: string) => {
    const section = catalog.sectionById.get(canonicalSectionId(sectionId));
    const course = section ? courseOf(catalog, section.courseCode) : undefined;
    return course ? { courseName: course.name } : undefined;
  };
  return {
    conflicts,
    conflictTexts: conflicts.map((conflict) => describeConflict(conflict, pick.sectionId, lookup)),
    campusTexts: report.warnings.filter((warning) => involves(warning.left.sectionId) || involves(warning.right.sectionId)).map((warning) => describeCampus(warning, pick.sectionId)),
    issues: resolution.issues.filter((issue) => issue.sectionId === undefined || involves(issue.sectionId)),
  };
}

/** Adds `pick` (replacing a section of the same course). Returns the domain issues when it is rejected. */
export function applyPick(plan: Plan, catalog: AppCatalog, pick: PlanPick, now: string): { plan?: Plan; issues: readonly DomainIssue[] } {
  const section = catalog.sectionById.get(canonicalSectionId(pick.sectionId));
  const existing = section ? pickForCourse(plan, catalog, section) : undefined;
  const base = existing ? removePlanPick(plan, existing.sectionId) : plan;
  const result = addPlanPick(base, pick, catalog.domain);
  return result.plan ? { plan: { ...result.plan, updatedAt: now }, issues: result.issues } : { issues: result.issues };
}

export function unpick(plan: Plan, sectionId: string, now: string): Plan {
  return { ...removePlanPick(plan, sectionId), updatedAt: now };
}
