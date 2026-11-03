import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatter, parseDecimal } from '@/i18n/format';
import { translator } from '@/i18n';
import {
  errorText,
  failureText,
  formulaErrorText,
  issueText,
  operationSummary,
  periodName,
  productName,
  strategySummary,
} from '@/i18n/describe';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import { unitsToMicros } from '@/domain/money/money';
import type { ChangeIssue, ChangeIssueCode, OperationRecord, Strategy, StrategyConfig } from '@/types';
import type { Locale } from '@/i18n/core';

const LOCALES: Locale[] = ['en', 'fr'];
const en = formatter('en');
const fr = formatter('fr');
const tEn = translator('en');
const tFr = translator('fr');

/** Intl uses U+00A0 / U+202F and U+2212 where a test would type a space and a hyphen. */
const plain = (text: string) => text.replace(/[  ]/g, ' ').replace(/−/g, '-');

describe('parseDecimal', () => {
  // [typed, English interface, French interface]
  const table: [string, number, number][] = [
    ['4.99', 4.99, 4.99],
    ['4,99', 4.99, 4.99],
    ['1,900', 1900, 1.9], // a lone comma + 3 digits is grouping only in English
    ['1 234,56', 1234.56, 1234.56],
    ['1 234,56', 1234.56, 1234.56],
    ['1,234.56', 1234.56, 1234.56],
    ['1.234,56', 1234.56, 1234.56],
    ['-12,5', -12.5, -12.5],
    ['+5', 5, 5],
    [' 4,99 ', 4.99, 4.99],
    ['.5', 0.5, 0.5],
    ['4.', 4, 4],
  ];

  it.each(table)('reads %j as %d (en) and %d (fr)', (text, inEnglish, inFrench) => {
    expect(parseDecimal(text, '.')).toBe(inEnglish);
    expect(parseDecimal(text, ',')).toBe(inFrench);
    expect(en.parseDecimal(text)).toBe(inEnglish);
    expect(fr.parseDecimal(text)).toBe(inFrench);
  });

  it.each(['', '   ', 'abc', '4.9.9', '-', '4,99€', '1e3', '--5'])('refuses %j', (text) => {
    expect(parseDecimal(text, '.')).toBeNaN();
    expect(parseDecimal(text, ',')).toBeNaN();
  });

  it('reads back what the formatter shows', () => {
    expect(fr.parseDecimal(fr.number(1234.56))).toBe(1234.56);
    expect(en.parseDecimal(en.number(1234.56))).toBe(1234.56);
  });
});

describe('formatter', () => {
  it('formats money with the currency’s decimals and the locale’s separators', () => {
    expect(plain(en.money(4_990_000, 'USD'))).toBe('USD 4.99');
    expect(plain(fr.money(4_990_000, 'USD'))).toBe('4,99 USD');
    expect(plain(en.money(unitsToMicros(800), 'JPY'))).toBe('JPY 800');
    expect(plain(fr.money(unitsToMicros(1.25), 'KWD'))).toBe('1,250 KWD');
    expect(en.money(4_990_000, 'USD', { code: false })).toBe('4.99');
    expect(fr.money(4_990_000, 'USD', { code: false })).toBe('4,99');
    expect(en.money(null, 'USD')).toBe('—');
  });

  it('never prints a yen price with cents', () => {
    expect(plain(fr.money(unitsToMicros(800.4), 'JPY'))).toBe('800 JPY');
  });

  it('formats a change with its sign, one decimal under ten percent', () => {
    expect(en.delta(0.1)).toBe('+10%');
    expect(plain(fr.delta(0.1))).toBe('+10 %');
    expect(plain(en.delta(-0.2))).toBe('-20%');
    expect(en.delta(0.025)).toBe('+2.5%');
    expect(plain(fr.delta(0.025))).toBe('+2,5 %');
    expect(en.delta(0)).toBe('0%');
    expect(en.delta(null)).toBe('—');
  });

  it('names countries in the interface language', () => {
    expect(en.region('FR')).toBe('France');
    expect(fr.region('FR')).toBe('France');
    expect(en.region('US')).toBe('United States');
    expect(fr.region('US')).toBe('États-Unis');
    expect(fr.region('DE')).toBe('Allemagne');
  });

  it('says how long ago, in words', () => {
    const now = Date.UTC(2026, 0, 31, 12);
    expect(en.relative(now - 3 * 86_400_000, now)).toBe('3 days ago');
    expect(fr.relative(now - 3 * 86_400_000, now)).toBe('il y a 3 jours');
    expect(en.relative(now - 10_000, now)).toBe('now');
    expect(fr.relative(now - 2 * 3_600_000, now)).toBe('il y a 2 heures');
    // Beyond a month it is a date, not "40 days ago".
    expect(en.relative(now - 40 * 86_400_000, now)).toBe(en.date(now - 40 * 86_400_000));
  });

  it('shows an editable amount without grouping, with the locale’s separator', () => {
    expect(en.editable(4.99)).toBe('4.99');
    expect(fr.editable(4.99)).toBe('4,99');
    expect(fr.editable(1234.5)).toBe('1234,5');
    expect(en.editable(4.990000000001)).toBe('4.99');
    expect(en.editable(null)).toBe('');
    expect(fr.decimalSeparator).toBe(',');
  });

  it('joins and sorts the way the language does', () => {
    expect(en.list(['a', 'b', 'c'])).toBe('a, b, and c');
    expect(fr.list(['a', 'b', 'c'])).toBe('a, b et c');
    expect(['Zambie', 'Égypte', 'Allemagne'].sort(fr.compare)).toEqual(['Allemagne', 'Égypte', 'Zambie']);
  });
});

