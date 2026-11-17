import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlan, type Plan } from "@ky-nay/domain";
import { dayLabel } from "@ky-nay/export";
import { ExportPanel } from "../components/ExportPanel.js";
import { buildAppCatalog, type AppCatalog } from "../model/catalog.js";
import { APP_NAME, exportDisclaimer, INDEPENDENCE_NOTE, provenanceLine } from "../model/labels.js";
import { assignCourseColors, COURSE_PALETTE, type CourseColor } from "../model/palette.js";
import { buildPlanView } from "../model/plan-view.js";
import { buildRegistrationPreview } from "../model/registration.js";
import { serveDataset, testMetadata, testTimetable, VERSION } from "../test/fixture.js";
import { canvasFont, CANVAS_FONT_STACK, loadCanvasFonts } from "./canvas-kit.js";
import {
  ALL_WEEKS_LABEL,
  buildPosterInput,
  POSTER_CONFLICT_LABEL,
  POSTER_EMPTY_WEEK,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  posterLayout,
  renderPoster,
  type PosterCommand,
  type PosterInput,
} from "./poster.js";

/** Identity and fee values of the redacted portal sample and of the synthetic portal file below (same list as m4-registration.test.tsx). */
const PII_TOKENS = [
  "Nguyễn Văn Bí Mật",
  "19/08/2005",
  "23029876",
  "CNTT Chuẩn Quốc Tế",
  "QH-2023-I/CQ",
  "1,500,000",
  "3,000,000",
  "Sinh Viên Mẫu",
  "01/01/2000",
  "00000000",
  "Chương trình mẫu",
  "QH-0000-X/XX",
  "500,000",
  "1,900,000",
  "23029876_secret_ketqua.doc",
];

type Recorded = { canvases: HTMLCanvasElement[]; texts: string[]; fonts: string[]; fills: string[] };

/** Records what the poster draws; jsdom has no canvas implementation (same approach as png.test.ts). */
function recordingCanvas(): Recorded {
  const recorded: Recorded = { canvases: [], texts: [], fonts: [], fills: [] };
  const context = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === "fillText") return (text: string) => void recorded.texts.push(text);
      if (prop === "measureText") return (text: string) => ({ width: text.length * 7 });
      return () => undefined;
    },
    set: (_target, prop, value) => {
      if (prop === "font") recorded.fonts.push(String(value));
      if (prop === "fillStyle") recorded.fills.push(String(value));
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    recorded.canvases.push(this);
    return context as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement["getContext"]);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["png"], { type: "image/png" })));
  return recorded;
}

afterEach(() => vi.restoreAllMocks());

const { entry } = serveDataset({ status: "published" });
const catalog: AppCatalog = buildAppCatalog({ entry, timetable: testTimetable(), metadata: testMetadata(), cachedAt: "2026-10-25T00:00:00.000Z" });

function colorsFor(plan: Plan): (courseCode: string) => CourseColor {
  const map = assignCourseColors(plan.picks.map((pick) => catalog.sectionById.get(pick.sectionId)?.courseCode ?? pick.sectionId));
  return (code) => map.get(code) ?? COURSE_PALETTE[0]!;
}

function plan(picks: Plan["picks"], planKind: Plan["planKind"] = "draft"): Plan {
  return createPlan({ id: `${planKind}-1`, term: catalog.term.id, datasetVersion: VERSION, name: "Phương án bí mật của tôi", planKind, cohort: "K69", picks }, "2026-10-25T00:00:00.000Z");
}

function textsOf(commands: readonly PosterCommand[]): string[] {
  return commands.flatMap((command) => (command.kind === "text" ? [command.text] : []));
}

/** Every string the poster may draw, built from the input's allowed fields only. */
function allowedTexts(input: PosterInput): { exact: string[]; disclaimer: string } {
  const exact = [
    APP_NAME,
    input.termName,
    input.weekLabel,
    `${input.credits} tín chỉ · ${input.courseCount} môn`,
    POSTER_CONFLICT_LABEL,
    POSTER_EMPTY_WEEK,
    provenanceLine(input.entry),
    ...input.grid.days.map((day) => dayLabel(day, "short")),
    ...Array.from({ length: input.grid.periods }, (_, index) => String(index + 1)),
    ...input.grid.blocks.flatMap((block) => [block.courseCode, ...(block.room ? [block.room] : [])]),
    ...input.legend.flatMap((item) => [item.code, item.name]),
    ...Array.from({ length: input.legend.length }, (_, index) => `+${index} môn`),
  ];
  return { exact, disclaimer: exportDisclaimer(input.entry) };
}

