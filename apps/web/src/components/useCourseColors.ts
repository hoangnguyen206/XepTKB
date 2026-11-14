/**
 * Course colours for the term (DESIGN-M6-001 §3, AC-M6-07): one map for the draft and the final plan, so a course has
 * the same colour in both, keyed by the canonical course code (aliases merged). `colorOf` accepts any code a session
 * carries; a course not in either plan gets the colour it would receive if it were added next.
 */
import { useCallback, useMemo } from "react";
import { normalizeCourseCode, type Plan } from "@ky-nay/domain";
import { courseOf, type AppCatalog } from "../model/catalog.js";
import { assignCourseColors, courseOrder, type CourseColor, type CourseColorId } from "../model/palette.js";

export type CourseColorLookup = {
  colorOf: (courseCode: string) => CourseColor;
  canonical: (courseCode: string) => string;
  overrides: Readonly<Record<string, CourseColorId>>;
};

export function useCourseColors(draftPlan: Plan | undefined, finalPlan: Plan | undefined, catalog: AppCatalog, overrides: Readonly<Record<string, CourseColorId>>): CourseColorLookup {
  const canonical = useCallback((courseCode: string) => normalizeCourseCode(courseOf(catalog, courseCode)?.code ?? courseCode), [catalog]);
  const order = useMemo(() => courseOrder(draftPlan, finalPlan, catalog), [draftPlan, finalPlan, catalog]);
  const colors = useMemo(() => assignCourseColors(order, overrides), [order, overrides]);
  const colorOf = useCallback(
    (courseCode: string) => {
      const code = canonical(courseCode);
      return colors.get(code) ?? assignCourseColors([...order, code], overrides).get(code)!;
    },
    [canonical, colors, order, overrides],
  );
  return useMemo(() => ({ colorOf, canonical, overrides }), [colorOf, canonical, overrides]);
}
