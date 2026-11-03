import { vi } from 'vitest';

/**
 * Enough of the Chrome extension API to exercise the parts of Pinto that talk
 * to it. Storage is backed by real objects so tests assert on what would
 * actually be persisted, and `session` is a separate store so a test can prove
 * tokens never land in `local`.
 */
export interface ChromeMock {
  local: Record<string, unknown>;
  session: Record<string, unknown>;
  messages: unknown[];
  reset(): void;
}

type ChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  area: string,
) => void;

/** `storage.onChanged`, fired synchronously after every write like Chrome does (async there). */
const changeListeners = new Set<ChangeListener>();

function emit(name: string, changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) {
  if (!Object.keys(changes).length) return;
  for (const listener of changeListeners) listener(changes, name);
}

function area(store: Record<string, unknown>, name: string) {
  return {
    async get(key?: string | string[] | null) {
      if (key == null) return { ...store };
      const keys = Array.isArray(key) ? key : [key];
      return Object.fromEntries(
        keys.filter((k) => k in store).map((k) => [k, store[k]]),
      ) as Record<string, unknown>;
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) changes[k] = { oldValue: store[k], newValue: v };
      Object.assign(store, items);
      emit(name, changes);
    },
    async remove(key: string | string[]) {
      const changes: Record<string, { oldValue?: unknown }> = {};
      for (const k of Array.isArray(key) ? key : [key]) {
        if (k in store) changes[k] = { oldValue: store[k] };
        delete store[k];
      }
      emit(name, changes);
    },
    async clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

export function installChromeMock(): ChromeMock {
  const local: Record<string, unknown> = {};
  const session: Record<string, unknown> = {};
  const messages: unknown[] = [];

  const chromeStub = {
    storage: {
      local: area(local, 'local'),
      session: area(session, 'session'),
      onChanged: {
        addListener: (listener: ChangeListener) => changeListeners.add(listener),
        removeListener: (listener: ChangeListener) => changeListeners.delete(listener),
      },
    },
    runtime: {
      id: 'pinto-test',
      lastError: undefined as { message: string } | undefined,
      getURL: (path: string) => `chrome-extension://pinto-test/${path}`,
      sendMessage: vi.fn(async (message: unknown) => {
        messages.push(message);
        return undefined;
      }),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
    },
    tabs: {
      get: vi.fn(),
      query: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
      sendMessage: vi.fn(async () => undefined),
      onUpdated: { addListener: vi.fn() },
    },
    identity: {
      getRedirectURL: () => 'https://pinto-test.chromiumapp.org/',
      launchWebAuthFlow: vi.fn(),
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = chromeStub;

  return {
    local,
    session,
    messages,
    reset() {
      for (const key of Object.keys(local)) delete local[key];
      for (const key of Object.keys(session)) delete session[key];
      messages.length = 0;
    },
  };
}
