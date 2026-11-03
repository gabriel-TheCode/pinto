import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPricing } from '@/background/applyEngine';
import { computeChangeSet } from '@/domain/pricing/computeChangeSet';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import { unitsToMicros } from '@/domain/money/money';
import { PintoError } from '@/lib/errors';
import type { PlayApi } from '@/services/playApi';
import type { Request } from '@/services/messages';
import type { OperationRecord, ProductPricing, RegionCode, StrategyConfig } from '@/types';

/**
 * Regressions found by the adversarial review of the redesign: each test is
 * one scenario that used to write the wrong product, freeze the panel, or
 * claim something untrue. They stay so the fixes stay.
 */

type Pending = { request: Request; resolve: (data: unknown) => void };
let pending: Pending[] = [];
let auto: (request: Request) => unknown = () => undefined;
const sent: Request[] = [];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const CONTEXT = {
  developerId: '1',
  url: 'https://play.google.com/console/u/0/developers/1/app/42/subscriptions/premium',
  supported: true,
  consoleAppId: '42',
  packageName: 'com.example.app',
  packageNameSource: 'cache',
  productKind: 'subscription',
  productId: null,
  basePlanId: null,
};

const pricingOf = (productId: string, packageName = 'com.example.app'): ProductPricing => ({
  packageName,
  kind: 'subscription',
  productId,
  basePlanId: 'monthly',
  label: productId,
  prices: [
    { regionCode: 'US', currency: 'USD', micros: 4_990_000 },
    { regionCode: 'FR', currency: 'EUR', micros: 4_990_000 },
  ],
  raw: {},
});

const PLUS_TEN: StrategyConfig = {
  strategy: { kind: 'percentage', percent: 10 },
  rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
  floorMicros: null,
  ceilingMicros: null,
};

beforeEach(() => {
  vi.resetModules();
  pending = [];
  sent.length = 0;
  auto = () => undefined;
  chrome.runtime.sendMessage = vi.fn((message: unknown) => {
    const request = message as Request;
    sent.push(request);
    const data = auto(request);
    if (data !== undefined) return Promise.resolve({ ok: true, data });
    return new Promise((resolve) =>
      pending.push({ request, resolve: (d) => resolve({ ok: true, data: d }) }),
    );
  }) as unknown as typeof chrome.runtime.sendMessage;
});

