import { describe, expect, it } from "vitest";
import type { LoadedDataset } from "./contract.js";
import { isSafeRelativeUrl, parseManifest } from "./contract.js";
import { loadDataset, type DatasetCacheLike } from "./loader.js";
import { serveDataset, stubFetch, testMetadata, testTimetable, TERM, VERSION } from "../test/fixture.js";

function memoryCache(): DatasetCacheLike & { store: Map<string, LoadedDataset> } {
  const store = new Map<string, LoadedDataset>();
  return { store, get: async (term) => store.get(term), put: async (dataset) => void store.set(dataset.entry.term, dataset) };
}

describe("artifact loader (AC-M3-07)", () => {
  it("loads, verifies and caches a valid dataset", async () => {
    const { files } = serveDataset();
    const cache = memoryCache();
    const result = await loadDataset(undefined, { allowUnpublished: true, cache, fetchImpl: stubFetch(files) });
    expect(result.kind).toBe("fresh");
    if (result.kind !== "fresh") return;
    expect(result.dataset.timetable.sections).toHaveLength(7);
    expect(result.terms.map((term) => term.term)).toEqual([TERM]);
    expect(cache.store.get(TERM)?.entry.datasetVersion).toBe(VERSION);
  });

  it("rejects an artifact whose bytes no longer match the manifest hash and keeps the cache", async () => {
    const good = serveDataset();
    const cache = memoryCache();
    await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(good.files) });
    const next = serveDataset({ version: "test-uet-h2.2" });
    const timetableUrl = [...next.files.keys()].find((url) => url.endsWith("timetable.json"))!;
    next.files.set(timetableUrl, next.files.get(timetableUrl)!.replace("Giải tích 1", "Giải tích X"));
    const result = await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(next.files) });
    expect(result.kind).toBe("cached");
    if (result.kind !== "cached") return;
    expect(result.reason).toBe("invalid");
    expect(result.error.code).toBe("HASH_MISMATCH");
    expect(cache.store.get(TERM)?.entry.datasetVersion).toBe(VERSION);
  });

  it("without a cache, an integrity failure leaves the app with no dataset", async () => {
    const { files } = serveDataset();
    const url = [...files.keys()].find((key) => key.endsWith("metadata.json"))!;
    files.set(url, files.get(url)!.replace("07:00", "06:00"));
    const result = await loadDataset(TERM, { allowUnpublished: true, cache: memoryCache(), fetchImpl: stubFetch(files) });
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") expect(result.error.code).toBe("HASH_MISMATCH");
  });

  it("falls back to the cached dataset when offline", async () => {
    const { files } = serveDataset();
    const cache = memoryCache();
    await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(files) });
    const result = await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(files, { offline: true }) });
    expect(result.kind).toBe("cached");
    if (result.kind === "cached") expect(result.reason).toBe("offline");
  });

  it("never loads a retracted version, even from cache", async () => {
    const { files, entry } = serveDataset();
    const cache = memoryCache();
    await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(files) });
    files.set("data/manifest.json", JSON.stringify({ schemaVersion: "1.0", generatedAt: "2026-10-26T00:00:00.000Z", datasets: [{ ...entry, status: "retracted" }] }));
    const result = await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(files) });
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") expect(result.error.code).toBe("NO_DATASET");
  });

  it("production builds only accept published datasets", async () => {
    const { files } = serveDataset({ status: "candidate" });
    const blocked = await loadDataset(undefined, { allowUnpublished: false, cache: memoryCache(), fetchImpl: stubFetch(files) });
    expect(blocked.kind).toBe("unavailable");
    const published = serveDataset({ status: "published" });
    const ok = await loadDataset(undefined, { allowUnpublished: false, cache: memoryCache(), fetchImpl: stubFetch(published.files) });
    expect(ok.kind).toBe("fresh");
  });

  it("reuses the cache without refetching artifacts when hashes are unchanged", async () => {
    const { files } = serveDataset();
    const cache = memoryCache();
    await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(files) });
    const requests: string[] = [];
    const result = await loadDataset(TERM, { allowUnpublished: true, cache, fetchImpl: stubFetch(files, { requests }) });
    expect(result.kind).toBe("fresh");
    expect(requests).toEqual(["data/manifest.json"]);
  });

  it("rejects domain invariant violations and mismatched headers", async () => {
    const broken = testTimetable();
    (broken.sections[0]!.sessions[0] as { endPeriod: number }).endPeriod = 13;
    const badPeriod = await loadDataset(TERM, { allowUnpublished: true, cache: memoryCache(), fetchImpl: stubFetch(serveDataset({ timetable: broken }).files) });
    expect(badPeriod.kind === "unavailable" && badPeriod.error.code).toBe("DOMAIN_INVALID");
    const otherTerm = { ...testMetadata(), term: { ...testMetadata().term, id: "2026-2027-h1" } };
    const badTerm = await loadDataset(TERM, { allowUnpublished: true, cache: memoryCache(), fetchImpl: stubFetch(serveDataset({ metadata: otherTerm }).files) });
    expect(badTerm.kind === "unavailable" && badTerm.error.code).toBe("INVALID_ARTIFACT");
  });
});

describe("manifest contract", () => {
  it("accepts only relative artifact paths inside data/", () => {
    for (const url of ["schools/uet/a.json", "a.json"]) expect(isSafeRelativeUrl(url)).toBe(true);
    for (const url of ["https://evil.example/a.json", "//evil.example/a.json", "/abs.json", "../secret.json", "a/../b.json", "a\\b.json", "a.json?x=1", "javascript:alert(1)", ""]) expect(isSafeRelativeUrl(url)).toBe(false);
  });

  it("requires provenance fields and one artifact per kind", () => {
    const { manifest } = serveDataset();
    expect(() => parseManifest({ ...manifest, schemaVersion: "2.0" })).toThrow(/not supported/);
    const entry = manifest.datasets[0]!;
    expect(() => parseManifest({ ...manifest, datasets: [{ ...entry, source: { ...entry.source, documentRef: "" } }] })).toThrow(/provenance/);
    expect(() => parseManifest({ ...manifest, datasets: [{ ...entry, artifacts: [entry.artifacts[0]] }] })).toThrow(/exactly one metadata/);
    expect(() => parseManifest({ ...manifest, datasets: [{ ...entry, artifacts: [{ ...entry.artifacts[0]!, url: "../x.json" }, entry.artifacts[1]] }] })).toThrow(/relative path/);
  });
});
