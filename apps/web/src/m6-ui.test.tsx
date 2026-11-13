/**
 * M6 F1b UI (SPEC-M6-001 AC-M6-01, AC-M6-07 storage side): theme preference in the About panel, applied to <html>,
 * saved in IndexedDB settings, reapplied on the next start and reset by "Xóa dữ liệu trên máy"; fonts warm-up.
 */
import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { resetWarmFontsForTest, warmFonts } from "./app/fonts.js";
import { applyTheme } from "./app/theme.js";
import { openDb } from "./storage/db.js";
import { loadSettings, updateSettings } from "./storage/local-data.js";
import { serveDataset, stubFetch } from "./test/fixture.js";

const ABOUT = "Giới thiệu, quyền riêng tư & báo lỗi";

function addThemeMetas() {
  for (const [scheme, color] of [["light", "#F5F6FA"], ["dark", "#0E1020"]] as const) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.media = `(prefers-color-scheme: ${scheme})`;
    meta.content = color;
    document.head.append(meta);
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.stubGlobal("fetch", stubFetch(serveDataset({ status: "published" }).files));
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  document.documentElement.removeAttribute("data-theme");
});

async function openAbout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: ABOUT }));
  return screen.findByRole("region", { name: ABOUT });
}

describe("applyTheme", () => {
  it("sets or removes data-theme and forces both theme-color metas", () => {
    addThemeMetas();
    const [light, dark] = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect([light!.content, dark!.content]).toEqual(["#0E1020", "#0E1020"]);
    applyTheme("light");
    expect([light!.content, dark!.content]).toEqual(["#F5F6FA", "#F5F6FA"]);
    applyTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect([light!.content, dark!.content]).toEqual(["#F5F6FA", "#0E1020"]);
  });
});

describe("theme picker in the About panel (AC-M6-01)", () => {
  it("defaults to Hệ thống, applies and saves Tối, and the next start reapplies it", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const panel = await openAbout(user);
    const group = within(panel).getByRole("group", { name: "Giao diện" });
    expect(within(group).getByRole("button", { name: "Hệ thống" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(within(group).getByRole("button", { name: "Tối" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(within(group).getByRole("button", { name: "Tối" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(async () => expect((await loadSettings(await openDb())).theme).toBe("dark"));

    first.unmount();
    document.documentElement.removeAttribute("data-theme");
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });

  it("choosing Hệ thống removes the stored preference", async () => {
    const db = await openDb();
    await updateSettings(db, { theme: "light", activeTerm: "x" });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    const panel = await openAbout(user);
    await user.click(within(panel).getByRole("button", { name: "Hệ thống" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    await waitFor(async () => expect("theme" in (await loadSettings(db))).toBe(false));
  });

  it("the privacy section lists the UI settings stored on the device", async () => {
    const user = userEvent.setup();
    render(<App />);
    const panel = await openAbout(user);
    expect(within(panel).getByText(/Cài đặt giao diện: sáng\/tối, màu bạn chọn cho từng mã môn và các gợi ý đã xem\./)).toBeTruthy();
  });
});

describe("warmFonts (DESIGN-M6-001 §5)", () => {
  it("loads weights 400 and 800 with a sample covering both subsets, once", async () => {
    resetWarmFontsForTest();
    const load = vi.fn(async () => []);
    const fonts = { load } as unknown as FontFaceSet;
    await Promise.all([warmFonts(fonts), warmFonts(fonts)]);
    expect(load.mock.calls).toEqual([
      ['400 16px "Be Vietnam Pro"', "Aạ"],
      ['800 16px "Be Vietnam Pro"', "Aạ"],
    ]);
    resetWarmFontsForTest();
    await expect(warmFonts({ load: vi.fn(async () => { throw new Error("offline"); }) } as unknown as FontFaceSet)).resolves.toBeUndefined();
    resetWarmFontsForTest();
  });
});
