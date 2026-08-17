import type { OperationRecord, RegionCode, RegionalPrice } from '@/types';
import { PintoError } from '@/lib/errors';
import { PlayApi, regionsInError } from '@/services/playApi';
import { log } from '@/services/logger';
import { storage } from '@/services/storage';
import type { ApplyProgress, ApplyRequest } from '@/services/messages';

export type ProgressSink = (progress: ApplyProgress) => void;

/**
 * Applies a price change set and reports honestly on what happened.
 *
 * The Play Developer API has no per-country price endpoint: one call writes
 * the whole product. That is good (the write is atomic — you never end up
 * half-priced) and awkward (a single bad country fails the entire batch with
 * a message that may not name it).
 *
 * So Pinto does this:
 *   1. Snapshot the current prices, for Undo.
 *   2. Attempt the whole change in one atomic call.
 *   3. If Play rejects it, binary-search the change set to find the exact
 *      countries responsible, and apply everything that does work.
 *
 * That turns "400 Bad Request" into "128 countries updated, 4 need your
 * attention — here they are", without ever pretending a write succeeded.
 */
export async function applyPricing(
  api: PlayApi,
  request: ApplyRequest,
  onProgress: ProgressSink,
): Promise<OperationRecord> {
  const regions = Object.keys(request.updates);
  const id = crypto.randomUUID();

  onProgress({
    phase: 'preparing',
    message: 'Reading current prices…',
    completed: 0,
    total: regions.length,
  });

  const current = await api.getPricing(
    request.packageName,
    request.kind,
    request.productId,
    request.basePlanId,
  );
  const snapshot: RegionalPrice[] = current.prices.filter((p) => regions.includes(p.regionCode));

  const base: OperationRecord = {
    id,
    timestamp: Date.now(),
    packageName: request.packageName,
    kind: request.kind,
    productId: request.productId,
    basePlanId: request.basePlanId,
    strategyLabel: request.strategyLabel,
    regionsAffected: regions.length,
    status: 'succeeded',
    message: '',
    snapshot,
    failures: [],
  };

  if (request.dryRun) {
    onProgress({
      phase: 'done',
      message: 'Dry run complete — nothing was written.',
      completed: regions.length,
      total: regions.length,
    });
    const record: OperationRecord = {
      ...base,
      status: 'dry-run',
      message: `Dry run: ${regions.length} ${plural(regions.length, 'country', 'countries')} would change. Nothing was sent to Google Play.`,
    };
    await storage.addHistory(record);
    return record;
  }

  onProgress({
    phase: 'writing',
    message: `Updating ${regions.length} ${plural(regions.length, 'country', 'countries')}…`,
    completed: 0,
    total: regions.length,
  });

  try {
    await write(api, request, request.updates);
    onProgress({
      phase: 'done',
      message: 'All prices updated.',
      completed: regions.length,
      total: regions.length,
    });
    const record: OperationRecord = {
      ...base,
      message: `Updated ${regions.length} ${plural(regions.length, 'country', 'countries')}.`,
    };
    await storage.addHistory(record);
    return record;
  } catch (error) {
    if (!(error instanceof PintoError) || !isIsolatable(error)) {
      const record: OperationRecord = {
        ...base,
        status: 'failed',
        message: error instanceof Error ? error.message : 'The update failed.',
      };
      await storage.addHistory(record);
      throw error;
    }

    log.warn('apply', 'Atomic write rejected, isolating failing regions', error.detail);
    return isolateAndApply(api, request, base, error, onProgress);
  }
}

/** 400/region errors are worth bisecting; auth and network errors are not. */
function isIsolatable(error: PintoError): boolean {
  return error.code === 'api/rejected' || error.code === 'api/region-not-configured';
}

