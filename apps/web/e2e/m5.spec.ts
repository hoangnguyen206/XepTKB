/**
 * M5 end-to-end evidence (SPEC-M5-001 AC-M5-01/03/06/09/10/17) against the production build.
 * The report link is checked through the rendered DOM: it exists only once the build defines a valid
 * `__KY_NAY_REPORT_URL__` (WP2 wires `VITE_REPORT_ISSUE_URL`, set in playwright.config.ts). It is never clicked here,
 * because the shared network guard rejects any cross-origin request.
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "./fixture.js";

const VIEWPORTS = [
  { name: "360", width: 360, height: 780 },
  { name: "768", width: 768, height: 1024 },
  { name: "1200", width: 1200, height: 900 },
];
const REPORT_URL = process.env.VITE_REPORT_ISSUE_URL ?? "https://example.invalid/report";
const PII_MARKER = "PII-MARKER-24028888";
const BUILD_LINE = /Phiên bản (\S+) · ([0-9a-f]{7}(?:-dirty)?|unknown)/;

async function startDraftPlan(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
}

/** M6 F2: Lịch · Thêm lớp · Phương án are main-navigation buttons (formerly tabs). */
async function openView(page: Page, name: "Lịch" | "Thêm lớp" | "Phương án"): Promise<void> {
  const button = page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-current", "page");
}

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function axeSerious(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
}

async function openSearch(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 0) < 1200) await openView(page, "Thêm lớp");
  await expect(page.getByLabel("Mã hoặc tên môn")).toBeVisible();
}

test("AC-M5-01 — the (i) sheet shows the app version and short commit (and matches the build meta tag when present)", async ({ page }) => {
  // D-M6-11 / ADR-0015 point 7: the always-visible footer is gone; the version is in the (i) sheet, the error screen and the meta tag.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.getByRole("button", { name: "Giới thiệu, quyền riêng tư & báo lỗi" }).click();
  const line = page.getByRole("dialog", { name: "Giới thiệu, quyền riêng tư & báo lỗi" }).getByText(BUILD_LINE);
  await expect(line).toBeVisible();
  const [, version, commit] = BUILD_LINE.exec((await line.textContent()) ?? "")!;
  // The meta tag arrives with WP2's build plugin; when present it must name the same build.
  const meta = page.locator('meta[name="ky-nay-build"]');
  if ((await meta.count()) > 0) expect(await meta.getAttribute("content")).toBe(`${version}+${commit}`);
});

