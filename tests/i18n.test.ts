import { afterEach, describe, expect, it, vi } from 'vitest';
import { DICTIONARIES, translator } from '@/i18n';
import {
  createTranslator,
  missingKeys,
  render,
  selectPlural,
  type Dictionary,
  type Locale,
  type Message,
  type PluralMessage,
} from '@/i18n/core';

/**
 * The dictionaries are data the type system only half checks: it proves both
 * locales have the same keys, not that a French plural uses French categories,
 * that a placeholder survived translation, or that the typography is French.
 * Each rule here fails with the offending keys, so a reader knows where to look.
 */

const en = DICTIONARIES.en as Dictionary;
const fr = DICTIONARIES.fr as Dictionary;
const KEYS = Object.keys(en);

const isPlural = (message: Message): message is PluralMessage => typeof message !== 'string';
const variants = (message: Message): string[] =>
  isPlural(message) ? Object.values(message).filter((v): v is string => typeof v === 'string') : [message];

/** `{name}` placeholders across every variant of a message. */
function placeholders(message: Message): string[] {
  const names = new Set<string>();
  for (const text of variants(message)) for (const m of text.matchAll(/\{(\w+)\}/g)) names.add(m[1]!);
  return [...names].sort();
}

/** French text a typographer would check: no URLs, no code or key caps, no placeholders. */
function prose(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<(code|kbd)>.*?<\/\1>/gs, ' ')
    .replace(/<\/?\w+>/g, '')
    .replace(/\{\w+\}/g, 'x');
}

/**
 * Words spelt the same in English and French. An identical value passes only
 * when every word in it is listed here — anything else identical is an
 * untranslated string. Keep it short: brand names and true cognates.
 */
const SAME_WORDS = new Set([
  'Pinto', // brand
  'Action',
  'Continent',
  'Continents',
  'Europe',
  'Exact',
  'Simulation',
  'Version',
]);

/**
 * Nothing to translate: only placeholders, punctuation and listed words
 * (`{country} · {price}`, `Version {version}`), or one technical token typed
 * verbatim (`com.example.app`, an OAuth client id).
 */
const untranslatable = (message: Message) =>
  variants(message).every((text) => {
    const words = text.replace(/\{\w+\}/g, '');
    if (/^\s*[a-z0-9][\w-]*(\.[\w-]+)+\s*$/i.test(words)) return true;
    return (words.match(/\p{L}+/gu) ?? []).every((word) => SAME_WORDS.has(word));
  });

