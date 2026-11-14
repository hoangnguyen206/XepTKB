/** AC-M6-04 / DESIGN-M6-001 §9: dataset status chips keep the M5 banner conditions and sentences 1:1. */
import { describe, expect, it } from "vitest";
import { ArtifactError } from "../data/contract.js";
import { serveDataset } from "../test/fixture.js";
import { datasetStatuses, shortTermLabel } from "./dataset-status.js";
import { SYNTHETIC_NOTE } from "./labels.js";

const NOW = new Date("2026-11-10T03:00:00.000Z");
const CACHED_AT = "2026-11-09T01:00:00.000Z";
const published = () => ({ ...serveDataset({ status: "published" }).entry, source: { ...serveDataset().entry.source, type: "official-timetable" as const } });

describe("datasetStatuses", () => {
  it("a published, current, online dataset has no status", () => {
    expect(datasetStatuses({ entry: published(), cachedAt: CACHED_AT, online: true, now: NOW })).toEqual([]);
  });

  it("expired → 'Hết hiệu lực' with the M5 sentence (Vietnam calendar day)", () => {
    const [status] = datasetStatuses({ entry: { ...published(), expiresAt: "2026-11-01T17:30:00.000Z" }, cachedAt: CACHED_AT, online: true, now: NOW });
    expect(status).toMatchObject({ id: "expired", chip: "Hết hiệu lực", title: "Dữ liệu đã hết hiệu lực", tone: "danger" });
    expect(status!.text).toMatch(/^Bộ dữ liệu \S+ đã hết hiệu lực từ 02\/11\/2026\. Lịch có thể đã thay đổi — hãy đối chiếu với cổng đăng ký của trường\.$/);
  });

  it("synthetic and unpublished data both show, as in M5 (REV-M3-009d)", () => {
    const entry = serveDataset({ status: "candidate" }).entry;
    const statuses = datasetStatuses({ entry, cachedAt: CACHED_AT, online: true, now: NOW });
    const synthetic = statuses.find((status) => status.id === "synthetic");
    const unpublished = statuses.find((status) => status.id === "unpublished");
    expect(synthetic).toMatchObject({ chip: "Dữ liệu mẫu", title: "Dữ liệu mẫu", text: SYNTHETIC_NOTE });
    expect(unpublished).toMatchObject({ chip: "Bản thử", title: "Dữ liệu chưa được công bố" });
    expect(unpublished!.text).toMatch(/^Bộ dữ liệu này đang ở trạng thái “.+”, chỉ dùng để thử nghiệm\.$/);
  });

  it("offline (browser offline or cached for offline) → 'Ngoại tuyến' with the age and save time", () => {
    for (const input of [{ online: false }, { online: true, cached: { reason: "offline" as const, error: new ArtifactError("MANIFEST_UNAVAILABLE", "x") } }]) {
      const statuses = datasetStatuses({ entry: { ...published(), publishedAt: "2026-11-06T02:00:00.000Z" }, cachedAt: CACHED_AT, now: NOW, ...input });
      expect(statuses.map((status) => status.id)).toEqual(["offline"]);
      expect(statuses[0]).toMatchObject({ chip: "Ngoại tuyến", title: "Đang ngoại tuyến", tone: "info" });
      expect(statuses[0]!.text).toMatch(/^Bạn vẫn xem và xuất được phương án\. Dữ liệu công bố 4 ngày trước\. Bản đang dùng được lưu trên máy lúc .+\.$/);
    }
  });

  it("a fresh copy that failed validation → 'Dữ liệu cũ' with the error text", () => {
    const statuses = datasetStatuses({ entry: published(), cachedAt: CACHED_AT, online: true, now: NOW, cached: { reason: "invalid", error: new ArtifactError("HASH_MISMATCH", "x") } });
    expect(statuses.map((status) => status.id)).toEqual(["stale"]);
    expect(statuses[0]).toMatchObject({ chip: "Dữ liệu cũ", title: "Không cập nhật được dữ liệu", tone: "danger" });
    expect(statuses[0]!.text).toMatch(/^Dữ liệu tải về không khớp mã kiểm tra .+ Ứng dụng tiếp tục dùng bản đã lưu lúc .+\. Dữ liệu .+\.$/);
  });

  it("orders the most serious first", () => {
    const entry = { ...serveDataset({ status: "candidate" }).entry, expiresAt: "2026-11-01T00:00:00.000Z" };
    const ids = datasetStatuses({ entry, cachedAt: CACHED_AT, online: false, now: NOW }).map((status) => status.id);
    expect(ids[0]).toBe("expired");
    expect(ids.at(-1)).toBe("offline");
  });
});

describe("shortTermLabel", () => {
  it("shortens the term name for the app-bar chip", () => {
    expect(shortTermLabel("Học kỳ II 2026–2027 (dữ liệu mẫu)")).toBe("HK II 2026–2027");
    expect(shortTermLabel("Học kỳ I 2026–2027")).toBe("HK I 2026–2027");
    expect(shortTermLabel("Học kỳ II (thử nghiệm)")).toBe("HK II");
    expect(shortTermLabel("Kỳ hè")).toBe("Kỳ hè");
  });
});
