#!/usr/bin/env node
// M5-I post-deploy smoke check (DESIGN-M5-001 §7, ADR-0014 point 2). Manual only: the Owner runs it after a preview or
// production deploy; CI never runs it against production.
//   node scripts/smoke-deploy.mjs <baseUrl> [--production] [--expect-commit <sha7>]
// Plain GET requests with no cookies, tokens or credentials. Refuses any base URL that is not https:, except
// http://localhost / 127.0.0.1 / [::1] (e.g. `vite preview`). Prints a PASS/FAIL table; exit 0 only if all pass.
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SHORT_SHA = /^[0-9a-f]{7}$/;
const ICONS = ["icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
const MAX_BODY_BYTES = 16 * 1024 * 1024;

/** Parses and checks the base URL; throws on anything but https: (or http: on a loopback host). */
export function parseBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`base URL is not an absolute URL: ${value}`);
  }
  if (url.username || url.password) throw new Error("base URL must not contain credentials");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error(`refusing ${url.protocol}// for ${url.hostname}: only https: (or http: on localhost) is allowed`);
  }
  if (url.search || url.hash) throw new Error("base URL must not carry a query or fragment");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

/** A relative artifact path from data/manifest.json that cannot leave data/ or the origin. */
const isSafeRelativePath = (path) =>
  typeof path === "string" && path !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith("/") && !path.includes("\\") && !path.split("/").some((part) => part === ".." || part === "." || part === "");

const headerIncludes = (headers, name, token) => (headers.get(name) ?? "").toLowerCase().includes(token.toLowerCase());

/**
 * Runs every check against `baseUrl`. `fetchImpl` defaults to the Node 22 global HTTP client.
 * Returns `{ ok, results: [{ check, ok, detail }] }`; never throws for a failing check.
 */