// ---------------------------------------------------------------------------
// describe.ts — domain values in words
// ---------------------------------------------------------------------------

const config = (strategy: Strategy): StrategyConfig => ({
  strategy,
  rounding: DEFAULT_ROUNDING,
  floorMicros: null,
  ceilingMicros: null,
});
const usd = (region: string) => (region === 'US' ? 'USD' : undefined);

describe('strategySummary', () => {
  const cases: [Strategy, string, (f: typeof fr) => string][] = [
    [{ kind: 'percentage', percent: 10 }, '+10% on current prices', (f) => `${f.delta(0.1)} sur les prix actuels`],
    [{ kind: 'multiplier', factor: 1.5 }, '× 1.5 on current prices', () => '× 1,5 sur les prix actuels'],
    [
      { kind: 'fixed', micros: 4_990_000, baseRegion: 'US', convert: true },
      'USD 4.99, converted per country',
      (f) => `${f.money(4_990_000, 'USD')}, converti par pays`,
    ],
    [
      { kind: 'fixed', micros: 4_990_000, baseRegion: 'US', convert: false },
      'USD 4.99 in every country',
      (f) => `${f.money(4_990_000, 'USD')} dans tous les pays`,
    ],
    [{ kind: 'copy', fromRegion: 'DE', convert: true }, 'Germany’s price, converted', () => 'Allemagne'],
    [{ kind: 'copy', fromRegion: 'DE', convert: false }, 'Germany’s price in every country', () => 'Allemagne'],
    [
      { kind: 'tiers', baseRegion: 'US', tiers: { A: 1, B: 0.6 }, assignment: {}, convert: true },
      '2 tiers from United States',
      () => '2 paliers',
    ],
    [{ kind: 'formula', expression: 'current * 1.1', baseRegion: 'US' }, 'Formula current * 1.1', () => 'Formule current * 1.1'],
  ];

  // Sentences around a country name are checked loosely in French: the
  // article in front of it ("de l’Allemagne", "des États-Unis") is the
  // translator's call, not the test's.
  it.each(cases)('describes %o in both languages', (strategy, english, french) => {
    expect(plain(strategySummary(tEn, en, config(strategy), usd))).toBe(english);
    const text = plain(strategySummary(tFr, fr, config(strategy), usd));
    if (strategy.kind === 'copy' || strategy.kind === 'tiers') {
      expect(text).toContain(plain(french(fr)));
      expect(text).not.toBe(english);
    } else {
      expect(text).toBe(plain(french(fr)));
    }
  });

  it('assumes USD when the reference country’s currency is unknown', () => {
    const fixed = config({ kind: 'fixed', micros: 4_990_000, baseRegion: 'XX', convert: false });
    expect(plain(strategySummary(tEn, en, fixed))).toBe('USD 4.99 in every country');
  });
});

describe('operationSummary', () => {
  const record: OperationRecord = {
    id: 'op',
    timestamp: 0,
    packageName: 'com.example.app',
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    regionsAffected: 1,
    status: 'succeeded',
    snapshot: [{ regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800) }],
    failures: [],
  };

  it('describes a restore, a structured config, and an old English label', () => {
    expect(operationSummary(tFr, fr, { ...record, revertOf: 'x' })).toBe(tFr('strategy.summary.revert'));
    const fixed = config({ kind: 'fixed', micros: unitsToMicros(900), baseRegion: 'JP', convert: false });
    // The amount's currency comes from the snapshot of that operation.
    expect(plain(operationSummary(tEn, en, { ...record, config: fixed }))).toBe('JPY 900 in every country');
    expect(operationSummary(tEn, en, { ...record, strategyLabel: '+10%' })).toBe('+10%');
    expect(operationSummary(tEn, en, record)).toBe('');
  });
});

