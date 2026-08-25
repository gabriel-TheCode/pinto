/**
 * Renders the real panel with fixture data, so the README can show actual
 * components rather than a mockup.
 *
 * The Chrome APIs are stubbed the same way the tests stub them, which means
 * every screenshot goes through the real store, the real change-set
 * computation and the real message contract. If a screen breaks, this breaks
 * too — a screenshot harness that renders a hand-built copy of the UI would
 * quietly drift from the thing it claims to depict.
 */
import { createRoot } from 'react-dom/client';

const PRICES = [
  ['US', 'USD', 4.99],
  ['GB', 'GBP', 4.49],
  ['DE', 'EUR', 4.99],
  ['FR', 'EUR', 4.99],
  ['PL', 'USD', 3.99],
  ['BR', 'BRL', 14.9],
  ['ZA', 'ZAR', 59.99],
  ['TR', 'TRY', 99.99],
  ['MA', 'MAD', 29.99],
  ['NG', 'NGN', 1900],
  ['IN', 'INR', 149],
  ['ID', 'IDR', 29000],
  ['JP', 'JPY', 700],
  ['KE', 'KES', 399],
] as const;

const MICROS = 1_000_000;

const CATALOGUE = {
  unavailable: [],
  products: [
    {
      kind: 'subscription',
      productId: 'premium',
      basePlanId: 'monthly',
      label: 'premium · monthly · 1 month',
      regionCount: PRICES.length,
    },
    {
      kind: 'subscription',
      productId: 'premium',
      basePlanId: 'annual',
      label: 'premium · annual · 1 year',
      regionCount: PRICES.length,
    },
    {
      kind: 'onetime',
      productId: 'lifetime',
      basePlanId: 'buy',
      label: 'lifetime · buy',
      regionCount: PRICES.length,
    },
  ],
};

function respond(request: { type: string }): unknown {
  switch (request.type) {
    case 'auth/state':
      return {
        signedIn: true,
        email: 'dev@example.com',
        name: 'Dev',
        picture: null,
        expiresAt: Date.now() + 3_600_000,
        clientIdConfigured: true,
      };
    case 'auth/getClientId':
      return { clientId: '1234567890-abcdef.apps.googleusercontent.com' };
    case 'context/get':
      return {
        developerId: '1',
        consoleAppId: '4972345',
        packageName: 'com.example.streaming',
        packageNameSource: 'cache',
        productKind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        url: 'https://play.google.com/console/u/0/developers/1/app/4972345/subscriptions/premium',
        supported: true,
      };
    case 'products/list':
      return CATALOGUE;
    case 'products/pricing':
      return {
        packageName: 'com.example.streaming',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        label: 'premium · monthly · 1 month',
        prices: PRICES.map(([regionCode, currency, amount]) => ({
          regionCode,
          currency,
          micros: Math.round(amount * MICROS),
        })),
        raw: {},
      };
    case 'pricing/convert':
      return {
        baseCurrency: 'USD',
        rates: { USD: 1, GBP: 0.79, EUR: 0.92, BRL: 5.4, ZAR: 18.4, TRY: 34, MAD: 10,
          NGN: 1500, INR: 84, IDR: 16000, JPY: 152, KES: 129 },
      };
    case 'settings/get':
      return { locale: 'en' };
    case 'history/list':
      return [
        {
          id: 'op-1',
          timestamp: Date.now() - 3_600_000,
          packageName: 'com.example.streaming',
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'monthly',
          strategyLabel: 'Tiers from US',
          regionsAffected: 12,
          status: 'succeeded',
          message: 'Updated 12 countries.',
          snapshot: PRICES.map(([regionCode, currency, amount]) => ({
            regionCode,
            currency,
            micros: Math.round(amount * MICROS),
          })),
          failures: [],
        },
      ];
    default:
      return [];
  }
}

(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: 'pinto-screenshots',
    sendMessage: async (message: { type: string }) => ({ ok: true, data: respond(message) }),
    onMessage: { addListener: () => {}, removeListener: () => {} },
    getURL: (path: string) => path,
  },
  identity: { getRedirectURL: () => 'https://pinto.chromiumapp.org/' },
  storage: {
    local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
    session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
  },
  tabs: { query: async () => [], sendMessage: async () => {} },
};

await import('./styles.css');
const { App } = await import('@/app/App');
const { useStore } = await import('@/app/store');

createRoot(document.getElementById('root')!).render(<App />);

/**
 * `?screen=` and `?strategy=` drive which state gets photographed, so each
 * screenshot is one headless run with no clicking involved.
 */
const params = new URLSearchParams(location.search);
const screen = params.get('screen');
const strategy = params.get('strategy');

// Wait for boot to settle before posing the store, otherwise loadProducts
// overwrites the state that was just set.
const ready = new Promise<void>((resolve) => {
  const stop = useStore.subscribe((state) => {
    if (state.pricing) {
      stop();
      resolve();
    }
  });
});

await ready;

if (strategy === 'tiers') {
  const { generateLadder } = await import('@/domain/regions/economicBands');
  const regions = useStore.getState().pricing!.prices.map((price) => price.regionCode);
  useStore.getState().setConfig({
    strategy: generateLadder({
      curve: 'balanced',
      baseRegion: 'US',
      anchorMicros: 4_990_000,
      restrictTo: regions,
    }),
  });
}

if (screen) useStore.getState().setScreen(screen as never);

// Let the conversion table land and React paint before the shot is taken.
await new Promise((resolve) => setTimeout(resolve, 400));
document.documentElement.setAttribute('data-ready', 'true');
