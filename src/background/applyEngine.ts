import type { OperationFailure, OperationRecord, RegionCode, RegionalPrice } from '@/types';
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
  const total = regions.length;
  const revert = !!request.revertOf;
  const id = crypto.randomUUID();

  onProgress({ phase: 'preparing', completed: 0, total, revert });

  const current = await api.getPricing(
    request.packageName,
    request.kind,
    request.productId,
    request.basePlanId,
  );
  const snapshot: RegionalPrice[] = current.prices.filter((p) => regions.includes(p.regionCode));
  assertUnchangedSinceReview(request, current.prices);

  const base: OperationRecord = {
    id,
    timestamp: Date.now(),
    packageName: request.packageName,
    kind: request.kind,
    productId: request.productId,
    basePlanId: request.basePlanId,
    requested: total,
    regionsAffected: total,
    status: 'succeeded',
    snapshot,
    written: { ...request.updates },
    failures: [],
  };
  if (request.config) base.config = request.config;
  if (request.revertOf) base.revertOf = request.revertOf;

  if (request.dryRun) {
    onProgress({ phase: 'done', completed: total, total, revert });
    const record: OperationRecord = { ...base, status: 'dry-run' };
    await storage.addHistory(record);
    return record;
  }

  onProgress({ phase: 'writing', completed: 0, total, revert });

  try {
    await write(api, request, request.updates);
  } catch (error) {
    if (!(error instanceof PintoError) || !isIsolatable(error)) {
      // A dropped connection or a 5xx can hide a write that did land. Read
      // the product back before saying nothing changed; if prices moved,
      // report what is really there (and keep it undoable).
      const landed = await landedDespite(api, request, error);
      if (landed) {
        await storage.addHistory({ ...base, ...landed });
        return { ...base, ...landed };
      }
      const record: OperationRecord = {
        ...base,
        status: 'failed',
        regionsAffected: 0,
        failures: regions.map((regionCode) => failureFrom(regionCode, error)),
      };
      await storage.addHistory(record);
      throw error;
    }

    log.warn('apply', 'Atomic write rejected, isolating failing regions', error.detail);
    return isolateAndApply(api, request, base, error, onProgress);
  }

  // Google accepted the whole batch. Accepting is not landing: read the
  // product back and count only what is really there.
  const record = await verify(api, request, base, Object.entries(request.updates), [], onProgress);
  await storage.addHistory(record);
  return record;
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
  const total = entries.length;
  const revert = !!request.revertOf;
  const hinted = originalError.detail
    ? regionsInError(originalError.detail, entries.map(([code]) => code))
    : [];

  onProgress({ phase: 'isolating', completed: 0, total, rejected: hinted.length, revert });

  const failures: OperationFailure[] = [];
  const good: [RegionCode, number][] = [];
  let checked = 0;

  const report = () =>
    onProgress({ phase: 'isolating', completed: checked, total, rejected: hinted.length, revert });

  // Bisect: a batch that applies cleanly is accepted whole, so a handful of
  // bad countries costs O(k log n) calls rather than one call per country.
  // The whole batch was just refused, so the search starts from its halves;
  // a single country refused on its own is already isolated.
  const queue: [RegionCode, number][][] = [];
  if (entries.length === 1) {
    failures.push(failureFrom(entries[0]![0], originalError));
    checked = 1;
  } else {
    const mid = Math.floor(entries.length / 2);
    queue.push(entries.slice(0, mid), entries.slice(mid));
  }
  while (queue.length) {
    const batch = queue.shift()!;
    if (batch.length === 0) continue;
    try {
      await write(api, request, Object.fromEntries(batch));
      good.push(...batch);
      checked += batch.length;
      report();
    } catch (error) {
      // A rate limit, an expired session or a dropped connection is not a
      // country's fault. Stop, keep what landed, and report the rest as not
      // attempted with the real reason — never pin it on individual countries.
      if (!(error instanceof PintoError) || !isIsolatable(error)) {
        log.warn('apply', 'Isolation interrupted', error);
        for (const pending of [batch, ...queue]) {
          for (const [region] of pending) failures.push(failureFrom(region, error));
        }
        queue.length = 0;
        break;
      }
      if (batch.length === 1) {
        failures.push(failureFrom(batch[0]![0], error));
        checked += 1;
        report();
        continue;
      }
      const mid = Math.floor(batch.length / 2);
      queue.unshift(batch.slice(0, mid), batch.slice(mid));
    }
  }

  const record = await verify(api, request, base, good, failures, onProgress);
  await storage.addHistory(record);
  return record;
}

/**
 * Reads the product back and confirms each accepted price really landed — the
 * user is told what is true, not what was requested. If that read fails, the
 * operation is recorded as `unverified`: written and accepted, but unproven.
 */
