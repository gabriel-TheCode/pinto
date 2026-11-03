/**
 * Pinto's translation engine.
 *
 * No library: what Pinto needs is a typed string table, `{name}` substitution,
 * CLDR plural selection and inline markup — `Intl.PluralRules` and
 * `Intl.NumberFormat` already ship the hard parts. Everything here is pure, so
 * the panel, the popup and the content script share one implementation.
 *
 * Chrome's own `chrome.i18n` is used only for the manifest (extension name and
 * description in the Web Store and chrome://extensions): it follows the
 * browser's UI language and cannot be switched at runtime, which is the one
 * thing a language picker has to do.
 */

export type Locale = 'en' | 'fr';

export const LOCALES: readonly Locale[] = ['en', 'fr'];

/** English is the source of truth: its keys define every other locale's. */
export const SOURCE_LOCALE: Locale = 'en';

/** Native names, shown in the language picker in their own language. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français' };

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr';
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * A message whose wording depends on a number. Selected with the locale's CLDR
 * plural rules — French treats 0 and 1 as singular, English only 1 — so a
 * hand-written `count === 1 ? a : b` is wrong in one of the two languages.
 * The selector variable is always `count`.
 */
export interface PluralMessage {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

export type Message = string | PluralMessage;
export type Dictionary = Readonly<Record<string, Message>>;

/** A locale's namespace, typed against the English one: same keys, any wording. */
export type Translation<Source> = {
  readonly [K in keyof Source]: Source[K] extends string ? string : PluralMessage;
};

// ---------------------------------------------------------------------------
// Compile-time parameter checking
// ---------------------------------------------------------------------------

type VarsIn<S> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | VarsIn<Rest> : never;

/** The `{placeholders}` a message needs, plus `count` for a plural message. */
export type VarsOf<M> = M extends string
  ? VarsIn<M>
  : M extends PluralMessage
    ? VarsIn<Extract<M[keyof M], string>> | 'count'
    : never;

export type Value = string | number;

/** Arguments after the key: none when the message has no placeholders. */
export type ArgsFor<M> = [VarsOf<M>] extends [never] ? [] : [vars: Record<VarsOf<M>, Value>];

export type Translator<D extends Dictionary> = <K extends keyof D & string>(
  key: K,
  ...args: ArgsFor<D[K]>
) => string;

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

const pluralRules = new Map<Locale, Intl.PluralRules>();
const numberFormats = new Map<Locale, Intl.NumberFormat>();

function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)));
  return rules;
}

function numbersFor(locale: Locale): Intl.NumberFormat {
  let format = numberFormats.get(locale);
  if (!format) {
    numberFormats.set(locale, (format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })));
  }
  return format;
}

/** Picks the plural variant for `count`, falling back to `other`. */
export function selectPlural(locale: Locale, message: PluralMessage, count: unknown): string {
  const n = typeof count === 'number' ? count : Number(count);
  if (!Number.isFinite(n)) return message.other;
  const category = rulesFor(locale).select(n) as keyof PluralMessage;
  return message[category] ?? message.other;
}

/**
 * Substitutes `{name}`. Numbers are formatted for the locale (1 234 in French,
 * 1,234 in English); strings are inserted verbatim. A placeholder without a
 * value is left visible rather than printed as "undefined".
 */
export function interpolate(
  locale: Locale,
  template: string,
  vars?: Readonly<Record<string, Value>>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? numbersFor(locale).format(value) : value;
  });
}

export function render(
  locale: Locale,
  message: Message,
  vars?: Readonly<Record<string, Value>>,
): string {
  const template = typeof message === 'string' ? message : selectPlural(locale, message, vars?.count);
  return interpolate(locale, template, vars);
}

/** Missing keys found at runtime, so tests can fail on them instead of hiding them. */
export const missingKeys = new Set<string>();

/**
 * Builds a translator over `dictionaries`. The fallback to the source locale is
 * explicit and loud: the key is recorded in `missingKeys` and reported once on
 * the console. The type system already rejects a locale that lacks a key, so
 * reaching this path means a dictionary was assembled wrongly at runtime.
 */
export function createTranslator<D extends Dictionary>(
  dictionaries: Readonly<Record<Locale, Dictionary>>,
  locale: Locale,
): Translator<D> {
  const dictionary = dictionaries[locale];
  const source = dictionaries[SOURCE_LOCALE];
  return ((key: string, vars?: Record<string, Value>) => {
    let message = dictionary[key];
    if (message === undefined) {
      const id = `${locale}:${key}`;
      if (!missingKeys.has(id)) {
        missingKeys.add(id);
        console.error(`[pinto:i18n] missing "${key}" in ${locale}`);
      }
      message = source[key];
    }
    return message === undefined ? key : render(locale, message, vars);
  }) as Translator<D>;
}

// ---------------------------------------------------------------------------
// Inline markup
// ---------------------------------------------------------------------------

export type RichSegment = string | { tag: string; text: string };

/**
 * Splits `Press <kbd>⇧P</kbd> to open` into text and tagged segments, so a
 * sentence keeps its word order in every language while a fragment of it is
 * rendered as a key cap, code or emphasis. Tags are flat and named; anything
 * that does not match is plain text.
 */
export function parseRich(text: string): RichSegment[] {
  const out: RichSegment[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/gs;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push({ tag: match[1]!, text: match[2]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
