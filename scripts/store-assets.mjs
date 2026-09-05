/**
 * Renders the Chrome Web Store listing images.
 *
 * The store's constraints are exact and it rejects silently on two of them, so
 * both are asserted here rather than eyeballed: the canvas must be precisely
 * 1280x800 (or 640x400) for a screenshot, 440x280 and 1400x560 for the promo
 * tiles, and the PNG must be 24-bit with no alpha channel.
 *
 * Chromium writes colour type 2 (RGB, no alpha) whenever the page paints an
 * opaque background, which every template here does. The check below reads the
 * IHDR back out of the file so a template that ever loses its background fails
 * the build instead of failing review weeks later.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/store');
const port = 5180;
const base = `http://localhost:${port}/store.html`;

const SCREENSHOT = { width: 1280, height: 800 };

const ASSETS = [
  { file: '01-pricing.png', query: '?asset=shot&shot=pricing', ...SCREENSHOT },
  { file: '02-tiers.png', query: '?asset=shot&shot=tiers', ...SCREENSHOT },
  { file: '03-review.png', query: '?asset=shot&shot=review', ...SCREENSHOT },
  { file: '04-history.png', query: '?asset=shot&shot=history', ...SCREENSHOT },
  { file: '05-guide.png', query: '?asset=shot&shot=guide', ...SCREENSHOT },
  { file: 'promo-small-440x280.png', query: '?asset=tile', width: 440, height: 280 },
  { file: 'promo-marquee-1400x560.png', query: '?asset=marquee', width: 1400, height: 560 },
];

/** Reads width, height, bit depth and colour type straight out of the IHDR. */
function inspectPng(path) {
  const buf = readFileSync(path);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(signature)) throw new Error(`${path}: not a PNG`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colourType: buf[25],
    bytes: buf.length,
  };
}

mkdirSync(outDir, { recursive: true });

const server = spawn(
  'npx',
  ['vite', '--config', 'vite.screenshots.config.ts', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`store-asset harness never came up on ${base}`);
}

const failures = [];

try {
  await waitForServer();
  const browser = await chromium.launch();

  for (const asset of ASSETS) {
    const page = await browser.newPage({
      viewport: { width: asset.width, height: asset.height },
      // The store wants the stated pixel dimensions exactly, so no retina
      // multiplier: a 2x shot of a 1280x800 canvas is a 2560x1600 file, which
      // is not one of the accepted sizes.
      deviceScaleFactor: 1,
    });
    await page.goto(`${base}${asset.query}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-ready="true"]', { timeout: 20_000 });
    const path = resolve(outDir, asset.file);
    await page.screenshot({ path });
    await page.close();

    const png = inspectPng(path);
    const problems = [];
    if (png.width !== asset.width || png.height !== asset.height) {
      problems.push(`is ${png.width}x${png.height}, expected ${asset.width}x${asset.height}`);
    }
    if (png.colourType !== 2) {
      problems.push(`colour type ${png.colourType}, expected 2 (24-bit RGB, no alpha)`);
    }
    if (png.bitDepth !== 8) problems.push(`bit depth ${png.bitDepth}, expected 8`);

    if (problems.length) {
      failures.push(`${asset.file}: ${problems.join('; ')}`);
      console.log(`store-assets: ✗ ${asset.file} — ${problems.join('; ')}`);
    } else {
      const kb = (png.bytes / 1024).toFixed(0);
      console.log(`store-assets: docs/store/${asset.file}  ${png.width}x${png.height}  ${kb} KB`);
    }
  }

  await browser.close();
} finally {
  server.kill();
}

if (failures.length) {
  console.error(`\nstore-assets: ${failures.length} asset(s) do not meet the store's rules.`);
  process.exit(1);
}
console.log(`\nstore-assets: ${ASSETS.length} files in docs/store — 24-bit RGB, no alpha.`);
