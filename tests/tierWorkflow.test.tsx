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

// Spans all five economic bands as well as several sub-regions, so both the
// geographic grouping and the generated ladder have something to work with.
const PRICES = [
  ['FR', 'EUR', 4.99], // Western Europe · T1
  ['DE', 'EUR', 4.99], // Western Europe · T1
  ['US', 'USD', 4.99], // Northern America · T1
  ['PL', 'USD', 4.99], // Eastern Europe · T2
  ['BR', 'USD', 4.99], // South America · T3
  ['MA', 'MAD', 49], // North Africa · T4
  ['DZ', 'DZD', 400], // North Africa · T4
  ['NG', 'NGN', 2500], // West Africa · T4
  ['KE', 'KES', 500], // East Africa · T4
  ['IN', 'USD', 4.99], // South Asia · T5
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

/**
 * Empties every band. Choosing Tiers now lands on a generated purchasing-power
 * ladder, so tests about manual assignment start by clearing it — otherwise
 * they would be asserting against the generator's output rather than their own.
 */
async function clearAllTiers(user: ReturnType<typeof userEvent.setup>) {
  for (;;) {
    const buttons = screen.queryAllByTitle(/^Unassign every market from/);
    if (!buttons.length) return;
    await user.click(buttons[0]!);
  }
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
    await clearAllTiers(user);
  }

  it('assigns a whole sub-region to a tier in one step', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    const tierB = tierRow('T2 · Established');
    await user.selectOptions(
      within(tierB).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );

    expect(within(tierRow('T2 · Established')).getByText(/2 markets/)).toBeTruthy();
  });

  it('builds a full Europe / Maghreb / sub-Saharan ladder without touching the country list', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('T1 · Premium')).getByLabelText('Add a region to T1 · Premium'),
      'continent:Europe',
    );
    await user.selectOptions(
      within(tierRow('T2 · Established')).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );
    await user.selectOptions(
      within(tierRow('T4 · Lower-mid')).getByLabelText('Add a region to T4 · Lower-mid'),
      'subregion:West Africa',
    );
    await user.selectOptions(
      within(tierRow('T4 · Lower-mid')).getByLabelText('Add a region to T4 · Lower-mid'),
      'subregion:East Africa',
    );

    // Europe now spans FR, DE and PL.
    expect(within(tierRow('T1 · Premium')).getByText(/3 markets/)).toBeTruthy();
    expect(within(tierRow('T2 · Established')).getByText(/2 markets/)).toBeTruthy();
    expect(within(tierRow('T4 · Lower-mid')).getByText(/2 markets/)).toBeTruthy();
  });

  it('lets a later assignment move a market between tiers', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('T4 · Lower-mid')).getByLabelText('Add a region to T4 · Lower-mid'),
      'continent:Africa',
    );
    expect(within(tierRow('T4 · Lower-mid')).getByText(/4 markets/)).toBeTruthy();

    await user.selectOptions(
      within(tierRow('T2 · Established')).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );

    expect(within(tierRow('T2 · Established')).getByText(/2 markets/)).toBeTruthy();
    expect(within(tierRow('T4 · Lower-mid')).getByText(/2 markets/)).toBeTruthy();
  });

  it('only offers regions this product actually prices', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    const select = within(tierRow('T1 · Premium')).getByLabelText('Add a region to T1 · Premium');
    const labels = within(select).getAllByRole('option').map((option) => option.textContent);

    expect(labels).toContain('North Africa (2)');
    // The product prices nothing in East Asia, so it is not offered at all.
    expect(labels.some((label) => label?.startsWith('East Asia'))).toBe(false);
  });

  it('clears a tier without disturbing the others', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('T1 · Premium')).getByLabelText('Add a region to T1 · Premium'),
      'continent:Europe',
    );
    await user.selectOptions(
      within(tierRow('T2 · Established')).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('T1 · Premium')).getByTitle('Unassign every market from T1 · Premium'));

    expect(within(tierRow('T1 · Premium')).getByText(/0 markets/)).toBeTruthy();
    expect(within(tierRow('T2 · Established')).getByText(/2 markets/)).toBeTruthy();
  });
});

