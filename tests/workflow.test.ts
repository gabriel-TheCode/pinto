import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unitsToMicros } from '@/domain/money/money';
import type { Request } from '@/services/messages';
import type { ProductPricing, RegionalPrice } from '@/types';

/**
 * End-to-end through the panel's state machine: authenticate, load a product,
 * select markets, choose a strategy, review, apply. The service worker is
 * replaced by an in-memory stand-in, so this exercises the real store, the
 * real change-set computation and the real message contract.
 */

const initialPrices: RegionalPrice[] = [
  { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99) },
  { regionCode: 'FR', currency: 'EUR', micros: unitsToMicros(4.99) },
  { regionCode: 'DE', currency: 'EUR', micros: unitsToMicros(4.99) },
  { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800) },
];

const backend = {
  signedIn: true,
  prices: new Map(initialPrices.map((price) => [price.regionCode, { ...price }])),
  applied: [] as Record<string, number>[],
  rejectRegions: new Set<string>(),
  convertCalls: 0,

  pricing(): ProductPricing {
    return {
      packageName: 'com.example.app',
      kind: 'subscription',
      productId: 'premium',
      basePlanId: 'monthly',
      label: 'premium · monthly',
      prices: [...this.prices.values()],
      raw: {},
    };
  },

  reset() {
    this.signedIn = true;
    this.prices = new Map(initialPrices.map((price) => [price.regionCode, { ...price }]));
    this.applied = [];
    this.rejectRegions = new Set();
    this.convertCalls = 0;
  },
};

function respond(request: Request): unknown {
  switch (request.type) {
    case 'auth/state':
      return {
        signedIn: backend.signedIn,
        email: 'dev@example.com',
        name: 'Dev',
        picture: null,
        expiresAt: Date.now() + 3_600_000,
        clientIdConfigured: true,
      };
    case 'context/get':
      return {
        developerId: '1',
        consoleAppId: '42',
        packageName: 'com.example.app',
        packageNameSource: 'cache',
        productKind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        url: 'https://play.google.com/console/u/0/developers/1/app/42/subscriptions/premium',
        supported: true,
      };
    case 'products/list':
      return { unavailable: [], products: [
        {
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'monthly',
          label: 'premium · monthly',
          regionCount: backend.prices.size,
        },
      ] };
    case 'products/pricing':
      return backend.pricing();
    case 'pricing/apply': {
      const { updates, dryRun } = request.request;
      backend.applied.push(updates);
      const failures = Object.keys(updates).filter((region) => backend.rejectRegions.has(region));
      if (!dryRun) {
        for (const [region, micros] of Object.entries(updates)) {
          if (backend.rejectRegions.has(region)) continue;
          backend.prices.set(region, { ...backend.prices.get(region)!, micros });
        }
      }
      const applied = Object.keys(updates).length - failures.length;
      return {
        operation: {
          id: 'op-1',
          timestamp: Date.now(),
          packageName: 'com.example.app',
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'monthly',
          strategyLabel: '+10%',
          regionsAffected: applied,
          status: dryRun ? 'dry-run' : failures.length ? 'partial' : 'succeeded',
          message: dryRun ? 'Dry run complete.' : `Updated ${applied} countries.`,
          snapshot: initialPrices.filter((price) => price.regionCode in updates),
          failures: failures.map((regionCode) => ({ regionCode, reason: 'Rejected in test' })),
        },
      };
    }
    case 'pricing/convert':
      backend.convertCalls++;
      return {
        baseCurrency: 'USD',
        rates: { USD: 1, EUR: 0.9, JPY: 150 },
      };
    case 'history/list':
      return [];
    case 'presets/list':
      return [];
    default:
      return null;
  }
}

beforeEach(async () => {
  vi.resetModules();
  backend.reset();
  chrome.runtime.sendMessage = vi.fn(async (message: unknown) => ({
    ok: true,
    data: respond(message as Request),
  })) as unknown as typeof chrome.runtime.sendMessage;
});

async function bootedStore() {
  const { useStore } = await import('@/app/store');
  await useStore.getState().boot();
  return useStore;
}

