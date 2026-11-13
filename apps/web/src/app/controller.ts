/** Boot sequence and persistence for the single-page app. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "@ky-nay/domain";
import { ArtifactError, type LoadedDataset } from "../data/contract.js";
import { loadDataset, type DatasetCacheLike, type TermOption } from "../data/loader.js";
import { buildAppCatalog, type AppCatalog } from "../model/catalog.js";
import type { HintId } from "../model/hints.js";
import type { CourseColorId } from "../model/palette.js";
import { openDb } from "../storage/db.js";
import { datasetCache, loadSettings, mutateSettings, updateSettings, wipeLocalData, withCourseColor, type Settings, type TermRegistrationNotes } from "../storage/local-data.js";
import { deletePlan, loadPlans, savePlanIfUnchanged } from "../storage/plan-store.js";
import { ensureServiceWorkerAfterWipe } from "./sw-client.js";
import { applyTheme, type ThemePreference } from "./theme.js";

/** Cross-tab messages (QA-M3-005): another tab saved Plans or UI settings (M6), or wiped the device data. */
type TabMessage = { type: "plans-changed" } | { type: "settings-changed" } | { type: "wiped" };
const CHANNEL = "ky-nay";

/** ADR-0010 §2 rule 4 / SEC-M3-003: dev server and preview builds with VITE_ALLOW_UNPUBLISHED=true may load unpublished data; explicit "false" always disables it. */
export const ALLOW_UNPUBLISHED = import.meta.env.VITE_ALLOW_UNPUBLISHED === "true" || (import.meta.env.DEV && import.meta.env.VITE_ALLOW_UNPUBLISHED !== "false");

export type Ready = {
  status: "ready";
  dataset: LoadedDataset;
  catalog: AppCatalog;
  terms: TermOption[];
  /** Set when the app shows the last cached dataset instead of fresh data. */
  cached?: { reason: "offline" | "invalid"; error: ArtifactError };
  plans: Plan[];
  activeSlots: Record<string, "draft" | "final">;
  registrationNotes: Record<string, TermRegistrationNotes>;
  /** M6 UI settings (DESIGN-M6-001 §4). */
  theme: ThemePreference;
  courseColors: Record<string, CourseColorId>;
  seenHints: Partial<Record<HintId, true>>;
};

