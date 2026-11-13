/**
 * M6 "Lịch có màu" end-to-end checks, added phase by phase (SPEC-M6-001 §7, DESIGN-M6-001 §12).
 * F1b: AC-M6-01 (theme saved, survives reload and offline), AC-M6-02 (self-hosted fonts loaded from this origin and
 * precached), AC-M6-16 (dark theme on the screens not yet redesigned: axe 0 serious/critical).
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "./fixture.js";

const ABOUT = "Giới thiệu, quyền riêng tư & báo lỗi";

async function startDraftPlan(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("heading", { name: "Phương án nháp" })).toBeVisible();
}

async function chooseTheme(page: Page, label: "Hệ thống" | "Sáng" | "Tối") {
  await page.getByRole("button", { name: ABOUT }).click();
  const panel = page.getByRole("region", { name: ABOUT });
  await panel.getByRole("group", { name: "Giao diện" }).getByRole("button", { name: label }).click();
  await page.getByRole("button", { name: "Đóng giới thiệu" }).click();
}

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
  await expect(page.getByRole("heading", { name: "Phương án nháp" })).toBeVisible();
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
    await page.getByLabel("Mã hoặc tên môn").fill("SYN");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(serious.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
