/**
 * ADR-0012 / REV-M3-105: every dataset in data/published must load through the app's own loader (size, SHA-256, schema
 * and domain invariants) under both preview (`allowUnpublished: true`) and production (`allowUnpublished: false`) policies,
 * and a full CLI `import` -> `validate` -> `publish` round-trip on a synthetic workbook loads cleanly in the app loader.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { DatasetManifest, LoadedDataset } from "./contract.js";
import { parseManifest } from "./contract.js";
import { loadDataset, type DatasetCacheLike } from "./loader.js";

/** The repository root, found from the working directory (vitest runs in apps/web or the root). */
function findRepoRoot(): string {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "data", "published", "manifest.json"))) return dir;
    if (dirname(dir) === dir) throw new Error("data/published/manifest.json not found");
  }
}

const repoRoot = findRepoRoot();
const root = join(repoRoot, "data", "published");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as DatasetManifest;

function diskFetcher(baseDir: string): typeof fetch {
  return async (input) => {
    const path = String(input).replace(/^data\//, "");
    try {
      return new Response(readFileSync(join(baseDir, path)), { status: 200 });
    } catch {
      return new Response("not found", { status: 404 });
    }
  };
}

const fromDisk = diskFetcher(root);

function memoryCache(): DatasetCacheLike {
  const store = new Map<string, LoadedDataset>();
  return { get: async (term) => store.get(term), put: async (dataset) => void store.set(dataset.entry.term, dataset), delete: async (term) => void store.delete(term), all: async () => [...store.values()] };
}

describe("published datasets (data/published)", () => {
  const previewTerms = [...new Set(manifest.datasets.filter((entry) => entry.status !== "retracted").map((entry) => entry.term))];
  const productionTerms = [...new Set(manifest.datasets.filter((entry) => entry.status === "published").map((entry) => entry.term))];

  it("has a manifest the app accepts under both preview and production policies (REV-M3-105)", async () => {
    expect(() => parseManifest(manifest)).not.toThrow();
    const preview = await loadDataset(undefined, { allowUnpublished: true, cache: memoryCache(), fetchImpl: fromDisk });
    if (previewTerms.length === 0) {
      expect(preview.kind === "unavailable" && preview.error.code === "NO_DATASET").toBe(true);
    } else {
      expect(preview.kind).toBe("fresh");
    }
    const prod = await loadDataset(undefined, { allowUnpublished: false, cache: memoryCache(), fetchImpl: fromDisk });
    if (productionTerms.length === 0) {
      expect(prod.kind === "unavailable" && prod.error.code === "NO_DATASET").toBe(true);
    } else {
      expect(prod.kind).toBe("fresh");
    }
  });

  for (const term of previewTerms) {
    it(`loads the current ${term} preview dataset with every check of the app (allowUnpublished: true)`, async () => {
      const result = await loadDataset(term, { allowUnpublished: true, cache: memoryCache(), fetchImpl: fromDisk });
      if (result.kind !== "fresh") throw new Error(`${term}: ${result.kind === "unavailable" ? `${result.error.code} ${result.error.message}` : result.kind}`);
      expect(result.dataset.timetable.sections.length).toBeGreaterThan(0);
    });
  }

  for (const term of productionTerms) {
    it(`loads the current ${term} production dataset with every check of the app (allowUnpublished: false)`, async () => {
      const result = await loadDataset(term, { allowUnpublished: false, cache: memoryCache(), fetchImpl: fromDisk });
      if (result.kind !== "fresh") throw new Error(`${term}: ${result.kind === "unavailable" ? `${result.error.code} ${result.error.message}` : result.kind}`);
      expect(result.dataset.entry.status).toBe("published");
      expect(result.dataset.timetable.sections.length).toBeGreaterThan(0);
    });
  }

  it("loads artifacts produced by `scripts/dataset.mjs import/validate/publish` under both preview and production policies (REV-M3-105)", async () => {
    const { syntheticXlsx } = (await import(pathToFileURL(join(repoRoot, "packages/parser/dist/test/synthetic-xlsx.js")).href)) as {
      syntheticXlsx: (sheets: { name: string; rows: string[][] }[]) => Uint8Array;
    };
    const tmp = mkdtempSync(join(tmpdir(), "ky-nay-published-loader-"));
    try {
      const xlsxPath = join(tmp, "synthetic.xlsx");
      writeFileSync(
        xlsxPath,
        syntheticXlsx([{
          name: "TKB",
          rows: [
            ["STT", "Mã học phần", "Học phần", "Số TC", "Mã LHP", "Giảng viên", "Thứ", "Ca", "Giảng đường", "Nhóm"],
            ["1", "SYN3071E", "Môn mẫu", "3", "SYN3071E 1", "TS.Mẫu", "3", "1", "203-G2", "CL"],
          ],
        }]),
      );
      const dataRoot = join(tmp, "data");
      const runCli = (args: string[]) =>
        spawnSync(process.execPath, [join(repoRoot, "scripts", "dataset.mjs"), ...args], {
          env: { ...process.env, DATASET_ROOT_DIR: dataRoot },
          encoding: "utf8",
        });

      const imp = runCli(["import", xlsxPath, "--term", "2026-2027-h1", "--term-name", "Học kỳ I", "--source-type", "official-timetable", "--document-ref", "SYN-DOC-1", "--published-by", "UET", "--actor", "Importer A", "--start", "K69=2026-09-07"]);
      expect(imp.status).toBe(0);
      const tempPublished = join(dataRoot, "published");
      const tempFetch = diskFetcher(tempPublished);

      // As `candidate`, preview loads it (`allowUnpublished: true`), production blocks it (`allowUnpublished: false`).
      const previewCandidate = await loadDataset("2026-2027-h1", { allowUnpublished: true, cache: memoryCache(), fetchImpl: tempFetch });
      expect(previewCandidate.kind).toBe("fresh");
      const prodCandidate = await loadDataset("2026-2027-h1", { allowUnpublished: false, cache: memoryCache(), fetchImpl: tempFetch });
      expect(prodCandidate.kind).toBe("unavailable");

      const version = JSON.parse(readFileSync(join(tempPublished, "manifest.json"), "utf8")).datasets[0].datasetVersion as string;
      expect(runCli(["validate", version, "--reviewer", "Reviewer B"]).status).toBe(0);
      expect(runCli(["publish", version, "--by", "Release Manager"]).status).toBe(0);

      // Once `published`, production loads and verifies it (`allowUnpublished: false`).
      const prodPublished = await loadDataset("2026-2027-h1", { allowUnpublished: false, cache: memoryCache(), fetchImpl: tempFetch });
      expect(prodPublished.kind).toBe("fresh");
      if (prodPublished.kind === "fresh") {
        expect(prodPublished.dataset.entry.status).toBe("published");
        expect(prodPublished.dataset.timetable.sections.map((s) => s.id)).toEqual(["SYN3071E 1"]);
        expect(prodPublished.dataset.metadata.term.starts).toEqual([{ cohorts: ["K69"], week1: "2026-09-07" }]);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
