/**
 * M5 UI (SPEC-M5-001 AC-M5-01/02/04/05/06/07/08): footer build line, About panel, report form, stale-data banners.
 */
import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { ReportIssueForm, ReportIssueProvider } from "./components/ReportIssue.js";
import type { DatasetManifest } from "./data/contract.js";
import { serveDataset, stubFetch, VERSION, type ServedFiles } from "./test/fixture.js";

const PII_TOKENS = ["Nguyễn Văn Bí Mật", "19/08/2005", "23029876", "CNTT Chuẩn Quốc Tế", "QH-2023-I/CQ", "1,500,000", "23029876_secret_ketqua.doc"];

function portalHtml(): string {
  return `<!DOCTYPE html><html><body>
  <table><tr><td>Họ và tên</td><td><b>Nguyễn Văn Bí Mật</b></td><td>Ngày sinh</td><td><b>19/08/2005</b></td><td>Mã sinh viên</td><td><b>23029876</b></td></tr>
  <tr><td>Chương trình đào tạo</td><td><b>CNTT Chuẩn Quốc Tế</b></td><td>Khóa</td><td><b>QH-2023-I/CQ</b></td></tr></table>
  <table>
    <tr><th>STT</th><th>Mã môn học</th><th>Môn học</th><th>Số tín chỉ</th><th>Trạng thái</th><th>Học phí</th><th>Lớp môn học</th><th>Thứ</th><th>Tiết</th><th>Giảng đường</th></tr>
    <tr><td>1</td><td>SYN1003</td><td>Vật lý đại cương</td><td>3</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>SYN1003 1</td><td>T2</td><td>1 - 3</td><td>305-G2</td></tr>
    <tr><td>2</td><td>MAT9999</td><td>Môn lạ</td><td>2</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>MAT9999 1</td><td>T6</td><td>1 - 3</td><td>101-G2</td></tr>
  </table></body></html>`;
}

/** The synthetic dataset with manifest-entry fields patched (the manifest itself is not hash-checked). */
function servedWith(patch: Record<string, string>): ServedFiles {
  const { files } = serveDataset({ status: "published" });
  const manifest = JSON.parse(files.get("data/manifest.json")!) as DatasetManifest;
  manifest.datasets = manifest.datasets.map((entry) => ({ ...entry, ...patch }));
  files.set("data/manifest.json", JSON.stringify(manifest));
  return files;
}

async function startPlan(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
  await user.selectOptions(screen.getByLabelText("Khóa"), "K69");
  await user.click(screen.getByRole("button", { name: "Tạo phương án" }));
  await screen.findByRole("heading", { name: "Phương án nháp" });
}

async function openCourse(user: ReturnType<typeof userEvent.setup>, query: string, code: string) {
  const input = screen.getByLabelText("Mã hoặc tên môn");
  await user.clear(input);
  await user.type(input, query);
  await user.click(await screen.findByRole("button", { name: new RegExp(`^${code}`) }));
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.stubGlobal("fetch", stubFetch(serveDataset({ status: "published" }).files));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("footer build line (AC-M5-01)", () => {
  it("shows the version and short commit", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText(/^Phiên bản \S+ · (?:[0-9a-f]{7}(?:-dirty)?|unknown)/)).toBeTruthy();
  });
});

