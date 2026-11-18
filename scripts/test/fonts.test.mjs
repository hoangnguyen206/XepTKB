import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_BUDGET_FILE, parseBudget } from "../check-bundle-budget.mjs";
import { repoRoot } from "../lib/cli.mjs";
import { FONT_FILES, FONT_PACKAGE, FONT_PACKAGE_DIR, FONT_TARGET_DIR, LICENSE_FILE, compareWithPackage } from "../sync-fonts.mjs";

// M6-B (DESIGN-M6-001 §5, AC-M6-02, D-M6-12): the committed self-hosted fonts are exactly the pinned package's files.

test("exactly 4 woff2 files (latin + vietnamese × 400/800) and OFL.txt are committed", () => {
  assert.deepEqual(FONT_FILES, [
    "be-vietnam-pro-latin-400-normal.woff2",
    "be-vietnam-pro-latin-800-normal.woff2",
    "be-vietnam-pro-vietnamese-400-normal.woff2",
    "be-vietnam-pro-vietnamese-800-normal.woff2",
  ]);
  assert.deepEqual(readdirSync(FONT_TARGET_DIR).sort(), [...FONT_FILES, LICENSE_FILE].sort());
  for (const name of FONT_FILES) {
    const bytes = readFileSync(join(FONT_TARGET_DIR, name));
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", `${name} is not a woff2 file`);
  }
});

test("total woff2 size stays within fontsMaxBytes of scripts/bundle-budget.json", () => {
  const budget = parseBudget(JSON.parse(readFileSync(DEFAULT_BUDGET_FILE, "utf8")));
  assert.equal(budget.fontsMaxBytes, 90_000);
  const total = FONT_FILES.reduce((sum, name) => sum + statSync(join(FONT_TARGET_DIR, name)).size, 0);
  assert.ok(total <= budget.fontsMaxBytes, `fonts ${total} B > fontsMaxBytes ${budget.fontsMaxBytes} B`);
});

test("the font devDependency is pinned exactly and the committed files match node_modules byte for byte", (t) => {
  const web = JSON.parse(readFileSync(join(repoRoot, "apps", "web", "package.json"), "utf8"));
  const pinned = web.devDependencies?.[FONT_PACKAGE];
  assert.match(pinned ?? "", /^\d+\.\d+\.\d+$/, `${FONT_PACKAGE} must be pinned to an exact version`);
  assert.equal(web.dependencies?.[FONT_PACKAGE], undefined, "the font package must not be a runtime dependency");
  if (!existsSync(FONT_PACKAGE_DIR)) {
    t.skip(`${FONT_PACKAGE} not installed`);
    return;
  }
  assert.equal(JSON.parse(readFileSync(join(FONT_PACKAGE_DIR, "package.json"), "utf8")).version, pinned);
  assert.deepEqual(compareWithPackage(), []);
});

test("apps/web/public/licenses.txt carries the font OFL verbatim and the Lucide ISC / Feather MIT notices", () => {
  const licenses = readFileSync(join(repoRoot, "apps", "web", "public", "licenses.txt"), "utf8");
  assert.ok(licenses.includes(readFileSync(join(FONT_TARGET_DIR, LICENSE_FILE), "utf8")), "OFL.txt is not included verbatim");
  assert.match(licenses, /SIL Open Font License, Version 1\.1/);
  assert.match(licenses, /^ISC License$/m);
  assert.match(licenses, /derived from the Feather project/);
  assert.match(licenses, /The MIT License \(MIT\)/);
  assert.ok(![...licenses].some((char) => char.charCodeAt(0) > 127), "licenses.txt must stay ASCII-only (served without a charset)");
});
