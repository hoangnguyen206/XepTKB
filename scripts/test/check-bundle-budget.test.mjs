import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { DEFAULT_BUDGET_FILE, checkBundleBudget, initialAssetsFromHtml, parseBudget } from "../check-bundle-budget.mjs";
import { repoRoot } from "../lib/cli.mjs";

/** Deterministic, poorly compressible filler so gzip sizes are large enough to compare. */
const filler = (bytes, seed) => {
  let state = seed;
  let out = "";
  while (out.length < bytes) {
    state = (state * 1103515245 + 12345) % 2147483648;
    out += state.toString(36);
  }
  return `/*${out.slice(0, bytes)}*/`;
};

function makeDist({ html, assets }) {
  const dir = mkdtempSync(join(tmpdir(), "ky-nay-budget-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), html);
  for (const [name, content] of Object.entries(assets)) writeFileSync(join(dir, "assets", name), content);
  return dir;
}

const HTML_LAZY = `<!doctype html><html><head>
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<link rel="modulepreload" crossorigin href="./assets/vendor-def.js">
<link rel="stylesheet" crossorigin href="./assets/index-ghi.css">
</head><body></body></html>`;

const budget = (overrides = {}) =>
  parseBudget({
    initialJsGzipMax: 100_000,
    initialCssGzipMax: 10_000,
    totalJsGzipMax: 200_000,
    lazyChunkGzipMax: 100_000,
    requireLazyChunk: true,
    requireLazyChunkPrefix: "RegistrationImport-",
    initialForbiddenMarkers: [],
    ...overrides,
  });

test("initialAssetsFromHtml takes the module entry, modulepreloads and stylesheets only", () => {
  const html = `${HTML_LAZY}<script src="./assets/classic.js"></script><link rel="icon" href="./icon.svg"><link rel="modulepreload" href="https://cdn.example/x.js">`;
  assert.deepEqual([...initialAssetsFromHtml(html)].sort(), ["assets/index-abc.js", "assets/index-ghi.css", "assets/vendor-def.js"]);
});

test("classifies initial vs lazy chunks and reports raw + gzip(9) sizes (AC-M5-11)", () => {
  const entry = filler(30_000, 1);
  const dir = makeDist({
    html: HTML_LAZY,
    assets: {
      "index-abc.js": entry,
      "vendor-def.js": filler(20_000, 2),
      "index-ghi.css": "body{margin:0}",
      "RegistrationImport-xyz.js": filler(10_000, 3),
    },
  });
  try {
    const report = checkBundleBudget(dir, budget());
    assert.equal(report.ok, true, JSON.stringify(report.failures));
    const byFile = Object.fromEntries(report.files.map((file) => [file.file, file]));
    assert.equal(byFile["assets/index-abc.js"].initial, true);
    assert.equal(byFile["assets/vendor-def.js"].initial, true);
    assert.equal(byFile["assets/RegistrationImport-xyz.js"].initial, false);
    assert.equal(byFile["assets/index-abc.js"].raw, Buffer.byteLength(entry));
    assert.equal(byFile["assets/index-abc.js"].gzip, gzipSync(Buffer.from(entry), { level: 9 }).length);
    assert.equal(report.totals.totalJs.gzip, report.totals.initialJs.gzip + report.totals.lazyJs.gzip);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when a budget is exceeded, the registration chunk is initial, or a required lazy chunk is missing", () => {
  const dir = makeDist({
    html: HTML_LAZY,
    assets: { "index-abc.js": filler(30_000, 4), "vendor-def.js": filler(30_000, 5), "index-ghi.css": filler(5_000, 6), "RegistrationImport-xyz.js": filler(20_000, 7) },
  });
  try {
    const tight = checkBundleBudget(dir, budget({ initialJsGzipMax: 1_000, initialCssGzipMax: 100, totalJsGzipMax: 2_000, lazyChunkGzipMax: 500 }));
    assert.equal(tight.ok, false);
    for (const label of [/^initial JS /, /^initial CSS /, /^total JS /, /^lazy chunk assets\/RegistrationImport-xyz\.js /]) {
      assert.ok(tight.failures.some((failure) => label.test(failure)), `missing ${label} in ${JSON.stringify(tight.failures)}`);
    }
    // null disables a limit.
    const unlimited = checkBundleBudget(dir, budget({ initialJsGzipMax: null, initialCssGzipMax: null, totalJsGzipMax: null, lazyChunkGzipMax: null }));
    assert.equal(unlimited.ok, true, JSON.stringify(unlimited.failures));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const eager = makeDist({
    html: HTML_LAZY.replace("vendor-def.js", "RegistrationImport-def.js"),
    assets: { "index-abc.js": "export{}", "RegistrationImport-def.js": "export{}", "index-ghi.css": "a{}" },
  });
  try {
    const report = checkBundleBudget(eager, budget({ requireLazyChunk: false }));
    assert.equal(report.ok, false);
    assert.match(report.failures.join("\n"), /RegistrationImport-def\.js \(RegistrationImport-\*\) is in the initial set/);
  } finally {
    rmSync(eager, { recursive: true, force: true });
  }

  const single = makeDist({ html: HTML_LAZY.replace(/<link rel="modulepreload"[^>]*>/, ""), assets: { "index-abc.js": "export{}", "index-ghi.css": "a{}" } });
  try {
    assert.equal(checkBundleBudget(single, budget({ requireLazyChunk: false })).ok, true);
    const required = checkBundleBudget(single, budget({ requireLazyChunk: true }));
    assert.equal(required.ok, false);
    assert.match(required.failures.join("\n"), /no lazy chunk named RegistrationImport-\*/);
  } finally {
    rmSync(single, { recursive: true, force: true });
  }
});

test("forbidden markers in the initial chunk and dangling index.html references fail", () => {
  const dir = makeDist({ html: HTML_LAZY, assets: { "index-abc.js": 'const a="ky-nay-registration-marker";', "index-ghi.css": "a{}" } });
  try {
    const report = checkBundleBudget(dir, budget({ requireLazyChunk: false, initialForbiddenMarkers: ["ky-nay-registration-marker"] }));
    assert.equal(report.ok, false);
    assert.match(report.failures.join("\n"), /forbidden marker/);
    assert.match(report.failures.join("\n"), /missing asset\(s\): assets\/vendor-def\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseBudget validates the JSON and the committed scripts/bundle-budget.json is valid", () => {
  assert.throws(() => parseBudget([]), /JSON object/);
  assert.throws(() => parseBudget({ ...budget(), initialJsGzipMax: -1 }), /initialJsGzipMax/);
  assert.throws(() => parseBudget({ ...budget(), totalJsGzipMax: "150k" }), /totalJsGzipMax/);
  assert.throws(() => parseBudget({ ...budget(), requireLazyChunk: "yes" }), /requireLazyChunk/);
  assert.throws(() => parseBudget({ ...budget(), requireLazyChunkPrefix: "" }), /requireLazyChunkPrefix/);
  assert.throws(() => parseBudget({ ...budget(), initialForbiddenMarkers: [""] }), /initialForbiddenMarkers/);
  const committed = parseBudget(JSON.parse(readFileSync(DEFAULT_BUDGET_FILE, "utf8")));
  assert.equal(committed.requireLazyChunkPrefix, "RegistrationImport-");
});

test("CLI prints the table and JSON line and exits 1 over budget", () => {
  const dir = makeDist({ html: HTML_LAZY.replace(/<link rel="modulepreload"[^>]*>/, ""), assets: { "index-abc.js": filler(20_000, 8), "index-ghi.css": "a{}" } });
  const budgetFile = join(dir, "budget.json");
  try {
    writeFileSync(budgetFile, JSON.stringify(budget({ requireLazyChunk: false })));
    const pass = spawnSync(process.execPath, [join(repoRoot, "scripts", "check-bundle-budget.mjs"), dir, "--budget", budgetFile], { encoding: "utf8" });
    assert.equal(pass.status, 0, pass.stderr);
    assert.match(pass.stdout, /bundle-budget-json \{"ok":true/);
    assert.match(pass.stdout, /initial JS {2}\d+ B raw \/ \d+ B gzip/);
    writeFileSync(budgetFile, JSON.stringify(budget({ requireLazyChunk: false, initialJsGzipMax: 10 })));
    const fail = spawnSync(process.execPath, [join(repoRoot, "scripts", "check-bundle-budget.mjs"), dir, "--budget", budgetFile], { encoding: "utf8" });
    assert.equal(fail.status, 1);
    assert.match(fail.stderr, /FAIL initial JS/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
