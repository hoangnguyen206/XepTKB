/**
 * M6 "Lịch có màu" end-to-end checks, added phase by phase (SPEC-M6-001 §7, DESIGN-M6-001 §12).
 * F1b: AC-M6-01 (theme saved, survives reload and offline), AC-M6-02 (self-hosted fonts loaded from this origin and
 * precached), AC-M6-16 (dark theme on the screens not yet redesigned: axe 0 serious/critical).
 * F2: AC-M6-03 (grid within the first 200 px at 360×780; 3-item navigation ≥ 44 px with a current state), AC-M6-04
 * (status chips instead of banners, chip → details, source within 2 taps), AC-M6-12 (independence sentence placement).
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "./fixture.js";

const ABOUT = "Giới thiệu, quyền riêng tư & báo lỗi";

async function startDraftPlan(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
}

async function chooseTheme(page: Page, label: "Hệ thống" | "Sáng" | "Tối") {
  await page.getByRole("button", { name: ABOUT }).click();
  const panel = page.getByRole("dialog", { name: ABOUT });
  await panel.getByRole("group", { name: "Giao diện" }).getByRole("button", { name: label }).click();
  await panel.getByRole("button", { name: "Đóng", exact: true }).click();
}

const NAV_ITEMS = ["Lịch", "Thêm lớp", "Phương án"] as const;
const navButton = (page: Page, name: (typeof NAV_ITEMS)[number]) => page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name, exact: true });

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("AC-M6-01 — Tối overrides a light OS, is saved, and survives reload and offline; Hệ thống follows the OS again", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 360, height: 780 });
  await startDraftPlan(page);
  expect(await bodyBackground(page)).toBe("rgb(245, 246, 250)");

  await chooseTheme(page, "Tối");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBackground(page)).toBe("rgb(14, 16, 32)");
  await expect(page.locator('meta[name="theme-color"][media*="light"]')).toHaveAttribute("content", "#0E1020");

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await context.setOffline(false);

  await chooseTheme(page, "Hệ thống");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  expect(await bodyBackground(page)).toBe("rgb(245, 246, 250)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await bodyBackground(page)).toBe("rgb(14, 16, 32)");
});

test("AC-M6-02 — both weights of Be Vietnam Pro load from this origin, in both subsets, and are precached", async ({ page, baseURL }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontRequests.push(request.url());
  });
  await startDraftPlan(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const loaded = await page.evaluate(() => {
    const faces: string[] = [];
    document.fonts.forEach((face) => {
      if (face.family.replace(/"/g, "") === "Be Vietnam Pro" && face.status === "loaded") faces.push(`${face.weight} ${face.unicodeRange.startsWith("U+102") ? "vietnamese" : "latin"}`);
    });
    return faces.sort();
  });
  expect(loaded).toEqual(["400 latin", "400 vietnamese", "800 latin", "800 vietnamese"]);
  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) {
    expect(url.startsWith(baseURL!)).toBe(true);
    expect(url).toMatch(/\/assets\/be-vietnam-pro-(?:latin|vietnamese)-(?:400|800)-normal-[\w-]+\.woff2$/);
  }
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"?Be Vietnam Pro"?/);
  const precached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((key) => key.startsWith("ky-nay-shell-"))!);
    return (await cache.keys()).map((request) => new URL(request.url).pathname).filter((path) => path.endsWith(".woff2")).length;
  });
  expect(precached).toBe(4);
});

for (const width of [360, 1280]) {
  test(`AC-M6-16 — dark theme on the not yet redesigned workspace at ${width}px: zero serious/critical axe violations`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await startDraftPlan(page);
    if (width < 1200) await navButton(page, "Thêm lớp").click();
    await page.getByLabel("Mã hoặc tên môn").fill("SYN");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(serious.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("AC-M6-03 — at 360×780 the week grid starts within 200 px; the bottom navigation has 3 items ≥ 44 px with a current state", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startDraftPlan(page);
  const grid = page.getByRole("region", { name: /^Lưới thời khóa biểu tuần \d+/ });
  await expect(grid).toBeVisible();
  const gridTop = (await grid.boundingBox())!.y;
  expect(gridTop, "grid top (px)").toBeLessThanOrEqual(200);

  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  const navBox = (await nav.boundingBox())!;
  expect(Math.round(navBox.y + navBox.height), "navigation sits at the bottom edge").toBe(780);
  await expect(nav.getByRole("button")).toHaveCount(3);
  for (const name of NAV_ITEMS) {
    const box = (await navButton(page, name).boundingBox())!;
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44);
  }
  await expect(navButton(page, "Lịch")).toHaveAttribute("aria-current", "page");
  await navButton(page, "Phương án").click();
  await expect(navButton(page, "Phương án")).toHaveAttribute("aria-current", "page");
  await expect(navButton(page, "Lịch")).not.toHaveAttribute("aria-current", /.*/);
  await expect(page.getByRole("region", { name: "Phương án", exact: true })).toBeVisible();
  await navButton(page, "Thêm lớp").click();
  await expect(page.getByLabel("Mã hoặc tên môn")).toBeVisible();
  // The fixed bar never covers the end of the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("AC-M6-03 — from 1200 px the navigation sits in the app bar and Thêm lớp focuses the search box", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startDraftPlan(page);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(page.getByRole("banner").getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  expect((await nav.boundingBox())!.y).toBeLessThan(100);
  await navButton(page, "Thêm lớp").click();
  await expect(page.getByLabel("Mã hoặc tên môn")).toBeFocused();
});

