import type {
  ChangeIssue,
  ChangeSet,
  PriceChange,
  ProductPricing,
  RegionCode,
  RegionalPrice,
  Strategy,
  StrategyConfig,
} from '@/types';
import { countryOrPlaceholder } from '@/domain/regions/countries';
import { MICROS_PER_UNIT, microsToUnits, snapToGranularity, unitsToMicros } from '@/domain/money/money';
import { applyRounding } from './rounding';
import { convert, deriveRates, type RateTable } from './rates';
import { validateNewPrice } from './validate';
import { evaluateFormula, FormulaError } from '@/domain/formula/parser';

export interface ComputeInput {
  product: ProductPricing;
  /** Regions the user selected. Regions outside this set are left untouched. */
  selection: RegionCode[];
  config: StrategyConfig;
  /**
   * A currency conversion table sourced from Google (via convertRegionPrices)
   * rather than from the product's own prices. When present it is preferred for
   * every conversion, which makes a tiered ladder idempotent — re-applying it
   * produces no change, because the rates no longer come from the tiered prices
   * being recomputed. Absent (the default), conversion falls back to the rates
   * implied by the product's existing prices.
   */
  conversionTable?: RateTable | null;
}

interface RegionInput {
  regionCode: RegionCode;
  currency: string;
  currentMicros: number | null;
}

/**
 * The single place where "what will the new prices be" is decided.
 *
 * Everything here is pure: same product + selection + config always produces
 * the same change set, with no Chrome, network or React involved. That is what
 * makes the review screen trustworthy — the rows the user confirms are
 * literally the values that get written.
 */
export function computeChangeSet(input: ComputeInput): ChangeSet {
  const { product, selection, config } = input;
  const priceByRegion = new Map(product.prices.map((p) => [p.regionCode, p]));
  const baseRegion = baseRegionOf(config.strategy);
  const basePrice = baseRegion ? priceByRegion.get(baseRegion) ?? null : null;
  // Google's conversion table wins when available; otherwise fall back to the
  // rates implied by the product's own prices.
  const rates = input.conversionTable ?? ratesFor(config.strategy, product.prices);

  const selected = new Set(selection);
  const regions = orderedRegions(product.prices, selection);

  const changes: PriceChange[] = regions.map((region) => {
    const country = countryOrPlaceholder(region.regionCode);
    const base: PriceChange = {
      regionCode: region.regionCode,
      countryName: country.name,
      currency: region.currency,
      currentMicros: region.currentMicros,
      newMicros: region.currentMicros,
      status: 'unchanged',
      delta: null,
      issues: [],
    };

    if (!selected.has(region.regionCode)) return { ...base, status: 'skipped' };

    return computeRegion(region, base, config, rates, basePrice);
  });

  return { product, changes, summary: summarise(changes) };
}

