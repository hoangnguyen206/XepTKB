import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readDefaultReportUrl,
  resolveReportUrlSetting,
  MAX_REPORT_URL_LENGTH,
  buildMetaContent,
  readRootVersion,
  resolveBuildIdentity,
  resolveBuiltAt,
  resolveChannel,
  resolveCommit,
  validateReportUrl,
} from "../lib/build-identity.mjs";
import { repoRoot } from "../lib/cli.mjs";

const noGit = { gitCommit: () => undefined, gitDirty: () => false };
const SHA_A = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

test("commit precedence: CF_PAGES_COMMIT_SHA → WORKERS_CI_COMMIT_SHA → GITHUB_SHA → git → unknown (M5-A)", () => {
  const git = { gitCommit: () => "d".repeat(7), gitDirty: () => false };
  assert.equal(resolveCommit({ CF_PAGES_COMMIT_SHA: SHA_A, WORKERS_CI_COMMIT_SHA: SHA_B, GITHUB_SHA: SHA_C }, git), "a1b2c3d");
  assert.equal(resolveCommit({ WORKERS_CI_COMMIT_SHA: SHA_B, GITHUB_SHA: SHA_C }, git), "bbbbbbb");
  assert.equal(resolveCommit({ GITHUB_SHA: SHA_C }, git), "ccccccc");
  assert.equal(resolveCommit({}, git), "ddddddd");
  assert.equal(resolveCommit({}, noGit), "unknown");
  // Blank values are skipped; uppercase is normalised; anything not hex becomes "unknown".
  assert.equal(resolveCommit({ CF_PAGES_COMMIT_SHA: "  ", GITHUB_SHA: SHA_A.toUpperCase() }, git), "a1b2c3d");
  assert.equal(resolveCommit({ GITHUB_SHA: "not-a-sha" }, git), "unknown");
  assert.equal(resolveCommit({ GITHUB_SHA: "abc" }, git), "unknown");
  assert.equal(resolveCommit({}, { gitCommit: () => "<script>", gitDirty: () => false }), "unknown");
});

test("-dirty is appended only for a local git build, never in CI or from env SHAs", () => {
  const dirtyGit = { gitCommit: () => "abcdef0", gitDirty: () => true };
  assert.equal(resolveCommit({}, dirtyGit), "abcdef0-dirty");
  assert.equal(resolveCommit({ CI: "true" }, dirtyGit), "abcdef0");
  assert.equal(resolveCommit({ GITHUB_ACTIONS: "true" }, dirtyGit), "abcdef0");
  assert.equal(resolveCommit({ CF_PAGES: "1" }, dirtyGit), "abcdef0");
  assert.equal(resolveCommit({ GITHUB_SHA: SHA_A }, dirtyGit), "a1b2c3d");
});

test("channel follows the resolveBuildAllowUnpublished branch logic", () => {
  assert.equal(resolveChannel({}), "local");
  assert.equal(resolveChannel({ CF_PAGES: "1", CF_PAGES_BRANCH: "main" }), "production");
  assert.equal(resolveChannel({ CF_PAGES: "1", CF_PAGES_BRANCH: "m5-release-hardening" }), "preview");
  assert.equal(resolveChannel({ CF_PAGES: "1", CF_PAGES_BRANCH: "release", PRODUCTION_BRANCH: "release" }), "production");
  assert.equal(resolveChannel({ CF_PAGES: "1", CF_PAGES_BRANCH: "main", PRODUCTION_BRANCH: "release" }), "preview");
  assert.equal(resolveChannel({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "main" }), "production");
  // A hosted build without a branch name is never production.
  assert.equal(resolveChannel({ CF_PAGES: "1" }), "preview");
  assert.equal(resolveChannel({ GITHUB_ACTIONS: "true" }), "local");
});

test("builtAt uses SOURCE_DATE_EPOCH when set, else the build start, as ISO UTC to the minute", () => {
  assert.equal(resolveBuiltAt({ SOURCE_DATE_EPOCH: "1762762500" }), "2025-11-10T08:15Z");
  assert.equal(resolveBuiltAt({}, new Date("2026-11-10T08:15:59.999Z")), "2026-11-10T08:15Z");
  assert.equal(resolveBuiltAt({ SOURCE_DATE_EPOCH: " " }, new Date("2026-01-02T03:04:05Z")), "2026-01-02T03:04Z");
  assert.throws(() => resolveBuiltAt({ SOURCE_DATE_EPOCH: "yesterday" }), /SOURCE_DATE_EPOCH/);
});

