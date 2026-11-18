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

test("M6: woff2 bytes count against fontsMaxBytes; other font formats and data: fonts in CSS fail (D-M6-6, D-M6-12)", () => {
  const woff2 = (bytes) => Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(bytes - 4, 7)]);
  const assets = {
    "index-abc.js": "export{}",
    "index-ghi.css": "@font-face{font-family:x;src:url(./be-a.woff2)format(\"woff2\")}",
    "be-a.woff2": woff2(40_000),
    "be-b.woff2": woff2(30_000),
  };
  const html = HTML_LAZY.replace(/<link rel="modulepreload"[^>]*>/, "");
  const dir = makeDist({ html, assets });
  try {
    const ok = checkBundleBudget(dir, budget({ requireLazyChunk: false, fontsMaxBytes: 70_000 }));
    assert.equal(ok.ok, true, JSON.stringify(ok.failures));
    assert.deepEqual(ok.totals.fonts, { raw: 70_000, count: 2 });
    assert.deepEqual(ok.fonts.map((font) => font.file), ["assets/be-a.woff2", "assets/be-b.woff2"]);
    const over = checkBundleBudget(dir, budget({ requireLazyChunk: false, fontsMaxBytes: 69_999 }));
    assert.equal(over.ok, false);
    assert.match(over.failures.join("\n"), /^fonts 70000 B raw woff2 > budget 69999 B$/m);
    // Absent fontsMaxBytes → not enforced.
    assert.equal(checkBundleBudget(dir, budget({ requireLazyChunk: false })).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const legacy = makeDist({ html, assets: { ...assets, "be-a.woff": "x", "be-c.ttf": "x" } });
  try {
    const report = checkBundleBudget(legacy, budget({ requireLazyChunk: false }));
    assert.equal(report.ok, false);
    assert.match(report.failures.join("\n"), /assets\/be-a\.woff: only woff2 fonts are allowed/);
    assert.match(report.failures.join("\n"), /assets\/be-c\.ttf: only woff2 fonts are allowed/);
  } finally {
    rmSync(legacy, { recursive: true, force: true });
  }

  for (const css of [
    '@font-face{src:url(data:font/woff2;base64,d09GMg==)format("woff2")}',
    "@font-face{src:url( 'data:application/font-woff2;base64,AA==')}",
    '@font-face{src:url("data:application/x-font-ttf;base64,AA==")}',
  ]) {
    const inline = makeDist({ html, assets: { "index-abc.js": "export{}", "index-ghi.css": css } });
    try {
      const report = checkBundleBudget(inline, budget({ requireLazyChunk: false }));
      assert.equal(report.ok, false, css);
      assert.match(report.failures.join("\n"), /inlines a font as url\(data:/);
    } finally {
      rmSync(inline, { recursive: true, force: true });
    }
  }
  // An SVG data: image is not a font.
  const svg = makeDist({ html, assets: { "index-abc.js": "export{}", "index-ghi.css": "a{background:url(data:image/svg+xml,%3Csvg%3E)}" } });
  try {
    assert.equal(checkBundleBudget(svg, budget({ requireLazyChunk: false })).ok, true);
  } finally {
    rmSync(svg, { recursive: true, force: true });
  }
});

test("M6: requireSingleCss demands exactly one CSS file in dist/assets and that index.html loads it", () => {
  const html = HTML_LAZY.replace(/<link rel="modulepreload"[^>]*>/, "");
  const two = makeDist({ html, assets: { "index-abc.js": "export{}", "index-ghi.css": "a{}", "RegistrationImport-x.css": "b{}" } });
  try {
    const report = checkBundleBudget(two, budget({ requireLazyChunk: false, requireSingleCss: true }));
    assert.equal(report.ok, false);
    assert.match(report.failures.join("\n"), /expected exactly one CSS file in dist\/assets, found 2/);
    assert.match(report.failures.join("\n"), /assets\/RegistrationImport-x\.css is not loaded by index\.html/);
    assert.equal(checkBundleBudget(two, budget({ requireLazyChunk: false })).ok, true, "not enforced unless requireSingleCss");
  } finally {
    rmSync(two, { recursive: true, force: true });
  }
  const none = makeDist({ html: html.replace(/<link rel="stylesheet"[^>]*>/, ""), assets: { "index-abc.js": "export{}" } });
  try {
    const report = checkBundleBudget(none, budget({ requireLazyChunk: false, requireSingleCss: true }));
    assert.match(report.failures.join("\n"), /found 0/);
  } finally {
    rmSync(none, { recursive: true, force: true });
  }
  const one = makeDist({ html, assets: { "index-abc.js": "export{}", "index-ghi.css": "a{}" } });
  try {
    assert.equal(checkBundleBudget(one, budget({ requireLazyChunk: false, requireSingleCss: true })).ok, true);
  } finally {
    rmSync(one, { recursive: true, force: true });
  }
});

test("M6: the committed budget enforces CSS ≤ 12 KiB, fonts ≤ 90 000 B, a single CSS file and keeps JS ≤ 117 KiB (D-M6-6)", () => {
  const committed = parseBudget(JSON.parse(readFileSync(DEFAULT_BUDGET_FILE, "utf8")));
  assert.equal(committed.initialCssGzipMax, 12 * 1024);
  assert.equal(committed.initialJsGzipMax, 117 * 1024);
  assert.equal(committed.fontsMaxBytes, 90_000);
  assert.equal(committed.requireSingleCss, true);
  assert.equal(committed.requireLazyChunk, true);
  assert.throws(() => parseBudget({ ...committed, fontsMaxBytes: 0 }), /fontsMaxBytes/);
  assert.throws(() => parseBudget({ ...committed, requireSingleCss: "yes" }), /requireSingleCss/);
});
