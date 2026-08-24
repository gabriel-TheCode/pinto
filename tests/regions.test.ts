import { describe, expect, it } from 'vitest';
import {
  CONTINENTS,
  COUNTRIES,
  KEY_MARKETS,
  countryOrPlaceholder,
  getCountry,
  subregionsOf,
} from '@/domain/regions/countries';
import { builtInGroups, filterCountries, normalise, resolveSelection } from '@/domain/regions/groups';
import { isKnownCurrency } from '@/domain/money/currencies';

describe('country table', () => {
  it('has no duplicate region codes', () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses two-letter uppercase region codes throughout', () => {
    for (const country of COUNTRIES) expect(country.code).toMatch(/^[A-Z]{2}$/);
  });

  it('only references currencies Pinto knows the decimals for', () => {
    for (const country of COUNTRIES) {
      expect(isKnownCurrency(country.defaultCurrency), country.code).toBe(true);
    }
  });

  it('synthesises a row for an unknown region instead of throwing', () => {
    expect(getCountry('ZZ')).toBeUndefined();
    expect(countryOrPlaceholder('ZZ')).toMatchObject({ code: 'ZZ', name: 'ZZ' });
  });

  it('never files an unknown region under a real continent', () => {
    // This defaulted to Europe once, which swept unrecognised markets into a
    // Europe selection and let them be repriced on a placeholder.
    expect(countryOrPlaceholder('ZZ').continent).toBe('Other');
    expect(filterCountries([countryOrPlaceholder('ZZ')], { continents: ['Europe'] })).toEqual([]);
  });

  it('names the small territories Play can return, rather than showing bare codes', () => {
    // A 140-row table full of "VU" and "SM" is unreadable; these are real
    // region codes the API hands back.
    for (const code of ['SM', 'SL', 'VU', 'VA', 'VG', 'SO', 'GI', 'PR', 'MO']) {
      const country = getCountry(code);
      expect(country, code).toBeDefined();
      expect(country!.name, code).not.toBe(code);
    }
  });

  it('lists subregions per continent', () => {
    expect(subregionsOf('Europe')).toContain('Western Europe');
  });
});

describe('key markets shortlist', () => {
  it('only names countries that exist in the table', () => {
    for (const code of KEY_MARKETS) expect(getCountry(code), code).toBeDefined();
  });

  it('has no duplicates', () => {
    expect(new Set(KEY_MARKETS).size).toBe(KEY_MARKETS.length);
  });

  it('covers every continent', () => {
    const covered = new Set(KEY_MARKETS.map((code) => getCountry(code)!.continent));
    for (const continent of CONTINENTS) expect(covered.has(continent), continent).toBe(true);
  });

  it('covers the widely shared currencies rather than only national ones', () => {
    const currencies = new Set(KEY_MARKETS.map((code) => getCountry(code)!.defaultCurrency));
    for (const currency of ['USD', 'EUR', 'XAF']) {
      expect(currencies.has(currency), currency).toBe(true);
    }
  });
});

describe('grouping', () => {
  it('builds continent, subregion and currency groups', () => {
    const groups = builtInGroups();
    const europe = groups.find((group) => group.id === 'continent:Europe')!;
    expect(europe.members).toContain('FR');
    expect(groups.some((group) => group.id === 'currency:EUR')).toBe(true);
  });

  it('never ships an economic classification as a built-in group', () => {
    const labels = builtInGroups().map((group) => group.label.toLowerCase());
    for (const banned of ['emerging', 'developing', 'poor', 'rich', 'low income']) {
      expect(labels.some((label) => label.includes(banned))).toBe(false);
    }
  });

  it('resolves a mix of group ids and raw codes, without duplicates', () => {
    const resolved = resolveSelection(['continent:Oceania', 'FR', 'FR', 'not-a-thing']);
    expect(resolved).toContain('AU');
    expect(resolved.filter((code) => code === 'FR')).toHaveLength(1);
  });
});

describe('filtering', () => {
  it('matches names ignoring accents and case', () => {
    expect(filterCountries(COUNTRIES, { query: 'turkiye' }).map((c) => c.code)).toContain('TR');
    expect(filterCountries(COUNTRIES, { query: 'cote' }).map((c) => c.code)).toContain('CI');
  });

  it('matches on region code and currency', () => {
    expect(filterCountries(COUNTRIES, { query: 'jp' }).map((c) => c.code)).toContain('JP');
    expect(filterCountries(COUNTRIES, { query: 'brl' }).map((c) => c.code)).toContain('BR');
  });

  it('combines continent and currency filters', () => {
    const result = filterCountries(COUNTRIES, { continents: ['Europe'], currencies: ['EUR'] });
    expect(result.every((country) => country.continent === 'Europe')).toBe(true);
    expect(result.map((c) => c.code)).toContain('DE');
    expect(result.map((c) => c.code)).not.toContain('GB');
  });

  it('prefers the live currency over the table hint when one is supplied', () => {
    const result = filterCountries(COUNTRIES, { currencies: ['USD'] }, (code) =>
      code === 'FR' ? 'USD' : undefined,
    );
    expect(result.map((c) => c.code)).toContain('FR');
  });

  it('restricts to a supplied set of regions', () => {
    const result = filterCountries(COUNTRIES, { restrictTo: ['FR', 'DE'] });
    expect(result.map((c) => c.code).sort()).toEqual(['DE', 'FR']);
  });

  it('normalises consistently', () => {
    expect(normalise('  Côte d’Ivoire ')).toBe('cote d’ivoire');
  });
});
