/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { Locale } from '@/i18n/core';
import {
  type Panel,
  choosePercent,
  createWorker,
  price,
  renderPanel,
  startsWith,
  toMarkets,
  workspace,
} from './panelHarness';

/**
 * Step 2, "where". What is written is the selection; filters only change what
 * is visible. When a filter hides selected countries the step says so and
 * offers to drop them, so nothing is written out of sight.
 */

const PRICES = [
  price('US', 'USD', 4.99),
  price('FR', 'EUR', 4.99),
  price('DE', 'EUR', 4.99),
  price('JP', 'JPY', 800),
  price('CI', 'XOF', 2900),
];

async function openMarkets(locale: Locale = 'en'): Promise<Panel> {
  const panel = await renderPanel(createWorker(PRICES), { locale });
  await workspace(panel);
  await choosePercent(panel, '10');
  await toMarkets(panel);
  return panel;
}

const table = (panel: Panel) => screen.getByRole('list', { name: panel.t('markets.table.label') });
const rowNames = (panel: Panel) =>
  within(table(panel))
    .getAllByRole('checkbox')
    .map((box) => box.getAttribute('aria-labelledby') && document.getElementById(box.getAttribute('aria-labelledby')!)!.textContent);
const search = (panel: Panel) => screen.getByRole('searchbox', { name: panel.t('markets.search.label') });
const selection = (panel: Panel) => [...panel.useStore.getState().selection].sort();

describe('the country table', () => {
  it('starts with every priced country selected, and shows each one', async () => {
    const panel = await openMarkets();
    expect(selection(panel)).toEqual(['CI', 'DE', 'FR', 'JP', 'US']);
    expect(rowNames(panel)).toHaveLength(5);
    for (const box of within(table(panel)).getAllByRole('checkbox')) expect((box as HTMLInputElement).checked).toBe(true);
  });

  it('makes each row one tab stop: a label around a native checkbox named by the country', async () => {
    const panel = await openMarkets();
    const list = table(panel);
    const focusable = list.querySelectorAll('input, button, a[href], select, textarea, [tabindex]');
    expect(focusable).toHaveLength(5);
    for (const element of focusable) expect(element.getAttribute('type')).toBe('checkbox');

    const [first, second] = within(list).getAllByRole('checkbox');
    first!.focus();
    await panel.user.tab();
    expect(document.activeElement).toBe(second);
    // The whole row is the click target.
    await panel.user.click(screen.getByText('Japan'));
    expect(selection(panel)).not.toContain('JP');
    expect(screen.getByRole('checkbox', { name: 'Japan' })).toBeTruthy();
  });

  it('writes only the selection: unticking a country takes it out of the change', async () => {
    const panel = await openMarkets();
    expect(screen.getByText(panel.t('workspace.summary.changes', { count: 5 }))).toBeTruthy();
    await panel.user.click(screen.getByRole('checkbox', { name: 'France' }));
    expect(screen.getByText(panel.t('workspace.summary.changes', { count: 4 }))).toBeTruthy();
    expect(screen.getByText(panel.t('workspace.summary.selected', { count: 4 }))).toBeTruthy();
  });

  it('selects none, then all, from the bulk buttons', async () => {
    const panel = await openMarkets();
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.selection.none') }));
    expect(selection(panel)).toEqual([]);
    expect(screen.getByText(panel.t('workspace.summary.none'))).toBeTruthy();
    const review = screen.getByRole('button', { name: startsWith(panel.t('workspace.next.review')) });
    expect((review as HTMLButtonElement).disabled).toBe(true);

    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.selection.all') }));
    expect(selection(panel)).toHaveLength(5);
  });
});

describe('search', () => {
  it('filters by name as you type, without touching the selection', async () => {
    const panel = await openMarkets();
    await panel.user.type(search(panel), 'fra');

    await waitFor(() => expect(rowNames(panel)).toEqual(['France']));
    expect(selection(panel)).toHaveLength(5);
  });

  it('matches codes and currencies too', async () => {
    const panel = await openMarkets();
    await panel.user.type(search(panel), 'jpy');
    await waitFor(() => expect(rowNames(panel)).toEqual(['Japan']));
  });

  it('matches the French name when the interface is in French, accents ignored', async () => {
    const panel = await openMarkets('fr');
    await panel.user.type(search(panel), 'allem');
    await waitFor(() => expect(rowNames(panel)).toEqual(['Allemagne']));

    await panel.user.clear(search(panel));
    await panel.user.type(search(panel), 'etats');
    await waitFor(() => expect(rowNames(panel)).toEqual(['États-Unis']));
  });

  it('ignores accents: "cote" finds Côte d’Ivoire', async () => {
    const panel = await openMarkets('fr');
    await panel.user.type(search(panel), 'cote');
    await waitFor(() => expect(rowNames(panel)).toHaveLength(1));
    expect(rowNames(panel)[0]).toMatch(/^Côte d.Ivoire$/);
  });

  it('still finds a country by its English name in French', async () => {
    const panel = await openMarkets('fr');
    await panel.user.type(search(panel), 'germany');
    await waitFor(() => expect(rowNames(panel)).toEqual(['Allemagne']));
  });

  it('is focused by the / shortcut', async () => {
    const panel = await openMarkets();
    (document.activeElement as HTMLElement | null)?.blur();
    await panel.user.keyboard('/');
    expect(document.activeElement).toBe(search(panel));
  });

  it('says when nothing matches, and resets', async () => {
    const panel = await openMarkets();
    await panel.user.type(search(panel), 'zzz');
    expect(await screen.findByText(panel.t('markets.empty.title'))).toBeTruthy();
    const reset = screen.getAllByRole('button', { name: panel.t('markets.filters.reset') });
    await panel.user.click(reset[reset.length - 1]!);
    await waitFor(() => expect(rowNames(panel)).toHaveLength(5));
  });
});

