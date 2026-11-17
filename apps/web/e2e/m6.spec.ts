/**
 * M6 "Lịch có màu" end-to-end checks, added phase by phase (SPEC-M6-001 §7, DESIGN-M6-001 §12).
 * F1b: AC-M6-01 (theme saved, survives reload and offline), AC-M6-02 (self-hosted fonts loaded from this origin and
 * precached), AC-M6-16 (dark theme on the screens not yet redesigned: axe 0 serious/critical).
 * F2: AC-M6-03 (grid within the first 200 px at 360×780; 3-item navigation ≥ 44 px with a current state), AC-M6-04
 * (status chips instead of banners, chip → details, source within 2 taps), AC-M6-12 (independence sentence placement).
 * F3: AC-M6-05 (T2–T7 at 360 px, no horizontal scroll, colour + code + room, conflict not by colour alone), AC-M6-06
 * (buttons, swipe, keys, "Tuần này"; today and the time line only in the current week; fixed clock), AC-M6-07 (session
 * sheet, course colour saved across reload), AC-M6-08 (day view in the same colours; sessions without fixed times).
 * F4: AC-M6-09 (diacritic-free search, "Không trùng lịch" filter, class sheet whose mini-calendar marks the overlap, a
 * conflicting class needs "Vẫn thêm lớp này"), AC-M6-10 (desktop 2 columns, Ctrl/⌘ K, hover/focus ghost preview);
 * AC-M6-16 also covers the class sheet.
 * F6: AC-M6-13 (credits bar adds up, conflict chip → cell, group chips, 4 export tiles with the same files), AC-M6-14 (the
 * registration import is a sheet; the privacy assertions stay in e2e/m4.spec.ts).
 * F5: AC-M6-11 (one start screen, cohort chips from Term.starts, "Tự chọn ngày", ≤ 25 visible words without the
 * independence sentence, 2 taps to the calendar), AC-M6-12 (one-time hints that can be dismissed; every empty state has
 * exactly one action).
 * F7: AC-M6-16 also covers Phương án, the (i) sheet, the data-source sheet and the import sheet with a preview (dark).
 * G3 follow-up (F-M6-QA-01, F-M6-QA-03): focus never under the bottom navigation at 360×780/640, dark axe on Bắt đầu +
 * Lịch at 360/768/1280 and every screen at 768, keyboard-only path at 360, course colour after an offline reload
 * (AC-M6-18), axe on the day view (light + dark), conflict stripes/border/icon on the main grid (AC-M6-05).
 */
import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "./fixture.js";
import { countVisibleWords } from "./word-count.js";

const ABOUT = "Giới thiệu, quyền riêng tư & báo lỗi";

const cohortGroup = (page: Page) => page.getByRole("group", { name: "Bạn khóa mấy?" });

/** F5 start screen: one cohort chip, then "Bắt đầu" (2 taps). */
async function startDraftPlan(page: Page) {
  await page.goto("./");
  await expect(cohortGroup(page)).toBeVisible();
  await checkChip(cohortGroup(page).getByRole("radio", { name: "K69" }));
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** F4: a course row of the search results (its name starts with the course code). */
const courseRow = (page: Page, code: string) => page.getByRole("region", { name: "Tìm môn" }).getByRole("button", { name: new RegExp(`^${escapeRegExp(code)} `) });
/** F4: a section chip in the open class sheet ("Lớp {id}", then "đã chọn" / "Trùng"). */
const sectionChip = (page: Page, section: string) => page.getByRole("dialog").getByRole("radio", { name: new RegExp(`^Lớp ${escapeRegExp(section)}( |$)`) });

/** Chip radios are visually hidden inputs under their label: a user (and this helper) clicks the chip itself. */
async function checkChip(radio: Locator): Promise<void> {
  if (await radio.isChecked()) return;
  const id = await radio.getAttribute("id");
  await radio.page().locator(`label[for="${id}"]`).click();
  await expect(radio).toBeChecked();
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
    await expectNoSeriousAxe(page);
    // F4: the class sheet, with its section and group chips and the mini-calendar.
    await courseRow(page, "SYN1001").click();
    await checkChip(page.getByRole("dialog").getByLabel("Nhóm 1"));
    await expect(page.getByRole("dialog").locator(".mini-cal")).toBeVisible();
    await expectNoSeriousAxe(page);
  });
}

