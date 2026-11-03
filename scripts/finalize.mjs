/**
 * Post-build check. A Chrome extension fails in ways that are tedious to
 * debug (a missing file shows up as a blank panel), so the build refuses to
 * report success unless every file the manifest points at actually exists.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

// Every __MSG_x__ in the manifest must exist in every locale, and the store
// rejects a description over 132 characters in any of them.
const localesDir = resolve(dist, '_locales');
const used = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((match) => match[1]);
const problems = [];
if (used.length && !existsSync(resolve(localesDir, manifest.default_locale ?? '', 'messages.json'))) {
  problems.push(`default_locale "${manifest.default_locale}" has no messages.json`);
}
if (existsSync(localesDir)) {
  for (const locale of readdirSync(localesDir)) {
    const messages = JSON.parse(readFileSync(resolve(localesDir, locale, 'messages.json'), 'utf8'));
    for (const key of used) {
      if (!messages[key]?.message) problems.push(`_locales/${locale}: missing "${key}"`);
    }
    const description = messages.extDescription?.message ?? '';
    if (description.length > 132) {
      problems.push(`_locales/${locale}: extDescription is ${description.length} characters (max 132)`);
    }
  }
}
if (problems.length) {
  console.error('build: manifest localisation problems:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`build: ok — ${required.length} manifest entries verified in dist/`);
