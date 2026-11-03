import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPricing, revertRequest } from '@/background/applyEngine';
import { PintoError } from '@/lib/errors';
import { storage } from '@/services/storage';
import { unitsToMicros } from '@/domain/money/money';
import type { PlayApi } from '@/services/playApi';
import type { ApplyRequest, ApplyProgress } from '@/services/messages';
import type { ProductPricing, RegionCode, StrategyConfig } from '@/types';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
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
  /** Regions Google accepts but silently does not change. */
  ignored = new Set<RegionCode>();
  writes = 0;
  reads = 0;
  /** Fail every read after this many (the verification read, typically). */
  failReadsAfter = Infinity;

  async getPricing(): Promise<ProductPricing> {
    if (++this.reads > this.failReadsAfter) {
      throw new PintoError({ code: 'api/network', message: 'Could not reach Google Play.', retryable: true });
    }
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
      if (this.ignored.has(region)) continue;
      const existing = this.prices.get(region)!;
      this.prices.set(region, { ...existing, micros });
    }
  }
}

const CONFIG: StrategyConfig = {
  strategy: { kind: 'percentage', percent: 10 },
  rounding: DEFAULT_ROUNDING,
  floorMicros: null,
  ceilingMicros: null,
};

function request(updates: Record<RegionCode, number>, dryRun = false): ApplyRequest {
  return {
    packageName: 'com.example.app',
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    updates,
    dryRun,
    config: CONFIG,
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
    // Structured, so it can be described in whichever language is current.
    expect(history[0]!.config).toEqual(CONFIG);
    expect(history[0]!.requested).toBe(1);
    expect(history[0]!.strategyLabel).toBeUndefined();
  });

  it('records the prices it asked for, so a later restore can spot edits made since', async () => {
    const play = new FakePlay();
    const updates = { US: unitsToMicros(5.49), FR: unitsToMicros(5.49) };
    const record = await applyPricing(play as unknown as PlayApi, request(updates), track);
    expect(record.written).toEqual(updates);
  });

  it('reads the product back after an accepted atomic write and reports what really landed', async () => {
    const play = new FakePlay();
    play.ignored.add('FR');
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49), FR: unitsToMicros(5.49) }),
      track,
    );
    expect(play.writes).toBe(1);
    expect(play.reads).toBe(2); // snapshot + verification
    expect(record.status).toBe('partial');
    expect(record.regionsAffected).toBe(1);
    expect(record.failures).toEqual([{ regionCode: 'FR', code: 'apply/not-applied' }]);
    expect(progress.some((event) => event.phase === 'verifying')).toBe(true);
  });

  it('records an accepted write as unverified when the read-back fails', async () => {
    const play = new FakePlay();
    play.failReadsAfter = 1;
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49), FR: unitsToMicros(5.49) }),
      track,
    );
    expect(record.status).toBe('unverified');
    // What Google accepted, flagged as unproven by the status.
    expect(record.regionsAffected).toBe(2);
    expect(record.failures).toEqual([]);
    expect((await storage.getHistory())[0]!.status).toBe('unverified');
    expect(progress.at(-1)!.phase).toBe('done');
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
    expect(record.failures).toHaveLength(1);
    expect(record.failures[0]).toMatchObject({ regionCode: 'BR', code: 'api/rejected' });
    // Google's own words, kept verbatim as technical detail.
    expect(record.failures[0]!.detail).toMatch(/BR/);
    expect(record.failures[0]!.reason).toBeUndefined();
  });

  it('stops bisecting on a rate limit and reports the rest as not attempted, with the real reason', async () => {
    const play = new FakePlay();
    play.rejected.add('BR');
    const realWrite = play.updatePrices.bind(play);
    // The atomic attempt is rejected (BR); the first bisect call is rate-limited.
    play.updatePrices = vi.fn(async (...args: Parameters<FakePlay['updatePrices']>) => {
      if (play.writes >= 1) {
        play.writes++;
        throw new PintoError({ code: 'api/rate-limited', message: 'Rate limited.', retryable: true });
      }
      return realWrite(...args);
    });

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

    // The atomic attempt, then one bisect call that hits the limit: it stops there.
    expect(play.writes).toBe(2);
    expect(record.status).toBe('failed');
    expect(record.regionsAffected).toBe(0);
    expect(record.failures.map((f) => f.regionCode).sort()).toEqual(['BR', 'DE', 'FR', 'US']);
    // Never pinned on the countries: every one carries the rate limit.
    expect(new Set(record.failures.map((f) => f.code))).toEqual(new Set(['api/rate-limited']));
    expect(play.prices.get('US')!.micros).toBe(unitsToMicros(4.99));
  });

  it('keeps what landed before an interruption', async () => {
    const play = new FakePlay();
    play.rejected.add('BR');
    const realWrite = play.updatePrices.bind(play);
    let calls = 0;
    play.updatePrices = vi.fn(async (...args: Parameters<FakePlay['updatePrices']>) => {
      calls++;
      // atomic and whole-batch retry (rejected), first half (accepted), then
      // the session expires on the second half.
      if (calls >= 4) throw new PintoError({ code: 'auth/expired', message: 'Expired.', retryable: true });
      return realWrite(...args);
    });

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
    expect(record.regionsAffected).toBe(2);
    expect(record.failures.map((f) => [f.regionCode, f.code])).toEqual([
      ['DE', 'auth/expired'],
      ['BR', 'auth/expired'],
    ]);
  });
});

