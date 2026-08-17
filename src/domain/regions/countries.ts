import type { Continent, Country, RegionCode } from '@/types';

/**
 * Countries/regions Google Play sells in.
 *
 * `defaultCurrency` is a **display hint only**. The currency a product is
 * actually billed in for a region is decided by Google Play and is read back
 * from the API; Pinto always prefers the API value and only falls back to this
 * table when a region has no price configured yet. Several markets here bill
 * in USD on Play even though they have their own national currency, so treating
 * this table as authoritative would be wrong.
 */
type Row = readonly [RegionCode, string, string, Continent, string];

const ROWS: readonly Row[] = [
  // --- Europe ---------------------------------------------------------------
  ['AL', 'Albania', 'ALL', 'Europe', 'Southern Europe'],
  ['AM', 'Armenia', 'AMD', 'Europe', 'Eastern Europe'],
  ['AT', 'Austria', 'EUR', 'Europe', 'Western Europe'],
  ['AZ', 'Azerbaijan', 'AZN', 'Europe', 'Eastern Europe'],
  ['BA', 'Bosnia & Herzegovina', 'BAM', 'Europe', 'Southern Europe'],
  ['BE', 'Belgium', 'EUR', 'Europe', 'Western Europe'],
  ['BG', 'Bulgaria', 'BGN', 'Europe', 'Eastern Europe'],
  ['BY', 'Belarus', 'BYN', 'Europe', 'Eastern Europe'],
  ['CH', 'Switzerland', 'CHF', 'Europe', 'Western Europe'],
  ['CY', 'Cyprus', 'EUR', 'Europe', 'Southern Europe'],
  ['CZ', 'Czechia', 'CZK', 'Europe', 'Eastern Europe'],
  ['DE', 'Germany', 'EUR', 'Europe', 'Western Europe'],
  ['DK', 'Denmark', 'DKK', 'Europe', 'Northern Europe'],
  ['EE', 'Estonia', 'EUR', 'Europe', 'Northern Europe'],
  ['ES', 'Spain', 'EUR', 'Europe', 'Southern Europe'],
  ['FI', 'Finland', 'EUR', 'Europe', 'Northern Europe'],
  ['FR', 'France', 'EUR', 'Europe', 'Western Europe'],
  ['GB', 'United Kingdom', 'GBP', 'Europe', 'Northern Europe'],
  ['GE', 'Georgia', 'GEL', 'Europe', 'Eastern Europe'],
  ['GR', 'Greece', 'EUR', 'Europe', 'Southern Europe'],
  ['HR', 'Croatia', 'EUR', 'Europe', 'Southern Europe'],
  ['HU', 'Hungary', 'HUF', 'Europe', 'Eastern Europe'],
  ['IE', 'Ireland', 'EUR', 'Europe', 'Northern Europe'],
  ['IS', 'Iceland', 'ISK', 'Europe', 'Northern Europe'],
  ['IT', 'Italy', 'EUR', 'Europe', 'Southern Europe'],
  ['LI', 'Liechtenstein', 'CHF', 'Europe', 'Western Europe'],
  ['LT', 'Lithuania', 'EUR', 'Europe', 'Northern Europe'],
  ['LU', 'Luxembourg', 'EUR', 'Europe', 'Western Europe'],
  ['LV', 'Latvia', 'EUR', 'Europe', 'Northern Europe'],
  ['MD', 'Moldova', 'MDL', 'Europe', 'Eastern Europe'],
  ['ME', 'Montenegro', 'EUR', 'Europe', 'Southern Europe'],
  ['MK', 'North Macedonia', 'MKD', 'Europe', 'Southern Europe'],
  ['MT', 'Malta', 'EUR', 'Europe', 'Southern Europe'],
  ['NL', 'Netherlands', 'EUR', 'Europe', 'Western Europe'],
  ['NO', 'Norway', 'NOK', 'Europe', 'Northern Europe'],
  ['PL', 'Poland', 'PLN', 'Europe', 'Eastern Europe'],
  ['PT', 'Portugal', 'EUR', 'Europe', 'Southern Europe'],
  ['RO', 'Romania', 'RON', 'Europe', 'Eastern Europe'],
  ['RS', 'Serbia', 'RSD', 'Europe', 'Southern Europe'],
  ['RU', 'Russia', 'RUB', 'Europe', 'Eastern Europe'],
  ['SE', 'Sweden', 'SEK', 'Europe', 'Northern Europe'],
  ['SI', 'Slovenia', 'EUR', 'Europe', 'Southern Europe'],
  ['SK', 'Slovakia', 'EUR', 'Europe', 'Eastern Europe'],
  ['TR', 'Türkiye', 'TRY', 'Europe', 'Southern Europe'],
  ['UA', 'Ukraine', 'UAH', 'Europe', 'Eastern Europe'],

  // --- North America --------------------------------------------------------
  ['BM', 'Bermuda', 'USD', 'North America', 'Northern America'],
  ['CA', 'Canada', 'CAD', 'North America', 'Northern America'],
  ['MX', 'Mexico', 'MXN', 'North America', 'Central America'],
  ['US', 'United States', 'USD', 'North America', 'Northern America'],
  ['BZ', 'Belize', 'USD', 'North America', 'Central America'],
  ['CR', 'Costa Rica', 'CRC', 'North America', 'Central America'],
  ['GT', 'Guatemala', 'USD', 'North America', 'Central America'],
  ['HN', 'Honduras', 'HNL', 'North America', 'Central America'],
  ['NI', 'Nicaragua', 'NIO', 'North America', 'Central America'],
  ['PA', 'Panama', 'USD', 'North America', 'Central America'],
  ['SV', 'El Salvador', 'USD', 'North America', 'Central America'],
  ['AG', 'Antigua & Barbuda', 'USD', 'North America', 'Caribbean'],
  ['BB', 'Barbados', 'USD', 'North America', 'Caribbean'],
  ['BS', 'Bahamas', 'USD', 'North America', 'Caribbean'],
  ['DO', 'Dominican Republic', 'USD', 'North America', 'Caribbean'],
  ['HT', 'Haiti', 'USD', 'North America', 'Caribbean'],
  ['JM', 'Jamaica', 'USD', 'North America', 'Caribbean'],
  ['KY', 'Cayman Islands', 'USD', 'North America', 'Caribbean'],
  ['TT', 'Trinidad & Tobago', 'USD', 'North America', 'Caribbean'],

  // --- South America --------------------------------------------------------
  ['AR', 'Argentina', 'ARS', 'South America', 'South America'],
  ['BO', 'Bolivia', 'BOB', 'South America', 'South America'],
  ['BR', 'Brazil', 'BRL', 'South America', 'South America'],
  ['CL', 'Chile', 'CLP', 'South America', 'South America'],
  ['CO', 'Colombia', 'COP', 'South America', 'South America'],
  ['EC', 'Ecuador', 'USD', 'South America', 'South America'],
  ['GY', 'Guyana', 'USD', 'South America', 'South America'],
  ['PE', 'Peru', 'PEN', 'South America', 'South America'],
  ['PY', 'Paraguay', 'PYG', 'South America', 'South America'],
  ['SR', 'Suriname', 'USD', 'South America', 'South America'],
  ['UY', 'Uruguay', 'UYU', 'South America', 'South America'],
  ['VE', 'Venezuela', 'USD', 'South America', 'South America'],

  // --- Asia -----------------------------------------------------------------
  ['AE', 'United Arab Emirates', 'AED', 'Asia', 'Western Asia'],
  ['BH', 'Bahrain', 'USD', 'Asia', 'Western Asia'],
  ['IL', 'Israel', 'ILS', 'Asia', 'Western Asia'],
  ['IQ', 'Iraq', 'IQD', 'Asia', 'Western Asia'],
  ['JO', 'Jordan', 'JOD', 'Asia', 'Western Asia'],
  ['KW', 'Kuwait', 'USD', 'Asia', 'Western Asia'],
  ['LB', 'Lebanon', 'USD', 'Asia', 'Western Asia'],
  ['OM', 'Oman', 'USD', 'Asia', 'Western Asia'],
  ['PS', 'Palestine', 'USD', 'Asia', 'Western Asia'],
  ['QA', 'Qatar', 'QAR', 'Asia', 'Western Asia'],
  ['SA', 'Saudi Arabia', 'SAR', 'Asia', 'Western Asia'],
  ['YE', 'Yemen', 'USD', 'Asia', 'Western Asia'],
  ['KZ', 'Kazakhstan', 'KZT', 'Asia', 'Central Asia'],
  ['KG', 'Kyrgyzstan', 'KGS', 'Asia', 'Central Asia'],
  ['TJ', 'Tajikistan', 'USD', 'Asia', 'Central Asia'],
  ['TM', 'Turkmenistan', 'USD', 'Asia', 'Central Asia'],
  ['UZ', 'Uzbekistan', 'UZS', 'Asia', 'Central Asia'],
  ['AF', 'Afghanistan', 'USD', 'Asia', 'South Asia'],
  ['BD', 'Bangladesh', 'BDT', 'Asia', 'South Asia'],
  ['BT', 'Bhutan', 'USD', 'Asia', 'South Asia'],
  ['IN', 'India', 'INR', 'Asia', 'South Asia'],
  ['LK', 'Sri Lanka', 'LKR', 'Asia', 'South Asia'],
  ['MV', 'Maldives', 'USD', 'Asia', 'South Asia'],
  ['NP', 'Nepal', 'NPR', 'Asia', 'South Asia'],
  ['PK', 'Pakistan', 'PKR', 'Asia', 'South Asia'],
  ['BN', 'Brunei', 'USD', 'Asia', 'Southeast Asia'],
  ['ID', 'Indonesia', 'IDR', 'Asia', 'Southeast Asia'],
  ['KH', 'Cambodia', 'USD', 'Asia', 'Southeast Asia'],
  ['LA', 'Laos', 'USD', 'Asia', 'Southeast Asia'],
  ['MM', 'Myanmar', 'MMK', 'Asia', 'Southeast Asia'],
  ['MY', 'Malaysia', 'MYR', 'Asia', 'Southeast Asia'],
  ['PH', 'Philippines', 'PHP', 'Asia', 'Southeast Asia'],
  ['SG', 'Singapore', 'SGD', 'Asia', 'Southeast Asia'],
  ['TH', 'Thailand', 'THB', 'Asia', 'Southeast Asia'],
  ['VN', 'Vietnam', 'VND', 'Asia', 'Southeast Asia'],
  ['CN', 'China', 'CNY', 'Asia', 'East Asia'],
  ['HK', 'Hong Kong', 'HKD', 'Asia', 'East Asia'],
  ['JP', 'Japan', 'JPY', 'Asia', 'East Asia'],
  ['KR', 'South Korea', 'KRW', 'Asia', 'East Asia'],
  ['MN', 'Mongolia', 'USD', 'Asia', 'East Asia'],
  ['TW', 'Taiwan', 'TWD', 'Asia', 'East Asia'],

  // --- Africa ---------------------------------------------------------------
  ['DZ', 'Algeria', 'DZD', 'Africa', 'North Africa'],
  ['EG', 'Egypt', 'EGP', 'Africa', 'North Africa'],
  ['LY', 'Libya', 'USD', 'Africa', 'North Africa'],
  ['MA', 'Morocco', 'MAD', 'Africa', 'North Africa'],
  ['TN', 'Tunisia', 'TND', 'Africa', 'North Africa'],
  ['BJ', 'Benin', 'XOF', 'Africa', 'West Africa'],
  ['BF', 'Burkina Faso', 'XOF', 'Africa', 'West Africa'],
  ['CI', 'Côte d’Ivoire', 'XOF', 'Africa', 'West Africa'],
  ['GH', 'Ghana', 'GHS', 'Africa', 'West Africa'],
  ['GN', 'Guinea', 'USD', 'Africa', 'West Africa'],
  ['ML', 'Mali', 'XOF', 'Africa', 'West Africa'],
  ['NE', 'Niger', 'XOF', 'Africa', 'West Africa'],
  ['NG', 'Nigeria', 'NGN', 'Africa', 'West Africa'],
  ['SN', 'Senegal', 'XOF', 'Africa', 'West Africa'],
  ['TG', 'Togo', 'XOF', 'Africa', 'West Africa'],
  ['CM', 'Cameroon', 'XAF', 'Africa', 'Central Africa'],
  ['CD', 'DR Congo', 'USD', 'Africa', 'Central Africa'],
  ['CG', 'Congo', 'XAF', 'Africa', 'Central Africa'],
  ['GA', 'Gabon', 'XAF', 'Africa', 'Central Africa'],
  ['TD', 'Chad', 'XAF', 'Africa', 'Central Africa'],
  ['AO', 'Angola', 'AOA', 'Africa', 'Southern Africa'],
  ['BW', 'Botswana', 'USD', 'Africa', 'Southern Africa'],
  ['MZ', 'Mozambique', 'MZN', 'Africa', 'Southern Africa'],
  ['NA', 'Namibia', 'USD', 'Africa', 'Southern Africa'],
  ['ZA', 'South Africa', 'ZAR', 'Africa', 'Southern Africa'],
  ['ZM', 'Zambia', 'ZMW', 'Africa', 'Southern Africa'],
  ['ZW', 'Zimbabwe', 'USD', 'Africa', 'Southern Africa'],
  ['ET', 'Ethiopia', 'USD', 'Africa', 'East Africa'],
  ['KE', 'Kenya', 'KES', 'Africa', 'East Africa'],
  ['MG', 'Madagascar', 'USD', 'Africa', 'East Africa'],
  ['MU', 'Mauritius', 'USD', 'Africa', 'East Africa'],
  ['MW', 'Malawi', 'USD', 'Africa', 'East Africa'],
  ['RW', 'Rwanda', 'RWF', 'Africa', 'East Africa'],
  ['TZ', 'Tanzania', 'TZS', 'Africa', 'East Africa'],
  ['UG', 'Uganda', 'UGX', 'Africa', 'East Africa'],

  // --- Oceania --------------------------------------------------------------
  ['AU', 'Australia', 'AUD', 'Oceania', 'Australasia'],
  ['FJ', 'Fiji', 'USD', 'Oceania', 'Pacific Islands'],
  ['NZ', 'New Zealand', 'NZD', 'Oceania', 'Australasia'],
  ['PG', 'Papua New Guinea', 'USD', 'Oceania', 'Pacific Islands'],
];

