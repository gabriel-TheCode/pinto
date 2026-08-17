import type { ChangeIssue, CurrencyCode } from '@/types';
import { isOnGranularity, minorUnitMicros } from '@/domain/money/money';
import { getCurrency, isKnownCurrency } from '@/domain/money/currencies';

/** Relative change beyond which Pinto asks the user to look twice. */
export const LARGE_CHANGE_THRESHOLD = 0.5;

export interface PriceValidation {
  ok: boolean;
  issues: ChangeIssue[];
}

export function validateNewPrice(
  newMicros: number,
  currency: CurrencyCode,
  currentMicros: number | null,
): PriceValidation {
  const issues: ChangeIssue[] = [];

  if (!Number.isFinite(newMicros) || newMicros <= 0) {
    issues.push({
      level: 'error',
      code: 'not-positive',
      message: 'Price must be greater than zero. Free pricing is set on the product, not here.',
    });
    return { ok: false, issues };
  }

  if (!isOnGranularity(newMicros, currency)) {
    const { decimals } = getCurrency(currency);
    issues.push({
      level: 'error',
      code: 'granularity',
      message:
        decimals === 0
          ? `${currency} has no decimal units — the price must be a whole number.`
          : `${currency} prices must be a whole number of ${minorUnitMicros(currency) / 10000} cents (${decimals} decimals).`,
    });
  }

  if (!isKnownCurrency(currency)) {
    issues.push({
      level: 'warning',
      code: 'granularity',
      message: `Pinto has no decimal rule for ${currency}; it assumed 2 decimals. Check the result before applying.`,
    });
  }

  if (currentMicros != null && currentMicros > 0) {
    const delta = newMicros / currentMicros - 1;
    if (delta >= LARGE_CHANGE_THRESHOLD) {
      issues.push({
        level: 'warning',
        code: 'large-increase',
        message: `More than +${Math.round(LARGE_CHANGE_THRESHOLD * 100)}% versus the current price.`,
      });
    } else if (delta <= -LARGE_CHANGE_THRESHOLD) {
      issues.push({
        level: 'warning',
        code: 'large-decrease',
        message: `More than −${Math.round(LARGE_CHANGE_THRESHOLD * 100)}% versus the current price.`,
      });
    }
  }

  return { ok: !issues.some((i) => i.level === 'error'), issues };
}

export function highestLevel(issues: ChangeIssue[]): ChangeIssue['level'] | null {
  if (issues.some((i) => i.level === 'error')) return 'error';
  if (issues.some((i) => i.level === 'warning')) return 'warning';
  if (issues.length) return 'info';
  return null;
}
