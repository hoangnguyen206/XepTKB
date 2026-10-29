/**
 * G3a Tester regression cases for M3 (TEST-M3-001) on the production build. Synthetic data only:
 * datasets are crafted in-test, hashed, and served through Playwright routes.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

type Json = Record<string, unknown>;
const source = { artifactId: "qa-e2e:synthetic", sourceType: "timetable" };
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const fixed = (id: string, day: number, start: number, end: number, weeks: number[], patch: Json = {}) =>
  ({ id, day, startPeriod: start, endPeriod: end, frame: "uet-default", weeks, weekOrigin: "explicit", kind: "LT", group: "CL", lecturers: ["Mẫu QA"], source, confidence: "deterministic", ...patch });
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** Builds a hashed manifest + artifacts from the real synthetic metadata and the given sections. */
async function serveCrafted(page: Page, options: { version: string; courses: Json[]; sections: [string, Json[], Json?][]; termName?: string; sourcePatch?: Json }): Promise<void> {
  const data = new URL("../public/data/", import.meta.url);
  const real = JSON.parse(readFileSync(new URL("manifest.json", data), "utf8")) as { datasets: Json[] };
  const h2 = real.datasets.find((entry) => entry.term === "2026-2027-h2") as Json & { artifacts: { kind: string; url: string }[] };
  const meta = JSON.parse(readFileSync(new URL(h2.artifacts.find((artifact) => artifact.kind === "metadata")!.url, data), "utf8")) as Json & { term: Json };
  const { version } = options;
  const sections = options.sections.map(([id, sessions, patch]) => ({ id, courseCode: id.split(" ")[0], homeClasses: ["K69-QA"], online: false, sessions, source, datasetVersion: version, warnings: [], ...patch }));
  const bodies = new Map<string, string>([
    [`qa/${version}/timetable.json`, JSON.stringify({ schemaVersion: "0.2.0", datasetVersion: version, school: "uet", term: "2026-2027-h2", courses: options.courses, sections })],
    [`qa/${version}/metadata.json`, JSON.stringify({ ...meta, datasetVersion: version, term: { ...meta.term, ...(options.termName ? { name: options.termName } : {}) } })],
  ]);
  const entry = {
    ...h2,
    datasetVersion: version,
    termName: options.termName ?? h2.termName,
    source: { ...(h2.source as Json), ...options.sourcePatch },
    artifacts: [...bodies.entries()].map(([url, body]) => ({ kind: url.endsWith("timetable.json") ? "timetable" : "metadata", url, sha256: sha(body), bytes: Buffer.byteLength(body) })),
  };
  await page.route("**/data/manifest.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ schemaVersion: "1.0", generatedAt: "2026-10-25T00:00:00.000Z", datasets: [entry] }) }));
  await page.route("**/data/qa/**", (route) => route.fulfill({ contentType: "application/json", body: bodies.get(new URL(route.request().url()).pathname.split("/data/")[1]!) ?? "" }));
}

async function start(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("heading", { name: "Phương án nháp" })).toBeVisible();
}

async function open(page: Page, code: string): Promise<void> {
  await page.getByLabel("Mã hoặc tên môn").fill(code);
  const toggle = page.getByRole("button", { name: new RegExp(`^${code}`) });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

const course = (code: string, name: string) => ({ code, altCodes: [], name, normalizedName: name.toLowerCase(), credits: 3, school: "uet" });

test("QA-M3 — PRD AC-01 exact case, adjacency, week-scoped grid flags and a group switch in the UI", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await serveCrafted(page, {
    version: "qa-e2e-conflict.1",
    courses: [course("QAA001", "Môn A"), course("QAB001", "Môn B"), course("QAC001", "Môn C"), course("QAD001", "Môn D")],
    sections: [
      ["QAA001 1", [fixed("a-cl", 3, 4, 6, range(1, 15)), fixed("a-g1", 4, 1, 3, range(2, 15), { kind: "TH", group: "1" }), fixed("a-g2", 5, 1, 3, range(2, 15), { kind: "TH", group: "2" })]],
      ["QAB001 1", [fixed("b1", 3, 5, 7, [8, 9, 10])]],
      ["QAC001 1", [fixed("c1", 5, 2, 2, [5])]],
      ["QAD001 1", [fixed("d1", 3, 7, 9, range(1, 15))]],
    ],
  });
  await start(page);
  await open(page, "QAA001");
  const a = page.getByRole("article", { name: "Lớp QAA001 1" });
  await a.getByLabel("Nhóm 1").check();
  await a.getByRole("button", { name: "Chọn lớp này" }).click();
  await open(page, "QAB001");
  await expect(page.getByRole("article", { name: "Lớp QAB001 1" }).getByText("⚠ Trùng lịch với QAA001 1 (Môn A): Thứ 3, tiết 5–6, tuần 8–10")).toBeVisible();
  await open(page, "QAD001");
  await expect(page.getByRole("article", { name: "Lớp QAD001 1" }).locator(".preview-list")).toHaveCount(0);
  await open(page, "QAC001");
  const c = page.getByRole("article", { name: "Lớp QAC001 1" });
  await expect(c.locator(".preview-list")).toHaveCount(0);
  await c.getByRole("button", { name: "Chọn lớp này" }).click();
  await open(page, "QAA001");
  await a.getByLabel("Nhóm 2").check();
  await expect(a.getByText("⚠ Trùng lịch với QAC001 1 (Môn C): Thứ 5, tiết 2, tuần 5")).toBeVisible();
  await a.getByRole("button", { name: "Đổi nhóm" }).click();
  await expect(page.locator(".plan-bar")).toContainText("⚠ 1 chỗ trùng lịch");
  await page.getByLabel("Chọn tuần").selectOption("5");
  await expect(page.getByRole("region", { name: /Lưới thời khóa biểu tuần 5/ }).locator(".block.is-conflict")).toHaveCount(2);
  await page.getByLabel("Chọn tuần").selectOption("6");
  await expect(page.getByRole("region", { name: /Lưới thời khóa biểu tuần 6/ }).locator(".block.is-conflict")).toHaveCount(0);
});

