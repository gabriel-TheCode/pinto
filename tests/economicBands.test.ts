import { describe, expect, it } from 'vitest';
import {
  BAND_BASIS,
  CURVES,
  ECONOMIC_BANDS,
  bandOf,
  generateLadder,
  unbandedCountries,
} from '@/domain/regions/economicBands';
import { COUNTRIES } from '@/domain/regions/countries';
import { computeChangeSet } from '@/domain/pricing/computeChangeSet';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import { unitsToMicros } from '@/domain/money/money';
import type { ProductPricing } from '@/types';

describe('the band table', () => {
  it('covers every country Pinto knows, with no gaps', () => {
    expect(unbandedCountries()).toEqual([]);
  });

  it('never puts a country in two bands', () => {
    const seen = new Set<string>();
    for (const band of ECONOMIC_BANDS) {
      for (const code of band.members) {
        expect(seen.has(code), `${code} is in more than one band`).toBe(false);
        seen.add(code);
      }
    }
    expect(seen.size).toBe(COUNTRIES.length);
  });

  it('only references real region codes', () => {
    const known = new Set(COUNTRIES.map((country) => country.code));
    for (const band of ECONOMIC_BANDS) {
      for (const code of band.members) expect(known.has(code), code).toBe(true);
    }
  });

  it('states its basis rather than presenting itself as fact', () => {
    expect(BAND_BASIS).toMatch(/starting point/i);
    expect(BAND_BASIS).toMatch(/not a measurement/i);
  });

  it('locates a country’s band', () => {
    expect(bandOf('US')?.id).toBe('T1');
    expect(bandOf('IN')?.id).toBe('T5');
    expect(bandOf('ZZ')).toBeUndefined();
  });
});

describe('curves', () => {
  it('never rises as income falls', () => {
    for (const [name, curve] of Object.entries(CURVES)) {
      for (let i = 1; i < curve.shares.length; i++) {
        expect(curve.shares[i]!, `${name} band ${i}`).toBeLessThanOrEqual(curve.shares[i - 1]!);
      }
    }
  });

  it('always starts the top band at full price', () => {
    for (const curve of Object.values(CURVES)) expect(curve.shares[0]).toBe(1);
  });

  it('flat means flat — a genuine starting point for manual work', () => {
    expect(new Set(CURVES.flat.shares)).toEqual(new Set([1]));
  });

  it('has one share per band', () => {
    for (const curve of Object.values(CURVES)) {
      expect(curve.shares).toHaveLength(ECONOMIC_BANDS.length);
    }
  });
});

describe('generating a ladder', () => {
  it('produces a complete, editable tier strategy', () => {
    const ladder = generateLadder({ curve: 'balanced', baseRegion: 'US' });
    expect(ladder.kind).toBe('tiers');
    expect(ladder.baseRegion).toBe('US');
    expect(Object.keys(ladder.tiers)).toHaveLength(ECONOMIC_BANDS.length);
    expect(Object.keys(ladder.assignment)).toHaveLength(COUNTRIES.length);
  });

  it('assigns every country to a band that has a share', () => {
    const ladder = generateLadder({ curve: 'aggressive', baseRegion: 'US' });
    for (const [region, band] of Object.entries(ladder.assignment)) {
      expect(ladder.tiers[band], `${region} -> ${band}`).toBeGreaterThan(0);
    }
  });

  it('carries an explicit anchor when given one', () => {
    const ladder = generateLadder({
      curve: 'balanced',
      baseRegion: 'US',
      anchorMicros: unitsToMicros(9.99),
    });
    expect(ladder.anchorMicros).toBe(unitsToMicros(9.99));
  });

  it('omits the anchor entirely when none is given, falling back to the live price', () => {
    const ladder = generateLadder({ curve: 'balanced', baseRegion: 'US' });
    expect(ladder.anchorMicros).toBeUndefined();
  });

  it('restricts to the markets a product actually prices, touching nothing else', () => {
    const ladder = generateLadder({
      curve: 'balanced',
      baseRegion: 'US',
      restrictTo: ['US', 'IN', 'FR'],
    });
    expect(Object.keys(ladder.assignment).sort()).toEqual(['FR', 'IN', 'US']);
    // Bands with no surviving member are dropped rather than left dead.
    expect(Object.keys(ladder.tiers).length).toBeLessThan(ECONOMIC_BANDS.length);
  });
});

describe('the ladder actually prices by economic zone', () => {
  const product: ProductPricing = {
    packageName: 'com.example.app',
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    label: 'premium · monthly',
    prices: [
      { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99) },
      { regionCode: 'PL', currency: 'USD', micros: unitsToMicros(4.99) },
      { regionCode: 'BR', currency: 'USD', micros: unitsToMicros(4.99) },
      { regionCode: 'IN', currency: 'USD', micros: unitsToMicros(4.99) },
    ],
    raw: {},
  };

  it('charges less where the band is lower — the whole point of the feature', () => {
    const strategy = generateLadder({
      curve: 'aggressive',
      baseRegion: 'US',
      anchorMicros: unitsToMicros(4.99),
      restrictTo: product.prices.map((p) => p.regionCode),
    });

    const result = computeChangeSet({
      product,
      selection: product.prices.map((p) => p.regionCode),
      config: {
        strategy,
        rounding: DEFAULT_ROUNDING,
        floorMicros: null,
        ceilingMicros: null,
      },
    });

    const priceOf = (region: string) =>
      result.changes.find((change) => change.regionCode === region)!.newMicros!;

    // US (T1) > Poland (T2) > Brazil (T3) > India (T5).
    expect(priceOf('US')).toBeGreaterThan(priceOf('PL'));
    expect(priceOf('PL')).toBeGreaterThan(priceOf('BR'));
    expect(priceOf('BR')).toBeGreaterThan(priceOf('IN'));
    expect(result.summary.invalid).toBe(0);
  });

  it('a flat curve leaves every market at the same price', () => {
    const strategy = generateLadder({
      curve: 'flat',
      baseRegion: 'US',
      anchorMicros: unitsToMicros(4.99),
      restrictTo: product.prices.map((p) => p.regionCode),
    });
    const result = computeChangeSet({
      product,
      selection: product.prices.map((p) => p.regionCode),
      config: { strategy, rounding: DEFAULT_ROUNDING, floorMicros: null, ceilingMicros: null },
    });
    const prices = new Set(result.changes.map((change) => change.newMicros));
    expect(prices.size).toBe(1);
  });
});
