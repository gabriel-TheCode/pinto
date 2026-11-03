import { create } from 'zustand';
import { send } from '@/services/client';
import { resolveLocale } from '@/i18n';
import { useI18n } from '@/i18n/react';
import { createSessionSlice } from './session';
import { createCatalogueSlice } from './catalogue';
import { createComposerSlice } from './composer';
import { createOperationsSlice } from './operations';
import { createLibrarySlice } from './library';
import { selectChangeSet } from './selectors';
import type { ChangeSet } from '@/types';
import type { NavigationSlice, Slice, State } from './types';

const createNavigationSlice: Slice<NavigationSlice> = (set) => ({
  view: 'workspace',
  setView: (view) => set({ view }),
  async setLocalePreference(preference) {
    // Applied at once here; persisted through the worker, which every other
    // surface hears about through storage.onChanged.
    useI18n.getState().setPreference(preference, resolveLocale(preference));
    await send({ type: 'settings/update', patch: { locale: preference } }).catch(() => undefined);
  },
});

export const useStore = create<State>()((set, get) => ({
  ...createSessionSlice(set, get),
  ...createCatalogueSlice(set, get),
  ...createComposerSlice(set, get),
  ...createOperationsSlice(set, get),
  ...createLibrarySlice(set, get),
  ...createNavigationSlice(set, get),
}));

export function useChangeSet(): ChangeSet | null {
  return useStore(selectChangeSet);
}

export { NEUTRAL_CONFIG } from './composer';
export {
  conversionKeyOf,
  conversionReference,
  currencyLookup,
  productKeyOf,
  selectChangeSet,
  splitProductKey,
} from './selectors';
export { STEPS, type State, type Step, type View } from './types';
