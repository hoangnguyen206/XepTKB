/** Boot sequence and persistence for the single-page app. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "@ky-nay/domain";
import type { ArtifactError, LoadedDataset } from "../data/contract.js";
import { loadDataset, type DatasetCacheLike, type TermOption } from "../data/loader.js";
import { buildAppCatalog, type AppCatalog } from "../model/catalog.js";
import { openDb } from "../storage/db.js";
import { datasetCache, loadSettings, saveSettings, wipeLocalData } from "../storage/local-data.js";
import { loadPlans, savePlan } from "../storage/plan-store.js";

/** ADR-0010 §2 rule 4: the dev server and builds made with VITE_ALLOW_UNPUBLISHED=true may load unpublished data. */
export const ALLOW_UNPUBLISHED = import.meta.env.DEV || import.meta.env.VITE_ALLOW_UNPUBLISHED === "true";

export type Ready = {
  status: "ready";
  dataset: LoadedDataset;
  catalog: AppCatalog;
  terms: TermOption[];
  /** Set when the app shows the last cached dataset instead of fresh data. */
  cached?: { reason: "offline" | "invalid"; error: ArtifactError };
  plans: Plan[];
};

export type AppState =
  | { status: "loading" }
  | { status: "unavailable"; error: ArtifactError; terms: TermOption[] }
  | Ready;

export type StorageNotice = { kind: "info" | "warning"; text: string };

function memoryCache(): DatasetCacheLike {
  const store = new Map<string, LoadedDataset>();
  return { get: async (term) => store.get(term), put: async (dataset) => void store.set(dataset.entry.term, dataset) };
}

export function useAppController() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [notices, setNotices] = useState<StorageNotice[]>([]);
  const dbRef = useRef<IDBDatabase | undefined>(undefined);
  const cacheRef = useRef<DatasetCacheLike>(memoryCache());
  const plansRef = useRef<Plan[]>([]);

  const load = useCallback(async (term: string | undefined) => {
    setState({ status: "loading" });
    const result = await loadDataset(term, { allowUnpublished: ALLOW_UNPUBLISHED, cache: cacheRef.current });
    if (result.kind === "unavailable") {
      setState({ status: "unavailable", error: result.error, terms: result.terms });
      return;
    }
    const db = dbRef.current;
    if (db) await saveSettings(db, { activeTerm: result.dataset.entry.term }).catch(() => undefined);
    setState({
      status: "ready",
      dataset: result.dataset,
      catalog: buildAppCatalog(result.dataset),
      terms: result.terms,
      ...(result.kind === "cached" ? { cached: { reason: result.reason, error: result.error } } : {}),
      plans: plansRef.current,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found: StorageNotice[] = [];
      let activeTerm: string | undefined;
      try {
        const db = await openDb();
        dbRef.current = db;
        cacheRef.current = datasetCache(db);
        activeTerm = (await loadSettings(db)).activeTerm;
        const report = await loadPlans(db);
        plansRef.current = report.plans;
        if (report.migrated.length > 0) found.push({ kind: "info", text: `Đã chuyển ${report.migrated.length} phương án sang định dạng mới. ${report.notes.join("; ")}` });
        if (report.quarantined > 0) found.push({ kind: "warning", text: `${report.quarantined} phương án cũ không đọc được đã được chuyển vào bản sao lưu trên máy (xem mục Dữ liệu trên máy).` });
        if (report.newer > 0) found.push({ kind: "warning", text: `${report.newer} phương án được tạo bởi phiên bản ứng dụng mới hơn nên không mở được ở đây.` });
      } catch {
        found.push({ kind: "warning", text: "Trình duyệt này không cho lưu dữ liệu (có thể do chế độ ẩn danh). Phương án sẽ mất khi đóng trang." });
      }
      if (cancelled) return;
      setNotices(found);
      await load(activeTerm);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const persistPlan = useCallback(async (plan: Plan) => {
    plansRef.current = [...plansRef.current.filter((item) => item.id !== plan.id), plan];
    setState((current) => (current.status === "ready" ? { ...current, plans: plansRef.current } : current));
    const db = dbRef.current;
    if (!db) return;
    try {
      await savePlan(db, plan);
    } catch {
      setNotices((current) => [...current, { kind: "warning", text: "Không lưu được phương án vào bộ nhớ trình duyệt." }]);
    }
  }, []);

  const wipe = useCallback(async () => {
    const db = dbRef.current;
    if (db) await wipeLocalData(db);
    plansRef.current = [];
    cacheRef.current = db ? datasetCache(db) : memoryCache();
    setNotices([{ kind: "info", text: "Đã xóa phương án, dữ liệu đã lưu và bộ nhớ đệm của ứng dụng trên thiết bị này." }]);
    await load(undefined);
  }, [load]);

  return {
    state,
    notices,
    dismissNotice: (index: number) => setNotices((current) => current.filter((_, position) => position !== index)),
    switchTerm: (term: string) => load(term),
    retry: () => load(state.status === "ready" ? state.dataset.entry.term : undefined),
    persistPlan,
    wipe,
    db: () => dbRef.current,
  };
}

export type AppController = ReturnType<typeof useAppController>;
