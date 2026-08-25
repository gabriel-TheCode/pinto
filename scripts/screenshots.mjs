/**
 * Captures the panel for the README, using the real components.
 *
 * The harness under `screenshots/` renders the actual app against fixture data
 * with the Chrome APIs stubbed, so these are photographs of the shipping UI
 * rather than mockups that drift from it. Each shot is one page load driven by
 * a query parameter — no click scripting, and every image is reproducible.
 *
 * The harness raises `data-ready` once it has booted, posed the store and
 * painted, so the script waits on that rather than on a guessed delay.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/screenshots');
const port = 5179;
const base = `http://localhost:${port}`;

const SHOTS = [
  { file: 'pricing.png', query: '', height: 700 },
  { file: 'strategy-tiers.png', query: '?screen=strategy&strategy=tiers', height: 760 },
  { file: 'review.png', query: '?screen=review&strategy=tiers', height: 700 },
  { file: 'guide.png', query: '?screen=guide', height: 760 },
];

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
  throw new Error(`screenshot harness never came up on ${base}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch();

  for (const shot of SHOTS) {
    const page = await browser.newPage({
      // The panel's real docked width; 2x so the README image stays crisp.
      viewport: { width: 460, height: shot.height },
      deviceScaleFactor: 2,
    });
    await page.goto(`${base}/${shot.query}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-ready="true"]', { timeout: 15_000 });
    await page.screenshot({ path: resolve(outDir, shot.file) });
    await page.close();
    console.log(`screenshots: docs/screenshots/${shot.file}`);
  }

  await browser.close();
} finally {
  server.kill();
}
