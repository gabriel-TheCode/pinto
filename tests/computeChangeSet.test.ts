import { describe, expect, it } from 'vitest';
import { computeChangeSet, writableChanges } from '@/domain/pricing/computeChangeSet';
import { validateNewPrice } from '@/domain/pricing/validate';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import { unitsToMicros } from '@/domain/money/money';
import type { ProductPricing, RoundingConfig, StrategyConfig } from '@/types';

const product: ProductPricing = {
  packageName: 'com.example.app',
  kind: 'subscription',
  productId: 'premium',
  basePlanId: 'monthly',
  label: 'premium · monthly',
  prices: [
    { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99) },
    { regionCode: 'FR', currency: 'EUR', micros: unitsToMicros(4.99) },
    { regionCode: 'DE', currency: 'EUR', micros: unitsToMicros(4.99) },
    { regionCode: 'BR', currency: 'BRL', micros: unitsToMicros(24.9) },
    { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800) },
  ],
  raw: {},
};

const noRounding: RoundingConfig = { mode: 'none', endings: [], zeroDecimalStep: 100 };

function config(partial: Partial<StrategyConfig>): StrategyConfig {
  return {
    strategy: { kind: 'percentage', percent: 10 },
    rounding: DEFAULT_ROUNDING,
    floorMicros: null,
    ceilingMicros: null,
    ...partial,
  };
}

describe('selection', () => {
  it('leaves unselected countries alone and marks them skipped', () => {
    const result = computeChangeSet({
      product,
      selection: ['FR', 'DE'],
      config: config({ rounding: noRounding }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    expect(us.status).toBe('skipped');
    expect(us.newMicros).toBe(us.currentMicros);
    expect(result.summary.changed).toBe(2);
  });

  it('reports a row for every priced region plus any extra selected one', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'IN'],
      config: config({}),
    });
    expect(result.changes).toHaveLength(6);
    const india = result.changes.find((c) => c.regionCode === 'IN')!;
    expect(india.currentMicros).toBeNull();
    expect(india.status).toBe('invalid');
    expect(india.issues).toEqual([{ level: 'error', code: 'not-sold' }]);
  });

  it('blocks a selected country the product is not sold in, whatever the strategy', () => {
    // A fixed price needs no current price, but Play still cannot price a
    // country the product does not offer — say so before review, not at apply.
    const result = computeChangeSet({
      product,
      selection: ['US', 'IN'],
      config: config({
        strategy: { kind: 'fixed', micros: unitsToMicros(9.99), baseRegion: 'US', convert: false },
        rounding: noRounding,
      }),
    });
    const india = result.changes.find((c) => c.regionCode === 'IN')!;
    expect(india.status).toBe('invalid');
    expect(india.newMicros).toBeNull();
    expect(india.issues.map((i) => i.code)).toEqual(['not-sold']);
    expect(writableChanges(result).map((c) => c.regionCode)).toEqual(['US']);
  });

  it('sorts rows by country name so the table is scannable', () => {
    const result = computeChangeSet({ product, selection: [], config: config({}) });
    expect(result.changes.map((c) => c.regionCode)).toEqual(['BR', 'FR', 'DE', 'JP', 'US']);
  });
});

describe('percentage and multiplier', () => {
  it('applies a percentage increase per region in its own currency', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'JP'],
      config: config({ strategy: { kind: 'percentage', percent: 10 }, rounding: noRounding }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    const jp = result.changes.find((c) => c.regionCode === 'JP')!;
    expect(us.newMicros).toBe(unitsToMicros(5.49));
    expect(jp.newMicros).toBe(unitsToMicros(880));
    expect(us.delta).toBeCloseTo(0.1, 3);
  });

  it('applies a decrease', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'percentage', percent: -20 }, rounding: noRounding }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.newMicros).toBe(unitsToMicros(3.99));
  });

  it('multiplies', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'multiplier', factor: 2 }, rounding: noRounding }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.newMicros).toBe(unitsToMicros(9.98));
  });

  it('marks a price that does not move as unchanged, not changed', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'percentage', percent: 0 }, rounding: noRounding }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.status).toBe('unchanged');
    expect(result.summary.changed).toBe(0);
  });
});

