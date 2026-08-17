import { describe, expect, it } from 'vitest';
import {
  apiMoneyToMicros,
  formatMicros,
  formatPercent,
  isOnGranularity,
  microsToApiMoney,
  minorUnitMicros,
  snapToGranularity,
  unitsToMicros,
} from '@/domain/money/money';

describe('micros <-> API Money', () => {
  it('round-trips a two-decimal price', () => {
    const money = microsToApiMoney(unitsToMicros(4.99), 'EUR');
    expect(money).toEqual({ currencyCode: 'EUR', units: '4', nanos: 990_000_000 });
    expect(apiMoneyToMicros(money)).toBe(4_990_000);
  });

  it('round-trips a zero-decimal price', () => {
    const money = microsToApiMoney(unitsToMicros(1200), 'JPY');
    expect(money).toEqual({ currencyCode: 'JPY', units: '1200', nanos: 0 });
    expect(apiMoneyToMicros(money)).toBe(1_200_000_000);
  });

  it('round-trips a three-decimal price without losing the third digit', () => {
    const money = microsToApiMoney(unitsToMicros(2.499), 'KWD');
    expect(apiMoneyToMicros(money)).toBe(2_499_000);
  });

  it('treats a missing Money as zero rather than throwing', () => {
    expect(apiMoneyToMicros(null)).toBe(0);
  });
});

describe('currency granularity', () => {
  it('knows the minor unit of each decimal count', () => {
    expect(minorUnitMicros('JPY')).toBe(1_000_000);
    expect(minorUnitMicros('USD')).toBe(10_000);
    expect(minorUnitMicros('BHD')).toBe(1_000);
  });

  it('rejects fractional yen and fractional cents', () => {
    expect(isOnGranularity(unitsToMicros(4.99), 'JPY')).toBe(false);
    expect(isOnGranularity(4_995, 'USD')).toBe(false);
    expect(isOnGranularity(unitsToMicros(4.99), 'USD')).toBe(true);
  });

  it('snaps to the nearest valid minor unit', () => {
    expect(snapToGranularity(4_994_999, 'USD')).toBe(4_990_000);
    expect(snapToGranularity(unitsToMicros(1199.6), 'JPY')).toBe(1_200_000_000);
  });

  it('falls back to two decimals for an unknown currency instead of failing', () => {
    expect(minorUnitMicros('ZZZ')).toBe(10_000);
  });
});

describe('formatting', () => {
  it('uses the currency decimal count, not the locale default', () => {
    expect(formatMicros(1_200_000_000, 'JPY')).toBe('JPY 1,200');
    expect(formatMicros(4_990_000, 'USD')).toBe('USD 4.99');
  });

  it('renders an absent price as a dash', () => {
    expect(formatMicros(null, 'USD')).toBe('—');
  });

  it('signs percentages and keeps one decimal only when it matters', () => {
    expect(formatPercent(0.1)).toBe('+10%');
    expect(formatPercent(-0.203)).toBe('-20%');
    expect(formatPercent(0.043)).toBe('+4.3%');
    expect(formatPercent(null)).toBe('—');
  });
});
