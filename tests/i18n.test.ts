import { describe, expect, it } from 'vitest';
import { en, type TranslationKey } from '@/app/i18n/en';
import { fr } from '@/app/i18n/fr';
import { LOCALES, detectLocale, isLocale, translate } from '@/app/i18n';

describe('dictionaries', () => {
  it('cover exactly the same keys', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('leave no entry empty', () => {
    for (const [key, value] of Object.entries({ ...en, ...fr })) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('is actually translated, not copied English', () => {
    // A handful of shared proper nouns are legitimately identical; the bulk
    // must differ, or the French locale is a lie.
    const keys = Object.keys(en) as TranslationKey[];
    const identical = keys.filter((key) => en[key] === fr[key]);
    expect(identical.length).toBeLessThan(keys.length * 0.15);
  });

  it('keeps interpolation placeholders on both sides', () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(en) as TranslationKey[]) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('translate', () => {
  it('returns the locale string', () => {
    expect(translate('en', 'nav.pricing')).toBe('Pricing');
    expect(translate('fr', 'nav.pricing')).toBe('Prix');
  });

  it('substitutes named variables', () => {
    expect(translate('en', 'pricing.countriesSelected', { count: 12 })).toBe(
      '12 countries selected',
    );
    expect(translate('fr', 'pricing.countriesSelected', { count: 12 })).toBe(
      '12 pays sélectionnés',
    );
  });

  it('leaves an unknown placeholder alone rather than printing undefined', () => {
    expect(translate('en', 'pricing.willChange')).toContain('{count}');
  });

  it('falls back to English for an unknown locale', () => {
    expect(translate('de' as 'en', 'nav.guide')).toBe('Guide');
  });
});

describe('locale detection', () => {
  it('recognises the two supported locales', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('offers both locales in the picker', () => {
    expect(LOCALES.map((locale) => locale.id).sort()).toEqual(['en', 'fr']);
  });

  it('returns a supported locale whatever the browser reports', () => {
    expect(['en', 'fr']).toContain(detectLocale());
  });
});