describe('fixed price with conversion', () => {
  it('converts the target through the product’s own implied rates', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'BR', 'JP'],
      config: config({
        strategy: { kind: 'fixed', micros: unitsToMicros(9.99), baseRegion: 'US', convert: true },
        rounding: noRounding,
      }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    const br = result.changes.find((c) => c.regionCode === 'BR')!;
    expect(us.newMicros).toBe(unitsToMicros(9.99));
    expect(br.newMicros).toBeCloseTo(unitsToMicros(9.99 * (24.9 / 4.99)), -3);
    expect(br.rateUsed).toBeCloseTo(24.9 / 4.99, 4);
  });

  it('flags rather than guesses when a currency has no implied rate', () => {
    const withUnpriced: ProductPricing = {
      ...product,
      prices: [...product.prices, { regionCode: 'IN', currency: 'INR', micros: 0 }],
    };
    const result = computeChangeSet({
      product: withUnpriced,
      selection: ['IN'],
      config: config({
        strategy: { kind: 'fixed', micros: unitsToMicros(9.99), baseRegion: 'US', convert: true },
      }),
    });
    const india = result.changes.find((c) => c.regionCode === 'IN')!;
    expect(india.status).toBe('invalid');
    expect(india.issues).toContainEqual({ level: 'error', code: 'no-rate', params: { currency: 'INR' } });
    expect(india.newMicros).toBeNull();
  });

  it('writes the raw amount everywhere when conversion is off', () => {
    const result = computeChangeSet({
      product,
      selection: ['BR'],
      config: config({
        strategy: { kind: 'fixed', micros: unitsToMicros(9.99), baseRegion: 'US', convert: false },
        rounding: noRounding,
      }),
    });
    expect(result.changes.find((c) => c.regionCode === 'BR')!.newMicros).toBe(unitsToMicros(9.99));
  });
});

describe('copy and tiers', () => {
  it('copies one market’s price, converted', () => {
    const result = computeChangeSet({
      product,
      selection: ['BR'],
      config: config({
        strategy: { kind: 'copy', fromRegion: 'US', convert: true },
        rounding: noRounding,
      }),
    });
    const br = result.changes.find((c) => c.regionCode === 'BR')!;
    expect(br.newMicros).toBeCloseTo(unitsToMicros(24.9), -3);
  });

  it('applies tier shares of the base price and ignores untiered markets', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'FR', 'BR'],
      config: config({
        strategy: {
          kind: 'tiers',
          baseRegion: 'US',
          tiers: { A: 1, C: 0.6 },
          assignment: { US: 'A', BR: 'C' },
          convert: true,
        },
        rounding: noRounding,
      }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.newMicros).toBe(unitsToMicros(4.99));
    expect(result.changes.find((c) => c.regionCode === 'BR')!.newMicros).toBeCloseTo(
      unitsToMicros(4.99 * 0.6 * (24.9 / 4.99)),
      -3,
    );
    // FR was selected but not assigned to a tier: left alone, which is not an error.
    const fr = result.changes.find((c) => c.regionCode === 'FR')!;
    expect(fr.status).toBe('unchanged');
    expect(fr.newMicros).toBe(fr.currentMicros);
    expect(fr.issues).toEqual([{ level: 'info', code: 'untiered' }]);
    expect(result.summary.invalid).toBe(0);
  });

  it('blocks a country assigned to a tier that has no share, naming the tier', () => {
    const result = computeChangeSet({
      product,
      selection: ['BR'],
      config: config({
        strategy: {
          kind: 'tiers',
          baseRegion: 'US',
          tiers: { A: 1 },
          assignment: { BR: 'Ghost' },
          convert: true,
        },
      }),
    });
    const br = result.changes.find((c) => c.regionCode === 'BR')!;
    expect(br.status).toBe('invalid');
    expect(br.issues).toEqual([{ level: 'error', code: 'tier-undefined', params: { tier: 'Ghost' } }]);
  });

  it('blocks tiers when the reference country has no price and no anchor is set', () => {
    const result = computeChangeSet({
      product,
      selection: ['BR'],
      config: config({
        strategy: { kind: 'tiers', baseRegion: 'IN', tiers: { A: 1 }, assignment: { BR: 'A' }, convert: true },
      }),
    });
    expect(result.changes.find((c) => c.regionCode === 'BR')!.issues[0]!.code).toBe('no-base-price');
  });
});

