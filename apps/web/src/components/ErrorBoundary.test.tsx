import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { idbEntries, idbPut, openDb } from "../storage/db.js";
import { AppErrorBoundary, LocalErrorBoundary, ROOT_OPTIONS, safeErrorName } from "./ErrorBoundary.js";

const MARKER = "PII-MARKER Nguyễn Văn Bí Mật 23029876";

function Thrower(props: { name?: string }): never {
  const error = new Error(MARKER);
  if (props.name) error.name = props.name;
  throw error;
}

function CrashOnClick() {
  const [crash, setCrash] = useState(false);
  if (crash) return <Thrower name="TypeError" />;
  return <button type="button" onClick={() => setCrash(true)}>Gây lỗi</button>;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function spyConsole() {
  return (["log", "info", "warn", "error", "debug"] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
}

describe("AppErrorBoundary (M5-E, AC-M5-09)", () => {
  it("shows a recovery screen with the error name only — never the message — and logs nothing", async () => {
    const spies = spyConsole();
    const user = userEvent.setup();
    render(<AppErrorBoundary reload={vi.fn()}><CrashOnClick /></AppErrorBoundary>, { onCaughtError: ROOT_OPTIONS.onCaughtError! });
    await user.click(screen.getByRole("button", { name: "Gây lỗi" }));
    const heading = await screen.findByRole("heading", { name: "Ứng dụng gặp lỗi" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText(/Lỗi: TypeError · Phiên bản /)).toBeTruthy();
    expect(document.body.textContent).not.toContain("PII-MARKER");
    expect(new XMLSerializer().serializeToString(document.body)).not.toContain("23029876");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("collapses unusual error names to Error", () => {
    expect(safeErrorName(new RangeError("x"))).toBe("RangeError");
    const odd = new Error("x");
    odd.name = "<b>" + MARKER;
    expect(safeErrorName(odd)).toBe("Error");
    expect(safeErrorName("plain string")).toBe("Error");
    expect(safeErrorName(undefined)).toBe("Error");
  });

  it("'Tải lại trang' reloads without touching local data", async () => {
    const db = await openDb();
    await idbPut(db, "plans", { marker: "keep" }, "p1");
    db.close();
    const reload = vi.fn();
    const user = userEvent.setup();
    render(<AppErrorBoundary reload={reload}><Thrower /></AppErrorBoundary>, { onCaughtError: ROOT_OPTIONS.onCaughtError! });
    await user.click(await screen.findByRole("button", { name: "Tải lại trang" }));
    expect(reload).toHaveBeenCalledTimes(1);
    const check = await openDb();
    expect((await idbEntries(check, "plans")).length).toBe(1);
    check.close();
  });

  it("wipes IndexedDB only after confirmation, then reloads", async () => {
    const db = await openDb();
    await idbPut(db, "plans", { marker: "drop" }, "p1");
    await idbPut(db, "settings", { activeTerm: "x" }, "app");
    db.close();
    const reload = vi.fn();
    const user = userEvent.setup();
    render(<AppErrorBoundary reload={reload}><Thrower /></AppErrorBoundary>, { onCaughtError: ROOT_OPTIONS.onCaughtError! });
    await user.click(await screen.findByRole("button", { name: "Xóa dữ liệu trên máy rồi tải lại" }));
    // Nothing is deleted before the explicit confirmation; "Hủy" goes back.
    const before = await openDb();
    expect((await idbEntries(before, "plans")).length).toBe(1);
    before.close();
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    await user.click(screen.getByRole("button", { name: "Xóa dữ liệu trên máy rồi tải lại" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa và tải lại" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const after = await openDb();
    expect((await idbEntries(after, "plans")).length).toBe(0);
    expect((await idbEntries(after, "settings")).length).toBe(0);
    after.close();
  });

  it("explains a failed wipe instead of crashing", async () => {
    const reload = vi.fn();
    const user = userEvent.setup();
    render(<AppErrorBoundary reload={reload} openDatabase={() => Promise.reject(new Error("blocked"))}><Thrower /></AppErrorBoundary>, { onCaughtError: ROOT_OPTIONS.onCaughtError! });
    await user.click(await screen.findByRole("button", { name: "Xóa dữ liệu trên máy rồi tải lại" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xóa và tải lại" }));
    expect(await screen.findByText(/Không xóa được dữ liệu/)).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("LocalErrorBoundary (M5-F)", () => {
  it("keeps the rest of the page and retries", async () => {
    const onRetry = vi.fn();
    let fail = true;
    function Part() {
      if (fail) throw new Error(MARKER);
      return <p>Phần đã tải</p>;
    }
    const user = userEvent.setup();
    render(
      <div>
        <p>Phần còn lại</p>
        <LocalErrorBoundary onRetry={onRetry} fallback={(retry) => <button type="button" onClick={retry}>Thử lại</button>}>
          <Part />
        </LocalErrorBoundary>
      </div>,
      { onCaughtError: ROOT_OPTIONS.onCaughtError! },
    );
    expect(screen.getByText("Phần còn lại")).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Phần đã tải")).toBeTruthy();
    expect(document.body.textContent).not.toContain("PII-MARKER");
  });
});
