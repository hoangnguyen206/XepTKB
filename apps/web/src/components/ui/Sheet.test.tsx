/** DESIGN-M6-001 §6: Sheet opens as a modal dialog, closes on Esc (cancel), backdrop and the close button, returns focus. */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Sheet } from "./Sheet.js";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Mở chi tiết</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="INT2213 · Mạng máy tính">
        <button type="button">Bỏ lớp này</button>
      </Sheet>
    </>
  );
}

const dialog = () => document.querySelector("dialog")!;

describe("Sheet", () => {
  it("opens with its title as the accessible name and closes with the close button, returning focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Mở chi tiết" });
    expect(dialog().open).toBe(false);
    await user.click(opener);
    expect(dialog().open).toBe(true);
    expect(dialog().getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "INT2213 · Mạng máy tính" }).id);
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("Esc (the dialog cancel event) closes without the browser closing it by itself", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Mở chi tiết" }));
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(false);
    expect(screen.queryByRole("button", { name: "Bỏ lớp này" })).toBeNull();
  });

  it("a click on the backdrop (the dialog itself) closes; a click inside does not", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Mở chi tiết" }));
    await user.click(screen.getByRole("button", { name: "Bỏ lớp này" }));
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);
  });
});
