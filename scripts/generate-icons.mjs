#!/usr/bin/env node
// M5-G (DESIGN-M5-001 §2): renders apps/web/public/icon.svg into the PWA PNG icons with the Chromium that
// @playwright/test already installs. Run by hand (`npm run icons`) and commit the PNGs; CI never runs it.
//   any       → icons/icon-192.png, icons/icon-512.png (rounded tile, transparent corners)
//   maskable  → icons/icon-maskable-512.png, icons/apple-touch-icon.png (180) (full-bleed, glyph in the 80 % safe zone)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = join(repoRoot, "apps", "web", "public");

/** Every icon the app references; `path` is relative to apps/web/public (and to dist/). */
export const ICON_TARGETS = [
  { path: "icons/icon-192.png", size: 192, variant: "any" },
  { path: "icons/icon-512.png", size: 512, variant: "any" },
  { path: "icons/icon-maskable-512.png", size: 512, variant: "maskable" },
  { path: "icons/apple-touch-icon.png", size: 180, variant: "maskable" },
];

const TILE = '<rect width="64" height="64" rx="14" fill="#0842a0"/>';
const GLYPH_OPEN = '<g fill="#fff">';

/**
 * Maskable variant of icon.svg: the background tile loses its rounded corners (full bleed, the platform applies
 * its own mask) and the glyph is scaled to 80 % around the centre, so its corners stay inside the safe-zone
 * circle (radius 40 % of the icon). Throws if icon.svg no longer has the expected structure.
 */
export function maskableSvg(svg) {
  if (!svg.includes(TILE) || !svg.includes(GLYPH_OPEN)) {
    throw new Error("icon.svg changed shape: expected the 64×64 rounded tile and a white glyph group");
  }
  return svg
    .replace(TILE, '<rect width="64" height="64" fill="#0842a0"/>')
    .replace(GLYPH_OPEN, '<g fill="#fff" transform="translate(32 32) scale(0.8) translate(-32 -32)">');
}

/** Width/height from a PNG's IHDR chunk; throws if the bytes are not a PNG. */
export function readPngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((byte, index) => bytes[index] !== byte)) throw new Error("not a PNG file");
  if (bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("PNG does not start with an IHDR chunk");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function renderPng(page, svg, size) {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><img id="icon" alt="" width="${size}" height="${size}" style="display:block" src="${src}"></body></html>`);
  await page.waitForFunction(() => {
    const img = document.getElementById("icon");
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
  });
  return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** Renders every target into `outDir` (default apps/web/public). Returns the written paths with their sizes. */
export async function generateIcons({ publicDir = PUBLIC_DIR, outDir = publicDir } = {}) {
  const { chromium } = await import("@playwright/test");
  const anySvg = readFileSync(join(publicDir, "icon.svg"), "utf8");
  const variants = { any: anySvg, maskable: maskableSvg(anySvg) };
  const browser = await chromium.launch();
  const written = [];
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const target of ICON_TARGETS) {
      const png = await renderPng(page, variants[target.variant], target.size);
      const { width, height } = readPngSize(png);
      if (width !== target.size || height !== target.size) throw new Error(`${target.path}: rendered ${width}×${height}, expected ${target.size}`);
      const file = join(outDir, target.path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, png);
      written.push({ path: target.path, size: target.size, bytes: png.length });
    }
  } finally {
    await browser.close();
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outDir = process.argv[2] ? resolve(process.argv[2]) : PUBLIC_DIR;
  generateIcons({ outDir })
    .then((written) => {
      for (const item of written) console.log(`generate-icons: ${item.path} ${item.size}×${item.size} (${item.bytes} B)`);
    })
    .catch((error) => {
      console.error(`generate-icons: ${error.message}`);
      process.exit(1);
    });
}
