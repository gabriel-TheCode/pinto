import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeParsePresetList } from '@/domain/presets/schema';
import { computeChangeSet } from '@/domain/pricing/computeChangeSet';
import { COUNTRIES } from '@/domain/regions/countries';
import { unitsToMicros } from '@/domain/money/money';
import type { Preset, ProductPricing, TierStrategy } from '@/types';

/**
 * The generated preset files are shipped for import, so they are held to the
 * same bar as anything else that can set a price: they must satisfy the real
 * import schema, cover every country, and produce sane numbers when run
 * through the actual pricing engine.
 */

const FILES = [
  'presets/purchasing-power-tiers.json',
];

function load(file: string): Preset[] {
  const path = resolve(__dirname, '..', file);
  const result = safeParsePresetList(JSON.parse(readFileSync(path, 'utf8')));
  if (!result.ok) throw new Error(`${file}: ${result.error}`);
  return result.presets;
}

describe.each(FILES)('%s', (file) => {
  it('exists', () => {
    expect(existsSync(resolve(__dirname, '..', file))).toBe(true);
  });

  it('passes the import schema Pinto actually uses', () => {
    expect(() => load(file)).not.toThrow();
  });

  it('has unique ids and non-empty names', () => {
    const presets = load(file);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
    for (const preset of presets) expect(preset.name.trim().length).toBeGreaterThan(0);
  });

  it('only references regions Pinto knows', () => {
    const known = new Set(COUNTRIES.map((country) => country.code));
    for (const preset of load(file)) {
      for (const region of preset.regions) expect(known.has(region), region).toBe(true);
    }
  });
});

describe('tier ladders', () => {
  const tierPresets = FILES.flatMap(load).filter(
    (preset) => preset.config.strategy.kind === 'tiers',
  );

  it('there is at least one', () => {
    expect(tierPresets.length).toBeGreaterThan(0);
  });

  it('assigns every country Pinto knows to exactly one band', () => {
    for (const preset of tierPresets) {
      const strategy = preset.config.strategy as TierStrategy;
      for (const country of COUNTRIES) {
        expect(strategy.assignment[country.code], `${preset.name}: ${country.code}`).toBeTruthy();
      }
    }
  });

  it('only assigns bands that have a share defined', () => {
    for (const preset of tierPresets) {
      const strategy = preset.config.strategy as TierStrategy;
      for (const band of new Set(Object.values(strategy.assignment))) {
        expect(strategy.tiers[band], `${preset.name}: ${band}`).toBeGreaterThan(0);
      }
    }
  });

  it('never lets a lower band cost more than a higher one', () => {
    for (const preset of tierPresets) {
      const strategy = preset.config.strategy as TierStrategy;
      const shares = Object.entries(strategy.tiers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, share]) => share);
      for (let index = 1; index < shares.length; index++) {
        expect(shares[index]!, preset.name).toBeLessThanOrEqual(shares[index - 1]!);
      }
    }
  });
});

describe('running a generated preset through the engine', () => {
  const product: ProductPricing = {
    packageName: 'com.example.app',
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    label: 'premium · monthly',
    prices: [
      { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99) },
      { regionCode: 'FR', currency: 'EUR', micros: unitsToMicros(4.79) },
      { regionCode: 'RO', currency: 'USD', micros: unitsToMicros(4.99) },
      { regionCode: 'IN', currency: 'USD', micros: unitsToMicros(4.99) },
      { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800) },
    ],
    raw: {},
  };

  const ladder = FILES.flatMap(load).find((preset) => preset.config.strategy.kind === 'tiers')!;

  it('produces a strictly descending price ladder', () => {
    const changeSet = computeChangeSet({
      product,
      selection: ['US', 'RO', 'IN'],
      config: ladder.config,
    });
    const priceOf = (region: string) =>
      changeSet.changes.find((change) => change.regionCode === region)!.newMicros!;

    // US is T1, Romania T3, India T5.
    expect(priceOf('US')).toBeGreaterThan(priceOf('RO'));
    expect(priceOf('RO')).toBeGreaterThan(priceOf('IN'));
  });

  it('never emits a price of zero or below', () => {
    const changeSet = computeChangeSet({
      product,
      selection: product.prices.map((price) => price.regionCode),
      config: ladder.config,
    });
    for (const change of changeSet.changes) {
      if (change.newMicros !== null) expect(change.newMicros).toBeGreaterThan(0);
    }
  });

  it('produces no invalid rows for markets that already have a price', () => {
    const changeSet = computeChangeSet({
      product,
      selection: product.prices.map((price) => price.regionCode),
      config: ladder.config,
    });
    const blocked = changeSet.changes.filter((change) => change.status === 'invalid');
    expect(blocked.map((change) => change.regionCode)).toEqual([]);
  });
});
