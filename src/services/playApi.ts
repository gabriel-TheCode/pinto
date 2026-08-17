import type { CurrencyCode, ProductKind, ProductPricing, RegionCode, RegionalPrice } from '@/types';
import { ERRORS, PintoError } from '@/lib/errors';
import { apiMoneyToMicros, microsToApiMoney, MICROS_PER_UNIT, type ApiMoney } from '@/domain/money/money';
import { minorUnitMicros } from '@/domain/money/money';
import { log } from './logger';
import type { ProductCatalogue, ProductSummary } from './messages';

const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

/** Synthetic base plan id used for one-time products, which have no base plans. */
export const INAPP_PLAN = 'DEFAULT';

// ---------------------------------------------------------------------------
// Raw API shapes (only the fields Pinto reads or writes)
// ---------------------------------------------------------------------------

interface RegionalBasePlanConfig {
  regionCode: string;
  newSubscriberAvailability?: boolean;
  price?: ApiMoney;
}

interface BasePlan {
  basePlanId: string;
  state?: string;
  autoRenewingBasePlanType?: { billingPeriodDuration?: string };
  prepaidBasePlanType?: { billingPeriodDuration?: string };
  regionalConfigs?: RegionalBasePlanConfig[];
  [key: string]: unknown;
}

interface Subscription {
  packageName: string;
  productId: string;
  basePlans?: BasePlan[];
  /** Output-only on read: the regions version the product's data reflects. */
  regionsVersion?: { version?: string };
  [key: string]: unknown;
}

interface InAppPrice {
  priceMicros: string;
  currency: string;
}

interface InAppProduct {
  packageName: string;
  sku: string;
  status?: string;
  purchaseType?: string;
  defaultPrice?: InAppPrice;
  prices?: Record<string, InAppPrice>;
  listings?: Record<string, { title?: string }>;
  defaultLanguage?: string;
  [key: string]: unknown;
}

interface RegionalPricingAndAvailabilityConfig {
  regionCode: string;
  price?: ApiMoney;
  availability?: string;
}

interface PurchaseOption {
  purchaseOptionId: string;
  state?: string;
  buyOption?: unknown;
  rentOption?: unknown;
  regionalPricingAndAvailabilityConfigs?: RegionalPricingAndAvailabilityConfig[];
  [key: string]: unknown;
}

interface OneTimeProduct {
  packageName: string;
  productId: string;
  purchaseOptions?: PurchaseOption[];
  /** Output-only on read: the regions version the product's data reflects. */
  regionsVersion?: { version?: string };
  [key: string]: unknown;
}

export interface PlayApiOptions {
  getAccessToken: () => Promise<string>;
  regionsVersion: string;
}

/**
 * Path spellings Google's own reference pages use for one-time products.
 * `get`/`list` document camelCase `oneTimeProducts`, `patch` documents
 * lowercase `onetimeproducts`, and the resource overview shows a `monetization`
 * prefix — so all three are candidates and Pinto probes rather than assumes.
 */
const ONE_TIME_SEGMENTS = ['onetimeproducts', 'oneTimeProducts', 'monetization/onetimeproducts'];

/** Cached path first (self-healing on 404), then the remaining candidates. */
function orderedCandidates(cached: string | undefined): string[] {
  if (!cached) return ONE_TIME_SEGMENTS;
  return [cached, ...ONE_TIME_SEGMENTS.filter((segment) => segment !== cached)];
}

export class PlayApi {
  /** `undefined` = not probed yet, `null` = no endpoint answered. */
  private oneTimePath: string | null | undefined = undefined;
  /**
   * Google uses different casing for reading and writing a one-time product —
   * `oneTimeProducts` for GET, `onetimeproducts` for PATCH — so the two paths
   * are discovered and cached independently. A shared cache would make a write
   * poison the next read.
   */
  private oneTimeGetPath: string | undefined;
  private oneTimePatchPath: string | undefined;
  /** Cached current regions version, discovered from the API, not hardcoded. */
  private regionsVersionPromise: Promise<string> | undefined;

