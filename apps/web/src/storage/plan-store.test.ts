import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createPlan } from "@ky-nay/domain";
import { idbEntries, idbPut, openDb } from "./db.js";
import { datasetCache, loadSettings, saveSettings, wipeLocalData } from "./local-data.js";
import { listBackups, loadPlans, migratePlanRecord, savePlan, savePlanIfUnchanged } from "./plan-store.js";

const plan = createPlan({ id: "p1", term: "2026-2027-h2", datasetVersion: "v1", name: "Phương án nháp", planKind: "draft", picks: [{ sectionId: "SYN1001 1", group: "1" }], cohort: "K69" }, "2026-10-25T00:00:00.000Z");

describe("two tabs on one database (QA-M3-005, SEC-M3-006b)", () => {
  const edited = (updatedAt: string, sectionId: string) => ({ ...plan, picks: [{ sectionId }], updatedAt });

  it("refuses a save based on a copy another tab has changed, and keeps that tab's version", async () => {
    const db = await openDb(new IDBFactory());
    expect(await savePlanIfUnchanged(db, plan, undefined)).toBe(true);
    // Both tabs read `plan`; tab B saves first, then tab A tries to save its own edit of the old copy.
    expect(await savePlanIfUnchanged(db, edited("2026-10-25T02:00:00.000Z", "B 1"), plan.updatedAt)).toBe(true);
    expect(await savePlanIfUnchanged(db, edited("2026-10-25T03:00:00.000Z", "A 1"), plan.updatedAt)).toBe(false);
    expect((await loadPlans(db)).plans[0]!.picks).toEqual([{ sectionId: "B 1" }]);
    // Tab B continues from what it wrote.
    expect(await savePlanIfUnchanged(db, edited("2026-10-25T04:00:00.000Z", "B 2"), "2026-10-25T02:00:00.000Z")).toBe(true);
  });

  it("does not write a Plan back after another tab wiped the device data", async () => {
    const db = await openDb(new IDBFactory());
    await savePlanIfUnchanged(db, plan, undefined);
    await wipeLocalData(db);
    expect(await savePlanIfUnchanged(db, edited("2026-10-25T05:00:00.000Z", "A 1"), plan.updatedAt)).toBe(false);
    expect((await loadPlans(db)).plans).toEqual([]);
  });
});

describe("0.1.0 records with a contradictory planKind/final (ADR-0009, REV-M3-009c)", () => {
  it("are rejected into backups instead of being guessed", async () => {
    const db = await openDb(new IDBFactory());
    const contradictory = { id: "odd", term: "t", name: "Cũ", picks: [], final: true, planKind: "draft", overrides: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    expect(migratePlanRecord({ schemaVersion: "0.1.0", storedAt: "2026-01-01T00:00:00.000Z", plan: contradictory }).kind).toBe("invalid");
    await idbPut(db, "plans", { schemaVersion: "0.1.0", storedAt: "2026-01-01T00:00:00.000Z", plan: contradictory }, "odd");
    const report = await loadPlans(db, () => "2026-10-29T00:00:00.000Z");
    expect(report.plans).toEqual([]);
    expect(report.quarantined).toBe(1);
    expect((await listBackups(db))[0]!.value.reason).toMatch(/mâu thuẫn/);
  });
});

describe("Plan persistence and migration (DOMAIN_MODEL §9, QA-M2-005)", () => {
  it("round-trips a 0.2.0 Plan", async () => {
    const db = await openDb(new IDBFactory());
    await savePlan(db, plan, () => "2026-10-25T01:00:00.000Z");
    const report = await loadPlans(db);
    expect(report.plans).toEqual([plan]);
    expect(report.migrated).toEqual([]);
  });

  it("migrates a 0.1.0 record, drops untargeted overrides and writes the new version back", async () => {
    const db = await openDb(new IDBFactory());
    const legacy = { id: "old", term: "t", name: "Cũ", picks: [{ sectionId: "A 1" }], final: false, overrides: [{ field: "room", to: "101", source: "user" }], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    await idbPut(db, "plans", { schemaVersion: "0.1.0", storedAt: "2026-01-01T00:00:00.000Z", plan: legacy }, "old");
    const report = await loadPlans(db, () => "2026-10-25T00:00:00.000Z");
    expect(report.migrated).toEqual(["old"]);
    expect(report.plans[0]).toMatchObject({ id: "old", datasetVersion: "unknown", planKind: "draft", final: false, overrides: [] });
    expect(report.notes.join(" ")).toMatch(/bị bỏ/);
    const stored = await idbEntries<{ schemaVersion: string }>(db, "plans");
    expect(stored.map((item) => item.value.schemaVersion)).toEqual(["0.2.0"]);
  });

  it("moves unreadable records to backups and leaves newer records untouched", async () => {
    const db = await openDb(new IDBFactory());
    await idbPut(db, "plans", { schemaVersion: "0.2.0", storedAt: "x", plan: { id: "broken", picks: "nope" } }, "broken");
    await idbPut(db, "plans", { schemaVersion: "9.0.0", storedAt: "x", plan: { id: "future" } }, "future");
    const report = await loadPlans(db);
    expect(report.quarantined).toBe(1);
    expect(report.newer).toBe(1);
    expect(report.plans).toEqual([]);
    expect((await listBackups(db)).map((item) => item.value.reason)).toEqual(["dữ liệu phương án không hợp lệ sau khi chuyển đổi"]);
    expect((await idbEntries(db, "plans")).map((item) => item.key)).toEqual(["future"]);
  });

  it("classifies records without touching storage", () => {
    expect(migratePlanRecord(null).kind).toBe("invalid");
    expect(migratePlanRecord({ schemaVersion: "0.0.1", plan: {} }).kind).toBe("invalid");
    expect(migratePlanRecord({ schemaVersion: "1.0.0", plan: {} }).kind).toBe("newer");
    expect(migratePlanRecord({ schemaVersion: "0.2.0", plan: { ...plan, final: true } }).kind).toBe("invalid");
  });

  it("wipe clears plans, dataset cache, settings and backups", async () => {
    const db = await openDb(new IDBFactory());
    await savePlan(db, plan);
    await saveSettings(db, { activeTerm: "2026-2027-h2" });
    await idbPut(db, "backups", { reason: "x", movedAt: "y", record: {} });
    await wipeLocalData(db);
    expect((await loadPlans(db)).plans).toEqual([]);
    expect(await loadSettings(db)).toEqual({});
    expect(await datasetCache(db).get("2026-2027-h2")).toBeUndefined();
    expect(await listBackups(db)).toEqual([]);
  });
});