describe('boot', () => {
  it('loads auth, context, products and pricing, and selects every priced market', async () => {
    const useStore = await bootedStore();
    const state = useStore.getState();

    expect(state.auth?.signedIn).toBe(true);
    expect(state.context?.packageName).toBe('com.example.app');
    expect(state.pricing?.prices).toHaveLength(4);
    expect([...state.selection].sort()).toEqual(['DE', 'FR', 'JP', 'US']);
  });

  it('opens the product named in the URL without asking the user to pick it', async () => {
    const useStore = await bootedStore();
    expect(useStore.getState().productKey).toBe('subscription:premium:monthly');
  });
});

describe('selection and strategy', () => {
  it('recomputes the change set as the selection narrows', async () => {
    const useStore = await bootedStore();
    const { selectChangeSet } = await import('@/app/store');

    useStore.getState().setSelection(['FR', 'DE']);
    useStore.getState().setConfig({
      strategy: { kind: 'percentage', percent: 10 },
      rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
    });

    const changeSet = selectChangeSet(useStore.getState())!;
    expect(changeSet.summary.changed).toBe(2);
    expect(changeSet.changes.find((c) => c.regionCode === 'US')!.status).toBe('skipped');
    expect(changeSet.changes.find((c) => c.regionCode === 'FR')!.newMicros).toBe(
      unitsToMicros(5.49),
    );
  });

  it('toggling a region in and out is symmetric', async () => {
    const useStore = await bootedStore();
    useStore.getState().toggleRegion('US');
    expect(useStore.getState().selection.has('US')).toBe(false);
    useStore.getState().toggleRegion('US');
    expect(useStore.getState().selection.has('US')).toBe(true);
  });
});

describe('apply', () => {
  it('sends exactly the rows the review screen showed as changing', async () => {
    const useStore = await bootedStore();
    const { selectChangeSet } = await import('@/app/store');

    useStore.getState().setSelection(['FR', 'JP']);
    useStore.getState().setConfig({
      strategy: { kind: 'percentage', percent: 10 },
      rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
    });

    const reviewed = selectChangeSet(useStore.getState())!;
    await useStore.getState().apply();

    const sent = backend.applied[0]!;
    expect(Object.keys(sent).sort()).toEqual(['FR', 'JP']);
    for (const change of reviewed.changes.filter((c) => c.status === 'changed')) {
      expect(sent[change.regionCode]).toBe(change.newMicros);
    }
    expect(useStore.getState().lastOperation?.status).toBe('succeeded');
  });

  it('never sends a region the user did not select', async () => {
    const useStore = await bootedStore();
    useStore.getState().setSelection(['FR']);
    await useStore.getState().apply();
    expect(Object.keys(backend.applied[0]!)).toEqual(['FR']);
  });

  it('sends nothing in dry-run mode and leaves prices untouched', async () => {
    const useStore = await bootedStore();
    useStore.getState().setDryRun(true);
    useStore.getState().setSelection(['FR']);
    await useStore.getState().apply();

    expect(backend.prices.get('FR')!.micros).toBe(unitsToMicros(4.99));
    expect(useStore.getState().lastOperation?.status).toBe('dry-run');
  });

  it('does nothing at all when the change set is empty', async () => {
    const useStore = await bootedStore();
    useStore.getState().setSelection([]);
    await useStore.getState().apply();
    expect(backend.applied).toHaveLength(0);
  });

  it('surfaces a partial failure with the failing regions intact', async () => {
    const useStore = await bootedStore();
    backend.rejectRegions.add('JP');
    useStore.getState().setSelection(['FR', 'JP']);
    await useStore.getState().apply();

    const operation = useStore.getState().lastOperation!;
    expect(operation.status).toBe('partial');
    expect(operation.failures.map((failure) => failure.regionCode)).toEqual(['JP']);
  });

  it('refreshes the prices from the API after a real write', async () => {
    const useStore = await bootedStore();
    useStore.getState().setSelection(['FR']);
    useStore.getState().setConfig({
      strategy: { kind: 'percentage', percent: 10 },
      rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
    });
    await useStore.getState().apply();

    const fr = useStore.getState().pricing!.prices.find((price) => price.regionCode === 'FR')!;
    expect(fr.micros).toBe(unitsToMicros(5.49));
  });

  it('does not fetch a conversion table for a non-converting strategy', async () => {
    const useStore = await bootedStore();
    useStore.getState().setSelection(['FR']);
    useStore.getState().setConfig({ strategy: { kind: 'percentage', percent: 10 } });
    await useStore.getState().apply();
    expect(backend.convertCalls).toBe(0);
  });
});

