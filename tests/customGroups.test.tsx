/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { parseCustomGroup } from '@/domain/regions/schema';
import type { CustomGroup } from '@/domain/regions/groups';
import {
  type FakeWorker,
  type Panel,
  chooseKind,
  choosePercent,
  createWorker,
  price,
  renderPanel,
  startsWith,
  toMarkets,
  workspace,
} from './panelHarness';

/**
 * The user's own country groups. A click selects only the group's countries
 * (what people expect from a saved selection); Shift+click adds them, so
 * groups compose. Deleting one asks first.
 */

const PRICES = [
  price('FR', 'EUR', 4.99),
  price('DE', 'EUR', 4.99),
  price('RO', 'RON', 22),
  price('BG', 'EUR', 4.79),
  price('US', 'USD', 4.99),
];

const GROUPS: CustomGroup[] = [
  { id: 'g1', label: 'Rich Europe', members: ['FR', 'DE'], createdAt: 1 },
  // ES is not priced: it must never be selected through the group.
  { id: 'g2', label: 'Eastern Europe', members: ['RO', 'BG', 'ES'], createdAt: 2 },
];

async function openMarkets(groups: CustomGroup[] = []): Promise<{ panel: Panel; worker: FakeWorker }> {
  const worker = createWorker(PRICES);
  worker.groups = groups.map((group) => ({ ...group }));
  const panel = await renderPanel(worker);
  await workspace(panel);
  await choosePercent(panel, '10');
  await toMarkets(panel);
  return { panel, worker };
}

const selection = (panel: Panel) => [...panel.useStore.getState().selection].sort();
const chip = (name: string) => screen.getByRole('button', { name: startsWith(name) });