describe('Google conversion table — idempotent ladders', () => {
  // A stable table sourced from Google (not from the product's prices), so
  // re-applying the ladder must produce no change the second time.
  const table = {
    baseCurrency: 'USD',
    baseMicros: unitsToMicros(10),
    rates: new Map([
      ['USD', 1],
      ['BRL', 5],
      ['JPY', 150],
    ]),
    missing: [],
  };

  const ladder = config({
    strategy: {
      kind: 'tiers',
      baseRegion: 'US',
      anchorMicros: unitsToMicros(10),
      tiers: { A: 1, C: 0.6 },
      assignment: { US: 'A', BR: 'C', JP: 'C' },
      convert: true,
    },
    rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
  });

  it('prefers the injected table over the product’s implied rates', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'BR', 'JP'],
      config: ladder,
      conversionTable: table,
    });
    // BR = anchor(10) x 0.6 x 5 = 30 BRL, from Google's rate, not the product's.
    expect(result.changes.find((c) => c.regionCode === 'BR')!.newMicros).toBe(unitsToMicros(30));
    expect(result.changes.find((c) => c.regionCode === 'JP')!.newMicros).toBe(unitsToMicros(900));
  });

  it('is idempotent: applying the result again changes nothing', () => {
    const first = computeChangeSet({
      product,
      selection: ['US', 'BR', 'JP'],
      config: ladder,
      conversionTable: table,
    });

    // Feed the first result back in as the product's new current prices.
    const applied: ProductPricing = {
      ...product,
      prices: first.changes
        .filter((c) => c.newMicros != null)
        .map((c) => ({ regionCode: c.regionCode, currency: c.currency, micros: c.newMicros! })),
    };

    const second = computeChangeSet({
      product: applied,
      selection: ['US', 'BR', 'JP'],
      config: ladder,
      conversionTable: table,
    });

    // Nothing changes the second time — the table did not come from the prices.
    expect(second.summary.changed).toBe(0);
  });

  it('by contrast, implied rates drift when re-applied to a tiered product', () => {
    const withoutTable = { ...ladder };
    const first = computeChangeSet({
      product,
      selection: ['US', 'BR', 'JP'],
      config: withoutTable,
    });
    const applied: ProductPricing = {
      ...product,
      prices: first.changes
        .filter((c) => c.newMicros != null)
        .map((c) => ({ regionCode: c.regionCode, currency: c.currency, micros: c.newMicros! })),
    };
    const second = computeChangeSet({
      product: applied,
      selection: ['US', 'BR', 'JP'],
      config: withoutTable,
    });
    // The implied-rate path is NOT idempotent — this is the bug the table fixes.
    expect(second.summary.changed).toBeGreaterThan(0);
  });
});