async function isolateAndApply(
  api: PlayApi,
  request: ApplyRequest,
  base: OperationRecord,
  originalError: PintoError,
  onProgress: ProgressSink,
): Promise<OperationRecord> {
  const entries = Object.entries(request.updates) as [RegionCode, number][];
  const hinted = originalError.detail
    ? regionsInError(originalError.detail, entries.map(([code]) => code))
    : [];

  onProgress({
    phase: 'isolating',
    message: hinted.length
      ? `Google Play rejected ${hinted.length} ${plural(hinted.length, 'country', 'countries')}. Checking the rest…`
      : 'Google Play rejected the batch. Finding the countries responsible…',
    completed: 0,
    total: entries.length,
  });

  const failures: { regionCode: RegionCode; reason: string }[] = [];
  const good: [RegionCode, number][] = [];
  let checked = 0;

  const report = () =>
    onProgress({
      phase: 'isolating',
      message: `Checked ${checked} of ${entries.length}…`,
      completed: checked,
      total: entries.length,
    });

  // Bisect: a batch that applies cleanly is accepted whole, so a handful of
  // bad countries costs O(k log n) calls rather than one call per country.
  const queue: [RegionCode, number][][] = [entries];
  while (queue.length) {
    const batch = queue.shift()!;
    if (batch.length === 0) continue;
    try {
      await write(api, request, Object.fromEntries(batch));
      good.push(...batch);
      checked += batch.length;
      report();
    } catch (error) {
      if (batch.length === 1) {
        const [entry] = batch;
        failures.push({
          regionCode: entry![0],
          reason: reasonFor(error),
        });
        checked += 1;
        report();
        continue;
      }
      const mid = Math.floor(batch.length / 2);
      queue.unshift(batch.slice(0, mid), batch.slice(mid));
    }
  }

  // Each write re-reads the product and merges, so accepted batches are
  // already persisted. Rather than write again, read the product back and
  // confirm the values really landed — the user is told what is true, not what
  // was requested.
  const confirmed = new Set<RegionCode>();
  if (good.length) {
    onProgress({
      phase: 'verifying',
      message: 'Confirming the successful countries…',
      completed: good.length,
      total: entries.length,
    });
    try {
      const after = await api.getPricing(
        request.packageName,
        request.kind,
        request.productId,
        request.basePlanId,
      );
      const actual = new Map(after.prices.map((p) => [p.regionCode, p.micros]));
      for (const [region, micros] of good) {
        if (actual.get(region) === Math.round(micros)) confirmed.add(region);
        else
          failures.push({
            regionCode: region,
            reason: 'Google Play accepted the request but the price did not change.',
          });
      }
    } catch (error) {
      log.error('apply', 'Verification read failed', error);
      good.forEach(([region]) => confirmed.add(region));
    }
  }

  const record: OperationRecord = {
    ...base,
    status: confirmed.size === 0 ? 'failed' : failures.length ? 'partial' : 'succeeded',
    regionsAffected: confirmed.size,
    failures,
    message: failures.length
      ? `Updated ${confirmed.size} of ${entries.length} ${plural(entries.length, 'country', 'countries')}. ${failures.length} ${plural(failures.length, 'needs', 'need')} your attention.`
      : `Updated ${confirmed.size} ${plural(confirmed.size, 'country', 'countries')}.`,
  };

  onProgress({
    phase: 'done',
    message: record.message,
    completed: entries.length,
    total: entries.length,
  });

  await storage.addHistory(record);
  return record;
}

function write(
  api: PlayApi,
  request: ApplyRequest,
  updates: Record<RegionCode, number>,
): Promise<void> {
  return api.updatePrices(
    request.packageName,
    request.kind,
    request.productId,
    request.basePlanId,
    updates,
  );
}

function reasonFor(error: unknown): string {
  if (error instanceof PintoError) {
    return error.detail ? `${error.message} ${error.detail}`.slice(0, 300) : error.message;
  }
  return error instanceof Error ? error.message : 'Rejected by Google Play.';
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Rebuilds an apply request that restores the prices captured in a snapshot. */
export function revertRequest(record: OperationRecord): ApplyRequest {
  const updates: Record<RegionCode, number> = {};
  for (const price of record.snapshot) updates[price.regionCode] = price.micros;
  return {
    packageName: record.packageName,
    kind: record.kind,
    productId: record.productId,
    basePlanId: record.basePlanId,
    updates,
    dryRun: false,
    strategyLabel: `Revert of ${record.strategyLabel}`,
  };
}