describe('dictionaries', () => {
  it('have exactly the same keys in English and French', () => {
    const missing = KEYS.filter((key) => !(key in fr));
    const extra = Object.keys(fr).filter((key) => !(key in en));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it('leave no value empty', () => {
    const empty: string[] = [];
    for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
      for (const [key, message] of Object.entries(dictionary as Dictionary)) {
        if (variants(message).some((text) => !text.trim())) empty.push(`${locale}:${key}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it('use plural forms on the same keys in both languages', () => {
    const mismatched = KEYS.filter((key) => key in fr && isPlural(en[key]!) !== isPlural(fr[key]!));
    expect(mismatched).toEqual([]);
  });

  it('give every plural an `other` form and only the CLDR categories of its language', () => {
    const problems: string[] = [];
    for (const locale of ['en', 'fr'] as Locale[]) {
      const allowed = new Set<string>(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
      for (const [key, message] of Object.entries(DICTIONARIES[locale] as Dictionary)) {
        if (!isPlural(message)) continue;
        if (!message.other) problems.push(`${locale}:${key} has no "other"`);
        for (const category of Object.keys(message)) {
          if (!allowed.has(category)) problems.push(`${locale}:${key} uses "${category}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keep the same placeholders in French as in English', () => {
    const drift = KEYS.filter((key) => key in fr)
      .filter((key) => placeholders(en[key]!).join() !== placeholders(fr[key]!).join())
      .map((key) => `${key}: en {${placeholders(en[key]!)}} fr {${placeholders(fr[key]!)}}`);
    expect(drift).toEqual([]);
  });

  it('use French spacing before : ; ! ? and inside « »', () => {
    const problems: string[] = [];
    for (const [key, message] of Object.entries(fr)) {
      for (const text of variants(message).map(prose)) {
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]!;
          const before = text[i - 1];
          if (ch === ':') {
            // 12:30 and the like are not punctuation.
            if (/\d/.test(before ?? '') && /\d/.test(text[i + 1] ?? '')) continue;
            if (before !== ' ') problems.push(`${key}: “${text}” needs U+00A0 before “:”`);
          } else if (ch === '«' && !/[  ]/.test(text[i + 1] ?? '')) {
            problems.push(`${key}: “${text}” needs U+00A0 after “«”`);
          } else if (ch === '»' && !/[  ]/.test(before ?? '')) {
            problems.push(`${key}: “${text}” needs U+00A0 before “»”`);
          } else if (ch === ';' || ch === '!' || ch === '?') {
            if (before !== ' ' && before !== ' ') {
              problems.push(`${key}: “${text}” needs U+202F before “${ch}”`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('use the typographic apostrophe in French', () => {
    const straight = Object.entries(fr)
      .filter(([, message]) => variants(message).some((text) => prose(text).includes("'")))
      .map(([key]) => key);
    expect(straight).toEqual([]);
  });

  it('are translated, not copied: identical values only for listed words and tokens', () => {
    const identical = KEYS.filter(
      (key) =>
        key in fr &&
        JSON.stringify(en[key]) === JSON.stringify(fr[key]) &&
        !untranslatable(en[key]!),
    );
    expect(identical).toEqual([]);
  });

  it('keep the shared-word list small', () => {
    expect(SAME_WORDS.size).toBeLessThanOrEqual(12);
  });
});

describe('translator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the wording of the requested locale', () => {
    expect(translator('en')('action.cancel')).toBe('Cancel');
    expect(translator('fr')('action.cancel')).toBe('Annuler');
  });

  it('falls back to English loudly and records the missing key', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = createTranslator<{ 'demo.only': string }>(
      { en: { 'demo.only': 'English only' }, fr: {} },
      'fr',
    );
    expect(t('demo.only')).toBe('English only');
    expect(missingKeys.has('fr:demo.only')).toBe(true);
    expect(error).toHaveBeenCalledOnce();
    // Reported once, not on every render.
    t('demo.only');
    expect(error).toHaveBeenCalledOnce();
  });

  it('returns the key itself when no locale has it, never "undefined"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = createTranslator<{ 'demo.nowhere': string }>({ en: {}, fr: {} }, 'en');
    expect(t('demo.nowhere')).toBe('demo.nowhere');
  });

  it('leaves a placeholder without a value visible', () => {
    expect(render('en', 'Hello {name}', {})).toBe('Hello {name}');
  });
});

describe('plural selection', () => {
  const message: PluralMessage = { one: 'one', other: 'other' };

  it('treats 0 and 1 as singular in French', () => {
    expect(selectPlural('fr', message, 0)).toBe('one');
    expect(selectPlural('fr', message, 1)).toBe('one');
    expect(selectPlural('fr', message, 2)).toBe('other');
    expect(translator('fr')('count.products', { count: 0 })).toBe('0 produit');
  });

  it('treats only 1 as singular in English', () => {
    expect(selectPlural('en', message, 0)).toBe('other');
    expect(selectPlural('en', message, 1)).toBe('one');
    expect(translator('en')('count.products', { count: 0 })).toBe('0 products');
    expect(translator('en')('count.products', { count: 1 })).toBe('1 product');
  });

  it('falls back to `other` for a category the message does not define', () => {
    expect(selectPlural('fr', message, 1_000_000)).toBe('other'); // "many" in French
    expect(selectPlural('en', message, Number.NaN)).toBe('other');
  });
});

describe('interpolation', () => {
  it('formats numbers for the locale', () => {
    const frGroup = new Intl.NumberFormat('fr').format(1234);
    expect(frGroup).not.toBe('1234');
    expect(translator('en')('count.products', { count: 1234 })).toBe('1,234 products');
    expect(translator('fr')('count.products', { count: 1234 })).toBe(`${frGroup} produits`);
  });

  it('inserts strings verbatim', () => {
    expect(render('fr', '{a} et {b}', { a: '1,5', b: 'x' })).toBe('1,5 et x');
  });
});
