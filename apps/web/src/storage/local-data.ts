/** Dataset cache, settings and the "delete everything on this device" action. */
import type { LoadedDataset } from "../data/contract.js";
import { idbClearAll, idbGet, idbPut } from "./db.js";

export type Settings = { activeTerm?: string };

/** One cached dataset per term (the last one that passed validation). */
export function datasetCache(db: IDBDatabase) {
  return {
    get: (term: string) => idbGet<LoadedDataset>(db, "datasets", term),
    put: (dataset: LoadedDataset) => idbPut(db, "datasets", dataset, dataset.entry.term),
  };
}

export type DatasetCache = ReturnType<typeof datasetCache>;

export async function loadSettings(db: IDBDatabase): Promise<Settings> {
  return (await idbGet<Settings>(db, "settings", "app")) ?? {};
}

export async function saveSettings(db: IDBDatabase, settings: Settings): Promise<void> {
  await idbPut(db, "settings", settings, "app");
}

/** Clears IndexedDB and the service-worker caches owned by this app. */
export async function wipeLocalData(db: IDBDatabase): Promise<void> {
  await idbClearAll(db);
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("ky-nay-")).map((key) => caches.delete(key)));
  }
}