async function expectNoSeriousAxe(page: Page) {
  // Colour contrast is measured on the settled page: a button that just became enabled is still in its 150 ms
  // background-color transition, and axe would read the halfway colour.
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
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
  await expect(cohortGroup(page)).toBeVisible();
  await expect(page.getByText(SENTENCE, { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await expect(page.getByRole("region", { name: "Lịch" })).toBeVisible();
  // Visible text only: the hidden print sheet carries the export disclaimer.
  await expect(page.getByText(/không phải sản phẩm của nhà trường/).filter({ visible: true })).toHaveCount(0);
  await page.getByRole("button", { name: ABOUT }).click();
  await expect(page.getByRole("dialog", { name: ABOUT }).getByText(/không phải sản phẩm của nhà trường/).first()).toBeVisible();
});

/** Fixed clock: Wednesday 2027-03-03 09:30 in Vietnam = week 3 of the synthetic HK II (week 1 = 2027-02-15 for K69). */
async function startAt(page: Page, width = 360) {
  await page.clock.setFixedTime(new Date("2027-03-03T09:30:00+07:00"));
  await page.setViewportSize({ width, height: 780 });
  await startDraftPlan(page);
}

/** Thêm lớp → search → course row → class sheet → section (+ group) → action; the sheet closes on success. */
async function addClass(page: Page, query: string, section: string, options: { group?: string; button?: RegExp } = {}) {
  if ((page.viewportSize()?.width ?? 0) < 1200) await navButton(page, "Thêm lớp").click();
  await page.getByLabel("Mã hoặc tên môn").fill(query);
  const code = section.split(" ")[0]!;
  await courseRow(page, code).click();
  const sheet = page.getByRole("dialog");
  await checkChip(sectionChip(page, section));
  const card = sheet.getByRole("article", { name: `Lớp ${section}` });
  if (options.group) await checkChip(card.getByLabel(`Nhóm ${options.group}`));
  await card.getByRole("button", { name: options.button ?? /^(Thêm vào lịch|Vẫn thêm lớp này)$/ }).click();
  await expect(sheet).toBeHidden();
  await expect(courseRow(page, code)).toHaveAccessibleName(new RegExp(`✓ đã chọn lớp ${escapeRegExp(section)}$`));
}

test("AC-M6-05 — at 360 px every day T2–T7 fits without horizontal scroll; blocks show code + room in the course colour; conflicts are not colour-only", async ({ page }) => {
  await startAt(page);
  await addClass(page, "SYN1001", "SYN1001 2");
  await addClass(page, "dai so", "SYN1002 2");
  await addClass(page, "SYN2002", "SYN2002 1");
  await navButton(page, "Lịch").click();
  const grid = page.getByRole("region", { name: "Lưới thời khóa biểu tuần 3" });
  await expect(grid).toBeVisible();
  const box = (await grid.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(await grid.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const day of ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]) {
    const cell = grid.getByRole("button", { name: new RegExp(`^Xem ${day} `) });
    const cellBox = (await cell.boundingBox())!;
    expect(cellBox.x + cellBox.width, day).toBeLessThanOrEqual(360);
  }
  const block = grid.getByRole("button", { name: /^SYN2002 / });
  await expect(block).toContainText("SYN2002");
  await expect(block).toContainText("ĐHKHTN 101-T1");
  const background = await block.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  // Conflict: red border + "Trùng" label + the partner in the accessible name, in addition to colour.
  const conflicting = grid.locator(".block.is-conflict");
  await expect(conflicting).toHaveCount(2);
  await expect(conflicting.first()).toContainText("Trùng");
  await expect(grid.getByRole("button", { name: /^SYN1002 .*đang trùng lịch với SYN1001$/ })).toBeVisible();
  expect(await conflicting.first().evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("3px");
});

test("AC-M6-06 — weeks change by buttons, swipe and keys; Tuần này; today and the time line only in the current week", async ({ page }) => {
  await startAt(page);
  await addClass(page, "SYN2002", "SYN2002 1");
  await navButton(page, "Lịch").click();
  const select = page.getByLabel("Chọn tuần");
  await expect(select).toHaveValue("3");
  await expect(page.getByRole("button", { name: /^Xem Thứ 4 03\/03\/2027, hôm nay/ })).toBeVisible();
  await expect(page.locator(".now-line")).toHaveCount(1);
  await expect(page.locator(".day-body.is-today")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Tuần này" })).toBeDisabled();

  await page.getByRole("button", { name: "Tuần sau" }).click();
  await expect(select).toHaveValue("4");
  await expect(page.locator(".now-line")).toHaveCount(0);
  await expect(page.locator(".day-body.is-today")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /hôm nay/ })).toHaveCount(0);

  // Swipe right (finger moves right) = previous week; touch pointer events only.
  const swipeArea = page.locator(".week-swipe");
  const area = (await swipeArea.boundingBox())!;
  const y = area.y + area.height / 2;
  await swipeArea.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: area.x + 60, clientY: y });
  await swipeArea.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: area.x + 200, clientY: y + 10 });
  await expect(select).toHaveValue("3");
  // A mouse drag does not change the week.
  await swipeArea.dispatchEvent("pointerdown", { pointerType: "mouse", pointerId: 8, isPrimary: true, clientX: area.x + 200, clientY: y });
  await swipeArea.dispatchEvent("pointerup", { pointerType: "mouse", pointerId: 8, isPrimary: true, clientX: area.x + 20, clientY: y });
  await expect(select).toHaveValue("3");

  // Keys while focus is in the calendar (not in the select): → next, ← previous, T this week.
  await page.getByRole("button", { name: "Tuần sau" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(select).toHaveValue("4");
  await page.keyboard.press("ArrowRight");
  await expect(select).toHaveValue("5");
  await page.keyboard.press("t");
  await expect(select).toHaveValue("3");
  await page.getByRole("button", { name: "Tuần sau" }).click();
  await page.getByRole("button", { name: "Tuần này" }).click();
  await expect(select).toHaveValue("3");
});

test("AC-M6-07 — a block opens its details; the chosen course colour survives a reload", async ({ page }) => {
  await startAt(page);
  await addClass(page, "SYN2002", "SYN2002 1");
  await navButton(page, "Lịch").click();
  const block = page.getByRole("button", { name: /^SYN2002 / });
  await block.click();
  const sheet = page.getByRole("dialog", { name: /^SYN2002 · / });
  await expect(sheet).toBeVisible();
  for (const text of [/Thứ 4, tiết 4–6 \(\d\d:\d\d–\d\d:\d\d\)/, /ĐHKHTN 101-T1/, /SYN2002 1/]) await expect(sheet.getByText(text).first()).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Tự động" })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: "Xám" }).click();
  await expect(sheet.getByRole("button", { name: "Xám" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  const slate = "rgb(226, 232, 240)";
  await expect(block).toHaveCSS("background-color", slate);
  // The colour is written to IndexedDB after the screen updates (and after the block-tap hint's own settings write):
  // reload only once it is stored, as a user would not reload within the same few milliseconds.
  await expect.poll(() => page.evaluate(() => new Promise<string>((resolve) => {
    const open = indexedDB.open("ky-nay");
    open.onsuccess = () => {
      const request = open.result.transaction("settings").objectStore("settings").getAll();
      request.onsuccess = () => {
        resolve(JSON.stringify(request.result));
        open.result.close();
      };
    };
  }))).toContain("\"slate\"");
  await page.reload();
  await expect(page.getByRole("button", { name: /^SYN2002 / })).toHaveCSS("background-color", slate);
  // "Tự động" removes the choice.
  await page.getByRole("button", { name: /^SYN2002 / }).click();
  await page.getByRole("dialog", { name: /^SYN2002 · / }).getByRole("button", { name: "Tự động" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^SYN2002 / })).not.toHaveCSS("background-color", slate);
});

test("AC-M6-08 — the day view uses the same colours; sessions without fixed times stay off the grid and count in credits", async ({ page }) => {
  await startAt(page);
  await addClass(page, "SYN2002", "SYN2002 1");
  await addClass(page, "ky nang so", "SYN3001 1");
  await navButton(page, "Lịch").click();
  const blockColour = await page.getByRole("button", { name: /^SYN2002 / }).evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 3" }).getByRole("button", { name: /^SYN3001/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Không có giờ cố định (không xếp vào lưới)" })).toBeVisible();
  await page.getByRole("button", { name: /^Xem Thứ 4 03\/03\/2027/ }).click();
  await expect(page.getByRole("heading", { name: /^Thứ 4, 03\/03\/2027/ })).toBeVisible();
  const row = page.locator(".day-row", { hasText: "SYN2002" });
  await expect(row).toHaveCSS("background-color", blockColour);
  await page.getByRole("button", { name: "Cả tuần" }).click();
  await navButton(page, "Phương án").click();
  await expect(page.getByText(/2 lớp · \d+ tín chỉ/)).toBeVisible();
});

