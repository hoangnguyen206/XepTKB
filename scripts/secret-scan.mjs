#!/usr/bin/env node
// M5-H secret scan (DESIGN-M5-001 §6, AC-M5-13). No dependencies, no third-party action: runs before `npm ci` in CI.
//   node scripts/secret-scan.mjs [--root <dir>] [--allowlist <file>]
// Scans every tracked file (`git ls-files`) that is text and at most 1 MiB, plus the tracked path names. Prints
// `file:line rule-id` with the matched value redacted; exits 1 on any finding that the allowlist does not cover.
// Allowlist entries are `{ path, rule, lineSha256, reason }`: the hash pins the exact line, so editing it re-triggers.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_ALLOWLIST = join(repoRoot, "scripts", "secret-scan-allowlist.json");
export const MAX_SCAN_BYTES = 1024 * 1024;
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".avif", ".bmp",
  ".pdf", ".zip", ".gz", ".tgz", ".7z",
  ".xlsx", ".xls", ".docx", ".pptx", ".odt", ".ods",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
]);

/** Content rules (rule id → pattern). Patterns are built so this file never matches itself. */
export const RULES = [
  { id: "private-key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { id: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}/ },
  { id: "npm-token", pattern: /npm_[A-Za-z0-9]{36}/ },
  { id: "slack-token", pattern: /xox[abprs]-[A-Za-z0-9-]{10,}/ },
  { id: "google-api-key", pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { id: "stripe-live", pattern: /sk_live_[0-9A-Za-z]{16,}/ },
  { id: "jwt", pattern: /eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/ },
  { id: "cloudflare-token-assignment", pattern: /(?:CF|CLOUDFLARE)_API_(?:TOKEN|KEY)\s*[:=]\s*\S{20,}/ },
  { id: "generic-secret-assignment", pattern: /(?:secret|passw(?:or)?d|token|api[_-]?key)\s*[:=]\s*["'][^"'\s]{16,}["']/i },
];
export const RULE_IDS = new Set([...RULES.map((rule) => rule.id), "forbidden-path"]);

export const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** Tracked `.env`, `.env.*` (except `*.example`), `*.pem` and `*.key` files are findings by name alone. */
export function isForbiddenPath(path) {
  const name = basename(path).toLowerCase();
  if (name === ".env") return true;
  if (name.startsWith(".env.") && !name.endsWith(".example")) return true;
  return name.endsWith(".pem") || name.endsWith(".key");
}

/** Findings in one text; each carries the line number and the SHA-256 of the line (for the allowlist). */
export function scanText(text, path) {
  const findings = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, "");
    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (match) findings.push({ path, line: index + 1, rule: rule.id, lineSha256: sha256(line), length: match[0].length });
    }
  }
  return findings;
}

/** Validates the allowlist JSON: an array of `{ path, rule, lineSha256, reason }`, reason required. */
export function parseAllowlist(value) {
  if (!Array.isArray(value)) throw new Error("allowlist must be a JSON array");
  return value.map((entry, index) => {
    const where = `allowlist[${index}]`;
    if (typeof entry !== "object" || entry === null) throw new Error(`${where} must be an object`);
    if (typeof entry.path !== "string" || entry.path === "") throw new Error(`${where}.path is required`);
    if (!RULE_IDS.has(entry.rule) || entry.rule === "forbidden-path") throw new Error(`${where}.rule must be a content rule id`);
    if (typeof entry.lineSha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.lineSha256)) throw new Error(`${where}.lineSha256 must be 64 lowercase hex characters`);
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 10) throw new Error(`${where}.reason is required (at least 10 characters)`);
    return entry;
  });
}

/** Splits findings into blocking ones and allowlisted ones; also returns allowlist entries that matched nothing. */
export function applyAllowlist(findings, allowlist) {
  const used = new Set();
  const blocking = [];
  const allowed = [];
  for (const finding of findings) {
    const index = allowlist.findIndex((entry) => entry.path === finding.path && entry.rule === finding.rule && entry.lineSha256 === finding.lineSha256);
    if (index >= 0) {
      used.add(index);
      allowed.push(finding);
    } else blocking.push(finding);
  }
  return { blocking, allowed, unused: allowlist.filter((_entry, index) => !used.has(index)) };
}

/** Tracked files of the repository at `root` (POSIX paths). */
export function gitTrackedFiles(root) {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\0").filter(Boolean);
}

/** Scans the given repository-relative files. Returns findings plus what was skipped and why. */
export function scanFiles(root, files) {
  const findings = [];
  const skipped = [];
  let scanned = 0;
  for (const path of files) {
    if (isForbiddenPath(path)) findings.push({ path, line: 0, rule: "forbidden-path", lineSha256: null, length: 0 });
    const full = join(root, path);
    if (!existsSync(full)) continue;
    const stat = lstatSync(full);
    if (!stat.isFile()) continue;
    if (BINARY_EXTENSIONS.has(extname(path).toLowerCase())) {
      skipped.push({ path, reason: "binary extension" });
      continue;
    }
    if (stat.size > MAX_SCAN_BYTES) {
      skipped.push({ path, reason: "larger than 1 MiB" });
      continue;
    }
    const bytes = readFileSync(full);
    if (bytes.includes(0)) {
      skipped.push({ path, reason: "binary (NUL byte)" });
      continue;
    }
    scanned += 1;
    findings.push(...scanText(bytes.toString("utf8"), path));
  }
  return { findings, skipped, scanned };
}

export function formatFinding(finding) {
  if (finding.rule === "forbidden-path") return `${finding.path}:0 forbidden-path (tracked secret-bearing file name)`;
  return `${finding.path}:${finding.line} ${finding.rule} [value redacted, ${finding.length} chars] lineSha256=${finding.lineSha256}`;
}

function parseCli(argv) {
  const options = { root: repoRoot, allowlist: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if ((name === "--root" || name === "--allowlist") && value) {
      options[name.slice(2)] = resolve(value);
      index += 1;
    } else throw new Error(`unknown argument ${name}`);
  }
  options.allowlist ??= options.root === repoRoot ? DEFAULT_ALLOWLIST : join(options.root, "scripts", "secret-scan-allowlist.json");
  return options;
}

/** Runs the whole scan; returns the process exit code. */
export function main(argv = process.argv.slice(2), log = console.log, error = console.error) {
  try {
    const options = parseCli(argv);
    const allowlist = existsSync(options.allowlist) ? parseAllowlist(JSON.parse(readFileSync(options.allowlist, "utf8"))) : [];
    const files = gitTrackedFiles(options.root);
    const { findings, skipped, scanned } = scanFiles(options.root, files);
    const { blocking, allowed, unused } = applyAllowlist(findings, allowlist);
    for (const item of skipped.filter((entry) => entry.reason === "larger than 1 MiB")) log(`secret-scan: skipped ${item.path} (${item.reason})`);
    for (const entry of unused) log(`secret-scan: warning: allowlist entry for ${entry.path} (${entry.rule}) matched nothing; remove it`);
    for (const finding of blocking) error(`secret-scan: ${formatFinding(finding)}`);
    log(`secret-scan: ${files.length} tracked file(s), ${scanned} scanned, ${skipped.length} skipped, ${allowed.length} allowlisted, ${blocking.length} finding(s)`);
    return blocking.length === 0 ? 0 : 1;
  } catch (caught) {
    error(`secret-scan: ${caught.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