describe('creating a group', () => {
  it('saves the current selection under a name', async () => {
    const { panel, worker } = await openMarkets();
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.selection.none') }));
    await panel.user.click(screen.getByRole('checkbox', { name: 'France' }));
    await panel.user.click(screen.getByRole('checkbox', { name: 'Germany' }));

    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.groups.save') }));
    const dialog = screen.getByRole('dialog', { name: panel.t('markets.groups.save') });
    expect(within(dialog).getByText(panel.t('markets.groups.saveBody', { count: 2 }))).toBeTruthy();
    await panel.user.type(within(dialog).getByLabelText(panel.t('markets.groups.name')), 'EU high income');
    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('action.save') }));

    expect(await screen.findByRole('button', { name: startsWith('EU high income') })).toBeTruthy();
    expect(worker.groups[0]!.members.sort()).toEqual(['DE', 'FR']);
    expect(await screen.findByText(panel.t('markets.groups.saved', { name: 'EU high income', count: 2 }))).toBeTruthy();
  });

  it('can be saved with the Enter key', async () => {
    const { panel } = await openMarkets();
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.groups.save') }));
    await panel.user.type(screen.getByLabelText(panel.t('markets.groups.name')), 'Everything{Enter}');
    expect(await screen.findByRole('button', { name: startsWith('Everything') })).toBeTruthy();
  });

  it('cannot be saved without a name', async () => {
    const { panel } = await openMarkets();
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.groups.save') }));
    const dialog = screen.getByRole('dialog', { name: panel.t('markets.groups.save') });
    const save = within(dialog).getByRole('button', { name: panel.t('action.save') }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await panel.user.type(within(dialog).getByLabelText(panel.t('markets.groups.name')), '   ');
    expect(save.disabled).toBe(true);
  });

  it('offers nothing to save when no country is selected', async () => {
    const { panel } = await openMarkets();
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.selection.none') }));
    const button = screen.getByRole('button', { name: panel.t('markets.groups.save') }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe('using a group', () => {
  it('a click selects only the group’s countries', async () => {
    const { panel } = await openMarkets(GROUPS);
    expect(selection(panel)).toHaveLength(5);

    await panel.user.click(chip('Rich Europe'));
    expect(selection(panel)).toEqual(['DE', 'FR']);
    expect(chip('Rich Europe').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(panel.t('workspace.summary.selected', { count: 2 }))).toBeTruthy();
  });

  it('Shift+click adds the group to the selection, so groups compose', async () => {
    const { panel } = await openMarkets(GROUPS);
    await panel.user.click(chip('Rich Europe'));
    await panel.user.keyboard('{Shift>}');
    await panel.user.click(chip('Eastern Europe'));
    await panel.user.keyboard('{/Shift}');

    expect(selection(panel)).toEqual(['BG', 'DE', 'FR', 'RO']);
    // Neither chip is "exactly the selection" any more.
    expect(chip('Rich Europe').getAttribute('aria-pressed')).toBe('false');
    expect(chip('Eastern Europe').getAttribute('aria-pressed')).toBe('false');
  });

  it('only selects countries the product is priced in, and counts those', async () => {
    const { panel } = await openMarkets(GROUPS);
    const eastern = chip('Eastern Europe');
    expect(eastern.textContent).toContain('2');
    expect(within(eastern).getByText(panel.t('count.countries', { count: 2 }))).toBeTruthy();
    await panel.user.click(eastern);
    expect(selection(panel)).toEqual(['BG', 'RO']);
  });

  it('explains click and Shift+click next to the chips', async () => {
    const { panel } = await openMarkets(GROUPS);
    const hint = panel.t('markets.groups.hint').replace(/<\/?\w+>/g, '');
    expect(screen.getByText((_, node) => node?.tagName === 'P' && node.textContent === hint)).toBeTruthy();
  });
});

describe('deleting a group', () => {
  it('asks first, then deletes only that group', async () => {
    const { panel, worker } = await openMarkets(GROUPS);
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.groups.delete', { name: 'Rich Europe' }) }));

    const dialog = screen.getByRole('dialog', { name: panel.t('markets.groups.deleteTitle', { name: 'Rich Europe' }) });
    expect(worker.sent('groups/delete')).toHaveLength(0);
    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('action.delete') }));

    await waitFor(() => expect(screen.queryByRole('button', { name: startsWith('Rich Europe') })).toBeNull());
    expect(chip('Eastern Europe')).toBeTruthy();
    expect(worker.sent('groups/delete')[0]!.id).toBe('g1');
    // The selection is not touched.
    expect(selection(panel)).toHaveLength(5);
  });

  it('keeps the group when the dialog is cancelled', async () => {
    const { panel, worker } = await openMarkets(GROUPS);
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.groups.delete', { name: 'Rich Europe' }) }));
    await panel.user.click(screen.getByRole('button', { name: panel.t('action.cancel') }));
    expect(chip('Rich Europe')).toBeTruthy();
    expect(worker.sent('groups/delete')).toHaveLength(0);
  });
});

describe('groups in purchasing-power tiers', () => {
  async function openLadder() {
    const worker = createWorker(PRICES);
    worker.groups = GROUPS.map((group) => ({ ...group }));
    const panel = await renderPanel(worker);
    await workspace(panel);
    await chooseKind(panel, 'tiers');
    await panel.user.click(screen.getByRole('button', { name: startsWith(panel.t('strategy.ladder.generate')) }));
    return panel;
  }

  it('are offered first when assigning a region to a tier, counted on priced countries', async () => {
    const panel = await openLadder();
    const tier = panel.t('band.T1.label');
    const select = screen.getByRole('combobox', { name: panel.t('strategy.tiers.addRegionLabel', { tier }) });
    const mine = select.querySelector(`optgroup[label="${panel.t('strategy.tiers.groups.mine')}"]`)!;
    const labels = within(mine as HTMLElement).getAllByRole('option').map((option) => option.textContent);
    expect(labels).toEqual([
      panel.t('strategy.tiers.groupOption', { name: 'Eastern Europe', count: 2 }),
      panel.t('strategy.tiers.groupOption', { name: 'Rich Europe', count: 2 }),
    ]);
  });

  it('assign their members to a tier in one step', async () => {
    const panel = await openLadder();
    const tier = panel.t('band.T3.label');
    await panel.user.selectOptions(
      screen.getByRole('combobox', { name: panel.t('strategy.tiers.addRegionLabel', { tier }) }),
      'custom:g1',
    );
    const strategy = panel.useStore.getState().config.strategy;
    expect(strategy.kind === 'tiers' && strategy.assignment.FR).toBe(tier);
    expect(strategy.kind === 'tiers' && strategy.assignment.DE).toBe(tier);
  });
});

describe('validation at the boundary', () => {
  it('rejects a group with a malformed region code', () => {
    expect(() => parseCustomGroup({ id: 'x', label: 'Bad', members: ['fr'], createdAt: 1 })).toThrow();
  });

  it('rejects an empty group', () => {
    expect(() => parseCustomGroup({ id: 'x', label: 'Bad', members: [], createdAt: 1 })).toThrow();
  });

  it('de-duplicates members', () => {
    const group = parseCustomGroup({ id: 'x', label: 'Dup', members: ['FR', 'FR', 'DE'], createdAt: 1 });
    expect(group.members).toEqual(['FR', 'DE']);
  });
});
