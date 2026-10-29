/**
 * M3 end-to-end evidence (SPEC-M3-001 AC-M3-01…13) against the production build with the
 * synthetic dataset. Run: `npm run e2e` (apps/web) or `npm run test:e2e` (root).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SCREENSHOTS = process.env.M3_SCREENSHOT_DIR;
const VIEWPORTS = [
  { name: "360", width: 360, height: 780 },
  { name: "768", width: 768, height: 1024 },
  // 1200 is the two-column breakpoint itself (REV-M3-008).
  { name: "1200", width: 1200, height: 900 },
  { name: "1280", width: 1280, height: 900 },
];

async function startPlan(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("heading", { name: "Phương án nháp" })).toBeVisible();
}

async function openSearch(page: Page): Promise<void> {
  // At ≥1200 px the search pane is always visible; below that it is a tab.
  if ((page.viewportSize()?.width ?? 0) < 1200) await page.getByRole("tab", { name: "Tìm môn" }).click();
  await expect(page.getByLabel("Mã hoặc tên môn")).toBeVisible();
}

async function openCourse(page: Page, query: string, code: string): Promise<void> {
  await openSearch(page);
  await page.getByLabel("Mã hoặc tên môn").fill(query);
  const toggle = page.getByRole("button", { name: new RegExp(`^${code}`) });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

async function pick(page: Page, query: string, section: string, options: { group?: string; button?: RegExp } = {}): Promise<void> {
  await openCourse(page, query, section.split(" ")[0]!);
  const card = page.getByRole("article", { name: `Lớp ${section}` });
  if (options.group) await card.getByLabel(`Nhóm ${options.group}`).check();
  await card.getByRole("button", { name: options.button ?? /^(Chọn lớp này|Vẫn chọn)/ }).click();
  await expect(card.getByText(/✓ Đã chọn/)).toBeVisible();
}

async function openTab(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("tab", { name }).click();
}

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function axeSerious(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SCREENSHOTS) return;
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true });
}

test("AC-M3-01/02/03/04/06 — core flow on a 360 px phone, persisted across reload", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startPlan(page);
  await pick(page, "giai tich", "SYN1001 1", { group: "1" });
  await openCourse(page, "vat ly", "SYN1003");
  const conflicting = page.getByRole("article", { name: "Lớp SYN1003 1" });
  await expect(conflicting.getByText("⚠ Trùng lịch với SYN1001 1 (Giải tích 1): Thứ 2, tiết 1–3, tuần 9–15")).toBeVisible();
  await conflicting.getByRole("button", { name: "Vẫn chọn lớp này (đang trùng lịch)" }).click();
  await pick(page, "ky nang so", "SYN3001 1");
  await expect(page.getByText("⚠ 1 chỗ trùng lịch")).toBeVisible();

  await openTab(page, /^Tuần$/);
  await page.getByLabel("Chọn tuần").selectOption("9");
  const grid = page.getByRole("region", { name: /Lưới thời khóa biểu tuần 9/ });
  await expect(grid.locator(".block.is-conflict")).toHaveCount(2);
  await expect(grid.getByText("đang trùng lịch").first()).toBeAttached();
  await expect(page.getByText("Không có giờ cố định (không xếp vào lưới)").first()).toBeVisible();
  await shot(page, "360-week-grid");

  await openTab(page, /^Ngày$/);
  await expect(page.getByRole("heading", { name: /Thứ 2, 12\/04\/2027/ })).toBeVisible();
  await shot(page, "360-day-list");

  await page.reload();
  await expect(page.getByText(/3 lớp · 9 tín chỉ/)).toBeVisible();
});

test("AC-M3-05 — no horizontal page scroll at 360/768/1280 and no serious axe violations", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    expect(await pageOverflow(page), `onboarding overflow at ${viewport.name}`).toBeLessThanOrEqual(0);
    expect(await axeSerious(page), `onboarding axe at ${viewport.name}`).toEqual([]);
  }
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await pick(page, "lap trinh", "SYN2001 1", { group: "2" });
  await pick(page, "SYN1001", "SYN1001 2");
  await pick(page, "dai so", "SYN1002 2", { button: /Vẫn chọn/ });
  await pick(page, "giao duc", "SYN3005 1");
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await openCourse(page, "SYN2001", "SYN2001");
    expect(await pageOverflow(page), `search at ${viewport.name}`).toBeLessThanOrEqual(0);
    expect(await axeSerious(page), `search axe at ${viewport.name}`).toEqual([]);
    await shot(page, `${viewport.name}-search`);
    for (const tab of [/^(Tuần|Lịch tuần)$/, /^(Ngày|Theo ngày)$/, /^Phương án/]) {
      await openTab(page, tab);
      expect(await pageOverflow(page), `${tab} at ${viewport.name}`).toBeLessThanOrEqual(0);
      expect(await axeSerious(page), `${tab} axe at ${viewport.name}`).toEqual([]);
    }
    await openTab(page, /^(Tuần|Lịch tuần)$/);
    await shot(page, `${viewport.name}-week`);
  }
  // Sunday session adds a CN column; the grid scrolls inside its own region on phones.
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByRole("heading", { name: /CN/ }).first()).toBeAttached();
  const scroller = await page.locator(".grid-scroll").first().evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(scroller.scroll).toBeGreaterThan(scroller.client);
});

test("AC-M3-05 — keyboard-only path from onboarding to a pick, with visible focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  const focusOn = async (matches: (element: { tag: string; text: string; label: string }) => boolean, max = 40) => {
    for (let index = 0; index < max; index += 1) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        const id = element?.id;
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent ?? "" : "";
        return { tag: element?.tagName ?? "", text: element?.textContent?.trim() ?? "", label, outline: element ? getComputedStyle(element).outlineStyle : "none" };
      });
      expect(active.outline, `focus ring on ${active.tag} ${active.text}`).not.toBe("none");
      if (matches(active)) return;
    }
    throw new Error("element not reachable with Tab");
  };
  await focusOn((element) => element.label === "Khóa");
  await page.keyboard.press("ArrowDown");
  await focusOn((element) => element.text === "Tạo phương án");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Phương án nháp" })).toBeVisible();
  await focusOn((element) => element.label === "Mã hoặc tên môn");
  await page.keyboard.type("SYN2003");
  await focusOn((element) => element.text.startsWith("SYN2003"));
  await page.keyboard.press("Enter");
  await focusOn((element) => element.text === "Chọn lớp này");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/1 lớp · 3 tín chỉ/)).toBeVisible();
  await page.getByRole("tab", { name: "Lịch tuần" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Theo ngày" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Theo ngày" })).toBeFocused();
});

test("AC-M3-09/10 — ICS, PNG and Word exports carry the schedule and provenance", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startPlan(page);
  await pick(page, "giai tich", "SYN1001 1", { group: "1" });
  await pick(page, "kien truc", "SYN2003 1");
  await pick(page, "ky nang so", "SYN3001 1");
  await openTab(page, /^Phương án/);

  const [ics] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tải lịch (.ics)" }).click()]);
  expect(ics.suggestedFilename()).toBe("ky-nay-2026-2027-h2.ics");
  const calendar = readFileSync(await ics.path(), "utf8");
  // SYN1001 1: LT weeks 1–15 (15) + TH group 1 weeks 2–15 (14); SYN2003 1: weeks 4, 7, 10, 14 (4); ONL: none.
  expect(calendar.split("BEGIN:VEVENT").length - 1).toBe(33);
  expect(calendar).toContain("DTSTART:20270215T000000Z"); // Monday of week 1, 07:00 Asia/Ho_Chi_Minh
  expect(calendar).toContain("DTSTART:20270312T025000Z"); // SYN2003 1: Friday of week 4 (12/03), 09:50 Asia/Ho_Chi_Minh
  expect(calendar).not.toContain("SYN3001");
  const unfolded = calendar.replace(/\r\n /g, "");
  expect(unfolded).toContain("X-WR-CALNAME:Phương án nháp – Học kỳ II 2026–2027 (dữ liệu mẫu)");
  expect(unfolded).toContain("Dữ liệu mẫu tổng hợp");
  await expect(page.getByText(/gồm 33 buổi học/)).toBeVisible();

  const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tải ảnh (.png)" }).click()]);
  const image = readFileSync(await png.path());
  expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(image.readUInt32BE(16)).toBe(3200);

  const [doc] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tải Word (.doc)" }).click()]);
  expect(doc.suggestedFilename()).toBe("ky-nay-2026-2027-h2.doc");
  const word = readFileSync(await doc.path(), "utf8");
  for (const text of ["Phương án nháp", "synthetic-uet-2026-2027-h2.1", "Dữ liệu mẫu tổng hợp", "mso-page-orientation: landscape", "Không có giờ cố định", "Tổng tín chỉ đã biết: 9"]) expect(word).toContain(text);
});

test("AC-M3-10 — print stylesheet hides controls and produces A4 landscape pages", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startPlan(page);
  await pick(page, "giai tich", "SYN1001 1", { group: "2" });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-only")).toBeVisible();
  await expect(page.getByRole("tablist")).toBeHidden();
  await expect(page.locator(".app-header")).toBeHidden();
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf);
  expect(box).not.toBeNull();
  const [width, height] = [Number(box![1]), Number(box![2])];
  expect(Math.round(width)).toBe(842);
  expect(Math.round(height)).toBe(595);
  await page.emulateMedia({ media: "screen" });
});

test("AC-M3-06 — after the first online visit the Plan opens offline from the service worker and IndexedDB", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startPlan(page);
  await pick(page, "mang may tinh", "SYN2004 1");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Đang ngoại tuyến")).toBeVisible();
  await expect(page.getByText(/1 lớp · 3 tín chỉ/)).toBeVisible();
  await openTab(page, /^Phương án/);
  await expect(page.getByRole("button", { name: "Tải lịch (.ics)" })).toBeEnabled();
  await context.setOffline(false);
});

test("AC-M3-06 — 'Xóa dữ liệu trên máy' removes the Plan", async ({ page }) => {
  await startPlan(page);
  await page.locator("summary", { hasText: "Dữ liệu trên máy" }).click();
  await page.getByRole("button", { name: "Xóa dữ liệu trên máy" }).click();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
});

test("REV-M3-002 — after 'Xóa dữ liệu trên máy' the next online visit makes the app work offline again", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startPlan(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.locator("summary", { hasText: "Dữ liệu trên máy" }).click();
  await page.getByRole("button", { name: "Xóa dữ liệu trên máy" }).click();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  // Online visits: the worker installs again and precaches the shell.
  await page.reload();
  await startPlan(page);
  await pick(page, "mang may tinh", "SYN2004 1");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Đang ngoại tuyến")).toBeVisible();
  await expect(page.getByText(/1 lớp · 3 tín chỉ/)).toBeVisible();
  await context.setOffline(false);
});

test("QA-M3-005 — two tabs never overwrite each other's Plan, and a wipe in one tab resets the other", async ({ context }) => {
  const first = await context.newPage();
  await first.setViewportSize({ width: 1280, height: 900 });
  await startPlan(first);
  await pick(first, "mang may tinh", "SYN2004 1");
  const second = await context.newPage();
  await second.setViewportSize({ width: 1280, height: 900 });
  await second.goto("/");
  await expect(second.getByText(/1 lớp · 3 tín chỉ/)).toBeVisible();
  // The second tab adds a class; the first tab is told and shows it without reloading.
  await pick(second, "SYN1002", "SYN1002 1");
  await expect(first.getByText(/2 lớp · 6 tín chỉ/)).toBeVisible();
  // The first tab keeps working from the up-to-date copy, so nothing picked in the second tab is lost.
  await pick(first, "kien truc", "SYN2003 1");
  await expect(second.getByText(/3 lớp · 9 tín chỉ/)).toBeVisible();
  await first.reload();
  await expect(first.getByText(/3 lớp · 9 tín chỉ/)).toBeVisible();
  // A wipe in one tab resets the other, which must not write its old Plan back.
  await second.locator("summary", { hasText: "Dữ liệu trên máy" }).click();
  await second.getByRole("button", { name: "Xóa dữ liệu trên máy" }).click();
  await second.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(first.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await first.reload();
  await expect(first.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
});

test("AC-M3-07 — a tampered artifact is rejected before it reaches the UI", async ({ page }) => {
  await page.route("**/timetable.json", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace("Giải tích 1", "Giải tích X");
    await route.fulfill({ response, body });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chưa xem được thời khóa biểu" })).toBeVisible();
  await expect(page.getByText("Dữ liệu tải về không khớp mã kiểm tra (có thể bị hỏng hoặc bị thay đổi).")).toBeVisible();
  await expect(page.getByText("Giải tích X")).toHaveCount(0);
});

