/** Credit summaries with explicit unknown-credit diagnostics; never fabricate zero. */
import { domainIssue, type DomainIssue } from "./issues.js";
import { normalizeCourseCode, buildCourseCodeAliases } from "./normalize.js";
import { resolvePlanPicks, type PlanResolution } from "./plan.js";
import type { Course, DomainCatalog, Plan } from "./types.js";

export type CreditSummary = {
  knownTotal: number;
  complete: boolean;
  unknownCourseCodes: readonly string[];
  countedCourseCodes: readonly string[];
  issues: readonly DomainIssue[];
};

function cents(value: number): number {
  return Math.round(value * 100);
}

export function summarizeCredits(resolution: PlanResolution, courses: readonly Course[]): CreditSummary {
  const byCode = new Map<string, Course>();
  const issues: DomainIssue[] = [];
  const { aliases } = buildCourseCodeAliases(courses);
  for (const course of courses) {
    const code = aliases.get(normalizeCourseCode(course.code)) ?? normalizeCourseCode(course.code);
    const prior = byCode.get(code);
    if (prior && prior.credits !== course.credits) {
      issues.push(domainIssue("CONFLICTING_COURSE_CREDITS", "error", `course ${code} has conflicting credits`, { courseCode: code }));
    } else if (!prior) byCode.set(code, course);
  }
  const counted = new Set<string>();
  const unknown = new Set<string>();
  let totalCents = 0;
  for (const entry of resolution.picks) {
    const rawCode = normalizeCourseCode(entry.section.courseCode);
    const code = aliases.get(rawCode) ?? rawCode;
    if (counted.has(code)) continue;
    counted.add(code);
    const course = byCode.get(code);
    if (!course) {
      unknown.add(code);
      issues.push(domainIssue("COURSE_NOT_FOUND", "error", `course ${code} is not in the catalog`, { courseCode: code }));
    } else if (course.credits === undefined) {
      unknown.add(code);
      issues.push(domainIssue("MISSING_CREDITS", "warning", `course ${code} has no credit value`, { courseCode: code }));
    } else {
      totalCents += cents(course.credits);
    }
  }
  return {
    knownTotal: totalCents / 100,
    complete: unknown.size === 0 && !issues.some((issue) => issue.severity === "error"),
    unknownCourseCodes: [...unknown].sort(),
    countedCourseCodes: [...counted].sort(),
    issues,
  };
}

export function calculatePlanCredits(plan: Plan, catalog: DomainCatalog): CreditSummary {
  return summarizeCredits(resolvePlanPicks(plan, catalog), catalog.courses);
}