  constructor(private readonly options: PlayApiOptions) {}

  /**
   * The regions version currently in force for this app, discovered rather
   * than guessed.
   *
   * The subscriptions/one-time patch endpoints require a regions version and
   * validate every region's currency against it, but neither returns one on
   * read, and Google's public docs are frozen at "2022/02" — a version from
   * before Bulgaria adopted the euro, so it rejects the BG=EUR that Google
   * itself migrated products to. There is no "get latest regions version"
   * call. `convertRegionPrices`, however, echoes the version it used, so a
   * throwaway conversion is the one reliable way to learn the live value.
   * Cached per client; falls back to the configured default if the probe
   * fails, so a network hiccup never blocks a write outright.
   */
  private currentRegionsVersion(packageName: string): Promise<string> {
    this.regionsVersionPromise ??= this.request<{ regionVersion?: { version?: string } }>(
      `${BASE}/applications/${encodeURIComponent(packageName)}/pricing:convertRegionPrices`,
      { method: 'POST', body: JSON.stringify({ price: { currencyCode: 'USD', units: '1', nanos: 0 } }) },
    )
      .then((body) => {
        const version = body.regionVersion?.version;
        if (typeof version === 'string' && version.length > 0) {
          log.info('api', `Discovered current regions version ${version}`);
          return version;
        }
        return this.options.regionsVersion;
      })
      .catch((error) => {
        log.warn('api', 'Could not discover the regions version, using the default', error);
        return this.options.regionsVersion;
      });
    return this.regionsVersionPromise;
  }

  /**
   * Builds a currency conversion table from Google's own price conversion,
   * instead of from the product's existing prices.
   *
   * Rates implied by a product's own prices are only meaningful while every
   * market sits at the same converted amount. The moment a ladder tiers them,
   * re-deriving rates from those tiered prices compounds the tiering — apply
   * twice and low tiers collapse. `convertRegionPrices` sidesteps that: it maps
   * one reference amount to every region using Google's live exchange rates and
   * country pricing patterns, independent of the product's current prices, so
   * the resulting table is stable and the ladder becomes idempotent.
   */
  async conversionTable(
    packageName: string,
    referenceMicros: number,
    referenceCurrency: CurrencyCode,
  ): Promise<{ baseCurrency: CurrencyCode; rates: Record<CurrencyCode, number> }> {
    const money = microsToApiMoney(Math.max(referenceMicros, minorReference(referenceCurrency)), referenceCurrency);
    const body = await this.request<{
      convertedRegionPrices?: Record<string, { price?: ApiMoney }>;
    }>(`${BASE}/applications/${encodeURIComponent(packageName)}/pricing:convertRegionPrices`, {
      method: 'POST',
      body: JSON.stringify({ price: money }),
    });

    const ref = apiMoneyToMicros(money);
    const rates: Record<CurrencyCode, number> = {};
    for (const entry of Object.values(body.convertedRegionPrices ?? {})) {
      const price = entry.price;
      if (!price?.currencyCode) continue;
      const local = apiMoneyToMicros(price);
      if (local <= 0) continue;
      // Regions sharing a currency converge to the same rate; last write wins.
      rates[price.currencyCode] = local / ref;
    }
    rates[referenceCurrency] = 1;
    return { baseCurrency: referenceCurrency, rates };
  }

  // --- Discovery ------------------------------------------------------------