test("AC-M6-09 — diacritic-free search; the filter hides exactly the conflicting classes; the mini-calendar marks the overlap; a conflicting class needs \"Vẫn thêm lớp này\"", async ({ page }) => {
  await startAt(page);
  await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
  await navButton(page, "Thêm lớp").click();
  const search = page.getByLabel("Mã hoặc tên môn");
  await search.fill("vat ly");
  await expect(courseRow(page, "SYN1003")).toBeVisible();

  // Filter on: SYN1003 1 (Thứ 2, tiết 1–3, tuần 9–15 against SYN1001 1) is hidden, SYN1003 2 stays and is selected.
  const filter = page.getByRole("button", { name: "Không trùng lịch" });
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await courseRow(page, "SYN1003").click();
  await expect(sectionChip(page, "SYN1003 1")).toHaveCount(0);
  await expect(sectionChip(page, "SYN1003 2")).toBeChecked();
  await expect(page.getByRole("dialog").getByText("Ẩn 1 lớp trùng lịch.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Over a broad search the filter hides only courses whose every class conflicts, and says how many in words.
  await search.fill("SYN");
  const rows = page.getByRole("region", { name: "Tìm môn" }).getByRole("list").getByRole("button");
  const status = page.getByRole("region", { name: "Tìm môn" }).getByRole("status");
  await expect(status).toHaveText(/^Tìm thấy \d+ môn\./);
  const filtered = await rows.count();
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "false");
  await expect(status).toHaveText(/^Tìm thấy \d+ môn\.$/);
  const all = await rows.count();
  expect(filtered).toBeLessThanOrEqual(all);
  await filter.click();
  await expect(status).toHaveText(all > filtered ? `Tìm thấy ${filtered} môn. Ẩn ${all - filtered} môn trùng lịch.` : `Tìm thấy ${filtered} môn.`);
  await filter.click();

  // Filter off: the conflicting class is marked in text, the mini-calendar stripes the overlap, the button is "Vẫn thêm lớp này".
  await search.fill("vat ly");
  await courseRow(page, "SYN1003").click();
  await expect(sectionChip(page, "SYN1003 1")).toHaveAccessibleName("Lớp SYN1003 1 Trùng");
  await checkChip(sectionChip(page, "SYN1003 1"));
  const card = page.getByRole("dialog").getByRole("article", { name: "Lớp SYN1003 1" });
  await expect(card.getByText("⚠ Trùng lịch với SYN1001 1 (Giải tích 1): Thứ 2, tiết 1–3, tuần 9–15")).toBeVisible();
  await expect(card.locator(".mini-cal .week-grid-wrap")).toHaveAttribute("aria-hidden", "true");
  await expect(card.locator(".mini-cal .block.is-ghost.is-conflict")).not.toHaveCount(0);
  await expect(card.locator(".mini-cal .block.is-conflict:not(.is-ghost)")).not.toHaveCount(0);
  await expect(card.getByRole("button", { name: "Thêm vào lịch" })).toHaveCount(0);
  await card.getByRole("button", { name: "Vẫn thêm lớp này" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Đã thêm lớp SYN1003 1 vào lịch.")).toBeVisible();
  await navButton(page, "Lịch").click();
  await page.getByLabel("Chọn tuần").selectOption("9");
  await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 9" }).locator(".block.is-conflict")).not.toHaveCount(0);
});

test("AC-M6-10 — Ctrl/⌘ K reaches the search box on a phone and on desktop, never under an open sheet", async ({ page }) => {
  await startAt(page);
  await expect(page.getByRole("region", { name: "Lịch" })).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("region", { name: "Thêm lớp" })).toBeVisible();
  await expect(page.getByLabel("Mã hoặc tên môn")).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 900 });
  // From 1200 px the search moves into the left column (a new input): wait for it before typing.
  await expect(page.getByRole("complementary", { name: "Tìm và chọn lớp" })).toBeVisible();
  const search = page.getByRole("complementary", { name: "Tìm và chọn lớp" }).getByLabel("Mã hoặc tên môn");
  await search.fill("giai tich");
  await page.getByLabel("Chọn tuần").focus();
  await page.keyboard.press("Meta+k");
  await expect(search).toBeFocused();
  expect(await search.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([0, "giai tich".length]);
  await courseRow(page, "SYN1001").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(search).not.toBeFocused();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("AC-M6-10 — from 1200 px: two columns; hovering or focusing a class previews it on the grid as a dashed ghost", async ({ page }) => {
  await startAt(page, 1280);
  await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
  const left = (await page.getByRole("complementary", { name: "Tìm và chọn lớp" }).boundingBox())!;
  const right = (await page.getByRole("region", { name: "Lịch" }).boundingBox())!;
  expect(left.x + left.width).toBeLessThanOrEqual(right.x);

  await page.getByLabel("Chọn tuần").selectOption("all");
  const grid = page.getByRole("region", { name: "Lưới thời khóa biểu tất cả các tuần" });
  const ghosts = grid.locator(".block.is-ghost");
  await page.getByLabel("Mã hoặc tên môn").fill("vat ly");
  await expect(ghosts).toHaveCount(0);
  const dayLabels = () => grid.locator("ul.day-body").evaluateAll((lists) => lists.map((list) => list.getAttribute("aria-label")));
  const labelsBefore = await dayLabels();
  await courseRow(page, "SYN1003").hover();
  await expect(ghosts).not.toHaveCount(0);
  // The overlap with SYN1001 1 is outlined in red; a ghost is never a button.
  await expect(grid.locator(".block.is-ghost.is-conflict")).not.toHaveCount(0);
  await expect(grid.locator("button.block.is-ghost")).toHaveCount(0);
  // G3 REV-M6-003 / F-RV-M6-02: ghosts are hidden from assistive technology and do not change the day labels.
  await expect(grid.locator("li.block-slot:not([aria-hidden='true']) .block.is-ghost")).toHaveCount(0);
  expect(await dayLabels()).toEqual(labelsBefore);
  await page.mouse.move(5, 5);
  await expect(ghosts).toHaveCount(0);

  // Keyboard: focus previews, Esc clears.
  await courseRow(page, "SYN1003").focus();
  await expect(ghosts).not.toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(ghosts).toHaveCount(0);

  // The picked class itself is not drawn twice.
  await page.getByLabel("Mã hoặc tên môn").fill("giai tich");
  await courseRow(page, "SYN1001").focus();
  await page.waitForTimeout(200);
  await expect(ghosts).toHaveCount(0);
});

const INDEPENDENCE = "Công cụ độc lập của sinh viên, không phải sản phẩm của nhà trường.";

test("AC-M6-11 — one start screen: cohort chips from Term.starts, ≤ 25 visible words (without the independence sentence), 2 taps to the calendar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./");
  const group = cohortGroup(page);
  await expect(group).toBeVisible();
  // The synthetic HK II term starts K67–K71 on the same Monday (scripts/build-synthetic-dataset.mjs).
  await expect(group.getByRole("radio")).toHaveCount(5);
  for (const cohort of ["K67", "K68", "K69", "K70", "K71"]) await expect(group.getByText(cohort, { exact: true })).toBeVisible();
  const words = await countVisibleWords(page, "main", [INDEPENDENCE]);
  expect(words.count, words.words.join(" ")).toBeLessThanOrEqual(25);
  await expect(page.getByText(INDEPENDENCE, { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // "Tự chọn ngày" opens the date field, checked like before (a Monday in the term frame).
  const start = page.getByRole("button", { name: "Bắt đầu", exact: true });
  await page.getByRole("button", { name: "Tự chọn ngày" }).click();
  const date = page.getByLabel("Ngày bắt đầu tuần 1");
  await expect(date).toBeFocused();
  await date.fill("2027-02-16");
  await expect(page.getByText("Ngày bắt đầu tuần 1 phải là Thứ Hai.")).toBeVisible();
  await expect(start).toBeDisabled();
  await date.fill("2027-02-15");
  await expect(page.getByText("Tuần 1: 15/02/2027")).toBeVisible();
  await expect(start).toBeEnabled();

  // Two taps from a chip: the chip, then "Bắt đầu".
  await checkChip(group.getByRole("radio", { name: "K69" }));
  await start.click();
  await expect(page.getByRole("region", { name: "Lịch" })).toBeVisible();
});

test("AC-M6-11 — a term whose cohorts start on different Mondays waits for a chip", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./");
  await expect(cohortGroup(page)).toBeVisible();
  await page.getByLabel("Học kỳ").selectOption("2026-2027-h1");
  const start = page.getByRole("button", { name: "Bắt đầu", exact: true });
  await expect(page.getByLabel("Học kỳ")).toHaveValue("2026-2027-h1");
  await expect(start).toBeDisabled();
  await checkChip(cohortGroup(page).getByRole("radio", { name: "K71" }));
  await expect(start).toBeEnabled();
  await start.click();
  await page.getByLabel("Chọn tuần").selectOption("1");
  await expect(page.getByRole("option", { name: /^Tuần 1\b.*12\/10/ })).toHaveCount(1);
});

test("AC-M6-12 — one-time hints can be dismissed and stay dismissed; every empty state has exactly one action", async ({ page }) => {
  await startAt(page);
  const notes = page.getByRole("note");
  const empty = page.locator(".empty");

  // Empty calendar → "Thêm lớp"; empty plan → "Thêm lớp" with the import hint beside it.
  await expect(empty.getByText("Chưa có lớp nào")).toBeVisible();
  await expect(empty.getByRole("button")).toHaveCount(1);
  await navButton(page, "Phương án").click();
  await expect(empty.getByText("Chưa chọn lớp nào")).toBeVisible();
  await expect(empty.getByRole("button")).toHaveCount(1);
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText("nhập file kết quả ĐKMH");
  await notes.getByRole("button", { name: "Đã hiểu" }).click();
  await expect(notes).toHaveCount(0);
  await empty.getByRole("button", { name: "Thêm lớp" }).click();
  await expect(page.getByRole("region", { name: "Thêm lớp" })).toBeVisible();

  // Thêm lớp: the filter hint; a search without result → "Xóa từ khóa"; using the filter marks the hint seen.
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText("Không trùng lịch");
  const search = page.getByLabel("Mã hoặc tên môn");
  await search.fill("zzzz khong co");
  await expect(empty.getByText("Không có môn nào khớp")).toBeVisible();
  await expect(empty.getByRole("button")).toHaveCount(1);
  await empty.getByRole("button", { name: "Xóa từ khóa" }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await page.getByRole("button", { name: "Không trùng lịch" }).click();
  await expect(notes).toHaveCount(0);
  await page.getByRole("button", { name: "Không trùng lịch" }).click();

  // SYN2003 1 meets in weeks 4, 7, 10 and 14 only: week 3 is empty and offers the nearest week with a class.
  await addClass(page, "SYN2003", "SYN2003 1");
  await navButton(page, "Lịch").click();
  await expect(empty.getByText("Tuần 3 không có buổi học")).toBeVisible();
  await expect(empty.getByRole("button")).toHaveCount(1);
  await empty.getByRole("button", { name: "Tới tuần có lớp" }).click();
  await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 4" })).toBeVisible();
  await expect(empty).toHaveCount(0);

  // The block hint (mouse device: no swipe hint) goes away when a block is opened, and stays away after a reload.
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText("Chạm vào một lớp");
  await page.getByRole("region", { name: "Lưới thời khóa biểu tuần 4" }).getByRole("button", { name: /^SYN2003 / }).first().click();
  await page.keyboard.press("Escape");
  await expect(notes).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Lịch" })).toBeVisible();
  await navButton(page, "Thêm lớp").click();
  await expect(page.getByRole("region", { name: "Thêm lớp" })).toBeVisible();
  await navButton(page, "Phương án").click();
  await expect(page.getByRole("region", { name: "Phương án", exact: true })).toBeVisible();
  await expect(notes).toHaveCount(0);
});

test("AC-M6-12 — on desktop, where the calendar and the search share the screen, at most one hint shows", async ({ page }) => {
  await startAt(page, 1280);
  const notes = page.getByRole("note");
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText("Không trùng lịch");
  await addClass(page, "SYN2002", "SYN2002 1");
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText("Chạm vào một lớp");
});

test("AC-M6-13 — Phương án: the colour bar adds up to the credits; a conflict chip leads to the cell; group chips; 4 export tiles give the same files", async ({ page }) => {
  await startAt(page);
  await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
  await addClass(page, "vat ly", "SYN1003 1", { button: /^Vẫn thêm lớp này$/ });
  await addClass(page, "kien truc", "SYN2003 1");
  await navButton(page, "Phương án").click();
  const plan = page.getByRole("region", { name: "Phương án", exact: true });

  // Credits: the StatCard total equals the plan line, and the bar has one segment per course summing to it.
  const line = await plan.getByText(/· \d+ lớp · \d+ tín chỉ/).first().textContent();
  const total = Number(/(\d+) tín chỉ/.exec(line ?? "")![1]);
  await expect(plan.locator(".stat-value")).toHaveText(String(total));
  const segments = plan.locator(".credit-bar .credit-seg");
  await expect(segments).toHaveCount(3);
  const sum = (await segments.evaluateAll((elements) => elements.map((element) => Number((element as HTMLElement).dataset.credits)))).reduce((a, b) => a + b, 0);
  expect(sum).toBe(total);
  await expect(plan.locator(".credit-bar")).toHaveAttribute("aria-hidden", "true");

  // Group chips: switching SYN1001 1 to group 2 updates the row.
  const row = plan.locator(".pick-row").filter({ hasText: "SYN1001 1" });
  await expect(row.getByRole("group", { name: "Nhóm thực hành" })).toBeVisible();
  await row.getByText("Nhóm 2", { exact: true }).click();
  await expect(row.getByRole("radio", { name: "Nhóm 2" })).toBeChecked();
  await expect(row.locator(".list-row-meta")).toContainText("nhóm 2");

  // A conflict chip opens the calendar on the first overlapping week with the conflicting cell focused.
  const chip = plan.getByRole("button", { name: /trùng lịch với/ }).first();
  const firstWeek = Number(/tuần (\d+)/.exec((await chip.textContent()) ?? "")![1]);
  await chip.click();
  await expect(page.getByRole("region", { name: `Lưới thời khóa biểu tuần ${firstWeek}` })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return active?.classList.contains("is-conflict") && active.dataset.sessionKey ? active.closest("[role=region]")?.getAttribute("aria-label") : null;
  })).toBe(`Lưới thời khóa biểu tuần ${firstWeek}`);

  // Export tiles: 4 tiles, same file names as before (contents are checked in e2e/m3.spec.ts).
  await page.getByLabel("Chọn tuần").selectOption("3");
  await navButton(page, "Phương án").click();
  const tiles = plan.locator(".export-tiles").getByRole("button");
  await expect(tiles).toHaveCount(4);
  for (const name of ["Điện thoại Tải lịch (.ics)", "Ảnh Tải ảnh (.png)", "Word Tải Word (.doc)", "In In / Lưu PDF"]) await expect(plan.getByRole("button", { name, exact: true })).toBeEnabled();
  const [ics] = await Promise.all([page.waitForEvent("download"), plan.getByRole("button", { name: /^Điện thoại/ }).click()]);
  expect(ics.suggestedFilename()).toBe("ky-nay-2026-2027-h2.ics");
  // F7: "Ảnh" opens a sheet with the week image and the share poster (AC-M6-15: a real 1080×1350 PNG).
  const imageTile = plan.getByRole("button", { name: "Ảnh Tải ảnh (.png)", exact: true });
  await imageTile.click();
  const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog", { name: "Tải ảnh" }).getByRole("button", { name: "Ảnh lịch tuần (.png)" }).click()]);
  expect(png.suggestedFilename()).toBe("ky-nay-2026-2027-h2-tuan-3.png");
  await imageTile.click();
  const [poster] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog", { name: "Tải ảnh" }).getByRole("button", { name: "Poster chia sẻ (.png)" }).click()]);
  expect(poster.suggestedFilename()).toBe("ky-nay-2026-2027-h2-tuan-3-poster.png");
  const posterBytes = readFileSync(await poster.path());
  expect(posterBytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect([posterBytes.readUInt32BE(16), posterBytes.readUInt32BE(20)]).toEqual([1080, 1350]);
  const [doc] = await Promise.all([page.waitForEvent("download"), plan.getByRole("button", { name: /^Word/ }).click()]);
  expect(doc.suggestedFilename()).toBe("ky-nay-2026-2027-h2.doc");
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => { (window as unknown as { printed: number }).printed += 1; };
  });
  await plan.getByRole("button", { name: /^In / }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
});

test("AC-M6-14 — the registration import opens as a sheet from Phương án; Esc closes it and the plan is untouched", async ({ page }) => {
  await startAt(page);
  await navButton(page, "Phương án").click();
  await page.getByRole("button", { name: "Nhập kết quả ĐKMH" }).click();
  const sheet = page.getByRole("dialog", { name: "Nhập kết quả đăng ký môn học (ĐKMH)" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Chọn file Kết quả đăng ký môn học (.doc, .htm, .html)")).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "Nhập kết quả ĐKMH" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Phương án nháp (0)" })).toBeVisible();
});

/** Synthetic ĐKMH export without personal data: one class as published, one with another room and periods, one not in the timetable. */
const SYNTHETIC_REGISTRATION_DOC = `<!DOCTYPE html><html><body><table>
<tr><th>STT</th><th>Mã môn học</th><th>Môn học</th><th>Số tín chỉ</th><th>Trạng thái</th><th>Học phí</th><th>Lớp môn học</th><th>Thứ</th><th>Tiết</th><th>Giảng đường</th></tr>
<tr><td>1</td><td>SYN1001</td><td>Giải tích 1</td><td>4</td><td>Đăng ký lần đầu</td><td>0</td><td>SYN1001 1</td><td>T2,T5</td><td>1 - 3,7 - 9</td><td>301-G2402-G2</td></tr>
<tr><td>2</td><td>SYN1002</td><td>Đại số tuyến tính</td><td>3</td><td>Đăng ký lần đầu</td><td>0</td><td>SYN1002 1</td><td>T2</td><td>7 - 9</td><td>505-G2</td></tr>
<tr><td>3</td><td>UNMATCHED999</td><td>Môn ngoài TKB</td><td>2</td><td>Đăng ký lần đầu</td><td>0</td><td>UNMATCHED999 1</td><td>T4</td><td>1 - 3</td><td>101-G2</td></tr>
</table></body></html>`;

test("AC-M6-16 — dark theme on Phương án, the (i) sheet, the data-source sheet and the import sheet: zero serious/critical axe violations", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await startAt(page);
  await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
  await addClass(page, "vat ly", "SYN1003 1", { button: /^Vẫn thêm lớp này$/ });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    // Phương án: plan bar, credits card, conflict chips, class list with badges and group chips, export tiles.
    await navButton(page, "Phương án").click();
    await expect(page.getByRole("region", { name: "Phương án", exact: true }).getByRole("button", { name: /trùng lịch với/ }).first()).toBeVisible();
    await expectNoSeriousAxe(page);

    // The (i) sheet with "Dữ liệu trên máy" open and the report form.
    await page.getByRole("button", { name: ABOUT }).click();
    const about = page.getByRole("dialog", { name: ABOUT });
    await about.getByRole("button", { name: "Đến mục “Dữ liệu trên máy”" }).click();
    await expect(about.getByRole("button", { name: "Xóa dữ liệu trên máy" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.keyboard.press("Escape");
    await expect(about).toBeHidden();

    // The data-source sheet: status notices and the facts list.
    await page.getByRole("button", { name: /^Nguồn dữ liệu: / }).click();
    const source = page.getByRole("dialog", { name: "Nguồn và phiên bản dữ liệu" });
    await expect(source.getByText("synthetic-uet-2026-2027-h2.1")).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.keyboard.press("Escape");
    await expect(source).toBeHidden();

    // The import sheet with a preview: override badges, matched list, the unmatched notice and the actions.
    await page.getByRole("button", { name: "Nhập kết quả ĐKMH" }).click();
    const sheet = page.getByRole("dialog", { name: "Nhập kết quả đăng ký môn học (ĐKMH)" });
    await sheet.getByLabel("Chọn file Kết quả đăng ký môn học (.doc, .htm, .html)").setInputFiles({ name: "dkmh-tong-hop.doc", mimeType: "application/msword", buffer: Buffer.from(SYNTHETIC_REGISTRATION_DOC, "utf8") });
    await expect(sheet.getByRole("heading", { name: /^Xem trước trước khi lưu: 2 lớp khớp TKB/ })).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }
});

test("AC-M6-16 — a week change slides with View Transitions, and prefers-reduced-motion turns the motion off", async ({ page }) => {
  await startAt(page);
  await addClass(page, "SYN2002", "SYN2002 1");
  await navButton(page, "Lịch").click();
  const root = page.locator("html");
  await page.getByRole("button", { name: "Tuần sau" }).click();
  await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 4" })).toBeVisible();
  await expect(root).toHaveAttribute("data-nav-dir", "next");
  await page.getByRole("button", { name: "Tuần trước" }).click();
  await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 3" })).toBeVisible();
  await expect(root).toHaveAttribute("data-nav-dir", "prev");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => delete document.documentElement.dataset.navDir);
  await page.getByRole("button", { name: "Tuần sau" }).click();
  await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 4" })).toBeVisible();
  await expect(root).not.toHaveAttribute("data-nav-dir", /.*/);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

/** Light-theme value of `--conflict-edge` (src/styles/tokens.css). */
const CONFLICT_EDGE_LIGHT = "rgb(220, 38, 38)";

/**
 * The focused element (its label for a visually hidden chip radio) measured after the focus scroll has settled, with
 * the top of the main navigation (`Infinity` where there is none, e.g. on the start screen).
 */
async function focusedBox(page: Page) {
  return page.evaluate(() => new Promise<{ name: string; inNav: boolean; inBody: boolean; top: number; bottom: number; navTop: number; viewport: number; ring: boolean }>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const navElement = document.querySelector('nav[aria-label="Điều hướng chính"]');
      const active = document.activeElement as HTMLElement | null;
      const label = active instanceof HTMLInputElement && active.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(active.id)}"]`) : null;
      const target = label ?? active;
      const rect = target?.getBoundingClientRect();
      const hasRing = (element: HTMLElement | null) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" || style.boxShadow !== "none";
      };
      resolve({
        name: (active?.getAttribute("aria-label") ?? active?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || (label?.textContent ?? "").trim(),
        inNav: Boolean(active && navElement?.contains(active)),
        inBody: !active || active === document.body,
        top: rect?.top ?? 0,
        bottom: rect?.bottom ?? 0,
        navTop: navElement ? navElement.getBoundingClientRect().top : Number.POSITIVE_INFINITY,
        viewport: window.innerHeight,
        ring: hasRing(active) || hasRing(label),
      });
    }));
  }));
}

