/**
 * Share poster, 1080×1350 PNG (DESIGN-M6-001 §10, AC-M6-15). `posterLayout` is pure: it turns a `PosterInput` into a
 * list of draw commands, so the layout and every text are testable without a canvas; `renderPoster` executes them.
 *
 * Privacy (CLAUDE.md §3, SECURITY_PRIVACY): `PosterInput` holds only the term name, the week label, the credit and
 * course counts, a stripped grid (course code, room, position, conflict flag), the course colours, the legend (code
 * and catalog name) and the public `DatasetEntry`. Nothing from the registration file — no notes, no unmatched
 * classes, no override details, no section ids — and no plan name. `buildPosterInput` is the only bridge from a
 * `PlanView` and copies those fields alone.
 *
 * Lives in the lazy `exporters-` chunk (re-exported by `export/exporters.ts`), never in the initial chunk.
 */
import type { DayNo } from "@ky-nay/domain";
import { buildGridLayout, conflictKeys, dayLabel } from "@ky-nay/export";
import type { DatasetEntry } from "../data/contract.js";
import type { AppCatalog } from "../model/catalog.js";
import { visiblePeriods } from "../model/grid-view.js";
import { APP_NAME, exportDisclaimer, provenanceLine } from "../model/labels.js";
import { COURSE_PALETTE, type ColorSet, type CourseColor } from "../model/palette.js";
import type { PlanView } from "../model/plan-view.js";
import { weekLabel } from "../model/week.js";
import { canvasFont, drawHatch, ellipsize, loadCanvasFonts, wrapText, type CanvasWeight } from "./canvas-kit.js";

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1350;
export const POSTER_LEGEND_MAX = 8;
export const POSTER_CONFLICT_LABEL = "⚠ Trùng";
export const POSTER_EMPTY_WEEK = "Không có buổi học nào trong tuần này";
export const ALL_WEEKS_LABEL = "Tất cả các tuần";

export type PosterBlock = {
  day: DayNo;
  startPeriod: number;
  endPeriod: number;
  lane: number;
  lanes: number;
  conflict: boolean;
  courseCode: string;
  room?: string;
};

export type PosterLegendEntry = { code: string; name: string };

export type PosterInput = {
  termName: string;
  /** "Tuần 3 · 01/03–07/03" or "Tất cả các tuần". */
  weekLabel: string;
  credits: number;
  courseCount: number;
  /** `buildGridLayout` of the chosen week, stripped to what the poster draws; `periods` comes from `visiblePeriods`. */
  grid: { days: readonly DayNo[]; periods: number; blocks: readonly PosterBlock[] };
  /** Light course colours keyed by course code (canvas exports always use the light values, §3). */
  colors: Readonly<Record<string, ColorSet>>;
  legend: readonly PosterLegendEntry[];
  entry: DatasetEntry;
};

export type PosterTextAlign = "left" | "center";

export type PosterCommand =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lineWidth?: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: string; lineWidth: number }
  | { kind: "hatch"; x: number; y: number; w: number; h: number; color: string }
  | { kind: "text"; text: string; x: number; y: number; size: number; weight: CanvasWeight; color: string; align: PosterTextAlign };

/** Width of `text` at `size` px and `weight` in Be Vietnam Pro. */
export type PosterMeasure = (text: string, size: number, weight: CanvasWeight) => number;

/** Rough width used when no canvas is at hand (pure layout, tests). */
export const estimateWidth: PosterMeasure = (text, size, weight) => [...text].length * size * (weight === 800 ? 0.6 : 0.55);

// Light theme values of styles/tokens.css (the poster is always light).
const COLOR = {
  page: "#F5F6FA",
  surface: "#FFFFFF",
  ink: "#15172A",
  muted: "#5B5F78",
  line: "#DCDFEA",
  accent: "#4338CA",
  danger: "#B91C1C",
  conflictEdge: "#DC2626",
  hatch: "rgba(185, 28, 28, 0.22)",
};
const FALLBACK = COURSE_PALETTE[COURSE_PALETTE.length - 1]!.light;