describe('tier anchor and overrides — one-pass pricing', () => {
  it('computes tiers from an explicit anchor, not the current base price', () => {
    // Current US is 4.99, but the anchor says price the ladder off 9.99.
    const result = computeChangeSet({
      product,
      selection: ['US', 'BR'],
      config: config({
        strategy: {
          kind: 'tiers',
          baseRegion: 'US',
          anchorMicros: unitsToMicros(9.99),
          tiers: { A: 1, C: 0.6 },
          assignment: { US: 'A', BR: 'C' },
          convert: true,
        },
        rounding: noRounding,
      }),
    });
    // US = 100% of the 9.99 anchor, regardless of its 4.99 current price.
    expect(result.changes.find((c) => c.regionCode === 'US')!.newMicros).toBe(unitsToMicros(9.99));
    // BR = 60% of the anchor, converted through the implied USD->BRL rate.
    expect(result.changes.find((c) => c.regionCode === 'BR')!.newMicros).toBeCloseTo(
      unitsToMicros(9.99 * 0.6 * (24.9 / 4.99)),
      -3,
    );
  });

  it('lets a per-region override win over the strategy, in that region’s currency', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'FR', 'DE'],
      config: config({
        strategy: {
          kind: 'tiers',
          baseRegion: 'US',
          anchorMicros: unitsToMicros(9.99),
          tiers: { A: 1 },
          assignment: { US: 'A', FR: 'A', DE: 'A' },
          convert: true,
        },
        rounding: noRounding,
        overrides: { FR: unitsToMicros(5.99), DE: unitsToMicros(5.99) },
      }),
    });
    expect(result.changes.find((c) => c.regionCode === 'FR')!.newMicros).toBe(unitsToMicros(5.99));
    expect(result.changes.find((c) => c.regionCode === 'DE')!.newMicros).toBe(unitsToMicros(5.99));
    // US has no override, so it still follows the anchor.
    expect(result.changes.find((c) => c.regionCode === 'US')!.newMicros).toBe(unitsToMicros(9.99));
  });

  it('an override ignores rounding and guard rails — it is the exact price', () => {
    const result = computeChangeSet({
      product,
      selection: ['FR'],
      config: config({
        strategy: { kind: 'percentage', percent: 10 },
        rounding: DEFAULT_ROUNDING,
        ceilingMicros: unitsToMicros(3),
        overrides: { FR: unitsToMicros(5.42) },
      }),
    });
    // Not charm-rounded to 5.49, not clamped to the 3.00 ceiling.
    const fr = result.changes.find((c) => c.regionCode === 'FR')!;
    expect(fr.newMicros).toBe(unitsToMicros(5.42));
    expect(fr.issues[0]).toEqual({ level: 'info', code: 'override' });
  });

  it('only overrides selected regions', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({
        strategy: { kind: 'percentage', percent: 0 },
        rounding: noRounding,
        overrides: { FR: unitsToMicros(5.99) },
      }),
    });
    // FR was not selected, so its override does not apply.
    expect(result.changes.find((c) => c.regionCode === 'FR')!.status).toBe('skipped');
  });
});

