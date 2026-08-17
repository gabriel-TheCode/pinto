import type { CurrencyCode, RoundingConfig } from '@/types';
import { getCurrency } from '@/domain/money/currencies';
import { MICROS_PER_UNIT, snapToGranularity } from '@/domain/money/money';

export const DEFAULT_ROUNDING: RoundingConfig = {
  mode: 'charm',
  endings: [0.99, 0.49],
  zeroDecimalStep: 100,
};

/**
 * Charm endings for 2-decimal currencies.
 *
 * `.00` and `.50` are deliberately absent. They are round endings, not charm
 * ones, and including them defeated the mode entirely: a computed 1.996 sits
 * four thousandths from 2.00 and six from 1.99, so "nearest" picked the round
 * number and charm mode quietly produced 2.00, 2.50, 3.50. Someone asking for
 * charm wants the nine. Round endings remain available through the `integer`
 * mode, or by listing them explicitly under `endings`.
 */
const CHARM_ENDINGS = [0.99, 0.95, 0.9, 0.49];

/**
 * Rounds a price to a psychologically clean value **without ever moving it by
 * more than one whole unit** (or one step, for zero-decimal currencies).
 * That bound matters: a rounding rule that can silently shift a price by 30%
 * is a bug in a tool that writes real prices.
 */
export function applyRounding(
  micros: number,
  currency: CurrencyCode,
  config: RoundingConfig,
): number {
  if (config.mode === 'none') return snapToGranularity(micros, currency);

  const { decimals } = getCurrency(currency);

  if (decimals === 0) {
    const step = Math.max(1, Math.round(config.zeroDecimalStep));
    if (config.mode === 'integer') return snapToGranularity(micros, currency);
    return roundZeroDecimal(micros, step);
  }

  if (config.mode === 'integer') {
    return snapToGranularity(Math.round(micros / MICROS_PER_UNIT) * MICROS_PER_UNIT, currency);
  }

  const endings = config.mode === 'endings' ? config.endings : CHARM_ENDINGS;
  const valid = endings.filter((e) => e >= 0 && e < 1);
  if (!valid.length) return snapToGranularity(micros, currency);

  return nearestEnding(micros, valid, currency);
}

function nearestEnding(
  micros: number,
  endings: number[],
  currency: CurrencyCode,
): number {
  const whole = Math.floor(micros / MICROS_PER_UNIT);
  let best = snapToGranularity(micros, currency);
  let bestDistance = Number.POSITIVE_INFINITY;

  // Consider the ending on the unit below, the same unit, and the one above so
  // that 4.60 can become 4.99 and 4.05 can drop back to 3.99.
  //
  // Units are walked upwards and ties keep the first winner, so an amount
  // exactly between two candidates settles on the cheaper one. A pricing tool
  // should not round a developer's price up on a coin toss.
  for (const unit of [whole - 1, whole, whole + 1]) {
    if (unit < 0) continue;
    for (const ending of endings) {
      const candidate = snapToGranularity(
        unit * MICROS_PER_UNIT + Math.round(ending * MICROS_PER_UNIT),
        currency,
      );
      if (candidate <= 0) continue;
      const distance = Math.abs(candidate - micros);
      if (distance > MICROS_PER_UNIT) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  }
  return best;
}

/**
 * Zero-decimal currencies (JPY, KRW, CLP, VND, XAF…) have no cents to play
 * with, so "charm" means trailing 9s at the magnitude of the price itself:
 * 4 830 JPY -> 4 800, 128 400 VND -> 129 000.
 */
function roundZeroDecimal(micros: number, step: number): number {
  const units = micros / MICROS_PER_UNIT;
  if (units <= 0) return 0;
  const magnitudeStep = pickStep(units, step);
  const snapped = Math.round(units / magnitudeStep) * magnitudeStep;
  return Math.max(magnitudeStep, snapped) * MICROS_PER_UNIT;
}

function pickStep(units: number, configured: number): number {
  if (units < 100) return 10;
  if (units < 1_000) return Math.min(configured, 100);
  if (units < 10_000) return Math.max(configured, 100);
  if (units < 100_000) return Math.max(configured, 1_000);
  return Math.max(configured, 10_000);
}
