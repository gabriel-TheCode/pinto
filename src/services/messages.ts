import type {
  ChangeSet,
  OperationRecord,
  PageContext,
  ProductDetails,
  ProductKind,
  ProductPricing,
  RegionCode,
  StrategyConfig,
} from '@/types';
import type { CustomGroup } from '@/domain/regions/groups';

/**
 * Every cross-context call in Pinto goes through this one discriminated union.
 * Content script, panel, popup and service worker all speak it, so adding a
 * capability means adding a case here and nowhere else.
 */

export interface AuthState {
  signedIn: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
  expiresAt: number | null;
  /** OAuth client id configured by the user; null means setup is incomplete. */
  clientIdConfigured: boolean;
}

export interface ProductSummary {
  kind: ProductKind;
  productId: string;
  basePlanId: string;
  /** Technical label built from ids only; the interface adds the words. */
  label: string;
  details?: ProductDetails;
  regionCount: number;
}

/**
 * Listing subscriptions and one-time products are two independent calls, and
 * either can fail on its own — different Play Console permissions, different
 * API surfaces. Returning a bare array would make a failed call
 * indistinguishable from an app that simply has none of that product type,
 * which is exactly the kind of silence a pricing tool cannot afford.
 */
export interface ProductCatalogue {
  products: ProductSummary[];
  unavailable: { kind: ProductKind; code: string; params?: Record<string, string | number> }[];
}

export interface ApplyRequest {
  packageName: string;
  kind: ProductKind;
  productId: string;
  basePlanId: string;
  /** Region -> new price in micros. Currency comes from the product. */
  updates: Record<RegionCode, number>;
  /**
   * What the user reviewed for each region: its currency and its price at the
   * time. The worker re-reads the product before writing and refuses when
   * either no longer matches, rather than write over a change made meanwhile.
   */
  expected?: Record<RegionCode, { currency: string; micros: number | null }>;
  dryRun: boolean;
  /** Recorded in history so the operation can be described in any language. */
  config?: StrategyConfig;
  /** Set when this request restores the snapshot of another operation. */
  revertOf?: string;
}

/**
 * Where an apply stands. Numbers only — the panel words each phase in the
 * user's language. `rejected` is how many countries Google named in its
 * refusal while Pinto isolates the rest.
 */
export interface ApplyProgress {
  phase: 'preparing' | 'writing' | 'isolating' | 'verifying' | 'done';
  completed: number;
  total: number;
  rejected?: number;
  /** True when this run restores an earlier snapshot. */
  revert?: boolean;
}

export interface ApplyResult {
  operation: OperationRecord;
}

export type Request =
  | { type: 'auth/state' }
  | { type: 'auth/signIn' }
  | { type: 'auth/signOut' }
  | { type: 'auth/setClientId'; clientId: string }
  | { type: 'auth/getClientId' }
  | { type: 'context/get'; tabId?: number }
  | { type: 'context/setPackageName'; consoleAppId: string; packageName: string }
  | { type: 'products/list'; packageName: string }
  | {
      type: 'products/pricing';
      packageName: string;
      kind: ProductKind;
      productId: string;
      basePlanId: string;
    }
  | { type: 'pricing/apply'; request: ApplyRequest }
  | {
      type: 'pricing/convert';
      packageName: string;
      referenceMicros: number;
      referenceCurrency: string;
    }
  | { type: 'history/list' }
  /** `regions` limits the restore, e.g. to countries not edited since. */
  | { type: 'history/revert'; operationId: string; regions?: RegionCode[] }
  | { type: 'history/clear' }
  | { type: 'presets/list' }
  | { type: 'presets/save'; preset: unknown }
  | { type: 'presets/delete'; id: string }
  | { type: 'settings/get' }
  | { type: 'settings/update'; patch: Record<string, unknown> }
  | { type: 'groups/list' }
  | { type: 'groups/save'; group: unknown }
  | { type: 'groups/delete'; id: string }
  | { type: 'panel/close' }
  | { type: 'apply/status' }
  | { type: 'log/list' };

export type Response<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: PintoErrorPayload };

/**
 * An error as it crosses contexts. The interface renders `code` and `params`
 * in the user's language; `message` is the English technical description for
 * the log, and `detail` (Google's raw words) sits behind a disclosure.
 */
export interface PintoErrorPayload {
  code: string;
  params?: Record<string, string | number>;
  message: string;
  detail?: string;
  retryable: boolean;
}

export interface ResponseMap {
  'auth/state': AuthState;
  'auth/signIn': AuthState;
  'auth/signOut': AuthState;
  'auth/setClientId': AuthState;
  'auth/getClientId': { clientId: string | null };
  'context/get': PageContext;
  'context/setPackageName': PageContext;
  'products/list': ProductCatalogue;
  'products/pricing': ProductPricing;
  'pricing/apply': ApplyResult;
  'pricing/convert': { baseCurrency: string; rates: Record<string, number> };
  'history/list': OperationRecord[];
  'history/revert': ApplyResult;
  'history/clear': null;
  'presets/list': unknown[];
  'presets/save': unknown[];
  'presets/delete': unknown[];
  'settings/get': Record<string, unknown>;
  'settings/update': Record<string, unknown>;
  'groups/list': CustomGroup[];
  'groups/save': CustomGroup[];
  'groups/delete': CustomGroup[];
  'panel/close': null;
  /** The apply running in the worker right now, if any — survives a panel reload. */
  'apply/status': ApplyProgress | null;
  'log/list': LogEntry[];
}

export interface LogEntry {
  at: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  detail?: string;
}

/** Events pushed from the service worker to open panels. */
export type Event =
  | { type: 'apply/progress'; progress: ApplyProgress }
  | { type: 'auth/changed'; state: AuthState }
  | { type: 'context/changed'; context: PageContext };

export type ChangeSetPayload = ChangeSet;