describe('issueText', () => {
  // A Record over the union: a new ChangeIssueCode without a case here fails to compile.
  const ISSUES: Record<ChangeIssueCode, ChangeIssue['params']> = {
    'no-current-price': undefined,
    'no-source-price': undefined,
    'no-base-price': undefined,
    'no-rates': undefined,
    'no-rate': { currency: 'INR' },
    'tier-undefined': { tier: 'Gold' },
    'formula-error': { reason: 'unknown-function', name: 'sqrt' },
    'not-positive': undefined,
    'granularity-whole': { currency: 'JPY' },
    'granularity-minor': { currency: 'KWD', decimals: 3 },
    'unknown-currency': { currency: 'XYZ' },
    'large-increase': { threshold: 0.5 },
    'large-decrease': { threshold: 0.5 },
    rounded: undefined,
    'below-floor': undefined,
    'above-ceiling': undefined,
    override: undefined,
    untiered: undefined,
    'not-sold': undefined,
    'clamped-increase': { limit: 0.2 },
    'clamped-decrease': { limit: 0.1 },
  };

  it.each(Object.entries(ISSUES))('words %s in both languages', (code, params) => {
    const issue = { level: 'info', code, ...(params ? { params } : {}) } as ChangeIssue;
    const english = issueText(tEn, en, issue);
    const french = issueText(tFr, fr, issue);
    for (const text of [english, french]) {
      expect(text).not.toBe(code);
      expect(text.trim()).not.toBe('');
      expect(text).not.toMatch(/\{\w+\}/);
    }
    expect(french).not.toBe(english);
  });

  it('formats thresholds and limits as percentages', () => {
    expect(issueText(tEn, en, { level: 'warning', code: 'large-increase', params: { threshold: 0.5 } })).toBe(
      'Rises by more than 50%.',
    );
    expect(plain(issueText(tFr, fr, { level: 'info', code: 'clamped-increase', params: { limit: 0.2 } }))).toBe(
      'Limité à votre hausse maximale de 20 %.',
    );
  });

  it('words the formula’s own reason, and falls back for an unknown one', () => {
    expect(issueText(tEn, en, ISSUE('formula-error', { reason: 'unknown-function', name: 'sqrt' }))).toBe(
      'The formula failed: unknown function “sqrt”',
    );
    expect(issueText(tEn, en, ISSUE('formula-error', { reason: 'gremlins' }))).toBe(
      'The formula failed: the formula is not valid',
    );
  });

  it('picks singular or plural for decimal places', () => {
    expect(issueText(tEn, en, ISSUE('granularity-minor', { currency: 'XYZ', decimals: 1 }))).toBe(
      'XYZ prices have 1 decimal place.',
    );
    expect(issueText(tEn, en, ISSUE('granularity-minor', { currency: 'KWD', decimals: 3 }))).toBe(
      'KWD prices have 3 decimal places.',
    );
  });

  it('formula errors read the same from the editor as from a row', () => {
    expect(formulaErrorText(tEn, { code: 'arity', params: { name: 'abs', min: 1, max: 1 } })).toBe(
      '“abs” takes 1 to 1 values',
    );
    expect(formulaErrorText(tEn, { code: 'gremlins' })).toBe('the formula is not valid');
  });
});

function ISSUE(code: ChangeIssueCode, params?: ChangeIssue['params']): ChangeIssue {
  return { level: 'error', code, ...(params ? { params } : {}) };
}

// ---------------------------------------------------------------------------
// errorText — every code the code base can raise has its own words
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..');
const SCANNED = ['src/lib', 'src/services', 'src/background', 'src/app/store'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every `area/name` literal on a line that sets or compares an error code. */
function producedCodes(): string[] {
  const codes = new Set<string>();
  for (const file of SCANNED.flatMap((dir) => files(join(ROOT, dir)))) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!/\bcode\b/.test(line)) continue;
      for (const match of line.matchAll(/'([a-z]+\/[a-z-]+)'/g)) codes.add(match[1]!);
    }
  }
  return [...codes].sort();
}

