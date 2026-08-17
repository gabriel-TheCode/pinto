import { describe, expect, it } from 'vitest';
import { isPlayConsoleUrl, parsePlayConsoleUrl } from '@/services/playConsoleUrl';

const DEV = 'https://play.google.com/console/u/0/developers/1234567890123456789';

describe('page detection', () => {
  it('recognises Play Console', () => {
    expect(isPlayConsoleUrl(`${DEV}/app/4972345/subscriptions`)).toBe(true);
    expect(isPlayConsoleUrl('https://play.google.com/store/apps/details?id=com.x')).toBe(false);
    expect(isPlayConsoleUrl('https://example.com/console')).toBe(false);
    expect(isPlayConsoleUrl('not a url')).toBe(false);
  });

  it('marks non-monetisation Play Console pages as unsupported', () => {
    const context = parsePlayConsoleUrl(`${DEV}/app/4972345/app-dashboard`);
    expect(context.supported).toBe(false);
    expect(context.consoleAppId).toBe('4972345');
  });
});

describe('context extraction', () => {
  it('reads developer and app ids', () => {
    const context = parsePlayConsoleUrl(`${DEV}/app/4972345/subscriptions`);
    expect(context.developerId).toBe('1234567890123456789');
    expect(context.consoleAppId).toBe('4972345');
    expect(context.productKind).toBe('subscription');
    expect(context.supported).toBe(true);
  });

  it('reads a subscription product id from the path', () => {
    const context = parsePlayConsoleUrl(`${DEV}/app/4972345/subscriptions/premium.monthly`);
    expect(context.productId).toBe('premium.monthly');
  });

  it('reads a product id from the query string', () => {
    const context = parsePlayConsoleUrl(
      `${DEV}/app/4972345/subscriptions?subscriptionId=premium&basePlanId=monthly`,
    );
    expect(context.productId).toBe('premium');
    expect(context.basePlanId).toBe('monthly');
  });

  it('does not mistake a UI sub-route for a product id', () => {
    const context = parsePlayConsoleUrl(`${DEV}/app/4972345/subscriptions/create`);
    expect(context.productId).toBeNull();
  });

  it('handles one-time products under any of the names Play Console has used', () => {
    for (const segment of ['managed-products', 'one-time-products', 'in-app-products']) {
      const context = parsePlayConsoleUrl(`${DEV}/app/4972345/${segment}/coins_100`);
      expect(context.productKind).toBe('inapp');
      expect(context.productId).toBe('coins_100');
    }
  });

  it('treats the app pricing page as supported with no product', () => {
    const context = parsePlayConsoleUrl(`${DEV}/app/4972345/pricing`);
    expect(context.supported).toBe(true);
    expect(context.productKind).toBeNull();
  });

  it('returns an empty context for anything else, without throwing', () => {
    const context = parsePlayConsoleUrl('https://example.com');
    expect(context.supported).toBe(false);
    expect(context.consoleAppId).toBeNull();
  });

  it('never claims to know the package name from the URL alone', () => {
    const context = parsePlayConsoleUrl(`${DEV}/app/4972345/subscriptions/premium`);
    expect(context.packageName).toBeNull();
    expect(context.packageNameSource).toBeNull();
  });
});
