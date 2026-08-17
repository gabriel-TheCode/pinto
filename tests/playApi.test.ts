import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayApi, regionsInError, toApiError } from '@/services/playApi';
import { unitsToMicros } from '@/domain/money/money';

const SUBSCRIPTION = {
  packageName: 'com.example.app',
  productId: 'premium',
  listings: [{ languageCode: 'en-US', title: 'Premium' }],
  basePlans: [
    {
      basePlanId: 'monthly',
      state: 'ACTIVE',
      autoRenewingBasePlanType: { billingPeriodDuration: 'P1M' },
      offerTags: [{ tag: 'launch' }],
      regionalConfigs: [
        {
          regionCode: 'US',
          newSubscriberAvailability: true,
          price: { currencyCode: 'USD', units: '4', nanos: 990_000_000 },
        },
        {
          regionCode: 'JP',
          newSubscriberAvailability: true,
          price: { currencyCode: 'JPY', units: '800', nanos: 0 },
        },
      ],
    },
    { basePlanId: 'yearly', regionalConfigs: [] },
  ],
};

function api(fetchImpl: typeof fetch): PlayApi {
  vi.stubGlobal('fetch', fetchImpl);
  return new PlayApi({ getAccessToken: async () => 'token', regionsVersion: '2022/02' });
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe('reading subscription pricing', () => {
  it('normalises regional configs into micros', async () => {
    const client = api(vi.fn(async () => ok(SUBSCRIPTION)) as unknown as typeof fetch);
    const pricing = await client.getPricing('com.example.app', 'subscription', 'premium', 'monthly');

    expect(pricing.prices).toEqual([
      { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99), availableToNewSubscribers: true },
      { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800), availableToNewSubscribers: true },
    ]);
    expect(pricing.label).toContain('1 month');
  });

  it('fails clearly when the base plan does not exist', async () => {
    const client = api(vi.fn(async () => ok(SUBSCRIPTION)) as unknown as typeof fetch);
    await expect(
      client.getPricing('com.example.app', 'subscription', 'premium', 'weekly'),
    ).rejects.toThrow(/could not find/i);
  });
});