describe('store', () => {
  it('ignores a pricing answer for a product that is no longer selected', async () => {
    const { useStore } = await import('@/app/store');
    useStore.setState({ context: CONTEXT as never });
    void useStore.getState().selectProduct('subscription:alpha:monthly');
    void useStore.getState().selectProduct('subscription:beta:monthly');
    const [alpha, beta] = pending.filter((p) => p.request.type === 'products/pricing');
    beta!.resolve(pricingOf('beta'));
    await flush();
    alpha!.resolve(pricingOf('alpha'));
    await flush();

    expect(useStore.getState().productKey).toBe('subscription:beta:monthly');
    expect(useStore.getState().pricing?.productId).toBe('beta');

    useStore.setState({ config: PLUS_TEN, step: 'review' });
    auto = (r) =>
      r.type === 'pricing/apply'
        ? { operation: { id: 'x', status: 'succeeded', failures: [], snapshot: [], regionsAffected: 2 } }
        : r.type === 'history/list'
          ? []
          : r.type === 'products/pricing'
            ? pricingOf('beta')
            : {};
    await useStore.getState().apply('apply');
    const write = sent.find((r) => r.type === 'pricing/apply') as Extract<Request, { type: 'pricing/apply' }>;
    expect(write.request.productId).toBe('beta');
  });

  it('stops "loading rates" when the strategy no longer needs them mid-fetch', async () => {
    const { useStore } = await import('@/app/store');
    useStore.setState({
      context: CONTEXT as never,
      pricing: pricingOf('premium'),
      productKey: 'subscription:premium:monthly',
      selection: new Set(['US', 'FR']),
    });
    useStore.getState().setStrategy({ kind: 'fixed', micros: 9_990_000, baseRegion: 'US', convert: true });
    useStore.getState().setStep('markets');
    expect(useStore.getState().conversionLoading).toBe(true);

    useStore.getState().setStep('strategy');
    useStore.getState().setStrategy({ kind: 'percentage', percent: 10 });
    pending
      .find((p) => p.request.type === 'pricing/convert')!
      .resolve({ baseCurrency: 'USD', rates: { EUR: 0.9 } });
    await flush();
    useStore.getState().setStep('review');
    await flush();

    expect(useStore.getState().conversionLoading).toBe(false);
  });

  it('shows the result of a write it found running at boot, then lets the user go on', async () => {
    const record = { id: 'op-1', status: 'succeeded', regionsAffected: 3, failures: [], snapshot: [] };
    auto = (r) => {
      if (r.type === 'auth/state') return { signedIn: true };
      if (r.type === 'context/get') return { ...CONTEXT, packageName: null };
      if (r.type === 'apply/status') return { phase: 'writing', completed: 0, total: 3 };
      if (r.type === 'history/list') return [record];
      return [];
    };
    const { useStore } = await import('@/app/store');
    await useStore.getState().boot();
    expect(useStore.getState().progressAdopted).toBe(true);

    await useStore.getState().finishAdopted();
    const state = useStore.getState();
    expect(state.progress).toBeNull();
    expect(state.progressAdopted).toBe(false);
    expect(state.lastOperation?.id).toBe('op-1');
  });

  it('forgets the previous app when Play Console navigates to another one', async () => {
    const { useStore } = await import('@/app/store');
    useStore.setState({
      context: CONTEXT as never,
      productKey: 'subscription:premium:monthly',
      pricing: pricingOf('premium'),
      selection: new Set(['US']),
      config: PLUS_TEN,
      step: 'review',
    });
    auto = (r) => {
      if (r.type === 'context/get') return { ...CONTEXT, consoleAppId: '2', packageName: 'com.other.app' };
      if (r.type === 'products/list') return { products: [], unavailable: [] };
      return {};
    };
    await useStore.getState().refreshContext();
    const state = useStore.getState();
    expect(state.context?.packageName).toBe('com.other.app');
    expect(state.pricing).toBeNull();
    expect(state.productKey).toBeNull();
    expect(state.selection.size).toBe(0);
    expect(state.step).toBe('strategy');
  });

  it('does not offer a change that failed everywhere as "your last change"', async () => {
    const { useStore } = await import('@/app/store');
    useStore.setState({
      context: CONTEXT as never,
      pricing: pricingOf('premium'),
      productKey: 'subscription:premium:monthly',
      selection: new Set(['US', 'FR']),
      config: PLUS_TEN,
      recent: null,
    });
    auto = (r) =>
      r.type === 'pricing/apply'
        ? { operation: { id: 'f', status: 'failed', regionsAffected: 0, failures: [{ regionCode: 'US' }], snapshot: [] } }
        : r.type === 'products/pricing'
          ? pricingOf('premium')
          : [];
    await useStore.getState().apply('apply');
    expect(useStore.getState().recent).toBeNull();
    expect(sent.some((r) => r.type === 'settings/update')).toBe(false);
  });

  it('keeps the chosen product and countries when the product list is retried', async () => {
    const { useStore } = await import('@/app/store');
    const summary = { kind: 'subscription', productId: 'beta', basePlanId: 'monthly', label: 'beta', regionCount: 2 };
    useStore.setState({
      context: { ...CONTEXT, productId: 'premium' } as never,
      productKey: 'subscription:beta:monthly',
      pricing: pricingOf('beta'),
      selection: new Set(['FR']),
    });
    auto = (r) =>
      r.type === 'products/list'
        ? { products: [{ ...summary, productId: 'premium', label: 'premium' }, summary], unavailable: [] }
        : pricingOf('premium');
    await useStore.getState().loadProducts();

    const state = useStore.getState();
    expect(state.productKey).toBe('subscription:beta:monthly');
    expect([...state.selection]).toEqual(['FR']);
    expect(sent.some((r) => r.type === 'products/pricing')).toBe(false);
  });

  it('keeps the strategy on screen after a restore, which never used it', async () => {
    const { useStore } = await import('@/app/store');
    useStore.setState({
      config: PLUS_TEN,
      lastOperation: { id: 'r', status: 'succeeded', revertOf: 'op-1', failures: [], snapshot: [] } as never,
    });
    useStore.getState().dismissResult();
    expect(useStore.getState().config.strategy).toEqual({ kind: 'percentage', percent: 10 });
  });
});

describe('apply engine', () => {
  /** A Play whose write lands but whose answer is lost on the way back. */
  function lostAnswer(): PlayApi {
    const prices = new Map<RegionCode, number>([
      ['US', 4_990_000],
      ['FR', 4_990_000],
    ]);
    return {
      async getPricing() {
        return { ...pricingOf('premium'), prices: [...prices].map(([regionCode, micros]) => ({ regionCode, currency: regionCode === 'US' ? 'USD' : 'EUR', micros })) };
      },
      async updatePrices(_p: string, _k: string, _i: string, _b: string, updates: Record<RegionCode, number>) {
        for (const [region, micros] of Object.entries(updates)) prices.set(region, micros);
        throw new PintoError({ code: 'api/network', message: 'Connection reset.', retryable: true });
      },
    } as unknown as PlayApi;
  }

  it('reads back after a network error and reports the prices that did land', async () => {
    const record: OperationRecord = await applyPricing(
      lostAnswer(),
      {
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        updates: { US: 5_490_000, FR: 5_490_000 },
        dryRun: false,
      },
      () => undefined,
    );
    expect(record.status).toBe('succeeded');
    expect(record.regionsAffected).toBe(2);
    expect(record.snapshot.length).toBe(2);
  });
});

describe('pricing core', () => {
  it('blocks a 0 % tier instead of rounding it up to a token price', () => {
    const changeSet = computeChangeSet({
      product: pricingOf('premium'),
      selection: ['US', 'FR'],
      config: {
        strategy: {
          kind: 'tiers',
          baseRegion: 'US',
          tiers: { Full: 1, Free: 0 },
          assignment: { US: 'Full', FR: 'Free' },
          convert: false,
          anchorMicros: unitsToMicros(4.99),
        },
        rounding: DEFAULT_ROUNDING,
        floorMicros: null,
        ceilingMicros: null,
      },
    });
    const france = changeSet.changes.find((change) => change.regionCode === 'FR')!;
    expect(france.status).toBe('invalid');
    expect(france.issues.map((issue) => issue.code)).toContain('not-positive');
  });
});