describe('Google conversion for converting strategies', () => {
  it('fetches Google’s table before applying a converting ladder, and uses it', async () => {
    const useStore = await bootedStore();

    useStore.getState().setSelection(['US', 'JP']);
    useStore.getState().setConfig({
      strategy: {
        kind: 'tiers',
        baseRegion: 'US',
        anchorMicros: unitsToMicros(10),
        tiers: { A: 1 },
        assignment: { US: 'A', JP: 'A' },
        convert: true,
      },
      rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
    });

    await useStore.getState().ensureConversion();
    expect(backend.convertCalls).toBeGreaterThan(0);
    expect(useStore.getState().conversionTable?.rates.get('JPY')).toBe(150);

    await useStore.getState().apply();
    // JP = anchor(10) x rate(150) = 1500 JPY, from Google's table.
    const sent = backend.applied.at(-1)!;
    expect(sent.JP).toBe(unitsToMicros(1500));
  });

  it('caches the table — a second apply with the same inputs refetches nothing', async () => {
    const useStore = await bootedStore();
    useStore.getState().setSelection(['US', 'JP']);
    useStore.getState().setConfig({
      strategy: {
        kind: 'tiers',
        baseRegion: 'US',
        anchorMicros: unitsToMicros(10),
        tiers: { A: 1 },
        assignment: { US: 'A', JP: 'A' },
        convert: true,
      },
      rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
    });

    await useStore.getState().ensureConversion();
    const after = backend.convertCalls;
    await useStore.getState().ensureConversion();
    expect(backend.convertCalls).toBe(after);
  });
});

describe('error handling', () => {
  it('keeps a failed request out of the UI as a payload, not an exception', async () => {
    const { useStore } = await import('@/app/store');
    chrome.runtime.sendMessage = vi.fn(async () => ({
      ok: false,
      error: {
        code: 'auth/expired',
        message: 'Your session has expired.',
        hint: 'Sign in again.',
        retryable: true,
      },
    })) as unknown as typeof chrome.runtime.sendMessage;

    await useStore.getState().boot();
    expect(useStore.getState().error?.code).toBe('auth/expired');
    expect(useStore.getState().ready).toBe(true);
  });

  it('reports a disconnected extension instead of throwing', async () => {
    const { useStore } = await import('@/app/store');
    chrome.runtime.sendMessage = vi.fn(async () => {
      throw new Error('Could not establish connection');
    }) as unknown as typeof chrome.runtime.sendMessage;

    await useStore.getState().boot();
    expect(useStore.getState().error?.code).toBe('runtime/disconnected');
  });
});

describe('a cancelled sign-in is not a failure', () => {
  it('leaves the panel on the sign-in screen without an error banner', async () => {
    const { useStore } = await import('@/app/store');
    chrome.runtime.sendMessage = vi.fn(async (message: unknown) => {
      if ((message as Request).type === 'auth/signIn') {
        return {
          ok: false,
          error: {
            code: 'auth/cancelled',
            message: 'Sign-in did not complete.',
            retryable: true,
          },
        };
      }
      return { ok: true, data: respond(message as Request) };
    }) as unknown as typeof chrome.runtime.sendMessage;

    await useStore.getState().signIn();

    // Closing the Google window is a decision, not something to alarm about.
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().auth?.signedIn).toBeFalsy();
  });

  it('still surfaces a genuine sign-in failure', async () => {
    const { useStore } = await import('@/app/store');
    chrome.runtime.sendMessage = vi.fn(async (message: unknown) => {
      if ((message as Request).type === 'auth/signIn') {
        return {
          ok: false,
          error: { code: 'auth/denied', message: 'Google did not grant access.', retryable: false },
        };
      }
      return { ok: true, data: respond(message as Request) };
    }) as unknown as typeof chrome.runtime.sendMessage;

    await useStore.getState().signIn();
    expect(useStore.getState().error?.code).toBe('auth/denied');
  });
});
