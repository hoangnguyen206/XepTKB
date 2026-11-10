#!/usr/bin/env node
// M5-H (DESIGN-M5-001 §6, AC-M5-13): chooses the git ref that `node scripts/dataset.mjs check --base <ref>` compares
// published datasets against in CI (SEC-M3-101e).
//   pull_request → origin/<base_ref>
//   push         → github.event.before when it is a 40-hex SHA, not all zeros, and present locally (fetch-depth 0)
//                  else HEAD~1 with a warning (new branch, force-push, shallow history)
// Inputs come from the environment (EVENT_NAME, PR_BASE_REF, PUSH_BEFORE) so no workflow expression is interpolated
// into shell code. Prints the chosen ref on stdout; warnings go to stderr as GitHub `::warning::` commands.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SHA40 = /^[0-9a-f]{40}$/;
const SAFE_BRANCH = /^(?!.*\.\.)(?!-)[A-Za-z0-9._/-]+$/;

/** `git cat-file -e <sha>^{commit}` succeeds. */
export function commitExists(sha, cwd = process.cwd()) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/** Pure choice of the base ref; `exists` is injected for tests. Returns `{ ref, warning? }`. */
export function chooseImmutabilityBase({ eventName, baseRef, before }, exists = commitExists) {
  if (eventName === "pull_request") {
    if (typeof baseRef !== "string" || !SAFE_BRANCH.test(baseRef)) throw new Error(`pull_request base ref is missing or unsafe: ${JSON.stringify(baseRef)}`);
    return { ref: `origin/${baseRef}` };
  }
  const sha = typeof before === "string" ? before.trim().toLowerCase() : "";
  if (sha === "") return { ref: "HEAD~1", warning: "push event has no 'before' SHA; comparing against HEAD~1" };
  if (!SHA40.test(sha)) return { ref: "HEAD~1", warning: "push 'before' is not a 40-hex SHA; comparing against HEAD~1" };
  if (/^0{40}$/.test(sha)) return { ref: "HEAD~1", warning: "push created a new branch (before = 40 zeros); comparing against HEAD~1" };
  if (!exists(sha)) return { ref: "HEAD~1", warning: `push 'before' ${sha.slice(0, 7)} is not in the local history (force-push?); comparing against HEAD~1` };
  return { ref: sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { ref, warning } = chooseImmutabilityBase({
      eventName: process.env.EVENT_NAME,
      baseRef: process.env.PR_BASE_REF,
      before: process.env.PUSH_BEFORE,
    });
    if (warning) console.error(`::warning::${warning}`);
    console.log(ref);
  } catch (error) {
    console.error(`ci-immutability-base: ${error.message}`);
    process.exit(1);
  }
}