describe('writing subscription pricing', () => {
  it('sends the whole product back with only the targeted prices changed', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return ok(SUBSCRIPTION);
      }) as unknown as typeof fetch,
    );

    await client.updatePrices('com.example.app', 'subscription', 'premium', 'monthly', {
      US: unitsToMicros(5.49),
    });

    const patch = calls.at(-1)!;
    expect(patch.init?.method).toBe('PATCH');
    expect(patch.url).toContain('updateMask=basePlans');
    expect(patch.url).toContain('regionsVersion.version=2022%2F02');

    const body = JSON.parse(String(patch.init?.body)) as typeof SUBSCRIPTION;
    const monthly = body.basePlans.find((plan) => plan.basePlanId === 'monthly')!;
    const us = monthly.regionalConfigs!.find((config) => config.regionCode === 'US')!;
    const jp = monthly.regionalConfigs!.find((config) => config.regionCode === 'JP')!;

    expect(us.price).toEqual({ currencyCode: 'USD', units: '5', nanos: 490_000_000 });
    // Untouched region and untouched base plan survive the round trip intact.
    expect(jp.price).toEqual({ currencyCode: 'JPY', units: '800', nanos: 0 });
    expect(body.basePlans.map((plan) => plan.basePlanId)).toEqual(['monthly', 'yearly']);
    expect(monthly.offerTags).toEqual([{ tag: 'launch' }]);
    expect(body.listings).toEqual(SUBSCRIPTION.listings);
  });

  it('keeps the region’s existing currency rather than guessing one', async () => {
    const calls: RequestInit[] = [];
    const client = api(
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') calls.push(init);
        return ok(SUBSCRIPTION);
      }) as unknown as typeof fetch,
    );

    await client.updatePrices('com.example.app', 'subscription', 'premium', 'monthly', {
      JP: unitsToMicros(900),
    });

    const body = JSON.parse(String(calls[0]!.body)) as typeof SUBSCRIPTION;
    const jp = body.basePlans[0]!.regionalConfigs!.find((c) => c.regionCode === 'JP')!;
    expect(jp.price).toEqual({ currencyCode: 'JPY', units: '900', nanos: 0 });
  });

  it('discovers the live regions version and sends it, not the stale default', async () => {
    // convertRegionPrices echoes the version currently in force — the one
    // where Bulgaria already bills in EUR.
    const calls: string[] = [];
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('convertRegionPrices')) {
          return ok({ regionVersion: { version: '2025/09' } });
        }
        if (init?.method === 'PATCH') calls.push(url);
        return ok(SUBSCRIPTION);
      }) as unknown as typeof fetch,
    );

    await client.updatePrices('com.example.app', 'subscription', 'premium', 'monthly', {
      US: unitsToMicros(5.49),
    });

    expect(calls[0]).toContain('regionsVersion.version=2025%2F09');
    expect(calls[0]).not.toContain('2022');
  });

  it('discovers the version only once even across several writes', async () => {
    let discoveries = 0;
    const client = api(
      vi.fn(async (url: string) => {
        if (url.includes('convertRegionPrices')) {
          discoveries++;
          return ok({ regionVersion: { version: '2025/09' } });
        }
        return ok(SUBSCRIPTION);
      }) as unknown as typeof fetch,
    );

    await client.updatePrices('com.example.app', 'subscription', 'premium', 'monthly', {
      US: unitsToMicros(5.49),
    });
    await client.updatePrices('com.example.app', 'subscription', 'premium', 'monthly', {
      JP: unitsToMicros(900),
    });

    expect(discoveries).toBe(1);
  });

  it('falls back to the configured version when discovery fails', async () => {
    const calls: string[] = [];
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('convertRegionPrices')) return new Response('nope', { status: 500 });
        if (init?.method === 'PATCH') calls.push(url);
        return ok(SUBSCRIPTION);
      }) as unknown as typeof fetch,
    );

    await client.updatePrices('com.example.app', 'subscription', 'premium', 'monthly', {
      US: unitsToMicros(5.49),
    });

    expect(calls[0]).toContain('regionsVersion.version=2022%2F02');
  });

  it('refuses to price a region the base plan does not offer', async () => {
    const client = api(vi.fn(async () => ok(SUBSCRIPTION)) as unknown as typeof fetch);
    await expect(
      client.updatePrices('com.example.app', 'subscription', 'premium', 'monthly', {
        BR: unitsToMicros(24.9),
      }),
    ).rejects.toThrow(/not an available country/i);
  });
});

describe('one-time products', () => {
  const PRODUCT = {
    packageName: 'com.example.app',
    sku: 'coins_100',
    status: 'active',
    defaultPrice: { priceMicros: '4990000', currency: 'USD' },
    prices: {
      US: { priceMicros: '4990000', currency: 'USD' },
      BR: { priceMicros: '24900000', currency: 'BRL' },
    },
  };

  it('reads the price map', async () => {
    const client = api(vi.fn(async () => ok(PRODUCT)) as unknown as typeof fetch);
    const pricing = await client.getPricing('com.example.app', 'inapp', 'coins_100', 'DEFAULT');
    expect(pricing.prices).toHaveLength(2);
    expect(pricing.prices[0]).toMatchObject({ regionCode: 'US', micros: 4_990_000 });
  });

  it('patches only the requested regions and never auto-converts the rest', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return ok(PRODUCT);
      }) as unknown as typeof fetch,
    );

    await client.updatePrices('com.example.app', 'inapp', 'coins_100', 'DEFAULT', {
      US: 5_490_000,
    });

    const patch = calls.at(-1)!;
    expect(patch.url).toContain('autoConvertMissingPrices=false');
    const body = JSON.parse(String(patch.init?.body)) as typeof PRODUCT;
    expect(body.prices.US).toEqual({ currency: 'USD', priceMicros: '5490000' });
    expect(body.prices.BR).toEqual({ currency: 'BRL', priceMicros: '24900000' });
  });
});