describe("About panel (M5-C, AC-M5-06)", () => {
  it("opens from the footer by keyboard, lists every section and the IndexedDB contents, and returns focus on close", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    const toggle = screen.getByRole("button", { name: "Giới thiệu, quyền riêng tư & báo lỗi" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.focus();
    await user.keyboard("{Enter}");
    const panel = await screen.findByRole("region", { name: "Giới thiệu, quyền riêng tư & báo lỗi" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(within(panel).getByRole("heading", { level: 2 }));
    for (const heading of ["Công cụ độc lập", "Nguồn và cách cập nhật dữ liệu", "Quyền riêng tư", "Trình duyệt hỗ trợ", "Giới hạn đã biết", "Phiên bản", "Báo sai dữ liệu"]) {
      expect(within(panel).getByRole("heading", { name: heading, level: 3 })).toBeTruthy();
    }
    const privacy = within(panel).getByRole("region", { name: "Quyền riêng tư" });
    expect(within(privacy).getByText(/Phương án nháp và phương án chính thức/)).toBeTruthy();
    expect(within(privacy).getByText(/Bản sao bộ dữ liệu thời khóa biểu đã tải/)).toBeTruthy();
    expect(within(privacy).getByText(/Không có công cụ theo dõi/)).toBeTruthy();
    expect(within(privacy).getByText(/Không dùng cookie/)).toBeTruthy();
    expect(within(panel).getAllByText(/không phải sản phẩm của nhà trường/).length).toBeGreaterThan(0);
    expect(within(panel).getByText(/Chrome trên Android, Safari trên iOS/)).toBeTruthy();
    const versions = within(panel).getByRole("region", { name: "Phiên bản" });
    expect(within(versions).getByText(/^Phiên bản \S+ · /)).toBeTruthy();
    expect(within(versions).getByText(new RegExp(`^${VERSION} · `))).toBeTruthy();

    // "Đến mục Dữ liệu trên máy" opens the footer disclosure that holds "Xóa dữ liệu trên máy".
    await user.click(within(panel).getByRole("button", { name: "Đến mục “Dữ liệu trên máy”" }));
    const details = document.getElementById("local-data") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(within(details).getByRole("button", { name: "Xóa dữ liệu trên máy" })).toBeTruthy();

    await user.click(within(panel).getByRole("button", { name: "Đóng giới thiệu" }));
    expect(screen.queryByRole("region", { name: "Giới thiệu, quyền riêng tư & báo lỗi" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("general report: copy-only when no report URL is configured (AC-M5-04)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    await user.click(screen.getByRole("button", { name: "Giới thiệu, quyền riêng tư & báo lỗi" }));
    const panel = await screen.findByRole("region", { name: "Giới thiệu, quyền riêng tư & báo lỗi" });
    expect(within(panel).queryByRole("link", { name: /Mở trang báo lỗi/ })).toBeNull();
    expect(within(panel).getByText(/Chưa có trang báo lỗi được cấu hình/)).toBeTruthy();
    const output = within(panel).getByLabelText("Nội dung báo cáo") as HTMLTextAreaElement;
    expect(output.readOnly).toBe(true);
    expect(output.value).toContain(`Dữ liệu: ${VERSION}`);
    expect(output.value).not.toContain("Lớp:");
    expect((within(panel).getByLabelText("Mô tả (không bắt buộc)") as HTMLTextAreaElement).value).toBe("");
  });
});

describe("report form (M5-B)", () => {
  const dataset = { datasetVersion: VERSION, term: "2026-2027-h2", termName: "Học kỳ II (thử nghiệm)", status: "published" as const };

  it("renders the configured https link exactly, with noopener noreferrer, and nothing appended (AC-M5-03/04)", async () => {
    const user = userEvent.setup();
    render(<ReportIssueProvider dataset={dataset} reportUrl="https://example.invalid/report"><ReportIssueForm section={{ sectionId: "SYN1001 1", courseCode: "SYN1001" }} /></ReportIssueProvider>);
    await user.type(screen.getByLabelText("Mô tả (không bắt buộc)"), "Phòng sai");
    const link = screen.getByRole("link", { name: /Mở trang báo lỗi/ });
    expect(link.getAttribute("href")).toBe("https://example.invalid/report");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders no link for javascript:, data:, relative or plain-http URLs (AC-M5-04)", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "/report", "http://example.invalid/report", null]) {
      const { unmount } = render(<ReportIssueProvider dataset={dataset} reportUrl={bad}><ReportIssueForm /></ReportIssueProvider>);
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText(/Chưa có trang báo lỗi được cấu hình/)).toBeTruthy();
      unmount();
    }
  });

  it("copies the report with the Clipboard API", async () => {
    const user = userEvent.setup();
    render(<ReportIssueProvider dataset={dataset}><ReportIssueForm section={{ sectionId: "SYN1001 1", courseCode: "SYN1001" }} /></ReportIssueProvider>);
    await user.selectOptions(screen.getByLabelText("Thông tin bị sai"), "room");
    await user.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText(/Đã sao chép nội dung báo cáo/)).toBeTruthy();
    const copied = await navigator.clipboard.readText();
    expect(copied).toBe((screen.getByLabelText("Nội dung báo cáo") as HTMLTextAreaElement).value);
    expect(copied).toContain("Lớp: SYN1001 1 (môn SYN1001)");
    expect(copied).toContain("Thông tin sai: Phòng học");
  });

  it("falls back to a selected read-only text when the Clipboard API is refused or missing (AC-M5-05)", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const { unmount } = render(<ReportIssueProvider dataset={dataset}><ReportIssueForm /></ReportIssueProvider>);
    await user.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Không sao chép tự động được/)).toBeTruthy();
    const output = screen.getByLabelText("Nội dung báo cáo") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(output);
    expect(output.selectionEnd - output.selectionStart).toBe(output.value.length);
    unmount();

    const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    try {
      render(<ReportIssueProvider dataset={dataset}><ReportIssueForm /></ReportIssueProvider>);
      await user.click(screen.getByRole("button", { name: "Sao chép" }));
      expect(await screen.findByText(/Không sao chép tự động được/)).toBeTruthy();
    } finally {
      if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("warns, without blocking, when the note looks like personal data", async () => {
    const user = userEvent.setup();
    render(<ReportIssueProvider dataset={dataset}><ReportIssueForm /></ReportIssueProvider>);
    expect(screen.queryByText(/có thể chứa thông tin cá nhân/)).toBeNull();
    await user.type(screen.getByLabelText("Mô tả (không bắt buộc)"), "mã 23029876");
    expect(screen.getByText(/có thể chứa thông tin cá nhân/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sao chép" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("is hidden on section cards outside a provider", async () => {
    const { SectionCard } = await import("./components/SectionCard.js");
    const { buildAppCatalog } = await import("./model/catalog.js");
    const { testMetadata, testTimetable } = await import("./test/fixture.js");
    const { createPlan } = await import("@ky-nay/domain");
    const { entry } = serveDataset({ status: "published" });
    const catalog = buildAppCatalog({ entry, timetable: testTimetable(), metadata: testMetadata(), cachedAt: "2026-10-25T00:00:00.000Z" });
    const plan = createPlan({ id: "p", term: catalog.term.id, datasetVersion: VERSION, name: "Phương án nháp", planKind: "draft", cohort: "K69" }, "2026-10-25T00:00:00.000Z");
    render(<SectionCard section={catalog.sectionById.get("SYN1001 2")!} plan={plan} catalog={catalog} onPick={() => undefined} onUnpick={() => undefined} headingLevel="h3" />);
    expect(screen.queryByRole("button", { name: "Báo sai dữ liệu" })).toBeNull();
  });
});

describe("per-section report in the app (AC-M5-02)", () => {
  it("only carries public identifiers, even with a final Plan built from a registration file with PII and overrides", async () => {
    const user = userEvent.setup();
    await startPlan(user);
    await openCourse(user, "seminar", "SYN4001");
    await user.click(within(screen.getByRole("article", { name: "Lớp SYN4001 1" })).getByRole("button", { name: "Chọn lớp này" }));
    expect(await screen.findByRole("button", { name: "Phương án nháp (1)" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Nhập kết quả ĐKMH" }));
    await screen.findByRole("heading", { name: "Nhập kết quả đăng ký môn học (ĐKMH)" });
    await user.upload(screen.getByLabelText(/Chọn file Kết quả đăng ký môn học/), new File([portalHtml()], "23029876_secret_ketqua.doc", { type: "application/msword" }));
    await user.click(await screen.findByRole("button", { name: "Áp dụng vào Phương án chính thức" }));
    expect(await screen.findByRole("heading", { name: "Phương án chính thức" })).toBeTruthy();
    expect(screen.getByText(/thay đổi từ ĐKMH/)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Tìm môn" }));
    await openCourse(user, "vat ly", "SYN1003");
    const card = screen.getByRole("article", { name: "Lớp SYN1003 1" });
    const reportButton = within(card).getByRole("button", { name: "Báo sai dữ liệu" });
    expect(reportButton.getAttribute("aria-expanded")).toBe("false");
    await user.click(reportButton);
    expect(reportButton.getAttribute("aria-expanded")).toBe("true");
    expect((within(card).getByLabelText("Mô tả (không bắt buộc)") as HTMLTextAreaElement).value).toBe("");
    await user.selectOptions(within(card).getByLabelText("Thông tin bị sai"), "room");
    const text = (within(card).getByLabelText("Nội dung báo cáo") as HTMLTextAreaElement).value;
    expect(text).toContain("Lớp: SYN1003 1 (môn SYN1003)");
    expect(text).toContain(`Dữ liệu: ${VERSION}`);
    for (const token of [...PII_TOKENS, "305-G2", "Hòa Lạc A101", "MAT9999", "SYN4001", "Phương án", navigator.userAgent]) {
      expect(text).not.toContain(token);
    }
    expect(text.split("\n")).toHaveLength(6);

    await user.click(within(card).getByRole("button", { name: "Đóng" }));
    expect(within(card).queryByLabelText("Nội dung báo cáo")).toBeNull();
    expect(document.activeElement).toBe(reportButton);
  });
});

describe("stale and offline data banners (M5-D)", () => {
  it("warns with text and role=status when expiresAt has passed (AC-M5-07)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-07-15T03:00:00.000Z"));
    vi.stubGlobal("fetch", stubFetch(servedWith({ expiresAt: "2027-07-01T00:00:00.000Z" })));
    render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    const status = screen.getAllByRole("status").find((element) => /Dữ liệu đã hết hiệu lực/.test(element.textContent ?? ""));
    expect(status).toBeTruthy();
    expect(status!.textContent).toMatch(/hết hiệu lực từ 01\/07\/2027/);
  });

  it("shows no expiry warning for a future or missing expiresAt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-06-15T03:00:00.000Z"));
    vi.stubGlobal("fetch", stubFetch(servedWith({ expiresAt: "2027-07-01T00:00:00.000Z" })));
    const { unmount } = render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    expect(screen.queryByText("Dữ liệu đã hết hiệu lực")).toBeNull();
    unmount();
    vi.stubGlobal("fetch", stubFetch(serveDataset({ status: "published" }).files));
    render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    expect(screen.queryByText("Dữ liệu đã hết hiệu lực")).toBeNull();
  });

  it("offline with the saved dataset: the age is shown outside the provenance panel, with no extra request (AC-M5-08)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T03:00:00.000Z"));
    const files = servedWith({ publishedAt: "2026-11-06T02:00:00.000Z" });
    vi.stubGlobal("fetch", stubFetch(files));
    const first = render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    // The dataset is saved in IndexedDB on the first, online visit.
    await waitFor(async () => {
      const { openDb, idbEntries } = await import("./storage/db.js");
      const db = await openDb();
      const saved = await idbEntries(db, "datasets");
      db.close();
      expect(saved.length).toBe(1);
    });
    first.unmount();

    const requests: string[] = [];
    vi.stubGlobal("fetch", stubFetch(files, { offline: true, requests }));
    render(<App />);
    expect(await screen.findByText("Đang ngoại tuyến")).toBeTruthy();
    expect(screen.getByText(/Dữ liệu công bố 4 ngày trước\./)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Nguồn và phiên bản dữ liệu" })).toBeNull();
    expect(requests.every((url) => url === "data/manifest.json")).toBe(true);
  });
});