const PAD = 40;
const INNER = POSTER_WIDTH - 2 * PAD;
const GRID_TOP = 240;
const GRID_BOTTOM = 1080;
const HEAD_ROW = 48;
const TIME_COLUMN = 40;
const LEGEND_TOP = 1100;
const LEGEND_ROW = 46;
const LEGEND_COLUMNS = 3;
const FOOTER_RULE = 1244;
const PROVENANCE_TOP = 1254;
const DISCLAIMER_TOP = 1276;
const DISCLAIMER_LINE = 19;
const DISCLAIMER_MAX_LINES = 3;

/** Largest size in [min, max] at which `text` fits `maxWidth` (the caller still ellipsizes at `min`). */
function fitSize(measure: PosterMeasure, text: string, weight: CanvasWeight, max: number, min: number, maxWidth: number): number {
  let size = max;
  while (size > min && measure(text, size, weight) > maxWidth) size -= 2;
  return Math.max(size, min);
}

export function posterLayout(input: PosterInput, measure: PosterMeasure = estimateWidth): PosterCommand[] {
  const commands: PosterCommand[] = [];
  const text = (value: string, x: number, y: number, size: number, weight: CanvasWeight, color: string, maxWidth: number, align: PosterTextAlign = "left") => {
    if (!value || maxWidth <= 0) return;
    commands.push({ kind: "text", text: ellipsize((candidate) => measure(candidate, size, weight), value, maxWidth), x, y, size, weight, color, align });
  };

  commands.push({ kind: "rect", x: 0, y: 0, w: POSTER_WIDTH, h: POSTER_HEIGHT, fill: COLOR.page });

  // 0–220: app name, term, week, credits.
  text(APP_NAME, PAD, 40, 20, 800, COLOR.accent, INNER);
  text(input.termName, PAD, 72, fitSize(measure, input.termName, 800, 56, 40, INNER), 800, COLOR.ink, INNER);
  text(input.weekLabel, PAD, 140, 28, 800, COLOR.ink, INNER);
  text(`${input.credits} tín chỉ · ${input.courseCount} môn`, PAD, 180, 24, 400, COLOR.muted, INNER);

  // 240–1080: the week grid.
  const days = input.grid.days;
  const periods = Math.max(1, input.grid.periods);
  const left = PAD + TIME_COLUMN;
  const body = GRID_TOP + HEAD_ROW;
  const columnWidth = (INNER - TIME_COLUMN) / Math.max(1, days.length);
  const rowHeight = (GRID_BOTTOM - body) / periods;
  commands.push({ kind: "rect", x: PAD, y: GRID_TOP, w: INNER, h: GRID_BOTTOM - GRID_TOP, fill: COLOR.surface, stroke: COLOR.line, lineWidth: 1 });
  days.forEach((day, index) => text(dayLabel(day, "short"), left + index * columnWidth + columnWidth / 2, GRID_TOP + 12, 22, 800, COLOR.ink, columnWidth - 8, "center"));
  for (let period = 1; period <= periods; period += 1) {
    const y = body + (period - 1) * rowHeight;
    commands.push({ kind: "line", x1: PAD, y1: y, x2: PAD + INNER, y2: y, color: COLOR.line, lineWidth: 1 });
    text(String(period), PAD + TIME_COLUMN / 2, y + 8, 18, 400, COLOR.muted, TIME_COLUMN - 8, "center");
  }
  for (let index = 0; index < days.length; index += 1) {
    const x = left + index * columnWidth;
    commands.push({ kind: "line", x1: x, y1: GRID_TOP, x2: x, y2: GRID_BOTTOM, color: COLOR.line, lineWidth: 1 });
  }

  const blocks = input.grid.blocks.filter((block) => days.includes(block.day) && block.startPeriod <= periods);
  for (const block of blocks) {
    const column = days.indexOf(block.day);
    const laneWidth = columnWidth / Math.max(1, block.lanes);
    const x = left + column * columnWidth + block.lane * laneWidth + 3;
    const y = body + (block.startPeriod - 1) * rowHeight + 3;
    const w = laneWidth - 6;
    const h = (Math.min(block.endPeriod, periods) - block.startPeriod + 1) * rowHeight - 6;
    const color = input.colors[block.courseCode] ?? FALLBACK;
    commands.push({ kind: "rect", x, y, w, h, fill: color.bg });
    if (block.conflict) commands.push({ kind: "hatch", x, y, w, h, color: COLOR.hatch });
    commands.push({ kind: "rect", x, y, w: 5, h, fill: color.edge });
    commands.push({ kind: "rect", x, y, w, h, stroke: block.conflict ? COLOR.conflictEdge : color.edge, lineWidth: block.conflict ? 4 : 2 });
    // The conflict label leads, so a one-period block still says it in words, not only by colour and stripes.
    // Two lanes side by side leave ~60 px of text: sizes shrink (down to 14 px) before anything is ellipsized.
    const textWidth = w - 14;
    const line = (value: string, weight: CanvasWeight, max: number, ink: string) => ({ value, weight, size: fitSize(measure, value, weight, max, 14, textWidth), color: ink });
    const lines = [
      ...(block.conflict ? [line(POSTER_CONFLICT_LABEL, 800, 20, COLOR.danger)] : []),
      line(block.courseCode, 800, 26, color.ink),
      ...(block.room ? [line(block.room, 400, 20, color.ink)] : []),
    ];
    let lineY = y + 8;
    for (const item of lines) {
      if (lineY + item.size > y + h - 2) break;
      text(item.value, x + 10, lineY, item.size, item.weight, item.color, textWidth);
      lineY += item.size + 6;
    }
  }
  if (blocks.length === 0) text(POSTER_EMPTY_WEEK, PAD + INNER / 2, (body + GRID_BOTTOM) / 2 - 12, 24, 400, COLOR.muted, INNER - 2 * TIME_COLUMN, "center");

  // 1100–1240: colour legend, at most 8 courses, then "+N môn".
  const shown = input.legend.slice(0, POSTER_LEGEND_MAX);
  const rest = input.legend.length - shown.length;
  const slotWidth = INNER / LEGEND_COLUMNS;
  const slot = (index: number) => ({ x: PAD + (index % LEGEND_COLUMNS) * slotWidth, y: LEGEND_TOP + Math.floor(index / LEGEND_COLUMNS) * LEGEND_ROW });
  shown.forEach((entry, index) => {
    const { x, y } = slot(index);
    const color = input.colors[entry.code] ?? FALLBACK;
    commands.push({ kind: "rect", x, y: y + 4, w: 28, h: 28, fill: color.bg, stroke: color.edge, lineWidth: 2 });
    const room = slotWidth - 52;
    text(entry.code, x + 40, y + 8, 20, 800, COLOR.ink, room);
    const codeWidth = Math.min(room, measure(entry.code, 20, 800));
    text(entry.name, x + 40 + codeWidth + 8, y + 8, 20, 400, COLOR.muted, room - codeWidth - 8);
  });
  if (rest > 0) {
    const { x, y } = slot(shown.length);
    text(`+${rest} môn`, x, y + 8, 20, 800, COLOR.muted, slotWidth - 12);
  }

  // 1250–1330: provenance (dataset version first, so it survives an ellipsis) and the disclaimer.
  commands.push({ kind: "line", x1: PAD, y1: FOOTER_RULE, x2: PAD + INNER, y2: FOOTER_RULE, color: COLOR.line, lineWidth: 1 });
  text(provenanceLine(input.entry), PAD, PROVENANCE_TOP, 16, 400, COLOR.muted, INNER);
  const disclaimer = wrapText({ measureText: (candidate) => ({ width: measure(candidate, 15, 400) }) }, exportDisclaimer(input.entry), INNER);
  const kept = disclaimer.slice(0, DISCLAIMER_MAX_LINES);
  if (disclaimer.length > kept.length) kept[kept.length - 1] = `${kept[kept.length - 1]} ${disclaimer.slice(kept.length).join(" ")}`;
  kept.forEach((line, index) => text(line, PAD, DISCLAIMER_TOP + index * DISCLAIMER_LINE, 15, 400, COLOR.ink, INNER));

  return commands;
}

