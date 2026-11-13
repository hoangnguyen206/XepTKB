/**
 * Course colours — the single source for CSS (via custom properties), canvas exports and the contrast test
 * (DESIGN-M6-001 §3, ADR-0015 point 3). No red/pink hue: red means a conflict. Ratios (ink on bg) are checked by
 * styles/contrast.test.ts from this module.
 */
import type { CSSProperties } from "react";
import { normalizeCourseCode, type Plan } from "@ky-nay/domain";
import { courseOf, sectionOf, type AppCatalog } from "./catalog.js";

export type CourseColorId = "violet" | "blue" | "cyan" | "teal" | "green" | "lime" | "amber" | "orange" | "fuchsia" | "slate";
export type ColorSet = { bg: string; edge: string; ink: string };
export type CourseColor = { id: CourseColorId; light: ColorSet; dark: ColorSet };

export const COURSE_PALETTE: readonly CourseColor[] = [
  { id: "violet", light: { bg: "#EDE9FE", edge: "#7C3AED", ink: "#4C1D95" }, dark: { bg: "#2E1065", edge: "#A78BFA", ink: "#EDE9FE" } },
  { id: "blue", light: { bg: "#DBEAFE", edge: "#2563EB", ink: "#1E3A8A" }, dark: { bg: "#172554", edge: "#60A5FA", ink: "#DBEAFE" } },
  { id: "cyan", light: { bg: "#CFFAFE", edge: "#0E7490", ink: "#164E63" }, dark: { bg: "#083344", edge: "#22D3EE", ink: "#CFFAFE" } },
  { id: "teal", light: { bg: "#CCFBF1", edge: "#0F766E", ink: "#134E4A" }, dark: { bg: "#042F2E", edge: "#2DD4BF", ink: "#CCFBF1" } },
  { id: "green", light: { bg: "#DCFCE7", edge: "#15803D", ink: "#14532D" }, dark: { bg: "#052E16", edge: "#4ADE80", ink: "#DCFCE7" } },
  { id: "lime", light: { bg: "#ECFCCB", edge: "#4D7C0F", ink: "#365314" }, dark: { bg: "#1A2E05", edge: "#A3E635", ink: "#ECFCCB" } },
  { id: "amber", light: { bg: "#FEF3C7", edge: "#B45309", ink: "#78350F" }, dark: { bg: "#451A03", edge: "#FBBF24", ink: "#FEF3C7" } },
  { id: "orange", light: { bg: "#FFEDD5", edge: "#C2410C", ink: "#7C2D12" }, dark: { bg: "#431407", edge: "#FB923C", ink: "#FFEDD5" } },
  { id: "fuchsia", light: { bg: "#FAE8FF", edge: "#C026D3", ink: "#701A75" }, dark: { bg: "#4A044E", edge: "#E879F9", ink: "#FAE8FF" } },
  { id: "slate", light: { bg: "#E2E8F0", edge: "#475569", ink: "#0F172A" }, dark: { bg: "#1E293B", edge: "#94A3B8", ink: "#F1F5F9" } },
];

/** Vietnamese names for the colour picker ("Tự động" is the absence of a choice). */
export const COURSE_COLOR_LABELS: Record<CourseColorId, string> = {
  violet: "Tím",
  blue: "Xanh dương",
  cyan: "Xanh lơ",
  teal: "Xanh ngọc",
  green: "Xanh lá",
  lime: "Xanh nõn chuối",
  amber: "Vàng hổ phách",
  orange: "Cam",
  fuchsia: "Hồng tím",
  slate: "Xám",
};

const BY_ID = new Map<string, CourseColor>(COURSE_PALETTE.map((color) => [color.id, color]));

export function isCourseColorId(value: unknown): value is CourseColorId {
  return typeof value === "string" && BY_ID.has(value);
}

export function courseColor(id: CourseColorId): CourseColor {
  return BY_ID.get(id)!;
}

/** FNV-1a, 32 bit, over UTF-16 code units: stable across browsers and runs. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Canonical course codes of the term's plans: draft picks first, then final picks, in pick order, without
 * duplicates. Course aliases are already merged by `courseOf` (the catalog's canonical course).
 */
export function courseOrder(draftPlan: Plan | undefined, finalPlan: Plan | undefined, catalog: AppCatalog): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const plan of [draftPlan, finalPlan]) {
    for (const pick of plan?.picks ?? []) {
      const section = sectionOf(catalog, pick.sectionId);
      if (!section) continue;
      const code = normalizeCourseCode(courseOf(catalog, section.courseCode)?.code ?? section.courseCode);
      if (seen.has(code)) continue;
      seen.add(code);
      order.push(code);
    }
  }
  return order;
}

/**
 * Deterministic colours (DESIGN-M6-001 §3). The automatic colour of a course is FNV-1a(code) mod 10; when an earlier
 * course in `order` already holds it, the next colour is probed (linear, wrapping). Colours repeat only once all 10
 * are used: the probe then looks for the least-used colour. A user choice in `overrides` replaces the automatic
 * colour of that course only and does not move any other course's automatic colour.
 */
export function assignCourseColors(order: readonly string[], overrides: Readonly<Record<string, CourseColorId>> = {}): Map<string, CourseColor> {
  const uses = new Array<number>(COURSE_PALETTE.length).fill(0);
  const result = new Map<string, CourseColor>();
  for (const code of order) {
    if (result.has(code)) continue;
    const start = fnv1a32(code) % COURSE_PALETTE.length;
    const fewest = Math.min(...uses);
    let index = start;
    for (let step = 0; step < COURSE_PALETTE.length; step += 1) {
      const candidate = (start + step) % COURSE_PALETTE.length;
      if (uses[candidate] === fewest) {
        index = candidate;
        break;
      }
    }
    uses[index] = (uses[index] ?? 0) + 1;
    const chosen = overrides[code];
    result.set(code, isCourseColorId(chosen) ? courseColor(chosen) : COURSE_PALETTE[index]!);
  }
  return result;
}

/**
 * Custom properties for the React `style` prop (applied through the CSSOM, which `style-src 'self'` allows).
 * styles/components/course-color.css switches to the -dark values in both dark selectors.
 */
export function courseColorStyle(color: CourseColor): CSSProperties {
  return {
    "--c-bg": color.light.bg,
    "--c-edge": color.light.edge,
    "--c-ink": color.light.ink,
    "--c-bg-dark": color.dark.bg,
    "--c-edge-dark": color.dark.edge,
    "--c-ink-dark": color.dark.ink,
  } as CSSProperties;
}
