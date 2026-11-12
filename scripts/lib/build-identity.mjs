// Build identity and report-link validation for the web build (DESIGN-M5-001 §3/§4, ADR-0014 points 3–4).
// Used by apps/web/vite.config.ts at config time; pure functions plus small, injectable git/package readers.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Longest report URL accepted at build time (ADR-0014 point 4). */
export const MAX_REPORT_URL_LENGTH = 2048;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SHORT_SHA = /^[0-9a-f]{7}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Reads the single version source: the root `package.json` (DESIGN-M5-001 §4). */
export function readRootVersion(root = repoRoot) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return pkg.version;
}

/** `git rev-parse --short=7 HEAD` (2 s timeout, stderr ignored); `undefined` when git is unavailable. */
export function gitShortCommit(cwd = repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { cwd, encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

/** True when tracked files have uncommitted changes; `false` when git is unavailable. */
export function gitIsDirty(cwd = repoRoot) {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd, encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

const nonEmpty = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);

/** A CI or hosted build: `-dirty` is never appended there (DESIGN-M5-001 §4). */
export function isCiBuild(env) {
  return Boolean(nonEmpty(env.CI) || env.CF_PAGES === "1" || env.WORKERS_CI === "1" || env.GITHUB_ACTIONS === "true");
}

/** Same branch logic as `resolveBuildAllowUnpublished` in apps/web/vite.config.ts. */
export function resolveChannel(env) {
  if (env.CF_PAGES === "1" || env.WORKERS_CI === "1") {
    const prodBranch = nonEmpty(env.PRODUCTION_BRANCH) ?? "main";
    const branch = nonEmpty(env.CF_PAGES_BRANCH ?? env.WORKERS_CI_BRANCH);
    // A hosted build that does not name its branch is never labelled production.
    return branch === prodBranch ? "production" : "preview";
  }
  return "local";
}

/** `SOURCE_DATE_EPOCH` (seconds) when set, else `now`; ISO UTC truncated to the minute, e.g. `2026-11-10T08:15Z`. */
export function resolveBuiltAt(env, now = new Date()) {
  const epoch = nonEmpty(env.SOURCE_DATE_EPOCH);
  let date = now;
  if (epoch !== undefined) {
    if (!/^\d+$/.test(epoch)) throw new Error(`SOURCE_DATE_EPOCH must be an integer number of seconds, got "${epoch}"`);
    date = new Date(Number(epoch) * 1000);
  }
  if (Number.isNaN(date.getTime())) throw new Error("build time is not a valid date");
  return `${date.toISOString().slice(0, 16)}Z`;
}

/**
 * Commit precedence: `CF_PAGES_COMMIT_SHA` → `WORKERS_CI_COMMIT_SHA` → `GITHUB_SHA` → `git rev-parse` → `"unknown"`.
 * The first source present is truncated to 7 characters and must be lowercase hex, else `"unknown"`.
 * A local (non-CI) build from a dirty tree gets `-dirty` appended.
 */
export function resolveCommit(env, { gitCommit = gitShortCommit, gitDirty = gitIsDirty } = {}) {
  const fromEnv = nonEmpty(env.CF_PAGES_COMMIT_SHA) ?? nonEmpty(env.WORKERS_CI_COMMIT_SHA) ?? nonEmpty(env.GITHUB_SHA);
  const raw = fromEnv ?? nonEmpty(gitCommit());
  if (raw === undefined) return "unknown";
  const short = raw.toLowerCase().slice(0, 7);
  if (!SHORT_SHA.test(short)) return "unknown";
  if (fromEnv === undefined && !isCiBuild(env) && gitDirty()) return `${short}-dirty`;
  return short;
}

/**
 * Build identity injected as `__KY_NAY_BUILD__` (frozen WP1↔WP2 interface, DESIGN-M5-001 §10):
 * `{ version, commit, builtAt, channel }`.
 */
export function resolveBuildIdentity(env = process.env, options = {}) {
  const version = options.version ?? readRootVersion(options.root);
  if (typeof version !== "string" || !VERSION.test(version)) {
    throw new Error(`root package.json version must be semver (x.y.z[-pre]), got ${JSON.stringify(version)}`);
  }
  return {
    version,
    commit: resolveCommit(env, options),
    builtAt: resolveBuiltAt(env, options.now),
    channel: resolveChannel(env),
  };
}

/** Value of `<meta name="ky-nay-build">`: `<version>+<commit>` (read back by scripts/smoke-deploy.mjs). */
export function buildMetaContent(identity) {
  return `${identity.version}+${identity.commit}`;
}

/**
 * Validates `VITE_REPORT_ISSUE_URL` (ADR-0014 point 4). Unset or blank → `null` (copy-only UI).
 * Accepts an absolute `https:` URL, or `http:` only for localhost/127.0.0.1/[::1]; no userinfo, no whitespace or
 * control characters, at most 2048 characters. Anything else throws, so the build fails closed.
 * Returns the URL exactly as configured (trimmed): the app never adds a query or fragment.
 */
/** Committed default report link (B-05): apps/web/report-issue.config.json `url`, or null when absent. */
export function readDefaultReportUrl(root = repoRoot) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(root, "apps", "web", "report-issue.config.json"), "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw new Error(`report-issue.config.json is not valid JSON: ${error.message}`);
  }
  if (parsed === null || typeof parsed !== "object") throw new Error("report-issue.config.json must be an object");
  return parsed.url === undefined || parsed.url === null ? null : String(parsed.url);
}

/**
 * Report link for a build: a non-empty `VITE_REPORT_ISSUE_URL` wins, "off" disables the link, otherwise the
 * committed default is used. Both are validated by validateReportUrl (fail closed).
 */
export function resolveReportUrlSetting(envValue, defaultValue) {
  const fromEnv = typeof envValue === "string" ? envValue.trim() : "";
  if (fromEnv.toLowerCase() === "off") return null;
  return validateReportUrl(fromEnv !== "" ? fromEnv : defaultValue);
}

export function validateReportUrl(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("VITE_REPORT_ISSUE_URL must be a string");
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_REPORT_URL_LENGTH) throw new Error(`VITE_REPORT_ISSUE_URL is longer than ${MAX_REPORT_URL_LENGTH} characters`);
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) throw new Error("VITE_REPORT_ISSUE_URL must not contain whitespace or control characters");
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("VITE_REPORT_ISSUE_URL must be an absolute URL");
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new Error(`VITE_REPORT_ISSUE_URL must use https: (http: only for localhost), got ${url.protocol}`);
  }
  if (url.username !== "" || url.password !== "" || /^[a-z]+:\/\/[^/?#]*@/i.test(trimmed)) {
    throw new Error("VITE_REPORT_ISSUE_URL must not contain credentials (userinfo)");
  }
  if (url.hostname === "") throw new Error("VITE_REPORT_ISSUE_URL must name a host");
  return trimmed;
}
