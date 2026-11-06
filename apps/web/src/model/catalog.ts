/** App-level view of a validated dataset: domain catalog, lookups and search. */
import {
  buildCourseCodeAliases,
  buildSearchIndex,
  canonicalSectionId,
  normalizeCourseCode,
  searchSections,
  type Course,
  type DomainCatalog,
  type SearchIndex,
  type Section,
  type Term,
  type TimeFrame,
} from "@ky-nay/domain";
import type { CreditPolicy, DatasetEntry, LoadedDataset } from "../data/contract.js";

export type AppCatalog = {
  entry: DatasetEntry;
  domain: DomainCatalog;
  term: Term;
  frame: TimeFrame;
  maxPeriod: number;
  creditPolicy?: CreditPolicy;
  index: SearchIndex;
  aliases: ReadonlyMap<string, string>;
  courseByCode: ReadonlyMap<string, Course>;
  sectionById: ReadonlyMap<string, Section>;
};

export function buildAppCatalog(dataset: LoadedDataset): AppCatalog {
  const { courses, sections } = dataset.timetable;
  const frame = dataset.metadata.timeFrame;
  const { aliases } = buildCourseCodeAliases(courses);
  return {
    entry: dataset.entry,
    domain: { courses, sections, datasetVersion: dataset.entry.datasetVersion, timeFrames: [frame] },
    term: dataset.metadata.term,
    frame,
    maxPeriod: Math.max(...frame.periods.map((period) => period.no)),
    ...(dataset.metadata.creditPolicy ? { creditPolicy: dataset.metadata.creditPolicy } : {}),
    index: buildSearchIndex(courses, sections).index,
    aliases,
    courseByCode: new Map(courses.map((course) => [normalizeCourseCode(course.code), course])),
    sectionById: new Map(sections.map((section) => [canonicalSectionId(section.id), section])),
  };
}

export function courseOf(catalog: AppCatalog, courseCode: string): Course | undefined {
  const code = normalizeCourseCode(courseCode);
  return catalog.courseByCode.get(catalog.aliases.get(code) ?? code);
}

export function sectionOf(catalog: AppCatalog, sectionId: string): Section | undefined {
  return catalog.sectionById.get(canonicalSectionId(sectionId));
}

export type CourseResult = { course: Course; sections: Section[] };

/** Search hits grouped by course, keeping the domain ranking order of the first hit per course. */
export function searchCourses(catalog: AppCatalog, query: string, limit = 30): CourseResult[] {
  const results = new Map<string, CourseResult>();
  for (const hit of searchSections(catalog.index, query, { limit: 400 })) {
    const course = courseOf(catalog, hit.courseCode);
    const section = sectionOf(catalog, hit.sectionId);
    if (!course || !section) continue;
    const result = results.get(course.code) ?? { course, sections: [] };
    result.sections.push(section);
    results.set(course.code, result);
  }
  return [...results.values()].slice(0, limit).map((result) => ({ ...result, sections: result.sections.sort((a, b) => a.id.localeCompare(b.id, "vi", { numeric: true })) }));
}