type SyntheticSection = { id: string; sessions: { group?: string }[] };

/** Serves a new version of the HK II dataset whose sections are `mutate(current sections)`. */
async function publishRevision(page: Page, mutate: (sections: SyntheticSection[]) => SyntheticSection[]): Promise<void> {
  const manifest = await (await page.request.get("/data/manifest.json")).json();
  const entry = manifest.datasets.find((item: { term: string }) => item.term === "2026-2027-h2");
  const base = entry.artifacts[0].url.split("/").slice(0, -1).join("/");
  const next = `${entry.datasetVersion}-next`;
  const timetable = await (await page.request.get(`/data/${base}/timetable.json`)).json();
  const metadata = await (await page.request.get(`/data/${base}/metadata.json`)).json();
  timetable.datasetVersion = next;
  timetable.sections = mutate(timetable.sections).map((section) => ({ ...section, datasetVersion: next }));
  metadata.datasetVersion = next;
  const bodies = new Map<string, string>([[`timetable`, JSON.stringify(timetable)], [`metadata`, JSON.stringify(metadata)]]);
  const nextBase = base.replace(entry.datasetVersion, next);
  const nextEntry = {
    ...entry,
    datasetVersion: next,
    artifacts: entry.artifacts.map((artifact: { kind: string }) => {
      const body = bodies.get(artifact.kind)!;
      return { ...artifact, url: `${nextBase}/${artifact.kind}.json`, sha256: createHash("sha256").update(body).digest("hex"), bytes: Buffer.byteLength(body) };
    }),
  };
  await page.route("**/data/manifest.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...manifest, datasets: [...manifest.datasets, nextEntry] }) }));
  await page.route(`**/data/${nextBase}/*.json`, (route) => route.fulfill({ contentType: "application/json", body: bodies.get(route.request().url().endsWith("timetable.json") ? "timetable" : "metadata")! }));
  await page.reload();
  await expect(page.getByText("Dữ liệu thời khóa biểu đã có phiên bản khác")).toBeVisible();
}

test("AC-M3-07/12 — a new dataset version marks the Plan stale and rebases it after confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startPlan(page);
  await pick(page, "kien truc", "SYN2003 1");
  await pick(page, "SYN1002", "SYN1002 1");
  await publishRevision(page, (sections) => sections.filter((section) => section.id !== "SYN2003 1"));
  await page.getByRole("button", { name: "Cập nhật phương án" }).click();
  await expect(page.getByText(/sẽ bị bỏ khỏi phương án: SYN2003 1/)).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận cập nhật" }).click();
  await expect(page.getByText("Dữ liệu thời khóa biểu đã có phiên bản khác")).toHaveCount(0);
  await expect(page.getByText(/1 lớp · 3 tín chỉ/)).toBeVisible();
});

