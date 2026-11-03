/**
 * The stubbed Chrome environment every capture harness boots against.
 *
 * Shared by the README harness and the Chrome Web Store templates so both
 * photograph the same app in the same state. It stubs the extension APIs the
 * way the tests do — the store, the change-set computation and the message
 * contract are all the real ones, so a screen that breaks breaks here too.
 *
 * The fixture spans all five purchasing-power bands on purpose: a ladder shown
 * over five rich markets would prove nothing about what Pinto is for.
 */
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

/*
 * A fixed instant for anything a capture renders as a date. Deriving the
 * history timestamps from Date.now() moved the dates on every run, so an image
 * changed without the UI changing.
 *
 * What the captures guarantee is stable content, not identical bytes: Chromium
 * dithers the background gradients slightly differently between runs — 15
 * sub-pixels of 3,072,000, at most 3 levels out of 255. Invisible, and not
 * worth flattening a gradient to remove.
 */
const NOW = Date.parse('2026-09-05T11:00:00Z');

/** `?locale=fr` photographs the French interface; English otherwise. */
const LOCALE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('locale') === 'fr'
    ? 'fr'
    : 'en';

const CATALOGUE = {
  unavailable: [],
  products: [
    {
      kind: 'subscription',
      productId: 'premium',
      basePlanId: 'monthly',
      label: 'premium · monthly',
      details: { period: 'P1M' },
      regionCount: PRICES.length,
    },
    {
      kind: 'subscription',
      productId: 'premium',
      basePlanId: 'annual',
      label: 'premium · annual',
      details: { period: 'P1Y' },
      regionCount: PRICES.length,
    },
    {
      kind: 'onetime',
      productId: 'lifetime',
      basePlanId: 'buy',
      label: 'lifetime · buy',
      details: { option: 'buy' },
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
        label: 'premium · monthly',
        details: { period: 'P1M' },
        prices: PRICES.map(([regionCode, currency, amount]) => ({
          regionCode,
          currency,
          micros: Math.round(amount * MICROS),
        })),
        raw: {},
      };
    case 'pricing/convert':
      /*
       * Google's rates for the fixture, derived from the fixture's own prices
       * rather than from nominal FX. Play's local prices are set below market
       * exchange — BRL 14.90 for a USD 4.99 product is a rate of 2.99, not
       * 5.40 — so a table of nominal FX would have made every ladder read as a
       * price rise, and the review screen would have disagreed with the
       * pricing screen about the same product.
       */
      return {
        baseCurrency: 'USD',
        rates: { USD: 1, GBP: 0.9, EUR: 1, BRL: 2.99, ZAR: 12.02, TRY: 20.04, MAD: 6.01,
          NGN: 380.8, INR: 29.86, IDR: 5811.6, JPY: 140.3, KES: 79.96 },
      };
    case 'settings/get':
      return { locale: LOCALE };
    case 'apply/status':
      return null;
    case 'history/list': {
      const snapshot = PRICES.map(([regionCode, currency, amount]) => ({
        regionCode,
        currency,
        micros: Math.round(amount * MICROS),
      }));
      const hour = 3_600_000;
      const now = NOW;
      // Three runs rather than one: a history screen with a single row says
      // nothing about what the log is for, and a partial result is the case
      // the per-country outcome exists to explain.
      return [
        {
          id: 'op-3',
          timestamp: now - hour,
          packageName: 'com.example.streaming',
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'monthly',
          config: {
            strategy: { kind: 'tiers', baseRegion: 'US', anchorMicros: 4_990_000, convert: true,
              tiers: { T1: 1, T2: 0.8, T3: 0.6, T4: 0.45, T5: 0.35 }, assignment: { US: 'T1' } },
            rounding: { mode: 'charm', endings: [0.99], zeroDecimalStep: 100 },
            floorMicros: null,
            ceilingMicros: null,
          },
          requested: 14,
          regionsAffected: 14,
          status: 'succeeded',
          snapshot,
          failures: [],
        },
        {
          id: 'op-2',
          timestamp: now - 26 * hour,
          packageName: 'com.example.streaming',
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'annual',
          config: {
            strategy: { kind: 'percentage', percent: -15 },
            rounding: { mode: 'charm', endings: [0.99], zeroDecimalStep: 100 },
            floorMicros: null,
            ceilingMicros: null,
          },
          requested: 14,
          regionsAffected: 12,
          status: 'partial',
          snapshot,
          failures: [
            { regionCode: 'TR', code: 'apply/rejected', detail: 'Price is below the minimum for TRY.' },
            { regionCode: 'NG', code: 'apply/rejected', detail: 'Price is below the minimum for NGN.' },
          ],
        },
        {
          id: 'op-1',
          timestamp: now - 3 * 24 * hour,
          packageName: 'com.example.streaming',
          kind: 'onetime',
          productId: 'lifetime',
          basePlanId: 'buy',
          config: {
            strategy: { kind: 'fixed', micros: 79_990_000, baseRegion: 'US', convert: true },
            rounding: { mode: 'charm', endings: [0.99], zeroDecimalStep: 100 },
            floorMicros: null,
            ceilingMicros: null,
          },
          requested: 14,
          regionsAffected: 14,
          status: 'succeeded',
          snapshot,
          failures: [],
        },
      ];
    }
    default:
      return [];
  }
}

/** Must run before anything imports the app, which reads `chrome` on load. */
export function installChromeStub(): void {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'pinto-screenshots',
      sendMessage: async (message: { type: string }) => ({ ok: true, data: respond(message) }),
      onMessage: { addListener: () => {}, removeListener: () => {} },
      getURL: (path: string) => path,
    },
    identity: { getRedirectURL: () => 'https://pinto.chromiumapp.org/' },
    storage: {
      // The language a capture is taken in comes from ?locale=, read by the
      // same preference code every Pinto surface uses.
      local: {
        get: async () => ({ 'pinto.settings': { locale: LOCALE } }),
        set: async () => {},
        remove: async () => {},
      },
      session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
    tabs: { query: async () => [], sendMessage: async () => {}, create: async () => ({}) },
  };
}

export const FIXTURE_REGIONS = PRICES.map(([regionCode]) => regionCode);

/** The same product the panel is posed with, for captions that quote numbers. */
export const FIXTURE_PRODUCT = {
  packageName: 'com.example.streaming',
  kind: 'subscription' as const,
  productId: 'premium',
  basePlanId: 'monthly',
  label: 'premium · monthly',
  details: { period: 'P1M' },
  prices: PRICES.map(([regionCode, currency, amount]) => ({
    regionCode,
    currency,
    micros: Math.round(amount * MICROS),
  })),
  raw: {},
};
