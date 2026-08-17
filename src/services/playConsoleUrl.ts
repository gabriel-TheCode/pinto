import type { PageContext, ProductKind } from '@/types';

/**
 * Parses what Play Console puts in the URL.
 *
 * The URL is the only part of Play Console that is stable enough to depend on:
 * it is a routing contract, it survives redesigns, and it is readable without
 * touching Google's DOM. Everything Pinto *needs* comes from here or from the
 * Play Developer API. The DOM is consulted for exactly one optional
 * convenience — guessing the package name the first time — and the user can
 * always type that instead.
 *
 * Note the URL carries Play Console's internal numeric app id, which is not
 * the package name the API needs; resolving that is handled separately.
 */

const SUBSCRIPTION_SEGMENTS = ['subscriptions', 'subscription'];
const INAPP_SEGMENTS = ['managed-products', 'one-time-products', 'inappproducts', 'in-app-products'];
const PRICING_SEGMENTS = ['pricing', 'app-pricing'];

export function isPlayConsoleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'play.google.com' && parsed.pathname.startsWith('/console');
  } catch {
    return false;
  }
}

export function parsePlayConsoleUrl(url: string): PageContext {
  const empty: PageContext = {
    developerId: null,
    consoleAppId: null,
    packageName: null,
    packageNameSource: null,
    productKind: null,
    productId: null,
    basePlanId: null,
    url,
    supported: false,
  };

  if (!isPlayConsoleUrl(url)) return empty;

  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);

  const developerId = valueAfter(segments, 'developers');
  const consoleAppId = valueAfter(segments, 'app');

  let productKind: ProductKind | null = null;
  let productId: string | null = null;

  const subIndex = segments.findIndex((s) => SUBSCRIPTION_SEGMENTS.includes(s));
  const iapIndex = segments.findIndex((s) => INAPP_SEGMENTS.includes(s));

  if (subIndex >= 0) {
    productKind = 'subscription';
    productId = plausibleProductId(segments[subIndex + 1]);
  } else if (iapIndex >= 0) {
    productKind = 'inapp';
    productId = plausibleProductId(segments[iapIndex + 1]);
  }

  productId ??=
    parsed.searchParams.get('subscriptionId') ??
    parsed.searchParams.get('productId') ??
    parsed.searchParams.get('sku') ??
    null;

  const basePlanId =
    parsed.searchParams.get('basePlanId') ??
    parsed.searchParams.get('basePlan') ??
    valueAfter(segments, 'base-plans') ??
    null;

  const onMonetisationPage =
    subIndex >= 0 || iapIndex >= 0 || segments.some((s) => PRICING_SEGMENTS.includes(s));

  return {
    developerId,
    consoleAppId,
    packageName: null,
    packageNameSource: null,
    productKind,
    productId,
    basePlanId,
    url,
    supported: !!consoleAppId && onMonetisationPage,
  };
}

function valueAfter(segments: string[], key: string): string | null {
  const index = segments.indexOf(key);
  if (index < 0) return null;
  return segments[index + 1] ?? null;
}

/**
 * Guards against reading a UI sub-route ("create", "base-plans") as a product
 * id. Play product ids are lowercase letters, digits, dots and underscores.
 */
const RESERVED = new Set(['create', 'new', 'base-plans', 'offers', 'edit', 'list']);

function plausibleProductId(segment: string | undefined): string | null {
  if (!segment) return null;
  if (RESERVED.has(segment)) return null;
  return /^[a-z0-9](?:[a-z0-9._]*)$/.test(segment) ? segment : null;
}
