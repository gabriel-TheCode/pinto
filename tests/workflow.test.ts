import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unitsToMicros } from '@/domain/money/money';
import type { ApplyRequest, Request } from '@/services/messages';
import type { OperationRecord, ProductPricing, RegionalPrice, StrategyConfig } from '@/types';

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
  packageName: 'com.example.app',
  prices: new Map(initialPrices.map((price) => [price.regionCode, { ...price }])),
  applied: [] as Record<string, number>[],
  requests: [] as ApplyRequest[],
  reverts: [] as Extract<Request, { type: 'history/revert' }>[],
  settingsPatches: [] as Record<string, unknown>[],
  settings: {} as Record<string, unknown>,
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
    this.packageName = 'com.example.app';
    this.prices = new Map(initialPrices.map((price) => [price.regionCode, { ...price }]));
    this.applied = [];
    this.requests = [];
    this.reverts = [];
    this.settingsPatches = [];
    this.settings = {};
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
    case 'context/setPackageName':
      if (request.type === 'context/setPackageName') backend.packageName = request.packageName;
      return {
        developerId: '1',
        consoleAppId: '42',
        packageName: backend.packageName,
        packageNameSource: 'cache',
        productKind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        url: 'https://play.google.com/console/u/0/developers/1/app/42/subscriptions/premium',
        supported: true,
      };
    case 'products/list':
      // Another app has nothing priced yet.
      if (request.packageName !== 'com.example.app') return { unavailable: [], products: [] };
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
      backend.requests.push(request.request);
      const failures = Object.keys(updates).filter((region) => backend.rejectRegions.has(region));
      if (!dryRun) {
        for (const [region, micros] of Object.entries(updates)) {
          if (backend.rejectRegions.has(region)) continue;
          backend.prices.set(region, { ...backend.prices.get(region)!, micros });
        }
      }
      const applied = Object.keys(updates).length - failures.length;
      const operation: OperationRecord = {
        id: 'op-1',
        timestamp: Date.now(),
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        ...(request.request.config ? { config: request.request.config } : {}),
        requested: Object.keys(updates).length,
        regionsAffected: applied,
        status: dryRun ? 'dry-run' : failures.length ? 'partial' : 'succeeded',
        snapshot: initialPrices.filter((price) => price.regionCode in updates),
        written: { ...updates },
        failures: failures.map((regionCode) => ({ regionCode, code: 'api/rejected' })),
      };
      return { operation };
    }
    case 'history/revert':
      backend.reverts.push(request);
      return {
        operation: {
          id: 'op-2',
          timestamp: Date.now(),
          packageName: 'com.example.app',
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'monthly',
          revertOf: request.operationId,
          regionsAffected: request.regions?.length ?? 1,
          status: 'succeeded',
          snapshot: [],
          failures: [],
        } satisfies OperationRecord,
      };
    case 'settings/get':
      return backend.settings;
    case 'settings/update':
      backend.settingsPatches.push(request.patch);
      return { ...backend.settings, ...request.patch };
    case 'pricing/convert':
      backend.convertCalls++;
      return {
        baseCurrency: 'USD',
        rates: { USD: 1, EUR: 0.9, JPY: 150 },
      };
    case 'history/list':
      return [HISTORY_ENTRY];
    case 'presets/list':
      return [];
    default:
      return null;
  }
}

const HISTORY_ENTRY: OperationRecord = {
  id: 'op-0',
  timestamp: 0,
  packageName: 'com.example.app',
  kind: 'subscription',
  productId: 'premium',
  basePlanId: 'monthly',
  regionsAffected: 2,
  status: 'succeeded',
  snapshot: initialPrices.slice(0, 2),
  failures: [],
};

const NO_ROUNDING = { mode: 'none', endings: [], zeroDecimalStep: 100 } as const;

/** A plain +10% with no rounding, so expected prices are easy to read. */
const RAISE_10: Partial<StrategyConfig> = {
  strategy: { kind: 'percentage', percent: 10 },
  rounding: { ...NO_ROUNDING, endings: [] },
};