export async function runSmoke(baseUrl, { production = false, expectCommit, fetchImpl = globalThis.fetch } = {}) {
  const base = parseBaseUrl(String(baseUrl));
  if (expectCommit !== undefined && !SHORT_SHA.test(expectCommit)) throw new Error("--expect-commit must be 7 lowercase hex characters");
  const results = [];
  const record = (check, ok, detail = "") => results.push({ check, ok: Boolean(ok), detail });

  const get = async (path) => {
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new Error(`${path} resolves outside ${base.origin}`);
    const response = await fetchImpl(url, { method: "GET", redirect: "manual", credentials: "omit", cache: "no-store" });
    if (response.status >= 300 && response.status < 400) {
      return { status: response.status, headers: response.headers, bytes: Buffer.alloc(0), redirect: response.headers.get("location") ?? "?" };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_BODY_BYTES) throw new Error(`${path} is larger than ${MAX_BODY_BYTES} bytes`);
    return { status: response.status, headers: response.headers, bytes };
  };
  const step = async (check, fn) => {
    try {
      await fn();
    } catch (error) {
      record(check, false, error.message);
    }
  };
  const statusDetail = (res) => (res.redirect ? `HTTP ${res.status} redirect to ${res.redirect}` : `HTTP ${res.status}`);

  await step("GET / (shell)", async () => {
    const res = await get("./");
    record("GET / (shell)", res.status === 200 && headerIncludes(res.headers, "content-type", "text/html"), `${statusDetail(res)} ${res.headers.get("content-type") ?? ""}`.trim());
    const h = res.headers;
    const csp = h.get("content-security-policy") ?? "";
    record("header Content-Security-Policy", csp.includes("frame-ancestors 'none'") && csp.includes("connect-src 'self'"), csp ? "frame-ancestors 'none' + connect-src 'self'" : "missing");
    record("header X-Frame-Options", (h.get("x-frame-options") ?? "").toUpperCase() === "DENY", h.get("x-frame-options") ?? "missing");
    record("header X-Content-Type-Options", (h.get("x-content-type-options") ?? "").toLowerCase() === "nosniff", h.get("x-content-type-options") ?? "missing");
    record("header Referrer-Policy", (h.get("referrer-policy") ?? "").toLowerCase() === "no-referrer", h.get("referrer-policy") ?? "missing");
    record("header Strict-Transport-Security", /max-age=\d+/i.test(h.get("strict-transport-security") ?? ""), h.get("strict-transport-security") ?? "missing");
    record("header Permissions-Policy", headerIncludes(h, "permissions-policy", "camera=()"), h.get("permissions-policy") ?? "missing");

    const meta = /<meta\s+name="ky-nay-build"\s+content="([^"]+)"/.exec(res.bytes.toString("utf8"))?.[1];
    const commit = meta?.split("+")[1];
    if (!meta || !commit) {
      record("meta ky-nay-build", false, "missing");
    } else if (expectCommit !== undefined) {
      record("meta ky-nay-build", commit === expectCommit, `${meta} (expected commit ${expectCommit})`);
    } else if (production) {
      record("meta ky-nay-build", SHORT_SHA.test(commit), `${meta}${SHORT_SHA.test(commit) ? "" : " (production build must name a clean commit)"}`);
    } else {
      record("meta ky-nay-build", true, meta);
    }
  });

  await step("GET /sw.js", async () => {
    const res = await get("sw.js");
    record("GET /sw.js (Cache-Control no-cache)", res.status === 200 && headerIncludes(res.headers, "cache-control", "no-cache"), `${statusDetail(res)} cache-control=${res.headers.get("cache-control") ?? "missing"}`);
  });

  await step("GET /manifest.webmanifest", async () => {
    const res = await get("manifest.webmanifest");
    let parsed = false;
    try {
      JSON.parse(res.bytes.toString("utf8"));
      parsed = true;
    } catch {
      parsed = false;
    }
    record("GET /manifest.webmanifest", res.status === 200 && parsed, `${statusDetail(res)}${parsed ? "" : " (not JSON)"}`);
  });

  for (const icon of ICONS) {
    await step(`GET /${icon}`, async () => {
      const res = await get(icon);
      const isPng = res.bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      record(`GET /${icon}`, res.status === 200 && headerIncludes(res.headers, "content-type", "image/png") && isPng, `${statusDetail(res)} ${res.headers.get("content-type") ?? ""}`.trim());
    });
  }

  let manifest;
  await step("GET /data/manifest.json", async () => {
    const res = await get("data/manifest.json");
    const ok = res.status === 200 && headerIncludes(res.headers, "cache-control", "no-cache");
    try {
      manifest = JSON.parse(res.bytes.toString("utf8"));
    } catch {
      manifest = undefined;
    }
    const datasets = Array.isArray(manifest?.datasets) ? manifest.datasets : undefined;
    record("GET /data/manifest.json (no-cache)", ok && datasets !== undefined, `${statusDetail(res)} cache-control=${res.headers.get("cache-control") ?? "missing"} datasets=${datasets?.length ?? "invalid"}`);
    if (production && datasets) {
      const unpublished = datasets.filter((entry) => entry?.status !== "published" && entry?.status !== "retracted");
      record("production manifest has only published/retracted", unpublished.length === 0, unpublished.length === 0 ? `${datasets.length} dataset(s)` : `unpublished: ${unpublished.map((entry) => `${entry?.datasetVersion} (${entry?.status})`).join(", ")}`);
    }
  });

  const current = Array.isArray(manifest?.datasets) ? manifest.datasets.filter((entry) => entry?.status !== "retracted") : [];
  for (const entry of current) {
    for (const artifact of Array.isArray(entry.artifacts) ? entry.artifacts : []) {
      const check = `artifact ${entry.datasetVersion}/${artifact?.kind}`;
      await step(check, async () => {
        if (!isSafeRelativePath(artifact?.url)) throw new Error(`unsafe artifact url ${JSON.stringify(artifact?.url)}`);
        const res = await get(`data/${artifact.url}`);
        const digest = createHash("sha256").update(res.bytes).digest("hex");
        const ok = res.status === 200 && res.bytes.length === artifact.bytes && digest === artifact.sha256;
        record(check, ok, ok ? `${res.bytes.length} B sha256 ok` : `${statusDetail(res)} ${res.bytes.length} B (expected ${artifact.bytes}) sha256 ${digest === artifact.sha256 ? "ok" : "MISMATCH"}`);
      });
    }
  }

  return { ok: results.length > 0 && results.every((result) => result.ok), results };
}

export function formatResults(results) {
  const width = Math.max(...results.map((result) => result.check.length), 10);
  return results.map((result) => `${result.ok ? "PASS" : "FAIL"}  ${result.check.padEnd(width)}  ${result.detail}`).join("\n");
}

/** CLI argument parsing; throws on misuse. */
export function parseCli(argv, env = process.env) {
  const options = { production: false, expectCommit: undefined, baseUrl: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--production") options.production = true;
    else if (arg === "--expect-commit") {
      options.expectCommit = argv[index + 1];
      if (!options.expectCommit) throw new Error("--expect-commit needs a value");
      index += 1;
    } else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else if (options.baseUrl === undefined) options.baseUrl = arg;
    else throw new Error(`unexpected argument ${arg}`);
  }
  if (!options.baseUrl) throw new Error("usage: smoke-deploy.mjs <baseUrl> [--production] [--expect-commit <sha7>]");
  if (options.production && env.CI) throw new Error("--production is manual only and never runs in CI (ADR-0014)");
  parseBaseUrl(options.baseUrl);
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let options;
  try {
    options = parseCli(process.argv.slice(2));
  } catch (error) {
    console.error(`smoke-deploy: ${error.message}`);
    process.exit(2);
  }
  runSmoke(options.baseUrl, options)
    .then(({ ok, results }) => {
      console.log(formatResults(results));
      console.log(`smoke-deploy: ${ok ? "PASS" : "FAIL"} (${results.filter((result) => result.ok).length}/${results.length} checks) ${parseBaseUrl(options.baseUrl).origin}`);
      process.exitCode = ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(`smoke-deploy: ${error.message}`);
      process.exitCode = 1;
    });
}
