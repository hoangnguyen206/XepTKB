/** Pure ISO civil-date and week-1 resolution for Asia/Ho_Chi_Minh schedules. */
import { domainIssue, type DomainIssue } from "./issues.js";
import type { DayNo, Plan, Term, WeekNo } from "./types.js";

export type IsoDate = string;
export type Week1Resolution = { date: IsoDate; source: "term" | "user"; cohort?: string };
export type WeekDateResult = { date: IsoDate; week: WeekNo; day: DayNo; timezone: "Asia/Ho_Chi_Minh" };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function civilDate(value: string): { year: number; month: number; day: number } | undefined {
  const match = ISO_DATE.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return { year, month, day };
}

function formatDate(date: Date): IsoDate {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

export function validateIsoDate(value: string): boolean {
  return civilDate(value) !== undefined;
}

export function resolveWeek1(term: Term, options: { cohort?: string; override?: string } = {}): Week1Resolution | DomainIssue {
  if (options.override !== undefined) {
    if (!validateIsoDate(options.override)) return domainIssue("INVALID_WEEK1", "error", `invalid week1 date ${options.override}`, { field: "week1" });
    return { date: options.override, source: "user", ...(options.cohort ? { cohort: options.cohort } : {}) };
  }
  const cohort = options.cohort?.trim();
  const candidates = term.starts.filter((start) => !cohort || start.cohorts.some((item) => item.trim() === cohort));
  if (candidates.length === 0) return domainIssue("WEEK1_UNRESOLVED", "error", cohort ? `no week1 configured for cohort ${cohort}` : "no week1 configured", { field: "cohort" });
  if (candidates.length > 1) return domainIssue("AMBIGUOUS_WEEK1", "error", "more than one week1 configuration matches", { field: "cohort" });
  const date = candidates[0]!.week1;
  if (!validateIsoDate(date)) return domainIssue("INVALID_WEEK1", "error", `invalid configured week1 date ${date}`, { field: "week1" });
  return { date, source: "term", ...(cohort ? { cohort } : {}) };
}

export function resolvePlanWeek1(plan: Plan, term: Term): Week1Resolution | DomainIssue {
  const options: { cohort?: string; override?: string } = {};
  if (plan.cohort !== undefined) options.cohort = plan.cohort;
  if (plan.week1 !== undefined) options.override = plan.week1;
  return resolveWeek1(term, options);
}

export function dateFor(week1: IsoDate, week: WeekNo, day: DayNo, teachingWeeks?: number): WeekDateResult | DomainIssue {
  const parsed = civilDate(week1);
  if (!parsed) return domainIssue("INVALID_WEEK1", "error", `invalid week1 date ${week1}`, { field: "week1" });
  if (!Number.isInteger(week) || week < 1 || (teachingWeeks !== undefined && week > teachingWeeks)) return domainIssue("INVALID_WEEK", "error", `week ${week} is outside the configured term`, { field: "week" });
  if (!Number.isInteger(day) || day < 2 || day > 8) return domainIssue("INVALID_DATE", "error", `day ${day} is outside T2..CN`, { field: "day" });
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7 + (day - 2));
  return { date: formatDate(date), week, day, timezone: "Asia/Ho_Chi_Minh" };
}

export function datesForWeeks(week1: IsoDate, weeks: readonly WeekNo[], day: DayNo, teachingWeeks?: number): readonly (WeekDateResult | DomainIssue)[] {
  return weeks.map((week) => dateFor(week1, week, day, teachingWeeks));
}
