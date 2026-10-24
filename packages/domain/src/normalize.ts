/**
 * Parser-independent identity normalization used by M2 search and merge.
 * Parsing details such as day/period syntax remain in packages/parser.
 */
import type { Course } from "./types.js";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[Đđ]/g, "d")
    .toLowerCase()
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCourseCode(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\*/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export function normalizeSectionId(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\*/g, "")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function sectionParts(sectionId: string): { courseCode: string; suffix: string } | undefined {
  const normalized = normalizeSectionId(sectionId);
  const separator = normalized.search(/\s/);
  if (separator <= 0) return undefined;
  const courseCode = normalizeCourseCode(normalized.slice(0, separator));
  const suffix = normalized.slice(separator).trim();
  if (!courseCode || !suffix) return undefined;
  return { courseCode, suffix };
}

export function canonicalSectionId(sectionId: string, aliases: ReadonlyMap<string, string> = new Map()): string {
  const parts = sectionParts(sectionId);
  if (!parts) return normalizeSectionId(sectionId);
  const courseCode = aliases.get(parts.courseCode) ?? parts.courseCode;
  return `${courseCode} ${parts.suffix}`;
}

export function normalizedCourseName(course: Course): string {
  return normalizeSearchText(course.name);
}

export function normalizeGroup(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize("NFC").replace(/[ \t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  const folded = normalizeSearchText(normalized);
  if (folded === "ca lop" || folded === "cl") return "CL";
  if (/^nhom(?:\s|$)/.test(folded)) {
    const firstSpace = normalized.search(/\s/);
    return (firstSpace >= 0 ? normalized.slice(firstSpace + 1) : "").trim() || undefined;
  }
  return normalized.replace(/^nhom\s*/i, "").trim() || undefined;
}

export function buildCourseCodeAliases(courses: readonly Course[]): {
  aliases: ReadonlyMap<string, string>;
  collisions: readonly string[];
} {
  const owners = new Map<string, Set<string>>();
  for (const course of courses) {
    const canonical = normalizeCourseCode(course.code);
    const keys = [canonical, ...course.altCodes.map(normalizeCourseCode)];
    if (canonical.startsWith("UET.")) keys.push(canonical.slice(4));
    if (!canonical.startsWith("UET.")) keys.push(`UET.${canonical}`);
    for (const key of keys) {
      if (!key) continue;
      const set = owners.get(key) ?? new Set<string>();
      set.add(canonical);
      owners.set(key, set);
    }
  }
  const aliases = new Map<string, string>();
  const collisions: string[] = [];
  for (const [key, values] of owners) {
    if (values.size === 1) aliases.set(key, [...values][0]!);
    else collisions.push(key);
  }
  collisions.sort();
  return { aliases, collisions };
}
