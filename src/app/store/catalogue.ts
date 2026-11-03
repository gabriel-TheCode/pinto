import { asPayload, send } from '@/services/client';
import { productKeyOf, splitProductKey } from './selectors';
import type { CatalogueSlice, Slice } from './types';

export const createCatalogueSlice: Slice<CatalogueSlice> = (set, get) => ({
  products: [],
  unavailable: [],
  productsLoaded: false,
  dismissedNotices: [],
  productKey: null,
  pricing: null,
  loadingPricing: false,

  async loadProducts() {
    const { context } = get();
    if (!context?.packageName) return;
    try {
      const { products, unavailable } = await send({
        type: 'products/list',
        packageName: context.packageName,
      });
      set({ products, unavailable, productsLoaded: true, error: null });

      // A retry from the workspace must not undo the user's choice of
      // product or countries.
      const current = get().productKey;
      if (current && products.some((p) => productKeyOf(p) === current)) return;

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
      set({ productsLoaded: true, error: asPayload(error) });
    }
  },

  dismissNotice(id, { persist = true } = {}) {
    set((state) => ({ dismissedNotices: [...new Set([...state.dismissedNotices, id])] }));
    if (!persist) return;
    void send({ type: 'settings/update', patch: { dismissedNotices: [id] } }).catch(() => undefined);
  },

  async selectProduct(key) {
    set({ productKey: key, pricing: null, selection: new Set(), lastOperation: null });
    await get().reloadPricing();
  },

  async reloadPricing(options = {}) {
    const { productKey, context } = get();
    if (!productKey || !context?.packageName) return;
    const [kind, productId, basePlanId] = splitProductKey(productKey);
    const packageName = context.packageName;
    // Answers can arrive out of order (arrow keys through the product list
    // fire a request per key): only the one for the current choice may land.
    const stale = () =>
      get().productKey !== productKey || get().context?.packageName !== packageName;
    set({ loadingPricing: true, error: null });
    try {
      const pricing = await send({
        type: 'products/pricing',
        packageName,
        kind,
        productId,
        basePlanId,
      });
      if (stale()) return;
      const priced = pricing.prices.map((p) => p.regionCode);
      set({
        pricing,
        loadingPricing: false,
        // A conversion table is per product, so drop it when the product
        // changes; it is refetched before markets, review and apply.
        conversionTable: null,
        conversionKey: null,
        // Updating prices across many countries is what people open Pinto
        // for, so every priced country starts selected; the markets step is
        // where the list is narrowed.
        selection: options.keepSelection
          ? new Set([...get().selection].filter((region) => priced.includes(region)))
          : new Set(priced),
      });
    } catch (error) {
      if (stale()) return;
      set({ loadingPricing: false, error: asPayload(error) });
    }
  },
});
