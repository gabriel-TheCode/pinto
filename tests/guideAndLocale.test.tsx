/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unitsToMicros } from '@/domain/money/money';
import type { Request } from '@/services/messages';

let storedSettings: Record<string, unknown> = {};

function respond(request: Request): unknown {
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
    case 'context/get':
      return {
        developerId: '1',
        consoleAppId: '42',
        packageName: 'com.example.app',
        packageNameSource: 'cache',
        productKind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        url: 'https://play.google.com/console/u/0/developers/1/app/42/subscriptions/premium',
        supported: true,
      };
    case 'products/list':
      return {
        unavailable: [],
        products: [
          {
            kind: 'subscription',
            productId: 'premium',
            basePlanId: 'monthly',
            label: 'premium · monthly',
            regionCount: 1,
          },
        ],
      };
    case 'products/pricing':
      return {
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        label: 'premium · monthly',
        prices: [{ regionCode: 'FR', currency: 'EUR', micros: unitsToMicros(4.99) }],
        raw: {},
      };
    case 'settings/get':
      return storedSettings;
    case 'settings/update':
      storedSettings = { ...storedSettings, ...request.patch };
      return storedSettings;
    default:
      return [];
  }
}

beforeEach(() => {
  vi.resetModules();
  storedSettings = {};
  chrome.runtime.sendMessage = vi.fn(async (message: unknown) => ({
    ok: true,
    data: respond(message as Request),
  })) as unknown as typeof chrome.runtime.sendMessage;
});

async function renderApp() {
  const { App } = await import('@/app/App');
  const view = render(<App />);
  await screen.findByText('France');
  return view;
}

describe('the Guide', () => {
  it('is reachable from the navigation', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Guide'));
    expect(await screen.findByText('How Pinto works')).toBeTruthy();
  });

  it('explains the workflow end to end', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByText('Guide'));

    for (const heading of [
      'Before you start',
      'The four steps',
      'Which strategy to use',
      'Pricing by economic zone',
      'Safety',
      'Common messages',
      'Keyboard',
    ]) {
      expect(await screen.findByText(heading), heading).toBeTruthy();
    }
  });

  it('states the caveat on the economic bands where the feature is explained', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByText('Guide'));

    expect(screen.getByText(/starting point to argue with, not a measurement/i)).toBeTruthy();
  });
});

describe('language', () => {
  it('switches the interface to French and persists the choice', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Settings'));
    await user.click(await screen.findByText('Français'));

    // Navigation is translated immediately.
    expect(await screen.findByText('Prix')).toBeTruthy();
    expect(screen.getByText('Stratégie')).toBeTruthy();
    expect(storedSettings.locale).toBe('fr');
  });

  it('translates the guide, not just the chrome', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Settings'));
    await user.click(await screen.findByText('Français'));
    await user.click(await screen.findByText('Guide'));

    expect(await screen.findByText('Comment fonctionne Pinto')).toBeTruthy();
    expect(screen.getByText('Les quatre étapes')).toBeTruthy();
  });

  it('restores a stored language on boot', async () => {
    storedSettings = { locale: 'fr' };
    await renderApp();
    await waitFor(() => expect(screen.getByText('Prix')).toBeTruthy());
  });

  it('goes back to English', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Settings'));
    await user.click(await screen.findByText('Français'));
    await user.click(await screen.findByText('English'));

    expect(await screen.findByText('Pricing')).toBeTruthy();
    expect(storedSettings.locale).toBe('en');
  });
});