  /**
   * Lists everything priceable in an app: one row per subscription base plan
   * plus one row per one-time product. Base plans are listed individually
   * because prices live on the base plan, not the subscription.
   */
  async listProducts(packageName: string): Promise<ProductCatalogue> {
    const unavailable: ProductCatalogue['unavailable'] = [];

    const [subs, iaps, oneTimes] = await Promise.all([
      this.listSubscriptions(packageName).catch((error) => {
        log.warn('api', 'Listing subscriptions failed', error);
        unavailable.push({ kind: 'subscription', ...reasonOf(error) });
        return [] as Subscription[];
      }),
      this.listInAppProducts(packageName).catch((error) => {
        log.warn('api', 'Listing managed products failed', error);
        unavailable.push({ kind: 'inapp', ...reasonOf(error) });
        return [] as InAppProduct[];
      }),
      this.listOneTimeProducts(packageName).catch((error) => {
        log.warn('api', 'Listing one-time products failed', error);
        unavailable.push({ kind: 'onetime', ...reasonOf(error) });
        return [] as OneTimeProduct[];
      }),
    ]);

    const summaries: ProductSummary[] = [];
    for (const sub of subs) {
      for (const plan of sub.basePlans ?? []) {
        summaries.push({
          kind: 'subscription',
          productId: sub.productId,
          basePlanId: plan.basePlanId,
          label: `${sub.productId} · ${planLabel(plan)}`,
          regionCount: plan.regionalConfigs?.length ?? 0,
        });
      }
    }
    const seen = new Set<string>();
    for (const product of oneTimes) {
      seen.add(product.productId);
      for (const option of product.purchaseOptions ?? []) {
        summaries.push({
          kind: 'onetime',
          productId: product.productId,
          basePlanId: option.purchaseOptionId,
          label: optionLabel(product.productId, option),
          regionCount: option.regionalPricingAndAvailabilityConfigs?.length ?? 0,
        });
      }
    }

    for (const iap of iaps) {
      // The newer model is authoritative when a product appears in both, so a
      // migrated product is not offered twice with two different price shapes.
      if (seen.has(iap.sku)) continue;
      summaries.push({
        kind: 'inapp',
        productId: iap.sku,
        basePlanId: INAPP_PLAN,
        label: `${iap.sku} · managed product`,
        regionCount: Object.keys(iap.prices ?? {}).length,
      });
    }
    return { products: summaries, unavailable: prune(unavailable, oneTimes.length > 0) };
  }

  private async listSubscriptions(packageName: string): Promise<Subscription[]> {
    const out: Subscription[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ pageSize: '100' });
      if (pageToken) query.set('pageToken', pageToken);
      const body = await this.request<{ subscriptions?: Subscription[]; nextPageToken?: string }>(
        `${BASE}/applications/${encodeURIComponent(packageName)}/subscriptions?${query}`,
      );
      out.push(...(body.subscriptions ?? []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return out;
  }

  /**
   * Legacy managed products. `startIndex`/`maxResults` are documented as
   * deprecated and ignored, and `pageInfo` is unset, so paging goes through
   * `tokenPagination.nextPageToken` — relying on the old fields silently
   * truncated the catalogue to one page.
   */
  private async listInAppProducts(packageName: string): Promise<InAppProduct[]> {
    const out: InAppProduct[] = [];
    let token: string | undefined;
    for (let page = 0; page < 50; page++) {
      const query = new URLSearchParams();
      if (token) query.set('token', token);
      const body = await this.request<{
        inappproduct?: InAppProduct[];
        tokenPagination?: { nextPageToken?: string };
      }>(`${BASE}/applications/${encodeURIComponent(packageName)}/inappproducts?${query}`);
      out.push(...(body.inappproduct ?? []));
      token = body.tokenPagination?.nextPageToken;
      if (!token) break;
    }
    return out;
  }

  /**
   * One-time products in the newer purchase-option model.
   *
   * Google's own reference pages disagree on the collection path — `list`
   * documents `oneTimeProducts`, `patch` documents `onetimeproducts`, and the
   * resource overview shows it nested under `monetization/`. Rather than pick
   * one and ship a 404 to every user, Pinto probes the candidates once per
   * session and remembers which one answered.
   */
  private async listOneTimeProducts(packageName: string): Promise<OneTimeProduct[]> {
    const segment = await this.oneTimeSegment(packageName);
    if (!segment) return [];

    const out: OneTimeProduct[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 50; page++) {
      const query = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) query.set('pageToken', pageToken);
      const body = await this.request<{
        oneTimeProducts?: OneTimeProduct[];
        nextPageToken?: string;
      }>(`${BASE}/applications/${encodeURIComponent(packageName)}/${segment}?${query}`);
      out.push(...(body.oneTimeProducts ?? []));
      pageToken = body.nextPageToken;
      if (!pageToken) break;
    }
    return out;
  }

