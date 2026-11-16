/**
 * M6 F5 (SPEC-M6-001 AC-M6-11/12, DESIGN-M6-001 §9): the start screen (cohort chips from Term.starts, "Tự chọn ngày",
 * the term select only with several terms, the independence sentence once) and the one-time Hint.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { cohortsOf, Onboarding } from "./components/Onboarding.js";
import { Hint } from "./components/ui/Hint.js";
import type { TermOption } from "./data/loader.js";
import { HINT_IDS, HINT_TEXT, isHintId } from "./model/hints.js";
import { INDEPENDENCE_NOTE } from "./model/labels.js";
import { testMetadata, TERM, VERSION } from "./test/fixture.js";

const term = testMetadata().term;
const option = (id: string, name: string): TermOption => ({ term: id, termName: name, datasetVersion: VERSION, status: "published", sourceType: "synthetic-fixture" });

describe("start screen (AC-M6-11)", () => {
  it("offers one chip per cohort of Term.starts, sorted", () => {
    expect(cohortsOf(term)).toEqual(["K67", "K68", "K69", "K71"]);
  });

  it("waits for a chip when cohorts start on different Mondays, then creates with that cohort", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<Onboarding terms={[option(TERM, term.name)]} term={term} loadingTerm={false} onSwitchTerm={() => undefined} onCreate={onCreate} />);
    expect(screen.queryByLabelText("Học kỳ")).toBeNull();
    expect(screen.getAllByText(INDEPENDENCE_NOTE)).toHaveLength(1);
    const start = screen.getByRole("button", { name: "Bắt đầu" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    // No error before the user acts.
    expect(screen.queryByText(/hãy chọn khóa/)).toBeNull();
    await user.click(screen.getByLabelText("K71"));
    expect(start.disabled).toBe(false);
    await user.click(start);
    expect(onCreate).toHaveBeenCalledWith({ cohort: "K71" });
  });

  it("\"Tự chọn ngày\" checks the date like before and keeps a chosen cohort", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<Onboarding terms={[option(TERM, term.name), option("2026-2027-h1", "Học kỳ I")]} term={term} loadingTerm={false} onSwitchTerm={() => undefined} onCreate={onCreate} />);
    expect(screen.getByLabelText("Học kỳ")).toBeTruthy();
    await user.click(screen.getByLabelText("K69"));
    await user.click(screen.getByRole("button", { name: "Tự chọn ngày" }));
    const date = screen.getByLabelText("Ngày bắt đầu tuần 1");
    expect(document.activeElement).toBe(date);
    await user.type(date, "2027-02-16");
    expect(screen.getByText("Ngày bắt đầu tuần 1 phải là Thứ Hai.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Bắt đầu" }) as HTMLButtonElement).disabled).toBe(true);
    await user.clear(date);
    await user.type(date, "2027-02-15");
    expect(screen.getByText("Tuần 1: 15/02/2027")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(onCreate).toHaveBeenCalledWith({ week1: "2027-02-15", cohort: "K69" });
  });
});

describe("one-time hints (AC-M6-12)", () => {
  it("has one sentence per id and validates ids", () => {
    for (const id of HINT_IDS) {
      expect(HINT_TEXT[id].split(/[.!?]\s/).length, id).toBe(1);
      expect(isHintId(id)).toBe(true);
    }
    expect(isHintId("other")).toBe(false);
  });

  it("is dismissed with \"Đã hiểu\"", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Hint id="block-tap" onDismiss={onDismiss} />);
    expect(screen.getByRole("note").textContent).toContain(HINT_TEXT["block-tap"]);
    await user.click(screen.getByRole("button", { name: "Đã hiểu" }));
    expect(onDismiss).toHaveBeenCalledWith("block-tap");
  });
});
