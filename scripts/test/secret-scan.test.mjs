import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyAllowlist, formatFinding, isForbiddenPath, main, parseAllowlist, scanFiles, scanText, sha256 } from "../secret-scan.mjs";

// Every sample token is assembled at run time, so this file never contains a literal that the scanner matches.
const cat = (...parts) => parts.join("");
const run = (n, ch) => ch.repeat(n);
const SAMPLES = {
  "private-key": cat("-----BEGIN ", "RSA ", "PRIVATE KEY-----"),
  "aws-access-key": cat("AK", "IA", run(16, "Q")),
  "github-token": cat("gh", "p_", run(36, "a")),
  "npm-token": cat("np", "m_", run(36, "b")),
  "slack-token": cat("xo", "xb-", "1234567890-abcdef"),
  "google-api-key": cat("AI", "za", run(35, "c")),
  "stripe-live": cat("sk", "_live_", run(24, "d")),
  jwt: cat("ey", "J", run(12, "e"), ".", "ey", "J", run(12, "f"), ".", run(12, "g")),
  "cloudflare-token-assignment": cat("CLOUDFLARE", "_API_TOKEN", "=", run(30, "h")),
  "generic-secret-assignment": cat("const apiKey", " = ", '"', run(20, "k"), '"'),
};

test("each rule fires on a synthetic sample and reports the line (AC-M5-13)", () => {
  for (const [rule, sample] of Object.entries(SAMPLES)) {
    const findings = scanText(`first line\n  ${sample}\n`, "x.txt");
    assert.ok(findings.some((finding) => finding.rule === rule && finding.line === 2), `${rule} did not fire: ${JSON.stringify(findings)}`);
  }
  assert.ok(scanText(cat("github", "_pat_", run(30, "Z")), "f").some((finding) => finding.rule === "github-token"));
  assert.ok(scanText(cat("PASSWORD", ": ", "'", run(16, "p"), "'"), "f").some((finding) => finding.rule === "generic-secret-assignment"));
});

test("ordinary code does not trigger the rules", () => {
  const benign = [
    'const token = "short";',
    "const password = process.env.DB_PASSWORD;",
    "apiKey: string;",
    "CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}",
    "https://example.org/AKIA-docs",
    'const sha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";',
  ].join("\n");
  assert.deepEqual(scanText(benign, "ok.ts"), []);
});

test("output redacts the matched value and carries the line hash", () => {
  const line = `  ${SAMPLES["aws-access-key"]}`;
  const [finding] = scanText(`${line}\n`, "config/app.ts");
  const text = formatFinding(finding);
  assert.match(text, /^config\/app\.ts:1 aws-access-key \[value redacted, 20 chars\] lineSha256=[0-9a-f]{64}$/);
  assert.ok(!text.includes(SAMPLES["aws-access-key"]), "secret value leaked into the output");
  assert.equal(finding.lineSha256, sha256(line));
});

test("forbidden paths: .env, .env.* (except *.example), *.pem, *.key", () => {
  for (const path of [".env", "apps/web/.env", ".env.local", ".env.production", "certs/site.pem", "deploy/id.key"]) assert.equal(isForbiddenPath(path), true, path);
  for (const path of [".env.example", ".env.local.example", "docs/env.md", "src/keyboard.ts", "keys.json"]) assert.equal(isForbiddenPath(path), false, path);
});

test("allowlist needs a reason and pins the exact line by hash", () => {
  const line = SAMPLES["slack-token"];
  const findings = scanText(`${line}\n`, "docs/example.md");
  const entry = { path: "docs/example.md", rule: "slack-token", lineSha256: sha256(line), reason: "Documented fake token for the incident runbook" };
  const allowlist = parseAllowlist([entry]);
  const result = applyAllowlist(findings, allowlist);
  assert.equal(result.blocking.length, 0);
  assert.equal(result.allowed.length, 1);
  assert.equal(result.unused.length, 0);

  // Editing the line changes its hash, so the finding comes back and the entry becomes unused.
  const edited = applyAllowlist(scanText(`${line}x\n`, "docs/example.md"), allowlist);
  assert.equal(edited.blocking.length, 1);
  assert.equal(edited.unused.length, 1);

  assert.throws(() => parseAllowlist([{ ...entry, reason: "" }]), /reason is required/);
  assert.throws(() => parseAllowlist([{ ...entry, reason: undefined }]), /reason is required/);
  assert.throws(() => parseAllowlist([{ ...entry, lineSha256: "abc" }]), /lineSha256/);
  assert.throws(() => parseAllowlist([{ ...entry, rule: "forbidden-path" }]), /content rule id/);
  assert.throws(() => parseAllowlist([{ ...entry, rule: "made-up" }]), /content rule id/);
  assert.throws(() => parseAllowlist({}), /JSON array/);
});

test("scanFiles skips binaries (extension or NUL byte) and files over 1 MiB, but flags forbidden names", () => {
  const dir = mkdtempSync(join(tmpdir(), "ky-nay-secret-scan-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "leak.ts"), `export const k = "${SAMPLES["npm-token"]}";\n`);
    writeFileSync(join(dir, "src", "clean.ts"), "export const ok = 1;\n");
    writeFileSync(join(dir, "image.png"), SAMPLES["npm-token"]);
    writeFileSync(join(dir, "blob.bin"), Buffer.concat([Buffer.from(SAMPLES["npm-token"]), Buffer.from([0, 1, 2])]));
    writeFileSync(join(dir, "big.txt"), `${"x".repeat(1024 * 1024)}\n${SAMPLES["npm-token"]}\n`);
    writeFileSync(join(dir, ".env.local"), "EMPTY=\n");
    const files = ["src/leak.ts", "src/clean.ts", "image.png", "blob.bin", "big.txt", ".env.local", "deleted.ts"];
    const { findings, skipped, scanned } = scanFiles(dir, files);
    assert.deepEqual(findings.map((finding) => `${finding.path}:${finding.rule}`).sort(), [".env.local:forbidden-path", "src/leak.ts:npm-token"]);
    assert.deepEqual(skipped.map((item) => `${item.path}:${item.reason}`).sort(), ["big.txt:larger than 1 MiB", "blob.bin:binary (NUL byte)", "image.png:binary extension"]);
    assert.equal(scanned, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the repository itself passes the scan (CLI exit code 0)", () => {
  const out = [];
  const err = [];
  const code = main([], (line) => out.push(line), (line) => err.push(line));
  assert.equal(code, 0, err.join("\n"));
  assert.match(out.join("\n"), /secret-scan: \d+ tracked file\(s\), \d+ scanned, \d+ skipped, \d+ allowlisted, 0 finding\(s\)/);
});
