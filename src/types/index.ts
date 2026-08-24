/**
 * Shared domain types for Pinto.
 *
 * Money is represented in **micros** (1 unit = 1_000_000 micros) everywhere
 * inside the app. That is the representation the Google Play Developer API
 * uses for in-app products, and it converts losslessly to the `Money`
 * {units, nanos} shape used by the subscriptions API. Keeping a single
 * integer representation avoids float drift in price arithmetic.
 */

export type RegionCode = string; // ISO 3166-1 alpha-2, e.g. "FR"
export type CurrencyCode = string; // ISO 4217, e.g. "EUR"

export type Continent =
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania'
  /** Regions Pinto cannot name — never guessed into a real continent. */
  | 'Other';

export interface Country {
  code: RegionCode;
  name: string;
  /** Currency the country normally bills in on Google Play. Only a *hint*:
   *  the authoritative currency is whatever the API returns for the product. */
  defaultCurrency: CurrencyCode;
  continent: Continent;
  /** Commercial sub-region used for grouping, e.g. "Western Europe". */
  subregion: string;
}

export interface Currency {
  code: CurrencyCode;
  /** Number of decimal digits used by the currency (JPY = 0, KWD = 3). */
  decimals: number;
  symbol: string;
}

// ---------------------------------------------------------------------------
// Play Console product context
// ---------------------------------------------------------------------------

/**
 * Play has three priceable shapes, not two. `inapp` is the legacy managed
 * product; `onetime` is the newer one-time product model with purchase
 * options, which the legacy `inappproducts` endpoint does not return. An app
 * in production can easily have a lifetime purchase that only exists in the
 * newer model, so Pinto reads both.
 */
export type ProductKind = 'subscription' | 'inapp' | 'onetime';

/** What the content script could work out from the Play Console page. */
export interface PageContext {
  /** Play Console internal developer account id from the URL. */
  developerId: string | null;
  /** Play Console internal numeric app id from the URL. Not the package name. */
  consoleAppId: string | null;
  /** Package name, if we could resolve it (from cache or from the page). */
  packageName: string | null;
  /** How the package name was obtained — surfaced to the user for trust. */
  packageNameSource: 'url' | 'page' | 'cache' | 'manual' | null;
  productKind: ProductKind | null;
  productId: string | null;
  /** Base plan id for subscriptions, when the URL identifies one. */
  basePlanId: string | null;
  url: string;
  supported: boolean;
}

/** A single product's pricing, normalised across subscriptions and IAPs. */
export interface ProductPricing {
  packageName: string;
  kind: ProductKind;
  productId: string;
  /**
   * The sub-unit prices hang off: a base plan for subscriptions, a purchase
   * option for one-time products. Legacy managed products have neither and
   * use the synthetic id `DEFAULT`.
   */
  basePlanId: string;
  /** Human label, e.g. "Monthly · P1M". */
  label: string;
  prices: RegionalPrice[];
  /** Raw resource as returned by the API, kept so writes can be surgical. */
  raw: unknown;
}