/** Copies only the allowed fields of the plan view into a `PosterInput` (see the privacy note at the top). */
export function buildPosterInput(view: PlanView, catalog: AppCatalog, week: number | undefined, colorOf: (courseCode: string) => CourseColor): PosterInput {
  const periods = visiblePeriods(view.sessions, catalog.maxPeriod);
  const layout = buildGridLayout(view.sessions, { ...(week !== undefined ? { week } : {}), maxPeriod: periods, conflictKeys: conflictKeys(view.conflicts, week) });
  const legend: PosterLegendEntry[] = [];
  const seen = new Set<string>();
  for (const session of view.sessions) {
    if (seen.has(session.courseCode)) continue;
    seen.add(session.courseCode);
    legend.push({ code: session.courseCode, name: session.courseName });
  }
  const colors: Record<string, ColorSet> = {};
  for (const entry of legend) colors[entry.code] = colorOf(entry.code).light;
  return {
    termName: catalog.term.name,
    weekLabel: week === undefined ? ALL_WEEKS_LABEL : view.week1 ? weekLabel(view.week1.date, week) : `Tuần ${week}`,
    credits: view.credits.knownTotal,
    courseCount: legend.length,
    grid: {
      days: layout.days,
      periods,
      blocks: layout.blocks.map((block) => ({
        day: block.day,
        startPeriod: block.startPeriod,
        endPeriod: block.endPeriod,
        lane: block.lane,
        lanes: block.lanes,
        conflict: block.conflict,
        courseCode: block.session.courseCode,
        ...(block.session.room ? { room: block.session.room } : {}),
      })),
    },
    colors,
    legend,
    entry: catalog.entry,
  };
}

