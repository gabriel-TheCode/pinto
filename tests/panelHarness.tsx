import { expect, vi } from 'vitest';
import { configure, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unitsToMicros } from '@/domain/money/money';
import { translator } from '@/i18n';
import type { Locale } from '@/i18n/core';
import type { CustomGroup } from '@/domain/regions/groups';
import type {
  ApplyProgress,
  AuthState,
  LogEntry,
  PintoErrorPayload,
  ProductCatalogue,
  ProductSummary,
  Request,
} from '@/services/messages';
import type { OperationRecord, PageContext, Preset, RegionCode, RegionalPrice, StrategyKind } from '@/types';

/**
 * A fake service worker for UI suites: it answers the real message contract
 * (src/services/messages.ts) from in-memory state, so the real <App/>, the real
 * store and the real change-set computation run end to end. Settings live where
 * the real worker keeps them — chrome.storage.local['pinto.settings'] — so a
 * language change reaches every surface through storage.onChanged, as in Chrome.
 */

// The whole panel boots per test; under a parallel full run the first test of a
// file also pays for transforming the module graph. Generous, not slow: these
// limits only bite when something hangs.
vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });

export const PACKAGE = 'com.example.app';
export const SETTINGS_KEY = 'pinto.settings';

export const en = translator('en');
export const fr = translator('fr');
export const tr = (locale: Locale) => translator(locale);

export function price(regionCode: RegionCode, currency: string, units: number): RegionalPrice {
  return { regionCode, currency, micros: unitsToMicros(units) };
}

export const DEFAULT_PRICES: RegionalPrice[] = [
  price('US', 'USD', 4.99),
  price('FR', 'EUR', 4.99),
  price('DE', 'EUR', 4.99),
  price('JP', 'JPY', 800),
];

export const SUBSCRIPTION: ProductSummary = {
  kind: 'subscription',
  productId: 'premium',
  basePlanId: 'monthly',
  label: 'premium · monthly',
  details: { period: 'P1M' },
  regionCount: DEFAULT_PRICES.length,
};

interface Deferred {
  promise: Promise<void>;
  release(): void;
}

export interface FakeWorker {
  /** null makes `auth/state` fail: the worker could not be reached. */
  signedIn: boolean | null;
  clientId: string | null;
  context: PageContext;
  products: ProductSummary[];
  unavailable: ProductCatalogue['unavailable'];
  prices: Map<RegionCode, RegionalPrice>;
  history: OperationRecord[];
  groups: CustomGroup[];
  presets: Preset[];
  log: LogEntry[];
  /** Google's conversion table; null makes `pricing/convert` fail (implied rates). */
  rates: Record<string, number> | null;
  applyStatus: ApplyProgress | null;
  /** Regions Google refuses on apply. */
  reject: Set<RegionCode>;
  /** Forces the status of the next real apply (e.g. `unverified`, `failed`). */
  outcome: OperationRecord['status'] | null;
  /** Request types that answer with this error. */
  failures: Partial<Record<Request['type'], PintoErrorPayload>>;
  /** Request types that wait until released. */
  holds: Map<Request['type'], Deferred>;
  requests: Request[];
  hold(type: Request['type']): () => void;
  sent<T extends Request['type']>(type: T): Extract<Request, { type: T }>[];
}

export function context(patch: Partial<PageContext> = {}): PageContext {
  return {
    developerId: '1',
    consoleAppId: '42',
    packageName: PACKAGE,
    packageNameSource: 'cache',
    productKind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    url: 'https://play.google.com/console/u/0/developers/1/app/42/subscriptions/premium',
    supported: true,
    ...patch,
  };
}

export function createWorker(prices: RegionalPrice[] = DEFAULT_PRICES): FakeWorker {
  const worker: FakeWorker = {
    signedIn: true,
    clientId: 'client-1.apps.googleusercontent.com',
    context: context(),
    products: [{ ...SUBSCRIPTION, regionCount: prices.length }],
    unavailable: [],
    prices: new Map(prices.map((p) => [p.regionCode, { ...p }])),
    history: [],
    groups: [],
    presets: [],
    log: [],
    rates: { USD: 1, EUR: 0.92, JPY: 150 },
    applyStatus: null,
    reject: new Set(),
    outcome: null,
    failures: {},
    holds: new Map(),
    requests: [],
    hold(type) {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => (release = resolve));
      worker.holds.set(type, { promise, release });
      return () => {
        worker.holds.delete(type);
        release();
      };
    },
    sent(type) {
      return worker.requests.filter((r) => r.type === type) as never;
    },
  };
  return worker;
}

function authState(worker: FakeWorker): AuthState {
  return {
    signedIn: !!worker.signedIn,
    email: 'dev@example.com',
    name: 'Dev',
    picture: null,
    expiresAt: Date.now() + 3_600_000,
    clientIdConfigured: worker.clientId !== null,
  };
}

