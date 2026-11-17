/**
 * Drawing helpers shared by the canvas exports — the week PNG (`png.ts`) and the share poster (`poster.ts`),
 * DESIGN-M6-001 §10. Pure apart from the context they are given; both callers live in the lazy `exporters-` chunk.
 * Fonts are the self-hosted Be Vietnam Pro faces declared in styles/fonts.css (weights 400 and 800 only, D-M6-12);
 * they are loaded through `document.fonts.load`, never through the FontFace constructor or a style element.
 */
import { FONT_FAMILY } from "../app/fonts.js";

export type CanvasWeight = 400 | 800;

export const CANVAS_FONT_STACK = `"${FONT_FAMILY}", system-ui, sans-serif`;

/** CSS font shorthand for the canvas, e.g. `800 26px "Be Vietnam Pro", system-ui, sans-serif`. */
export function canvasFont(size: number, weight: CanvasWeight = 400): string {
  return `${weight} ${size}px ${CANVAS_FONT_STACK}`;
}

/** The sample touches the latin and the vietnamese subset (same as app/fonts.ts). */
const SAMPLE = "Aạ";

/**
 * Waits until the given weights are usable by the canvas (a canvas does not trigger a font download itself, so
 * drawing before the face is loaded silently falls back). Missing `document.fonts` (jsdom, old browsers) or a face
 * that cannot load resolves anyway: the system stack is the fallback.
 */
export async function loadCanvasFonts(weights: readonly CanvasWeight[] = [400, 800], fonts: FontFaceSet | undefined = typeof document === "undefined" ? undefined : document.fonts): Promise<void> {
  if (!fonts || typeof fonts.load !== "function") return;
  try {
    await Promise.all(weights.map((weight) => fonts.load(canvasFont(16, weight), SAMPLE)));
  } catch {
    // Fallback font; nothing to report.
  }
}

/** Anything that measures text in the current font: a canvas context, or a stub in pure layout code and tests. */
export type TextMeasurer = { measureText(text: string): { width: number } };

/** Greedy word wrap at `maxWidth` using the context's current font. A single word wider than the line stays whole. */
export function wrapText(context: TextMeasurer, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shortens `text` with "…" until `measure` says it fits in `maxWidth`. */
export function ellipsize(measure: (text: string) => number, text: string, maxWidth: number): string {
  if (measure(text) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 1) {
    chars.pop();
    const candidate = `${chars.join("").trimEnd()}…`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return "…";
}

/**
 * Diagonal conflict stripes clipped to the rectangle (the canvas counterpart of the CSS stripes on `.is-conflict`).
 * Saves and restores the context, so the caller's clip, stroke style and line width are untouched.
 */
export function drawHatch(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, options: { lineWidth?: number; gap?: number } = {}): void {
  const gap = options.gap ?? 18;
  context.save();
  context.beginPath();
  context.rect(x, y, w, h);
  context.clip();
  context.strokeStyle = color;
  context.lineWidth = options.lineWidth ?? 6;
  for (let offset = -h; offset < w; offset += gap) {
    context.beginPath();
    context.moveTo(x + offset, y + h);
    context.lineTo(x + offset + h, y);
    context.stroke();
  }
  context.restore();
}
