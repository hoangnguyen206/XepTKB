/**
 * Component gallery (DESIGN-M6-001 §12, AC-M6-16/19). `chromium`: axe 0 serious/critical at 360 and 1280 px in both
 * colour schemes. `visual` (Linux CI only, KY_NAY_VISUAL=1): screenshot baselines in e2e/__screenshots__/.
 * gallery.html exists only in the e2e build (KY_NAY_GALLERY=1).
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "./fixture.js";

const SIZES = [
  { name: "360", width: 360, height: 780 },
  { name: "1280", width: 1280, height: 900 },
] as const;
const SCHEMES = ["light", "dark"] as const;

async function openGallery(page: Page, width: number, height: number, colorScheme: "light" | "dark") {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.goto("./gallery.html");
  await expect(page.getByRole("heading", { level: 1, name: "Trang mẫu thành phần" })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

for (const size of SIZES) {
  for (const scheme of SCHEMES) {
    test(`gallery ${size.name}px ${scheme}: zero serious/critical axe violations, no horizontal scroll`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "visual", "axe runs in the chromium project");
      await openGallery(page, size.width, size.height, scheme);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
      expect(serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test(`gallery ${size.name}px ${scheme}: screenshot`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "visual", "screenshots are compared only in the visual project (Linux CI)");
      await openGallery(page, size.width, size.height, scheme);
      await expect(page).toHaveScreenshot(`gallery-${size.name}-${scheme}.png`, { fullPage: true });
    });
  }
}

test("course colours switch to their dark values in the dark theme (inline custom properties do not block it)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "visual");
  const chip = page.locator(".course-chip", { hasText: /^Tím$/ });
  const dot = page.locator(".list-row-dot").first();
  await openGallery(page, 360, 780, "light");
  await expect(chip).toHaveCSS("background-color", "rgb(237, 233, 254)");
  await expect(chip).toHaveCSS("color", "rgb(76, 29, 149)");
  await expect(dot).toHaveCSS("background-color", "rgb(124, 58, 237)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(chip).toHaveCSS("background-color", "rgb(46, 16, 101)");
  await expect(chip).toHaveCSS("color", "rgb(237, 233, 254)");
  await expect(dot).toHaveCSS("background-color", "rgb(167, 139, 250)");
  // A forced light theme wins over a dark OS.
  await page.getByRole("group", { name: "Giao diện" }).getByRole("button", { name: "Sáng" }).click();
  await expect(chip).toHaveCSS("background-color", "rgb(237, 233, 254)");
});

test("gallery sheet: opens as a modal, Esc closes it and focus returns to the opener", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "visual");
  await openGallery(page, 360, 780, "light");
  const opener = page.getByRole("button", { name: "Mở sheet" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "INT2213 · Mạng máy tính" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  // Bottom sheet below 768 px: anchored to the bottom edge, full width.
  expect(Math.round(box!.y + box!.height)).toBe(780);
  expect(Math.round(box!.width)).toBe(360);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
