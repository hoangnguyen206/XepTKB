/** DESIGN-M6-001 §3: deterministic, stable course colours (AC-M6-07). */
import { describe, expect, it } from "vitest";
import { COURSE_PALETTE, assignCourseColors, courseColorStyle, fnv1a32, isCourseColorId } from "./palette.js";

const ids = (map: Map<string, { id: string }>) => Object.fromEntries([...map].map(([code, color]) => [code, color.id]));
const CODES = ["INT2213", "ELT3996", "EMA3071E", "MAT1041", "PHY1103", "INT3306", "INT2204", "PES1015", "FLF1107", "POL1001", "HIS1001", "INT3401"];

describe("assignCourseColors", () => {
  it("FNV-1a matches known vectors", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fnv1a32("foobar")).toBe(0xbf9cf968);
  });

  it("is deterministic and starts from the hash of the course code", () => {
    const first = assignCourseColors(["INT2213"]);
    expect(first.get("INT2213")).toBe(COURSE_PALETTE[fnv1a32("INT2213") % 10]);
    expect(ids(assignCourseColors(CODES))).toEqual(ids(assignCourseColors(CODES)));
  });

  it("uses 10 different colours before any colour repeats", () => {
    const map = assignCourseColors(CODES.slice(0, 10));
    expect(new Set([...map.values()].map((color) => color.id)).size).toBe(10);
    const twelve = assignCourseColors(CODES);
    const counts = new Map<string, number>();
    for (const color of twelve.values()) counts.set(color.id, (counts.get(color.id) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBe(2);
  });

  it("adding a course never changes the colours of courses already placed", () => {
    for (let size = 1; size < CODES.length; size += 1) {
      const before = ids(assignCourseColors(CODES.slice(0, size)));
      const after = ids(assignCourseColors(CODES.slice(0, size + 1)));
      for (const code of Object.keys(before)) expect(after[code]).toBe(before[code]);
    }
  });

  it("a user choice changes only that course", () => {
    const auto = ids(assignCourseColors(CODES));
    const chosen = ids(assignCourseColors(CODES, { [CODES[3]!]: "slate" }));
    expect(chosen[CODES[3]!]).toBe("slate");
    for (const code of CODES) if (code !== CODES[3]) expect(chosen[code]).toBe(auto[code]);
  });

  // Up to 10 courses (no colour repeats yet). Past 10, removing a course frees a colour and the first course that would
  // otherwise repeat a colour takes the free one instead: "repeat only when all 10 are used" wins.
  it("removing a course only moves courses that probed past it (≤ 10 courses)", () => {
    const ten = CODES.slice(0, 10);
    const all = assignCourseColors(ten);
    const without = assignCourseColors(ten.filter((code) => code !== ten[2]));
    for (const code of ten) {
      if (code === ten[2]) continue;
      const home = COURSE_PALETTE[fnv1a32(code) % 10]!;
      // A course that sat on its own hash colour keeps it.
      if (all.get(code) === home) expect(without.get(code)).toBe(home);
    }
  });

  it("the same course twice in the order counts once; invalid overrides fall back to automatic", () => {
    const map = assignCourseColors(["INT2213", "INT2213", "ELT3996"], { ELT3996: "crimson" as never });
    expect(map.size).toBe(2);
    expect(map.get("ELT3996")).toBe(assignCourseColors(["INT2213", "ELT3996"]).get("ELT3996"));
  });
});

describe("palette helpers", () => {
  it("isCourseColorId accepts only palette ids", () => {
    expect(isCourseColorId("teal")).toBe(true);
    expect(isCourseColorId("red")).toBe(false);
    expect(isCourseColorId(3)).toBe(false);
  });

  it("courseColorStyle sets the six custom properties", () => {
    expect(courseColorStyle(COURSE_PALETTE[0]!)).toEqual({
      "--c-bg": "#EDE9FE",
      "--c-edge": "#7C3AED",
      "--c-ink": "#4C1D95",
      "--c-bg-dark": "#2E1065",
      "--c-edge-dark": "#A78BFA",
      "--c-ink-dark": "#EDE9FE",
    });
  });
});
