/** Dataset cache, settings and the "delete everything on this device" action. */
import type { LoadedDataset } from "../data/contract.js";
import { isThemePreference, type ThemePreference } from "../app/theme.js";
import { isHintId, type HintId } from "../model/hints.js";
import { isCourseColorId, type CourseColorId } from "../model/palette.js";
import type { UnmatchedRegistrationItem } from "../model/registration.js";
import { idbClearAll, idbDelete, idbEntries, idbGet, idbPut, idbUpdate } from "./db.js";

export type TermRegistrationNotes = {
  unmatched: UnmatchedRegistrationItem[];
  warnings: string[];
};

export type Settings = {
  activeTerm?: string;
  /** Per-term selected Plan slot (`draft` vs `final`). */
  activeSlots?: Record<string, "draft" | "final">;
  /** Per-term PII-free registration unmatched items and warnings for the `final` Plan. */
  registrationNotes?: Record<string, TermRegistrationNotes>;
  /** M6 (ADR-0015 point 6): "system" when absent. */
  theme?: ThemePreference;
  /** M6: canonical course code → colour chosen by the user; absent key = automatic colour. At most 100 keys. */
  courseColors?: Record<string, CourseColorId>;
  /** M6: one-time hints already dismissed or acted on. */
  seenHints?: Partial<Record<HintId, true>>;
};

export const MAX_COURSE_COLORS = 100;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reading side of the M6 fields (DESIGN-M6-001 §4): unknown values are dropped instead of failing; an unknown theme
 * becomes absent ("system"). Fields of earlier versions pass through unchanged.
 */
export function sanitizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return {};
  const { theme, courseColors, seenHints, ...rest } = raw;
  const settings = { ...rest } as Settings;
  if (isThemePreference(theme)) settings.theme = theme;
  if (isRecord(courseColors)) {
    const entries = Object.entries(courseColors).filter((entry): entry is [string, CourseColorId] => entry[0] !== "" && isCourseColorId(entry[1]));
    if (entries.length > 0) settings.courseColors = Object.fromEntries(entries.slice(-MAX_COURSE_COLORS));
  }
  if (isRecord(seenHints)) {
    const ids = Object.keys(seenHints).filter((id): id is HintId => isHintId(id) && seenHints[id] === true);
    if (ids.length > 0) settings.seenHints = Object.fromEntries(ids.map((id) => [id, true as const]));
  }
  return settings;
}

/** Sets or clears ("Tự động") one course colour; the newest choice is kept last and the oldest dropped past 100. */
export function withCourseColor(current: Readonly<Record<string, CourseColorId>> | undefined, courseCode: string, color: CourseColorId | undefined): Record<string, CourseColorId> {
  const next = { ...(current ?? {}) };
  delete next[courseCode];
  if (color) next[courseCode] = color;
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_COURSE_COLORS))) delete next[key];
  return next;
}

/** One cached dataset per term (the last one that passed validation). */
export function datasetCache(db: IDBDatabase) {
  return {
    get: (term: string) => idbGet<LoadedDataset>(db, "datasets", term),
    put: (dataset: LoadedDataset) => idbPut(db, "datasets", dataset, dataset.entry.term),
    delete: (term: string) => idbDelete(db, "datasets", term),
    all: async () => (await idbEntries<LoadedDataset>(db, "datasets")).map((item) => item.value),
  };
}

export type DatasetCache = ReturnType<typeof datasetCache>;

export async function loadSettings(db: IDBDatabase): Promise<Settings> {
  return sanitizeSettings(await idbGet<unknown>(db, "settings", "app"));
}

export async function saveSettings(db: IDBDatabase, settings: Settings): Promise<void> {
  await idbPut(db, "settings", settings, "app");
}

/** Read-modify-write of the settings record in one transaction (ADR-0015 point 6). */
export function mutateSettings(db: IDBDatabase, mutate: (current: Settings) => Settings): Promise<Settings> {
  return idbUpdate<Settings>(db, "settings", "app", (current) => mutate(sanitizeSettings(current)));
}

/** Merges `patch` into the stored settings; per-term maps are merged key by key, as before. */
export function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
  return {
    ...current,
    ...patch,
    ...(current.activeSlots || patch.activeSlots
      ? { activeSlots: { ...(current.activeSlots ?? {}), ...(patch.activeSlots ?? {}) } }
      : {}),
    ...(current.registrationNotes || patch.registrationNotes
      ? { registrationNotes: { ...(current.registrationNotes ?? {}), ...(patch.registrationNotes ?? {}) } }
      : {}),
  };
}

export function updateSettings(db: IDBDatabase, patch: Partial<Settings>): Promise<Settings> {
  return mutateSettings(db, (current) => mergeSettings(current, patch));
}

/**
 * Clears IndexedDB and the service-worker caches owned by this app, then unregisters the worker: its precache is
 * filled only on install, so the next online load must install it again or offline use stays broken (REV-M3-002).
 */
export async function wipeLocalData(db: IDBDatabase): Promise<void> {
  await idbClearAll(db);
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("ky-nay-")).map((key) => caches.delete(key)));
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}