function draw(context: CanvasRenderingContext2D, commands: readonly PosterCommand[]): void {
  context.textBaseline = "top";
  for (const command of commands) {
    switch (command.kind) {
      case "rect":
        if (command.fill) {
          context.fillStyle = command.fill;
          context.fillRect(command.x, command.y, command.w, command.h);
        }
        if (command.stroke) {
          context.strokeStyle = command.stroke;
          context.lineWidth = command.lineWidth ?? 1;
          context.strokeRect(command.x, command.y, command.w, command.h);
        }
        break;
      case "line":
        context.strokeStyle = command.color;
        context.lineWidth = command.lineWidth;
        context.beginPath();
        context.moveTo(command.x1, command.y1);
        context.lineTo(command.x2, command.y2);
        context.stroke();
        break;
      case "hatch":
        drawHatch(context, command.x, command.y, command.w, command.h, command.color);
        break;
      case "text":
        context.font = canvasFont(command.size, command.weight);
        context.fillStyle = command.color;
        context.textAlign = command.align;
        context.fillText(command.text, command.x, command.y);
        break;
    }
  }
}

/** Draws the poster on a 1080×1350 canvas (no device-pixel scaling: the bitmap is exactly that size) and encodes a PNG. */
export async function renderPoster(input: PosterInput): Promise<Blob> {
  await loadCanvasFonts([400, 800]);
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  const measure: PosterMeasure = (value, size, weight) => {
    context.font = canvasFont(size, weight);
    return context.measureText(value).width;
  };
  draw(context, posterLayout(input, measure));
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
  });
}