async function readSettings(): Promise<Record<string, unknown>> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return (stored[SETTINGS_KEY] as Record<string, unknown> | undefined) ?? {};
}

let opId = 0;

async function respond(worker: FakeWorker, request: Request): Promise<unknown> {
  switch (request.type) {
    case 'auth/state':
      if (worker.signedIn === null) throw new Error('unreachable');
      return authState(worker);
    case 'auth/signIn':
      worker.signedIn = true;
      return authState(worker);
    case 'auth/signOut':
      worker.signedIn = false;
      return authState(worker);
    case 'auth/setClientId':
      worker.clientId = request.clientId;
      return authState(worker);
    case 'auth/getClientId':
      return { clientId: worker.clientId };
    case 'context/get':
      return worker.context;
    case 'context/setPackageName':
      worker.context = { ...worker.context, packageName: request.packageName, packageNameSource: 'manual' };
      return worker.context;
    case 'products/list':
      return { products: worker.products, unavailable: worker.unavailable };
    case 'products/pricing': {
      const product = worker.products.find(
        (p) => p.productId === request.productId && p.basePlanId === request.basePlanId,
      );
      return {
        packageName: request.packageName,
        kind: request.kind,
        productId: request.productId,
        basePlanId: request.basePlanId,
        label: product?.label ?? request.productId,
        ...(product?.details ? { details: product.details } : {}),
        prices: [...worker.prices.values()].map((p) => ({ ...p })),
        raw: {},
      };
    }
    case 'pricing/convert':
      if (!worker.rates) throw new Error('rates unavailable');
      return { baseCurrency: request.referenceCurrency, rates: worker.rates };
    case 'pricing/apply': {
      const { updates, dryRun, config } = request.request;
      const regions = Object.keys(updates);
      const refused = regions.filter((region) => worker.reject.has(region));
      const snapshot = regions.map((region) => ({ ...worker.prices.get(region)! }));
      if (!dryRun && worker.outcome !== 'failed') {
        for (const region of regions) {
          if (refused.includes(region)) continue;
          worker.prices.set(region, { ...worker.prices.get(region)!, micros: updates[region]! });
        }
      }
      const status: OperationRecord['status'] = dryRun
        ? 'dry-run'
        : (worker.outcome ?? (refused.length ? 'partial' : 'succeeded'));
      const failures =
        status === 'failed'
          ? regions.map((regionCode) => ({ regionCode, code: 'api/forbidden' }))
          : refused.map((regionCode) => ({ regionCode, code: 'api/region-not-configured', params: { region: regionCode } }));
      const operation: OperationRecord = {
        id: `op-${++opId}`,
        timestamp: Date.now(),
        packageName: request.request.packageName,
        kind: request.request.kind,
        productId: request.request.productId,
        basePlanId: request.request.basePlanId,
        ...(config ? { config } : {}),
        requested: regions.length,
        regionsAffected: status === 'failed' ? 0 : regions.length - refused.length,
        status,
        snapshot,
        written: { ...updates },
        failures,
      };
      worker.history = [operation, ...worker.history];
      return { operation };
    }
    case 'history/list':
      return worker.history;
    case 'history/revert': {
      const original = worker.history.find((op) => op.id === request.operationId)!;
      const targets = original.snapshot.filter((p) => !request.regions || request.regions.includes(p.regionCode));
      const snapshot = targets.map((p) => ({ ...worker.prices.get(p.regionCode)! }));
      for (const target of targets) worker.prices.set(target.regionCode, { ...target });
      const operation: OperationRecord = {
        id: `op-${++opId}`,
        timestamp: Date.now(),
        packageName: original.packageName,
        kind: original.kind,
        productId: original.productId,
        basePlanId: original.basePlanId,
        revertOf: original.id,
        requested: targets.length,
        regionsAffected: targets.length,
        status: 'succeeded',
        snapshot,
        written: Object.fromEntries(targets.map((p) => [p.regionCode, p.micros])),
        failures: [],
      };
      worker.history = [
        operation,
        ...worker.history.map((op) => (op.id === original.id ? { ...op, revertedBy: operation.id } : op)),
      ];
      return { operation };
    }
    case 'history/clear':
      worker.history = [];
      return null;
    case 'presets/list':
      return worker.presets;
    case 'presets/save':
      worker.presets = [request.preset as Preset, ...worker.presets];
      return worker.presets;
    case 'presets/delete':
      worker.presets = worker.presets.filter((p) => p.id !== request.id);
      return worker.presets;
    case 'settings/get':
      return readSettings();
    case 'settings/update': {
      const next = { ...(await readSettings()), ...request.patch };
      await chrome.storage.local.set({ [SETTINGS_KEY]: next });
      return next;
    }
    case 'groups/list':
      return worker.groups;
    case 'groups/save':
      worker.groups = [request.group as CustomGroup, ...worker.groups];
      return worker.groups;
    case 'groups/delete':
      worker.groups = worker.groups.filter((g) => g.id !== request.id);
      return worker.groups;
    case 'panel/close':
      return null;
    case 'apply/status':
      return worker.applyStatus;
    case 'log/list':
      return worker.log;
  }
}

