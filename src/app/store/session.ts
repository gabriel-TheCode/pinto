import { asPayload, send } from '@/services/client';
import { strategyConfigSchema } from '@/domain/presets/schema';
import type { StrategyConfig } from '@/types';
import type { SessionSlice, Slice } from './types';

export const createSessionSlice: Slice<SessionSlice> = (set, get) => ({
  ready: false,
  auth: null,
  context: null,
  error: null,

  async boot() {
    try {
      const [auth, context, running] = await Promise.all([
        send({ type: 'auth/state' }),
        send({ type: 'context/get' }),
        // An apply started before this panel opened is still running in the
        // worker: show its progress rather than an editable screen.
        send({ type: 'apply/status' }).catch(() => null),
      ]);
      set({ auth, context, ready: true, progress: running ?? null, progressAdopted: !!running });
      void get().loadGroups();
      void send({ type: 'settings/get' })
        .then((settings) => {
          const last = restorable(settings.lastConfig);
          const at = typeof settings.lastAppliedAt === 'number' ? settings.lastAppliedAt : 0;
          if (last) set({ recent: { config: last, at } });
          const dismissed = settings.dismissedNotices;
          if (Array.isArray(dismissed)) {
            const stored = dismissed.filter((id): id is string => typeof id === 'string');
            set((state) => ({ dismissedNotices: [...new Set([...stored, ...state.dismissedNotices])] }));
          }
        })
        .catch(() => undefined);
      if (auth.signedIn && context.packageName) await get().loadProducts();
    } catch (error) {
      set({ ready: true, error: asPayload(error) });
    }
  },

  setError: (error) => set({ error }),
  setAuth: (auth) => set({ auth }),

  async signIn() {
    try {
      const auth = await send({ type: 'auth/signIn' });
      set({ auth, error: null });
      if (get().context?.packageName) await get().loadProducts();
    } catch (error) {
      const payload = asPayload(error);
      // Backing out of the Google window returns you to the sign-in screen;
      // the screen explains what may have happened without a red banner.
      set({ error: payload });
    }
  },

  async signOut() {
    const auth = await send({ type: 'auth/signOut' });
    set({
      auth,
      products: [],
      productsLoaded: false,
      pricing: null,
      productKey: null,
      selection: new Set(),
      view: 'workspace',
      step: 'strategy',
      lastOperation: null,
    });
  },

  async setClientId(clientId) {
    try {
      const auth = await send({ type: 'auth/setClientId', clientId });
      set({ auth, error: null });
      return true;
    } catch (error) {
      set({ error: asPayload(error) });
      return false;
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
      // Confirming the detected name changes nothing but its standing.
      if (packageName === context.packageName) {
        set({ context: next, error: null });
        return;
      }
      set({ ...forAnotherApp(), context: next, error: null });
      await get().loadProducts();
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async refreshContext() {
    try {
      const context = await send({ type: 'context/get' });
      const previous = get().context;
      if (context.packageName && context.packageName !== previous?.packageName) {
        // Navigated to another app inside Play Console: same reset as typing
        // a new package name, so nothing of the previous app can be written.
        set({ ...forAnotherApp(), context });
        await get().loadProducts();
      } else {
        set({ context });
      }
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },
});

/**
 * Everything loaded for one app. None of it may survive a switch to another,
 * or its product and prices could be written into the new package.
 */
function forAnotherApp() {
  return {
    products: [],
    unavailable: [],
    productsLoaded: false,
    productKey: null,
    pricing: null,
    selection: new Set<string>(),
    conversionTable: null,
    conversionKey: null,
    lastOperation: null,
    step: 'strategy' as const,
  };
}

/** A stored strategy is untrusted input from an older version: parse, don't cast. */
function restorable(value: unknown): StrategyConfig | null {
  const parsed = strategyConfigSchema.safeParse(value);
  return parsed.success ? (parsed.data as StrategyConfig) : null;
}