describe('generating a purchasing-power ladder from the UI', () => {
  async function openTiers(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText('Strategy'));
    await user.click(await screen.findByText('Tiers'));
  }

  it('lands on a real ladder rather than empty bands', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    // Choosing Tiers must not hand back a blank grid — the economic ladder is
    // the job Play Console refuses to do.
    expect(await screen.findByText(/T1 · Premium/)).toBeTruthy();
    expect(within(tierRow('T1 · Premium')).getByText(/markets/)).toBeTruthy();
  });

  it('regenerates with a different steepness on request', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.click(await screen.findByText('Generate'));
    await user.click(await screen.findByText('Aggressive'));
    await user.click(screen.getByText('Generate ladder'));
    // Close the generator so the band labels are unambiguous in the DOM.
    await user.click(screen.getByText('Close'));

    // Aggressive drops the bottom band to 40%.
    expect(within(tierRow('T5 · Volume')).getByDisplayValue('40')).toBeTruthy();
  });

  it('shows the resulting price per band before generating', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);
    await user.click(await screen.findByText('Generate'));

    const anchor = screen.getByLabelText('Anchor price');
    await user.clear(anchor);
    await user.type(anchor, '10');

    // Balanced: T3 sits at 70% -> 7.00 previewed before anything is applied.
    expect(await screen.findByText('7.00')).toBeTruthy();
  });

  it('states the basis instead of presenting the bands as fact', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);
    await user.click(await screen.findByText('Generate'));

    expect(screen.getByText(/starting point to edit, not a measurement/i)).toBeTruthy();
  });

  it('leaves the generated ladder fully editable', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    const share = within(tierRow('T3 · Upper-mid')).getByDisplayValue('70');
    await user.clear(share);
    await user.type(share, '55');
    expect(within(tierRow('T3 · Upper-mid')).getByDisplayValue('55')).toBeTruthy();
  });
});

describe('seeing what is in a tier', () => {
  async function openTiers(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText('Strategy'));
    await user.click(await screen.findByText('Tiers'));
    await clearAllTiers(user);
  }

  it('lists the countries behind the count, not just the number', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('T2 · Established')).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('T2 · Established')).getByText(/2 markets/));

    const members = screen.getByLabelText('Markets in T2 · Established');
    expect(within(members).getByText('Morocco')).toBeTruthy();
    expect(within(members).getByText('Algeria')).toBeTruthy();
  });

  it('collapses again', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('T2 · Established')).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('T2 · Established')).getByText(/2 markets/));
    await user.click(within(tierRow('T2 · Established')).getByText(/2 markets/));

    expect(screen.queryByLabelText('Markets in T2 · Established')).toBeNull();
  });

  it('removes a single country from a tier', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    await user.selectOptions(
      within(tierRow('T2 · Established')).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );
    await user.click(within(tierRow('T2 · Established')).getByText(/2 markets/));
    await user.click(screen.getByLabelText('Remove Morocco from T2 · Established'));

    expect(within(tierRow('T2 · Established')).getByText(/1 markets/)).toBeTruthy();
    expect(within(screen.getByLabelText('Markets in T2 · Established')).queryByText('Morocco')).toBeNull();
    expect(within(screen.getByLabelText('Markets in T2 · Established')).getByText('Algeria')).toBeTruthy();
  });

  it('cannot be expanded while the tier is empty', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openTiers(user);

    const count = within(tierRow('T3 · Upper-mid')).getByText(/0 markets/).closest('button')!;
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
    await clearAllTiers(user);

    await user.selectOptions(
      within(tierRow('T2 · Established')).getByLabelText('Add a region to T2 · Established'),
      'subregion:North Africa',
    );

    expect(await screen.findByText(/2 tiered markets are not selected/)).toBeTruthy();

    await user.click(screen.getByText('Select them'));

    expect(await screen.findByText('All 2 tiered markets are selected.')).toBeTruthy();
  });
});
