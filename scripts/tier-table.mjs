/**
 * The purchasing-power tier table, shared by the preset generators.
 *
 * It lives in `scripts/`, never in `src/`. Pinto itself ships no economic
 * classification of countries: this is a judgement about markets, it ages, and
 * it must never quietly become the default that prices someone's product. As a
 * generated preset it is the opposite — opt-in, visible in the Tiers editor,
 * and editable country by country before anything is written.
 *
 * Basis: World Bank income groupings and GNI per capita at PPP, adjusted for
 * observed app-store spend. A starting point to argue with, not a measurement.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const BANDS = {
  'T1 · Premium': `AE AT AU BE BH BM BN CA CH DE DK FI FR GB HK IE IL IS JP KR KW KY
                   LI LU NL NO NZ QA SE SG TW US`,
  'T2 · Established': `AG BB BS CL CY CZ EE ES GR HR IT LT LV MT OM PA PL PT SA SI SK TT UY`,
  'T3 · Upper-mid': `AL AM AR AZ BA BG BR BW BY CG CN CR DO GA GE HU IQ JM JO KZ LB LY
                     ME MK MU MX MY NA RO RS RU TH TR ZA`,
  'T4 · Lower-mid': `AO BO BT BZ CI CM CO DZ EC EG FJ GH GT GY HN HT ID KE KG LK MA MD
                     MN MV NG NI PE PG PH PS PY SN SR SV TJ TM TN UA UZ VE VN ZM ZW`,
  'T5 · Volume': `AF BD BF BJ CD ET GN IN KH LA MG ML MM MW MZ NE NP PK RW TD TG TZ UG YE`,
};

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
