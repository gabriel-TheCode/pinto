import type { ChangeIssue, CurrencyCode } from '@/types';
import { isOnGranularity } from '@/domain/money/money';
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
    issues.push({ level: 'error', code: 'not-positive' });
    return { ok: false, issues };
  }

  if (!isOnGranularity(newMicros, currency)) {
    const { decimals } = getCurrency(currency);
    issues.push(
      decimals === 0
        ? { level: 'error', code: 'granularity-whole', params: { currency } }
        : { level: 'error', code: 'granularity-minor', params: { currency, decimals } },
    );
  }

  if (!isKnownCurrency(currency)) {
    issues.push({ level: 'warning', code: 'unknown-currency', params: { currency } });
  }

  if (currentMicros != null && currentMicros > 0) {
    const delta = newMicros / currentMicros - 1;
    if (delta >= LARGE_CHANGE_THRESHOLD) {
      issues.push({
        level: 'warning',
        code: 'large-increase',
        params: { threshold: LARGE_CHANGE_THRESHOLD },
      });
    } else if (delta <= -LARGE_CHANGE_THRESHOLD) {
      issues.push({
        level: 'warning',
        code: 'large-decrease',
        params: { threshold: LARGE_CHANGE_THRESHOLD },
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