test("resolveBuildIdentity reads the root package.json version and returns the frozen WP1 shape", () => {
  const rootVersion = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
  assert.equal(readRootVersion(), rootVersion);
  const identity = resolveBuildIdentity({ GITHUB_SHA: SHA_A, SOURCE_DATE_EPOCH: "0" }, noGit);
  assert.deepEqual(identity, { version: rootVersion, commit: "a1b2c3d", builtAt: "1970-01-01T00:00Z", channel: "local" });
  assert.deepEqual(Object.keys(identity).sort(), ["builtAt", "channel", "commit", "version"]);
  assert.equal(buildMetaContent(identity), `${rootVersion}+a1b2c3d`);
  assert.equal(resolveBuildIdentity({}, { ...noGit, version: "0.1.0-rc.1" }).version, "0.1.0-rc.1");
  assert.throws(() => resolveBuildIdentity({}, { ...noGit, version: "v1" }), /semver/);
  assert.throws(() => resolveBuildIdentity({}, { ...noGit, version: '1.0.0"><script>' }), /semver/);
});

test("validateReportUrl accepts https (http only on loopback) and returns it unchanged (ADR-0014 point 4)", () => {
  assert.equal(validateReportUrl(undefined), null);
  assert.equal(validateReportUrl(""), null);
  assert.equal(validateReportUrl("   "), null);
  assert.equal(validateReportUrl("https://github.com/owner/repo/issues/new"), "https://github.com/owner/repo/issues/new");
  assert.equal(validateReportUrl("  https://forms.example.org/r  "), "https://forms.example.org/r");
  assert.equal(validateReportUrl("http://localhost:4380/report"), "http://localhost:4380/report");
  assert.equal(validateReportUrl("http://127.0.0.1/report"), "http://127.0.0.1/report");
  assert.equal(validateReportUrl("https://example.invalid/report"), "https://example.invalid/report");
});

test("validateReportUrl rejects javascript:, data:, relative, http non-localhost, userinfo and > 2048 chars", () => {
  const rejected = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "ftp://example.org/x",
    "/report",
    "report",
    "//evil.example/report",
    "http://example.org/report",
    "http://localhost.evil.example/report",
    "https://user:pass@example.org/report",
    "https://user@example.org/report",
    "https://exa mple.org/report",
    "https://example.org/\nreport",
    `https://example.org/${"a".repeat(MAX_REPORT_URL_LENGTH)}`,
  ];
  for (const value of rejected) assert.throws(() => validateReportUrl(value), Error, `expected ${JSON.stringify(value)} to be rejected`);
  // Exactly at the limit is fine.
  const atLimit = `https://example.org/${"a".repeat(MAX_REPORT_URL_LENGTH - "https://example.org/".length)}`;
  assert.equal(validateReportUrl(atLimit), atLimit);
});

test("committed default report URL is the Owner's https Google Form (B-05)", () => {
  const url = readDefaultReportUrl(repoRoot);
  assert.equal(url, "https://forms.gle/gk5TfaczQwg7kvXaA");
  assert.equal(new URL(url).protocol, "https:");
});

test("resolveReportUrlSetting: env wins, 'off' disables, empty env falls back to the default, both validated", () => {
  const fallback = "https://forms.gle/example";
  assert.equal(resolveReportUrlSetting(undefined, fallback), fallback);
  assert.equal(resolveReportUrlSetting("  ", fallback), fallback);
  assert.equal(resolveReportUrlSetting("https://example.invalid/report", fallback), "https://example.invalid/report");
  assert.equal(resolveReportUrlSetting("off", fallback), null);
  assert.equal(resolveReportUrlSetting("OFF", fallback), null);
  assert.equal(resolveReportUrlSetting(undefined, null), null);
  assert.throws(() => resolveReportUrlSetting("javascript:alert(1)", fallback), /https/);
  assert.throws(() => resolveReportUrlSetting(undefined, "http://example.com/form"), /https/);
});

test("readDefaultReportUrl returns null without a config file and fails closed on invalid JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "ky-nay-report-url-"));
  assert.equal(readDefaultReportUrl(root), null);
  mkdirSync(join(root, "apps", "web"), { recursive: true });
  writeFileSync(join(root, "apps", "web", "report-issue.config.json"), "{ not json");
  assert.throws(() => readDefaultReportUrl(root), /not valid JSON/);
  writeFileSync(join(root, "apps", "web", "report-issue.config.json"), JSON.stringify({ url: null }));
  assert.equal(readDefaultReportUrl(root), null);
});
