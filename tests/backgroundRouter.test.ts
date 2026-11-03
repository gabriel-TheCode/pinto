import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplyProgress, ApplyRequest, Request, Response } from '@/services/messages';
import type { OperationRecord, ProductPricing, RegionCode } from '@/types';
import { unitsToMicros } from '@/domain/money/money';
import { storage } from '@/services/storage';
import { installChromeMock } from './chromeMock';

/**
 * The service worker's router, driven through `chrome.runtime.onMessage` the
 * way the panel drives it. Play is replaced by an in-memory product whose
 * writes can be rejected per country or held open to test the write lock.
 */

const play = vi.hoisted(() => ({
  prices: new Map<string, { currency: string; micros: number }>(),
  rejected: new Set<string>(),
  /** When set, writes wait for it, so an apply can be caught mid-flight. */
  gate: null as Promise<void> | null,
}));

vi.mock('@/services/playApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/playApi')>();
  const { PintoError } = await import('@/lib/errors');
  class FakePlayApi {
    async getPricing(): Promise<ProductPricing> {
      return {
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        label: 'premium · monthly',
        prices: [...play.prices].map(([regionCode, p]) => ({ regionCode, ...p })),
        raw: {},
      };
    }
    async updatePrices(_p: string, _k: string, _i: string, _b: string, updates: Record<RegionCode, number>) {
      if (play.gate) await play.gate;
      const bad = Object.keys(updates).filter((region) => play.rejected.has(region));
      if (bad.length) {
        throw new PintoError({ code: 'api/rejected', message: 'Rejected.', detail: `region ${bad.join(', ')}` });
      }
      for (const [region, micros] of Object.entries(updates)) {
        play.prices.set(region, { ...play.prices.get(region)!, micros });
      }
    }
  }
  return { ...original, PlayApi: FakePlayApi };
});

const chromeMock = installChromeMock();
type Listener = (message: unknown, sender: unknown, respond: (r: Response) => void) => boolean;
let listener: Listener;

beforeAll(async () => {
  await import('@/background/index');
  const calls = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls;
  listener = calls.at(-1)![0] as unknown as Listener;
});

function dispatch(request: Request): Promise<Response> {
  return new Promise((resolve) => listener(request, {}, resolve));
}

const US = unitsToMicros(4.99);

function seedPlay() {
  play.prices = new Map([
    ['US', { currency: 'USD', micros: US }],
    ['FR', { currency: 'EUR', micros: US }],
    ['JP', { currency: 'JPY', micros: unitsToMicros(800) }],
  ]);
  play.rejected = new Set();
  play.gate = null;
}

/** An earlier operation that raised US and FR to 5.49, with its snapshot. */
const ORIGINAL: OperationRecord = {
  id: 'op-original',
  timestamp: 1,
  packageName: 'com.example.app',
  kind: 'subscription',
  productId: 'premium',
  basePlanId: 'monthly',
  regionsAffected: 2,
  status: 'succeeded',
  snapshot: [
    { regionCode: 'US', currency: 'USD', micros: US },
    { regionCode: 'FR', currency: 'EUR', micros: US },
  ],
  failures: [],
};

const original = async () => (await storage.getHistory()).find((h) => h.id === ORIGINAL.id)!;

function applyRequest(updates: Record<RegionCode, number>): ApplyRequest {
  return {
    packageName: 'com.example.app',
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    updates,
    dryRun: false,
  };
}

beforeEach(async () => {
  chromeMock.reset();
  seedPlay();
  play.prices.set('US', { currency: 'USD', micros: unitsToMicros(5.49) });
  play.prices.set('FR', { currency: 'EUR', micros: unitsToMicros(5.49) });
  await storage.addHistory(ORIGINAL);
});

describe('history/revert', () => {
  it('retires the original only after a complete, confirmed restore', async () => {
    const response = await dispatch({ type: 'history/revert', operationId: ORIGINAL.id });
    expect(response.ok).toBe(true);
    const restore = (response as { data: { operation: OperationRecord } }).data.operation;
    expect(restore.status).toBe('succeeded');
    expect(restore.revertOf).toBe(ORIGINAL.id);
    expect(play.prices.get('US')!.micros).toBe(US);
    expect((await original()).revertedBy).toBe(restore.id);
  });

  it('keeps the original restorable when the restore is partial', async () => {
    play.rejected.add('FR');
    const response = await dispatch({ type: 'history/revert', operationId: ORIGINAL.id });
    const restore = (response as { data: { operation: OperationRecord } }).data.operation;
    expect(restore.status).toBe('partial');
    expect((await original()).revertedBy).toBeUndefined();
  });

  it('keeps the original restorable when only some countries were restored', async () => {
    const response = await dispatch({ type: 'history/revert', operationId: ORIGINAL.id, regions: ['US'] });
    const restore = (response as { data: { operation: OperationRecord } }).data.operation;
    expect(restore.status).toBe('succeeded');
    expect(Object.keys(restore.written ?? {})).toEqual(['US']);
    expect(play.prices.get('FR')!.micros).toBe(unitsToMicros(5.49));
    expect((await original()).revertedBy).toBeUndefined();
  });

  it('answers with a code when the operation or its snapshot is gone', async () => {
    expect(await dispatch({ type: 'history/revert', operationId: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'history/not-found' },
    });
    await storage.addHistory({ ...ORIGINAL, id: 'empty', snapshot: [] });
    expect(await dispatch({ type: 'history/revert', operationId: 'empty' })).toMatchObject({
      ok: false,
      error: { code: 'history/no-snapshot' },
    });
  });
});

describe('one write at a time', () => {
  it('reports the apply in flight, and refuses a second one until it ends', async () => {
    let release!: () => void;
    play.gate = new Promise<void>((resolve) => (release = resolve));

    const first = dispatch({ type: 'pricing/apply', request: applyRequest({ JP: unitsToMicros(900) }) });
    await vi.waitFor(async () => {
      const status = await dispatch({ type: 'apply/status' });
      expect((status as { data: ApplyProgress | null }).data?.phase).toBe('writing');
    });

    const second = await dispatch({ type: 'pricing/apply', request: applyRequest({ US: unitsToMicros(6) }) });
    expect(second).toMatchObject({ ok: false, error: { code: 'apply/busy', retryable: true } });

    release();
    expect(await first).toMatchObject({ ok: true });
    expect(await dispatch({ type: 'apply/status' })).toEqual({ ok: true, data: null });
    // The refused write never reached Play.
    expect(play.prices.get('US')!.micros).toBe(unitsToMicros(5.49));
  });

  it('releases the lock when an apply fails', async () => {
    const stale: ApplyRequest = {
      ...applyRequest({ JP: unitsToMicros(900) }),
      expected: { JP: { currency: 'JPY', micros: unitsToMicros(700) } },
    };
    expect(await dispatch({ type: 'pricing/apply', request: stale })).toMatchObject({
      ok: false,
      error: { code: 'apply/stale' },
    });
    expect(await dispatch({ type: 'pricing/apply', request: applyRequest({ JP: unitsToMicros(900) }) })).toMatchObject({
      ok: true,
    });
  });
});
