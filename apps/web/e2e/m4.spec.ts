/**
 * M4 end-to-end evidence (SPEC-M4-001 AC-M4-01…08, AC-04, AC-05) against the production build.
 */
import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "./fixture.js";

const VIEWPORTS = [
  { name: "360", width: 360, height: 780 },
  { name: "768", width: 768, height: 1024 },
  { name: "1200", width: 1200, height: 900 },
];

const PII_TOKENS = [
  "Nguyễn Thị Thử Nghiệm",
  "15/09/2006",
  "24028888",
  "KHMT Chất Lượng Cao",
  "QH-2024-I/CQ",
  "1,800,000",
  "4,200,000",
  "24028888_NguyenThiThuNghiem.doc",
];

function buildPortalDocHtml(): string {
  return `<!DOCTYPE html>
<html>
<body>
  <table>
    <tr>
      <td>Họ và tên</td><td><b>Nguyễn Thị Thử Nghiệm</b></td>
      <td>Ngày sinh</td><td><b>15/09/2006</b></td>
      <td>Mã sinh viên</td><td><b>24028888</b></td>
    </tr>
    <tr>
      <td>Chương trình đào tạo</td><td><b>KHMT Chất Lượng Cao</b></td>
      <td>Khóa</td><td><b>QH-2024-I/CQ</b></td>
    </tr>
  </table>
  <table>
    <tr>
      <th>STT</th>
      <th>Mã môn học</th>
      <th>Môn học</th>
      <th>Số tín chỉ</th>
      <th>Trạng thái</th>
      <th>Học phí</th>
      <th>Lớp môn học</th>
      <th>Thứ</th>
      <th>Tiết</th>
      <th>Giảng đường</th>
    </tr>
    <tr>
      <td>1</td>
      <td>SYN1001</td>
      <td>Giải tích 1</td>
      <td>4</td>
      <td>Đăng ký lần đầu</td>
      <td>1,800,000</td>
      <td>SYN1001 1</td>
      <td>T2,T5</td>
      <td>1 - 3,7 - 9</td>
      <td>301-G2402-G2</td>
    </tr>
    <tr>
      <td>2</td>
      <td>SYN1002</td>
      <td>Đại số tuyến tính</td>
      <td>3</td>
      <td>Đăng ký lần đầu</td>
      <td>1,800,000</td>
      <td>SYN1002 1</td>
      <td>T2</td>
      <td>7 - 9</td>
      <td>505-G2</td>
    </tr>
    <tr>
      <td>3</td>
      <td>UNMATCHED999</td>
      <td>Môn ngoài TKB</td>
      <td>2</td>
      <td>Đăng ký lần đầu</td>
      <td>600,000</td>
      <td>UNMATCHED999 1</td>
      <td>T4</td>
      <td>1 - 3</td>
      <td>101-G2</td>
    </tr>
    <tr>
      <td></td><td></td><td>Tổng</td><td>9</td><td></td><td>4,200,000</td><td></td><td></td><td></td><td></td>
    </tr>
  </table>
</body>
</html>`;
}

