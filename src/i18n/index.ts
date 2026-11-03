import { createTranslator, type Locale, type Translator } from './core';
import { en } from './locales/en';
import { fr } from './locales/fr';

/**
 * The full dictionary, for the panel and the popup. The content script imports
 * `./content` instead so only its own dozen strings ship into Play Console.
 */
export const DICTIONARIES = { en, fr } as const;

export type Messages = typeof en;
export type TranslationKey = keyof Messages & string;
export type T = Translator<Messages>;

const translators = new Map<Locale, T>();

export function translator(locale: Locale): T {
  let t = translators.get(locale);
  if (!t) translators.set(locale, (t = createTranslator<Messages>(DICTIONARIES, locale)));
  return t;
}

/**
 * For keys built at runtime from a code (`error.${code}.title`): narrows a
 * string to a real key so an unknown code takes the generic path instead of
 * printing the raw key.
 */
export function isTranslationKey(key: string): key is TranslationKey {
  return key in en;
}

/** Looks up a computed key, or `null` when the dictionary has no such entry. */
export function maybe(t: T, key: string, vars?: Record<string, string | number>): string | null {
  if (!isTranslationKey(key)) return null;
  return (t as (key: string, vars?: Record<string, string | number>) => string)(key, vars);
}

export {
  LOCALES,
  LOCALE_NAMES,
  isLocale,
  parseRich,
  type Locale,
  type RichSegment,
} from './core';
export { formatter, parseDecimal, type Formatter } from './format';
export {
  detectBrowserLocale,
  isLocalePreference,
  resolveLocale,
  watchLocale,
  type LocalePreference,
} from './preference';