describe('one-time products (purchase-option model)', () => {
  const ONE_TIME = {
    packageName: 'com.example.app',
    productId: 'lifetime',
    listings: [{ languageCode: 'en-US', title: 'Lifetime' }],
    purchaseOptions: [
      {
        purchaseOptionId: 'buy',
        state: 'ACTIVE',
        buyOption: { legacyCompatible: true },
        regionalPricingAndAvailabilityConfigs: [
          {
            regionCode: 'US',
            availability: 'AVAILABLE',
            price: { currencyCode: 'USD', units: '69', nanos: 990_000_000 },
          },
          {
            regionCode: 'JP',
            availability: 'AVAILABLE',
            price: { currencyCode: 'JPY', units: '9800', nanos: 0 },
          },
        ],
      },
    ],
  };

  /** Answers only on one spelling of the collection, like the real API. */
  function serve(segment: string, body: unknown = ONE_TIME) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('/subscriptions')) return ok({ subscriptions: [] });
      if (url.includes('/inappproducts')) return ok({ inappproduct: [] });
      if (url.includes(`/${segment}`)) return ok(body);
      return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
    });
    return { client: api(fetchImpl as unknown as typeof fetch), calls };
  }

  it('finds the collection whichever spelling the API uses', async () => {
    for (const segment of ['onetimeproducts', 'oneTimeProducts', 'monetization/onetimeproducts']) {
      const { client } = serve(segment, { oneTimeProducts: [ONE_TIME] });
      const catalogue = await client.listProducts('com.example.app');
      expect(catalogue.products.map((product) => product.kind), segment).toContain('onetime');
      vi.unstubAllGlobals();
    }
  });

  it('lists one row per purchase option', async () => {
    const { client } = serve('onetimeproducts', { oneTimeProducts: [ONE_TIME] });
    const catalogue = await client.listProducts('com.example.app');
    const row = catalogue.products.find((product) => product.kind === 'onetime')!;
    expect(row).toMatchObject({ productId: 'lifetime', basePlanId: 'buy', regionCount: 2 });
  });

  it('reads the regional prices of a purchase option', async () => {
    const { client } = serve('onetimeproducts');
    const pricing = await client.getPricing('com.example.app', 'onetime', 'lifetime', 'buy');
    expect(pricing.prices).toEqual([
      { regionCode: 'US', currency: 'USD', micros: unitsToMicros(69.99) },
      { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(9800) },
    ]);
  });

  it('writes only the targeted price and preserves availability', async () => {
    const { client, calls } = serve('onetimeproducts');
    await client.updatePrices('com.example.app', 'onetime', 'lifetime', 'buy', {
      US: unitsToMicros(84.99),
    });

    const patch = calls.find((call) => call.init?.method === 'PATCH')!;
    expect(patch.url).toContain('updateMask=purchaseOptions');
    expect(patch.url).toContain('regionsVersion.version=2022%2F02');

    const body = JSON.parse(String(patch.init?.body)) as typeof ONE_TIME;
    const configs = body.purchaseOptions[0]!.regionalPricingAndAvailabilityConfigs!;
    const us = configs.find((config) => config.regionCode === 'US')!;
    const jp = configs.find((config) => config.regionCode === 'JP')!;

    expect(us.price).toEqual({ currencyCode: 'USD', units: '84', nanos: 990_000_000 });
    expect(us.availability).toBe('AVAILABLE');
    expect(jp.price).toEqual({ currencyCode: 'JPY', units: '9800', nanos: 0 });
    expect(body.listings).toEqual(ONE_TIME.listings);
  });

  it('reads and writes an item even when its path casing differs from the list', async () => {
    // Google lists at camelCase `oneTimeProducts` but gets/patches at
    // lowercase `onetimeproducts`; a mismatch yields an HTML 404, not JSON.
    const calls: string[] = [];
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url.includes('convertRegionPrices')) return ok({ regionVersion: { version: '2025/09' } });
        // List only answers on camelCase.
        if (/\/oneTimeProducts\b/.test(url) && !/\/oneTimeProducts\//.test(url)) {
          return ok({ oneTimeProducts: [ONE_TIME] });
        }
        // Item GET/PATCH only answers on lowercase.
        if (/\/onetimeproducts\//.test(url)) return ok(ONE_TIME);
        // Everything else 404s as Google's HTML robot page.
        return new Response('<!DOCTYPE html><html>Error 404</html>', { status: 404 });
      }) as unknown as typeof fetch,
    );

    const pricing = await client.getPricing('com.example.app', 'onetime', 'lifetime', 'buy');
    expect(pricing.prices).toHaveLength(2);

    await client.updatePrices('com.example.app', 'onetime', 'lifetime', 'buy', {
      US: unitsToMicros(79.99),
    });
    expect(calls.some((call) => call.startsWith('PATCH') && call.includes('/onetimeproducts/'))).toBe(
      true,
    );
  });

  it('patches on a different path than the GET when the API demands it', async () => {
    // For this app the item GET answers on lowercase, but the PATCH only
    // answers on camelCase — the two are probed independently.
    const patched: string[] = [];
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('convertRegionPrices')) return ok({ regionVersion: { version: '2025/09' } });
        const isPatch = init?.method === 'PATCH';
        if (isPatch) {
          if (/\/oneTimeProducts\//.test(url)) {
            patched.push(url);
            return ok(ONE_TIME);
          }
          return new Response('<!DOCTYPE html><html>404</html>', { status: 404 });
        }
        // GET: lowercase only.
        if (/\/onetimeproducts\//.test(url)) return ok(ONE_TIME);
        if (/\/oneTimeProducts\b/.test(url) && !/\//.test(url.split('oneTimeProducts')[1] ?? '')) {
          return ok({ oneTimeProducts: [ONE_TIME] });
        }
        return new Response('<!DOCTYPE html><html>404</html>', { status: 404 });
      }) as unknown as typeof fetch,
    );

    await client.updatePrices('com.example.app', 'onetime', 'lifetime', 'buy', {
      US: unitsToMicros(79.99),
    });

    expect(patched).toHaveLength(1);
    expect(patched[0]).toMatch(/\/oneTimeProducts\/lifetime/);
  });

  it('keeps read and write paths separate so a write does not poison the next read', async () => {
    // Confirmed Google inconsistency: GET only on camelCase, PATCH only on
    // lowercase. A shared path cache would break whichever ran second.
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('convertRegionPrices')) return ok({ regionVersion: { version: '2025/09' } });
        const isPatch = init?.method === 'PATCH';
        const camel = /\/oneTimeProducts\//.test(url);
        const lower = /\/onetimeproducts\//.test(url);
        if (isPatch) return lower ? ok(ONE_TIME) : new Response('<html>404</html>', { status: 404 });
        return camel ? ok(ONE_TIME) : new Response('<html>404</html>', { status: 404 });
      }) as unknown as typeof fetch,
    );

    // Interleave read, write, read — each must resolve its own path.
    const first = await client.getPricing('com.example.app', 'onetime', 'lifetime', 'buy');
    expect(first.prices).toHaveLength(2);
    await client.updatePrices('com.example.app', 'onetime', 'lifetime', 'buy', {
      US: unitsToMicros(79.99),
    });
    const second = await client.getPricing('com.example.app', 'onetime', 'lifetime', 'buy');
    expect(second.prices).toHaveLength(2);
  });

  it('turns an HTML 404 into the request path, not the robot page', () => {
    const error = toApiError(404, 'No such endpoint: .../com.x/onetimeproducts/lifetime');
    expect(error.code).toBe('api/not-found');
    expect(error.detail).not.toMatch(/<html/i);
  });

  it('does not offer a legacy managed product twice when it also exists in the new model', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/subscriptions')) return ok({ subscriptions: [] });
      if (url.includes('/inappproducts')) {
        return ok({ inappproduct: [{ packageName: 'com.example.app', sku: 'lifetime', prices: {} }] });
      }
      if (url.includes('/onetimeproducts')) return ok({ oneTimeProducts: [ONE_TIME] });
      return new Response('{}', { status: 404 });
    });
    const client = api(fetchImpl as unknown as typeof fetch);

    const catalogue = await client.listProducts('com.example.app');
    expect(catalogue.products.filter((product) => product.productId === 'lifetime')).toHaveLength(1);
    expect(catalogue.products[0]!.kind).toBe('onetime');
  });

  it('stays quiet about the legacy endpoint once the newer model answered', async () => {
    // Google refuses `inappproducts` outright for apps on the new model.
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/subscriptions')) return ok({ subscriptions: [] });
      if (url.includes('/inappproducts')) {
        return new Response(JSON.stringify({ error: { message: 'not permitted' } }), {
          status: 403,
        });
      }
      if (url.includes('/onetimeproducts')) return ok({ oneTimeProducts: [ONE_TIME] });
      return new Response('{}', { status: 404 });
    });
    const client = api(fetchImpl as unknown as typeof fetch);

    const catalogue = await client.listProducts('com.example.app');
    expect(catalogue.products.some((product) => product.kind === 'onetime')).toBe(true);
    expect(catalogue.unavailable).toEqual([]);
  });

  it('still warns about the legacy endpoint when nothing else loaded either', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/subscriptions')) return ok({ subscriptions: [] });
      if (url.includes('/inappproducts')) {
        return new Response(JSON.stringify({ error: { message: 'not permitted' } }), {
          status: 403,
        });
      }
      return new Response(JSON.stringify({ error: { message: 'no such collection' } }), {
        status: 404,
      });
    });
    const client = api(fetchImpl as unknown as typeof fetch);

    const catalogue = await client.listProducts('com.example.app');
    expect(catalogue.unavailable.map((entry) => entry.kind)).toEqual(['inapp']);
  });

  it('never suppresses a legacy failure that is not a refusal', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/subscriptions')) return ok({ subscriptions: [] });
      if (url.includes('/inappproducts')) return new Response('boom', { status: 500 });
      if (url.includes('/onetimeproducts')) return ok({ oneTimeProducts: [ONE_TIME] });
      return new Response('{}', { status: 404 });
    });
    const client = api(fetchImpl as unknown as typeof fetch);

    const catalogue = await client.listProducts('com.example.app');
    expect(catalogue.unavailable.map((entry) => entry.kind)).toEqual(['inapp']);
  });

  it('reports a permission failure instead of trying the next spelling', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/subscriptions')) return ok({ subscriptions: [] });
      if (url.includes('/inappproducts')) return ok({ inappproduct: [] });
      return new Response(JSON.stringify({ error: { message: 'caller lacks permission' } }), {
        status: 403,
      });
    });
    const client = api(fetchImpl as unknown as typeof fetch);

    const catalogue = await client.listProducts('com.example.app');
    expect(catalogue.unavailable.map((entry) => entry.kind)).toContain('onetime');
    expect(catalogue.unavailable.find((entry) => entry.kind === 'onetime')!.reason).toMatch(
      /refused/i,
    );
  });
});

