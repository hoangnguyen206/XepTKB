/**
 * ADR-0012: every dataset in data/published must load through the app's own loader (size, SHA-256, schema and
 * domain invariants), exactly as a browser would fetch it from the site.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DatasetManifest, LoadedDataset } from "./contract.js";
import { loadDataset, type DatasetCacheLike } from "./loader.js";

/** The repository's data/published folder, found from the working directory (vitest runs in apps/web or the root). */
function publishedRoot(): string {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "data", "published", "manifest.json"))) return join(dir, "data", "published");
    if (dirname(dir) === dir) throw new Error("data/published/manifest.json not found");
  }
}

const root = publishedRoot();
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as DatasetManifest;

const fromDisk: typeof fetch = async (input) => {
  const path = String(input).replace(/^data\//, "");
  try {
    return new Response(readFileSync(join(root, path)), { status: 200 });
  } catch {
    return new Response("not found", { status: 404 });
  }
};

function memoryCache(): DatasetCacheLike {
  const store = new Map<string, LoadedDataset>();
  return { get: async (term) => store.get(term), put: async (dataset) => void store.set(dataset.entry.term, dataset), delete: async (term) => void store.delete(term), all: async () => [...store.values()] };
}

describe("published datasets (data/published)", () => {
  const terms = [...new Set(manifest.datasets.filter((entry) => entry.status !== "retracted").map((entry) => entry.term))];

  it("has a manifest the app accepts", async () => {
    const result = await loadDataset(undefined, { allowUnpublished: true, cache: memoryCache(), fetchImpl: fromDisk });
    expect(result.kind === "fresh" || (result.kind === "unavailable" && result.error.code === "NO_DATASET")).toBe(true);
  });

  for (const term of terms) {
    it(`loads the current ${term} dataset with every check of the app`, async () => {
      const result = await loadDataset(term, { allowUnpublished: true, cache: memoryCache(), fetchImpl: fromDisk });
      if (result.kind !== "fresh") throw new Error(`${term}: ${result.kind === "unavailable" ? `${result.error.code} ${result.error.message}` : result.kind}`);
      expect(result.dataset.timetable.sections.length).toBeGreaterThan(0);
    });
  }
});
