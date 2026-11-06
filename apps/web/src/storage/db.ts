/** Minimal promise wrapper around IndexedDB (ADR-0010 §3). Nothing stored here leaves the device. */

export const DB_NAME = "ky-nay";
const DB_VERSION = 1;

export type StoreName = "plans" | "datasets" | "settings" | "backups";
export const STORE_NAMES: readonly StoreName[] = ["plans", "datasets", "settings", "backups"];

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Plans and datasets use out-of-line keys so a malformed record can still be found and moved.
      if (!db.objectStoreNames.contains("plans")) db.createObjectStore("plans");
      if (!db.objectStoreNames.contains("datasets")) db.createObjectStore("datasets");
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
      if (!db.objectStoreNames.contains("backups")) db.createObjectStore("backups", { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked by another tab"));
  });
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function idbGet<T>(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return (await done(db.transaction(store, "readonly").objectStore(store).get(key))) as T | undefined;
}

export async function idbEntries<T>(db: IDBDatabase, store: StoreName): Promise<{ key: IDBValidKey; value: T }[]> {
  const objectStore = db.transaction(store, "readonly").objectStore(store);
  const [keys, values] = await Promise.all([done(objectStore.getAllKeys()), done(objectStore.getAll())]);
  return keys.map((key, index) => ({ key, value: values[index] as T }));
}

export async function idbPut(db: IDBDatabase, store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  const transaction = db.transaction(store, "readwrite");
  transaction.objectStore(store).put(value, key);
  await completed(transaction);
}

export async function idbDelete(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<void> {
  const transaction = db.transaction(store, "readwrite");
  transaction.objectStore(store).delete(key);
  await completed(transaction);
}

/**
 * Writes `value` only while `unchanged(current)` holds, read and write in one readwrite transaction: another tab's
 * write to the same store cannot land in between (QA-M3-005). Resolves to whether the value was written.
 */
export async function idbPutIfUnchanged(db: IDBDatabase, store: StoreName, key: IDBValidKey, value: unknown, unchanged: (current: unknown) => boolean): Promise<boolean> {
  const transaction = db.transaction(store, "readwrite");
  const objectStore = transaction.objectStore(store);
  let written = false;
  const request = objectStore.get(key);
  request.onsuccess = () => {
    if (!unchanged(request.result)) return;
    objectStore.put(value, key);
    written = true;
  };
  await completed(transaction);
  return written;
}

/** Moves a record to `backups` and deletes the original in one transaction. */
export async function idbMoveToBackup(db: IDBDatabase, store: StoreName, key: IDBValidKey, backup: unknown): Promise<void> {
  const transaction = db.transaction([store, "backups"], "readwrite");
  transaction.objectStore("backups").add(backup);
  transaction.objectStore(store).delete(key);
  await completed(transaction);
}

/** "Xóa dữ liệu trên máy": empties every store. */
export async function idbClearAll(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction([...STORE_NAMES], "readwrite");
  for (const store of STORE_NAMES) transaction.objectStore(store).clear();
  await completed(transaction);
}
