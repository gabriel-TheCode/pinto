import type { Continent, PriceChange } from '@/types';
import type { Formatter } from '@/i18n/format';
import { COUNTRIES, countryOrPlaceholder } from '@/domain/regions/countries';
import { normalise, type CountryFilter } from '@/domain/regions/groups';

const CONTINENT_OF_SUBREGION = new Map<string, Continent>(
  COUNTRIES.map((country) => [country.subregion, country.continent]),
);

/** Rows in the order the interface language sorts country names. */
export function sortRows(changes: readonly PriceChange[], fmt: Formatter): PriceChange[] {
  const names = new Map(changes.map((change) => [change.regionCode, fmt.region(change.regionCode)]));
  return [...changes].sort((a, b) => fmt.compare(names.get(a.regionCode)!, names.get(b.regionCode)!));
}

/**
 * The rows a filter shows. Filters change what is visible, never what is
 * written. The search matches the name in the interface language and in
 * English, the code and the currency, accents ignored ("cote" finds Côte
 * d'Ivoire). A sub-region narrows only its own continent, so "Western
 * Europe" next to "Africa" keeps every African country.
 */
export function visibleRows(
  rows: readonly PriceChange[],
  filter: CountryFilter,
  fmt: Formatter,
): PriceChange[] {
  const query = normalise(filter.query ?? '');
  const continents = new Set(filter.continents ?? []);
  const subregions = new Set(filter.subregions ?? []);
  const narrowed = new Set([...subregions].map((subregion) => CONTINENT_OF_SUBREGION.get(subregion)));
  const currencies = new Set(filter.currencies ?? []);

  return rows.filter((row) => {
    const country = countryOrPlaceholder(row.regionCode);
    if (continents.size && !continents.has(country.continent)) return false;
    if (narrowed.has(country.continent) && !subregions.has(country.subregion)) return false;
    if (currencies.size && !currencies.has(row.currency)) return false;
    if (!query) return true;
    const haystack = `${fmt.region(row.regionCode)} ${country.name} ${row.regionCode} ${row.currency}`;
    return normalise(haystack).includes(query);
  });
}

/** How many filters are on, search aside (the search box shows itself). */
export function activeFilterCount(filter: CountryFilter): number {
  return (
    (filter.continents?.length ?? 0) +
    (filter.subregions?.length ?? 0) +
    (filter.currencies?.length ?? 0)
  );
}