/** Codes that mean "we don't know what happened": the generic wording is the right one. */
const GENERIC_BY_DESIGN = new Set(['ui/unexpected']);

/** Enough params for any error sentence; unused ones are ignored. */
const SAMPLE_PARAMS = { region: 'BG', expected: 'BGN', got: 'EUR', status: 418, count: 2, path: '0.config' };

describe('errorText', () => {
  const codes = producedCodes();

  it('finds the codes raised across the worker, the services and the store', () => {
    expect(codes).toEqual(expect.arrayContaining(['api/forbidden', 'apply/stale', 'auth/cancelled', 'runtime/disconnected']));
    expect(codes.length).toBeGreaterThan(25);
  });

  it.each(LOCALES)('has a specific title and hint for every code (%s)', (locale) => {
    const t = translator(locale);
    const f = formatter(locale);
    const generic = t('error.generic.title');
    const unworded = codes
      .filter((code) => !GENERIC_BY_DESIGN.has(code))
      .filter((code) => {
        const { title, hint } = errorText(t, f, { code, params: SAMPLE_PARAMS });
        return title === generic || !hint || /\{\w+\}/.test(title + hint);
      });
    expect(unworded).toEqual([]);
  });

  it('turns a region code into a country name in the sentence', () => {
    const title = errorText(tEn, en, { code: 'api/region-not-configured', params: { region: 'BR' } }).title;
    expect(title).toContain('Brazil');
    expect(title).not.toContain('BR ');
    expect(errorText(tFr, fr, { code: 'api/region-not-configured', params: { region: 'BR' } }).title).toContain(
      'Brésil',
    );
  });

  it('uses the plural form the count asks for', () => {
    expect(errorText(tEn, en, { code: 'apply/stale', params: { count: 1 } }).title).toBe(
      'A price changed since you loaded it',
    );
    expect(errorText(tEn, en, { code: 'apply/stale', params: { count: 3 } }).title).toBe(
      '3 prices changed since you loaded them',
    );
  });

  it('falls back to the generic wording for an unknown code, never the raw code', () => {
    const text = errorText(tFr, fr, { code: 'api/gremlins' });
    expect(text.title).toBe(tFr('error.generic.title'));
    expect(text.hint).toBe(tFr('error.generic.hint'));
    expect(errorText(tEn, en, { code: 'unexpected' }).title).toBe(tEn('error.generic.title'));
  });

  it('words a country failure from its code, or shows an old record’s sentence', () => {
    expect(failureText(tEn, en, { regionCode: 'FR', code: 'apply/not-applied' }).title).toBe(
      'Google accepted the price, but it did not change',
    );
    expect(failureText(tEn, en, { regionCode: 'FR', reason: 'Rejected by Google Play.' })).toEqual({
      title: 'Rejected by Google Play.',
      hint: '',
    });
  });
});

describe('product words', () => {
  it('names a billing period', () => {
    expect(periodName(tEn, 'P1M')).toBe('1 month');
    expect(periodName(tEn, 'P3M')).toBe('3 months');
    expect(periodName(tEn, 'P1Y')).toBe('1 year');
    expect(periodName(tEn, 'P2W')).toBe('2 weeks');
    expect(periodName(tEn, 'P7D')).toBe('7 days');
    expect(periodName(tFr, 'P1M')).toBe('1 mois');
    expect(periodName(tFr, 'P2Y')).toBe('2 ans');
    expect(periodName(tEn, 'whenever')).toBe('whenever');
  });

  it('keeps ids as typed and adds the details in words', () => {
    const plan = { kind: 'subscription', productId: 'premium', basePlanId: 'monthly', details: { period: 'P1M' } } as const;
    expect(productName(tEn, plan)).toBe('premium · monthly · 1 month');
    expect(productName(tFr, plan)).toBe('premium · monthly · 1 mois');

    const option = {
      kind: 'onetime',
      productId: 'lifetime',
      basePlanId: 'standard',
      details: { option: 'buy', state: 'draft' },
    } as const;
    expect(productName(tFr, option)).toBe('lifetime · standard · achat · brouillon');

    // Legacy managed products have only a SKU; the synthetic plan id stays hidden.
    expect(productName(tEn, { kind: 'inapp', productId: 'coins_100', basePlanId: 'DEFAULT' })).toBe('coins_100');
    // A state Pinto has no word for is shown as Google wrote it.
    expect(productName(tEn, { ...plan, details: { state: 'archived' } })).toBe('premium · monthly · archived');
  });
});
