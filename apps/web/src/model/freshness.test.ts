import { describe, expect, it } from "vitest";
import { ageText, datasetFreshness } from "./freshness.js";

const NOW = new Date("2026-11-10T03:00:00.000Z"); // 10:00 in Vietnam

describe("datasetFreshness (M5-D, AC-M5-07/08)", () => {
  it("is expired only when expiresAt is in the past", () => {
    const base = { importedAt: "2026-11-01T00:00:00.000Z" };
    expect(datasetFreshness({ ...base, expiresAt: "2026-11-09T16:59:59.000Z" }, undefined, NOW)).toMatchObject({ expired: true, expiresAt: "2026-11-09T16:59:59.000Z" });
    expect(datasetFreshness({ ...base, expiresAt: "2026-11-10T03:00:01.000Z" }, undefined, NOW).expired).toBe(false);
    expect(datasetFreshness({ ...base, expiresAt: "2027-06-30T00:00:00.000Z" }, undefined, NOW).expired).toBe(false);
    const none = datasetFreshness(base, undefined, NOW);
    expect(none.expired).toBe(false);
    expect(none).not.toHaveProperty("expiresAt");
    expect(datasetFreshness({ ...base, expiresAt: "not a date" }, undefined, NOW).expired).toBe(false);
  });

  it("counts the age from publishedAt, then reviewedAt, then importedAt", () => {
    const entry = { importedAt: "2026-10-01T00:00:00.000Z", reviewedAt: "2026-10-20T00:00:00.000Z", publishedAt: "2026-11-07T02:00:00.000Z" };
    expect(datasetFreshness(entry, "2026-11-09T00:00:00.000Z", NOW)).toMatchObject({ ageDays: 3, ageBasis: "publishedAt", basisAt: entry.publishedAt });
    const { publishedAt: _published, ...reviewed } = entry;
    expect(datasetFreshness(reviewed, undefined, NOW)).toMatchObject({ ageDays: 21, ageBasis: "reviewedAt" });
    expect(datasetFreshness({ importedAt: entry.importedAt }, undefined, NOW)).toMatchObject({ ageDays: 40, ageBasis: "importedAt" });
    expect(datasetFreshness({ importedAt: "bad" }, "2026-11-08T00:00:00.000Z", NOW)).toMatchObject({ ageDays: 2, ageBasis: "cachedAt" });
  });

  it("counts calendar days in Vietnam time and never goes negative", () => {
    // 23:30 on 9 Nov in Vietnam vs 10:00 on 10 Nov → one calendar day.
    expect(datasetFreshness({ importedAt: "2026-11-09T16:30:00.000Z" }, undefined, NOW).ageDays).toBe(1);
    // 07:30 on 10 Nov in Vietnam → today.
    expect(datasetFreshness({ importedAt: "2026-11-10T00:30:00.000Z" }, undefined, NOW).ageDays).toBe(0);
    // A clock behind the publish time.
    expect(datasetFreshness({ importedAt: "2026-11-12T00:00:00.000Z" }, undefined, NOW).ageDays).toBe(0);
  });

  it("phrases the age for the banner", () => {
    expect(ageText({ ageDays: 3, ageBasis: "publishedAt" })).toBe("Dữ liệu công bố 3 ngày trước");
    expect(ageText({ ageDays: 0, ageBasis: "publishedAt" })).toBe("Dữ liệu công bố hôm nay");
    expect(ageText({ ageDays: 5, ageBasis: "importedAt" })).toBe("Dữ liệu nhập 5 ngày trước");
  });
});
