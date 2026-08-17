import { describe, expect, it } from 'vitest';
import { convert, deriveRates, median } from '@/domain/pricing/rates';
import type { RegionalPrice } from '@/types';
import { unitsToMicros } from '@/domain/money/money';

const prices: RegionalPrice[] = [
  { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99) },
  { regionCode: 'FR', currency: 'EUR', micros: unitsToMicros(4.79) },
  { regionCode: 'DE', currency: 'EUR', micros: unitsToMicros(4.99) },
  { regionCode: 'BR', currency: 'BRL', micros: unitsToMicros(24.9) },
  { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800) },
];

describe('implied rates', () => {
  it('derives a rate per currency relative to the base region', () => {
    const table = deriveRates(prices, 'US')!;
    expect(table.baseCurrency).toBe('USD');
    expect(table.rates.get('BRL')).toBeCloseTo(24.9 / 4.99, 5);
    expect(table.rates.get('JPY')).toBeCloseTo(800 / 4.99, 5);
    expect(table.rates.get('USD')).toBe(1);
  });

  it('uses the median when several regions share a currency', () => {
    const table = deriveRates(prices, 'US')!;
    // EUR appears at 4.79 and 4.99 -> median ratio of the two.
    const expected = (4.79 / 4.99 + 4.99 / 4.99) / 2;
    expect(table.rates.get('EUR')).toBeCloseTo(expected, 5);
  });

  it('returns null when the base region has no usable price', () => {
    expect(deriveRates(prices, 'ZZ')).toBeNull();
    expect(deriveRates([{ regionCode: 'US', currency: 'USD', micros: 0 }], 'US')).toBeNull();
  });
});

describe('conversion', () => {
  it('converts through the implied rate', () => {
    const table = deriveRates(prices, 'US')!;
    const result = convert(unitsToMicros(9.99), 'BRL', table)!;
    expect(result.rate).toBeCloseTo(24.9 / 4.99, 5);
    expect(result.micros).toBeCloseTo(unitsToMicros(9.99 * (24.9 / 4.99)), -2);
  });

  it('is an identity for the base currency', () => {
    const table = deriveRates(prices, 'US')!;
    expect(convert(123, 'USD', table)).toEqual({ micros: 123, rate: 1 });
  });

  it('refuses to invent a rate for a currency the product does not price', () => {
    const table = deriveRates(prices, 'US')!;
    expect(convert(unitsToMicros(4.99), 'INR', table)).toBeNull();
  });
});

describe('median', () => {
  it('handles odd, even and empty inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
