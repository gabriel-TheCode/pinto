/**
 * Preset-generator helpers.
 *
 * The band table itself lives in `src/domain/regions/economicBands.ts` — inside
 * the product, where the user can generate and edit a ladder directly. This
 * script parses it rather than keeping a second copy, so the presets shipped in
 * `presets/` can never drift from what the extension produces.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Reads the band definitions out of the domain module (single source of truth). */
function readBands() {
  const source = readFileSync(resolve(ROOT, 'src/domain/regions/economicBands.ts'), 'utf8');
  const bands = {};
  // Each band is `label: '...', blurb: '...', members: codes(`AA BB ...`)`.
  for (const match of source.matchAll(
    /label:\s*'([^']+)'[\s\S]*?members:\s*codes\(`([^`]+)`\)/g,
  )) {
    bands[match[1]] = match[2];
  }
  if (Object.keys(bands).length < 5) {
    throw new Error(`only parsed ${Object.keys(bands).length} bands — economicBands.ts changed`);
  }
  return bands;
}

export const BANDS = readBands();

/** Region codes Pinto knows about, read from the country table itself. */
export function knownCountries() {
  const source = readFileSync(resolve(ROOT, 'src/domain/regions/countries.ts'), 'utf8');
  const codes = new Set([...source.matchAll(/^\s*\['([A-Z]{2})',/gm)].map((match) => match[1]));
  if (codes.size < 100) {
    throw new Error(`only parsed ${codes.size} countries — the country table format changed`);
  }
  return codes;
}

/**
 * Builds the region -> tier map, refusing to return anything unless every
 * country is assigned exactly once. A silent gap would surface later as a
 * market that mysteriously never changes price.
 */
export function buildAssignment(tierNames = Object.keys(BANDS)) {
  const known = knownCountries();
  const assignment = {};
  const problems = [];

  for (const [band, members] of Object.entries(BANDS)) {
    if (!tierNames.includes(band)) continue;
    for (const code of members.split(/\s+/).filter(Boolean)) {
      if (!known.has(code)) problems.push(`${code} (in ${band}) is not a country Pinto knows`);
      else if (assignment[code]) problems.push(`${code} is in both ${assignment[code]} and ${band}`);
      else assignment[code] = band;
    }
  }
  for (const code of known) {
    if (!assignment[code]) problems.push(`${code} is not in any tier`);
  }

  if (problems.length) {
    throw new Error(`incomplete ladder:\n  - ${problems.join('\n  - ')}`);
  }
  return assignment;
}

/** Countries in a band that bill in a given currency, per the country table. */
export function bandMembersWithCurrency(band, currency) {
  const source = readFileSync(resolve(ROOT, 'src/domain/regions/countries.ts'), 'utf8');
  const currencyOf = new Map(
    [...source.matchAll(/^\s*\['([A-Z]{2})',\s*'[^']*',\s*'([A-Z]{3})'/gm)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  return BANDS[band]
    .split(/\s+/)
    .filter(Boolean)
    .filter((code) => currencyOf.get(code) === currency)
    .sort();
}

export const CHARM = { mode: 'charm', endings: [0.99, 0.49], zeroDecimalStep: 100 };

export function micros(units) {
  return Math.round(units * 1_000_000);
}
