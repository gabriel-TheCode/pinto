import type { CurrencyCode, RegionCode } from '@/types';
import { getCurrency } from '@/domain/money/currencies';
import { MICROS_PER_UNIT } from '@/domain/money/money';
import { countryOrPlaceholder } from '@/domain/regions/countries';
import type { Locale } from './core';

/**
 * Locale-aware presentation of numbers, money, dates and place names.
 *
 * Presentation only: every value in here goes in as micros, codes or
 * timestamps and comes out as text. Nothing a formatter returns is ever parsed
 * back into a price that gets written — the one inbound path, `parseDecimal`,
 * reads what the user typed into a field and is tested separately.
 *
 * Decimals always come from the currency (JPY 0, KWD 3), never from the
 * locale, so a yen price can't render as ¥4.99. The locale decides only the
 * separators, the order of code and amount, and the sign.
 */
export interface Formatter {
  readonly locale: Locale;
  /** `USD 4.99` / `4,99 USD`. `code: false` drops the currency code. */
  money(micros: number | null | undefined, currency: CurrencyCode, opts?: { code?: boolean }): string;
  /** A plain number: `1,234.5` / `1 234,5`. */
  number(value: number, opts?: Intl.NumberFormatOptions): string;
  /** A relative change: `+10%` / `+10 %`. One decimal under ten percent. */
  delta(delta: number | null | undefined): string;
  /** A share of a whole, `0.6` → `60%` / `60 %`; `0.025` → `2.5%`. */
  share(share: number): string;
  date(timestamp: number): string;
  dateTime(timestamp: number): string;
  time(timestamp: number): string;
  /** `3 days ago` / `il y a 3 jours`; falls back to a date beyond a month. */
  relative(timestamp: number, now?: number): string;
  /** Country or territory name in the interface language. */
  region(code: RegionCode): string;
  /** `France, Germany and Italy` / `France, Allemagne et Italie`. */
  list(items: string[]): string;
  /** Sorts strings the way the language does (É next to E in French). */
  compare(a: string, b: string): number;
  /** The decimal separator users of this locale type. */
  readonly decimalSeparator: string;
  /** Text for an editable amount field: no grouping, locale separator. */
  editable(units: number | null | undefined): string;
  /** Reads a typed amount; NaN when it is not a number. */
  parseDecimal(text: string): number;
}

const cache = new Map<Locale, Formatter>();

export function formatter(locale: Locale): Formatter {
  let f = cache.get(locale);
  if (!f) cache.set(locale, (f = build(locale)));
  return f;
}

function build(locale: Locale): Formatter {
  const moneyFormats = new Map<string, Intl.NumberFormat>();
  const plainFormats = new Map<number, Intl.NumberFormat>();
  const regionNames = safe(() => new Intl.DisplayNames([locale], { type: 'region' }));
  const lists = safe(() => new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' }));
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const dateTimes = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const times = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });
  const decimalSeparator =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ??
    '.';

  const plain = (decimals: number) => {
    let format = plainFormats.get(decimals);
    if (!format) {
      format = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      plainFormats.set(decimals, format);
    }
    return format;
  };

  const withCode = (currency: string, decimals: number) => {
    const key = `${currency}:${decimals}`;
    let format = moneyFormats.get(key);
    if (format === undefined) {
      format =
        safe(
          () =>
            new Intl.NumberFormat(locale, {
              style: 'currency',
              currency,
              currencyDisplay: 'code',
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            }),
        ) ?? plain(decimals);
      moneyFormats.set(key, format);
    }
    return format;
  };

  const self: Formatter = {
    locale,
    decimalSeparator,

    money(micros, currency, opts = {}) {
      if (micros == null || !Number.isFinite(micros)) return '—';
      const { decimals } = getCurrency(currency);
      const value = micros / MICROS_PER_UNIT;
      if (opts.code === false) return plain(decimals).format(value);
      const format = withCode(currency, decimals);
      const text = format.format(value);
      // A currency Intl rejects falls back to the plain format; say which
      // currency it is rather than show a bare number in a mixed table.
      return text.includes(currency) ? text : `${currency} ${text}`;
    },

    number(value, opts) {
      return new Intl.NumberFormat(locale, opts).format(value);
    },

    delta(delta) {
      if (delta == null || !Number.isFinite(delta)) return '—';
      const small = Math.abs(delta) < 0.1;
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        signDisplay: 'exceptZero',
        maximumFractionDigits: small ? 1 : 0,
      }).format(delta);
    },

    share(share) {
      return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(share);
    },

    date: (timestamp) => dates.format(timestamp),
    dateTime: (timestamp) => dateTimes.format(timestamp),
    time: (timestamp) => times.format(timestamp),

    relative(timestamp, now = Date.now()) {
      const seconds = Math.round((timestamp - now) / 1000);
      const abs = Math.abs(seconds);
      if (abs < 45) return relativeFormat.format(0, 'second');
      if (abs < 45 * 60) return relativeFormat.format(Math.round(seconds / 60), 'minute');
      if (abs < 22 * 3600) return relativeFormat.format(Math.round(seconds / 3600), 'hour');
      if (abs < 26 * 86400) return relativeFormat.format(Math.round(seconds / 86400), 'day');
      return dates.format(timestamp);
    },

    region(code) {
      const name = regionNames ? safe(() => regionNames.of(code)) : undefined;
      // DisplayNames echoes the code back for a region it does not know.
      return name && name !== code ? name : countryOrPlaceholder(code).name;
    },

    list(items) {
      return lists ? lists.format(items) : items.join(', ');
    },

    compare: (a, b) => collator.compare(a, b),

    editable(units) {
      if (units == null || !Number.isFinite(units)) return '';
      // Round away binary noise (4.990000000001) without imposing decimals.
      const text = String(Math.round(units * 1e6) / 1e6);
      return decimalSeparator === '.' ? text : text.replace('.', decimalSeparator);
    },

    parseDecimal: (text) => parseDecimal(text, decimalSeparator),
  };
  return self;
}

/**
 * Reads an amount typed by a person, in either convention.
 *
 * French users write 4,99; developers everywhere also write 4.99. Both mean
 * the same price, so both are accepted. When both separators appear, the last
 * one is the decimal point ("1.234,5" and "1,234.5"). A lone comma followed by
 * exactly three digits in an English interface is a thousands separator
 * ("1,900" naira), anywhere else it is the decimal point. Spaces of any kind
 * are grouping. Anything else is NaN — never a silently truncated number.
 */
export function parseDecimal(text: string, decimalSeparator = '.'): number {
  let value = text.replace(/[\s  '’]/g, '').replace(/^\+/, '');
  if (!value) return Number.NaN;
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    value = value.split(group).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    const grouping = decimalSeparator === '.' && /^-?\d{1,3}(,\d{3})+$/.test(value);
    value = grouping ? value.split(',').join('') : value.replace(',', '.');
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) return Number.NaN;
  return Number(value);
}

function safe<T>(make: () => T): T | undefined {
  try {
    return make();
  } catch {
    return undefined;
  }
}
