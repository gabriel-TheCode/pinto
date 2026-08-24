import type { OperationRecord, Preset, RegionCode } from '@/types';
import type { CustomGroup } from '@/domain/regions/groups';
import type { LogEntry } from './messages';

/**
 * What Pinto stores, and where.
 *
 * `chrome.storage.local` — settings, presets, history, the app-id -> package
 *   name map and the operation log. All of it is the user's own configuration;
 *   none of it leaves the machine.
 * `chrome.storage.session` — OAuth access tokens and the user profile shown in
 *   the header. Session storage lives in memory only and is wiped when the
 *   browser closes, so no token is ever written to disk. Pinto never requests
 *   or stores a refresh token.
 */

const LOCAL_KEYS = {
  clientId: 'pinto.oauth.clientId',
  packageMap: 'pinto.packageMap',
  presets: 'pinto.presets',
  history: 'pinto.history',
  groups: 'pinto.groups',
  settings: 'pinto.settings',
  log: 'pinto.log',
} as const;

const SESSION_KEYS = {
  token: 'pinto.session.token',
  profile: 'pinto.session.profile',
} as const;

export interface StoredToken {
  accessToken: string;
  expiresAt: number;
  scope: string;
}

export interface StoredProfile {
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface Settings {
  /** Panel language. Chosen by the user, defaulting to the browser's. */
  locale: 'en' | 'fr';
  /** Region used as the reference for conversions and formulas. */
  baseRegion: RegionCode;
  /** Play "regions version" sent with subscription writes. */
  regionsVersion: string;
  /** Ask for a typed confirmation when more than this many regions change. */
  confirmThreshold: number;
  dryRunByDefault: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  baseRegion: 'US',
  regionsVersion: '2022/02',
  confirmThreshold: 25,
  dryRunByDefault: false,
};

const MAX_HISTORY = 50;
const MAX_LOG = 300;

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

async function setLocal(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export const storage = {
  // --- OAuth client id ------------------------------------------------------
  getClientId: () => getLocal<string | null>(LOCAL_KEYS.clientId, null),
  setClientId: (clientId: string) => setLocal(LOCAL_KEYS.clientId, clientId.trim() || null),

  // --- Session (memory only) ------------------------------------------------
  async getToken(): Promise<StoredToken | null> {
    const result = await chrome.storage.session.get(SESSION_KEYS.token);
    return (result[SESSION_KEYS.token] as StoredToken | undefined) ?? null;
  },
  async setToken(token: StoredToken | null): Promise<void> {
    if (token) await chrome.storage.session.set({ [SESSION_KEYS.token]: token });
    else await chrome.storage.session.remove(SESSION_KEYS.token);
  },
  async getProfile(): Promise<StoredProfile | null> {
    const result = await chrome.storage.session.get(SESSION_KEYS.profile);
    return (result[SESSION_KEYS.profile] as StoredProfile | undefined) ?? null;
  },
  async setProfile(profile: StoredProfile | null): Promise<void> {
    if (profile) await chrome.storage.session.set({ [SESSION_KEYS.profile]: profile });
    else await chrome.storage.session.remove(SESSION_KEYS.profile);
  },

  // --- App id -> package name ----------------------------------------------
  getPackageMap: () => getLocal<Record<string, string>>(LOCAL_KEYS.packageMap, {}),
  async setPackageName(consoleAppId: string, packageName: string): Promise<void> {
    const map = await getLocal<Record<string, string>>(LOCAL_KEYS.packageMap, {});
    map[consoleAppId] = packageName;
    await setLocal(LOCAL_KEYS.packageMap, map);
  },

  // --- Settings -------------------------------------------------------------
  async getSettings(): Promise<Settings> {
    const stored = await getLocal<Partial<Settings>>(LOCAL_KEYS.settings, {});
    return { ...DEFAULT_SETTINGS, ...stored };
  },
  async setSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await storage.getSettings()), ...patch };
    await setLocal(LOCAL_KEYS.settings, next);
    return next;
  },

  // --- Presets --------------------------------------------------------------
  getPresets: () => getLocal<Preset[]>(LOCAL_KEYS.presets, []),
  async savePreset(preset: Preset): Promise<Preset[]> {
    const presets = await getLocal<Preset[]>(LOCAL_KEYS.presets, []);
    const index = presets.findIndex((p) => p.id === preset.id);
    if (index >= 0) presets[index] = preset;
    else presets.unshift(preset);
    await setLocal(LOCAL_KEYS.presets, presets);
    return presets;
  },
  async deletePreset(id: string): Promise<Preset[]> {
    const presets = (await getLocal<Preset[]>(LOCAL_KEYS.presets, [])).filter((p) => p.id !== id);
    await setLocal(LOCAL_KEYS.presets, presets);
    return presets;
  },

  // --- Custom country groups -----------------------------------------------
  getGroups: () => getLocal<CustomGroup[]>(LOCAL_KEYS.groups, []),
  async saveGroup(group: CustomGroup): Promise<CustomGroup[]> {
    const groups = await getLocal<CustomGroup[]>(LOCAL_KEYS.groups, []);
    const index = groups.findIndex((g) => g.id === group.id);
    if (index >= 0) groups[index] = group;
    else groups.unshift(group);
    await setLocal(LOCAL_KEYS.groups, groups);
    return groups;
  },
  async deleteGroup(id: string): Promise<CustomGroup[]> {
    const groups = (await getLocal<CustomGroup[]>(LOCAL_KEYS.groups, [])).filter(
      (g) => g.id !== id,
    );
    await setLocal(LOCAL_KEYS.groups, groups);
    return groups;
  },

  // --- History --------------------------------------------------------------
  getHistory: () => getLocal<OperationRecord[]>(LOCAL_KEYS.history, []),
  async addHistory(record: OperationRecord): Promise<OperationRecord[]> {
    const history = await getLocal<OperationRecord[]>(LOCAL_KEYS.history, []);
    history.unshift(record);
    const trimmed = history.slice(0, MAX_HISTORY);
    await setLocal(LOCAL_KEYS.history, trimmed);
    return trimmed;
  },
  async updateHistory(id: string, patch: Partial<OperationRecord>): Promise<OperationRecord[]> {
    const history = await getLocal<OperationRecord[]>(LOCAL_KEYS.history, []);
    const index = history.findIndex((h) => h.id === id);
    if (index >= 0) history[index] = { ...history[index]!, ...patch };
    await setLocal(LOCAL_KEYS.history, history);
    return history;
  },
  async clearHistory(): Promise<void> {
    await setLocal(LOCAL_KEYS.history, []);
  },

  // --- Operation log --------------------------------------------------------
  getLog: () => getLocal<LogEntry[]>(LOCAL_KEYS.log, []),
  async appendLog(entry: LogEntry): Promise<void> {
    const log = await getLocal<LogEntry[]>(LOCAL_KEYS.log, []);
    log.unshift(entry);
    await setLocal(LOCAL_KEYS.log, log.slice(0, MAX_LOG));
  },
};

export { LOCAL_KEYS, SESSION_KEYS };