describe('formulas', () => {
  it('evaluates per region in that region’s currency', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'JP'],
      config: config({
        strategy: { kind: 'formula', expression: 'current * 1.1', baseRegion: 'US' },
        rounding: noRounding,
      }),
    });
    expect(result.changes.find((c) => c.regionCode === 'JP')!.newMicros).toBe(unitsToMicros(880));
  });

  it('surfaces a formula error as a blocked row', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({
        strategy: { kind: 'formula', expression: 'current / 0', baseRegion: 'US' },
      }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    expect(us.status).toBe('invalid');
    // A code plus the parser's reason, worded by the interface.
    expect(us.issues[0]).toEqual({
      level: 'error',
      code: 'formula-error',
      params: { reason: 'division-by-zero' },
    });
  });

  it('passes the parser’s params through with the reason', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'formula', expression: 'sqrt(current)', baseRegion: 'US' } }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.issues[0]!.params).toEqual({
      reason: 'unknown-function',
      name: 'sqrt',
    });
  });

  it('converts base into each market’s currency (implied rates)', () => {
    // base = US 4.99 USD. Japan bills in yen: base there is ~800 JPY, not 4.99 JPY.
    const result = computeChangeSet({
      product,
      selection: ['US', 'JP'],
      config: config({
        strategy: { kind: 'formula', expression: 'base * 2', baseRegion: 'US' },
        rounding: noRounding,
      }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.newMicros).toBe(unitsToMicros(9.98));
    expect(result.changes.find((c) => c.regionCode === 'JP')!.newMicros).toBe(unitsToMicros(1600));
  });

  it('converts base with Google’s table when one is given', () => {
    const table = {
      baseCurrency: 'USD',
      baseMicros: unitsToMicros(4.99),
      rates: new Map([
        ['USD', 1],
        ['JPY', 150],
      ]),
      missing: [],
    };
    const result = computeChangeSet({
      product,
      selection: ['JP'],
      config: config({
        strategy: { kind: 'formula', expression: 'base * 2', baseRegion: 'US' },
        rounding: noRounding,
      }),
      conversionTable: table,
    });
    // 4.99 USD × 150 × 2 = 1497 JPY.
    expect(result.changes.find((c) => c.regionCode === 'JP')!.newMicros).toBe(unitsToMicros(1497));
  });

  it('blocks a market whose currency has no rate when the formula uses base', () => {
    const table = {
      baseCurrency: 'USD',
      baseMicros: unitsToMicros(4.99),
      rates: new Map([['USD', 1]]),
      missing: [],
    };
    const result = computeChangeSet({
      product,
      selection: ['JP'],
      config: config({ strategy: { kind: 'formula', expression: 'base', baseRegion: 'US' } }),
      conversionTable: table,
    });
    const jp = result.changes.find((c) => c.regionCode === 'JP')!;
    expect(jp.status).toBe('invalid');
    expect(jp.issues).toEqual([{ level: 'error', code: 'no-rate', params: { currency: 'JPY' } }]);
  });

  it('needs no rate when the formula only uses current', () => {
    const result = computeChangeSet({
      product,
      selection: ['JP'],
      config: config({
        strategy: { kind: 'formula', expression: 'current + 100', baseRegion: 'XX' },
        rounding: noRounding,
      }),
    });
    expect(result.changes.find((c) => c.regionCode === 'JP')!.newMicros).toBe(unitsToMicros(900));
  });

  it('blocks base when the reference country has no price', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'formula', expression: 'base', baseRegion: 'IN' } }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.issues).toEqual([
      { level: 'error', code: 'no-base-price' },
    ]);
  });
});

describe('maximum increase and decrease', () => {
  it('holds a rise to the maximum increase, never above it', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'multiplier', factor: 2 }, rounding: noRounding, maxIncrease: 0.2 }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    // 4.99 × 1.2 = 5.988 → rounded down to 5.98, the last cent within the limit.
    expect(us.newMicros).toBe(unitsToMicros(5.98));
    expect(us.issues).toContainEqual({ level: 'info', code: 'clamped-increase', params: { limit: 0.2 } });
    expect(us.status).toBe('changed');
  });

  it('holds a fall to the maximum decrease, never below it', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'percentage', percent: -50 }, rounding: noRounding, maxDecrease: 0.1 }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    // 4.99 × 0.9 = 4.491 → rounded up to 4.50.
    expect(us.newMicros).toBe(unitsToMicros(4.5));
    expect(us.issues).toContainEqual({ level: 'info', code: 'clamped-decrease', params: { limit: 0.1 } });
  });

  it('respects the currency’s granularity when clamping', () => {
    const result = computeChangeSet({
      product,
      selection: ['JP'],
      // 800 × 1.1245 = 899.6, which a plain rounding would push to 900.
      config: config({ strategy: { kind: 'multiplier', factor: 2 }, rounding: noRounding, maxIncrease: 0.1245 }),
    });
    const jp = result.changes.find((c) => c.regionCode === 'JP')!;
    expect(jp.newMicros).toBe(unitsToMicros(899));
    expect(jp.issues.map((i) => i.code)).toContain('clamped-increase');
  });

  it('leaves moves inside the limits alone', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({
        strategy: { kind: 'percentage', percent: 10 },
        rounding: noRounding,
        maxIncrease: 0.2,
        maxDecrease: 0.2,
      }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    expect(us.newMicros).toBe(unitsToMicros(5.49));
    expect(us.issues.map((i) => i.code)).not.toContain('clamped-increase');
  });
});

