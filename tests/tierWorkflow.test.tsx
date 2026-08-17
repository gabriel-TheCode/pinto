/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unitsToMicros } from '@/domain/money/money';
import type { Request } from '@/services/messages';

/**
 * The tiering flow a developer actually runs: price Europe at 100%, the
 * Maghreb at 80% and sub-Saharan Africa at 40%, without leaving the strategy
 * screen to hand-pick countries for each band.
 */

const PRICES = [
  ['FR', 'EUR', 4.99], // Western Europe
  ['DE', 'EUR', 4.99], // Western Europe
  ['MA', 'MAD', 49], // North Africa
  ['DZ', 'DZD', 400], // North Africa
  ['NG', 'NGN', 2500], // West Africa
  ['KE', 'KES', 500], // East Africa
  ['US', 'USD', 4.99], // Northern America
] as const;

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
      return { unavailable: [], products: [
        {
          kind: 'subscription',
          productId: 'premium',
          basePlanId: 'monthly',
          label: 'premium · monthly',
          regionCount: PRICES.length,
        },
      ] };
    case 'products/pricing':
      return {
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        label: 'premium · monthly',
        prices: PRICES.map(([regionCode, currency, amount]) => ({
          regionCode,
          currency,
          micros: unitsToMicros(amount),
        })),
        raw: {},
      };
    default:
      return [];
  }
}

beforeEach(() => {
  vi.resetModules();
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

function tierRow(name: string): HTMLElement {
  return screen.getByText(name).closest('div.flex-col')!;
}

describe('sub-region filter chips', () => {
  it('reveals sub-regions once a continent is picked', async () => {
    const user = userEvent.setup();
    await renderApp();

    expect(screen.queryByText('North Africa')).toBeNull();
    await user.click(screen.getByText('Africa'));

    expect(await screen.findByText('North Africa')).toBeTruthy();
    expect(screen.getByText('West Africa')).toBeTruthy();
    // Europe was not picked, so its sub-regions stay hidden.
    expect(screen.queryByText('Western Europe')).toBeNull();
  });

  it('narrows the table to a single sub-region', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Africa'));
    await user.click(await screen.findByText('North Africa'));

    await waitFor(() => expect(screen.queryByText('Nigeria')).toBeNull());
    expect(screen.getByText('Morocco')).toBeTruthy();
    expect(screen.getByText('Algeria')).toBeTruthy();
    expect(screen.queryByText('France')).toBeNull();
  });

  it('keeps an active sub-region visible after its continent is unticked', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Africa'));
    await user.click(await screen.findByText('North Africa'));
    await user.click(screen.getByText('Africa'));

    expect(screen.getByText('North Africa')).toBeTruthy();
  });

  it('resets every filter at once', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Africa'));
    await user.click(await screen.findByText('North Africa'));
    await user.click(screen.getByText('Reset filters'));

    expect(await screen.findByText('France')).toBeTruthy();
    expect(screen.queryByText('North Africa')).toBeNull();
  });
});

