import { describe, expect, it, vi } from "vitest";
import type { GridBlock } from "@ky-nay/export";
import { COURSE_PALETTE } from "../model/palette.js";
import { testMetadata } from "../test/fixture.js";
import { CANVAS_FONT_STACK } from "./canvas-kit.js";
import { renderPng } from "./png.js";

const UET_TIMEFRAME = testMetadata().timeFrame;

/** Records what the PNG export writes; jsdom has no canvas implementation. `styles` gets fillStyle/strokeStyle/font. */
function recordingCanvas(styles: string[] = []): string[] {
  const texts: string[] = [];
  const context = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === "fillText") return (text: string) => void texts.push(text);
      if (prop === "measureText") return (text: string) => ({ width: text.length * 7 });
      return () => undefined;
    },
    set: (_target, prop, value) => {
      if (prop === "fillStyle" || prop === "strokeStyle" || prop === "font") styles.push(String(value));
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["png"], { type: "image/png" })));
  return texts;
}

function block(sectionId: string, courseCode: string, startPeriod: number, endPeriod: number, lane: number): GridBlock {
  return {
    session: { key: `${sectionId}|s`, sectionId, courseCode, courseName: "Môn mẫu", sessionId: "s", kind: "LT", fixed: true, day: 2, startPeriod, endPeriod, weeks: [1], lecturers: [] },
    day: 2, startPeriod, endPeriod, lane, lanes: 2, conflict: true,
  };
}

describe("PNG export (REV-M3-010, QA-M4-002 / REV-M4-002)", () => {
  it("writes the conflict in words even on a one-period block", async () => {
    const texts = recordingCanvas();
    await renderPng({
      title: "Phương án", subtitle: "Tuần 1", frame: UET_TIMEFRAME, nonFixed: [], footerLines: [],
      layout: { days: [2], periods: [1, 2, 3], blocks: [block("SYN1 1", "SYN1", 1, 1, 0), block("SYN2 1", "SYN2", 1, 3, 1)] },
    });
    expect(texts).toContain("⚠ TRÙNG LỊCH · SYN1");
    expect(texts).toContain("⚠ TRÙNG LỊCH · SYN2");
  });

  it("writes override badges and from→to details on overridden blocks (QA-M4-002 / REV-M4-002)", async () => {
    const texts = recordingCanvas();
    const overriddenBlock: GridBlock = {
      session: {
        key: "SYN1003 1|s3",
        sectionId: "SYN1003 1",
        courseCode: "SYN1003",
        courseName: "Vật lý đại cương",
        sessionId: "s3",
        kind: "LT",
        fixed: true,
        day: 2,
        startPeriod: 1,
        endPeriod: 3,
        room: "305-G2",
        weeks: [1, 2, 3],
        lecturers: [],
        overrides: [
          {
            field: "room",
            source: "registration",
            from: "Hòa Lạc A101",
            to: "305-G2",
            badge: "Đã đổi phòng",
            detail: "Phòng học: Hòa Lạc A101 → 305-G2 (theo ĐKMH)",
          },
        ],
      },
      day: 2,
      startPeriod: 1,
      endPeriod: 3,
      lane: 0,
      lanes: 1,
      conflict: false,
    };
    await renderPng({
      title: "Phương án chính thức", subtitle: "Tuần 1", frame: UET_TIMEFRAME, nonFixed: [], footerLines: [],
      layout: { days: [2], periods: [1, 2, 3], blocks: [overriddenBlock] },
    });
    expect(texts).toContain("305-G2 · ★ Đã đổi phòng");
    expect(texts).toContain("Phòng học: Hòa Lạc A101 → 305-G2 (theo ĐKMH)");
  });

  it("fills blocks with the course colour (light values) and writes in Be Vietnam Pro (DESIGN-M6-001 §10)", async () => {
    const styles: string[] = [];
    const texts = recordingCanvas(styles);
    const violet = COURSE_PALETTE[0]!;
    const plain: GridBlock = { ...block("SYN1 1", "SYN1", 1, 2, 0), lanes: 1, conflict: false };
    await renderPng({
      title: "Phương án", subtitle: "Tuần 1", frame: UET_TIMEFRAME, nonFixed: [], footerLines: [],
      layout: { days: [2], periods: [1, 2, 3], blocks: [plain, block("SYN2 1", "SYN2", 3, 3, 0)] },
      colorOf: () => violet,
    });
    expect(styles).toContain(violet.light.bg);
    expect(styles).toContain(violet.light.edge);
    expect(styles).toContain(violet.light.ink);
    expect(styles).toContain("#B91C1C");
    expect(styles.filter((value) => value.includes("px ")).every((font) => font.includes(CANVAS_FONT_STACK))).toBe(true);
    expect(texts).toContain("SYN1");
    expect(texts).toContain("⚠ TRÙNG LỊCH · SYN2");
  });
});
