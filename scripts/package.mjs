/**
 * Produces the ZIP uploaded to the Chrome Web Store.
 *
 * The build output is zipped as-is, source maps included. Shipping them is
 * deliberate: Chrome Web Store review reads the code, and a minified bundle
 * with no way back to its sources is a common cause of review delays and
 * rejections. They cost a little size and buy a reviewable submission.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

if (!existsSync(resolve(dist, 'manifest.json'))) {
  console.error('package: dist/ is missing or unbuilt — run `npm run build` first');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'));
const outDir = resolve(root, 'release');
const zipPath = resolve(outDir, `pinto-${manifest.version}.zip`);

mkdirSync(outDir, { recursive: true });
rmSync(zipPath, { force: true });

// Zip from inside dist/ so manifest.json sits at the archive root, which the
// Web Store requires — a nested folder is rejected on upload.
execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: dist });

const size = execFileSync('du', ['-h', zipPath]).toString().split('\t')[0];
console.log(`package: ${zipPath.replace(`${root}/`, '')} (${size.trim()})`);
console.log(`  name    ${manifest.name}`);
console.log(`  version ${manifest.version}`);
console.log(`  upload at https://chrome.google.com/webstore/devconsole`);
