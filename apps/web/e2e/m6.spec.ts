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
 */
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
  const search = page.getByLabel("Mã hoặc tên môn");
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
  await courseRow(page, "SYN1003").hover();
  await expect(ghosts).not.toHaveCount(0);
  // The overlap with SYN1001 1 is outlined in red; a ghost is never a button.
  await expect(grid.locator(".block.is-ghost.is-conflict")).not.toHaveCount(0);
  await expect(grid.locator("button.block.is-ghost")).toHaveCount(0);
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
  const [png] = await Promise.all([page.waitForEvent("download"), plan.getByRole("button", { name: /^Ảnh/ }).click()]);
  expect(png.suggestedFilename()).toBe("ky-nay-2026-2027-h2-tuan-3.png");
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