describe('assigning tiers by region', () => {
  async function openTiers(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText('Strategy'));
    await user.click(await screen.findByText('Tiers'));
  }

  it('assigns a whole sub-region to a tier in one step', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    const tierB = tierRow('Tier B');
    await user.selectOptions(
      within(tierB).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );

    expect(within(tierRow('Tier B')).getByText(/2 markets/)).toBeTruthy();
  });

  it('builds a full Europe / Maghreb / sub-Saharan ladder without touching the country list', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('Tier A')).getByLabelText('Add a region to Tier A'),
      'continent:Europe',
    );
    await user.selectOptions(
      within(tierRow('Tier B')).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );
    await user.selectOptions(
      within(tierRow('Tier D')).getByLabelText('Add a region to Tier D'),
      'subregion:West Africa',
    );
    await user.selectOptions(
      within(tierRow('Tier D')).getByLabelText('Add a region to Tier D'),
      'subregion:East Africa',
    );

    expect(within(tierRow('Tier A')).getByText(/2 markets/)).toBeTruthy();
    expect(within(tierRow('Tier B')).getByText(/2 markets/)).toBeTruthy();
    expect(within(tierRow('Tier D')).getByText(/2 markets/)).toBeTruthy();
  });

  it('lets a later assignment move a market between tiers', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('Tier D')).getByLabelText('Add a region to Tier D'),
      'continent:Africa',
    );
    expect(within(tierRow('Tier D')).getByText(/4 markets/)).toBeTruthy();

    await user.selectOptions(
      within(tierRow('Tier B')).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );

    expect(within(tierRow('Tier B')).getByText(/2 markets/)).toBeTruthy();
    expect(within(tierRow('Tier D')).getByText(/2 markets/)).toBeTruthy();
  });

  it('only offers regions this product actually prices', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    const select = within(tierRow('Tier A')).getByLabelText('Add a region to Tier A');
    const labels = within(select).getAllByRole('option').map((option) => option.textContent);

    expect(labels).toContain('North Africa (2)');
    expect(labels.some((label) => label?.startsWith('South Asia'))).toBe(false);
  });

  it('clears a tier without disturbing the others', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('Tier A')).getByLabelText('Add a region to Tier A'),
      'continent:Europe',
    );
    await user.selectOptions(
      within(tierRow('Tier B')).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('Tier A')).getByTitle('Unassign every market from Tier A'));

    expect(within(tierRow('Tier A')).getByText(/0 markets/)).toBeTruthy();
    expect(within(tierRow('Tier B')).getByText(/2 markets/)).toBeTruthy();
  });
});

describe('seeing what is in a tier', () => {
  async function openTiers(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText('Strategy'));
    await user.click(await screen.findByText('Tiers'));
  }

  it('lists the countries behind the count, not just the number', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('Tier B')).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('Tier B')).getByText(/2 markets/));

    const members = screen.getByLabelText('Markets in Tier B');
    expect(within(members).getByText('Morocco')).toBeTruthy();
    expect(within(members).getByText('Algeria')).toBeTruthy();
  });

  it('collapses again', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('Tier B')).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('Tier B')).getByText(/2 markets/));
    await user.click(within(tierRow('Tier B')).getByText(/2 markets/));

    expect(screen.queryByLabelText('Markets in Tier B')).toBeNull();
  });

  it('removes a single country from a tier', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('Tier B')).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('Tier B')).getByText(/2 markets/));
    await user.click(screen.getByLabelText('Remove Morocco from Tier B'));

    expect(within(tierRow('Tier B')).getByText(/1 markets/)).toBeTruthy();
    expect(within(screen.getByLabelText('Markets in Tier B')).queryByText('Morocco')).toBeNull();
    expect(within(screen.getByLabelText('Markets in Tier B')).getByText('Algeria')).toBeTruthy();
  });

  it('cannot be expanded while the tier is empty', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    const count = within(tierRow('Tier C')).getByText(/0 markets/).closest('button')!;
    expect(count.disabled).toBe(true);
  });
});

describe('tiered but unselected markets', () => {
  it('warns when a tiered market would not be written, and fixes it in one click', async () => {
    const user = userEvent.setup();
    await renderApp();

    // Deselect everything, so tiers are set but nothing would be written.
    await user.click(screen.getByText('Clear'));
    await user.click(screen.getByText('Strategy'));
    await user.click(await screen.findByText('Tiers'));

    await user.selectOptions(
      within(tierRow('Tier B')).getByLabelText('Add a region to Tier B'),
      'subregion:North Africa',
    );

    expect(await screen.findByText(/2 tiered markets are not selected/)).toBeTruthy();

    await user.click(screen.getByText('Select them'));

    expect(await screen.findByText('All 2 tiered markets are selected.')).toBeTruthy();
  });
});
