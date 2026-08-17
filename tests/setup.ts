import { installChromeMock } from './chromeMock';

// Every suite gets a Chrome API before any module-level code runs.
installChromeMock();

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { ...globalThis.crypto, randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` },
    configurable: true,
  });
}
