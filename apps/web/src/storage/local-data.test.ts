/** DESIGN-M6-001 §4 / ADR-0015 point 6: M6 UI settings — sanitize, transactional merge, wipe, M5 compatibility. */
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { idbGet, idbPut, idbUpdate, openDb } from "./db.js";
import { MAX_COURSE_COLORS, loadSettings, mutateSettings, sanitizeSettings, updateSettings, wipeLocalData, withCourseColor } from "./local-data.js";

let db: IDBDatabase;
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  db = await openDb();
});

describe("sanitizeSettings", () => {
  it("keeps valid M6 fields and every M5 field unchanged", () => {
    const m5 = { activeTerm: "2026-2027-h2", activeSlots: { t: "final" as const }, registrationNotes: { t: { unmatched: [], warnings: ["w"] } } };
    expect(sanitizeSettings({ ...m5, theme: "dark", courseColors: { INT2213: "teal" }, seenHints: { "week-swipe": true } })).toEqual({
      ...m5,
      theme: "dark",
      courseColors: { INT2213: "teal" },
      seenHints: { "week-swipe": true },
    });
  });

  it("drops unknown values instead of failing", () => {
    expect(sanitizeSettings({ theme: "sepia", courseColors: { A: "red", B: "teal", "": "blue" }, seenHints: { nope: true, "add-filter": "yes", "plan-import": true } })).toEqual({
      courseColors: { B: "teal" },
      seenHints: { "plan-import": true },
    });
    expect(sanitizeSettings(null)).toEqual({});
    expect(sanitizeSettings([1, 2])).toEqual({});
    expect(sanitizeSettings({ courseColors: [], seenHints: "x" })).toEqual({});
  });

  it("keeps at most 100 course colours, newest last", () => {
    const many = Object.fromEntries(Array.from({ length: 105 }, (_, index) => [`C${index}`, "blue"]));
    const kept = Object.keys(sanitizeSettings({ courseColors: many }).courseColors!);
    expect(kept).toHaveLength(MAX_COURSE_COLORS);
    expect(kept[0]).toBe("C5");
  });
});

describe("withCourseColor", () => {
  it("sets, moves to the end, clears and caps", () => {
    expect(withCourseColor({ A: "teal", B: "blue" }, "A", "slate")).toEqual({ B: "blue", A: "slate" });
    expect(Object.keys(withCourseColor({ A: "teal", B: "blue" }, "A", "slate"))).toEqual(["B", "A"]);
    expect(withCourseColor({ A: "teal" }, "A", undefined)).toEqual({});
    const full = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`C${index}`, "blue" as const]));
    const next = withCourseColor(full, "NEW", "lime");
    expect(Object.keys(next)).toHaveLength(100);
    expect(next.C0).toBeUndefined();
    expect(next.NEW).toBe("lime");
  });
});

describe("transactional settings writes", () => {
  it("idbUpdate reads and writes in one transaction; a throwing mutate writes nothing", async () => {
    await idbPut(db, "settings", { n: 1 }, "k");
    await Promise.all([1, 2, 3].map(() => idbUpdate<{ n: number }>(db, "settings", "k", (current) => ({ n: (current?.n ?? 0) + 1 }))));
    expect(await idbGet(db, "settings", "k")).toEqual({ n: 4 });
    await expect(idbUpdate(db, "settings", "k", () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await idbGet(db, "settings", "k")).toEqual({ n: 4 });
  });

  it("concurrent updates of different fields keep both (two tabs)", async () => {
    await Promise.all([updateSettings(db, { theme: "dark" }), mutateSettings(db, (current) => ({ ...current, courseColors: withCourseColor(current.courseColors, "INT2213", "teal") })), updateSettings(db, { activeSlots: { t: "final" } })]);
    expect(await loadSettings(db)).toEqual({ theme: "dark", courseColors: { INT2213: "teal" }, activeSlots: { t: "final" } });
  });

  it("updateSettings still merges per-term maps key by key", async () => {
    await updateSettings(db, { activeSlots: { a: "draft" }, registrationNotes: { a: { unmatched: [], warnings: [] } } });
    await updateSettings(db, { activeSlots: { b: "final" } });
    expect(await loadSettings(db)).toEqual({ activeSlots: { a: "draft", b: "final" }, registrationNotes: { a: { unmatched: [], warnings: [] } } });
  });

  it("a record written by M5 (no M6 fields) loads unchanged; an M5-style spread write keeps the M6 fields", async () => {
    await idbPut(db, "settings", { activeTerm: "x" }, "app");
    expect(await loadSettings(db)).toEqual({ activeTerm: "x" });
    await updateSettings(db, { theme: "light", seenHints: { "block-tap": true } });
    // M5's updateSettings: read, spread, write back.
    const stored = await idbGet<Record<string, unknown>>(db, "settings", "app");
    await idbPut(db, "settings", { ...stored, activeTerm: "y" }, "app");
    expect(await loadSettings(db)).toEqual({ activeTerm: "y", theme: "light", seenHints: { "block-tap": true } });
  });

  it("wipe removes the M6 fields with everything else", async () => {
    await updateSettings(db, { theme: "dark", courseColors: { A: "teal" }, seenHints: { "add-filter": true } });
    await wipeLocalData(db);
    expect(await loadSettings(db)).toEqual({});
  });
});