describe('legacy managed product pagination', () => {
  it('follows tokenPagination rather than the ignored startIndex fields', async () => {
    const pages = [
      { inappproduct: [{ sku: 'a' }], tokenPagination: { nextPageToken: 'page2' } },
      { inappproduct: [{ sku: 'b' }] },
    ];
    let call = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/subscriptions')) return ok({ subscriptions: [] });
      if (url.includes('/inappproducts')) {
        if (call === 1) expect(url).toContain('token=page2');
        return ok(pages[call++]);
      }
      return new Response('{}', { status: 404 });
    });
    const client = api(fetchImpl as unknown as typeof fetch);

    const catalogue = await client.listProducts('com.example.app');
    expect(catalogue.products.map((product) => product.productId)).toEqual(['a', 'b']);
  });
});

describe('conversion table from Google', () => {
  it('builds per-currency rates from convertRegionPrices', async () => {
    const client = api(
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toContain('pricing:convertRegionPrices');
        const sent = JSON.parse(String(init?.body)) as { price: { units: string } };
        expect(sent.price.units).toBe('10'); // reference amount
        return ok({
          convertedRegionPrices: {
            BR: { price: { currencyCode: 'BRL', units: '50', nanos: 0 } },
            JP: { price: { currencyCode: 'JPY', units: '1500', nanos: 0 } },
            FR: { price: { currencyCode: 'EUR', units: '9', nanos: 500_000_000 } },
          },
        });
      }) as unknown as typeof fetch,
    );

    const table = await client.conversionTable('com.example.app', unitsToMicros(10), 'USD');
    expect(table.baseCurrency).toBe('USD');
    expect(table.rates.USD).toBe(1);
    expect(table.rates.BRL).toBeCloseTo(5, 5); // 50 / 10
    expect(table.rates.JPY).toBeCloseTo(150, 5);
    expect(table.rates.EUR).toBeCloseTo(0.95, 5);
  });

  it('ignores regions with no usable price', async () => {
    const client = api(
      vi.fn(async () =>
        ok({
          convertedRegionPrices: {
            BR: { price: { currencyCode: 'BRL', units: '50', nanos: 0 } },
            ZW: {},
          },
        }),
      ) as unknown as typeof fetch,
    );
    const table = await client.conversionTable('com.example.app', unitsToMicros(10), 'USD');
    expect(table.rates.BRL).toBeDefined();
    expect(Object.keys(table.rates)).not.toContain('undefined');
  });
});

