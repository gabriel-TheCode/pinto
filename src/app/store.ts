import { create } from 'zustand';
import type {
  ChangeSet,
  OperationRecord,
  PageContext,
  Preset,
  ProductPricing,
  RegionCode,
  StrategyConfig,
} from '@/types';
import type {
  ApplyProgress,
  AuthState,
  PintoErrorPayload,
  ProductCatalogue,
  ProductSummary,
} from '@/services/messages';
import { asPayload, send } from '@/services/client';
import { computeChangeSet, describeStrategy, writableChanges } from '@/domain/pricing/computeChangeSet';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import type { RateTable } from '@/domain/pricing/rates';
import type { CountryFilter, CustomGroup } from '@/domain/regions/groups';
import { toast } from '@/components/Toast';

export type Screen = 'pricing' | 'strategy' | 'review' | 'presets' | 'history' | 'settings';

export const DEFAULT_STRATEGY: StrategyConfig = {
  strategy: { kind: 'percentage', percent: 10 },
  rounding: DEFAULT_ROUNDING,
  floorMicros: null,
  ceilingMicros: null,
};

interface State {
  ready: boolean;
  screen: Screen;
  auth: AuthState | null;
  context: PageContext | null;

  products: ProductSummary[];
  /** Product types Pinto could not list, so the UI never implies "none exist". */
  unavailable: ProductCatalogue['unavailable'];
  productKey: string | null;
  pricing: ProductPricing | null;
  loadingPricing: boolean;

  selection: Set<RegionCode>;
  filter: CountryFilter;
  config: StrategyConfig;
  dryRun: boolean;

  /** Google-sourced conversion table, and the inputs it was fetched for. */
  conversionTable: RateTable | null;
  conversionKey: string | null;
  conversionLoading: boolean;

  progress: ApplyProgress | null;
  lastOperation: OperationRecord | null;
  presets: Preset[];
  groups: CustomGroup[];
  history: OperationRecord[];
  error: PintoErrorPayload | null;

  // actions
  boot: () => Promise<void>;
  setScreen: (screen: Screen) => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setClientId: (clientId: string) => Promise<void>;
  setPackageName: (packageName: string) => Promise<void>;
  refreshContext: () => Promise<void>;
  loadProducts: () => Promise<void>;
  selectProduct: (key: string) => Promise<void>;
  reloadPricing: () => Promise<void>;

  setFilter: (patch: Partial<CountryFilter>) => void;
  toggleRegion: (region: RegionCode) => void;
  setSelection: (regions: RegionCode[]) => void;
  addRegions: (regions: RegionCode[]) => void;
  removeRegions: (regions: RegionCode[]) => void;
  clearSelection: () => void;

  setConfig: (patch: Partial<StrategyConfig>) => void;
  setDryRun: (dryRun: boolean) => void;
  ensureConversion: () => Promise<void>;

  apply: () => Promise<void>;
  loadHistory: () => Promise<void>;
  revert: (operationId: string) => Promise<void>;
  loadGroups: () => Promise<void>;
  saveGroup: (label: string, members: RegionCode[]) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  loadPresets: () => Promise<void>;
  savePreset: (name: string, description: string) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  applyPreset: (preset: Preset) => void;
  setError: (error: PintoErrorPayload | null) => void;
  setProgress: (progress: ApplyProgress | null) => void;
  setAuth: (auth: AuthState) => void;
}

