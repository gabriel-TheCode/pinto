/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unitsToMicros } from '@/domain/money/money';
import type { Request } from '@/services/messages';

/**
 * Proves the panel actually mounts and moves between its states. These are the
 * screens a user gets stuck on when something is wrong — signed out, wrong
 * page, unknown app — so each one is asserted rather than assumed.
 */

const state = {
  signedIn: true,
  clientIdConfigured: true,
  supported: true,
  packageName: 'com.example.app' as string | null,
  unavailable: [] as { kind: string; reason: string }[],
};

function respond(request: Request): unknown {
  switch (request.type) {
    case 'auth/state':
      return {
        signedIn: state.signedIn,
        email: 'dev@example.com',
        name: 'Dev',
        picture: null,
        expiresAt: Date.now() + 3_600_000,
        clientIdConfigured: state.clientIdConfigured,
      };
    case 'auth/getClientId':
      return { clientId: state.clientIdConfigured ? 'client-id' : null };
    case 'context/get':
      return {
        developerId: '1',
        consoleAppId: '42',
        packageName: state.packageName,
        packageNameSource: 'cache',
        productKind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        url: 'https://play.google.com/console/u/0/developers/1/app/42/subscriptions/premium',
        supported: state.supported,
      };
    case 'products/list':
      return { unavailable: state.unavailable, products: [
        {
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'monthly',
          label: 'premium · monthly',
          regionCount: 3,
        },
      ] };
    case 'products/pricing':
      return {
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        label: 'premium · monthly',
        prices: [
          { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99) },
          { regionCode: 'FR', currency: 'EUR', micros: unitsToMicros(4.99) },
          { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800) },
        ],
        raw: {},
      };
    case 'history/list':
    case 'presets/list':
      return [];
    default:
      return null;
  }
}

beforeEach(() => {
  vi.resetModules();
  state.signedIn = true;
  state.clientIdConfigured = true;
  state.supported = true;
  state.packageName = 'com.example.app';
  state.unavailable = [];
  chrome.runtime.sendMessage = vi.fn(async (message: unknown) => ({
    ok: true,
    data: respond(message as Request),
  })) as unknown as typeof chrome.runtime.sendMessage;
});

async function renderApp() {
  const { App } = await import('@/app/App');
  return render(<App />);
}

describe('authentication states', () => {
  it('shows the sign-in screen when signed out', async () => {
    state.signedIn = false;
    await renderApp();
    expect(await screen.findByText('Continue with Google')).toBeTruthy();
    expect(screen.getByText('Bulk pricing, without the bulk work.')).toBeTruthy();
  });

  it('blocks sign-in until an OAuth client ID exists, and says so', async () => {
    state.signedIn = false;
    state.clientIdConfigured = false;
    await renderApp();

    const button = (await screen.findByText('Continue with Google')).closest('button')!;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Add a client ID above/)).toBeTruthy();
  });

  it('shows the workspace when signed in', async () => {
    await renderApp();
    expect(await screen.findByText('United States')).toBeTruthy();
    expect(screen.getByText('dev@example.com')).toBeTruthy();
  });
});

describe('context states', () => {
  it('explains itself on an unsupported page instead of showing an empty table', async () => {
    state.supported = false;
    await renderApp();
    expect(await screen.findByText('Open a pricing page')).toBeTruthy();
  });

  it('asks for the package name when it cannot be resolved', async () => {
    state.packageName = null;
    await renderApp();
    expect(await screen.findByText('Which app is this?')).toBeTruthy();
  });
});

describe('product catalogue', () => {
  it('never lets a failed listing look like "you have none"', async () => {
    state.unavailable = [
      { kind: 'onetime', reason: 'Google Play refused the request for this app.' },
    ];
    await renderApp();

    expect(await screen.findByText(/One-time products could not be listed/)).toBeTruthy();
    expect(screen.getByText(/this is not the same as having none/)).toBeTruthy();
  });

  it('says where to create a one-time product when the app genuinely has none', async () => {
    await renderApp();
    await screen.findByText('United States');
    expect(screen.getByText(/A lifetime purchase is a one-time product/)).toBeTruthy();
  });
});

describe('pricing workspace', () => {
  it('lists every priced country with its current price', async () => {
    await renderApp();
    expect(await screen.findByText('United States')).toBeTruthy();
    expect(screen.getByText('France')).toBeTruthy();
    expect(screen.getByText('Japan')).toBeTruthy();
    expect(screen.getByText('USD 4.99')).toBeTruthy();
    expect(screen.getByText('JPY 800')).toBeTruthy();
  });

  it('filters countries as you search', async () => {
    const user = userEvent.setup();
    await renderApp();
    await screen.findByText('United States');

    await user.type(screen.getByPlaceholderText(/Search countries/), 'fra');

    await waitFor(() => expect(screen.queryByText('United States')).toBeNull());
    expect(screen.getByText('France')).toBeTruthy();
  });

  it('moves to the review screen and shows what will be written', async () => {
    const user = userEvent.setup();
    await renderApp();
    await screen.findByText('United States');

    await user.click(screen.getByText('Review changes'));

    expect(await screen.findByText('Review changes', { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText(/Apply to 3 countries/)).toBeTruthy();
  });

  it('requires a typed confirmation only for large batches', async () => {
    const user = userEvent.setup();
    await renderApp();
    await screen.findByText('United States');
    await user.click(screen.getByText('Review changes'));

    // Three countries is small enough to apply directly.
    const apply = (await screen.findByText(/Apply to 3 countries/)).closest('button')!;
    expect(apply.disabled).toBe(false);
  });
});
