import type { CurrencyCode, RegionCode, RegionalPrice } from '@/types';

/**
 * Implied exchange rates, derived from the product's own regional prices.
 *
 * Pinto never calls a foreign-exchange service. Doing so would mean sending a
 * developer's pricing context to a third party and would produce numbers that
 * disagree with the ones Google Play itself used. Instead, when a product
 * already has prices in many currencies, those prices *are* a rate table:
 * if the base region is US at $4.99 and Brazil sits at R$24.90, then for this
 * product 1 USD implies 4.99 BRL. Applying "€4.99 equivalent" through those
 * ratios keeps every converted price consistent with the pricing Google
 * generated for the product in the first place.
 *
 * The trade-off is stated plainly in the UI: a region with no existing price
 * has no implied rate, and Pinto refuses to invent one.
 */
export interface RateTable {
  baseCurrency: CurrencyCode;
  baseMicros: number;
  /** currency -> units of that currency per 1 unit of base currency. */
  rates: Map<CurrencyCode, number>;
  /** Currencies present in the product but with a zero/absent base to compare. */
  missing: CurrencyCode[];
}

export function deriveRates(
  prices: RegionalPrice[],
  baseRegion: RegionCode,
): RateTable | null {
  const base = prices.find((p) => p.regionCode === baseRegion);
  if (!base || base.micros <= 0) return null;

  const rates = new Map<CurrencyCode, number>();
  const samples = new Map<CurrencyCode, number[]>();

  for (const price of prices) {
    if (price.micros <= 0) continue;
    const ratio = price.micros / base.micros;
    const list = samples.get(price.currency);
    if (list) list.push(ratio);
    else samples.set(price.currency, [ratio]);
  }

  // Several regions can share a currency (EUR, USD, XOF…) at slightly
  // different prices. The median is used rather than the mean so that one
  // deliberately odd market does not drag the whole currency's rate.
  for (const [currency, ratios] of samples) {
    rates.set(currency, median(ratios));
  }

  return {
    baseCurrency: base.currency,
    baseMicros: base.micros,
    rates,
    missing: [],
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Converts an amount expressed in the base currency into `target`.
 * Returns null when no rate is implied by the product's own prices.
 */
export function convert(
  baseMicros: number,
  target: CurrencyCode,
  table: RateTable,
): { micros: number; rate: number } | null {
  if (target === table.baseCurrency) return { micros: baseMicros, rate: 1 };
  const rate = table.rates.get(target);
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return null;
  return { micros: Math.round(baseMicros * rate), rate };
}

/** Currency a region will be billed in, preferring what the API reported. */
export function currencyForRegion(
  prices: RegionalPrice[],
  region: RegionCode,
  fallback: CurrencyCode,
): CurrencyCode {
  return prices.find((p) => p.regionCode === region)?.currency ?? fallback;
}
