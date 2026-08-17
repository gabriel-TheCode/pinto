import type { Continent, Country, RegionCode } from '@/types';
import { COUNTRIES, getCountry } from './countries';

export interface RegionGroup {
  id: string;
  label: string;
  /** Where the grouping comes from, so the UI can explain itself. */
  kind: 'continent' | 'subregion' | 'currency' | 'custom';
  description?: string;
  members: RegionCode[];
}

export interface CustomGroup {
  id: string;
  label: string;
  members: RegionCode[];
  createdAt: number;
}

function group(
  id: string,
  label: string,
  kind: RegionGroup['kind'],
  members: RegionCode[],
  description?: string,
): RegionGroup {
  return { id, label, kind, members, description };
}

/**
 * Built-in groupings are purely geographic or currency based. Pinto
 * deliberately ships no built-in "rich / poor market" classification: any
 * economic tiering is something the user defines explicitly in the Tiers
 * strategy, where the numbers are visible and editable.
 */
export function builtInGroups(): RegionGroup[] {
  const byContinent = new Map<Continent, RegionCode[]>();
  const bySubregion = new Map<string, RegionCode[]>();
  const byCurrency = new Map<string, RegionCode[]>();

  for (const c of COUNTRIES) {
    push(byContinent, c.continent, c.code);
    push(bySubregion, c.subregion, c.code);
    push(byCurrency, c.defaultCurrency, c.code);
  }

  const groups: RegionGroup[] = [];
  for (const [continent, members] of byContinent) {
    groups.push(group(`continent:${continent}`, continent, 'continent', members));
  }
  for (const [subregion, members] of bySubregion) {
    groups.push(group(`subregion:${subregion}`, subregion, 'subregion', members));
  }
  for (const [currency, members] of byCurrency) {
    if (members.length < 2) continue;
    groups.push(
      group(
        `currency:${currency}`,
        `${currency} markets`,
        'currency',
        members,
        `Countries whose Play billing currency is normally ${currency}.`,
      ),
    );
  }
  return groups;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export interface CountryFilter {
  query?: string;
  continents?: Continent[];
  subregions?: string[];
  currencies?: string[];
  /** Restrict to these region codes (e.g. the regions the product supports). */
  restrictTo?: RegionCode[] | null;
}

/** Normalises accents so "Turkiye" matches "Türkiye" and "cote" matches "Côte". */
export function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim();
}

export function filterCountries(
  countries: Country[],
  filter: CountryFilter,
  currencyOf?: (code: RegionCode) => string | undefined,
): Country[] {
  const q = filter.query ? normalise(filter.query) : '';
  const restrict = filter.restrictTo ? new Set(filter.restrictTo) : null;

  return countries.filter((c) => {
    if (restrict && !restrict.has(c.code)) return false;
    if (filter.continents?.length && !filter.continents.includes(c.continent)) return false;
    if (filter.subregions?.length && !filter.subregions.includes(c.subregion)) return false;
    if (filter.currencies?.length) {
      const currency = currencyOf?.(c.code) ?? c.defaultCurrency;
      if (!filter.currencies.includes(currency)) return false;
    }
    if (q) {
      const haystack = `${normalise(c.name)} ${normalise(c.code)} ${normalise(
        c.subregion,
      )} ${normalise(currencyOf?.(c.code) ?? c.defaultCurrency)}`;
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Resolves a mixed list of group ids and raw region codes to region codes. */
export function resolveSelection(
  tokens: string[],
  customGroups: CustomGroup[] = [],
): RegionCode[] {
  const builtIn = new Map(builtInGroups().map((g) => [g.id, g.members]));
  const custom = new Map(customGroups.map((g) => [`custom:${g.id}`, g.members]));
  const out = new Set<RegionCode>();
  for (const token of tokens) {
    const members = builtIn.get(token) ?? custom.get(token);
    if (members) members.forEach((m) => out.add(m));
    else if (getCountry(token)) out.add(token);
  }
  return [...out];
}
