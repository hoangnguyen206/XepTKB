/**
 * Fixture runner — deterministic, offline harness for M1.
 * Reads a fixture directory containing manifest.json + input files,
 * runs each fixture through its declared adapter, and diffs the result
 * against `expected` from the manifest. Exit code 0 = all pass.
 *
 * Usage: node run-fixtures.js <fixturesDir> [--verbose]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { ParseIssue } from "@ky-nay/domain";
import { getAdapter } from "./registry.js";
import { FIXTURE_MANIFEST_VERSION, type FixtureEntry, type FixtureManifest } from "./fixture-manifest.js";

export type FixtureOutcome = {
  id: string;
  ok: boolean;
  mismatches: string[];
  issues: ParseIssue[];
};

function diffExpected(entry: FixtureEntry, counts: { sections: number; sessions: number; courses: number }, issues: ParseIssue[], inputSha256: string | undefined): string[] {
  const out: string[] = [];
  const e = entry.expected;
  if (e.inputSha256 !== undefined) {
    if (!inputSha256) out.push("inputSha256: fixture adapter did not provide a permitted source hash");
    else if (!/^[0-9a-f]{64}$/i.test(e.inputSha256)) out.push("inputSha256: malformed in manifest");
    else if (e.inputSha256.toLowerCase() !== inputSha256) out.push(`inputSha256: expected ${e.inputSha256}, got ${inputSha256}`);
  }
  if (e.sections !== undefined && e.sections !== counts.sections) out.push(`sections: expected ${e.sections}, got ${counts.sections}`);
  if (e.sessions !== undefined && e.sessions !== counts.sessions) out.push(`sessions: expected ${e.sessions}, got ${counts.sessions}`);
  if (e.courses !== undefined && e.courses !== counts.courses) out.push(`courses: expected ${e.courses}, got ${counts.courses}`);
  if (e.issueCodes) {
    const got = new Set(issues.map((i) => i.code));
    for (const c of e.issueCodes) if (!got.has(c)) out.push(`missing expected issue code ${c}`);
    for (const c of got) if (!e.issueCodes.includes(c)) out.push(`unexpected issue code ${c}`);
  }
  if (e.errorCodes) {
    const gotErrors = new Set(issues.filter((i) => i.severity === "error").map((i) => i.code));
    for (const c of e.errorCodes) if (!gotErrors.has(c)) out.push(`missing expected error code ${c}`);
  }
  return out;
}

export function runFixtures(fixturesDir: string, opts: { verbose?: boolean } = {}): { ok: boolean; outcomes: FixtureOutcome[] } {
  const manifestPath = join(fixturesDir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`no manifest.json in ${fixturesDir}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FixtureManifest;
  if (manifest.manifestVersion !== FIXTURE_MANIFEST_VERSION) {
    throw new Error(`unsupported manifestVersion ${manifest.manifestVersion} (expected ${FIXTURE_MANIFEST_VERSION})`);
  }

  const outcomes: FixtureOutcome[] = [];
  const fixtureRoot = resolve(dirname(manifestPath));
  for (const entry of manifest.fixtures) {
    const inputPath = resolve(fixtureRoot, entry.input);
    const pathFromRoot = relative(fixtureRoot, inputPath);
    if (isAbsolute(pathFromRoot) || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
      outcomes.push({ id: entry.id, ok: false, mismatches: [`input path escapes fixture directory: ${entry.input}`], issues: [] });
      continue;
    }
    const adapter = getAdapter(entry.adapter);
    if (!adapter) {
      outcomes.push({ id: entry.id, ok: false, mismatches: [`unknown adapter "${entry.adapter}"`], issues: [] });
      continue;
    }
    if (!existsSync(inputPath)) {
      outcomes.push({ id: entry.id, ok: false, mismatches: [`missing input file ${entry.input}`], issues: [] });
      continue;
    }
    const bytes = new Uint8Array(readFileSync(inputPath));
    const inputSha256 = entry.expected.inputSha256 === undefined
      ? undefined
      : createHash("sha256").update(bytes).digest("hex");
    const result = adapter.parse({ bytes, fileName: entry.input, localOnly: adapter.id === "vnu-registration-html", context: manifest.context });
    const counts = {
      sections: result.sections.length,
      sessions: result.sections.reduce((n, s) => n + s.sessions.length, 0),
      courses: result.courses.length,
    };
    const mismatches = diffExpected(entry, counts, result.issues, inputSha256);
    outcomes.push({ id: entry.id, ok: mismatches.length === 0, mismatches, issues: result.issues });
    if (opts.verbose) {
      const tag = mismatches.length === 0 ? "PASS" : "FAIL";
      console.log(`[${tag}] ${entry.id} (${entry.family}) — ${counts.sections} sections, ${counts.sessions} sessions, ${result.issues.length} issues`);
      for (const m of mismatches) console.log(`       ${m}`);
    }
  }
  return { ok: outcomes.every((o) => o.ok), outcomes };
}

/** CLI entry — returns exit code. */
export function main(argv: string[]): number {
  const dir = argv[2];
  if (!dir) {
    console.error("usage: run-fixtures <fixturesDir|fixturesRoot> [--verbose]");
    return 2;
  }
  const verbose = argv.includes("--verbose");
  try {
    // If <dir> itself has a manifest, run it; otherwise treat it as a root
    // containing one subdirectory per fixture family.
    const dirs = existsSync(join(dir, "manifest.json"))
      ? [dir]
      : listFixtureDirs(dir).filter((d) => existsSync(join(d, "manifest.json")));
    if (dirs.length === 0) {
      console.error(`fixtures: error — no manifest.json found in ${dir} or its subdirectories`);
      return 2;
    }
    let allOk = true;
    let pass = 0;
    let total = 0;
    for (const d of dirs) {
      const { ok, outcomes } = runFixtures(d, { verbose });
      allOk = allOk && ok;
      pass += outcomes.filter((o) => o.ok).length;
      total += outcomes.length;
      if (!ok) for (const o of outcomes.filter((o) => !o.ok)) console.log(`  FAIL ${o.id}: ${o.mismatches.join("; ")}`);
    }
    console.log(`fixtures: ${pass}/${total} passed`);
    return allOk ? 0 : 1;
  } catch (e) {
    console.error(`fixtures: error — ${(e as Error).message}`);
    return 2;
  }
}

export function listFixtureDirs(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(root, d.name));
}
