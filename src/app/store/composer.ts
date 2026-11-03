import { send } from '@/services/client';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import type { StrategyConfig } from '@/types';
import { conversionKeyOf, conversionReference } from './selectors';
import type { ComposerSlice, Slice } from './types';

/**
 * The starting strategy changes nothing: 0%. A tool that writes prices must
 * not open on a change the user never asked for — the first screen asks what
 * to do, and the footer says "no price changes yet" until they answer.
 */
export const NEUTRAL_CONFIG: StrategyConfig = {
  strategy: { kind: 'percentage', percent: 0 },
  rounding: DEFAULT_ROUNDING,
  floorMicros: null,
  ceilingMicros: null,
};

export const createComposerSlice: Slice<ComposerSlice> = (set, get) => ({
  step: 'strategy',
  selection: new Set(),
  filter: {},
  config: NEUTRAL_CONFIG,
  recent: null,
  conversionTable: null,
  conversionKey: null,
  conversionLoading: false,

  setStep(step) {
    set({ step, view: 'workspace', lastOperation: null });
    // The markets table and the review must show Google-accurate prices, so
    // fetch the conversion table for what is about to be shown.
    if (step !== 'strategy') void get().ensureConversion();
  },

  setFilter: (patch) => set((state) => ({ filter: { ...state.filter, ...patch } })),
  resetFilter: () => set({ filter: {} }),

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
      for (const region of regions) selection.add(region);
      return { selection };
    });
  },

  removeRegions(regions) {
    set((state) => {
      const selection = new Set(state.selection);
      for (const region of regions) selection.delete(region);
      return { selection };
    });
  },

  setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  setStrategy: (strategy) => set((state) => ({ config: { ...state.config, strategy } })),

  /**
   * Fetches Google's conversion table for the current strategy's reference
   * amount, if the strategy converts and the table isn't already loaded for
   * these inputs. On failure it leaves the table null and the engine falls
   * back to implied rates — degraded, never blocked.
   */
  async ensureConversion() {
    const { pricing } = get();
    const reference = conversionReference(get());
    const key = conversionKeyOf(get());
    if (!pricing || !reference || !key) {
      if (get().conversionTable || get().conversionLoading) {
        set({ conversionTable: null, conversionKey: null, conversionLoading: false });
      }
      return;
    }
    if (key === get().conversionKey && get().conversionTable) return;
    // Already fetching these exact inputs: wait for that request instead.
    if (pending?.key === key) return pending.promise;

    set({ conversionLoading: true });
    const request = send({
      type: 'pricing/convert',
      packageName: pricing.packageName,
      referenceMicros: reference.micros,
      referenceCurrency: reference.currency,
    });
    const promise = request.then(
      () => undefined,
      () => undefined,
    );
    pending = { key, promise };
    try {
      const table = await request;
      // Inputs moved on while this was in flight: a newer request owns the state.
      if (conversionKeyOf(get()) !== key) return;
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
      if (conversionKeyOf(get()) === key) {
        set({ conversionTable: null, conversionKey: null, conversionLoading: false });
      }
    } finally {
      // No newer request took over: whatever happened, loading is over.
      if (pending?.key === key) {
        pending = null;
        if (get().conversionLoading) set({ conversionLoading: false });
      }
    }
  },
});

let pending: { key: string; promise: Promise<void> } | null = null;