test("REV-M3-001/003 — a revision that renames a picked group keeps the conflict, asks for a new group and does not block other picks", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startPlan(page);
  await pick(page, "SYN1001", "SYN1001 1", { group: "2" });
  await pick(page, "SYN1003", "SYN1003 1", { button: /^Vẫn chọn/ });
  const bar = page.locator(".plan-bar");
  await expect(bar.getByText(/1 chỗ trùng lịch/)).toBeVisible();
  await publishRevision(page, (sections) => sections.map((section) => (section.id === "SYN1001 1"
    ? { ...section, sessions: section.sessions.map((session) => (session.group === "2" ? { ...session, group: "3" } : session)) }
    : section)));
  // Before the rebase: the common Monday session still conflicts and the pick is flagged.
  await expect(bar.getByText(/1 chỗ trùng lịch/)).toBeVisible();
  await expect(bar.getByText(/1 lớp cần xử lý/)).toBeVisible();
  await page.getByRole("button", { name: "Cập nhật phương án" }).click();
  await expect(page.getByText(/sẽ bỏ nhóm của: SYN1001 1/)).toBeVisible();
  await expect(page.getByText(/cần chọn lại nhóm cho: SYN1001 1/)).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận cập nhật" }).click();
  await expect(bar.getByText(/1 chỗ trùng lịch/)).toBeVisible();
  await expect(bar.getByText(/1 lớp cần xử lý/)).toBeVisible();
  await expect(page.getByText("✓ Không có lớp nào trùng lịch.")).toHaveCount(0);
  // An unrelated class can still be picked while SYN1001 1 waits for a group.
  await pick(page, "SYN2004", "SYN2004 1");
  // The common Monday session still overlaps SYN1003 1, so the button says so (QA-M3-007).
  await pick(page, "SYN1001", "SYN1001 1", { group: "3", button: /^Vẫn đổi nhóm \(đang trùng lịch\)/ });
  await expect(bar.getByText(/lớp cần xử lý/)).toHaveCount(0);
});

