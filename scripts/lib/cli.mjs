// Shared helpers for the repository's Node scripts (test:real, dataset).
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Folders where a real source file may sit inside the repository (all git-ignored, M0 fixture policy). */
export const IGNORED_REAL_DIRS = ["fixtures/real", "fixtures/raw", "fixtures/private", "data/raw", "data/private"];

// `npm run` on Windows hands arguments over cmd.exe caret-escaped (`^C:\a^ b.xlsx^`); undo that, nothing else.
const unescapeCmd = (arg) => (process.platform === "win32" && arg.startsWith("^") ? arg.replace(/\^(.)/g, "$1").replace(/\^$/, "") : arg);

/** `--name value` options (repeatable ones collected in arrays) and the remaining positional arguments. */
export function parseArgs(argv, repeatable = []) {
  const args = argv.map(unescapeCmd);
  const options = {};
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`option --${name} needs a value`);
    index += 1;
    if (repeatable.includes(name)) (options[name] ??= []).push(value);
    else options[name] = value;
  }
  return { options, positional };
}

/** Real source files never enter the repository (M0 fixture policy, ADR-0007 §2). */
export function assertOutsideRepo(file) {
  const path = resolve(file);
  const inRepo = relative(repoRoot, path);
  const inside = !inRepo.startsWith("..") && !isAbsolute(inRepo);
  if (inside && !IGNORED_REAL_DIRS.some((dir) => inRepo.split(sep).join("/").startsWith(`${dir}/`))) {
    throw new Error(`${file} is inside the repository. Keep real files outside it or under ${IGNORED_REAL_DIRS.join(", ")}.`);
  }
  return path;
}