export interface RegionalPrice {
  regionCode: RegionCode;
  currency: CurrencyCode;
  micros: number;
  /** Subscriptions: whether the region is offered to new subscribers. */
  availableToNewSubscribers?: boolean;
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

export type RoundingMode = 'none' | 'charm' | 'endings' | 'integer';

export interface RoundingConfig {
  mode: RoundingMode;
  /** Preferred fractional endings for `endings` mode, e.g. [0.99, 0.49]. */
  endings: number[];
  /** For zero-decimal currencies, snap to this magnitude, e.g. 100 -> 4900. */
  zeroDecimalStep: number;
}

export type StrategyKind =
  | 'percentage'
  | 'multiplier'
  | 'fixed'
  | 'formula'
  | 'tiers'
  | 'copy';

export interface PercentageStrategy {
  kind: 'percentage';
  /** +10 means +10%. */
  percent: number;
}

export interface MultiplierStrategy {
  kind: 'multiplier';
  factor: number;
}

export interface FixedStrategy {
  kind: 'fixed';
  /** Amount expressed in the base region's currency, in micros. */
  micros: number;
  /** Region whose currency the amount is expressed in. */
  baseRegion: RegionCode;
  /** Convert to other currencies using rates implied by existing prices. */
  convert: boolean;
}

export interface FormulaStrategy {
  kind: 'formula';
  /** e.g. "current * 1.1", "min(base * 1.25, 9.99)". */
  expression: string;
  baseRegion: RegionCode;
}

export interface TierStrategy {
  kind: 'tiers';
  baseRegion: RegionCode;
  /** Tier name -> share of the base price (1 = 100%). */
  tiers: Record<string, number>;
  /** Region -> tier name. Fully user-editable, nothing implicit. */
  assignment: Record<RegionCode, string>;
  convert: boolean;
  /**
   * Absolute base amount, in the base region's currency (micros). When set,
   * tiers are computed from this rather than from the base region's *current*
   * price — so a ladder no longer depends on the anchor price already being
   * correct, and a whole product can be set from one preset.
   */
  anchorMicros?: number;
}

export interface CopyStrategy {
  kind: 'copy';
  fromRegion: RegionCode;
  convert: boolean;
}

export type Strategy =
  | PercentageStrategy
  | MultiplierStrategy
  | FixedStrategy
  | FormulaStrategy
  | TierStrategy
  | CopyStrategy;

export interface StrategyConfig {
  strategy: Strategy;
  rounding: RoundingConfig;
  /** Never go below this, expressed in each region's own currency units. */
  floorMicros: number | null;
  ceilingMicros: number | null;
  /**
   * Per-region absolute prices, in each region's own currency (micros), that
   * win over whatever the strategy computes. Used to fold market-specific
   * corrections — a VAT-inclusive euro price, say — into a single preset
   * instead of a second pass. Rounding and guard rails are skipped for an
   * override: it is already the exact intended price.
   */
  overrides?: Record<RegionCode, number>;
}

// ---------------------------------------------------------------------------
// Change set
// ---------------------------------------------------------------------------

export type ChangeStatus = 'changed' | 'unchanged' | 'skipped' | 'invalid';

export interface PriceChange {
  regionCode: RegionCode;
  countryName: string;
  currency: CurrencyCode;
  currentMicros: number | null;
  newMicros: number | null;
  status: ChangeStatus;
  /** Relative change vs current, e.g. 0.1 for +10%. Null when incomparable. */
  delta: number | null;
  /** Machine-readable notes, rendered as badges/warnings in the UI. */
  issues: ChangeIssue[];
  /** Implied FX rate used, when the strategy converted across currencies. */
  rateUsed?: number;
}

export interface ChangeIssue {
  level: 'info' | 'warning' | 'error';
  code:
    | 'no-current-price'
    | 'no-rate'
    | 'below-floor'
    | 'above-ceiling'
    | 'not-positive'
    | 'rounded'
    | 'large-increase'
    | 'large-decrease'
    | 'granularity'
    | 'formula-error';
  message: string;
}

export interface ChangeSet {
  product: ProductPricing;
  changes: PriceChange[];
  summary: {
    changed: number;
    unchanged: number;
    invalid: number;
    skipped: number;
    warnings: number;
  };
}

// ---------------------------------------------------------------------------
// Presets and history
// ---------------------------------------------------------------------------

export interface Preset {
  id: string;
  name: string;
  description: string;
  config: StrategyConfig;
  /** Empty means "whatever is selected when the preset is applied". */
  regions: RegionCode[];
  createdAt: number;
}

export type OperationStatus = 'succeeded' | 'failed' | 'partial' | 'dry-run';

export interface OperationRecord {
  id: string;
  timestamp: number;
  packageName: string;
  kind: ProductKind;
  productId: string;
  basePlanId: string;
  strategyLabel: string;
  regionsAffected: number;
  status: OperationStatus;
  message: string;
  /** Prices as they were immediately before the write — powers Undo. */
  snapshot: RegionalPrice[];
  /** Regions the API rejected, with the reason we could isolate. */
  failures: { regionCode: RegionCode; reason: string }[];
  revertedBy?: string;
}
