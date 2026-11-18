#!/usr/bin/env node
// M6-B (DESIGN-M6-001 §5, ADR-0015 point 4): copies the self-hosted Be Vietnam Pro files from the pinned
// devDependency `@fontsource/be-vietnam-pro` into apps/web/src/assets/fonts/, where Vite hashes them into the bundle
// (and so into the service-worker precache). The copies are committed; scripts/test/fonts.test.mjs checks that they
// match the installed package byte for byte and stay within `fontsMaxBytes` of scripts/bundle-budget.json.
//   npm run fonts:sync            copy (overwrite) the files
//   npm run fonts:sync -- --check exit 1 when the committed copies differ from node_modules
// Weights: 400 and 800 only. 600 was dropped because 6 files measured 101 632 B > 90 000 B (D-M6-12).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
export const FONT_PACKAGE = "@fontsource/be-vietnam-pro";
export const FONT_PACKAGE_DIR = join(repoRoot, "node_modules", "@fontsource", "be-vietnam-pro");
export const FONT_TARGET_DIR = join(repoRoot, "apps", "web", "src", "assets", "fonts");
export const FONT_SUBSETS = ["latin", "vietnamese"];
export const FONT_WEIGHTS = [400, 800];
export const FONT_FILES = FONT_SUBSETS.flatMap((subset) => FONT_WEIGHTS.map((weight) => `be-vietnam-pro-${subset}-${weight}-normal.woff2`));
export const LICENSE_FILE = "OFL.txt";

/** Source path in the installed package for each committed file name. */
export function sourceOf(name) {
  return name === LICENSE_FILE ? join(FONT_PACKAGE_DIR, "LICENSE") : join(FONT_PACKAGE_DIR, "files", name);
}

/** Names of committed files that differ from (or are missing in) the installed package, plus unexpected extras. */
export function compareWithPackage(targetDir = FONT_TARGET_DIR) {
  const problems = [];
  for (const name of [...FONT_FILES, LICENSE_FILE]) {
    const source = sourceOf(name);
    const target = join(targetDir, name);
    if (!existsSync(source)) problems.push(`${name}: missing in ${FONT_PACKAGE} (run npm ci)`);
    else if (!existsSync(target)) problems.push(`${name}: not committed in apps/web/src/assets/fonts`);
    else if (!readFileSync(source).equals(readFileSync(target))) problems.push(`${name}: differs from ${FONT_PACKAGE}`);
  }
  if (existsSync(targetDir)) {
    const expected = new Set([...FONT_FILES, LICENSE_FILE]);
    for (const name of readdirSync(targetDir)) if (!expected.has(name)) problems.push(`${name}: unexpected file in apps/web/src/assets/fonts`);
  }
  return problems;
}

export function syncFonts(targetDir = FONT_TARGET_DIR) {
  if (!existsSync(FONT_PACKAGE_DIR)) throw new Error(`${FONT_PACKAGE} is not installed (run npm ci)`);
  mkdirSync(targetDir, { recursive: true });
  for (const name of [...FONT_FILES, LICENSE_FILE]) copyFileSync(sourceOf(name), join(targetDir, name));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes("--check")) {
      const problems = compareWithPackage();
      if (problems.length > 0) {
        for (const problem of problems) console.error(`sync-fonts: ${problem}`);
        process.exit(1);
      }
      console.log(`sync-fonts: ${FONT_FILES.length} woff2 + ${LICENSE_FILE} match ${FONT_PACKAGE}`);
    } else {
      syncFonts();
      const version = JSON.parse(readFileSync(join(FONT_PACKAGE_DIR, "package.json"), "utf8")).version;
      console.log(`sync-fonts: copied ${FONT_FILES.length} woff2 + ${LICENSE_FILE} from ${FONT_PACKAGE}@${version}`);
    }
  } catch (error) {
    console.error(`sync-fonts: ${error.message}`);
    process.exit(1);
  }
}
