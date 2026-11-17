/**
 * PNG export drawn directly on a canvas from the shared grid layout (ADR-0010 §5). M6 (DESIGN-M6-001 §10): blocks in
 * the course colour (light values) and Be Vietnam Pro; SCALE, the layout and every text are unchanged.
 */
import type { SessionKind, TimeFrame } from "@ky-nay/domain";
import { dayLabel, kindText, type GridLayout, type ScheduledSession } from "@ky-nay/export";
import type { CourseColor } from "../model/palette.js";
import { canvasFont, drawHatch, loadCanvasFonts, wrapText } from "./canvas-kit.js";

export type PngInput = {
  title: string;
  subtitle: string;
  layout: GridLayout;
  frame: TimeFrame;
  nonFixed: readonly ScheduledSession[];
  footerLines: readonly string[];
  /** Course colour (light values are used on the canvas, DESIGN-M6-001 §3). Without it, blocks use the per-kind colours. */
  colorOf?: (courseCode: string) => CourseColor;
};

const WIDTH = 1600;
const MARGIN = 32;
const TIME_COLUMN = 120;
const HEADER_ROW = 44;
const ROW = 58;
const SCALE = 2;
const FILL: Record<SessionKind, string> = { LT: "#e8f0fe", TH: "#e6f4ea", BT: "#fef7e0", ONL: "#f3e8fd", OTHER: "#eceff1" };
const STROKE: Record<SessionKind, string> = { LT: "#0b57d0", TH: "#146c2e", BT: "#8a6100", ONL: "#7b1fa2", OTHER: "#455a64" };
const INK = "#15172A";
const MUTED = "#5B5F78";
const DANGER = "#B91C1C";
const HATCH = "rgba(185, 28, 28, 0.25)";

function footerText(input: PngInput): string[] {
  const nonFixed = input.nonFixed.length === 0 ? [] : [`Không có giờ cố định (không xếp vào lưới): ${input.nonFixed.map((session) => `${session.courseCode} ${session.courseName} (${session.sectionId})`).join("; ")}`];
  return [...nonFixed, ...input.footerLines];
}

export async function renderPng(input: PngInput): Promise<Blob> {
  await loadCanvasFonts([400, 800]);
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) throw new Error("Canvas 2D is not available");
  measure.font = canvasFont(15);
  const footer = footerText(input).flatMap((line) => wrapText(measure, line, WIDTH - 2 * MARGIN));
  const gridTop = MARGIN + 86;
  const gridHeight = HEADER_ROW + input.layout.periods.length * ROW;
  const height = gridTop + gridHeight + 24 + footer.length * 22 + MARGIN;
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext("2d")!;
  context.scale(SCALE, SCALE);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, WIDTH, height);
  context.textBaseline = "top";

  context.fillStyle = INK;
  context.font = canvasFont(28, 800);
  context.fillText(input.title, MARGIN, MARGIN, WIDTH - 2 * MARGIN);
  context.font = canvasFont(17);
  context.fillStyle = MUTED;
  context.fillText(input.subtitle, MARGIN, MARGIN + 42, WIDTH - 2 * MARGIN);

  const columnWidth = (WIDTH - 2 * MARGIN - TIME_COLUMN) / input.layout.days.length;
  const left = MARGIN + TIME_COLUMN;
  context.strokeStyle = "#c9ced6";
  context.lineWidth = 1;
  context.font = canvasFont(16, 800);
  context.fillStyle = INK;
  input.layout.days.forEach((day, index) => {
    context.fillText(dayLabel(day), left + index * columnWidth + 8, gridTop + 12, columnWidth - 16);
  });
  context.font = canvasFont(14);
  input.layout.periods.forEach((period, index) => {
    const y = gridTop + HEADER_ROW + index * ROW;
    const time = input.frame.periods.find((item) => item.no === period);
    context.fillStyle = INK;
    context.fillText(`Tiết ${period}`, MARGIN + 6, y + 8);
    context.fillStyle = MUTED;
    if (time) context.fillText(`${time.start}–${time.end}`, MARGIN + 6, y + 28);
    context.beginPath();
    context.moveTo(MARGIN, y);
    context.lineTo(WIDTH - MARGIN, y);
    context.stroke();
  });
  for (let index = 0; index <= input.layout.days.length; index += 1) {
    const x = left + index * columnWidth;
    context.beginPath();
    context.moveTo(x, gridTop);
    context.lineTo(x, gridTop + gridHeight);
    context.stroke();
  }
  context.strokeRect(MARGIN, gridTop, WIDTH - 2 * MARGIN, gridHeight);

  for (const block of input.layout.blocks) {
    const column = input.layout.days.indexOf(block.day);
    const laneWidth = columnWidth / block.lanes;
    const x = left + column * columnWidth + block.lane * laneWidth + 3;
    const y = gridTop + HEADER_ROW + (block.startPeriod - 1) * ROW + 3;
    const w = laneWidth - 6;
    const h = (block.endPeriod - block.startPeriod + 1) * ROW - 6;
    const kind = block.session.kind;
    const color = input.colorOf?.(block.session.courseCode).light;
    context.fillStyle = color?.bg ?? FILL[kind];
    context.fillRect(x, y, w, h);
    if (block.conflict) drawHatch(context, x, y, w, h, HATCH);
    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    // The conflict text leads the first line so even a one-period block shows it in words, not only by colour (REV-M3-010).
    // Overridden sessions also include their override badge/detail on the room line (QA-M4-002 / REV-M4-002).
    const overrideBadges = block.session.overrides ? [...new Set(block.session.overrides.map((item) => item.badge))] : [];
    const overrideDetailText = block.session.overrides && block.session.overrides.length > 0 ? block.session.overrides.map((item) => item.detail).join("; ") : "";
    const roomLineText = [block.session.room ?? "", overrideBadges.length > 0 ? `★ ${overrideBadges.join(", ")}` : ""].filter(Boolean).join(" · ");
    const lines = [
      block.conflict
        ? { text: `⚠ TRÙNG LỊCH · ${block.session.courseCode}`, font: canvasFont(14, 800) }
        : { text: block.session.courseCode, font: canvasFont(15, 800) },
      { text: block.session.courseName, font: canvasFont(13) },
      { text: [kindText(kind), block.session.group && block.session.group !== "CL" ? `nhóm ${block.session.group}` : ""].filter(Boolean).join(" · "), font: canvasFont(13) },
      { text: roomLineText, font: overrideBadges.length > 0 ? canvasFont(13, 800) : canvasFont(13) },
      ...(overrideDetailText ? [{ text: overrideDetailText, font: canvasFont(12) }] : []),
    ];
    let lineY = y + 5;
    for (const line of lines) {
      if (!line.text || lineY + 16 > y + h) continue;
      context.font = line.font;
      context.fillStyle = line.text.startsWith("⚠") ? DANGER : color?.ink ?? INK;
      context.fillText(line.text, x + 6, lineY, w - 12);
      lineY += 18;
    }
    context.restore();
    context.strokeStyle = block.conflict ? DANGER : color?.edge ?? STROKE[kind];
    context.lineWidth = block.conflict ? 3 : 1.5;
    context.strokeRect(x, y, w, h);
  }

  context.font = canvasFont(15);
  context.fillStyle = INK;
  footer.forEach((line, index) => context.fillText(line, MARGIN, gridTop + gridHeight + 20 + index * 22));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
  });
}