for (const height of [780, 640]) {
  test(`AC-M6-16 (F-M6-QA-01) — at 360×${height} a keyboard-focused control is never hidden under the bottom navigation`, async ({ page }) => {
    await startAt(page);
    await addClass(page, "SYN2002", "SYN2002 1");
    await addClass(page, "SYN2004", "SYN2004 1");
    await addClass(page, "SYN1004", "SYN1004 1");
    await page.setViewportSize({ width: 360, height });
    await navButton(page, "Phương án").click();
    await expect(page.getByRole("region", { name: "Phương án", exact: true }).getByRole("button", { name: "Bỏ lớp SYN1004 1" })).toBeVisible();
    const hidden = new Set<string>();
    const removeButtons = new Set<string>();
    for (let stop = 0; stop < 60; stop += 1) {
      await page.keyboard.press("Tab");
      const focused = await focusedBox(page);
      if (focused.inBody || focused.inNav) continue;
      expect(focused.navTop, "the bottom navigation is on screen").toBeLessThan(height);
      if (focused.name.startsWith("Bỏ lớp ")) removeButtons.add(focused.name);
      const inViewport = focused.bottom > 0 && focused.top < focused.viewport;
      if (inViewport && focused.bottom > focused.navTop + 1) hidden.add(`${focused.name}:${Math.round(focused.top)}–${Math.round(focused.bottom)} vs nav top ${Math.round(focused.navTop)}`);
    }
    // The walk reached the plan rows at the end of the page, where the bar used to cover the focus.
    expect([...removeButtons].sort()).toEqual(["Bỏ lớp SYN1004 1", "Bỏ lớp SYN2002 1", "Bỏ lớp SYN2004 1"]);
    expect([...hidden], "focused controls under the bottom navigation").toEqual([]);
  });
}

