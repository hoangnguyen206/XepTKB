import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlan, type Plan } from "@ky-nay/domain";
import { MAX_REGISTRATION_BYTES } from "@ky-nay/parser/registration";
import { App } from "./App.js";
import { buildAppCatalog } from "./model/catalog.js";
import { buildPlanView, rebasePlan } from "./model/plan-view.js";
import { buildRegistrationPreview, checkRegistrationBytes } from "./model/registration.js";
import { openDb, idbEntries } from "./storage/db.js";
import { serveDataset, stubFetch, testMetadata, testTimetable, VERSION } from "./test/fixture.js";

function buildPortalHtml(rows: { courseCode: string; courseName: string; credits: string; sectionId: string; day: string; periods: string; room: string }[]): string {
  const trs = rows
    .map(
      (row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${row.courseCode}</td>
        <td>${row.courseName}</td>
        <td>${row.credits}</td>
        <td>Đăng ký lần đầu</td>
        <td>1,500,000</td>
        <td>${row.sectionId}</td>
        <td>${row.day}</td>
        <td>${row.periods}</td>
        <td>${row.room}</td>
      </tr>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html>
<body>
  <table>
    <tr>
      <td>Họ và tên</td><td><b>Nguyễn Văn Bí Mật</b></td>
      <td>Ngày sinh</td><td><b>19/08/2005</b></td>
      <td>Mã sinh viên</td><td><b>23029876</b></td>
    </tr>
    <tr>
      <td>Chương trình đào tạo</td><td><b>CNTT Chuẩn Quốc Tế</b></td>
      <td>Khóa</td><td><b>QH-2023-I/CQ</b></td>
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
    ${trs}
    <tr>
      <td></td><td></td><td>Tổng</td><td>7</td><td></td><td>3,000,000</td><td></td><td></td><td></td><td></td>
    </tr>
  </table>
</body>
</html>`;
}

const PII_TOKENS = [
  "Nguyễn Văn Bí Mật",
  "19/08/2005",
  "23029876",
  "CNTT Chuẩn Quốc Tế",
  "QH-2023-I/CQ",
  "1,500,000",
  "3,000,000",
  "Sinh Viên Mẫu",
  "01/01/2000",
  "00000000",
  "Chương trình mẫu",
  "QH-0000-X/XX",
  "500,000",
  "1,900,000",
  "23029876_secret_ketqua.doc",
];

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.stubGlobal("fetch", stubFetch(serveDataset({ status: "published" }).files));
});

describe("registration byte guards and preview model (AC-M4-01, AC-M4-02, AC-M4-05, AC-M4-06)", () => {
  const { entry } = serveDataset({ status: "published" });
  const catalog = buildAppCatalog({ entry, timetable: testTimetable(), metadata: testMetadata(), cachedAt: "2026-10-25T00:00:00.000Z" });
  const draftPlan: Plan = createPlan(
    { id: "draft-1", term: catalog.term.id, datasetVersion: VERSION, name: "Phương án nháp", planKind: "draft", cohort: "K69", picks: [{ sectionId: "SYN4001 1" }] },
    "2026-10-25T00:00:00.000Z",
  );

  it("rejects empty, >2 MiB, .docx (ZIP), binary .doc (OLE2), .pdf and table-less HTML", () => {
    expect(checkRegistrationBytes(new Uint8Array(0))).toMatch(/File rỗng/);
    expect(checkRegistrationBytes(new Uint8Array(MAX_REGISTRATION_BYTES + 1))).toMatch(/vượt quá giới hạn 2 MB/);
    expect(checkRegistrationBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toMatch(/\.docx/);
    expect(checkRegistrationBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00]))).toMatch(/Word nhị phân/);
    expect(checkRegistrationBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toMatch(/PDF/);

    const noTable = buildRegistrationPreview({
      bytes: new TextEncoder().encode("<html><body><p>Xin chào</p></body></html>"),
      catalog,
      draftPlan,
    });
    expect(noTable.ok).toBe(false);
    expect(noTable.fatalError).toMatch(/không chứa bảng/);
  });

  it("parses redacted portal-format.doc with zero PII in the preview output", () => {
    const samplePath = resolve(process.cwd(), "../../fixtures/redacted-registration/portal-format.doc");
    const bytes = new Uint8Array(readFileSync(samplePath));
    const preview = buildRegistrationPreview({ bytes, catalog, draftPlan });
    expect(preview.ok).toBe(true);
    const serialized = JSON.stringify(preview);
    for (const token of PII_TOKENS) {
      expect(serialized).not.toContain(token);
    }
  });

  it("detects room/time overrides, infers group from TH slot, keeps unmatched as warning and preserves draftPlan", () => {
    const html = buildPortalHtml([
      // SYN1001 1: T2 1-3 (common) + T5 7-9 (matches group 2 TH) with room changed on T5 to 402-G2
      { courseCode: "SYN1001", courseName: "Giải tích 1 <script>evil()</script>", credits: "4", sectionId: "SYN1001 1", day: "T2,T5", periods: "1 - 3,7 - 9", room: "301-G2402-G2" },
      // SYN1003 1: room changed from Hòa Lạc A101 -> 305-G2 and periods changed from 1-3 -> 4-6
      { courseCode: "SYN1003", courseName: "Vật lý đại cương", credits: "3", sectionId: "SYN1003 1", day: "T2", periods: "4 - 6", room: "305-G2" },
      // Unmatched section not in catalog
      { courseCode: "INT9999", courseName: "Môn ngoài TKB", credits: "3", sectionId: "INT9999 1", day: "T6", periods: "1 - 3", room: "101-G2" },
    ]);
    const preview = buildRegistrationPreview({
      bytes: new TextEncoder().encode(html),
      catalog,
      draftPlan,
      now: "2026-10-26T00:00:00.000Z",
    });

    expect(preview.ok).toBe(true);
    expect(preview.plan?.planKind).toBe("final");
    expect(preview.plan?.id).toBe("draft-1:final");
    expect(preview.plan?.picks).toEqual([
      { sectionId: "SYN1001 1", group: "2" },
      { sectionId: "SYN1003 1" },
    ]);
    // Draft plan is completely untouched
    expect(draftPlan.picks).toEqual([{ sectionId: "SYN4001 1" }]);
    // Unmatched section is listed in preview.unmatched, not in picks
    expect(preview.unmatched.map((item) => item.sectionId)).toEqual(["INT9999 1"]);

    // Verify overrides on SYN1003 1 (room, campus, periods)
    const syn1003Overrides = preview.overrides.filter((ov) => ov.sectionId === "SYN1003 1");
    expect(syn1003Overrides.map((ov) => ov.badge)).toContain("Đã đổi phòng");
    expect(syn1003Overrides.map((ov) => ov.badge)).toContain("Đã đổi giờ");
    expect(syn1003Overrides.map((ov) => ov.detail)).toContain("Phòng học: Hòa Lạc A101 → 305-G2 (theo ĐKMH)");
    expect(syn1003Overrides.map((ov) => ov.detail)).toContain("Tiết học: tiết 1–3 → tiết 4–6 (theo ĐKMH)");

    // Verify buildPlanView applies overrides from the persisted finalPlan
    const view = buildPlanView(preview.plan!, catalog);
    const syn1003Session = view.sessions.find((s) => s.sectionId === "SYN1003 1")!;
    expect(syn1003Session.room).toBe("305-G2");
    expect(syn1003Session.startPeriod).toBe(4);
    expect(syn1003Session.endPeriod).toBe(6);

    // Zero PII in preview
    const serialized = JSON.stringify(preview);
    for (const token of PII_TOKENS) {
      expect(serialized).not.toContain(token);
    }
  });

  it("inherits group from draftPlan when portal row only lists common session, and refreshes overrides on rebase", () => {
    const draftWithGroup = { ...draftPlan, picks: [{ sectionId: "SYN1001 1", group: "1" }] };
    const html = buildPortalHtml([
      { courseCode: "SYN1001", courseName: "Giải tích 1", credits: "4", sectionId: "SYN1001 1", day: "T2", periods: "1 - 3", room: "505-G2" },
    ]);
    const preview = buildRegistrationPreview({
      bytes: new TextEncoder().encode(html),
      catalog,
      draftPlan: draftWithGroup,
    });
    expect(preview.plan?.picks).toEqual([{ sectionId: "SYN1001 1", group: "1" }]);

    // If the timetable updates to match the registration room ("505-G2"), rebasePlan drops the redundant registration override
    const nextTimetable = testTimetable("v2");
    nextTimetable.sections[0]!.sessions[0] = { ...nextTimetable.sections[0]!.sessions[0]!, room: "505-G2" };
    const nextCatalog = buildAppCatalog({
      entry: serveDataset({ version: "v2" }).entry,
      timetable: nextTimetable,
      metadata: testMetadata("v2"),
      cachedAt: "2026-10-27T00:00:00.000Z",
    });
    const rebased = rebasePlan(preview.plan!, nextCatalog, "2026-10-27T00:00:00.000Z");
    expect(rebased.overrides.filter((ov) => ov.field === "room")).toHaveLength(0);
  });
});

describe("M4 UI flow: preview, confirm, 2-slot switcher, group picker, re-import, delete & zero PII (AC-M4-02..07)", () => {
  it("supports preview cancel, confirm into final slot, group resolution, slot switching, and zero PII in DOM/IndexedDB", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Bắt đầu xếp thời khóa biểu" });
    await user.selectOptions(screen.getByLabelText("Khóa"), "K69");
    await user.click(screen.getByRole("button", { name: "Tạo phương án" }));
    await screen.findByRole("heading", { name: "Phương án nháp" });

    // Pick SYN4001 1 in draft plan
    const searchInput = screen.getByLabelText("Mã hoặc tên môn");
    await user.type(searchInput, "seminar");
    await user.click(await screen.findByRole("button", { name: /SYN4001/ }));
    await user.click(within(screen.getByRole("article", { name: "Lớp SYN4001 1" })).getByRole("button", { name: "Chọn lớp này" }));
    expect(await screen.findByRole("button", { name: "Phương án nháp (1)" })).toBeTruthy();

    // Open Registration Import panel
    await user.click(screen.getByRole("button", { name: "Nhập kết quả ĐKMH" }));
    expect(await screen.findByRole("heading", { name: "Nhập kết quả đăng ký môn học (ĐKMH)" })).toBeTruthy();

    const html = buildPortalHtml([
      // SYN1001 1 with only T2 1-3 -> requires group selection after import
      { courseCode: "SYN1001", courseName: "Giải tích 1", credits: "4", sectionId: "SYN1001 1", day: "T2", periods: "1 - 3", room: "501-G2" },
      // SYN1003 1 with room changed Hòa Lạc A101 -> 305-G2
      { courseCode: "SYN1003", courseName: "Vật lý đại cương", credits: "3", sectionId: "SYN1003 1", day: "T2", periods: "1 - 3", room: "305-G2" },
      // Unmatched class
      { courseCode: "MAT9999", courseName: "Môn lạ", credits: "2", sectionId: "MAT9999 1", day: "T6", periods: "1 - 3", room: "101-G2" },
    ]);
    const makeFile = () => new File([html], "23029876_secret_ketqua.doc", { type: "application/msword" });

    // 1. Upload and click Hủy -> nothing saved to final slot
    await user.upload(screen.getByLabelText(/Chọn file Kết quả đăng ký môn học/), makeFile());
    expect(await screen.findByRole("heading", { name: /Xem trước trước khi lưu: 2 lớp khớp TKB/ })).toBeTruthy();
    expect(screen.getByText(/Có 1 lớp trong file ĐKMH không khớp dữ liệu TKB/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("button", { name: /Phương án chính thức/ })).toBeNull();

    // 2. Re-open, upload and click Confirm -> switches to Phương án chính thức
    await user.click(screen.getByRole("button", { name: "Nhập kết quả ĐKMH" }));
    await user.upload(screen.getByLabelText(/Chọn file Kết quả đăng ký môn học/), makeFile());
    await user.click(await screen.findByRole("button", { name: "Áp dụng vào Phương án chính thức" }));

    expect(await screen.findByRole("heading", { name: "Phương án chính thức" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phương án nháp (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phương án chính thức (2)" })).toBeTruthy();

    // Check Plan tab on Phương án chính thức
    await user.click(screen.getByRole("tab", { name: /^Phương án/ }));
    const planPanel = await screen.findByRole("tabpanel");
    expect(within(planPanel).getAllByText("Đã đổi phòng").length).toBeGreaterThan(0);
    expect(within(planPanel).getByText(/Phòng học: Hòa Lạc A101 → 305-G2 \(theo ĐKMH\)/)).toBeTruthy();
    expect(within(planPanel).getByText(/Có 1 lớp trong file ĐKMH chưa khớp dữ liệu TKB/)).toBeTruthy();

    // Select group 2 for SYN1001 1 inline in PlanSummary
    const groupSelect = within(planPanel).getByLabelText("Nhóm thực hành");
    await user.selectOptions(groupSelect, "2");
    await waitFor(() => expect(screen.queryByText(/1 lớp cần xử lý/)).toBeNull());
    // Overrides remain intact after selecting group
    expect(within(planPanel).getByText(/Phòng học: Hòa Lạc A101 → 305-G2 \(theo ĐKMH\)/)).toBeTruthy();

    // Check Day tab shows override badge and detail
    await user.click(screen.getByRole("tab", { name: "Ngày" }));
    const dayPanel = await screen.findByRole("tabpanel");
    expect(within(dayPanel).getAllByText("Đã đổi phòng").length).toBeGreaterThan(0);

    // Switch back to Phương án nháp -> SYN4001 1 is still preserved
    await user.click(screen.getByRole("button", { name: "Phương án nháp (1)" }));
    expect(await screen.findByRole("heading", { name: "Phương án nháp" })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /^Phương án/ }));
    expect(within(await screen.findByRole("tabpanel")).getByText(/SYN4001 1/)).toBeTruthy();

    // Verify zero PII in DOM and IndexedDB
    const domText = document.body.textContent ?? "";
    for (const token of PII_TOKENS) {
      expect(domText).not.toContain(token);
    }
    const db = await openDb();
    for (const store of ["plans", "datasets", "settings", "backups"] as const) {
      const entries = await idbEntries(db, store);
      const serialized = JSON.stringify(entries);
      for (const token of PII_TOKENS) {
        expect(serialized).not.toContain(token);
      }
    }
    db.close();

    // Switch back to Phương án chính thức and delete it -> returns to Phương án nháp
    await user.click(screen.getByRole("button", { name: "Phương án chính thức (2)" }));
    await user.click(screen.getByRole("tab", { name: /^Phương án/ }));
    await user.click(screen.getByRole("button", { name: "Xóa phương án chính thức" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa phương án chính thức" }));
    expect(await screen.findByRole("heading", { name: "Phương án nháp" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Phương án chính thức/ })).toBeNull();
  });
});