/** The settings fields every Ready state carries. */
function settingsView(settings: Settings): Pick<Ready, "activeSlots" | "registrationNotes" | "theme" | "courseColors" | "seenHints"> {
  return {
    activeSlots: settings.activeSlots ?? {},
    registrationNotes: settings.registrationNotes ?? {},
    theme: settings.theme ?? "system",
    courseColors: settings.courseColors ?? {},
    seenHints: settings.seenHints ?? {},
  };
}

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
  const [wipeGeneration, setWipeGeneration] = useState(0);
  // Outside Ready too: the About panel (theme picker) is reachable while loading or when data is unavailable.
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const dbRef = useRef<IDBDatabase | undefined>(undefined);
  const cacheRef = useRef<DatasetCacheLike>(memoryCache());
  const plansRef = useRef<Plan[]>([]);
  const settingsRef = useRef<Settings>({});
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const channelRef = useRef<BroadcastChannel | undefined>(undefined);

  /** Makes `nextSettings` current: ref, theme attribute and the Ready state. */
  const showSettings = useCallback((nextSettings: Settings) => {
    settingsRef.current = nextSettings;
    const preference = nextSettings.theme ?? "system";
    applyTheme(preference);
    setThemeState(preference);
    setState((current) => (current.status === "ready" ? { ...current, ...settingsView(nextSettings) } : current));
  }, []);

  const showPlans = useCallback((plans: Plan[], nextSettings: Settings = settingsRef.current) => {
    plansRef.current = plans;
    setState((current) => (current.status === "ready" ? { ...current, plans } : current));
    showSettings(nextSettings);
  }, [showSettings]);

  const reloadPlans = useCallback(async () => {
    const db = dbRef.current;
    if (db) {
      const [planReport, storedSettings] = await Promise.all([loadPlans(db), loadSettings(db)]);
      showPlans(planReport.plans, storedSettings);
    }
  }, [showPlans]);

  const load = useCallback(async (term: string | undefined) => {
    setState({ status: "loading" });
    let result;
    try {
      result = await loadDataset(term, { allowUnpublished: ALLOW_UNPUBLISHED, cache: cacheRef.current });
    } catch (error) {
      const failure = error instanceof ArtifactError ? error : new ArtifactError("INVALID_ARTIFACT", error instanceof Error ? error.message : String(error));
      setState({ status: "unavailable", error: failure, terms: [] });
      return;
    }
    if (result.kind === "unavailable") {
      setState({ status: "unavailable", error: result.error, terms: result.terms });
      return;
    }
    if (result.kind === "fresh" && result.notCached) {
      setNotices((current) => [...current, { kind: "warning", text: "Không lưu được dữ liệu thời khóa biểu vào bộ nhớ trình duyệt (có thể đã đầy), nên khi mất mạng sẽ không mở được. Dữ liệu đang dùng vẫn hợp lệ." }]);
    }
    const db = dbRef.current;
    settingsRef.current = { ...settingsRef.current, activeTerm: result.dataset.entry.term };
    if (db) await updateSettings(db, { activeTerm: result.dataset.entry.term }).catch(() => undefined);
    setState({
      status: "ready",
      dataset: result.dataset,
      catalog: buildAppCatalog(result.dataset),
      terms: result.terms,
      ...(result.kind === "cached" ? { cached: { reason: result.reason, error: result.error } } : {}),
      plans: plansRef.current,
      ...settingsView(settingsRef.current),
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
        const loadedSettings = await loadSettings(db);
        settingsRef.current = loadedSettings;
        // DESIGN-M6-001 §2: before the dataset loads, so a saved theme shows as early as IndexedDB allows.
        if (!cancelled) {
          applyTheme(loadedSettings.theme ?? "system");
          setThemeState(loadedSettings.theme ?? "system");
        }
        activeTerm = loadedSettings.activeTerm;
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
    void ensureServiceWorkerAfterWipe();
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

  const selectSlot = useCallback(async (term: string, slot: "draft" | "final") => {
    const nextSettings: Settings = {
      ...settingsRef.current,
      activeSlots: { ...(settingsRef.current.activeSlots ?? {}), [term]: slot },
    };
    settingsRef.current = nextSettings;
    setState((current) =>
      current.status === "ready" ? { ...current, activeSlots: nextSettings.activeSlots ?? {} } : current,
    );
    const db = dbRef.current;
    if (!db) return;
    saveChainRef.current = saveChainRef.current.then(async () => {
      await updateSettings(db, { activeSlots: { [term]: slot } }).catch(() => undefined);
    });
    await saveChainRef.current;
  }, []);

  const applyRegistrationImport = useCallback(async (finalPlan: Plan, notes: TermRegistrationNotes) => {
    const term = finalPlan.term;
    const nextSettings: Settings = {
      ...settingsRef.current,
      activeSlots: { ...(settingsRef.current.activeSlots ?? {}), [term]: "final" },
      registrationNotes: { ...(settingsRef.current.registrationNotes ?? {}), [term]: notes },
    };
    settingsRef.current = nextSettings;
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            activeSlots: nextSettings.activeSlots ?? {},
            registrationNotes: nextSettings.registrationNotes ?? {},
          }
        : current,
    );
    await persistPlan(finalPlan);
    const db = dbRef.current;
    if (!db) return;
    saveChainRef.current = saveChainRef.current.then(async () => {
      await updateSettings(db, {
        activeSlots: { [term]: "final" },
        registrationNotes: { [term]: notes },
      }).catch(() => undefined);
    });
    await saveChainRef.current;
  }, [persistPlan]);

  const removeFinalPlan = useCallback(async (planId: string, term: string) => {
    plansRef.current = plansRef.current.filter((item) => item.id !== planId);
    const nextRegistrationNotes = { ...(settingsRef.current.registrationNotes ?? {}) };
    delete nextRegistrationNotes[term];
    const nextActiveSlots = { ...(settingsRef.current.activeSlots ?? {}), [term]: "draft" as const };
    const nextSettings: Settings = {
      ...settingsRef.current,
      activeSlots: nextActiveSlots,
      registrationNotes: nextRegistrationNotes,
    };
    settingsRef.current = nextSettings;
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            plans: plansRef.current,
            activeSlots: nextActiveSlots,
            registrationNotes: nextRegistrationNotes,
          }
        : current,
    );
    const db = dbRef.current;
    if (!db) return;
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        await deletePlan(db, planId);
        // ADR-0015 point 6: read-modify-write in one transaction, so UI settings saved by another tab are kept.
        await mutateSettings(db, (current) => {
          const registrationNotes = { ...(current.registrationNotes ?? {}) };
          delete registrationNotes[term];
          return { ...current, activeSlots: { ...(current.activeSlots ?? {}), [term]: "draft" }, registrationNotes };
        });
        channelRef.current?.postMessage({ type: "plans-changed" } satisfies TabMessage);
      } catch {
        setNotices((current) => [...current, { kind: "warning", text: "Không xóa được phương án chính thức khỏi bộ nhớ trình duyệt." }]);
      }
    });
    await saveChainRef.current;
  }, []);

  const resetAfterWipe = useCallback(async (text: string) => {
    const db = dbRef.current;
    plansRef.current = [];
    settingsRef.current = {};
    applyTheme("system");
    setThemeState("system");
    cacheRef.current = db ? datasetCache(db) : memoryCache();
    setWipeGeneration((n) => n + 1);
    setNotices([{ kind: "info", text }]);
    await load(undefined);
  }, [load]);

  /** Saves one UI settings change (theme, course colour, hint) after the queued saves; other tabs reload settings. */
  const saveUiSetting = useCallback(async (local: (current: Settings) => Settings) => {
    showSettings(local(settingsRef.current));
    const db = dbRef.current;
    if (!db) return;
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        await mutateSettings(db, local);
        channelRef.current?.postMessage({ type: "settings-changed" } satisfies TabMessage);
      } catch {
        setNotices((current) => [...current, { kind: "warning", text: "Không lưu được cài đặt giao diện vào bộ nhớ trình duyệt." }]);
      }
    });
    await saveChainRef.current;
  }, [showSettings]);

  const setTheme = useCallback(
    (preference: ThemePreference) => saveUiSetting((current) => {
      const next = { ...current };
      if (preference === "system") delete next.theme;
      else next.theme = preference;
      return next;
    }),
    [saveUiSetting],
  );

  /** `undefined` = "Tự động" (the key is removed). */
  const setCourseColor = useCallback(
    (courseCode: string, color: CourseColorId | undefined) => saveUiSetting((current) => ({ ...current, courseColors: withCourseColor(current.courseColors, courseCode, color) })),
    [saveUiSetting],
  );

  const markHintSeen = useCallback(
    (id: HintId) => saveUiSetting((current) => ({ ...current, seenHints: { ...(current.seenHints ?? {}), [id]: true } })),
    [saveUiSetting],
  );

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
      if (event.data?.type === "plans-changed" || event.data?.type === "settings-changed") void reloadPlans();
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
    wipeGeneration,
    dismissNotice: (index: number) => setNotices((current) => current.filter((_, position) => position !== index)),
    switchTerm: (term: string) => load(term),
    retry: () => load(state.status === "ready" ? state.dataset.entry.term : undefined),
    persistPlan,
    selectSlot,
    applyRegistrationImport,
    removeFinalPlan,
    theme,
    setTheme,
    setCourseColor,
    markHintSeen,
    wipe,
    db: () => dbRef.current,
  };
}

export type AppController = ReturnType<typeof useAppController>;
