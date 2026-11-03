import type { StoreApi } from 'zustand';
import type {
  OperationRecord,
  PageContext,
  Preset,
  ProductPricing,
  RegionCode,
  Strategy,
  StrategyConfig,
} from '@/types';
import type {
  ApplyProgress,
  AuthState,
  PintoErrorPayload,
  ProductCatalogue,
  ProductSummary,
} from '@/services/messages';
import type { RateTable } from '@/domain/pricing/rates';
import type { CountryFilter, CustomGroup } from '@/domain/regions/groups';
import type { LocalePreference } from '@/i18n';

/**
 * The panel's state, in slices by responsibility. Each slice owns its fields
 * and the actions that change them; actions that span slices (apply needs the
 * product, the selection and the strategy) read the whole state through `get`.
 */

/** Top-level places. The workspace is the job; the rest are side trips. */
export type View = 'workspace' | 'history' | 'settings' | 'help';

/** The three steps of a price change, in order. */
export type Step = 'strategy' | 'markets' | 'review';
export const STEPS: readonly Step[] = ['strategy', 'markets', 'review'];

export interface SessionSlice {
  ready: boolean;
  auth: AuthState | null;
  context: PageContext | null;
  /** The error currently shown in the banner, if any. */
  error: PintoErrorPayload | null;
  boot(): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  setClientId(clientId: string): Promise<boolean>;
  setPackageName(packageName: string): Promise<void>;
  refreshContext(): Promise<void>;
  setError(error: PintoErrorPayload | null): void;
  setAuth(auth: AuthState): void;
}

export interface CatalogueSlice {
  products: ProductSummary[];
  /** Product types Pinto could not list, so the UI never implies "none exist". */
  unavailable: ProductCatalogue['unavailable'];
  productsLoaded: boolean;
  /**
   * Notices about the product list the user closed. Ids include the app and
   * the exact failure, so a different problem — or the same one on another
   * app — is shown again rather than silently hidden. `persist: false` keeps
   * the close for this panel only.
   */
  dismissedNotices: string[];
  dismissNotice(id: string, options?: { persist?: boolean }): void;
  productKey: string | null;
  pricing: ProductPricing | null;
  loadingPricing: boolean;
  loadProducts(): Promise<void>;
  selectProduct(key: string): Promise<void>;
  /** `keepSelection` after an apply, so a retry targets the same countries. */
  reloadPricing(options?: { keepSelection?: boolean }): Promise<void>;
}

export interface ComposerSlice {
  step: Step;
  selection: Set<RegionCode>;
  filter: CountryFilter;
  config: StrategyConfig;
  /**
   * The last change applied, offered — never pre-armed — on the next visit.
   * Re-running a relative change compounds, so the UI says when it was used.
   */
  recent: { config: StrategyConfig; at: number } | null;
  /** Google-sourced conversion table, and the inputs it was fetched for. */
  conversionTable: RateTable | null;
  conversionKey: string | null;
  conversionLoading: boolean;
  setStep(step: Step): void;
  setFilter(patch: Partial<CountryFilter>): void;
  resetFilter(): void;
  toggleRegion(region: RegionCode): void;
  setSelection(regions: Iterable<RegionCode>): void;
  addRegions(regions: Iterable<RegionCode>): void;
  removeRegions(regions: Iterable<RegionCode>): void;
  setConfig(patch: Partial<StrategyConfig>): void;
  setStrategy(strategy: Strategy): void;
  ensureConversion(): Promise<void>;
}

export interface OperationsSlice {
  progress: ApplyProgress | null;
  /**
   * True when `progress` belongs to a write this panel did not start (found
   * running at boot): its result arrives as a "done" event, not a response.
   */
  progressAdopted: boolean;
  /** Called when an adopted write finishes: shows its result from history. */
  finishAdopted(): Promise<void>;
  /** The result being shown; cleared when the user moves on. */
  lastOperation: OperationRecord | null;
  history: OperationRecord[];
  apply(mode: 'apply' | 'simulate'): Promise<void>;
  /** Puts the failed countries back into review. */
  reviewFailed(): void;
  dismissResult(): void;
  /** Restores an operation's snapshot, optionally for some countries only. */
  revert(operationId: string, regions?: RegionCode[]): Promise<void>;
  loadHistory(): Promise<void>;
  clearHistory(): Promise<void>;
  setProgress(progress: ApplyProgress | null): void;
}

export interface LibrarySlice {
  presets: Preset[];
  groups: CustomGroup[];
  loadPresets(): Promise<void>;
  savePreset(name: string, description: string, withSelection: boolean): Promise<void>;
  deletePreset(id: string): Promise<void>;
  applyPreset(preset: Preset): void;
  importPresets(text: string): Promise<void>;
  loadGroups(): Promise<void>;
  saveGroup(label: string, members: RegionCode[]): Promise<void>;
  deleteGroup(id: string): Promise<void>;
}

export interface NavigationSlice {
  view: View;
  setView(view: View): void;
  setLocalePreference(preference: LocalePreference): Promise<void>;
}

export type State = SessionSlice &
  CatalogueSlice &
  ComposerSlice &
  OperationsSlice &
  LibrarySlice &
  NavigationSlice;

export type SetState = StoreApi<State>['setState'];
export type GetState = StoreApi<State>['getState'];
export type Slice<T> = (set: SetState, get: GetState) => T;
