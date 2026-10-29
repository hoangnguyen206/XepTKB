import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { previewWeek1 } from "./components/Onboarding.js";
import { serveDataset, stubFetch, testMetadata } from "./test/fixture.js";

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
});
