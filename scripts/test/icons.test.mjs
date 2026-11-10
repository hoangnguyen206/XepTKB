import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICON_TARGETS, PUBLIC_DIR, maskableSvg, readPngSize } from "../generate-icons.mjs";

const WEB_DIR = join(PUBLIC_DIR, "..");

test("committed PNG icons are valid PNGs with the declared sizes (AC-M5-12)", () => {
  assert.deepEqual(
    ICON_TARGETS.map((icon) => [icon.path, icon.size]),
    [
      ["icons/icon-192.png", 192],
      ["icons/icon-512.png", 512],
      ["icons/icon-maskable-512.png", 512],
      ["icons/apple-touch-icon.png", 180],
    ],
  );
  for (const icon of ICON_TARGETS) {
    const bytes = readFileSync(join(PUBLIC_DIR, icon.path));
    assert.deepEqual(readPngSize(bytes), { width: icon.size, height: icon.size }, icon.path);
  }
});

test("manifest.webmanifest lists the PNGs with purpose any / maskable", () => {
  const manifest = JSON.parse(readFileSync(join(PUBLIC_DIR, "manifest.webmanifest"), "utf8"));
  const find = (src) => manifest.icons.find((icon) => icon.src === src);
  assert.deepEqual(find("icons/icon-192.png"), { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" });
  assert.deepEqual(find("icons/icon-512.png"), { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" });
  assert.deepEqual(find("icons/icon-maskable-512.png"), { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" });
  assert.ok(find("icon.svg"), "the SVG icon stays listed");
});

test("index.html links the 180×180 apple-touch-icon and the vite config precaches every icon", () => {
  const html = readFileSync(join(WEB_DIR, "index.html"), "utf8");
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png" sizes="180x180" \/>/);
  const config = readFileSync(join(WEB_DIR, "vite.config.ts"), "utf8");
  for (const icon of ICON_TARGETS) assert.ok(config.includes(`"${icon.path}"`), `PUBLIC_SHELL lacks ${icon.path}`);
});

test("maskableSvg makes the tile full-bleed and scales the glyph into the 80 % safe zone", () => {
  const svg = readFileSync(join(PUBLIC_DIR, "icon.svg"), "utf8");
  const maskable = maskableSvg(svg);
  assert.ok(!/rx="14"/.test(maskable), "no rounded tile");
  assert.match(maskable, /<rect width="64" height="64" fill="#0842a0"\/>/);
  assert.match(maskable, /transform="translate\(32 32\) scale\(0\.8\) translate\(-32 -32\)"/);
  // Glyph bounds 12..52 × 16..48 → scaled corners stay inside the safe circle (radius 0.4 × 64 around the centre).
  const corner = Math.hypot((52 - 32) * 0.8, (48 - 32) * 0.8);
  assert.ok(corner < 0.4 * 64, `glyph corner ${corner} outside the safe zone`);
  assert.throws(() => maskableSvg("<svg></svg>"), /changed shape/);
});

test("readPngSize rejects non-PNG bytes", () => {
  assert.throws(() => readPngSize(Buffer.from("GIF89a-not-a-png-at-all-really")), /not a PNG/);
});
