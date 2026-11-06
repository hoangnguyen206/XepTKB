import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlan } from "@ky-nay/domain";
import { App } from "./App.js";
import { previewWeek1 } from "./components/Onboarding.js";
import { SectionCard } from "./components/SectionCard.js";
import { buildAppCatalog } from "./model/catalog.js";
import { serveDataset, stubFetch, testMetadata, testTimetable, VERSION } from "./test/fixture.js";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  // Published data loads under every status policy; the policy itself is covered in loader.test.ts.
  vi.stubGlobal("fetch", stubFetch(serveDataset({ status: "published" }).files));
});

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
  await user.click(await screen.findByRole("button", { name: new RegExp(code) }));
}

describe("onboarding (AC-M3-01, C-08)", () => {
  it("validates the manual week-1 date and the cohort path", () => {
    const term = testMetadata().term;
    expect(previewWeek1(term, "manual", "", "2027-02-16").error).toBe("Ngày bắt đầu tuần 1 phải là Thứ Hai.");
    expect(previewWeek1(term, "manual", "", "2027-02-15").date).toBe("2027-02-15");
    expect(previewWeek1(term, "cohort", "", "").error).toMatch(/chọn khóa/);
    expect(previewWeek1(term, "cohort", "K71", "").date).toBe("2027-02-22");
  });

  it("shows the synthetic-data banner and the independence disclaimer", async () => {
    render(<App />);
    expect(await screen.findByText(/Dữ liệu mẫu tổng hợp để thử nghiệm/)).toBeTruthy();
    expect(screen.getAllByText(/không phải sản phẩm của nhà trường/).length).toBeGreaterThan(0);
  });

  it("creates a draft Plan that survives a remount", async () => {
    const user = userEvent.setup();
    await startPlan(user);
    const first = screen.getByText(/Học kỳ II \(thử nghiệm\) · 0 lớp/);
    expect(first).toBeTruthy();
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("heading", { name: "Phương án nháp" }).length).toBe(2));
  });
});

describe("plan bar credits (AC-M3-11, QA-M3-008)", () => {
  it("says the credits are unknown instead of showing 0", async () => {
    const user = userEvent.setup();
    await startPlan(user);
    await openCourse(user, "seminar", "SYN4001");
    await user.click(within(screen.getByRole("article", { name: "Lớp SYN4001 1" })).getByRole("button", { name: "Chọn lớp này" }));
    expect(await screen.findByText(/1 lớp · chưa rõ tín chỉ/)).toBeTruthy();
    expect(screen.queryByText(/1 lớp · 0 tín chỉ/)).toBeNull();
    await openCourse(user, "giai tich", "SYN1001");
    await user.click(within(screen.getByRole("article", { name: "Lớp SYN1001 2" })).getByRole("button", { name: /Chọn lớp này/ }));
    expect(await screen.findByText(/2 lớp · 4 tín chỉ \+ 1 môn chưa rõ tín chỉ/)).toBeTruthy();
  });
});

