/**
 * Theme preference (DESIGN-M6-001 §2, ADR-0015 point 2, AC-M6-01). No inline script and no synchronous storage: the
 * saved preference is applied right after settings are read from IndexedDB. "system" (the default) removes
 * `data-theme`, so the CSS follows prefers-color-scheme with no flash; "light"/"dark" set it. The two
 * `<meta name="theme-color">` tags of index.html (one per colour-scheme media) follow the forced theme.
 */
export type ThemePreference = "system" | "light" | "dark";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
export const THEME_LABELS: Record<ThemePreference, string> = { system: "Hệ thống", light: "Sáng", dark: "Tối" };

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Original theme-color values per scheme, read once from index.html (colour values stay out of TS modules). */
const original = new WeakMap<Document, { light?: string; dark?: string }>();

function themeColorMetas(doc: Document): { light?: HTMLMetaElement; dark?: HTMLMetaElement } {
  const metas = [...doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  const light = metas.find((meta) => meta.media.includes("light"));
  const dark = metas.find((meta) => meta.media.includes("dark"));
  return { ...(light ? { light } : {}), ...(dark ? { dark } : {}) };
}

export function applyTheme(preference: ThemePreference, doc: Document | undefined = typeof document === "undefined" ? undefined : document): void {
  if (!doc) return;
  const root = doc.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);

  const metas = themeColorMetas(doc);
  if (!original.has(doc)) {
    original.set(doc, {
      ...(metas.light ? { light: metas.light.content } : {}),
      ...(metas.dark ? { dark: metas.dark.content } : {}),
    });
  }
  const colors = original.get(doc)!;
  const forced = preference === "system" ? undefined : colors[preference];
  if (metas.light && colors.light) metas.light.content = forced ?? colors.light;
  if (metas.dark && colors.dark) metas.dark.content = forced ?? colors.dark;
}