for (const size of [{ width: 360, height: 780 }, { width: 360, height: 640 }, { width: 1280, height: 560 }]) {
  test(`AC-M6-16 (F-RV-M6-01) — at ${size.width}×${size.height}, Shift+Tab never leaves the focused control under the sticky app bar`, async ({ page }) => {
    await startAt(page, size.width);
    await addClass(page, "SYN2002", "SYN2002 1");
    await addClass(page, "SYN2004", "SYN2004 1");
    await addClass(page, "SYN1004", "SYN1004 1");
    await page.setViewportSize(size);
    await navButton(page, "Phương án").click();
    const plan = page.getByRole("region", { name: "Phương án", exact: true });
    // Start from the end of the page, then walk back up.
    await plan.getByRole("button", { name: /^In / }).focus();
    const covered = new Set<string>();
    const removeButtons = new Set<string>();
    for (let stop = 0; stop < 40; stop += 1) {
      await page.keyboard.press("Shift+Tab");
      const focused = await focusedBox(page);
      if (focused.inBody) continue;
      const barBottom = await page.evaluate(() => document.querySelector(".app-bar")!.getBoundingClientRect().bottom);
      // The skip link sits over the app bar on purpose while it has focus.
      const insideBar = await page.evaluate(() => Boolean(document.activeElement?.closest(".app-bar, .skip-link")));
      if (insideBar || focused.inNav) continue;
      if (focused.name.startsWith("Bỏ lớp ")) removeButtons.add(focused.name);
      const inViewport = focused.bottom > 0 && focused.top < focused.viewport;
      if (inViewport && focused.top < barBottom - 1) covered.add(`${focused.name}:${Math.round(focused.top)}–${Math.round(focused.bottom)} vs app bar bottom ${Math.round(barBottom)}`);
    }
    expect([...removeButtons].sort()).toEqual(["Bỏ lớp SYN1004 1", "Bỏ lớp SYN2002 1", "Bỏ lớp SYN2004 1"]);
    expect([...covered], "focused controls under the sticky app bar").toEqual([]);
  });
}