describe('error mapping', () => {
  it('turns HTTP statuses into actionable messages', () => {
    expect(toApiError(401, '{}').code).toBe('auth/expired');
    expect(toApiError(403, '{}').code).toBe('api/forbidden');
    expect(toApiError(404, '{}').code).toBe('api/not-found');
    expect(toApiError(400, '{}').code).toBe('api/rejected');
    expect(toApiError(429, '{}').retryable).toBe(true);
    expect(toApiError(503, '{}').retryable).toBe(true);
  });

  it('lifts the Google error message into the technical detail, not the headline', () => {
    const error = toApiError(400, JSON.stringify({ error: { message: 'Invalid price for FR' } }));
    expect(error.message).not.toContain('Invalid price for FR');
    expect(error.detail).toBe('Invalid price for FR');
  });

  it('turns a currency mismatch into a regions-version message, not a vague rejection', () => {
    const error = toApiError(
      400,
      JSON.stringify({
        error: {
          message:
            'Invalid currency for region code BG at the specified regions version 2022/02. Expected BGN but got EUR.',
        },
      }),
    );
    expect(error.code).toBe('api/regions-version');
    expect(error.message).toMatch(/BG is priced in EUR/);
    expect(error.hint).toMatch(/Bulgaria/);
  });

  it('only reports regions that were actually part of the request', () => {
    expect(regionsInError('Invalid price for region BR', ['US', 'BR'])).toEqual(['BR']);
    // "ID" appearing inside a field path must not be read as Indonesia.
    expect(regionsInError('basePlans.regionalConfigs.ID field invalid', ['US', 'FR'])).toEqual([]);
  });

  it('surfaces a network failure as retryable rather than as a crash', async () => {
    const client = api(
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    );
    await expect(
      client.getPricing('com.example.app', 'inapp', 'coins_100', 'DEFAULT'),
    ).rejects.toMatchObject({ code: 'api/network', retryable: true });
  });
});