export const COUNTRIES: Country[] = ROWS.map(
  ([code, name, defaultCurrency, continent, subregion]) => ({
    code,
    name,
    defaultCurrency,
    continent,
    subregion,
  }),
);

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: RegionCode): Country | undefined {
  return BY_CODE.get(code);
}

/** Unknown region codes still need a row in the table, so synthesise one. */
export function countryOrPlaceholder(code: RegionCode): Country {
  return (
    BY_CODE.get(code) ?? {
      code,
      name: code,
      defaultCurrency: 'USD',
      continent: 'Europe',
      subregion: 'Unknown',
    }
  );
}

/**
 * Markets offered first when Pinto needs a *reference* region — the one a
 * fixed price is expressed in, or the one a formula's `base` points at.
 *
 * A global product prices ~100 countries, but most of them share a handful of
 * currencies, so a raw list is mostly duplicates. This is a shortlist for the
 * picker and nothing more: it never affects a calculation, every country
 * remains selectable behind "All markets", and no market is excluded from
 * being priced because it is missing here.
 */
export const KEY_MARKETS: RegionCode[] = [
  'US', 'CA', // Northern America
  'BR', 'MX', // Latin America
  'GB', 'DE', 'FR', 'PL', // Europe
  'NG', 'ZA', 'EG', 'KE', 'CM', // Africa — Cameroon carries the XAF zone
  'IN', 'JP', 'ID', 'SA', 'TR', // Asia
  'AU', // Oceania
];

export const CONTINENTS: Continent[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
];

export function subregionsOf(continent: Continent): string[] {
  return [
    ...new Set(COUNTRIES.filter((c) => c.continent === continent).map((c) => c.subregion)),
  ].sort();
}
