import type { ChangeSet, RegionCode } from '@/types';
import { computeChangeSet } from '@/domain/pricing/computeChangeSet';
import { isNeutralConfig } from '@/domain/pricing/neutral';
import type { State } from './types';

/**
 * The change set is derived, never stored. Anything that could drift out of
 * sync with the inputs has no business being the thing the user confirms.
 * It is memoised on the exact inputs so a 140-row table is not recomputed on
 * every keystroke in an unrelated field.
 */
let cache: { key: string; value: ChangeSet } | null = null;

export function selectChangeSet(state: State): ChangeSet | null {
  const { pricing, selection, config, conversionTable, conversionKey } = state;
  if (!pricing) return null;
  const key = JSON.stringify([
    pricing.productId,
    pricing.basePlanId,
    pricing.prices,
    [...selection].sort(),
    config,
    conversionKey,
  ]);
  if (cache?.key === key) return cache.value;
  // A table fetched for another reference amount would convert the wrong
  // number; until the right one arrives, implied rates are the honest preview.
  const table = conversionKey && conversionKey === conversionKeyOf(state) ? conversionTable : null;
  // "No change chosen" must compute as no change: without this the default
  // rounding would still tidy a few untouched prices into "changes".
  const effective = isNeutralConfig(config)
    ? { ...config, rounding: { ...config.rounding, mode: 'none' as const }, maxIncrease: null, maxDecrease: null, floorMicros: null, ceilingMicros: null }
    : config;
  const value = computeChangeSet({
    product: pricing,
    selection: [...selection],
    config: effective,
    conversionTable: table,
  });
  cache = { key, value };
  return value;
}

/**
 * The reference amount Google's conversion is fetched for: the strategy's base
 * amount in its base region's currency. Null when the strategy does not convert
 * across currencies, so no table is needed.
 */
export function conversionReference(state: State): { micros: number; currency: string } | null {
  const { config, pricing } = state;
  if (!pricing) return null;
  const s = config.strategy;
  const currencyOf = (region: RegionCode) =>
    pricing.prices.find((p) => p.regionCode === region)?.currency;

  if (s.kind === 'tiers' && s.convert) {
    const currency = currencyOf(s.baseRegion) ?? 'USD';
    const micros =
      s.anchorMicros ?? pricing.prices.find((p) => p.regionCode === s.baseRegion)?.micros;
    return micros ? { micros, currency } : null;
  }
  if (s.kind === 'fixed' && s.convert) {
    return { micros: s.micros, currency: currencyOf(s.baseRegion) ?? 'USD' };
  }
  if (s.kind === 'copy' && s.convert) {
    const source = pricing.prices.find((p) => p.regionCode === s.fromRegion);
    return source ? { micros: source.micros, currency: source.currency } : null;
  }
  if (s.kind === 'formula' && /\bbase\b/i.test(s.expression)) {
    const source = pricing.prices.find((p) => p.regionCode === s.baseRegion);
    return source ? { micros: source.micros, currency: source.currency } : null;
  }
  return null;
}

/** The key a conversion table is fetched under; tables for other inputs are stale. */
export function conversionKeyOf(state: State): string | null {
  const reference = conversionReference(state);
  if (!state.pricing || !reference) return null;
  const { packageName, productId } = state.pricing;
  return `${packageName}:${productId}:${reference.currency}:${reference.micros}`;
}

/** The currency a region is billed in for the open product. */
export function currencyLookup(state: Pick<State, 'pricing'>): (region: RegionCode) => string | undefined {
  const map = new Map(state.pricing?.prices.map((p) => [p.regionCode, p.currency]));
  return (region) => map.get(region);
}

export function productKeyOf(summary: { kind: string; productId: string; basePlanId: string }): string {
  return `${summary.kind}:${summary.productId}:${summary.basePlanId}`;
}

export function splitProductKey(key: string): ['subscription' | 'inapp' | 'onetime', string, string] {
  const [kind, productId, basePlanId] = key.split(':');
  return [kind as 'subscription' | 'inapp' | 'onetime', productId ?? '', basePlanId ?? ''];
}
