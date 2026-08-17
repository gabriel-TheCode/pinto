import { describe, expect, it } from 'vitest';
import { applyRounding, DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import { MICROS_PER_UNIT, unitsToMicros } from '@/domain/money/money';
import type { RoundingConfig } from '@/types';

const charm: RoundingConfig = DEFAULT_ROUNDING;

describe('charm rounding', () => {
  it('pulls a price up to the nearest charm ending', () => {
    expect(applyRounding(unitsToMicros(5.42), 'USD', charm)).toBe(unitsToMicros(5.49));
    expect(applyRounding(unitsToMicros(4.87), 'USD', charm)).toBe(unitsToMicros(4.9));
  });

  it('can drop to the ending below when that is closer', () => {
    expect(applyRounding(unitsToMicros(5.02), 'USD', charm)).toBe(unitsToMicros(4.99));
    expect(applyRounding(unitsToMicros(4.98), 'USD', charm)).toBe(unitsToMicros(4.99));
  });

  it('never settles on a round .00 or .50 — that is not what charm means', () => {
    // A share of a charm base lands a hair away from a round number, and
    // "nearest" used to hand back the round one.
    expect(applyRounding(unitsToMicros(1.996), 'USD', charm)).toBe(unitsToMicros(1.99));
    expect(applyRounding(unitsToMicros(2.495), 'USD', charm)).toBe(unitsToMicros(2.49));
    expect(applyRounding(unitsToMicros(2.0), 'USD', charm)).toBe(unitsToMicros(1.99));
    expect(applyRounding(unitsToMicros(2.5), 'USD', charm)).toBe(unitsToMicros(2.49));
    expect(applyRounding(unitsToMicros(3.5), 'USD', charm)).toBe(unitsToMicros(3.49));
  });

  it('produces a charm ending for every price in a wide sweep', () => {
    const allowed = new Set([99, 95, 90, 49]);
    for (let cents = 50; cents <= 20_000; cents++) {
      const result = applyRounding(cents * 10_000, 'USD', charm) / 10_000;
      expect(allowed.has(result % 100), `${cents / 100} became ${result / 100}`).toBe(true);
    }
  });

  it('breaks an exact tie downwards rather than upwards', () => {
    // 2.24 sits 0.25 from both 1.99 and 2.49.
    expect(applyRounding(unitsToMicros(2.24), 'USD', charm)).toBe(unitsToMicros(1.99));
  });

  it('never moves a price by more than one whole unit', () => {
    for (let cents = 1; cents <= 2000; cents++) {
      const input = cents * 10_000;
      const output = applyRounding(input, 'USD', charm);
      expect(Math.abs(output - input)).toBeLessThanOrEqual(MICROS_PER_UNIT);
    }
  });

  it('never produces a zero or negative price', () => {
    for (let cents = 1; cents <= 300; cents++) {
      expect(applyRounding(cents * 10_000, 'USD', charm)).toBeGreaterThan(0);
    }
  });
});

describe('custom endings', () => {
  it('only uses the endings the user listed', () => {
    const config: RoundingConfig = { mode: 'endings', endings: [0.0], zeroDecimalStep: 100 };
    expect(applyRounding(unitsToMicros(5.42), 'USD', config)).toBe(unitsToMicros(5));
    expect(applyRounding(unitsToMicros(5.72), 'USD', config)).toBe(unitsToMicros(6));
  });

  it('falls back to plain snapping when every ending is invalid', () => {
    const config: RoundingConfig = { mode: 'endings', endings: [3, -1], zeroDecimalStep: 100 };
    expect(applyRounding(4_994_999, 'USD', config)).toBe(4_990_000);
  });
});

describe('zero-decimal currencies', () => {
  it('never invents fractional yen', () => {
    const result = applyRounding(unitsToMicros(4831), 'JPY', charm);
    expect(result % MICROS_PER_UNIT).toBe(0);
  });

  it('snaps to a step that matches the size of the price', () => {
    expect(applyRounding(unitsToMicros(4831), 'JPY', charm)).toBe(unitsToMicros(4800));
    expect(applyRounding(unitsToMicros(128_400), 'VND', charm)).toBe(unitsToMicros(130_000));
  });

  it('keeps small prices from collapsing to zero', () => {
    expect(applyRounding(unitsToMicros(4), 'JPY', charm)).toBeGreaterThan(0);
  });
});

describe('other modes', () => {
  it('rounds to whole units', () => {
    const config: RoundingConfig = { mode: 'integer', endings: [], zeroDecimalStep: 100 };
    expect(applyRounding(unitsToMicros(5.42), 'USD', config)).toBe(unitsToMicros(5));
  });

  it('off still snaps to a legal minor unit', () => {
    const config: RoundingConfig = { mode: 'none', endings: [], zeroDecimalStep: 100 };
    expect(applyRounding(5_423_100, 'USD', config)).toBe(5_420_000);
  });
});