describe('filters hide, they never deselect', () => {
  async function filterEurope(panel: Panel) {
    await panel.user.click(screen.getByRole('button', { name: startsWith(panel.t('markets.filters.toggle')) }));
    await panel.user.click(screen.getByRole('button', { name: panel.t('continent.Europe') }));
  }

  it('warns that selected countries are hidden and will still change', async () => {
    const panel = await openMarkets();
    await filterEurope(panel);

    await waitFor(() => expect(rowNames(panel)).toEqual(['France', 'Germany']));
    expect(screen.getByRole('button', { name: panel.t('continent.Europe') }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(panel.t('markets.selection.hidden', { count: 3 }))).toBeTruthy();
    // Still five prices to write.
    expect(screen.getByText(panel.t('workspace.summary.changes', { count: 5 }))).toBeTruthy();
  });

  it('keeps only the shown ones in one click', async () => {
    const panel = await openMarkets();
    await filterEurope(panel);
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.selection.keepShown') }));

    expect(selection(panel)).toEqual(['DE', 'FR']);
    expect(screen.queryByText(panel.t('markets.selection.hidden', { count: 3 }))).toBeNull();
    expect(screen.getByText(panel.t('workspace.summary.changes', { count: 2 }))).toBeTruthy();
  });

  it('or shows the hidden ones again', async () => {
    const panel = await openMarkets();
    await filterEurope(panel);
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.selection.showHidden') }));
    await waitFor(() => expect(rowNames(panel)).toHaveLength(5));
    expect(selection(panel)).toHaveLength(5);
  });

  it('counts the active filters on the toggle', async () => {
    const panel = await openMarkets();
    await filterEurope(panel);
    expect(
      screen.getByRole('button', { name: startsWith(panel.t('markets.filters.toggle')) }).textContent,
    ).toContain(panel.t('markets.filters.active', { count: 1 }));
  });

  it('"Select all shown" toggles only the visible rows', async () => {
    const panel = await openMarkets();
    await filterEurope(panel);
    await panel.user.click(screen.getByRole('checkbox', { name: panel.t('markets.selection.allShown') }));
    expect(selection(panel)).toEqual(['CI', 'JP', 'US']);
    await panel.user.click(screen.getByRole('checkbox', { name: panel.t('markets.selection.allShown') }));
    expect(selection(panel)).toEqual(['CI', 'DE', 'FR', 'JP', 'US']);
  });
});

describe('keyboard', () => {
  it('Ctrl+A selects or clears every shown country, but not while typing', async () => {
    const panel = await openMarkets();
    await panel.user.keyboard('{Control>}a{/Control}');
    expect(selection(panel)).toEqual([]);
    await panel.user.keyboard('{Control>}a{/Control}');
    expect(selection(panel)).toHaveLength(5);

    await panel.user.type(search(panel), 'fra');
    await panel.user.keyboard('{Control>}a{/Control}');
    expect(selection(panel)).toHaveLength(5);
  });

  it('Ctrl+Enter opens Review', async () => {
    const panel = await openMarkets();
    await panel.user.keyboard('{Control>}{Enter}{/Control}');
    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.title') })).toBeTruthy();
  });
});

describe('moving on', () => {
  it('goes back to the change without losing it', async () => {
    const panel = await openMarkets();
    await panel.user.click(screen.getByRole('button', { name: panel.t('action.back') }));
    await workspace(panel);
    expect((screen.getByLabelText(panel.t('strategy.percentage.label')) as HTMLInputElement).value).toBe('10');
  });

  it('opens Review with the primary button', async () => {
    const panel = await openMarkets();
    await panel.user.click(screen.getByRole('button', { name: startsWith(panel.t('workspace.next.review')) }));
    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.title') })).toBeTruthy();
  });
});

describe('a preset that brings its own countries', () => {
  async function applyPresetFor(regions: string[]): Promise<Panel> {
    const worker = createWorker(PRICES);
    worker.presets = [
      {
        id: 'p1',
        name: 'EU raise',
        description: '',
        config: {
          strategy: { kind: 'percentage', percent: 10 },
          rounding: { mode: 'none', endings: [], zeroDecimalStep: 100 },
          floorMicros: null,
          ceilingMicros: null,
        },
        regions,
        createdAt: 1,
      },
    ];
    const panel = await renderPanel(worker);
    await workspace(panel);
    await panel.user.selectOptions(await screen.findByLabelText(panel.t('strategy.presets.label')), 'p1');
    // The first "Use" is the one next to the preset picker.
    await panel.user.click(screen.getAllByRole('button', { name: panel.t('strategy.presets.use') })[0]!);
    await toMarkets(panel);
    return panel;
  }

  it('selects its countries', async () => {
    const panel = await applyPresetFor(['FR', 'DE']);
    expect(selection(panel)).toEqual(['DE', 'FR']);
    expect(screen.getByText(panel.t('workspace.summary.changes', { count: 2 }))).toBeTruthy();
  });

  it('shows a country the product does not sell as blocked, and never writes it', async () => {
    const panel = await applyPresetFor(['FR', 'ES']);
    const spain = screen.getByRole('checkbox', { name: 'Spain' });
    expect((spain as HTMLInputElement).checked).toBe(true);
    expect(within(spain.closest('label')!).getByText(panel.t('issue.not-sold'))).toBeTruthy();
    expect(screen.queryByText(panel.t('markets.selection.hidden', { count: 1 }))).toBeNull();
    expect(screen.getByText(panel.t('workspace.summary.changes', { count: 1 }))).toBeTruthy();
    expect(screen.getByText(panel.t('workspace.summary.blocked', { count: 1 }))).toBeTruthy();
  });
});