function expectOnlyAllowed(texts: readonly string[], input: PosterInput): void {
  const { exact, disclaimer } = allowedTexts(input);
  for (const text of texts) {
    const base = text.endsWith("…") ? text.slice(0, -1) : text;
    const ok = exact.includes(text) || (text.endsWith("…") && exact.some((value) => value.startsWith(base))) || disclaimer.includes(base);
    expect(ok, `unexpected poster text: ${text}`).toBe(true);
  }
}

describe("share poster (AC-M6-15, DESIGN-M6-001 §10)", () => {
  const conflicting = plan([{ sectionId: "SYN1001 1", group: "1" }, { sectionId: "SYN1003 1" }, { sectionId: "SYN3001 1" }]);
  const view = buildPlanView(conflicting, catalog);

  it("renders exactly 1080×1350 in Be Vietnam Pro, with the dataset version and the independence sentence", async () => {
    const recorded = recordingCanvas();
    const input = buildPosterInput(view, catalog, 9, colorsFor(conflicting));
    const blob = await renderPoster(input);
    expect(blob.type).toBe("image/png");
    expect(recorded.canvases).toHaveLength(1);
    expect([recorded.canvases[0]!.width, recorded.canvases[0]!.height]).toEqual([POSTER_WIDTH, POSTER_HEIGHT]);
    expect([POSTER_WIDTH, POSTER_HEIGHT]).toEqual([1080, 1350]);
    expect(recorded.texts.some((text) => text.includes(entry.datasetVersion))).toBe(true);
    expect(recorded.texts.some((text) => text.includes(INDEPENDENCE_NOTE))).toBe(true);
    expect(recorded.texts).toContain(catalog.term.name);
    expect(recorded.fonts.length).toBeGreaterThan(0);
    for (const font of recorded.fonts) {
      expect(font).toContain(CANVAS_FONT_STACK);
      expect(font).toMatch(/^(400|800) /);
    }
    expectOnlyAllowed(recorded.texts, input);
  });

  it("draws blocks in the course colour and marks conflicts with stripes, a red border and the word", () => {
    const colorOf = colorsFor(conflicting);
    const input = buildPosterInput(view, catalog, 9, colorOf);
    const commands = posterLayout(input);
    // Week 9: SYN1001 1 (T2 1–3, every week) and SYN1003 1 (T2 1–3, weeks 9–15) overlap.
    const conflicts = input.grid.blocks.filter((block) => block.conflict);
    expect(conflicts.map((block) => block.courseCode).sort()).toEqual(["SYN1001", "SYN1003"]);
    expect(commands.filter((command) => command.kind === "hatch")).toHaveLength(2);
    expect(textsOf(commands).filter((text) => text === POSTER_CONFLICT_LABEL)).toHaveLength(2);
    expect(commands.some((command) => command.kind === "rect" && command.stroke === "#DC2626" && command.lineWidth === 4)).toBe(true);
    const fills = commands.flatMap((command) => (command.kind === "rect" && command.fill ? [command.fill] : []));
    expect(fills).toContain(colorOf("SYN1001").light.bg);
    expect(fills).toContain(colorOf("SYN1003").light.bg);
    expect(fills).toContain(colorOf("SYN1001").light.edge);
    // Every command stays on the 1080×1350 canvas.
    for (const command of commands) {
      if (command.kind === "rect" || command.kind === "hatch") {
        expect(command.x).toBeGreaterThanOrEqual(0);
        expect(command.y).toBeGreaterThanOrEqual(0);
        expect(command.x + command.w).toBeLessThanOrEqual(POSTER_WIDTH);
        expect(command.y + command.h).toBeLessThanOrEqual(POSTER_HEIGHT);
      }
      if (command.kind === "text") expect(command.y + command.size).toBeLessThanOrEqual(POSTER_HEIGHT);
    }
  });

  it("uses visiblePeriods for the grid, the week label or 'Tất cả các tuần', and counts credits and courses", () => {
    const week = buildPosterInput(view, catalog, 9, colorsFor(conflicting));
    expect(week.grid.periods).toBe(10);
    expect(week.weekLabel).toMatch(/^Tuần 9 · /);
    expect(week.credits).toBe(view.credits.knownTotal);
    expect(week.courseCount).toBe(3);
    expect(textsOf(posterLayout(week))).toContain(`${view.credits.knownTotal} tín chỉ · 3 môn`);
    const all = buildPosterInput(view, catalog, undefined, colorsFor(conflicting));
    expect(all.weekLabel).toBe(ALL_WEEKS_LABEL);
    // The online course has no fixed slot: it is in the legend but not in the grid.
    expect(all.legend.map((item) => item.code)).toContain("SYN3001");
    expect(all.grid.blocks.map((block) => block.courseCode)).not.toContain("SYN3001");
  });

  it("says so when the chosen week has no class", () => {
    const seminar = plan([{ sectionId: "SYN4001 1" }]);
    const input = buildPosterInput(buildPlanView(seminar, catalog), catalog, 1, colorsFor(seminar));
    expect(input.grid.blocks).toHaveLength(0);
    expect(textsOf(posterLayout(input))).toContain(POSTER_EMPTY_WEEK);
  });

  it("lists at most 8 courses in the legend, then '+N môn'", () => {
    const base = buildPosterInput(view, catalog, 9, colorsFor(conflicting));
    const legend = Array.from({ length: 11 }, (_, index) => ({ code: `SYN${5000 + index}`, name: `Môn số ${index}` }));
    const input: PosterInput = { ...base, legend, courseCount: legend.length, colors: Object.fromEntries(legend.map((item, index) => [item.code, COURSE_PALETTE[index % COURSE_PALETTE.length]!.light])) };
    const texts = textsOf(posterLayout(input));
    expect(legend.slice(0, 8).every((item) => texts.includes(item.code))).toBe(true);
    expect(texts).not.toContain("SYN5008");
    expect(texts).toContain("+3 môn");
    expectOnlyAllowed(texts, input);
  });

  it("keeps a long term name on one line by shrinking it, never past the canvas", () => {
    const base = buildPosterInput(view, catalog, 9, colorsFor(conflicting));
    const input: PosterInput = { ...base, termName: "Học kỳ II năm học 2026–2027 (dữ liệu mẫu tổng hợp để thử nghiệm giao diện)" };
    const title = posterLayout(input).find((command): command is Extract<PosterCommand, { kind: "text" }> => command.kind === "text" && command.weight === 800 && command.y === 72);
    expect(title).toBeDefined();
    expect(title!.size).toBeLessThan(56);
    expect(title!.size).toBeGreaterThanOrEqual(40);
  });

  it("leaks nothing of a registration file: final plans from the redacted sample and a synthetic portal file", async () => {
    const draftPlan = plan([{ sectionId: "SYN1001 1", group: "1" }, { sectionId: "SYN4001 1" }]);
    const sample = buildRegistrationPreview({ bytes: new Uint8Array(readFileSync(resolve(process.cwd(), "../../fixtures/redacted-registration/portal-format.doc"))), catalog, draftPlan });
    const synthetic = buildRegistrationPreview({ bytes: new TextEncoder().encode(portalHtml()), catalog, draftPlan, now: "2026-11-09T10:11:12.000Z" });
    expect(sample.ok).toBe(true);
    expect(synthetic.ok).toBe(true);
    expect(synthetic.plan!.picks.length).toBeGreaterThan(0);
    expect(synthetic.unmatched.length).toBeGreaterThan(0);
    expect(synthetic.overrides.length).toBeGreaterThan(0);
    for (const preview of [sample, synthetic]) {
      const finalPlan = preview.plan!;
      expect(finalPlan.planKind).toBe("final");
      const finalView = buildPlanView(finalPlan, catalog);
      const forbidden = [
        ...PII_TOKENS,
        finalPlan.name,
        finalPlan.id,
        ...preview.unmatched.map((item) => item.sectionId),
        ...preview.overrides.map((item) => item.detail),
        ...preview.warnings.map((item) => (typeof item === "string" ? item : JSON.stringify(item))),
      ].filter((token) => token.length > 0);
      for (const week of [undefined, 1, 4, 9] as const) {
        const recorded = recordingCanvas();
        const input = buildPosterInput(finalView, catalog, week, colorsFor(finalPlan));
        const serialized = JSON.stringify(input);
        for (const token of forbidden) expect(serialized, token).not.toContain(token);
        await renderPoster(input);
        expect(recorded.texts.length).toBeGreaterThan(0);
        for (const text of recorded.texts) for (const token of forbidden) expect(text, token).not.toContain(token);
        expectOnlyAllowed(recorded.texts, input);
        vi.restoreAllMocks();
      }
    }
  });

  it("waits for both Be Vietnam Pro weights before drawing and tolerates a missing or failing FontFaceSet", async () => {
    const load = vi.fn(() => Promise.resolve([] as FontFace[]));
    await loadCanvasFonts([400, 800], { load } as unknown as FontFaceSet);
    expect(load.mock.calls.map((call) => (call as unknown[])[0])).toEqual([canvasFont(16, 400), canvasFont(16, 800)]);
    await expect(loadCanvasFonts([400, 800], undefined)).resolves.toBeUndefined();
    await expect(loadCanvasFonts([800], { load: () => Promise.reject(new Error("offline")) } as unknown as FontFaceSet)).resolves.toBeUndefined();
  });
});