/** Makes `worker` the extension's service worker for this test. */
export function installWorker(worker: FakeWorker): FakeWorker {
  chrome.runtime.sendMessage = vi.fn(async (message: unknown) => {
    const request = message as Request;
    worker.requests.push(request);
    const held = worker.holds.get(request.type);
    if (held) await held.promise;
    const failure = worker.failures[request.type];
    if (failure) return { ok: false, error: failure };
    try {
      return { ok: true, data: await respond(worker, request) };
    } catch (error) {
      return {
        ok: false,
        error: { code: 'runtime/disconnected', message: String(error), retryable: true },
      };
    }
  }) as unknown as typeof chrome.runtime.sendMessage;
  return worker;
}

/** Fresh module graph (stores included) and an empty chrome.storage for each test. */
export async function freshModules() {
  vi.resetModules();
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();
  const [app, store, react, core, toasts, popup] = await Promise.all([
    import('@/app/App'),
    import('@/app/store'),
    import('@/i18n/react'),
    import('@/i18n/core'),
    import('@/ui/toastStore'),
    import('@/popup/Popup'),
  ]);
  return {
    App: app.App,
    Popup: popup.Popup,
    useStore: store.useStore,
    useI18n: react.useI18n,
    missingKeys: core.missingKeys,
    toast: toasts.toast,
    useToasts: toasts.useToasts,
  };
}

export type Panel = Awaited<ReturnType<typeof freshModules>> & {
  user: ReturnType<typeof userEvent.setup>;
  t: ReturnType<typeof translator>;
};

/**
 * Renders the real panel against `worker`. With `locale`, the preference is
 * stored the way Settings stores it and applied before the first paint.
 */
export async function renderPanel(
  worker: FakeWorker,
  { locale = 'en', settings = {} }: { locale?: Locale; settings?: Record<string, unknown> } = {},
): Promise<Panel> {
  installWorker(worker);
  const modules = await freshModules();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { locale, ...settings } });
  modules.useI18n.getState().setPreference(locale, locale);
  render(<modules.App />);
  return { ...modules, user: userEvent.setup(), t: translator(locale) };
}

/** Renders the toolbar popup against `worker`. */
export async function renderPopup(worker: FakeWorker, locale: Locale = 'en'): Promise<Panel> {
  installWorker(worker);
  const modules = await freshModules();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { locale } });
  modules.useI18n.getState().setPreference(locale, locale);
  render(<modules.Popup />);
  return { ...modules, user: userEvent.setup(), t: translator(locale) };
}

export function error(code: string, params?: Record<string, string | number>): PintoErrorPayload {
  return { code, ...(params ? { params } : {}), message: `E_${code.toUpperCase()}`, retryable: true };
}

// --- Driving the panel ---------------------------------------------------------

/** Testing Library collapses whitespace (NBSP included) in the DOM, not in the matcher. */
export const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches an accessible name that starts with `text` (a label followed by its description). */
export const startsWith = (text: string) => new RegExp(`^${escape(text)}`);

/** The workspace's first step is on screen. */
export async function workspace(panel: Panel): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: panel.t('strategy.title') }, { timeout: 3000 });
}

export async function chooseKind(panel: Panel, kind: StrategyKind): Promise<void> {
  await panel.user.click(screen.getByRole('radio', { name: startsWith(panel.t(`strategy.${kind}.name`)) }));
}

/** Chooses Percentage and types the value key by key, as a person would. */
export async function choosePercent(panel: Panel, typed: string): Promise<void> {
  await chooseKind(panel, 'percentage');
  const field = screen.getByLabelText(panel.t('strategy.percentage.label'));
  await panel.user.clear(field);
  await panel.user.type(field, typed);
}

export async function toMarkets(panel: Panel): Promise<void> {
  await panel.user.click(screen.getByRole('button', { name: startsWith(panel.t('workspace.next.markets')) }));
  await screen.findByRole('heading', { level: 1, name: panel.t('markets.title') });
}

export async function toReview(panel: Panel): Promise<void> {
  await panel.user.click(screen.getByRole('button', { name: startsWith(panel.t('workspace.next.review')) }));
  await screen.findByRole('heading', { level: 1, name: panel.t('review.title') });
  // Google's rates load before the review shows its numbers.
  await waitFor(() => expect(panel.useStore.getState().conversionLoading).toBe(false));
}