export function productKeyOf(summary: {
  kind: string;
  productId: string;
  basePlanId: string;
}): string {
  return `${summary.kind}:${summary.productId}:${summary.basePlanId}`;
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  screen: 'pricing',
  auth: null,
  context: null,
  products: [],
  unavailable: [],
  productKey: null,
  pricing: null,
  loadingPricing: false,
  selection: new Set(),
  filter: {},
  config: DEFAULT_STRATEGY,
  dryRun: false,
  conversionTable: null,
  conversionKey: null,
  conversionLoading: false,
  progress: null,
  lastOperation: null,
  presets: [],
  groups: [],
  history: [],
  error: null,

  async boot() {
    try {
      const [auth, context] = await Promise.all([
        send({ type: 'auth/state' }),
        send({ type: 'context/get' }),
      ]);
      set({ auth, context, ready: true });
      void get().loadGroups();
      if (auth.signedIn && context.packageName) await get().loadProducts();
    } catch (error) {
      set({ ready: true, error: asPayload(error) });
    }
  },

  setScreen: (screen) => {
    set({ screen });
    // Entering review must show Google-accurate prices, so make sure the
    // conversion table is loaded for what's about to be reviewed.
    if (screen === 'review') void get().ensureConversion();
  },
  setError: (error) => set({ error }),
  setProgress: (progress) => set({ progress }),
  setAuth: (auth) => set({ auth }),

  async signIn() {
    try {
      const auth = await send({ type: 'auth/signIn' });
      set({ auth, error: null });
      if (get().context?.packageName) await get().loadProducts();
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async signOut() {
    const auth = await send({ type: 'auth/signOut' });
    set({ auth, products: [], pricing: null, productKey: null, selection: new Set() });
  },

  async setClientId(clientId) {
    try {
      const auth = await send({ type: 'auth/setClientId', clientId });
      set({ auth, error: null });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async setPackageName(packageName) {
    const context = get().context;
    if (!context?.consoleAppId) return;
    try {
      const next = await send({
        type: 'context/setPackageName',
        consoleAppId: context.consoleAppId,
        packageName,
      });
      set({ context: next, error: null });
      await get().loadProducts();
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async refreshContext() {
    try {
      const context = await send({ type: 'context/get' });
      const previous = get().context;
      set({ context });
      if (context.packageName && context.packageName !== previous?.packageName) {
        await get().loadProducts();
      }
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async loadProducts() {
    const { context } = get();
    if (!context?.packageName) return;
    try {
      const { products, unavailable } = await send({
        type: 'products/list',
        packageName: context.packageName,
      });
      set({ products, unavailable, error: null });

      // If the URL already names a product, open it straight away — the user
      // clicked into it in Play Console, so making them pick it again is rude.
      const fromUrl = products.find(
        (p) =>
          p.productId === context.productId &&
          (!context.basePlanId || p.basePlanId === context.basePlanId),
      );
      const target = fromUrl ?? (products.length === 1 ? products[0] : undefined);
      if (target) await get().selectProduct(productKeyOf(target));
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async selectProduct(key) {
    set({ productKey: key, pricing: null, selection: new Set() });
    await get().reloadPricing();
  },

  async reloadPricing() {
    const { productKey, context } = get();
    if (!productKey || !context?.packageName) return;
    const [kind, productId, basePlanId] = splitKey(productKey);
    set({ loadingPricing: true, error: null });
    try {
      const pricing = await send({
        type: 'products/pricing',
        packageName: context.packageName,
        kind,
        productId,
        basePlanId,
      });
      set({
        pricing,
        loadingPricing: false,
        // A conversion table is per product, so drop it when the product
        // changes; it is refetched before review and apply.
        conversionTable: null,
        conversionKey: null,
        // Opening a product with nothing selected is a dead end, and selecting
        // everything by default matches what people come here to do.
        selection: new Set(pricing.prices.map((p) => p.regionCode)),
      });
    } catch (error) {
      set({ loadingPricing: false, error: asPayload(error) });
    }
  },

  setFilter: (patch) => set((state) => ({ filter: { ...state.filter, ...patch } })),

  toggleRegion(region) {
    set((state) => {
      const selection = new Set(state.selection);
      if (selection.has(region)) selection.delete(region);
      else selection.add(region);
      return { selection };
    });
  },

  setSelection: (regions) => set({ selection: new Set(regions) }),

  addRegions(regions) {
    set((state) => {
      const selection = new Set(state.selection);
      regions.forEach((r) => selection.add(r));
      return { selection };
    });
  },

  removeRegions(regions) {
    set((state) => {
      const selection = new Set(state.selection);
      regions.forEach((r) => selection.delete(r));
      return { selection };
    });
  },

  clearSelection: () => set({ selection: new Set() }),

  setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  setDryRun: (dryRun) => set({ dryRun }),

  /**
   * Fetches Google's conversion table for the current strategy's reference
   * amount, if the strategy converts and the table isn't already loaded for
   * these inputs. Keyed so it fetches once per (product, base amount, currency)
   * and no more. On failure it silently leaves the table null, and the engine
   * falls back to implied rates — degraded, but never blocked.
   */
  async ensureConversion() {
    const { pricing } = get();
    const reference = conversionReference(get());
    if (!pricing || !reference) {
      if (get().conversionTable) set({ conversionTable: null, conversionKey: null });
      return;
    }
    const key = `${pricing.packageName}:${pricing.productId}:${reference.currency}:${reference.micros}`;
    if (key === get().conversionKey && get().conversionTable) return;

    set({ conversionLoading: true });
    try {
      const table = await send({
        type: 'pricing/convert',
        packageName: pricing.packageName,
        referenceMicros: reference.micros,
        referenceCurrency: reference.currency,
      });
      set({
        conversionTable: {
          baseCurrency: table.baseCurrency,
          baseMicros: reference.micros,
          rates: new Map(Object.entries(table.rates)),
          missing: [],
        },
        conversionKey: key,
        conversionLoading: false,
      });
    } catch {
      // Degrade to implied rates rather than surface an error mid-edit.
      set({ conversionTable: null, conversionKey: null, conversionLoading: false });
    }
  },

  async apply() {
    // Lock in Google's conversion before building the write, so the values
    // applied match the idempotent table and not the implied-rate preview.
    await get().ensureConversion();
    const { pricing, context, config, dryRun } = get();
    const changeSet = selectChangeSet(get());
    if (!pricing || !context?.packageName || !changeSet) return;

    const updates: Record<RegionCode, number> = {};
    for (const change of writableChanges(changeSet)) {
      updates[change.regionCode] = change.newMicros!;
    }
    if (!Object.keys(updates).length) return;

    set({ progress: { phase: 'preparing', message: 'Starting…', completed: 0, total: 0 }, error: null });

    try {
      const { operation } = await send({
        type: 'pricing/apply',
        request: {
          packageName: context.packageName,
          kind: pricing.kind,
          productId: pricing.productId,
          basePlanId: pricing.basePlanId,
          updates,
          dryRun,
          strategyLabel: describeStrategy(config),
        },
      });
      set({ lastOperation: operation, progress: null });
      if (!dryRun) await get().reloadPricing();
      await get().loadHistory();
      toast(operation.message, operation.status === 'succeeded' ? 'success' : 'neutral');
    } catch (error) {
      set({ progress: null, error: asPayload(error) });
    }
  },

  async loadHistory() {
    try {
      set({ history: await send({ type: 'history/list' }) });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async revert(operationId) {
    set({ progress: { phase: 'preparing', message: 'Reverting…', completed: 0, total: 0 } });
    try {
      const { operation } = await send({ type: 'history/revert', operationId });
      set({ lastOperation: operation, progress: null });
      await Promise.all([get().reloadPricing(), get().loadHistory()]);
      toast(operation.message, operation.status === 'succeeded' ? 'success' : 'neutral');
    } catch (error) {
      set({ progress: null, error: asPayload(error) });
    }
  },

  async loadGroups() {
    try {
      // A malformed or empty response must not leave `groups` unset — the
      // group bar reads its length on every render.
      set({ groups: (await send({ type: 'groups/list' })) ?? [] });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async saveGroup(label, members) {
    const group: CustomGroup = {
      id: crypto.randomUUID(),
      label,
      members,
      createdAt: Date.now(),
    };
    set({ groups: await send({ type: 'groups/save', group }) });
    toast(`Saved “${label}” — ${members.length} countries.`, 'success');
  },

  async deleteGroup(id) {
    set({ groups: await send({ type: 'groups/delete', id }) });
  },

  async loadPresets() {
    try {
      set({ presets: (await send({ type: 'presets/list' })) as Preset[] });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async savePreset(name, description) {
    const { config, selection } = get();
    const preset: Preset = {
      id: crypto.randomUUID(),
      name,
      description,
      config,
      regions: [...selection],
      createdAt: Date.now(),
    };
    const presets = (await send({ type: 'presets/save', preset })) as Preset[];
    set({ presets });
    toast(`Saved preset “${name}”.`, 'success');
  },

  async deletePreset(id) {
    const presets = (await send({ type: 'presets/delete', id })) as Preset[];
    set({ presets });
  },

  applyPreset(preset) {
    set({
      config: preset.config,
      ...(preset.regions.length ? { selection: new Set(preset.regions) } : {}),
      screen: 'strategy',
    });
    void get().ensureConversion();
    toast(`Applied “${preset.name}”.`);
  },
}));

function splitKey(key: string): ['subscription' | 'inapp', string, string] {
  const [kind, productId, basePlanId] = key.split(':');
  return [kind as 'subscription' | 'inapp', productId ?? '', basePlanId ?? ''];
}

/**
 * The change set is derived, never stored. Anything that could drift out of
 * sync with the inputs has no business being the thing the user confirms.
 * It is memoised on the exact inputs so a 140-row table is not recomputed on
 * every keystroke in an unrelated field.
 */
let cache: { key: string; value: ChangeSet } | null = null;

export function selectChangeSet(state: State): ChangeSet | null {
  const { pricing, selection, config, conversionTable, conversionKey } = state;
  if (!pricing) return null;
  const key = JSON.stringify([
    pricing.productId,
    pricing.basePlanId,
    pricing.prices,
    [...selection].sort(),
    config,
    conversionKey,
  ]);
  if (cache?.key === key) return cache.value;
  const value = computeChangeSet({
    product: pricing,
    selection: [...selection],
    config,
    conversionTable,
  });
  cache = { key, value };
  return value;
}

/**
 * The reference amount Google's conversion is fetched for: the strategy's base
 * amount in its base region's currency. Null when the strategy does not convert
 * across currencies, so no table is needed.
 */
function conversionReference(
  state: State,
): { micros: number; currency: string } | null {
  const { config, pricing } = state;
  if (!pricing) return null;
  const s = config.strategy;
  const currencyOf = (region: RegionCode) =>
    pricing.prices.find((p) => p.regionCode === region)?.currency;

  if (s.kind === 'tiers' && s.convert) {
    const currency = currencyOf(s.baseRegion) ?? 'USD';
    const micros = s.anchorMicros ?? pricing.prices.find((p) => p.regionCode === s.baseRegion)?.micros;
    return micros ? { micros, currency } : null;
  }
  if (s.kind === 'fixed' && s.convert) {
    return { micros: s.micros, currency: currencyOf(s.baseRegion) ?? 'USD' };
  }
  if (s.kind === 'copy' && s.convert) {
    const source = pricing.prices.find((p) => p.regionCode === s.fromRegion);
    return source ? { micros: source.micros, currency: source.currency } : null;
  }
  return null;
}

export function useChangeSet(): ChangeSet | null {
  return useStore(selectChangeSet);
}
