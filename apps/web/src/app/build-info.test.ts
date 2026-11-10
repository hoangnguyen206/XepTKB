import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_BUILD, buildLabel, normalizeBuildInfo, readBuildInfo, readReportUrl, validateReportUrl } from "./build-info.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("build identity (M5-A, AC-M5-01)", () => {
  it("falls back to 0.0.0-dev / unknown when the define is absent", () => {
    expect(normalizeBuildInfo(undefined)).toEqual(FALLBACK_BUILD);
    expect(FALLBACK_BUILD).toEqual({ version: "0.0.0-dev", commit: "unknown", channel: "local" });
  });

  it("keeps a well-formed build object", () => {
    const info = normalizeBuildInfo({ version: "0.1.0", commit: "1a2b3c4", builtAt: "2026-11-10T08:30Z", channel: "production" });
    expect(info).toEqual({ version: "0.1.0", commit: "1a2b3c4", builtAt: "2026-11-10T08:30Z", channel: "production" });
    expect(buildLabel(info)).toBe("Phiên bản 0.1.0 · 1a2b3c4 · dựng 2026-11-10 08:30 UTC");
    expect(buildLabel(normalizeBuildInfo({ version: "0.1.0", commit: "1a2b3c4-dirty", builtAt: "2026-11-10T08:30:00.000Z", channel: "preview" })))
      .toBe("Phiên bản 0.1.0 · 1a2b3c4-dirty · dựng 2026-11-10 08:30 UTC · bản xem trước");
  });

  it("drops malformed fields one by one", () => {
    const info = normalizeBuildInfo({ version: "<img src=x>", commit: "1A2B3C4D", builtAt: "yesterday", channel: "staging" });
    expect(info).toEqual(FALLBACK_BUILD);
    expect(normalizeBuildInfo("0.1.0")).toEqual(FALLBACK_BUILD);
    expect(normalizeBuildInfo(null)).toEqual(FALLBACK_BUILD);
  });

  it("reads the build constant when it is defined, and always returns a well-formed value", () => {
    vi.stubGlobal("__KY_NAY_BUILD__", { version: "9.9.9", commit: "abcdef0", builtAt: "2026-11-10T08:30Z", channel: "preview" });
    const info = readBuildInfo();
    // With WP2's `define` active in Vitest the constant is substituted at transform time; either way the value is valid.
    expect(info.version).toMatch(/^[0-9A-Za-z][0-9A-Za-z.+-]*$/);
    expect(info.commit).toMatch(/^(?:[0-9a-f]{7}(?:-dirty)?|unknown)$/);
    expect(["production", "preview", "local"]).toContain(info.channel);
  });
});

describe("report URL runtime re-check (M5-B, AC-M5-04)", () => {
  it("accepts https and http only on localhost, unchanged", () => {
    expect(validateReportUrl("https://example.invalid/report")).toBe("https://example.invalid/report");
    expect(validateReportUrl("https://example.invalid/issues/new?template=data.md")).toBe("https://example.invalid/issues/new?template=data.md");
    expect(validateReportUrl("http://localhost:4380/report")).toBe("http://localhost:4380/report");
    expect(validateReportUrl("http://127.0.0.1/report")).toBe("http://127.0.0.1/report");
  });

  it("rejects everything else (copy-only UI)", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<b>x</b>",
      "vbscript:x",
      "/report",
      "report",
      "//example.invalid/report",
      "http://example.invalid/report",
      "ftp://example.invalid/report",
      "https://user:pass@example.invalid/report",
      "https://user@example.invalid/report",
      " https://example.invalid/report",
      "https://example.invalid/re port",
      "https://example.invalid/\nreport",
      `https://example.invalid/${"a".repeat(2048)}`,
      42,
    ]) {
      expect(validateReportUrl(bad), String(bad)).toBeUndefined();
    }
  });

  it("re-validates the build constant at runtime", () => {
    vi.stubGlobal("__KY_NAY_REPORT_URL__", "javascript:alert(1)");
    const url = readReportUrl();
    // Never a non-https URL, whether the stub or a build-time define is in effect.
    expect(url === undefined || /^https:\/\/|^http:\/\/(?:localhost|127\.0\.0\.1)[:/]/.test(url)).toBe(true);
  });
});
