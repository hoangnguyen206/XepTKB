/** Deterministic course/section search index for the M2 domain engine. */
import { buildCourseCodeAliases, normalizeCourseCode, normalizeSearchText, normalizeSectionId } from "./normalize.js";
import { domainIssue, type DomainIssue } from "./issues.js";
import type { Course, Section } from "./types.js";

export type SearchMatchedField = "code" | "alias" | "name" | "section";

export type SearchDocument = {
  sectionId: string;
  courseCode: string;
  codeKeys: readonly string[];
  nameKey: string;
  sectionKey: string;
};

export type SearchIndex = {
  documents: readonly SearchDocument[];
};

export type SearchHit = {
  sectionId: string;
  courseCode: string;
  rank: 0 | 1 | 2 | 3 | 4 | 5;
  matchedFields: readonly SearchMatchedField[];
};

export type SearchIndexBuildResult = {
  index: SearchIndex;
  issues: readonly DomainIssue[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

export function buildSearchIndex(courses: readonly Course[], sections: readonly Section[]): SearchIndexBuildResult {
  const issues: DomainIssue[] = [];
  const courseByCode = new Map<string, Course>();
  for (const course of courses) {
    const code = normalizeCourseCode(course.code);
    const prior = courseByCode.get(code);
    if (prior && prior.name !== course.name) {
      issues.push(domainIssue("COURSE_CODE_COLLISION", "error", `course code ${code} has conflicting definitions`, { courseCode: code }));
      continue;
    }
    courseByCode.set(code, course);
  }
  const { aliases, collisions } = buildCourseCodeAliases(courses);
  for (const collision of collisions) {
    issues.push(domainIssue("COURSE_CODE_COLLISION", "error", `course alias ${collision} maps to multiple courses`, { courseCode: collision }));
  }
  const documentsBySection = new Map<string, SearchDocument>();
  for (const section of sections) {
    const sectionId = normalizeSectionId(section.id);
    const courseCode = aliases.get(normalizeCourseCode(section.courseCode)) ?? normalizeCourseCode(section.courseCode);
    const course = courseByCode.get(courseCode);
    if (!course) {
      issues.push(domainIssue("COURSE_NOT_FOUND", "error", `section ${sectionId} references unknown course ${courseCode}`, { sectionId, courseCode }));
      continue;
    }
    if (documentsBySection.has(sectionId)) {
      issues.push(domainIssue("DUPLICATE_SECTION_ID", "error", `section ${sectionId} appears more than once`, { sectionId }));
      continue;
    }
    const codeKeys = new Set([normalizeCourseCode(course.code), ...course.altCodes.map(normalizeCourseCode)]);
    if (courseCode.startsWith("UET.")) codeKeys.add(courseCode.slice(4));
    else codeKeys.add(`UET.${courseCode}`);
    documentsBySection.set(sectionId, {
      sectionId,
      courseCode,
      codeKeys: uniqueSorted(codeKeys),
      nameKey: normalizeSearchText(course.name),
      sectionKey: normalizeSearchText(sectionId),
    });
  }
  const documents = [...documentsBySection.values()].sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.sectionId.localeCompare(b.sectionId));
  return { index: { documents }, issues };
}

function tokenMatch(query: string, text: string): boolean {
  const tokens = query.split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => text.split(" ").some((part) => part.startsWith(token)));
}

function matchDocument(document: SearchDocument, query: string): { rank: SearchHit["rank"]; fields: SearchMatchedField[] } | undefined {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return undefined;
  const normalizedCodeQuery = normalizeCourseCode(query);
  const codeExact = document.codeKeys.includes(normalizedCodeQuery);
  const codePrefix = document.codeKeys.some((key) => key.startsWith(normalizedCodeQuery));
  const nameExact = document.nameKey === normalizedQuery;
  const nameTokens = tokenMatch(normalizedQuery, document.nameKey);
  const nameSubstring = document.nameKey.includes(normalizedQuery);
  const sectionExact = document.sectionKey === normalizedQuery;
  const sectionMatch = document.sectionKey.includes(normalizedQuery);
  if (codeExact) return { rank: document.codeKeys[0] === normalizedCodeQuery ? 0 : 0, fields: [document.codeKeys[0] === normalizedCodeQuery ? "code" : "alias"] };
  if (sectionExact) return { rank: 1, fields: ["section"] };
  if (codePrefix) return { rank: 2, fields: [document.codeKeys[0] === normalizedCodeQuery ? "code" : "alias"] };
  if (nameExact || nameTokens) return { rank: 3, fields: ["name"] };
  if (nameSubstring) return { rank: 4, fields: ["name"] };
  if (sectionMatch) return { rank: 5, fields: ["section"] };
  return undefined;
}

export function searchSections(index: SearchIndex, query: string, options: { limit?: number } = {}): readonly SearchHit[] {
  if (!normalizeSearchText(query)) return [];
  const limit = options.limit === undefined ? 50 : Math.max(0, Math.floor(options.limit));
  if (limit === 0) return [];
  const hits: SearchHit[] = [];
  for (const document of index.documents) {
    const match = matchDocument(document, query);
    if (match) hits.push({ sectionId: document.sectionId, courseCode: document.courseCode, rank: match.rank, matchedFields: match.fields });
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.courseCode.localeCompare(b.courseCode) || a.sectionId.localeCompare(b.sectionId))
    .slice(0, limit);
}
