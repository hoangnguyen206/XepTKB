/**
 * DESIGN-M6-001 §5 / ADR-0015 point 4: loads both self-hosted Be Vietnam Pro weights (400, 800; D-M6-12) in both
 * subsets right after the first render. Without it a weight first used inside the registration import sheet would
 * start a font request during the window that `e2e/m4.spec.ts` requires to stay at zero requests. Canvas exports
 * also await it before drawing. The sample "Aạ" touches the latin and the vietnamese subset.
 */
export const FONT_FAMILY = "Be Vietnam Pro";
export const FONT_WEIGHTS = [400, 800] as const;
const SAMPLE = "Aạ";

let warming: Promise<void> | undefined;

export function warmFonts(fonts: FontFaceSet | undefined = typeof document === "undefined" ? undefined : document.fonts): Promise<void> {
  if (!fonts || typeof fonts.load !== "function") return Promise.resolve();
  warming ??= Promise.all(FONT_WEIGHTS.map((weight) => fonts.load(`${weight} 16px "${FONT_FAMILY}"`, SAMPLE)))
    .then(() => undefined)
    // A font that cannot load falls back to the system stack; nothing to report.
    .catch(() => undefined);
  return warming;
}

/** Test hook: forget the memoised promise. */
export function resetWarmFontsForTest(): void {
  warming = undefined;
}
