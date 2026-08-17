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

function area(store: Record<string, unknown>) {
  return {
    async get(key?: string | string[] | null) {
      if (key == null) return { ...store };
      const keys = Array.isArray(key) ? key : [key];
      return Object.fromEntries(
        keys.filter((k) => k in store).map((k) => [k, store[k]]),
      ) as Record<string, unknown>;
    },
    async set(items: Record<string, unknown>) {
      Object.assign(store, items);
    },
    async remove(key: string | string[]) {
      for (const k of Array.isArray(key) ? key : [key]) delete store[k];
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
    storage: { local: area(local), session: area(session) },
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