describe('guard rails and validation', () => {
  it('clamps to the floor and the ceiling', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({
        strategy: { kind: 'multiplier', factor: 10 },
        rounding: noRounding,
        ceilingMicros: unitsToMicros(9.99),
      }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    expect(us.newMicros).toBe(unitsToMicros(9.99));
    expect(us.issues).toContainEqual({ level: 'info', code: 'above-ceiling' });
  });

  it('warns on very large moves without blocking them', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'multiplier', factor: 3 }, rounding: noRounding }),
    });
    const us = result.changes.find((c) => c.regionCode === 'US')!;
    expect(us.status).toBe('changed');
    expect(us.issues).toContainEqual({ level: 'warning', code: 'large-increase', params: { threshold: 0.5 } });
    expect(result.summary.warnings).toBe(1);
  });

  it('blocks a price that would fall to zero', () => {
    const result = computeChangeSet({
      product,
      selection: ['US'],
      config: config({ strategy: { kind: 'multiplier', factor: 0 }, rounding: noRounding }),
    });
    expect(result.changes.find((c) => c.regionCode === 'US')!.status).toBe('invalid');
  });

  it('never emits a price that violates the currency granularity', () => {
    const result = computeChangeSet({
      product,
      selection: ['JP', 'US', 'BR'],
      config: config({ strategy: { kind: 'multiplier', factor: 1.037 } }),
    });
    for (const change of writableChanges(result)) {
      const step = change.currency === 'JPY' ? 1_000_000 : 10_000;
      expect(change.newMicros! % step).toBe(0);
    }
  });
});

describe('summary and helpers', () => {
  it('counts every bucket', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'FR'],
      config: config({ strategy: { kind: 'percentage', percent: 10 }, rounding: noRounding }),
    });
    const { changed, unchanged, invalid, skipped } = result.summary;
    expect(changed + unchanged + invalid + skipped).toBe(result.changes.length);
    expect(skipped).toBe(3);
  });

  it('only exposes changed rows as writable', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'IN'],
      config: config({}),
    });
    expect(writableChanges(result).map((c) => c.regionCode)).toEqual(['US']);
  });

  it('never puts prose in an issue — only codes and params', () => {
    const result = computeChangeSet({
      product,
      selection: ['US', 'IN', 'JP', 'FR'],
      config: config({ strategy: { kind: 'multiplier', factor: 3 }, ceilingMicros: unitsToMicros(10) }),
    });
    for (const issue of result.changes.flatMap((c) => c.issues)) {
      expect(Object.keys(issue).sort()).toEqual(
        issue.params ? ['code', 'level', 'params'] : ['code', 'level'],
      );
    }
  });
});

describe('validateNewPrice', () => {
  it('names the currency and its decimals when a price is too precise', () => {
    expect(validateNewPrice(unitsToMicros(4.995), 'USD', null).issues).toEqual([
      { level: 'error', code: 'granularity-minor', params: { currency: 'USD', decimals: 2 } },
    ]);
    expect(validateNewPrice(unitsToMicros(800.5), 'JPY', null).issues).toEqual([
      { level: 'error', code: 'granularity-whole', params: { currency: 'JPY' } },
    ]);
  });

  it('warns about a currency it has no decimal rule for', () => {
    const result = validateNewPrice(unitsToMicros(4.99), 'XYZ', null);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([{ level: 'warning', code: 'unknown-currency', params: { currency: 'XYZ' } }]);
  });

  it('blocks zero and flags large moves both ways', () => {
    expect(validateNewPrice(0, 'USD', null).issues).toEqual([{ level: 'error', code: 'not-positive' }]);
    expect(validateNewPrice(unitsToMicros(1), 'USD', unitsToMicros(4.99)).issues).toEqual([
      { level: 'warning', code: 'large-decrease', params: { threshold: 0.5 } },
    ]);
  });
});
