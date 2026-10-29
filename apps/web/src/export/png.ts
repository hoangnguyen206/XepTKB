/** PNG export drawn directly on a canvas from the shared grid layout (ADR-0010 §5). */
import type { SessionKind, TimeFrame } from "@ky-nay/domain";
import { dayLabel, kindLabel, type GridLayout, type ScheduledSession } from "@ky-nay/export";

export type PngInput = {
  title: string;
  subtitle: string;
  layout: GridLayout;
  frame: TimeFrame;
  nonFixed: readonly ScheduledSession[];
  footerLines: readonly string[];
};

const WIDTH = 1600;
const MARGIN = 32;
const TIME_COLUMN = 120;
const HEADER_ROW = 44;
const ROW = 58;
const SCALE = 2;
const FONT = '"Segoe UI", "Noto Sans", Roboto, Arial, sans-serif';
const FILL: Record<SessionKind, string> = { LT: "#e8f0fe", TH: "#e6f4ea", BT: "#fef7e0", ONL: "#f3e8fd", OTHER: "#eceff1" };
const STROKE: Record<SessionKind, string> = { LT: "#0b57d0", TH: "#146c2e", BT: "#8a6100", ONL: "#7b1fa2", OTHER: "#455a64" };

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
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

function footerText(input: PngInput): string[] {
  const nonFixed = input.nonFixed.length === 0 ? [] : [`Không có giờ cố định (không xếp vào lưới): ${input.nonFixed.map((session) => `${session.courseCode} ${session.courseName} (${session.sectionId})`).join("; ")}`];
  return [...nonFixed, ...input.footerLines];
}

export function renderPng(input: PngInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) return Promise.reject(new Error("Canvas 2D is not available"));
  measure.font = `15px ${FONT}`;
  const footer = footerText(input).flatMap((line) => wrap(measure, line, WIDTH - 2 * MARGIN));
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

  context.fillStyle = "#1b1f24";
  context.font = `bold 28px ${FONT}`;
  context.fillText(input.title, MARGIN, MARGIN, WIDTH - 2 * MARGIN);
  context.font = `17px ${FONT}`;
  context.fillStyle = "#4a5360";
  context.fillText(input.subtitle, MARGIN, MARGIN + 42, WIDTH - 2 * MARGIN);

  const columnWidth = (WIDTH - 2 * MARGIN - TIME_COLUMN) / input.layout.days.length;
  const left = MARGIN + TIME_COLUMN;
  context.strokeStyle = "#c9ced6";
  context.lineWidth = 1;
  context.font = `bold 16px ${FONT}`;
  context.fillStyle = "#1b1f24";
  input.layout.days.forEach((day, index) => {
    context.fillText(dayLabel(day), left + index * columnWidth + 8, gridTop + 12, columnWidth - 16);
  });
  context.font = `14px ${FONT}`;
  input.layout.periods.forEach((period, index) => {
    const y = gridTop + HEADER_ROW + index * ROW;
    const time = input.frame.periods.find((item) => item.no === period);
    context.fillStyle = "#1b1f24";
    context.fillText(`Tiết ${period}`, MARGIN + 6, y + 8);
    context.fillStyle = "#4a5360";
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
    context.fillStyle = FILL[kind];
    context.fillRect(x, y, w, h);
    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    if (block.conflict) {
      context.strokeStyle = "rgba(179, 38, 30, 0.25)";
      context.lineWidth = 6;
      for (let offset = -h; offset < w; offset += 18) {
        context.beginPath();
        context.moveTo(x + offset, y + h);
        context.lineTo(x + offset + h, y);
        context.stroke();
      }
    }
    const lines = [
      { text: block.session.courseCode, font: `bold 15px ${FONT}` },
      { text: block.session.courseName, font: `13px ${FONT}` },
      { text: `${kindLabel(kind)}${block.session.group && block.session.group !== "CL" ? ` · nhóm ${block.session.group}` : ""}`, font: `13px ${FONT}` },
      { text: block.session.room ?? "", font: `13px ${FONT}` },
      ...(block.conflict ? [{ text: "⚠ TRÙNG LỊCH", font: `bold 13px ${FONT}` }] : []),
    ];
    let lineY = y + 5;
    for (const line of lines) {
      if (!line.text || lineY + 16 > y + h) continue;
      context.font = line.font;
      context.fillStyle = line.text.startsWith("⚠") ? "#b3261e" : "#1b1f24";
      context.fillText(line.text, x + 6, lineY, w - 12);
      lineY += 18;
    }
    context.restore();
    context.strokeStyle = block.conflict ? "#b3261e" : STROKE[kind];
    context.lineWidth = block.conflict ? 3 : 1.5;
    context.strokeRect(x, y, w, h);
  }

  context.font = `15px ${FONT}`;
  context.fillStyle = "#1b1f24";
  footer.forEach((line, index) => context.fillText(line, MARGIN, gridTop + gridHeight + 20 + index * 22));

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
  });
}
