/**
 * AC-M6-01 (DESIGN-M6-001 §2.1, §3, §12): WCAG contrast of every text pair in both themes, computed from the real
 * tokens.css and model/palette.ts; the two dark blocks are identical; print uses the light colours; hex colours appear
 * only in tokens.css, print.css and palette.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COURSE_PALETTE } from "../model/palette.js";

const STYLES = dirname(fileURLToPath(import.meta.url));
const SRC = dirname(STYLES);
const tokensCss = readFileSync(join(STYLES, "tokens.css"), "utf8");
const printCss = readFileSync(join(STYLES, "print.css"), "utf8");

/** Body of the first `{ … }` block after `selector` (no nested braces inside token blocks). */
function block(css: string, selector: string, from = 0): string {
  const start = css.indexOf(selector, from);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

function tokens(body: string): Record<string, string> {
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]));
}

const light = tokens(block(tokensCss, ":root {"));
const mediaDark = block(tokensCss, ':root:not([data-theme="light"])');
const attrDark = block(tokensCss, ':root[data-theme="dark"]');
const dark = tokens(attrDark);

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [fg: string, bg: string, min: number][] = [
  ["--ink", "--bg", 4.5],
  ["--ink", "--surface", 4.5],
  ["--ink", "--surface-2", 4.5],
  ["--muted", "--bg", 4.5],
  ["--muted", "--surface", 4.5],
  ["--muted", "--surface-2", 4.5],
  ["--accent-ink", "--accent", 4.5],
  ["--accent-text", "--surface", 4.5],
  ["--accent-text", "--bg", 4.5],
  ["--accent-text", "--accent-weak", 4.5],
  ["--danger", "--surface", 4.5],
  ["--danger", "--danger-weak", 4.5],
  ["--danger-solid-ink", "--danger-solid", 4.5],
  ["--warning", "--warning-weak", 4.5],
  ["--warning", "--surface", 4.5],
  ["--success", "--success-weak", 4.5],
  ["--success", "--surface", 4.5],
  ["--ink", "--accent-weak", 4.5],
  ["--bg", "--ink", 4.5],
  // Non-text UI (input borders, focus ring): WCAG 1.4.11.
  ["--line-strong", "--surface", 3],
  ["--focus", "--bg", 3],
  ["--focus", "--surface", 3],
];

describe("design tokens (AC-M6-01)", () => {
  it("both dark blocks are identical", () => {
    expect(mediaDark.replace(/\s+/g, " ").trim()).toBe(attrDark.replace(/\s+/g, " ").trim());
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).filter((name) => /^--/.test(name) && name in dark).sort());
  });

  it("every colour token has a dark value", () => {
    const colourTokens = Object.entries(light).filter(([, value]) => value.startsWith("#") || value.startsWith("rgb")).map(([name]) => name);
    for (const name of colourTokens) expect(dark[name], name).toBeDefined();
  });

  for (const [themeName, values] of [["light", light], ["dark", dark]] as const) {
    it(`text pairs reach their ratio in the ${themeName} theme`, () => {
      const failures = TEXT_PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, ratio: contrast(values[fg]!, values[bg]!) })).filter((pair) => pair.ratio < pair.min);
      expect(failures).toEqual([]);
    });
  }

  it("printing uses the light text colours", () => {
    const print = tokens(block(printCss, ":root[data-theme] {"));
    for (const name of ["--ink", "--muted", "--accent", "--accent-text", "--danger", "--warning", "--success", "--danger-solid"]) expect(print[name], name).toBe(light[name]);
  });
});

describe("course palette (DESIGN-M6-001 §3)", () => {
  it("has 10 colours and no red/pink hue", () => {
    expect(COURSE_PALETTE).toHaveLength(10);
    expect(COURSE_PALETTE.map((color) => color.id)).not.toContain("red");
  });

  for (const color of COURSE_PALETTE) {
    it(`${color.id}: ink on its background ≥ 4.5 in both themes; conflict text stays readable`, () => {
      expect(contrast(color.light.ink, color.light.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color.dark.ink, color.dark.bg)).toBeGreaterThanOrEqual(4.5);
      // The edge stripe is a non-text graphic against the block background.
      expect(contrast(color.light.edge, color.light.bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(color.dark.edge, color.dark.bg)).toBeGreaterThanOrEqual(3);
      // Red conflict text (light) on every light course background.
      expect(contrast(light["--danger"]!, color.light.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("hex colours only in the allowed files", () => {
  it("no other CSS file under apps/web/src contains a hex colour", () => {
    const allowed = new Set(["styles/tokens.css", "styles/print.css"]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".css")) {
          const rel = relative(SRC, full).split("\\").join("/");
          const text = readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
          if (!allowed.has(rel) && /#[0-9a-fA-F]{3,8}\b/.test(text)) offenders.push(rel);
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
