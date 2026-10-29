/** Boot sequence and persistence for the single-page app. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "@ky-nay/domain";
import type { ArtifactError, LoadedDataset } from "../data/contract.js";
import { loadDataset, type DatasetCacheLike, type TermOption } from "../data/loader.js";
import { buildAppCatalog, type AppCatalog } from "../model/catalog.js";
import { openDb } from "../storage/db.js";
import { datasetCache, loadSettings, saveSettings, wipeLocalData } from "../storage/local-data.js";
import { loadPlans, savePlanIfUnchanged } from "../storage/plan-store.js";

/** Cross-tab messages (QA-M3-005): another tab saved Plans or wiped the device data. */
type TabMessage = { type: "plans-changed" } | { type: "wiped" };
const CHANNEL = "ky-nay";

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
  return { get: async (term) => store.get(term), put: async (dataset) => void store.set(dataset.entry.term, dataset), delete: async (term) => void store.delete(term), all: async () => [...store.values()] };
}

export function useAppController() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [notices, setNotices] = useState<StorageNotice[]>([]);
  const dbRef = useRef<IDBDatabase | undefined>(undefined);
  const cacheRef = useRef<DatasetCacheLike>(memoryCache());
  const plansRef = useRef<Plan[]>([]);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const channelRef = useRef<BroadcastChannel | undefined>(undefined);

  const showPlans = useCallback((plans: Plan[]) => {
    plansRef.current = plans;
    setState((current) => (current.status === "ready" ? { ...current, plans } : current));
  }, []);

  const reloadPlans = useCallback(async () => {
    const db = dbRef.current;
    if (db) showPlans((await loadPlans(db)).plans);
  }, [showPlans]);

  const load = useCallback(async (term: string | undefined) => {
    setState({ status: "loading" });
    const result = await loadDataset(term, { allowUnpublished: ALLOW_UNPUBLISHED, cache: cacheRef.current });
    if (result.kind === "unavailable") {
      setState({ status: "unavailable", error: result.error, terms: result.terms });
      return;
    }
    if (result.kind === "fresh" && result.notCached) {
      setNotices((current) => [...current, { kind: "warning", text: "Không lưu được dữ liệu thời khóa biểu vào bộ nhớ trình duyệt (có thể đã đầy), nên khi mất mạng sẽ không mở được. Dữ liệu đang dùng vẫn hợp lệ." }]);
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
    // The edit was made on the version this tab showed; captured now, a copy that another tab stored meanwhile
    // (and that this tab may reload before the queued save runs) still counts as a change and is not overwritten.
    const base = plansRef.current.find((item) => item.id === plan.id)?.updatedAt;
    plansRef.current = [...plansRef.current.filter((item) => item.id !== plan.id), plan];
    setState((current) => (current.status === "ready" ? { ...current, plans: plansRef.current } : current));
    const db = dbRef.current;
    if (!db) return;
    // Saves run one after another: an edit based on the previous edit expects exactly what that save wrote.
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        if (await savePlanIfUnchanged(db, plan, base)) {
          channelRef.current?.postMessage({ type: "plans-changed" } satisfies TabMessage);
          return;
        }
        // Another tab changed or deleted this Plan since this tab read it: show the stored copy instead of overwriting it.
        await reloadPlans();
        setNotices((current) => [...current, { kind: "warning", text: "Phương án vừa được thay đổi ở một tab khác nên thay đổi vừa rồi chưa được lưu. Đã tải bản mới nhất, hãy thao tác lại." }]);
      } catch {
        setNotices((current) => [...current, { kind: "warning", text: "Không lưu được phương án vào bộ nhớ trình duyệt." }]);
      }
    });
    await saveChainRef.current;
  }, [reloadPlans]);

  const resetAfterWipe = useCallback(async (text: string) => {
    const db = dbRef.current;
    plansRef.current = [];
    cacheRef.current = db ? datasetCache(db) : memoryCache();
    setNotices([{ kind: "info", text }]);
    await load(undefined);
  }, [load]);

  const wipe = useCallback(async () => {
    const db = dbRef.current;
    if (db) await wipeLocalData(db);
    channelRef.current?.postMessage({ type: "wiped" } satisfies TabMessage);
    await resetAfterWipe("Đã xóa phương án, dữ liệu đã lưu và bộ nhớ đệm của ứng dụng trên thiết bị này.");
  }, [resetAfterWipe]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      if (event.data?.type === "plans-changed") void reloadPlans();
      if (event.data?.type === "wiped") void resetAfterWipe("Dữ liệu trên máy đã được xóa ở một tab khác.");
    };
    return () => {
      channel.close();
      channelRef.current = undefined;
    };
  }, [reloadPlans, resetAfterWipe]);

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
