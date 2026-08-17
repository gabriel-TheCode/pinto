import type { CurrencyCode } from '@/types';
import { getCurrency } from './currencies';

export const MICROS_PER_UNIT = 1_000_000;

/** Smallest representable step for a currency, in micros. JPY -> 1_000_000. */
export function minorUnitMicros(currency: CurrencyCode): number {
  const { decimals } = getCurrency(currency);
  return MICROS_PER_UNIT / 10 ** decimals;
}

/** True when the amount is a whole number of the currency's minor units. */
export function isOnGranularity(micros: number, currency: CurrencyCode): boolean {
  const step = minorUnitMicros(currency);
  return Number.isInteger(micros) && micros % step === 0;
}

/** Snap to the nearest valid minor unit. Half away from zero. */
export function snapToGranularity(micros: number, currency: CurrencyCode): number {
  const step = minorUnitMicros(currency);
  return Math.round(micros / step) * step;
}

export function unitsToMicros(units: number): number {
  return Math.round(units * MICROS_PER_UNIT);
}

export function microsToUnits(micros: number): number {
  return micros / MICROS_PER_UNIT;
}

/**
 * `Money` is the subscriptions API shape. Nanos are 1e-9 units and may be
 * negative for negative amounts; Play prices are never negative, but the
 * conversion stays sign-correct anyway.
 */
export interface ApiMoney {
  currencyCode: string;
  units: string;
  nanos: number;
}

export function microsToApiMoney(micros: number, currency: CurrencyCode): ApiMoney {
  const sign = micros < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(micros));
  const units = Math.floor(abs / MICROS_PER_UNIT);
  const nanos = (abs % MICROS_PER_UNIT) * 1000;
  return {
    currencyCode: currency,
    units: String(sign * units),
    nanos: sign * nanos,
  };
}

export function apiMoneyToMicros(money: ApiMoney | undefined | null): number {
  if (!money) return 0;
  const units = Number(money.units ?? 0);
  const nanos = Number(money.nanos ?? 0);
  return Math.round(units * MICROS_PER_UNIT + nanos / 1000);
}

/**
 * Formatting deliberately uses the currency's own decimal count rather than
 * the browser locale's idea of it, so a JPY price never renders as ¥4.99.
 */
export function formatMicros(
  micros: number | null | undefined,
  currency: CurrencyCode,
  opts: { withCode?: boolean } = {},
): string {
  if (micros == null || !Number.isFinite(micros)) return '—';
  const { decimals } = getCurrency(currency);
  const value = microsToUnits(micros);
  let body: string;
  try {
    body = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    body = value.toFixed(decimals);
  }
  return opts.withCode === false ? body : `${currency} ${body}`;
}

export function formatPercent(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return '—';
  const pct = delta * 100;
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}