async function verify(
  api: PlayApi,
  request: ApplyRequest,
  base: OperationRecord,
  accepted: [RegionCode, number][],
  failures: OperationFailure[],
  onProgress: ProgressSink,
): Promise<OperationRecord> {
  const total = Object.keys(request.updates).length;
  const revert = !!request.revertOf;
  const confirmed = new Set<RegionCode>();
  let verified = true;

  if (accepted.length) {
    onProgress({ phase: 'verifying', completed: accepted.length, total, revert });
    try {
      const after = await api.getPricing(
        request.packageName,
        request.kind,
        request.productId,
        request.basePlanId,
      );
      const actual = new Map(after.prices.map((p) => [p.regionCode, p.micros]));
      for (const [region, micros] of accepted) {
        if (actual.get(region) === Math.round(micros)) confirmed.add(region);
        else failures.push({ regionCode: region, code: 'apply/not-applied' });
      }
    } catch (error) {
      log.error('apply', 'Verification read failed', error);
      verified = false;
    }
  }

  const status: OperationRecord['status'] = !verified
    ? 'unverified'
    : confirmed.size === 0
      ? 'failed'
      : failures.length
        ? 'partial'
        : 'succeeded';

  onProgress({ phase: 'done', completed: total, total, revert });
  return {
    ...base,
    status,
    // Unverified: what Google accepted, flagged as such by the status.
    regionsAffected: verified ? confirmed.size : accepted.length,
    failures,
  };
}

/**
 * After a write failed without an answer, which of its prices are live
 * anyway? Null when none are, or when the product cannot be read either —
 * then the failure stands as reported.
 */
async function landedDespite(
  api: PlayApi,
  request: ApplyRequest,
  error: unknown,
): Promise<Pick<OperationRecord, 'status' | 'regionsAffected' | 'failures'> | null> {
  if (error instanceof PintoError && error.code.startsWith('auth/')) return null;
  try {
    const after = await api.getPricing(
      request.packageName,
      request.kind,
      request.productId,
      request.basePlanId,
    );
    const live = new Map(after.prices.map((p) => [p.regionCode, p.micros]));
    const entries = Object.entries(request.updates);
    const confirmed = entries.filter(([region, micros]) => live.get(region) === Math.round(micros));
    if (!confirmed.length) return null;
    const missed = entries.filter(([region, micros]) => live.get(region) !== Math.round(micros));
    return {
      status: missed.length ? 'partial' : 'succeeded',
      regionsAffected: confirmed.length,
      failures: missed.map(([region]) => failureFrom(region, error)),
    };
  } catch {
    return null;
  }
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

/** A country's failure, as a code the panel can word plus Google's own text. */
function failureFrom(regionCode: RegionCode, error: unknown): OperationFailure {
  const failure: OperationFailure = { regionCode, code: 'apply/rejected' };
  if (error instanceof PintoError) {
    failure.code = error.code;
    if (error.params) failure.params = error.params;
    if (error.detail) failure.detail = error.detail.slice(0, 300);
  } else if (error instanceof Error) {
    failure.detail = error.message.slice(0, 300);
  }
  return failure;
}

/**
 * Refuses a write when the product moved since the user reviewed it: a
 * country now billed in another currency, or a price edited elsewhere in the
 * meantime. Both would make the reviewed numbers mean something else.
 */
function assertUnchangedSinceReview(request: ApplyRequest, prices: RegionalPrice[]): void {
  if (!request.expected) return;
  const live = new Map(prices.map((p) => [p.regionCode, p]));
  const moved: RegionCode[] = [];
  for (const [region, expected] of Object.entries(request.expected)) {
    const now = live.get(region);
    if (!now) continue; // not sold: the write itself names it
    if (now.currency !== expected.currency || (expected.micros != null && now.micros !== expected.micros)) {
      moved.push(region);
    }
  }
  if (moved.length) {
    throw new PintoError({
      code: 'apply/stale',
      message: `Prices changed since they were loaded: ${moved.join(', ')}`,
      params: { count: moved.length },
      detail: moved.join(', '),
      retryable: true,
    });
  }
}

/**
 * Rebuilds an apply request that restores the prices captured in a snapshot,
 * optionally for some countries only.
 */
export function revertRequest(record: OperationRecord, regions?: RegionCode[]): ApplyRequest {
  const only = regions ? new Set(regions) : null;
  const updates: Record<RegionCode, number> = {};
  // A snapshot price only means something in the currency it was taken in.
  // Prices are compared in the restore dialog; the currency is checked here.
  const expected: ApplyRequest['expected'] = {};
  for (const price of record.snapshot) {
    if (only && !only.has(price.regionCode)) continue;
    updates[price.regionCode] = price.micros;
    expected[price.regionCode] = { currency: price.currency, micros: null };
  }
  return {
    expected,
    packageName: record.packageName,
    kind: record.kind,
    productId: record.productId,
    basePlanId: record.basePlanId,
    updates,
    dryRun: false,
    revertOf: record.id,
  };
}
