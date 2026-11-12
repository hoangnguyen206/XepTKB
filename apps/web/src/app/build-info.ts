/**
 * Build identity and the optional report-page URL (M5-A, M5-B; DESIGN-M5-001 §3/§4, ADR-0014 §3–4).
 * This is the only module that reads the build-time constants. Both are re-validated at runtime, so a malformed
 * value can never reach the DOM: the build object falls back field by field, the URL falls back to "none".
 */

export type BuildChannel = "production" | "preview" | "local";

export type BuildInfo = {
  version: string;
  /** 7 hex characters (optionally `-dirty` on a local build), or `unknown`. */
  commit: string;
  /** ISO-8601 UTC instant; absent when the build did not provide one. */
  builtAt?: string;
  channel: BuildChannel;
};

export const FALLBACK_BUILD: BuildInfo = { version: "0.0.0-dev", commit: "unknown", channel: "local" };

const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/;
const COMMIT_RE = /^(?:[0-9a-f]{7}(?:-dirty)?|unknown)$/;
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/;
const CHANNELS: readonly BuildChannel[] = ["production", "preview", "local"];
const MAX_URL_LENGTH = 2048;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function field(raw: unknown, key: string): unknown {
  return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;
}

/** Keeps only well-formed fields of a build object; anything else falls back. */
export function normalizeBuildInfo(raw: unknown): BuildInfo {
  const version = field(raw, "version");
  const commit = field(raw, "commit");
  const builtAt = field(raw, "builtAt");
  const channel = field(raw, "channel");
  return {
    version: typeof version === "string" && VERSION_RE.test(version) ? version : FALLBACK_BUILD.version,
    commit: typeof commit === "string" && COMMIT_RE.test(commit) ? commit : FALLBACK_BUILD.commit,
    ...(typeof builtAt === "string" && ISO_INSTANT_RE.test(builtAt) && !Number.isNaN(Date.parse(builtAt)) ? { builtAt } : {}),
    channel: CHANNELS.includes(channel as BuildChannel) ? (channel as BuildChannel) : FALLBACK_BUILD.channel,
  };
}

/**
 * Runtime re-check of the report URL (DESIGN-M5-001 §3): an absolute `https:` URL (or `http:` on localhost), no
 * user info, at most 2048 characters, no surrounding whitespace or control characters. Returns the string exactly as
 * configured — the app never appends anything to it — or `undefined` (copy-only UI).
 */
export function validateReportUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_URL_LENGTH) return undefined;
  if (raw !== raw.trim() || /[\u0000-\u001f\u007f\s]/.test(raw)) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.username !== "" || url.password !== "") return undefined;
  if (url.protocol === "https:") return raw;
  if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) return raw;
  return undefined;
}

export function readBuildInfo(): BuildInfo {
  return normalizeBuildInfo(typeof __KY_NAY_BUILD__ === "undefined" ? undefined : __KY_NAY_BUILD__);
}

export function readReportUrl(): string | undefined {
  return validateReportUrl(typeof __KY_NAY_REPORT_URL__ === "undefined" ? undefined : __KY_NAY_REPORT_URL__);
}

const CHANNEL_TEXT: Record<BuildChannel, string> = {
  production: "",
  preview: "bản xem trước",
  local: "bản dựng cục bộ",
};

/** `2026-11-10T08:30Z` → `2026-11-10 08:30 UTC`, without Intl so the error screen cannot fail on it. */
export function formatBuiltAt(builtAt: string): string {
  return `${builtAt.slice(0, 10)} ${builtAt.slice(11, 16)} UTC`;
}

/** Footer / About / error-screen line, e.g. `Phiên bản 0.1.0 · 1a2b3c4 · dựng 2026-11-10 08:30 UTC`. */
export function buildLabel(info: BuildInfo): string {
  const parts = [`Phiên bản ${info.version}`, info.commit];
  if (info.builtAt) parts.push(`dựng ${formatBuiltAt(info.builtAt)}`);
  const channel = CHANNEL_TEXT[info.channel];
  if (channel) parts.push(channel);
  return parts.join(" · ");
}