function computeRegion(
  region: RegionInput,
  base: PriceChange,
  config: StrategyConfig,
  rates: RateTable | null,
  basePrice: RegionalPrice | null,
): PriceChange {
  const issues: ChangeIssue[] = [];

  // An explicit override is the exact intended price for this market, so it
  // wins over the strategy and skips rounding and guard rails entirely.
  const override = config.overrides?.[region.regionCode];
  if (override != null) {
    const snapped = snapToGranularity(override, region.currency);
    const validation = validateNewPrice(snapped, region.currency, region.currentMicros);
    const overrideIssues = [
      { level: 'info', code: 'rounded', message: 'Set to a market-specific price.' } as ChangeIssue,
      ...validation.issues,
    ];
    const changed = region.currentMicros === null || snapped !== region.currentMicros;
    return {
      ...base,
      newMicros: snapped,
      issues: overrideIssues,
      delta:
        region.currentMicros && region.currentMicros > 0 ? snapped / region.currentMicros - 1 : null,
      status: !validation.ok ? 'invalid' : changed ? 'changed' : 'unchanged',
    };
  }

  const result = targetMicros(region, config.strategy, rates, basePrice, issues);

  if (result === null) {
    return { ...base, status: 'invalid', issues, newMicros: null };
  }

  let micros = result.micros;
  const beforeRounding = micros;
  micros = applyRounding(micros, region.currency, config.rounding);
  if (micros !== snapToGranularity(beforeRounding, region.currency)) {
    issues.push({
      level: 'info',
      code: 'rounded',
      message: 'Adjusted by the rounding rule.',
    });
  }

  if (config.floorMicros != null && micros < config.floorMicros) {
    micros = snapToGranularity(config.floorMicros, region.currency);
    issues.push({
      level: 'info',
      code: 'below-floor',
      message: 'Raised to the minimum price.',
    });
  }
  if (config.ceilingMicros != null && micros > config.ceilingMicros) {
    micros = snapToGranularity(config.ceilingMicros, region.currency);
    issues.push({
      level: 'info',
      code: 'above-ceiling',
      message: 'Lowered to the maximum price.',
    });
  }

  const validation = validateNewPrice(micros, region.currency, region.currentMicros);
  issues.push(...validation.issues);

  const delta =
    region.currentMicros && region.currentMicros > 0 ? micros / region.currentMicros - 1 : null;

  const changed = region.currentMicros === null || micros !== region.currentMicros;
  const change: PriceChange = {
    ...base,
    newMicros: micros,
    delta,
    issues,
    status: !validation.ok ? 'invalid' : changed ? 'changed' : 'unchanged',
  };
  if (result.rate !== undefined) change.rateUsed = result.rate;
  return change;
}

interface TargetResult {
  micros: number;
  rate?: number;
}

function targetMicros(
  region: RegionInput,
  strategy: Strategy,
  rates: RateTable | null,
  basePrice: RegionalPrice | null,
  issues: ChangeIssue[],
): TargetResult | null {
  switch (strategy.kind) {
    case 'percentage':
    case 'multiplier': {
      if (region.currentMicros == null) {
        issues.push(noCurrentPrice());
        return null;
      }
      const factor =
        strategy.kind === 'percentage' ? 1 + strategy.percent / 100 : strategy.factor;
      return { micros: region.currentMicros * factor };
    }

    case 'fixed': {
      if (!strategy.convert) {
        return { micros: strategy.micros };
      }
      return convertFromBase(strategy.micros, region, rates, issues);
    }

    case 'copy': {
      if (!rates) {
        issues.push(noRate('the source region has no price to copy'));
        return null;
      }
      const source = rates.baseMicros;
      if (!strategy.convert) return { micros: source };
      return convertFromBase(source, region, rates, issues);
    }

    case 'tiers': {
      const tierName = strategy.assignment[region.regionCode];
      if (!tierName) return null; // untiered regions are simply not touched
      const share = strategy.tiers[tierName];
      if (share === undefined) {
        issues.push({
          level: 'error',
          code: 'no-rate',
          message: `Tier "${tierName}" has no percentage defined.`,
        });
        return null;
      }
      // The base amount is the explicit anchor when given, otherwise the base
      // region's current price. An explicit anchor lets one preset set the
      // whole ladder without the anchor price already being in place.
      const baseMicros = strategy.anchorMicros ?? basePrice?.micros ?? null;
      if (baseMicros == null) {
        issues.push(noRate('the base region has no price and no anchor was given'));
        return null;
      }
      const amount = baseMicros * share;
      if (!strategy.convert) return { micros: amount };
      return convertFromBase(amount, region, rates, issues);
    }

    case 'formula': {
      const current = region.currentMicros;
      const baseMicros = basePrice?.micros ?? null;
      if (current == null && /current/i.test(strategy.expression)) {
        issues.push(noCurrentPrice());
        return null;
      }
      if (baseMicros == null && /base/i.test(strategy.expression)) {
        issues.push(noRate('the base region has no price'));
        return null;
      }
      try {
        const units = evaluateFormula(strategy.expression, {
          current: microsToUnits(current ?? 0),
          base: microsToUnits(baseMicros ?? 0),
        });
        return { micros: unitsToMicros(units) };
      } catch (error) {
        issues.push({
          level: 'error',
          code: 'formula-error',
          message: error instanceof FormulaError ? error.message : 'Formula failed to evaluate.',
        });
        return null;
      }
    }

    default: {
      const exhaustive: never = strategy;
      throw new Error(`Unhandled strategy ${JSON.stringify(exhaustive)}`);
    }
  }
}