for (const width of [360, 768, 1280]) {
  // Light at 360/768/1200/1280 is in e2e/m3.spec.ts (AC-M3-05); dark Thêm lớp + class sheet and Phương án at 360/1280 are
  // above. This adds dark Bắt đầu and Lịch (a week with a conflict) at every width, and the other screens at 768.
  test(`AC-M6-16 (F-M6-QA-03) — dark theme at ${width}px: Bắt đầu and Lịch${width === 768 ? ", Thêm lớp, the class sheet and Phương án" : ""} have zero serious/critical axe violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.clock.setFixedTime(new Date("2027-03-03T09:30:00+07:00"));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    await expect(cohortGroup(page)).toBeVisible();
    await expectNoSeriousAxe(page);
    await checkChip(cohortGroup(page).getByRole("radio", { name: "K69" }));
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
    await addClass(page, "vat ly", "SYN1003 1", { button: /^Vẫn thêm lớp này$/ });
    await navButton(page, "Lịch").click();
    await page.getByLabel("Chọn tuần").selectOption("9");
    await expect(page.getByRole("region", { name: "Lưới thời khóa biểu tuần 9" }).locator(".block.is-conflict")).toHaveCount(2);
    await expectNoSeriousAxe(page);
    if (width !== 768) return;
    await navButton(page, "Thêm lớp").click();
    await page.getByLabel("Mã hoặc tên môn").fill("SYN");
    await expect(courseRow(page, "SYN1003")).toBeVisible();
    await expectNoSeriousAxe(page);
    await courseRow(page, "SYN1003").click();
    await expect(page.getByRole("dialog").locator(".mini-cal")).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await navButton(page, "Phương án").click();
    await expect(page.getByRole("region", { name: "Phương án", exact: true }).getByRole("button", { name: /trùng lịch với/ }).first()).toBeVisible();
    await expectNoSeriousAxe(page);
  });
}

test("AC-M6-16 (F-M6-QA-03) — keyboard only at 360×780: cohort, start, Thêm lớp, search, class sheet, add, Phương án, with a visible focus ring at every stop", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-03-03T09:30:00+07:00"));
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./");
  await expect(cohortGroup(page)).toBeVisible();
  const tabTo = async (matches: (focused: Awaited<ReturnType<typeof focusedBox>>) => boolean, max = 60) => {
    for (let stop = 0; stop < max; stop += 1) {
      await page.keyboard.press("Tab");
      const focused = await focusedBox(page);
      if (focused.inBody) continue;
      expect(focused.ring, `focus ring on "${focused.name}"`).toBe(true);
      if (matches(focused)) return;
    }
    throw new Error("element not reachable with Tab");
  };
  const cohort = (name: string) => cohortGroup(page).getByRole("radio", { name });

  // Tab enters the chip radios; Space checks the first cohort, arrow keys move the choice.
  await tabTo((focused) => /^K\d+$/.test(focused.name));
  await page.keyboard.press("Space");
  await expect(page.locator("input[type=radio]:focus")).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(cohort("K69")).toBeChecked();
  await expect(cohort("K69")).toBeFocused();
  await tabTo((focused) => focused.name === "Bắt đầu");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();

  await tabTo((focused) => focused.inNav && focused.name === "Thêm lớp");
  await page.keyboard.press("Enter");
  await expect(navButton(page, "Thêm lớp")).toHaveAttribute("aria-current", "page");
  // The search box: focused by the navigation already, or reached with Tab.
  const search = page.getByLabel("Mã hoặc tên môn");
  const searchFocused = () => search.evaluate((input) => input === document.activeElement);
  for (let stop = 0; stop < 60 && !(await searchFocused()); stop += 1) {
    await page.keyboard.press("Tab");
    const focused = await focusedBox(page);
    if (!focused.inBody) expect(focused.ring, `focus ring on "${focused.name}" on the way to the search box`).toBe(true);
  }
  await expect(search).toBeFocused();
  await page.keyboard.type("SYN2002");
  await expect(courseRow(page, "SYN2002")).toBeVisible();
  await tabTo((focused) => focused.name.startsWith("SYN2002"));
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await tabTo((focused) => focused.name === "Thêm vào lịch");
  await page.keyboard.press("Enter");
  await expect(sheet).toBeHidden();
  await expect(courseRow(page, "SYN2002")).toHaveAccessibleName(/✓ đã chọn lớp SYN2002 1$/);

  // The plan item's text ends with its count badge (aria-hidden): "Phương án1".
  await tabTo((focused) => focused.inNav && focused.name.startsWith("Phương án"));
  await page.keyboard.press("Enter");
  await expect(navButton(page, "Phương án")).toHaveAttribute("aria-current", "page");
  const plan = page.getByRole("region", { name: "Phương án", exact: true });
  await expect(plan.locator(".pick-row").filter({ hasText: "SYN2002 1" })).toBeVisible();
  await expect(plan.getByText(/1 lớp · 4 tín chỉ/).first()).toBeVisible();
});

test("AC-M6-18 (F-M6-QA-03) — the chosen course colour survives an offline reload", async ({ page, context }) => {
  await startAt(page);
  await addClass(page, "SYN2002", "SYN2002 1");
  await navButton(page, "Lịch").click();
  await page.getByRole("button", { name: /^SYN2002 / }).click();
  const sheet = page.getByRole("dialog", { name: /^SYN2002 · / });
  await sheet.getByRole("button", { name: "Xám" }).click();
  await expect(sheet.getByRole("button", { name: "Xám" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  const slate = "rgb(226, 232, 240)";
  await expect(page.getByRole("button", { name: /^SYN2002 / })).toHaveCSS("background-color", slate);
  // As in AC-M6-07: reload only once the colour is stored in IndexedDB.
  await expect.poll(() => page.evaluate(() => new Promise<string>((resolve) => {
    const open = indexedDB.open("ky-nay");
    open.onsuccess = () => {
      const request = open.result.transaction("settings").objectStore("settings").getAll();
      request.onsuccess = () => {
        resolve(JSON.stringify(request.result));
        open.result.close();
      };
    };
  }))).toContain("\"slate\"");

  // As in AC-M6-01: the service worker controls the page before going offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^SYN2002 / })).toHaveCSS("background-color", slate);
  await context.setOffline(false);
});

test("AC-M6-16 (F-M6-QA-03) — the day view opened from the day strip has zero serious/critical axe violations, light and dark", async ({ page }) => {
  await startAt(page);
  await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
  await addClass(page, "vat ly", "SYN1003 1", { button: /^Vẫn thêm lớp này$/ });
  await addClass(page, "ky nang so", "SYN3001 1");
  await navButton(page, "Lịch").click();
  await page.getByLabel("Chọn tuần").selectOption("9");
  // Week 9 (Monday 12/04/2027): SYN1001 1 and SYN1003 1 overlap on Thứ 2, so the day list has a conflicting row.
  await page.getByRole("button", { name: /^Xem Thứ 2 12\/04\/2027/ }).click();
  await expect(page.getByRole("heading", { name: /^Thứ 2, 12\/04\/2027/ })).toBeVisible();
  await expect(page.locator(".day-row.is-conflict")).not.toHaveCount(0);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect.poll(() => bodyBackground(page)).toBe(colorScheme === "light" ? "rgb(245, 246, 250)" : "rgb(14, 16, 32)");
    await expectNoSeriousAxe(page);
  }
});

test("AC-M6-05 (F-M6-QA-03) — on the main week grid a conflicting block has the red border, the stripes, the icon and \"Trùng\"", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await startAt(page);
  await addClass(page, "giai tich", "SYN1001 1", { group: "1" });
  await addClass(page, "vat ly", "SYN1003 1", { button: /^Vẫn thêm lớp này$/ });
  await navButton(page, "Lịch").click();
  // SYN1003 1 meets in weeks 9–15 only, on Thứ 2 tiết 1–3 like SYN1001 1.
  await page.getByLabel("Chọn tuần").selectOption("9");
  const grid = page.getByRole("region", { name: "Lưới thời khóa biểu tuần 9" });
  const conflicting = grid.locator(".block.is-conflict");
  await expect(conflicting).toHaveCount(2);
  for (const block of await conflicting.all()) {
    const style = await block.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { image: computed.backgroundImage, color: computed.borderTopColor, width: computed.borderTopWidth };
    });
    expect(style.image).toContain("repeating-linear-gradient");
    expect(style.color).toBe(CONFLICT_EDGE_LIGHT);
    expect(style.width).toBe("3px");
    await expect(block.locator(".block-flag svg")).toHaveCount(1);
    await expect(block).toContainText("Trùng");
  }
  // A block without a conflict has neither.
  await page.getByLabel("Chọn tuần").selectOption("3");
  const plain = page.getByRole("region", { name: "Lưới thời khóa biểu tuần 3" }).getByRole("button", { name: /^SYN1001 / }).first();
  expect(await plain.evaluate((element) => getComputedStyle(element).backgroundImage)).not.toContain("repeating-linear-gradient");
});