test("AC-M5-03/04 — report from a section card: PII-free text copied, zero requests, link exact or absent", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
  await page.setViewportSize({ width: 1280, height: 900 });
  await startDraftPlan(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByLabel("Mã hoặc tên môn").fill("SYN2004");
  await page.getByRole("button", { name: /^SYN2004/ }).click();
  const card = page.getByRole("article", { name: "Lớp SYN2004 1" });
  await card.getByRole("button", { name: "Chọn lớp này" }).click();
  await openView(page, "Phương án");
  await expect(page.getByRole("button", { name: "Phương án nháp (1)" })).toBeVisible();

  const reportRequests: { url: string; method: string }[] = [];
  context.on("request", (request) => reportRequests.push({ url: request.url(), method: request.method() }));

  await card.getByRole("button", { name: "Báo sai dữ liệu" }).click();
  await card.getByLabel("Thông tin bị sai").selectOption({ label: "Phòng học" });
  await card.getByLabel("Mô tả (không bắt buộc)").fill("Phòng trên TKB khác văn bản của trường.");
  const output = card.getByLabel("Nội dung báo cáo");
  const text = await output.inputValue();
  expect(text).toContain("Lớp: SYN2004 1 (môn SYN2004)");
  expect(text).toContain("Thông tin sai: Phòng học");
  expect(text).toMatch(/^Ứng dụng: \S+ \(/m);
  expect(text).not.toContain("Phương án");
  expect(text).not.toContain(await page.evaluate(() => navigator.userAgent));

  await card.getByRole("button", { name: "Sao chép" }).click();
  await expect(card.getByText(/Đã sao chép nội dung báo cáo/)).toBeVisible();
  // The OS clipboard may turn line breaks into CRLF (Windows).
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(text);

  const links = card.getByRole("link", { name: /Mở trang báo lỗi/ });
  if ((await links.count()) > 0) {
    await expect(links).toHaveAttribute("href", REPORT_URL);
    await expect(links).toHaveAttribute("target", "_blank");
    await expect(links).toHaveAttribute("rel", "noopener noreferrer");
  } else {
    await expect(card.getByText(/Chưa có trang báo lỗi được cấu hình/)).toBeVisible();
  }

  // AC-M5-03: opening the form, choosing a field, typing and copying start no request at all.
  expect(reportRequests).toEqual([]);
});

test("AC-M5-10 — onboarding does not load the registration chunk; the workspace prefetches it", async ({ page }) => {
  const pageRequests: string[] = [];
  page.on("request", (request) => {
    if (!request.serviceWorker()) pageRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  expect(pageRequests.filter((url) => /\/assets\/RegistrationImport-[^/]+\.js$/.test(url))).toEqual([]);

  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  await expect.poll(() => pageRequests.filter((url) => /\/assets\/RegistrationImport-[^/]+\.js$/.test(url)).length).toBe(1);
});

test("AC-M5-10 — offline after the service worker is ready, the registration import panel still opens", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startDraftPlan(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  // AC-M6-04: the offline banner is now a chip; its sentence (with the age) is one tap away.
  await page.getByRole("button", { name: "Ngoại tuyến" }).click();
  const source = page.getByRole("dialog", { name: "Nguồn và phiên bản dữ liệu" });
  await expect(source.getByText("Đang ngoại tuyến")).toBeVisible();
  await expect(source.getByText(/Dữ liệu (?:công bố|duyệt|nhập) (?:\d+ ngày trước|hôm nay)\./)).toBeVisible();
  await page.keyboard.press("Escape");
  await openView(page, "Phương án");
  await page.getByRole("button", { name: "Nhập kết quả ĐKMH" }).click();
  await expect(page.getByRole("heading", { name: "Nhập kết quả đăng ký môn học (ĐKMH)" })).toBeVisible();
  await expect(page.getByText("Chưa tải được phần nhập ĐKMH")).toHaveCount(0);
  await context.setOffline(false);
});

test("AC-M5-06/17 — About panel and report form: keyboard, no overflow, zero serious/critical axe violations at 360/768/1200 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startDraftPlan(page);
  const toggle = page.getByRole("button", { name: "Giới thiệu, quyền riêng tư & báo lỗi" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Giới thiệu, quyền riêng tư & báo lỗi" });
  await expect(panel).toBeVisible();
  // A modal sheet: focus moves inside it.
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")))).toBe(true);
  for (const heading of ["Công cụ độc lập", "Nguồn và cách cập nhật dữ liệu", "Quyền riêng tư", "Trình duyệt hỗ trợ", "Giới hạn đã biết", "Phiên bản", "Báo sai dữ liệu"]) {
    await expect(panel.getByRole("heading", { name: heading, level: 3 })).toBeVisible();
  }
  await expect(panel.getByText(BUILD_LINE)).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    expect(await pageOverflow(page), `about overflow at ${viewport.name}`).toBeLessThanOrEqual(0);
    expect(await axeSerious(page), `about axe at ${viewport.name}`).toEqual([]);
  }

  await panel.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(toggle).toBeFocused();

  // Per-section report form (open, with the personal-data warning) at every width. At 1200 px the search pane moves
  // into the side column and remounts, so the form is opened again there.
  const card = page.getByRole("article", { name: "Lớp SYN2004 1" });
  // The layout switch after setViewportSize is asynchronous (media query → re-render): a one-shot isVisible() could
  // see the old pane's card just before the remount and then wait forever on a button that no longer exists (flaky on
  // CI push runs #51/#53). toPass() retries the whole step until the form is open in the current layout.
  const openReport = async () => {
    const note = card.getByLabel("Mô tả (không bắt buộc)");
    await expect(async () => {
      await openSearch(page);
      if (!(await card.isVisible())) {
        await page.getByLabel("Mã hoặc tên môn").fill("SYN2004");
        await page.getByRole("button", { name: /^SYN2004/ }).click({ timeout: 3_000 });
      }
      if (!(await note.isVisible())) await card.getByRole("button", { name: "Báo sai dữ liệu" }).click({ timeout: 3_000 });
      await expect(note).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
    if ((await note.inputValue()) === "") await note.fill("Mã 24028888");
    await expect(card.getByText("Mô tả có thể chứa thông tin cá nhân")).toBeVisible();
    await expect(card.getByLabel("Nội dung báo cáo")).toBeVisible();
  };
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await openReport();
    expect(await pageOverflow(page), `report form overflow at ${viewport.name}`).toBeLessThanOrEqual(0);
    expect(await axeSerious(page), `report form axe at ${viewport.name}`).toEqual([]);
  }
});

test("AC-M5-09/17 — a render error shows the recovery screen (name only), no request/console/IndexedDB leak; reload keeps the Plan, wipe needs confirmation", async ({ page, context }) => {
  // Test-only fault injection: once `__kyNayCrash` is set, constructing Intl.DateTimeFormat throws an error whose
  // message carries a PII marker. The provenance panel formats instants during render, so opening it crashes there.
  await page.addInitScript((marker) => {
    const Original = Intl.DateTimeFormat;
    const Patched = function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      if ((window as unknown as { __kyNayCrash?: boolean }).__kyNayCrash) {
        const error = new Error(marker);
        error.name = "RangeError";
        throw error;
      }
      return new Original(...args);
    } as unknown as typeof Intl.DateTimeFormat;
    Object.setPrototypeOf(Patched, Original);
    Intl.DateTimeFormat = Patched;
  }, PII_MARKER);
  await page.setViewportSize({ width: 360, height: 780 });
  await startDraftPlan(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  const consoleMessages: string[] = [];
  const crashRequests: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  page.on("pageerror", (error) => consoleMessages.push(String(error)));
  context.on("request", (request) => crashRequests.push(request.url()));

  await page.evaluate(() => {
    (window as unknown as { __kyNayCrash?: boolean }).__kyNayCrash = true;
  });
  await page.getByRole("button", { name: /Nguồn dữ liệu/ }).click();
  const heading = page.getByRole("heading", { name: "Ứng dụng gặp lỗi" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByText(/Lỗi: RangeError · Phiên bản /)).toBeVisible();

  expect(crashRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.textContent ?? "")).not.toContain("PII-MARKER");
  expect(consoleMessages.join("\n")).not.toContain("PII-MARKER");
  const idbDump = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ky-nay");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const out: Record<string, unknown[]> = {};
    for (const name of Array.from(db.objectStoreNames)) {
      out[name] = await new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(name, "readonly").objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    db.close();
    return JSON.stringify(out);
  });
  expect(idbDump).not.toContain("PII-MARKER");

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    expect(await pageOverflow(page), `error screen overflow at ${viewport.name}`).toBeLessThanOrEqual(0);
    expect(await axeSerious(page), `error screen axe at ${viewport.name}`).toEqual([]);
  }

  // Confirmation step is reachable by keyboard and can be cancelled.
  await page.getByRole("button", { name: "Xóa dữ liệu trên máy rồi tải lại" }).click();
  await expect(page.getByRole("button", { name: "Xác nhận xóa và tải lại" })).toBeVisible();
  expect(await axeSerious(page), "error screen confirm axe").toEqual([]);
  await page.getByRole("button", { name: "Hủy" }).click();

  // "Tải lại trang" keeps the Plan (the crash flag does not survive a reload).
  await page.getByRole("button", { name: "Tải lại trang" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();

  // Crash again, then wipe with confirmation: the next load starts from onboarding.
  await page.evaluate(() => {
    (window as unknown as { __kyNayCrash?: boolean }).__kyNayCrash = true;
  });
  await page.getByRole("button", { name: /Nguồn dữ liệu/ }).click();
  await expect(page.getByRole("heading", { name: "Ứng dụng gặp lỗi" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa dữ liệu trên máy rồi tải lại" }).click();
  await page.getByRole("button", { name: "Xác nhận xóa và tải lại" }).click();
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
});