  private async oneTimeSegment(packageName: string): Promise<string | null> {
    if (this.oneTimePath !== undefined) return this.oneTimePath;

    for (const candidate of ONE_TIME_SEGMENTS) {
      try {
        await this.request(
          `${BASE}/applications/${encodeURIComponent(packageName)}/${candidate}?pageSize=1`,
        );
        log.info('api', `One-time products available at /${candidate}`);
        this.oneTimePath = candidate;
        return candidate;
      } catch (error) {
        // Only a missing collection is worth trying the next spelling for.
        // A permission or auth failure is a real answer and must surface.
        if (error instanceof PintoError && error.code === 'api/not-found') continue;
        throw error;
      }
    }

    log.warn('api', 'No one-time products endpoint responded; this app may predate the model');
    this.oneTimePath = null;
    return null;
  }

  /**
   * Reads a single one-time product, and returns the URL base that worked so
   * the caller can PATCH the same place.
   *
   * Google's reference pages use different casing for the collection and the
   * item: `list` documents `oneTimeProducts`, but `get`/`patch` document
   * `onetimeproducts`. So the segment that answered for listing 404s (as
   * Google's HTML robot page, not a JSON error) on an item GET. The item path
   * is therefore probed and cached separately from the list path.
   */
  private async fetchOneTimeProduct(
    packageName: string,
    productId: string,
  ): Promise<OneTimeProduct> {
    const encoded = encodeURIComponent(packageName);
    // Cached path first, then the rest — so a stale cache self-heals on 404
    // instead of failing outright.
    const paths = orderedCandidates(this.oneTimeGetPath);

    let lastError: unknown;
    for (const segment of paths) {
      const url = `${BASE}/applications/${encoded}/${segment}/${encodeURIComponent(productId)}`;
      try {
        const product = await this.request<OneTimeProduct>(url);
        this.oneTimeGetPath = segment;
        return product;
      } catch (error) {
        if (error instanceof PintoError && error.code === 'api/not-found') {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : ERRORS.apiNotFound(`one-time product "${productId}"`);
  }

  // --- Reading pricing ------------------------------------------------------

  async getPricing(
    packageName: string,
    kind: ProductKind,
    productId: string,
    basePlanId: string,
  ): Promise<ProductPricing> {
    if (kind === 'subscription') {
      return this.getSubscriptionPricing(packageName, productId, basePlanId);
    }
    if (kind === 'onetime') {
      return this.getOneTimePricing(packageName, productId, basePlanId);
    }
    return this.getInAppPricing(packageName, productId);
  }

  private async getOneTimePricing(
    packageName: string,
    productId: string,
    purchaseOptionId: string,
  ): Promise<ProductPricing> {
    const product = await this.fetchOneTimeProduct(packageName, productId);
    const option = product.purchaseOptions?.find(
      (candidate) => candidate.purchaseOptionId === purchaseOptionId,
    );
    if (!option) throw ERRORS.apiNotFound(`purchase option "${purchaseOptionId}" on ${productId}`);

    const prices: RegionalPrice[] = (option.regionalPricingAndAvailabilityConfigs ?? [])
      .filter((config) => !!config.price)
      .map((config) => ({
        regionCode: config.regionCode,
        currency: config.price!.currencyCode,
        micros: apiMoneyToMicros(config.price!),
      }));

    return {
      packageName,
      kind: 'onetime',
      productId,
      basePlanId: purchaseOptionId,
      label: optionLabel(productId, option),
      prices,
      raw: product,
    };
  }

  private async getSubscriptionPricing(
    packageName: string,
    productId: string,
    basePlanId: string,
  ): Promise<ProductPricing> {
    const sub = await this.request<Subscription>(
      `${BASE}/applications/${encodeURIComponent(packageName)}/subscriptions/${encodeURIComponent(productId)}`,
    );
    const plan = sub.basePlans?.find((p) => p.basePlanId === basePlanId);
    if (!plan) throw ERRORS.apiNotFound(`base plan "${basePlanId}" on ${productId}`);

    const prices: RegionalPrice[] = (plan.regionalConfigs ?? [])
      .filter((config) => !!config.price)
      .map((config) => ({
        regionCode: config.regionCode,
        currency: config.price!.currencyCode,
        micros: apiMoneyToMicros(config.price!),
        availableToNewSubscribers: config.newSubscriberAvailability ?? true,
      }));

    return {
      packageName,
      kind: 'subscription',
      productId,
      basePlanId,
      label: `${productId} · ${planLabel(plan)}`,
      prices,
      raw: sub,
    };
  }

  private async getInAppPricing(
    packageName: string,
    sku: string,
  ): Promise<ProductPricing> {
    const product = await this.request<InAppProduct>(
      `${BASE}/applications/${encodeURIComponent(packageName)}/inappproducts/${encodeURIComponent(sku)}`,
    );
    const prices: RegionalPrice[] = Object.entries(product.prices ?? {}).map(
      ([regionCode, price]) => ({
        regionCode,
        currency: price.currency,
        micros: Number(price.priceMicros),
      }),
    );
    return {
      packageName,
      kind: 'inapp',
      productId: sku,
      basePlanId: INAPP_PLAN,
      label: `${sku} · one-time`,
      prices,
      raw: product,
    };
  }

  // --- Writing pricing ------------------------------------------------------

  /**
   * Writes new regional prices.
   *
   * Both Play endpoints are whole-resource writes: there is no per-country
   * price API. Pinto therefore reads the current resource, replaces only the
   * prices it is asked to change, and sends the result back. Everything else
   * on the product — listings, tags, offers, availability — is passed through
   * untouched, which is why the read happens immediately before the write
   * rather than reusing the copy the UI is holding.
   */
  async updatePrices(
    packageName: string,
    kind: ProductKind,
    productId: string,
    basePlanId: string,
    updates: Record<RegionCode, number>,
  ): Promise<void> {
    if (kind === 'subscription') {
      await this.updateSubscriptionPrices(packageName, productId, basePlanId, updates);
    } else if (kind === 'onetime') {
      await this.updateOneTimePrices(packageName, productId, basePlanId, updates);
    } else {
      await this.updateInAppPrices(packageName, productId, updates);
    }
  }

  private async updateOneTimePrices(
    packageName: string,
    productId: string,
    purchaseOptionId: string,
    updates: Record<RegionCode, number>,
  ): Promise<void> {
    const product = await this.fetchOneTimeProduct(packageName, productId);
    const options = product.purchaseOptions ?? [];
    const option = options.find(
      (candidate) => candidate.purchaseOptionId === purchaseOptionId,
    );
    if (!option) throw ERRORS.apiNotFound(`purchase option "${purchaseOptionId}" on ${productId}`);

    const configs = [...(option.regionalPricingAndAvailabilityConfigs ?? [])];
    const byRegion = new Map(configs.map((config, index) => [config.regionCode, index]));

    for (const [regionCode, micros] of Object.entries(updates)) {
      const index = byRegion.get(regionCode);
      const currency = index !== undefined ? configs[index]!.price?.currencyCode : undefined;
      if (index === undefined || !currency) {
        throw new PintoError({
          code: 'api/region-not-configured',
          message: `${regionCode} is not an available country for this purchase option.`,
          hint: 'Add the country to the product in Play Console first, then price it with Pinto.',
        });
      }
      // `availability` and every other field on the config are carried over
      // untouched; only the price is replaced.
      configs[index] = { ...configs[index]!, price: microsToApiMoney(micros, currency) };
    }

    const nextOptions = options.map((candidate) =>
      candidate.purchaseOptionId === purchaseOptionId
        ? { ...candidate, regionalPricingAndAvailabilityConfigs: configs }
        : candidate,
    );

    const version = regionsVersionOf(product) ?? (await this.currentRegionsVersion(packageName));
    const query = new URLSearchParams({
      updateMask: 'purchaseOptions',
      'regionsVersion.version': version,
      latencyTolerance: 'PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT',
    });
    const body = JSON.stringify({ ...product, purchaseOptions: nextOptions });

    // The path that answered the GET does not always answer the PATCH: Google's
    // reference pages disagree on casing and the live API disagrees with both.
    // A 404 is safe to retry on another path (nothing was written), so Pinto
    // tries the GET-resolved path first, then the remaining candidates, and
    // stops at the first that is not a missing endpoint.
    const encoded = encodeURIComponent(packageName);
    // Google documents the PATCH path in lowercase but the GET in camelCase,
    // and the live API has disagreed with both, so the write path is probed
    // independently and cached on its own.
    const paths = orderedCandidates(this.oneTimePatchPath);

    let lastError: unknown;
    for (const segment of paths) {
      const target = `${BASE}/applications/${encoded}/${segment}/${encodeURIComponent(productId)}?${query}`;
      try {
        await this.request(target, { method: 'PATCH', body });
        this.oneTimePatchPath = segment;
        return;
      } catch (error) {
        if (error instanceof PintoError && error.code === 'api/not-found') {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : ERRORS.apiNotFound(`a writable path for one-time product "${productId}"`);
  }

  private async updateSubscriptionPrices(
    packageName: string,
    productId: string,
    basePlanId: string,
    updates: Record<RegionCode, number>,
  ): Promise<void> {
    const sub = await this.request<Subscription>(
      `${BASE}/applications/${encodeURIComponent(packageName)}/subscriptions/${encodeURIComponent(productId)}`,
    );
    const plans = sub.basePlans ?? [];
    const plan = plans.find((p) => p.basePlanId === basePlanId);
    if (!plan) throw ERRORS.apiNotFound(`base plan "${basePlanId}" on ${productId}`);

    const configs = [...(plan.regionalConfigs ?? [])];
    const byRegion = new Map(configs.map((c, index) => [c.regionCode, index]));

    for (const [regionCode, micros] of Object.entries(updates)) {
      const index = byRegion.get(regionCode);
      const currency =
        index !== undefined ? configs[index]!.price?.currencyCode : undefined;
      if (index === undefined || !currency) {
        throw new PintoError({
          code: 'api/region-not-configured',
          message: `${regionCode} is not an available country for this base plan.`,
          hint: 'Add the country to the base plan in Play Console first, then price it with Pinto.',
        });
      }
      configs[index] = {
        ...configs[index]!,
        price: microsToApiMoney(micros, currency),
      };
    }

    const nextPlans = plans.map((p) =>
      p.basePlanId === basePlanId ? { ...p, regionalConfigs: configs } : p,
    );

    // A subscription patch resends every region, and Google validates them all
    // against this version. A stale version fails outright once any region's
    // currency has changed (e.g. Bulgaria BGN -> EUR), so Pinto uses the live
    // version discovered from the API rather than a pinned default.
    const version = regionsVersionOf(sub) ?? (await this.currentRegionsVersion(packageName));
    const query = new URLSearchParams({
      updateMask: 'basePlans',
      'regionsVersion.version': version,
      latencyTolerance: 'PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT',
    });

    await this.request(
      `${BASE}/applications/${encodeURIComponent(packageName)}/subscriptions/${encodeURIComponent(productId)}?${query}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ ...sub, basePlans: nextPlans }),
      },
    );
  }

  private async updateInAppPrices(
    packageName: string,
    sku: string,
    updates: Record<RegionCode, number>,
  ): Promise<void> {
    const product = await this.request<InAppProduct>(
      `${BASE}/applications/${encodeURIComponent(packageName)}/inappproducts/${encodeURIComponent(sku)}`,
    );
    const prices: Record<string, InAppPrice> = { ...(product.prices ?? {}) };

    for (const [regionCode, micros] of Object.entries(updates)) {
      const existing = prices[regionCode];
      if (!existing) {
        throw new PintoError({
          code: 'api/region-not-configured',
          message: `${regionCode} has no price on this product yet.`,
          hint: 'Add the country to the product in Play Console first, then price it with Pinto.',
        });
      }
      prices[regionCode] = { currency: existing.currency, priceMicros: String(Math.round(micros)) };
    }

    const query = new URLSearchParams({
      autoConvertMissingPrices: 'false',
      latencyTolerance: 'PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT',
    });

    await this.request(
      `${BASE}/applications/${encodeURIComponent(packageName)}/inappproducts/${encodeURIComponent(sku)}?${query}`,
      { method: 'PATCH', body: JSON.stringify({ ...product, prices }) },
    );
  }

  // --- Transport ------------------------------------------------------------

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await this.options.getAccessToken();
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      throw ERRORS.network(error instanceof Error ? error.message : String(error));
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    if (!response.ok) {
      // A wrong path yields Google's HTML robot page rather than a JSON error
      // envelope. Dumping that page helps no one; replace it with the request
      // path, which is the thing actually worth knowing.
      const isHtml = /^\s*<(?:!doctype|html)/i.test(text);
      throw toApiError(response.status, isHtml ? `No such endpoint: ${pathOf(url)}` : text);
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new PintoError({
        code: 'api/bad-response',
        message: 'Google Play returned a response Pinto could not read.',
        detail: text.slice(0, 500),
        retryable: true,
      });
    }
  }
}

/**
 * Drops the one failure that is expected rather than actionable.
 *
 * Once an app's one-time products live in the purchase-option model, Google
 * refuses the legacy `inappproducts` collection for that app outright. Left
 * alone, Pinto reported that 403 with a hint about enabling the API and
 * checking permissions — sending the developer to hunt a configuration problem
 * that does not exist, on an app whose other two catalogues loaded fine.
 *
 * The failure is only suppressed when the newer API actually returned
 * products, and it still goes to the operation log. If nothing loaded, the
 * warning stands: an empty list must never be mistaken for an empty catalogue.
 */
function prune(
  unavailable: ProductCatalogue['unavailable'],
  oneTimeModelWorked: boolean,
): ProductCatalogue['unavailable'] {
  if (!oneTimeModelWorked) return unavailable;
  return unavailable.filter((entry) => {
    const superseded =
      entry.kind === 'inapp' && (entry.code === 'api/forbidden' || entry.code === 'api/not-found');
    if (superseded) {
      log.info(
        'api',
        'Legacy managed-products endpoint refused; this app uses the one-time product model',
        entry.code,
      );
    }
    return !superseded;
  });
}

/**
 * The regions version a freshly-read product reports. Play returns this as an
 * output-only field on the newer monetization resources; echoing it back on
 * the write keeps the update on the same version the product's currencies were
 * set with, which is exactly what avoids "expected BGN but got EUR" style
 * rejections. Returns null for older resources that don't carry it, so the
 * caller falls back to the configured default.
 */
function regionsVersionOf(resource: {
  regionsVersion?: { version?: string };
}): string | null {
  const version = resource.regionsVersion?.version;
  return typeof version === 'string' && version.length > 0 ? version : null;
}

/** A sensible non-zero reference so the conversion ratios are well-defined. */
function minorReference(currency: CurrencyCode): number {
  return Math.max(minorUnitMicros(currency), MICROS_PER_UNIT);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace('/androidpublisher/v3/applications/', '.../');
  } catch {
    return url;
  }
}

function optionLabel(productId: string, option: PurchaseOption): string {
  const parts = [productId, option.purchaseOptionId];
  if (option.rentOption) parts.push('rent');
  else if (option.buyOption) parts.push('buy');
  if (option.state && option.state !== 'ACTIVE') parts.push(option.state.toLowerCase());
  return parts.join(' · ');
}

function reasonOf(error: unknown): { reason: string; code?: string } {
  if (error instanceof PintoError) {
    return {
      reason: error.hint ? `${error.message} ${error.hint}` : error.message,
      code: error.code,
    };
  }
  return {
    reason: error instanceof Error ? error.message : 'Google Play did not answer.',
  };
}

function planLabel(plan: BasePlan): string {
  const period =
    plan.autoRenewingBasePlanType?.billingPeriodDuration ??
    plan.prepaidBasePlanType?.billingPeriodDuration;
  const parts = [plan.basePlanId];
  if (period) parts.push(humanPeriod(period));
  if (plan.state && plan.state !== 'ACTIVE') parts.push(plan.state.toLowerCase());
  return parts.join(' · ');
}

function humanPeriod(iso: string): string {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso);
  if (!match) return iso;
  const [, y, m, w, d] = match;
  if (y) return `${y} year${y === '1' ? '' : 's'}`;
  if (m) return `${m} month${m === '1' ? '' : 's'}`;
  if (w) return `${w} week${w === '1' ? '' : 's'}`;
  if (d) return `${d} day${d === '1' ? '' : 's'}`;
  return iso;
}

/** Turns a Google API error envelope into something a developer can act on. */
export function toApiError(status: number, body: string): PintoError {
  const detail = extractMessage(body) ?? body.slice(0, 500);
  if (status === 401) return ERRORS.sessionExpired();
  if (status === 403) return ERRORS.apiForbidden(detail);
  if (status === 404) {
    return new PintoError({
      code: 'api/not-found',
      message: 'Google Play could not find that resource.',
      hint: 'Check the package name, and that the product still exists.',
      detail,
    });
  }
  if (status === 400) {
    // A currency/regions-version mismatch fails the whole batch and cannot be
    // bisected away, because the offending region rides along in every write.
    // Name it precisely so the user is not told to "review the countries".
    const mismatch = /Invalid currency for region code (\w+).*Expected (\w+) but got (\w+)/i.exec(
      detail,
    );
    if (mismatch) {
      const [, region, expected, got] = mismatch;
      return new PintoError({
        code: 'api/regions-version',
        message: `${region} is priced in ${got}, but Pinto asked Google Play to treat it as ${expected}.`,
        hint: `This is a regions-version mismatch — usually a country that recently switched currency (for example Bulgaria adopting the euro). Pinto discovers the current regions version from Google Play automatically; reload the prices and try again.`,
        detail,
      });
    }
    return new PintoError({
      code: 'api/rejected',
      message: 'Google Play rejected the change.',
      hint: 'Pinto will try to narrow this down to the countries responsible.',
      detail,
    });
  }
  if (status === 409) {
    return new PintoError({
      code: 'api/conflict',
      message: 'The product changed while Pinto was updating it.',
      hint: 'Reload the prices and try again.',
      detail,
      retryable: true,
    });
  }
  if (status === 429) {
    return new PintoError({
      code: 'api/rate-limited',
      message: 'Google Play is rate-limiting the Play Developer API.',
      hint: 'Wait a minute and retry.',
      detail,
      retryable: true,
    });
  }
  if (status >= 500) {
    return new PintoError({
      code: 'api/server',
      message: 'Google Play had a server error.',
      hint: 'This is usually temporary — retry in a moment.',
      detail,
      retryable: true,
    });
  }
  return new PintoError({
    code: `api/http-${status}`,
    message: `Google Play returned HTTP ${status}.`,
    detail,
    retryable: status >= 500,
  });
}

function extractMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? null;
  } catch {
    return null;
  }
}

/**
 * Region codes named in an API error message, used to point the user straight
 * at the offending countries. Only codes Pinto actually sent are considered —
 * matching bare two-letter tokens against the whole country table would
 * happily "find" Indonesia in the word `ID` inside a field path.
 */
export function regionsInError(message: string, candidates: RegionCode[]): RegionCode[] {
  return candidates.filter((code) => new RegExp(`\\b${code}\\b`).test(message));
}
