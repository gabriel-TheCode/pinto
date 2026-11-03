import type { Formatter } from '@/i18n';
import type { OperationRecord, ProductPricing, RegionCode, RegionalPrice } from '@/types';

export interface RestoreRow {
  region: RegionCode;
  name: string;
  current: RegionalPrice | null;
  target: RegionalPrice;
  /** Edited since this operation: restoring would undo that later change. */
  drifted: boolean;
}

/**
 * The prices a restore would write, next to the live ones. A country whose
 * price is no longer what this operation left behind was changed since — by
 * Pinto or by hand in Play Console — and is skipped unless the user asks.
 */
export function compareWithLive(record: OperationRecord, live: RegionalPrice[], fmt: Formatter): RestoreRow[] {
  const now = new Map(live.map((price) => [price.regionCode, price]));
  const failed = new Set(record.failures.map((failure) => failure.regionCode));
  return record.snapshot
    .map((target) => {
      const current = now.get(target.regionCode) ?? null;
      // Untouched since means: what this operation wrote, or the old price
      // where its write failed. Records from before 1.1 did not keep what
      // they wrote, so only their failed countries can be checked.
      const expected = failed.has(target.regionCode) ? target.micros : record.written?.[target.regionCode];
      const drifted = expected !== undefined && current?.micros !== expected;
      return { region: target.regionCode, name: fmt.region(target.regionCode), current, target, drifted };
    })
    .sort((a, b) => Number(b.drifted) - Number(a.drifted) || fmt.compare(a.name, b.name));
}

export function isSameProduct(record: OperationRecord, pricing: ProductPricing | null): pricing is ProductPricing {
  return (
    !!pricing &&
    pricing.packageName === record.packageName &&
    pricing.productId === record.productId &&
    pricing.basePlanId === record.basePlanId
  );
}
