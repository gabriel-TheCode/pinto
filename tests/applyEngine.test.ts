import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPricing, revertRequest } from '@/background/applyEngine';
import { PintoError } from '@/lib/errors';
import { storage } from '@/services/storage';
import { unitsToMicros } from '@/domain/money/money';
import type { PlayApi } from '@/services/playApi';
import type { ApplyRequest, ApplyProgress } from '@/services/messages';
import type { ProductPricing, RegionCode } from '@/types';
import { installChromeMock } from './chromeMock';

const chromeMock = installChromeMock();

/**
 * A stand-in for Play that behaves like the real endpoint in the ways that
 * matter: writes are whole-product merges, and a rejected region fails the
 * entire call rather than being skipped.
 */
class FakePlay {
  prices = new Map<RegionCode, { currency: string; micros: number }>([
    ['US', { currency: 'USD', micros: unitsToMicros(4.99) }],
    ['FR', { currency: 'EUR', micros: unitsToMicros(4.99) }],
    ['DE', { currency: 'EUR', micros: unitsToMicros(4.99) }],
    ['BR', { currency: 'BRL', micros: unitsToMicros(24.9) }],
  ]);
  rejected = new Set<RegionCode>();
  writes = 0;

  async getPricing(): Promise<ProductPricing> {
    return {
      packageName: 'com.example.app',
      kind: 'subscription',
      productId: 'premium',
      basePlanId: 'monthly',
      label: 'premium · monthly',
      prices: [...this.prices].map(([regionCode, price]) => ({ regionCode, ...price })),
      raw: {},
    };
  }

  async updatePrices(
    _package: string,
    _kind: string,
    _product: string,
    _plan: string,
    updates: Record<RegionCode, number>,
  ): Promise<void> {
    this.writes++;
    const bad = Object.keys(updates).filter((region) => this.rejected.has(region));
    if (bad.length) {
      throw new PintoError({
        code: 'api/rejected',
        message: 'Google Play rejected the change.',
        detail: `Invalid price for region ${bad.join(', ')}`,
      });
    }
    for (const [region, micros] of Object.entries(updates)) {
      const existing = this.prices.get(region)!;
      this.prices.set(region, { ...existing, micros });
    }
  }
}

function request(updates: Record<RegionCode, number>, dryRun = false): ApplyRequest {
  return {
    packageName: 'com.example.app',
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    updates,
    dryRun,
    strategyLabel: '+10%',
  };
}

let progress: ApplyProgress[] = [];
const track = (event: ApplyProgress) => progress.push(event);

beforeEach(() => {
  chromeMock.reset();
  progress = [];
});

describe('happy path', () => {
  it('writes every region in a single call and records the operation', async () => {
    const play = new FakePlay();
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49), FR: unitsToMicros(5.49) }),
      track,
    );

    expect(play.writes).toBe(1);
    expect(record.status).toBe('succeeded');
    expect(record.regionsAffected).toBe(2);
    expect(play.prices.get('US')!.micros).toBe(unitsToMicros(5.49));
    expect(progress.at(-1)!.phase).toBe('done');
  });

  it('snapshots the prices as they were, so undo has something to restore', async () => {
    const play = new FakePlay();
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49) }),
      track,
    );
    expect(record.snapshot).toEqual([
      { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99), availableToNewSubscribers: undefined },
    ]);
  });

  it('stores the operation in history', async () => {
    const play = new FakePlay();
    await applyPricing(play as unknown as PlayApi, request({ US: unitsToMicros(5.49) }), track);
    const history = await storage.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.strategyLabel).toBe('+10%');
  });
});

describe('dry run', () => {
  it('sends nothing to Google Play but still records the intent', async () => {
    const play = new FakePlay();
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49), FR: unitsToMicros(5.49) }, true),
      track,
    );

    expect(play.writes).toBe(0);
    expect(record.status).toBe('dry-run');
    expect(play.prices.get('US')!.micros).toBe(unitsToMicros(4.99));
    expect((await storage.getHistory())[0]!.status).toBe('dry-run');
  });
});

describe('partial failure', () => {
  it('isolates the rejected regions and still applies everything else', async () => {
    const play = new FakePlay();
    play.rejected.add('BR');

    const record = await applyPricing(
      play as unknown as PlayApi,
      request({
        US: unitsToMicros(5.49),
        FR: unitsToMicros(5.49),
        DE: unitsToMicros(5.49),
        BR: unitsToMicros(27.4),
      }),
      track,
    );

    expect(record.status).toBe('partial');
    expect(record.failures.map((failure) => failure.regionCode)).toEqual(['BR']);
    expect(record.regionsAffected).toBe(3);
    expect(play.prices.get('US')!.micros).toBe(unitsToMicros(5.49));
    expect(play.prices.get('BR')!.micros).toBe(unitsToMicros(24.9));
    expect(progress.some((event) => event.phase === 'isolating')).toBe(true);
  });

  it('bisects instead of writing one request per country', async () => {
    const play = new FakePlay();
    play.rejected.add('BR');
    await applyPricing(
      play as unknown as PlayApi,
      request({
        US: unitsToMicros(5.49),
        FR: unitsToMicros(5.49),
        DE: unitsToMicros(5.49),
        BR: unitsToMicros(27.4),
      }),
      track,
    );
    // 1 failed atomic attempt + a handful of bisect calls, not 1 + 4.
    expect(play.writes).toBeLessThan(7);
  });

  it('reports total failure when every region is rejected', async () => {
    const play = new FakePlay();
    play.rejected.add('US');
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49) }),
      track,
    );
    expect(record.status).toBe('failed');
    expect(record.regionsAffected).toBe(0);
  });

  it('names the rejected region in the failure reason', async () => {
    const play = new FakePlay();
    play.rejected.add('BR');
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49), BR: unitsToMicros(27.4) }),
      track,
    );
    expect(record.failures[0]!.reason).toMatch(/BR/);
  });
});

describe('unrecoverable failures', () => {
  it('does not bisect an auth error — it rethrows so the UI can ask for sign-in', async () => {
    const play = new FakePlay();
    play.updatePrices = vi.fn(async () => {
      throw new PintoError({ code: 'auth/expired', message: 'Your session has expired.' });
    });

    await expect(
      applyPricing(play as unknown as PlayApi, request({ US: unitsToMicros(5.49) }), track),
    ).rejects.toThrow('Your session has expired.');

    expect((await storage.getHistory())[0]!.status).toBe('failed');
  });
});

describe('undo', () => {
  it('rebuilds a request that puts the old prices back', async () => {
    const play = new FakePlay();
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49), FR: unitsToMicros(5.49) }),
      track,
    );

    await applyPricing(play as unknown as PlayApi, revertRequest(record), track);

    expect(play.prices.get('US')!.micros).toBe(unitsToMicros(4.99));
    expect(play.prices.get('FR')!.micros).toBe(unitsToMicros(4.99));
  });
});