function convertFromBase(
  baseMicros: number,
  region: RegionInput,
  rates: RateTable | null,
  issues: ChangeIssue[],
): TargetResult | null {
  if (!rates) {
    issues.push(noRate('the base region has no price to derive rates from'));
    return null;
  }
  const converted = convert(baseMicros, region.currency, rates);
  if (!converted) {
    issues.push(
      noRate(
        `this product has no ${region.currency} price yet, so there is no rate implied by its own pricing`,
      ),
    );
    return null;
  }
  return { micros: converted.micros, rate: converted.rate };
}

function noCurrentPrice(): ChangeIssue {
  return {
    level: 'error',
    code: 'no-current-price',
    message: 'No current price in this region, so there is nothing to adjust from.',
  };
}

function noRate(reason: string): ChangeIssue {
  return { level: 'error', code: 'no-rate', message: `Cannot convert: ${reason}.` };
}

function ratesFor(strategy: Strategy, prices: RegionalPrice[]): RateTable | null {
  const region = baseRegionOf(strategy);
  if (!region) return null;
  return deriveRates(prices, region);
}

function baseRegionOf(strategy: Strategy): RegionCode | null {
  switch (strategy.kind) {
    case 'fixed':
    case 'formula':
    case 'tiers':
      return strategy.baseRegion;
    case 'copy':
      return strategy.fromRegion;
    default:
      return null;
  }
}

/**
 * Rows are built from the regions the product already prices, plus any extra
 * region the user explicitly selected (so a market can be added, not only
 * edited). Ordering is alphabetical by country name for scanability.
 */
function orderedRegions(prices: RegionalPrice[], selection: RegionCode[]): RegionInput[] {
  const map = new Map<RegionCode, RegionInput>();
  for (const price of prices) {
    map.set(price.regionCode, {
      regionCode: price.regionCode,
      currency: price.currency,
      currentMicros: price.micros,
    });
  }
  for (const region of selection) {
    if (map.has(region)) continue;
    map.set(region, {
      regionCode: region,
      currency: countryOrPlaceholder(region).defaultCurrency,
      currentMicros: null,
    });
  }
  return [...map.values()].sort((a, b) =>
    countryOrPlaceholder(a.regionCode).name.localeCompare(
      countryOrPlaceholder(b.regionCode).name,
    ),
  );
}

function summarise(changes: PriceChange[]): ChangeSet['summary'] {
  let changed = 0;
  let unchanged = 0;
  let invalid = 0;
  let skipped = 0;
  let warnings = 0;
  for (const change of changes) {
    if (change.status === 'changed') changed++;
    else if (change.status === 'unchanged') unchanged++;
    else if (change.status === 'invalid') invalid++;
    else skipped++;
    if (change.issues.some((i) => i.level === 'warning')) warnings++;
  }
  return { changed, unchanged, invalid, skipped, warnings };
}

/** Rows that will actually be written. */
export function writableChanges(changeSet: ChangeSet): PriceChange[] {
  return changeSet.changes.filter((c) => c.status === 'changed' && c.newMicros != null);
}

export function describeStrategy(config: StrategyConfig): string {
  const s = config.strategy;
  switch (s.kind) {
    case 'percentage':
      return `${s.percent >= 0 ? '+' : ''}${s.percent}%`;
    case 'multiplier':
      return `× ${s.factor}`;
    case 'fixed':
      return `Fixed ${(s.micros / MICROS_PER_UNIT).toFixed(2)} (${s.baseRegion}${s.convert ? ', converted' : ''})`;
    case 'formula':
      return `Formula “${s.expression}”`;
    case 'tiers':
      return `Tiers from ${s.baseRegion}`;
    case 'copy':
      return `Copy from ${s.fromRegion}`;
    default:
      return 'Strategy';
  }
}
