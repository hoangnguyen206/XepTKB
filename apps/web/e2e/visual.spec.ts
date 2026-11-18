/**
 * Screenshot baselines (DESIGN-M6-001 §12, AC-M6-19): 5 screens (Bắt đầu, Lịch tuần, Thêm lớp, sheet lớp, Phương án)
 * × 360/768/1280 × light/dark = 30 baselines in e2e/__screenshots__/visual.spec.ts/. Runs only in the `visual`
 * project (Linux CI, KY_NAY_VISUAL=1). Deterministic: self-hosted fonts awaited, fixed clock (Wednesday 2027-03-03
 * 09:30 in Vietnam = week 3 of the synthetic HK II), reduced motion, toasts closed, `[data-volatile]` masked.
 */
import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "./fixture.js";

const SIZES = [
  { name: "360", width: 360, height: 780 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
] as const;
const SCHEMES = ["light", "dark"] as const;

const navButton = (page: Page, name: "Lịch" | "Thêm lớp" | "Phương án") =>
  page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name, exact: true });
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const courseRow = (page: Page, code: string) =>
  page.getByRole("region", { name: "Tìm môn" }).getByRole("button", { name: new RegExp(`^${escapeRegExp(code)} `) });
const sectionChip = (page: Page, section: string) =>
  page.getByRole("dialog").getByRole("radio", { name: new RegExp(`^Lớp ${escapeRegExp(section)}( |$)`) });

async function checkChip(radio: Locator): Promise<void> {
  if (await radio.isChecked()) return;
  const id = await radio.getAttribute("id");
  await radio.page().locator(`label[for="${id}"]`).click();
  await expect(radio).toBeChecked();
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // Transient toasts would differ between runs: close them (one may vanish on its own while we click).
  const closers = page.getByRole("button", { name: "Đóng thông báo" });
  for (let attempt = 0; attempt < 10 && (await closers.count()) > 0; attempt += 1) {
    await closers.first().click({ timeout: 2_000 }).catch(() => undefined);
  }
  await expect(closers).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: [page.locator("[data-volatile]")] });
}

async function addClass(page: Page, query: string, section: string, options: { group?: string; button?: RegExp } = {}) {
  if ((page.viewportSize()?.width ?? 0) < 1200) await navButton(page, "Thêm lớp").click();
  await page.getByLabel("Mã hoặc tên môn").fill(query);
  await courseRow(page, section.split(" ")[0]!).click();
  await checkChip(sectionChip(page, section));
  const card = page.getByRole("dialog").getByRole("article", { name: `Lớp ${section}` });
  if (options.group) await checkChip(card.getByLabel(`Nhóm ${options.group}`));
  await card.getByRole("button", { name: options.button ?? /^(Thêm vào lịch|Vẫn thêm lớp này)$/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

for (const size of SIZES) {
  for (const scheme of SCHEMES) {
    test(`screens ${size.name}px ${scheme}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "visual", "screenshots are compared only in the visual project (Linux CI)");
      await page.clock.setFixedTime(new Date("2027-03-03T09:30:00+07:00"));
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      const id = `${size.name}-${scheme}`;

      // 1. Bắt đầu
      await page.goto("./");
      const cohorts = page.getByRole("group", { name: "Bạn khóa mấy?" });
      await expect(cohorts).toBeVisible();
      await shot(page, `start-${id}`);
      await checkChip(cohorts.getByRole("radio", { name: "K69" }));
      await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();

      // A colourful week with one conflict.
      await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
      await addClass(page, "SYN2002", "SYN2002 1");
      await addClass(page, "vat ly", "SYN1003 1", { button: /^Vẫn thêm lớp này$/ });

      // 2. Lịch tuần (week 3, today's column and the time line)
      await navButton(page, "Lịch").click();
      await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 3" })).toBeVisible();
      await shot(page, `week-${id}`);

      // 3. Thêm lớp (on desktop, the search column next to the calendar)
      if (size.width < 1200) await navButton(page, "Thêm lớp").click();
      await page.getByLabel("Mã hoặc tên môn").fill("SYN");
      await expect(courseRow(page, "SYN1001")).toBeVisible();
      await page.getByLabel("Mã hoặc tên môn").blur();
      await shot(page, `add-${id}`);

      // 4. Sheet lớp (the conflicting SYN1003 1: conflict text and a striped mini-calendar)
      await page.getByLabel("Mã hoặc tên môn").fill("vat ly");
      await courseRow(page, "SYN1003").click();
      await expect(page.getByRole("dialog").locator(".mini-cal")).toBeVisible();
      await shot(page, `class-sheet-${id}`);
      // Close with the button: Esc can also reach the type=search box (Chromium clears it), which made the left
      // column differ between runs. Then put the search in a known state for the desktop shot.
      await page.getByRole("dialog").getByRole("button", { name: "Đóng", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
      if (size.width >= 1200) await page.getByLabel("Mã hoặc tên môn").fill("");

      // 5. Phương án
      await navButton(page, "Phương án").click();
      await expect(page.getByRole("region", { name: "Phương án", exact: true })).toBeVisible();
      await shot(page, `plan-${id}`);
    });
  }
}
