import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { parseBaseUrl, parseCli, runSmoke } from "../smoke-deploy.mjs";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};
const ARTIFACT = Buffer.from('{"datasetVersion":"uet-2026-2027-h1-r1"}');

/** A tiny static host shaped like the Pages deployment; `mutate` tweaks routes per test. */
function site(mutate = (routes) => routes) {
  const manifest = {
    schemaVersion: "1.0",
    datasets: [
      {
        datasetVersion: "uet-2026-2027-h1-r1",
        status: "published",
        artifacts: [{ kind: "timetable", url: "schools/uet/timetable.json", bytes: ARTIFACT.length, sha256: createHash("sha256").update(ARTIFACT).digest("hex") }],
      },
    ],
  };
  const routes = mutate({
    "/": { type: "text/html", body: '<!doctype html><meta name="ky-nay-build" content="0.1.0+abcdef1" />', headers: SECURITY_HEADERS },
    "/sw.js": { type: "text/javascript", body: "/* sw */", headers: { "cache-control": "no-cache" } },
    "/manifest.webmanifest": { type: "application/manifest+json", body: "{}" },
    "/icons/icon-192.png": { type: "image/png", body: PNG },
    "/icons/icon-512.png": { type: "image/png", body: PNG },
    "/icons/icon-maskable-512.png": { type: "image/png", body: PNG },
    "/icons/apple-touch-icon.png": { type: "image/png", body: PNG },
    "/data/manifest.json": { type: "application/json", body: JSON.stringify(manifest), headers: { "cache-control": "no-cache" } },
    "/data/schools/uet/timetable.json": { type: "application/json", body: ARTIFACT },
    manifest,
  });
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization });
    const route = routes[new URL(req.url, "http://localhost").pathname];
    if (!route || route.status === 404) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(route.status ?? 200, { "content-type": route.type, ...(route.headers ?? {}) });
    res.end(route.body);
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => resolveServer({ base: `http://127.0.0.1:${server.address().port}/`, seen, close: () => new Promise((done) => server.close(done)) }));
  });
}

const failed = (result) => result.results.filter((item) => !item.ok).map((item) => item.check);

test("passes against a well-formed deployment and sends only plain GETs without cookies or tokens", async () => {
  const host = await site();
  try {
    const result = await runSmoke(host.base, { production: true, expectCommit: "abcdef1" });
    assert.deepEqual(failed(result), []);
    assert.equal(result.ok, true);
    assert.ok(result.results.some((item) => item.check === "artifact uet-2026-2027-h1-r1/timetable" && item.ok));
    assert.ok(host.seen.length >= 9);
    for (const request of host.seen) {
      assert.equal(request.method, "GET");
      assert.equal(request.cookie, undefined);
      assert.equal(request.authorization, undefined);
    }
  } finally {
    await host.close();
  }
});

test("fails when CSP is missing, the build commit differs or an artifact hash does not match", async () => {
  const host = await site((routes) => {
    const { "content-security-policy": _csp, ...rest } = SECURITY_HEADERS;
    routes["/"] = { ...routes["/"], headers: rest };
    routes["/data/schools/uet/timetable.json"] = { type: "application/json", body: Buffer.from('{"datasetVersion":"tampered-r1"}') };
    return routes;
  });
  try {
    const result = await runSmoke(host.base, { expectCommit: "1234567" });
    assert.equal(result.ok, false);
    assert.deepEqual(failed(result).sort(), ["artifact uet-2026-2027-h1-r1/timetable", "header Content-Security-Policy", "meta ky-nay-build"]);
  } finally {
    await host.close();
  }
});

test("--production rejects candidate datasets, missing no-cache and unknown/dirty builds", async () => {
  const host = await site((routes) => {
    routes.manifest.datasets[0].status = "candidate";
    routes["/data/manifest.json"] = { type: "application/json", body: JSON.stringify(routes.manifest) };
    routes["/"] = { ...routes["/"], body: '<meta name="ky-nay-build" content="0.1.0+abcdef1-dirty" />' };
    return routes;
  });
  try {
    const preview = await runSmoke(host.base);
    assert.deepEqual(failed(preview), ["GET /data/manifest.json (no-cache)"]);
    const production = await runSmoke(host.base, { production: true });
    assert.deepEqual(failed(production).sort(), ["GET /data/manifest.json (no-cache)", "meta ky-nay-build", "production manifest has only published/retracted"]);
  } finally {
    await host.close();
  }
});

test("missing icons, redirects and unsafe artifact URLs fail without leaving the origin", async () => {
  const host = await site((routes) => {
    routes["/icons/icon-512.png"] = { status: 404 };
    routes["/sw.js"] = { status: 302, type: "text/plain", body: "", headers: { location: "https://evil.example/sw.js", "cache-control": "no-cache" } };
    routes.manifest.datasets[0].artifacts[0].url = "../../etc/passwd";
    routes["/data/manifest.json"] = { ...routes["/data/manifest.json"], body: JSON.stringify(routes.manifest) };
    return routes;
  });
  try {
    const result = await runSmoke(host.base);
    assert.deepEqual(failed(result).sort(), ["GET /icons/icon-512.png", "GET /sw.js (Cache-Control no-cache)", "artifact uet-2026-2027-h1-r1/timetable"]);
    assert.ok(host.seen.every((request) => !request.url.includes("..") && !request.url.includes("passwd")));
  } finally {
    await host.close();
  }
});

test("refuses non-https base URLs except loopback, credentials and CI production runs", () => {
  for (const bad of ["http://example.org/", "ftp://example.org/", "file:///tmp/x", "javascript:alert(1)", "https://user:pw@example.org/", "https://example.org/?q=1", "not a url"]) {
    assert.throws(() => parseBaseUrl(bad), Error, bad);
  }
  assert.equal(parseBaseUrl("https://ky-nay.pages.dev").href, "https://ky-nay.pages.dev/");
  assert.equal(parseBaseUrl("http://localhost:4173").href, "http://localhost:4173/");
  assert.equal(parseBaseUrl("http://127.0.0.1:4173/sub").href, "http://127.0.0.1:4173/sub/");
  assert.throws(() => parseCli(["http://example.org/"], {}), /refusing http:/);
  assert.throws(() => parseCli(["https://ky-nay.pages.dev/", "--production"], { CI: "true" }), /never runs in CI/);
  assert.throws(() => parseCli([], {}), /usage/);
  assert.deepEqual(parseCli(["https://ky-nay.pages.dev/", "--production", "--expect-commit", "abcdef1"], {}), {
    production: true,
    expectCommit: "abcdef1",
    baseUrl: "https://ky-nay.pages.dev/",
  });
});

test("rejects a malformed --expect-commit", async () => {
  await assert.rejects(() => runSmoke("http://localhost:1/", { expectCommit: "ABC" }), /7 lowercase hex/);
});