describe("picker and plan (AC-M3-02, AC-M3-03, AC-M3-11, AC-M3-13)", () => {
  it("requires a group, explains conflicts and updates credits", async () => {
    const user = userEvent.setup();
    await startPlan(user);
    await openCourse(user, "giai tich", "SYN1001");
    const card = screen.getByRole("article", { name: "Lớp SYN1001 1" });
    const pick = within(card).getByRole("button", { name: "Chọn lớp này" });
    expect((pick as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(card).getByLabelText("Nhóm 1"));
    await user.click(pick);
    expect(await screen.findByText(/1 lớp · 4 tín chỉ/)).toBeTruthy();

    await openCourse(user, "vat ly", "SYN1003");
    const conflicting = screen.getByRole("article", { name: "Lớp SYN1003 1" });
    expect(within(conflicting).getByText(/Trùng lịch với SYN1001 1 \(Giải tích 1\): Thứ 2, tiết 1–3, tuần 9–15/)).toBeTruthy();
    await user.click(within(conflicting).getByRole("button", { name: "Vẫn chọn lớp này (đang trùng lịch)" }));
    expect(await screen.findByText(/⚠ 1 chỗ trùng lịch/)).toBeTruthy();
  });

  it("renders dataset text as text, never as markup", async () => {
    const user = userEvent.setup();
    await startPlan(user);
    await openCourse(user, "SYN9999", "SYN9999");
    expect(screen.getByText(/<img src=x onerror=/)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect((window as { __kyNayXss?: number }).__kyNayXss).toBeUndefined();
  });

  it("lists ONL sessions outside the grid and still counts their credits (Q-009)", async () => {
    const user = userEvent.setup();
    await startPlan(user);
    await openCourse(user, "ky nang so", "SYN3001");
    await user.click(screen.getByRole("button", { name: "Chọn lớp này" }));
    await user.click(screen.getByRole("tab", { name: "Tuần" }));
    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByText("Không có giờ cố định (không xếp vào lưới)")).toBeTruthy();
    expect(panel.querySelectorAll(".day-body .block")).toHaveLength(0);
    expect(screen.getByText(/1 lớp · 2 tín chỉ/)).toBeTruthy();
  });

  it("disables 'Đổi nhóm' when a dataset revision/rebase removes or clears the picked group (QA-M3-101)", async () => {
    const user = userEvent.setup();
    const { entry } = serveDataset();
    const catalog = buildAppCatalog({ entry, timetable: testTimetable(), metadata: testMetadata(), cachedAt: "2026-10-25T00:00:00.000Z" });
    const section = catalog.sectionById.get("SYN1001 1")!;
    const planWithDeletedGroup = {
      ...createPlan({ id: "p", term: "2026-2027-h2", datasetVersion: VERSION, name: "Nháp", planKind: "draft" }, "2026-10-25T00:00:00.000Z"),
      picks: [{ sectionId: "SYN1001 1", group: "99" }],
    };
    const onPick = vi.fn();
    const { rerender } = render(
      <SectionCard section={section} plan={planWithDeletedGroup} catalog={catalog} onPick={onPick} onUnpick={() => undefined} headingLevel="h3" />,
    );
    expect(screen.getByText(/⚠ Cần chọn lại nhóm/)).toBeTruthy();
    const changeBtn = screen.getByRole("button", { name: "Đổi nhóm" }) as HTMLButtonElement;
    expect(changeBtn.disabled).toBe(true);

    // After rebase clears `group` to undefined, the button remains disabled until a radio is chosen.
    const rebasedPlan = { ...planWithDeletedGroup, picks: [{ sectionId: "SYN1001 1" }] };
    rerender(
      <SectionCard section={section} plan={rebasedPlan} catalog={catalog} onPick={onPick} onUnpick={() => undefined} headingLevel="h3" />,
    );
    expect((screen.getByRole("button", { name: "Đổi nhóm" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText("Nhóm 2"));
    const enabledBtn = screen.getByRole("button", { name: "Đổi nhóm" }) as HTMLButtonElement;
    expect(enabledBtn.disabled).toBe(false);
    await user.click(enabledBtn);
    expect(onPick).toHaveBeenCalledWith("SYN1001 1", "2");
  });

  it("renders same-day campus-transition warnings in the section card and plan tab (REV-M3-008)", async () => {
    const tt = testTimetable();
    tt.sections[0]!.sessions[0] = { ...tt.sections[0]!.sessions[0]!, room: "203-G2", campus: "Cầu Giấy" };
    vi.stubGlobal("fetch", stubFetch(serveDataset({ status: "published", timetable: tt }).files));
    const user = userEvent.setup();
    await startPlan(user);
    await openCourse(user, "giai tich", "SYN1001");
    const card1 = screen.getByRole("article", { name: "Lớp SYN1001 1" });
    await user.click(within(card1).getByLabelText("Nhóm 1"));
    await user.click(within(card1).getByRole("button", { name: "Chọn lớp này" }));

    await openCourse(user, "vat ly", "SYN1003");
    const card2 = screen.getByRole("article", { name: "Lớp SYN1003 2" });
    expect(within(card2).getByText(/ⓘ Học liền tiết với SYN1001 1 nhưng khác cơ sở \(Cầu Giấy ↔ Hòa Lạc\), Thứ 2, tuần 1–3/)).toBeTruthy();
    await user.click(within(card2).getByRole("button", { name: "Chọn lớp này" }));

    await user.click(screen.getByRole("tab", { name: /^Phương án/ }));
    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByText(/Cần kiểm tra/)).toBeTruthy();
    expect(within(panel).getByText(/SYN1001 1 và SYN1003 2 học liền tiết nhưng khác cơ sở \(Cầu Giấy ↔ Hòa Lạc\), Thứ 2, tuần 1–3/)).toBeTruthy();
  });
});
