import type {
  RegionCode,
  RoundingMode,
  Strategy,
  StrategyConfig,
  StrategyKind,
  TierStrategy,
} from '@/types';
import type { LadderCurve } from '@/domain/regions/economicBands';
import { unitsToMicros } from '@/domain/money/money';
import { KEY_MARKETS } from '@/domain/regions/countries';

/**
 * The strategy catalogue: every kind, in the order offered, with how to start
 * one. Adding a strategy kind means adding it here, to the domain, and to the
 * dictionary — every screen reads this list instead of keeping its own.
 */
export const STRATEGY_KINDS: readonly StrategyKind[] = [
  'percentage',
  'fixed',
  'tiers',
  'copy',
  'multiplier',
  'formula',
];

/**
 * The reference market a new strategy starts from: the US when the product
 * sells there, else the first well-known market it sells in. Never the
 * alphabetically first code, which made "AE" the default reference.
 */
export function defaultBaseRegion(regions: readonly RegionCode[]): RegionCode {
  return KEY_MARKETS.find((region) => regions.includes(region)) ?? regions[0] ?? 'US';
}

/** A fresh strategy of `kind`. Tiers start empty: the ladder is generated on request. */
export function initialStrategy(kind: StrategyKind, regions: readonly RegionCode[]): Strategy {
  const base = defaultBaseRegion(regions);
  switch (kind) {
    case 'percentage':
      return { kind, percent: 0 };
    case 'multiplier':
      return { kind, factor: 1 };
    case 'fixed':
      return { kind, micros: unitsToMicros(4.99), baseRegion: base, convert: true };
    case 'copy':
      return { kind, fromRegion: base, convert: true };
    case 'tiers':
      return { kind, baseRegion: base, tiers: {}, assignment: {}, convert: true };
    case 'formula':
      return { kind, expression: 'current * 1.1', baseRegion: base };
  }
}

/**
 * True when the strategy changes nothing whatever the prices: the state the
 * workspace opens in. The first step then asks what to do rather than showing
 * a pre-armed change. Lives in the domain so the change set can honour it.
 */
export { isNeutralConfig as isNeutral } from '@/domain/pricing/neutral';

/**
 * Relative strategies apply on top of current prices, so running one twice
 * compounds. Absolute ones (a fixed price, a copy, an anchored ladder) give
 * the same result however many times they run.
 */
export function isRelative(config: StrategyConfig): boolean {
  const s = config.strategy;
  if (s.kind === 'percentage' || s.kind === 'multiplier') return true;
  if (s.kind === 'formula') return /\bcurrent\b/i.test(s.expression);
  if (s.kind === 'tiers') return s.anchorMicros == null;
  return false;
}

/** The reference country a strategy reads from, if it has one. */
export function referenceRegion(strategy: Strategy): RegionCode | null {
  switch (strategy.kind) {
    case 'fixed':
    case 'tiers':
    case 'formula':
      return strategy.baseRegion;
    case 'copy':
      return strategy.fromRegion;
    default:
      return null;
  }
}

export const ROUNDING_MODES: readonly RoundingMode[] = ['charm', 'endings', 'integer', 'none'];

export const LADDER_CURVES: readonly LadderCurve[] = ['flat', 'gentle', 'balanced', 'aggressive'];

/** One-click starting points. Formula syntax, so never translated. */
export const FORMULA_EXAMPLES: readonly string[] = [
  'current * 1.1',
  'current * 0.9',
  'min(current * 1.15, 19.99)',
  'max(current, base)',
];

/**
 * Reads "0.99, 0.49" or "0,99 ; 0,49" into [0.99, 0.49]. A bare comma is a
 * decimal separator (French), so endings are split on `;`, whitespace, or a
 * comma followed by a space. Null when any part is not a fraction in [0, 1)
 * — never a silently dropped or invented ending.
 */
export function parseEndings(text: string, parseDecimal: (text: string) => number): number[] | null {
  const parts = text.split(/\s*;\s*|,\s+|\s+/).filter(Boolean);
  if (!parts.length) return null;
  const endings: number[] = [];
  for (const part of parts) {
    const value = parseDecimal(part);
    if (!Number.isFinite(value) || value < 0 || value >= 1) return null;
    if (!endings.includes(value)) endings.push(value);
  }
  return endings.length <= 12 ? endings : null;
}

// --- Tier editing -------------------------------------------------------------
// Pure, so the editor only wires clicks to them.

export function assignToTier(strategy: TierStrategy, tier: string, regions: Iterable<RegionCode>): TierStrategy {
  const assignment = { ...strategy.assignment };
  for (const region of regions) assignment[region] = tier;
  return { ...strategy, assignment };
}

export function unassign(strategy: TierStrategy, regions: Iterable<RegionCode>): TierStrategy {
  const assignment = { ...strategy.assignment };
  for (const region of regions) delete assignment[region];
  return { ...strategy, assignment };
}

/** Removes a tier and leaves its countries in no tier (so unchanged). */
export function removeTier(strategy: TierStrategy, tier: string): TierStrategy {
  const tiers = { ...strategy.tiers };
  delete tiers[tier];
  const assignment = Object.fromEntries(
    Object.entries(strategy.assignment).filter(([, name]) => name !== tier),
  );
  return { ...strategy, tiers, assignment };
}