test("QA-M3 — hostile manifest and dataset strings stay inert in the UI and the Word export", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const payload = '<img src=x onerror="window.__qaXss=1">';
  await serveCrafted(page, {
    version: "qa-e2e-xss.1",
    termName: `HK ${payload}`,
    sourcePatch: { documentRef: '<script>window.__qaXss=2</script>', publishedBy: '"><svg onload="window.__qaXss=3">' },
    courses: [course("QAX001", `<b>Môn</b> ${payload}`)],
    sections: [["QAX001 1", [fixed("x1", 2, 1, 3, range(1, 15), { room: payload, campus: payload, lecturers: [payload] })], { homeClasses: [payload] }]],
  });
  await start(page);
  await page.getByRole("tab", { name: "Tìm môn" }).click();
  await open(page, "QAX001");
  await page.getByRole("article", { name: "Lớp QAX001 1" }).getByRole("button", { name: "Chọn lớp này" }).click();
  await page.getByRole("button", { name: /Dữ liệu mẫu \(tổng hợp\)/ }).click();
  const provenance = page.getByRole("region", { name: "Nguồn và phiên bản dữ liệu" });
  await expect(provenance.getByText("<script>window.__qaXss=2</script>")).toBeVisible();
  await expect(provenance.getByText(`HK ${payload}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("tab", { name: /^Phương án/ }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tải Word (.doc)" }).click()]);
  const word = readFileSync(await download.path(), "utf8");
  for (const raw of ["<img src", "<script>", "<svg", "<b>Môn"]) expect(word).not.toContain(raw);
  expect(word).toContain("&lt;img src=x onerror=&quot;window.__qaXss=1&quot;&gt;");
  expect(await page.evaluate(() => ({ xss: (window as { __qaXss?: number }).__qaXss, injected: document.querySelectorAll("img[onerror], svg[onload], script:not([src])").length }))).toEqual({ injected: 0 });
});

test("QA-M3 — the build's CSP blocks injected inline scripts and inline handlers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) => violations.push(event.violatedDirective));
    const script = document.createElement("script");
    script.textContent = "window.__qaCsp = 1";
    document.body.append(script);
    const image = document.createElement("img");
    image.setAttribute("onerror", "window.__qaCsp = 2");
    image.src = "data:,x";
    document.body.append(image);
    await new Promise((resolve) => setTimeout(resolve, 300));
    image.remove();
    return { ran: (window as { __qaCsp?: number }).__qaCsp ?? null, violations: violations.filter((directive) => directive.startsWith("script-src")).length };
  });
  expect(result.ran).toBeNull();
  expect(result.violations).toBeGreaterThanOrEqual(2);
});

test("QA-M3 — first visit without a reachable manifest shows the offline-first-use error and recovers on retry", async ({ page }) => {
  let reachable = false;
  await page.route("**/data/manifest.json", (route) => (reachable ? route.continue() : route.abort("internetdisconnected")));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chưa xem được thời khóa biểu" })).toBeVisible();
  await expect(page.getByText("Không kết nối được tới nguồn dữ liệu. Lần đầu sử dụng cần có kết nối mạng để tải dữ liệu.")).toBeVisible();
  reachable = true;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
});
