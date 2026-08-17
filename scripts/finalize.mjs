/**
 * Post-build check. A Chrome extension fails in ways that are tedious to
 * debug (a missing file shows up as a blank panel), so the build refuses to
 * report success unless every file the manifest points at actually exists.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const manifestPath = resolve(dist, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('build: dist/manifest.json is missing — did the public/ directory get copied?');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const required = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...(manifest.content_scripts ?? []).flatMap((entry) => entry.js ?? []),
  ...Object.values(manifest.icons ?? {}),
  'src/panel/index.html',
].filter(Boolean);

const missing = required.filter((file) => !existsSync(resolve(dist, file)));
if (missing.length) {
  console.error('build: files referenced by the manifest are missing from dist:');
  for (const file of missing) console.error(`  - ${file}`);
  process.exit(1);
}

console.log(`build: ok — ${required.length} manifest entries verified in dist/`);
