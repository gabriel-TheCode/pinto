import { create } from 'zustand';
import { useStore } from '@/app/store';
import type { Strategy, StrategyConfig, StrategyKind } from '@/types';
import { isNeutral } from './model';

/**
 * What the kind picker remembers: which card the user chose, and the last
 * parameters of every kind they tried, so switching to Fixed and back to
 * Purchasing power does not wipe a hand-edited ladder. Feature-local: the
 * app store only ever holds the one strategy in force.
 */
interface StrategyDrafts {
  /** Null until the user picks a kind: the workspace opens on "no change". */
  chosen: StrategyKind | null;
  drafts: Partial<Record<StrategyKind, Strategy>>;
}

export const useStrategyDrafts = create<StrategyDrafts>(() => ({ chosen: null, drafts: {} }));

/** Every edit goes through here: remembered as its kind's draft, then put in force. */
export function commitStrategy(strategy: Strategy): void {
  useStrategyDrafts.setState((state) => ({
    chosen: strategy.kind,
    drafts: { ...state.drafts, [strategy.kind]: strategy },
  }));
  useStore.getState().setStrategy(strategy);
}

/**
 * Follows strategies set elsewhere — a preset, "Use again", the reset to 0 %
 * after a write. A reset clears the drafts too: offering the change just
 * applied again would compound it.
 */
function follow(config: StrategyConfig): void {
  const { chosen, drafts } = useStrategyDrafts.getState();
  const strategy = config.strategy;
  if (chosen && drafts[chosen] === strategy) return;
  if (isNeutral(config)) useStrategyDrafts.setState({ chosen: null, drafts: {} });
  else useStrategyDrafts.setState({ chosen: strategy.kind, drafts: { ...drafts, [strategy.kind]: strategy } });
}

follow(useStore.getState().config);
useStore.subscribe((state, previous) => {
  if (state.productKey !== previous.productKey) {
    // Another product prices other countries: a draft's reference country may
    // not exist there, so only the strategy in force is kept.
    const { chosen, drafts } = useStrategyDrafts.getState();
    const current = chosen ? drafts[chosen] : undefined;
    useStrategyDrafts.setState({ drafts: chosen && current ? { [chosen]: current } : {} });
  }
  if (state.config.strategy !== previous.config.strategy) follow(state.config);
});
