import { asPayload, send } from '@/services/client';
import { writableChanges } from '@/domain/pricing/computeChangeSet';
import type { RegionCode } from '@/types';
import { selectChangeSet } from './selectors';
import type { OperationsSlice, Slice } from './types';

export const createOperationsSlice: Slice<OperationsSlice> = (set, get) => ({
  progress: null,
  progressAdopted: false,
  lastOperation: null,
  history: [],

  setProgress: (progress) => set({ progress }),

  async finishAdopted() {
    set({ progress: null, progressAdopted: false });
    await get().loadHistory();
    const [latest] = get().history;
    // The write finished elsewhere: show what it did, from its record.
    if (latest) set({ lastOperation: latest, view: 'workspace' });
    await get().reloadPricing({ keepSelection: true });
  },

  async apply(mode) {
    // One write at a time, and none while Google's rates are still loading:
    // the review waits for that table, so what is written is what was shown.
    if (get().progress || get().conversionLoading) return;
    const { pricing, context, config } = get();
    const changeSet = selectChangeSet(get());
    if (!pricing || !context?.packageName || !changeSet) return;
    // The prices on screen belong to one app; never write them into another.
    if (pricing.packageName !== context.packageName) return;

    // Exactly the rows the review showed: same pure computation, same inputs.
    const updates: Record<RegionCode, number> = {};
    const expected: Record<RegionCode, { currency: string; micros: number | null }> = {};
    for (const change of writableChanges(changeSet)) {
      updates[change.regionCode] = change.newMicros!;
      expected[change.regionCode] = { currency: change.currency, micros: change.currentMicros };
    }
    const total = Object.keys(updates).length;
    if (!total) return;

    set({ progress: { phase: 'preparing', completed: 0, total }, error: null, lastOperation: null });
    try {
      const { operation } = await send({
        type: 'pricing/apply',
        request: {
          packageName: context.packageName,
          kind: pricing.kind,
          productId: pricing.productId,
          basePlanId: pricing.basePlanId,
          updates,
          expected,
          dryRun: mode === 'simulate',
          config,
        },
      });
      set({ lastOperation: operation, progress: null });
      // A change that never landed is not offered as "your last change".
      if (mode === 'apply' && operation.status !== 'failed') {
        // Offered again next time: recurring updates are usually the same move.
        const at = Date.now();
        set({ recent: { config, at } });
        void send({ type: 'settings/update', patch: { lastConfig: config, lastAppliedAt: at } }).catch(
          () => undefined,
        );
        await get().reloadPricing({ keepSelection: true });
      }
      await get().loadHistory();
    } catch (error) {
      const payload = asPayload(error);
      // The product moved under the review: fetch what is live now, so the
      // next review starts from real prices rather than failing again. (The
      // reload clears errors, so the one explaining why comes after it.)
      if (payload.code === 'apply/stale' || payload.code === 'api/conflict') {
        await get().reloadPricing({ keepSelection: true });
      }
      set({ progress: null, error: payload });
      await get().loadHistory();
    }
  },

  reviewFailed() {
    const failed = get().lastOperation?.failures.map((failure) => failure.regionCode) ?? [];
    set({ selection: new Set(failed), lastOperation: null, step: 'review', view: 'workspace' });
  },

  dismissResult() {
    const last = get().lastOperation;
    const status = last?.status;
    // A restore never used the strategy on screen, so it leaves it alone.
    const applied =
      !last?.revertOf && (status === 'succeeded' || status === 'partial' || status === 'unverified');
    set({
      lastOperation: null,
      step: 'strategy',
      view: 'workspace',
      // After a real write the same relative change would compound on the new
      // prices, so the workspace goes back to "no change". A simulation keeps
      // its strategy (the next move is usually to apply it for real), and so
      // does a write that failed outright: nothing changed, nothing compounds.
      ...(applied ? { config: { ...get().config, strategy: { kind: 'percentage', percent: 0 } } } : {}),
    });
  },

  async revert(operationId, regions) {
    if (get().progress) return;
    const record = get().history.find((entry) => entry.id === operationId);
    const total = regions?.length ?? record?.snapshot.length ?? 0;
    set({
      view: 'workspace',
      lastOperation: null,
      error: null,
      progress: { phase: 'preparing', completed: 0, total, revert: true },
    });
    try {
      const { operation } = await send(
        regions ? { type: 'history/revert', operationId, regions } : { type: 'history/revert', operationId },
      );
      set({ lastOperation: operation, progress: null });
      await Promise.all([get().reloadPricing({ keepSelection: true }), get().loadHistory()]);
    } catch (error) {
      set({ progress: null, error: asPayload(error) });
    }
  },

  async loadHistory() {
    try {
      set({ history: (await send({ type: 'history/list' })) ?? [] });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async clearHistory() {
    try {
      await send({ type: 'history/clear' });
      set({ history: [] });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },
});
