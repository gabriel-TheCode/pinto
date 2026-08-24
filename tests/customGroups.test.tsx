/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unitsToMicros } from '@/domain/money/money';
import { parseCustomGroup } from '@/domain/regions/schema';
import type { CustomGroup } from '@/domain/regions/groups';
import type { Request } from '@/services/messages';

const PRICES = [
  ['FR', 'EUR', 4.99],
  ['DE', 'EUR', 4.99],
  ['RO', 'RON', 22],
  ['BG', 'USD', 4.79],
  ['US', 'USD', 4.99],
] as const;

let stored: CustomGroup[] = [];

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
    case 'groups/list':
      return stored;
    case 'groups/save':
      stored = [parseCustomGroup(request.group), ...stored];
      return stored;
    case 'groups/delete':
      stored = stored.filter((group) => group.id !== request.id);
      return stored;
    default:
      return [];
  }
}

beforeEach(() => {
  vi.resetModules();
  stored = [];
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

describe('creating a group', () => {
  it('saves the current selection under a name', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Clear'));
    await user.click(screen.getByText('France'));
    await user.click(screen.getByText('Germany'));

    await user.click(screen.getByText(/Save selection as group/));
    await user.type(screen.getByLabelText('Group name'), 'EU high income');
    await user.click(screen.getByText('Save'));

    expect(await screen.findByText('EU high income')).toBeTruthy();
    expect(stored[0]!.members.sort()).toEqual(['DE', 'FR']);
  });

  it('can be saved with the Enter key', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText(/Save selection as group/));
    await user.type(screen.getByLabelText('Group name'), 'Everything{Enter}');

    expect(await screen.findByText('Everything')).toBeTruthy();
  });

  it('cannot be saved empty', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText(/Save selection as group/));
    const save = screen.getByText('Save').closest('button')!;
    expect(save.disabled).toBe(true);
  });

  it('offers nothing to save when no country is selected', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByText('Clear'));

    const button = screen.getByText(/Save selection as group/).closest('button')!;
    expect(button.disabled).toBe(true);
  });
});

describe('using a group', () => {
  beforeEach(() => {
    stored = [
      { id: 'g1', label: 'Rich Europe', members: ['FR', 'DE'], createdAt: 1 },
      { id: 'g2', label: 'Eastern Europe', members: ['RO', 'BG'], createdAt: 2 },
    ];
  });

  it('adds its members to the selection, and composes with another group', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Clear'));
    await user.click(screen.getByText('Rich Europe'));
    expect(screen.getByText('2 countries selected')).toBeTruthy();

    await user.click(screen.getByText('Eastern Europe'));
    expect(screen.getByText('4 countries selected')).toBeTruthy();
  });

  it('shows the member count on the chip', async () => {
    await renderApp();
    const chip = screen.getByText('Rich Europe').closest('button')!;
    expect(within(chip).getByText('2')).toBeTruthy();
  });

  it('deletes a group without touching the others', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByLabelText('Delete group Rich Europe'));

    expect(screen.queryByText('Rich Europe')).toBeNull();
    expect(screen.getByText('Eastern Europe')).toBeTruthy();
  });

  it('is offered when assigning a tier', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Strategy'));
    await user.click(await screen.findByText('Tiers'));

    const select = screen.getAllByLabelText(/Add a region to T1 · Premium/)[0]!;
    const labels = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(labels).toContain('Rich Europe (2)');
    expect(labels).toContain('Eastern Europe (2)');
  });

  it('assigns its members to a tier in one step', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByText('Strategy'));
    await user.click(await screen.findByText('Tiers'));
    // RO and BG already sit in T3; moving Rich Europe (FR, DE) in takes it to 4.
    await user.selectOptions(
      screen.getAllByLabelText(/Add a region to T3 · Upper-mid/)[0]!,
      'custom:g1',
    );

    const row = screen.getByText('T3 · Upper-mid').closest('div.flex-col') as HTMLElement;
    expect(within(row).getByText(/4 markets/)).toBeTruthy();
  });
});

describe('validation at the boundary', () => {
  it('rejects a group with a malformed region code', () => {
    expect(() =>
      parseCustomGroup({ id: 'x', label: 'Bad', members: ['fr'], createdAt: 1 }),
    ).toThrow();
  });

  it('rejects an empty group', () => {
    expect(() => parseCustomGroup({ id: 'x', label: 'Bad', members: [], createdAt: 1 })).toThrow();
  });

  it('de-duplicates members', () => {
    const group = parseCustomGroup({
      id: 'x',
      label: 'Dup',
      members: ['FR', 'FR', 'DE'],
      createdAt: 1,
    });
    expect(group.members).toEqual(['FR', 'DE']);
  });
});