async function startDraftPlan(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" })).toBeVisible();
  await page.getByLabel("Khóa", { exact: true }).selectOption("K69");
  await page.getByRole("button", { name: "Tạo phương án" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
}

/** M6 F2: Lịch · Thêm lớp · Phương án are main-navigation buttons (formerly tabs). Switching views makes no request. */
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

test("AC-M4-01..07 (AC-04, AC-05) — local-only registration merge, zero network/PII leakage, override badges, 2-slot switcher and exports", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startDraftPlan(page);

  // Pick SYN2004 1 in the draft plan
  await page.getByLabel("Mã hoặc tên môn").fill("SYN2004");
  await page.getByRole("button", { name: /^SYN2004/ }).click();
  await page.getByRole("article", { name: "Lớp SYN2004 1" }).getByRole("button", { name: "Chọn lớp này" }).click();
  await openView(page, "Phương án");
  await expect(page.getByRole("button", { name: "Phương án nháp (1)" })).toBeVisible();

  // Wait for service worker ready before starting strict zero-network capture for registration import
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  const postImportRequests: { url: string; method: string }[] = [];
  const consoleMessages: string[] = [];
  context.on("request", (req) => postImportRequests.push({ url: req.url(), method: req.method() }));
  page.on("console", (msg) => consoleMessages.push(msg.text()));

  // Open registration import panel
  await page.getByRole("button", { name: "Nhập kết quả ĐKMH" }).click();
  await expect(page.getByRole("heading", { name: "Nhập kết quả đăng ký môn học (ĐKMH)" })).toBeVisible();

  const fileInput = page.getByLabel("Chọn file Kết quả đăng ký môn học (.doc, .htm, .html)");

  // 1. Reject binary .docx (ZIP magic bytes)
  await fileInput.setInputFiles({
    name: "ketqua.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
  });
  await expect(page.getByText(/Đây là file Word \(\.docx\) hoặc file nén ZIP/)).toBeVisible();

  // 2. Upload portal registration .doc with PII
  await fileInput.setInputFiles({
    name: "24028888_NguyenThiThuNghiem.doc",
    mimeType: "application/msword",
    buffer: Buffer.from(buildPortalDocHtml(), "utf8"),
  });

  await expect(page.getByRole("heading", { name: /Xem trước trước khi lưu: 2 lớp khớp TKB/ })).toBeVisible();
  await expect(page.getByText(/Phòng học: 203-G2 → 505-G2 \(theo ĐKMH\)/)).toBeVisible();
  await expect(page.getByText(/Tiết học: tiết 4–6 → tiết 7–9 \(theo ĐKMH\)/)).toBeVisible();
  await expect(page.getByText(/Có 1 lớp trong file ĐKMH không khớp dữ liệu TKB/)).toBeVisible();

  // Confirm merge into Phương án chính thức
  await page.getByRole("button", { name: "Áp dụng vào Phương án chính thức" }).click();
  await expect(page.getByRole("heading", { name: "Phương án chính thức" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phương án nháp (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phương án chính thức (2)" })).toBeVisible();
  await expect(page.getByText(/★ 3 thay đổi từ ĐKMH/)).toBeVisible();

  // Check WeekGrid shows override badge
  await openView(page, "Lịch");
  const grid = page.getByRole("region", { name: /Lưới thời khóa biểu/ });
  await expect(grid.locator(".block.is-overridden").first()).toBeVisible();
  await expect(grid.getByText(/Đã đổi phòng/).first()).toBeAttached();

  // Check DayList shows override badge and detail
  await page.getByRole("region", { name: "Theo ngày" }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Đã đổi phòng").first()).toBeVisible();
  await expect(page.getByText(/Phòng học: 203-G2 → 505-G2 \(theo ĐKMH\)/).first()).toBeVisible();

  // Check PlanSummary and export .ics and .doc from Phương án chính thức
  await openView(page, "Phương án");
  await expect(page.getByText(/Có 1 lớp trong file ĐKMH chưa khớp dữ liệu TKB/)).toBeVisible();

  const [icsDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Tải lịch (.ics)" }).click(),
  ]);
  const icsContent = readFileSync(await icsDownload.path(), "utf8");
  const unfoldedIcs = icsContent.replace(/\r\n /g, "");
  expect(unfoldedIcs).toContain("X-WR-CALNAME:Phương án chính thức");
  expect(unfoldedIcs).toContain("LOCATION:505-G2");
  expect(unfoldedIcs).toContain("Phòng học: 203-G2 → 505-G2 (theo ĐKMH)");

  const [docDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Tải Word (.doc)" }).click(),
  ]);
  const docContent = readFileSync(await docDownload.path(), "utf8");
  expect(docContent).toContain("Phương án chính thức");
  expect(docContent).toContain("Phòng học: 203-G2 → 505-G2 (theo ĐKMH)");

  // AC-04: Zero network requests were sent during file selection, preview, confirmation, or export
  expect(postImportRequests).toEqual([]);

  // AC-04: Zero PII in DOM, IndexedDB, console logs, and exported files
  const domContent = await page.evaluate(() => document.documentElement.innerHTML);
  const idbDump = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("ky-nay");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const out: Record<string, unknown[]> = {};
    for (const name of Array.from(db.objectStoreNames)) {
      out[name] = await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(name, "readonly");
        const req = tx.objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    db.close();
    return JSON.stringify(out);
  });

  for (const token of PII_TOKENS) {
    expect(domContent).not.toContain(token);
    expect(idbDump).not.toContain(token);
    expect(icsContent).not.toContain(token);
    expect(docContent).not.toContain(token);
    expect(consoleMessages.join("\n")).not.toContain(token);
  }

  // Switch back to Phương án nháp -> SYN2004 1 is untouched
  await page.getByRole("button", { name: "Phương án nháp (1)" }).click();
  await expect(page.getByRole("heading", { name: "Phương án nháp" })).toBeVisible();
  await expect(page.getByText(/SYN2004 1/).first()).toBeVisible();
  await expectActiveSlotPersisted(page, "draft");

  // Switch to Phương án chính thức and reload -> active slot and overrides persist
  await page.getByRole("button", { name: "Phương án chính thức (2)" }).click();
  await expect(page.getByRole("heading", { name: "Phương án chính thức" })).toBeVisible();
  await expectActiveSlotPersisted(page, "final");
  await page.reload();
  await openView(page, "Phương án");
  await expect(page.getByRole("heading", { name: "Phương án chính thức" })).toBeVisible();
  await expect(page.getByText(/★ 3 thay đổi từ ĐKMH/)).toBeVisible();
});

test("AC-M4-08 — no horizontal overflow and zero serious/critical axe violations at 360/768/1200 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startDraftPlan(page);
  await openView(page, "Phương án");
  await page.getByRole("button", { name: "Nhập kết quả ĐKMH" }).click();
  const fileInput = page.getByLabel("Chọn file Kết quả đăng ký môn học (.doc, .htm, .html)");
  await fileInput.setInputFiles({
    name: "24028888_NguyenThiThuNghiem.doc",
    mimeType: "application/msword",
    buffer: Buffer.from(buildPortalDocHtml(), "utf8"),
  });
  await expect(page.getByRole("heading", { name: /Xem trước trước khi lưu/ })).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    expect(await pageOverflow(page), `preview overflow at ${viewport.name}`).toBeLessThanOrEqual(0);
    expect(await axeSerious(page), `preview axe at ${viewport.name}`).toEqual([]);
  }

  await page.getByRole("button", { name: "Áp dụng vào Phương án chính thức" }).click();
  await expect(page.getByRole("heading", { name: "Phương án chính thức" })).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const view of ["Lịch", "Phương án"] as const) {
      await openView(page, view);
      expect(await pageOverflow(page), `final plan ${view} overflow at ${viewport.name}`).toBeLessThanOrEqual(0);
      expect(await axeSerious(page), `final plan ${view} axe at ${viewport.name}`).toEqual([]);
    }
  }
});

/**
 * selectSlot updates the UI first and persists `activeSlots` to IndexedDB asynchronously. Wait for the write
 * before the next slot switch or reload, so a slow runner cannot reload mid-write (CI run 43050357462, attempt 2).
 */
async function expectActiveSlotPersisted(page: Page, slot: "draft" | "final"): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open("ky-nay");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          const rows = await new Promise<unknown[]>((resolve, reject) => {
            const req = db.transaction("settings", "readonly").objectStore("settings").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          db.close();
          const slots = rows.flatMap((row) =>
            row && typeof row === "object" && "activeSlots" in row ? Object.values((row as { activeSlots: Record<string, string> }).activeSlots ?? {}) : [],
          );
          return slots;
        }),
      { timeout: 10_000 },
    )
    .toContain(slot);
}