/** Lets fire-and-forget work started by an action (settings reads, groups) settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    await useStore.getState().apply('apply');

    const sent = backend.applied[0]!;
    expect(Object.keys(sent).sort()).toEqual(['FR', 'JP']);
    for (const change of reviewed.changes.filter((c) => c.status === 'changed')) {
      expect(sent[change.regionCode]).toBe(change.newMicros);
    }
    expect(useStore.getState().lastOperation?.status).toBe('succeeded');
  });

  it('never sends a region the user did not select', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    useStore.getState().setSelection(['FR']);
    await useStore.getState().apply('apply');
    expect(Object.keys(backend.applied[0]!)).toEqual(['FR']);
  });

  it('sends what each country looked like at review, so the worker can refuse a stale write', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    useStore.getState().setSelection(['FR', 'JP']);
    await useStore.getState().apply('apply');
    const request = backend.requests[0]!;
    expect(request.expected).toEqual({
      FR: { currency: 'EUR', micros: unitsToMicros(4.99) },
      JP: { currency: 'JPY', micros: unitsToMicros(800) },
    });
    // The strategy travels as data, to be described in any language later.
    expect(request.config).toEqual(useStore.getState().config);
    expect(request.dryRun).toBe(false);
  });

  it('simulates without writing and leaves prices untouched', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    useStore.getState().setSelection(['FR']);
    await useStore.getState().apply('simulate');

    expect(backend.requests[0]!.dryRun).toBe(true);
    expect(backend.prices.get('FR')!.micros).toBe(unitsToMicros(4.99));
    expect(useStore.getState().lastOperation?.status).toBe('dry-run');
    // A simulation is not "the last change applied".
    expect(useStore.getState().recent).toBeNull();
    expect(backend.settingsPatches).toEqual([]);
  });

  it('does nothing at all when the change set is empty', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    useStore.getState().setSelection([]);
    await useStore.getState().apply('apply');
    expect(backend.applied).toHaveLength(0);
    expect(useStore.getState().progress).toBeNull();
  });

  it('does nothing while Google’s conversion table is still loading', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    useStore.setState({ conversionLoading: true });
    await useStore.getState().apply('apply');
    expect(backend.applied).toHaveLength(0);
  });

  it('never writes one app’s prices into another app', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    useStore.setState({ context: { ...useStore.getState().context!, packageName: 'com.other.app' } });
    await useStore.getState().apply('apply');
    expect(backend.applied).toHaveLength(0);
  });

  it('surfaces a partial failure with the failing regions intact', async () => {
    const useStore = await bootedStore();
    backend.rejectRegions.add('JP');
    useStore.getState().setConfig(RAISE_10);
    useStore.getState().setSelection(['FR', 'JP']);
    await useStore.getState().apply('apply');

    const operation = useStore.getState().lastOperation!;
    expect(operation.status).toBe('partial');
    expect(operation.failures).toEqual([{ regionCode: 'JP', code: 'api/rejected' }]);
  });

  it('refreshes the prices from the API after a real write, keeping the selection', async () => {
    const useStore = await bootedStore();
    useStore.getState().setSelection(['FR']);
    useStore.getState().setConfig(RAISE_10);
    await useStore.getState().apply('apply');

    const fr = useStore.getState().pricing!.prices.find((price) => price.regionCode === 'FR')!;
    expect(fr.micros).toBe(unitsToMicros(5.49));
    expect([...useStore.getState().selection]).toEqual(['FR']);
  });

  it('does not fetch a conversion table for a non-converting strategy', async () => {
    const useStore = await bootedStore();
    useStore.getState().setSelection(['FR']);
    useStore.getState().setConfig({ strategy: { kind: 'percentage', percent: 10 } });
    await useStore.getState().apply('apply');
    expect(backend.convertCalls).toBe(0);
  });

  it('reports a refused write as an error and leaves the progress view', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    const send = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = vi.fn(async (message: unknown) => {
      if ((message as Request).type === 'pricing/apply') {
        return {
          ok: false,
          error: { code: 'apply/stale', params: { count: 1 }, message: 'Stale.', retryable: true },
        };
      }
      return (send as (m: unknown) => Promise<unknown>)(message);
    }) as unknown as typeof chrome.runtime.sendMessage;

    await useStore.getState().apply('apply');
    expect(useStore.getState().error).toMatchObject({ code: 'apply/stale', params: { count: 1 } });
    expect(useStore.getState().progress).toBeNull();
    expect(useStore.getState().lastOperation).toBeNull();
  });
});

describe('the workspace opens on no change', () => {
  it('starts on the first step with a strategy that changes nothing', async () => {
    const useStore = await bootedStore();
    const { selectChangeSet } = await import('@/app/store');
    const { isNeutral } = await import('@/features/strategy/model');
    const state = useStore.getState();

    expect(state.view).toBe('workspace');
    expect(state.step).toBe('strategy');
    expect(isNeutral(state.config)).toBe(true);
    // Every priced country is selected, and none of them would change.
    const changeSet = selectChangeSet(state)!;
    expect(changeSet.summary.changed).toBe(0);
    expect(changeSet.summary.unchanged).toBe(4);
  });

  it('offers the last applied change without arming it', async () => {
    backend.settings = {
      lastConfig: { ...RAISE_10, floorMicros: null, ceilingMicros: null },
      lastAppliedAt: 1_700_000_000_000,
    };
    const useStore = await bootedStore();
    await settle();
    const { isNeutral } = await import('@/features/strategy/model');
    expect(useStore.getState().recent).toEqual({
      config: { ...RAISE_10, floorMicros: null, ceilingMicros: null },
      at: 1_700_000_000_000,
    });
    expect(isNeutral(useStore.getState().config)).toBe(true);
  });

  it('ignores a stored last change it cannot parse', async () => {
    backend.settings = { lastConfig: { strategy: { kind: 'freeform' } }, lastAppliedAt: 1 };
    const useStore = await bootedStore();
    await settle();
    expect(useStore.getState().recent).toBeNull();
  });
});

describe('after an apply', () => {
  it('shows the result, then goes back to no change when it is dismissed', async () => {
    const useStore = await bootedStore();
    const { isNeutral } = await import('@/features/strategy/model');
    useStore.getState().setConfig(RAISE_10);
    useStore.getState().setStep('review');
    await useStore.getState().apply('apply');

    expect(useStore.getState().lastOperation?.status).toBe('succeeded');
    expect(useStore.getState().progress).toBeNull();

    useStore.getState().dismissResult();
    const state = useStore.getState();
    expect(state.lastOperation).toBeNull();
    expect(state.step).toBe('strategy');
    // Running the same relative change again would compound on the new prices.
    expect(isNeutral(state.config)).toBe(true);
    // Rounding and the rest of the setup survive.
    expect(state.config.rounding).toEqual(RAISE_10.rounding);
  });

  it('keeps a simulated strategy when its result is dismissed, ready to apply for real', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    await useStore.getState().apply('simulate');
    useStore.getState().dismissResult();
    expect(useStore.getState().config.strategy).toEqual(RAISE_10.strategy);
  });

  it('remembers the change it applied, for next time', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    await useStore.getState().apply('apply');
    const { config, recent } = useStore.getState();
    expect(recent?.config).toEqual(config);
    expect(backend.settingsPatches).toEqual([{ lastConfig: config, lastAppliedAt: recent!.at }]);
  });

  it('puts the failed countries back into review', async () => {
    const useStore = await bootedStore();
    backend.rejectRegions.add('JP');
    useStore.getState().setConfig(RAISE_10);
    await useStore.getState().apply('apply');

    useStore.getState().reviewFailed();
    const state = useStore.getState();
    expect([...state.selection]).toEqual(['JP']);
    expect(state.step).toBe('review');
    expect(state.lastOperation).toBeNull();
    // The strategy is kept: the review shows the same change for those countries.
    expect(state.config.strategy).toEqual(RAISE_10.strategy);
  });
});

describe('restore', () => {
  it('restores only the countries asked for, then shows the result', async () => {
    const useStore = await bootedStore();
    await useStore.getState().loadHistory();
    useStore.getState().setView('history');

    await useStore.getState().revert('op-0', ['FR']);
    expect(backend.reverts).toEqual([{ type: 'history/revert', operationId: 'op-0', regions: ['FR'] }]);
    const state = useStore.getState();
    expect(state.view).toBe('workspace');
    expect(state.lastOperation?.revertOf).toBe('op-0');
    expect(state.progress).toBeNull();
  });

  it('restores everything when no countries are named', async () => {
    const useStore = await bootedStore();
    await useStore.getState().revert('op-0');
    expect(backend.reverts).toEqual([{ type: 'history/revert', operationId: 'op-0' }]);
  });
});

describe('switching app', () => {
  it('drops everything loaded for the previous app', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig(RAISE_10);
    useStore.getState().setStep('review');
    await useStore.getState().apply('apply');

    await useStore.getState().setPackageName('com.other.app');
    const state = useStore.getState();
    expect(state.context?.packageName).toBe('com.other.app');
    expect(state.productKey).toBeNull();
    expect(state.pricing).toBeNull();
    expect(state.selection.size).toBe(0);
    expect(state.lastOperation).toBeNull();
    expect(state.conversionTable).toBeNull();
    expect(state.step).toBe('strategy');
    expect(state.products).toEqual([]);
    expect(state.productsLoaded).toBe(true);
  });

  it('keeps the product when the detected name is merely confirmed', async () => {
    const useStore = await bootedStore();
    await useStore.getState().setPackageName('com.example.app');
    expect(useStore.getState().productKey).toBe('subscription:premium:monthly');
    expect(useStore.getState().pricing).not.toBeNull();
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

    await useStore.getState().apply('apply');
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

  it('never previews with a table fetched for another reference amount', async () => {
    const useStore = await bootedStore();
    const { selectChangeSet, conversionKeyOf } = await import('@/app/store/selectors');
    const ladder = (anchor: number): Partial<StrategyConfig> => ({
      strategy: {
        kind: 'tiers',
        baseRegion: 'US',
        anchorMicros: unitsToMicros(anchor),
        tiers: { A: 1 },
        assignment: { US: 'A', JP: 'A' },
        convert: true,
      },
      rounding: { ...NO_ROUNDING, endings: [] },
    });
    useStore.getState().setSelection(['US', 'JP']);
    useStore.getState().setConfig(ladder(10));
    await useStore.getState().ensureConversion();
    const jp = () => selectChangeSet(useStore.getState())!.changes.find((c) => c.regionCode === 'JP')!;
    expect(jp().newMicros).toBe(unitsToMicros(1500)); // 10 × Google's 150

    // The anchor moves: the loaded table no longer matches the inputs.
    useStore.getState().setConfig(ladder(20));
    expect(useStore.getState().conversionKey).not.toBe(conversionKeyOf(useStore.getState()));
    // Implied rates (800 / 4.99) until the right table arrives — never 20 × 150.
    expect(jp().newMicros).toBe(unitsToMicros(Math.round((20 * 800) / 4.99)));
    expect(jp().newMicros).not.toBe(unitsToMicros(3000));

    await useStore.getState().ensureConversion();
    expect(jp().newMicros).toBe(unitsToMicros(3000));
  });

  it('drops the table when the strategy stops converting', async () => {
    const useStore = await bootedStore();
    useStore.getState().setConfig({
      strategy: { kind: 'fixed', micros: unitsToMicros(10), baseRegion: 'US', convert: true },
    });
    await useStore.getState().ensureConversion();
    expect(useStore.getState().conversionTable).not.toBeNull();
    useStore.getState().setConfig(RAISE_10);
    await useStore.getState().ensureConversion();
    expect(useStore.getState().conversionTable).toBeNull();
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

describe('a cancelled sign-in', () => {
  it('stays signed out and keeps the reason, so the sign-in screen can explain it', async () => {
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

    // A closed window and a misconfigured redirect URI look the same to
    // Chrome; dropping the code hid the redirect-URI hint. The sign-in screen
    // words it calmly instead of showing a red banner.
    expect(useStore.getState().error?.code).toBe('auth/cancelled');
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
