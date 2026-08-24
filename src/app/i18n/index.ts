import { en, type TranslationKey } from './en';
import { fr } from './fr';

export type Locale = 'en' | 'fr';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { en, fr };

export type { TranslationKey };

/**
 * Minimal dictionary lookup with `{name}` interpolation.
 *
 * No i18n library: the whole need here is one string table and one substitution
 * rule, and a runtime that ships plural engines and locale negotiation would be
 * larger than the dictionaries it serves. Missing keys fall back to English
 * rather than rendering a raw key at the user.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[locale]?.[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** First run: follow the browser rather than assuming English. */
export function detectLocale(): Locale {
  const candidates = [
    ...(typeof navigator !== 'undefined' ? (navigator.languages ?? []) : []),
    typeof navigator !== 'undefined' ? navigator.language : '',
  ];
  for (const tag of candidates) {
    if (typeof tag === 'string' && tag.toLowerCase().startsWith('fr')) return 'fr';
  }
  return 'en';
}

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr';
}