test("AC-M6-04 — status chips replace the banners; a chip opens the details and the source is one tap away", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startDraftPlan(page);
  // The synthetic, unpublished e2e dataset: no banner text on the page, two chips (one + "+1" below 400 px).
  // (The print-only sheet carries the export disclaimer; it is hidden on screen, so only visible text counts.)
  await expect(page.getByText("Dữ liệu mẫu tổng hợp để thử nghiệm — không phải thời khóa biểu thật của trường.").filter({ visible: true })).toHaveCount(0);
  const chips = page.getByRole("banner").locator(".status-chips");
  await expect(chips.getByRole("button", { name: "Dữ liệu mẫu" })).toBeVisible();
  await expect(chips.getByRole("button", { name: /^1 trạng thái dữ liệu khác: Bản thử$/ })).toBeVisible();
  await chips.getByRole("button", { name: "Dữ liệu mẫu" }).click();
  const sheet = page.getByRole("dialog", { name: "Nguồn và phiên bản dữ liệu" });
  await expect(sheet.getByText("Dữ liệu chưa được công bố")).toBeVisible();
  await expect(sheet.getByText("Dữ liệu mẫu tổng hợp để thử nghiệm — không phải thời khóa biểu thật của trường.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // A-M6-2: one tap on the term chip shows the source document and dataset version.
  await page.getByRole("button", { name: /^Nguồn dữ liệu: HK II/ }).click();
  await expect(sheet.getByText("synthetic-uet-2026-2027-h2.1")).toBeVisible();
  await expect(sheet.getByText("SYNTHETIC-M3-WORKBOOK", { exact: false }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  // From 400 px every chip shows.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(chips.getByRole("button", { name: "Bản thử" })).toBeVisible();
});

test("AC-M6-12 — the independence sentence is on the start screen and in the (i) sheet, not on the calendar", async ({ page }) => {
  const SENTENCE = "Công cụ độc lập của sinh viên, không phải sản phẩm của nhà trường.";
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await expect(page.getByText(SENTENCE, { exact: true })).toHaveCount(1);
  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("region", { name: "Lịch" })).toBeVisible();
  // Visible text only: the hidden print sheet carries the export disclaimer.
  await expect(page.getByText(/không phải sản phẩm của nhà trường/).filter({ visible: true })).toHaveCount(0);
  await page.getByRole("button", { name: ABOUT }).click();
  await expect(page.getByRole("dialog", { name: ABOUT }).getByText(/không phải sản phẩm của nhà trường/).first()).toBeVisible();
});