describe("ExportPanel 'Ảnh' tile (DESIGN-M6-001 §10, AC-M6-13)", () => {
  it("opens the 'Tải ảnh' sheet with the week PNG and the poster, each with its own file name", async () => {
    recordingCanvas();
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    // jsdom has no object URLs; this file runs in its own environment, so the stubs do not leak.
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:poster"), revokeObjectURL: vi.fn() });
    const draft = plan([{ sectionId: "SYN1001 1", group: "1" }, { sectionId: "SYN1003 1" }]);
    const user = userEvent.setup();
    render(createElement(ExportPanel, { plan: draft, view: buildPlanView(draft, catalog), catalog, week: 3, colorOf: colorsFor(draft) }));
    const tile = screen.getByRole("button", { name: "Ảnh Tải ảnh (.png)" });
    expect(tile.getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByRole("button", { name: "Poster chia sẻ (.png)" })).toBeNull();

    await user.click(tile);
    expect(screen.getByRole("heading", { name: "Tải ảnh" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Poster chia sẻ (.png)" }));
    await waitFor(() => expect(downloads).toEqual(["ky-nay-2026-2027-h2-tuan-3-poster.png"]));
    expect(screen.queryByRole("button", { name: "Poster chia sẻ (.png)" })).toBeNull();

    await user.click(tile);
    await user.click(screen.getByRole("button", { name: "Ảnh lịch tuần (.png)" }));
    await waitFor(() => expect(downloads).toEqual(["ky-nay-2026-2027-h2-tuan-3-poster.png", "ky-nay-2026-2027-h2-tuan-3.png"]));
    expect(screen.getByText("Đã tạo ky-nay-2026-2027-h2-tuan-3.png.")).toBeTruthy();
  });
});

function portalHtml(): string {
  return `<!DOCTYPE html><html><body>
  <table><tr><td>Họ và tên</td><td><b>Nguyễn Văn Bí Mật</b></td><td>Ngày sinh</td><td><b>19/08/2005</b></td><td>Mã sinh viên</td><td><b>23029876</b></td></tr>
  <tr><td>Chương trình đào tạo</td><td><b>CNTT Chuẩn Quốc Tế</b></td><td>Khóa</td><td><b>QH-2023-I/CQ</b></td></tr></table>
  <table>
    <tr><th>STT</th><th>Mã môn học</th><th>Môn học</th><th>Số tín chỉ</th><th>Trạng thái</th><th>Học phí</th><th>Lớp môn học</th><th>Thứ</th><th>Tiết</th><th>Giảng đường</th></tr>
    <tr><td>1</td><td>SYN1003</td><td>Vật lý đại cương</td><td>3</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>SYN1003 1</td><td>T2</td><td>4 - 6</td><td>305-G2</td></tr>
    <tr><td>2</td><td>SYN4001</td><td>Seminar chuyên đề</td><td>2</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>SYN4001 1</td><td>T7</td><td>4 - 6</td><td>101-G2</td></tr>
    <tr><td>3</td><td>INT9999</td><td>Môn ngoài TKB</td><td>3</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>INT9999 1</td><td>T6</td><td>1 - 3</td><td>101-G2</td></tr>
  </table></body></html>`;
}