describe('stale review', () => {
  it('refuses to write when a reviewed price changed in the meantime', async () => {
    const play = new FakePlay();
    const req: ApplyRequest = {
      ...request({ US: unitsToMicros(5.49), FR: unitsToMicros(5.49) }),
      expected: {
        US: { currency: 'USD', micros: unitsToMicros(4.49) }, // was 4.49 at review, 4.99 now
        FR: { currency: 'EUR', micros: unitsToMicros(4.99) },
      },
    };
    const error = await applyPricing(play as unknown as PlayApi, req, track).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PintoError);
    expect(error).toMatchObject({ code: 'apply/stale', params: { count: 1 }, detail: 'US' });
    expect(play.writes).toBe(0);
    expect(await storage.getHistory()).toEqual([]);
  });

  it('refuses to write when a country now bills in another currency', async () => {
    const play = new FakePlay();
    const req: ApplyRequest = {
      ...request({ FR: unitsToMicros(5.49) }),
      expected: { FR: { currency: 'USD', micros: unitsToMicros(4.99) } },
    };
    await expect(applyPricing(play as unknown as PlayApi, req, track)).rejects.toMatchObject({
      code: 'apply/stale',
    });
    expect(play.writes).toBe(0);
  });

  it('writes when everything still matches what was reviewed', async () => {
    const play = new FakePlay();
    const req: ApplyRequest = {
      ...request({ US: unitsToMicros(5.49) }),
      expected: { US: { currency: 'USD', micros: unitsToMicros(4.99) } },
    };
    const record = await applyPricing(play as unknown as PlayApi, req, track);
    expect(record.status).toBe('succeeded');
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
    ).rejects.toMatchObject({ code: 'auth/expired' });

    const [record] = await storage.getHistory();
    expect(record!.status).toBe('failed');
    expect(record!.regionsAffected).toBe(0);
    expect(record!.failures).toEqual([{ regionCode: 'US', code: 'auth/expired' }]);
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

  it('links the restore to the operation it reverts', async () => {
    const play = new FakePlay();
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49) }),
      track,
    );
    const restore = revertRequest(record);
    expect(restore.revertOf).toBe(record.id);
    expect(restore.dryRun).toBe(false);
    const restored = await applyPricing(play as unknown as PlayApi, restore, track);
    expect(restored.revertOf).toBe(record.id);
    expect(progress.filter((p) => p.revert).length).toBeGreaterThan(0);
  });

  it('restores only the countries asked for', async () => {
    const play = new FakePlay();
    const record = await applyPricing(
      play as unknown as PlayApi,
      request({ US: unitsToMicros(5.49), FR: unitsToMicros(5.49), DE: unitsToMicros(5.49) }),
      track,
    );
    const restore = revertRequest(record, ['FR']);
    expect(restore.updates).toEqual({ FR: unitsToMicros(4.99) });

    await applyPricing(play as unknown as PlayApi, restore, track);
    expect(play.prices.get('FR')!.micros).toBe(unitsToMicros(4.99));
    expect(play.prices.get('US')!.micros).toBe(unitsToMicros(5.49));
    expect(play.prices.get('DE')!.micros).toBe(unitsToMicros(5.49));
  });
});
