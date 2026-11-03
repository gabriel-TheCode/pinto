import type { StrategyConfig } from '@/types';

/**
 * True when a configuration changes nothing whatever the prices: 0 %, × 1, or
 * a ladder with no country in it, and no per-country override. Pinto opens in
 * this state, and while it holds nothing is computed as changing — not even
 * the tidy-up rounding would otherwise apply to an unmoved price.
 */
export function isNeutralConfig(config: StrategyConfig): boolean {
  if (config.overrides && Object.keys(config.overrides).length) return false;
  const s = config.strategy;
  return (
    (s.kind === 'percentage' && s.percent === 0) ||
    (s.kind === 'multiplier' && s.factor === 1) ||
    (s.kind === 'tiers' && Object.keys(s.assignment).length === 0)
  );
}