test("AC-M3-08/13 — provenance, CSP, same-origin requests only and inert dataset text", async ({ page, context, baseURL }) => {
  const requests: { url: string; method: string }[] = [];
  // Context-level capture also sees the service worker's own requests (SEC-M3-005).
  context.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await startPlan(page);
  const meta = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(meta).toHaveAttribute("content", /script-src 'self'/);
  // SEC-M3-007: the generated host headers carry the same CSP plus what only a header can enforce.
  const headers = await (await page.request.get("/_headers")).text();
  expect(headers).toContain(`Content-Security-Policy: ${await meta.getAttribute("content")}; frame-ancestors 'none'`);
  for (const line of ["X-Frame-Options: DENY", "X-Content-Type-Options: nosniff", "Referrer-Policy: no-referrer", "Strict-Transport-Security: max-age=31536000"]) expect(headers).toContain(line);
  await page.getByRole("button", { name: /Dữ liệu mẫu \(tổng hợp\) · synthetic-uet-2026-2027-h2\.1/ }).click();
  const provenance = page.getByRole("region", { name: "Nguồn và phiên bản dữ liệu" });
  for (const text of ["Dữ liệu mẫu (tổng hợp)", "SYNTHETIC-M3-WORKBOOK", "uet-xlsx@0.2.0", "chưa duyệt", "Mã kiểm tra (SHA-256)"]) await expect(provenance.getByText(text, { exact: false }).first()).toBeVisible();
  await expect(page.getByText("không phải sản phẩm của nhà trường").first()).toBeVisible();
  await pick(page, "kiem thu", "SYN9999 1");
  await expect(page.getByText(/<img src=x onerror=/).first()).toBeVisible();
  expect(await page.evaluate(() => (window as { __kyNayXss?: number }).__kyNayXss)).toBeUndefined();
  expect(requests.filter((request) => !request.url.startsWith(baseURL!))).toEqual([]);
  expect(requests.filter((request) => request.method !== "GET")).toEqual([]);
});
