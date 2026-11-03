/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { formatter } from '@/i18n';
import type { Locale } from '@/i18n/core';
import { CURVES, ECONOMIC_BANDS } from '@/domain/regions/economicBands';
import type { TierStrategy } from '@/types';
import {
  type Panel,
  chooseKind,
  createWorker,
  en,
  norm,
  price,
  renderPanel,
  startsWith,
  toMarkets,
  workspace,
} from './panelHarness';

/**
 * Purchasing-power pricing as a developer runs it: generate a ladder from the
 * bands, check the prices it gives, then adjust tiers and countries by hand —
 * all without leaving step 1. Nothing is generated until asked.
 */

// Every band and several sub-regions, so both the ladder and the region
// shortcuts have something to work with.
const PRICES = [
  price('FR', 'EUR', 4.99), // T1 · Western Europe
  price('DE', 'EUR', 4.99), // T1 · Western Europe
  price('US', 'USD', 4.99), // T1 · Northern America
  price('PL', 'PLN', 19.99), // T2 · Eastern Europe
  price('BR', 'BRL', 24.9), // T3 · South America
  price('MA', 'MAD', 49), // T4 · North Africa
  price('DZ', 'DZD', 400), // T4 · North Africa
  price('KE', 'KES', 500), // T4 · East Africa
  price('IN', 'INR', 399), // T5 · South Asia
];
const CODES = PRICES.map((p) => p.regionCode).sort();

async function openLadder(locale: Locale = 'en'): Promise<Panel> {
  const panel = await renderPanel(createWorker(PRICES), { locale });
  await workspace(panel);
  await chooseKind(panel, 'tiers');
  return panel;
}

async function generate(panel: Panel) {
  await panel.user.click(screen.getByRole('button', { name: startsWith(panel.t('strategy.ladder.generate')) }));
  await screen.findByRole('heading', { name: panel.t('strategy.tiers.title', { count: 5 }) });
}

const strategy = (panel: Panel) => panel.useStore.getState().config.strategy as TierStrategy;
const selection = (panel: Panel) => [...panel.useStore.getState().selection].sort();
const band = (panel: Panel, id: string) => panel.t(`band.${id}.label` as 'band.T1.label');
const tierItem = (panel: Panel, tier: string) =>
  screen.getByRole('button', { name: panel.t('strategy.tiers.remove', { tier }) }).closest('li')!;

describe('before generating', () => {
  it('offers the generator and changes nothing yet', async () => {
    const panel = await openLadder();
    expect(screen.getByRole('heading', { name: panel.t('strategy.ladder.title') })).toBeTruthy();
    expect(screen.getByText(panel.t('workspace.summary.none'))).toBeTruthy();
    expect((screen.getByRole('button', { name: startsWith(panel.t('workspace.next.markets')) }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('previews each band’s price, and states the basis instead of presenting the bands as fact', async () => {
    const panel = await openLadder();
    const table = screen.getByRole('table', { name: panel.t('strategy.ladder.previewCaption') });
    for (const { id } of ECONOMIC_BANDS) expect(within(table).getByText(band(panel, id))).toBeTruthy();
    expect(screen.getByText(panel.t('band.basis'))).toBeTruthy();

    const anchor = screen.getByLabelText(panel.t('strategy.ladder.anchor'));
    await panel.user.clear(anchor);
    await panel.user.type(anchor, '10');
    const row = within(table).getByText(band(panel, 'T3')).closest('tr')!;
    const share = CURVES.balanced.shares[2]!;
    expect(within(row).getByText(norm(formatter('en').money(10_000_000 * share, 'USD')))).toBeTruthy();
  });
});

describe('generating a ladder', () => {
  it('names the tiers in the interface language and selects every tiered country', async () => {
    const panel = await openLadder();
    act(() => panel.useStore.getState().setSelection(['FR']));
    await generate(panel);

    expect(Object.keys(strategy(panel).tiers)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'].map((id) => band(panel, id)));
    expect(Object.keys(strategy(panel).assignment).sort()).toEqual(CODES);
    expect(selection(panel)).toEqual(CODES);
    expect(await screen.findByText(panel.t('strategy.ladder.selectionSet', { count: CODES.length }))).toBeTruthy();
    expect(screen.queryByText(panel.t('workspace.summary.none'))).toBeNull();
  });

  it('names the tiers in French when Pinto speaks French', async () => {
    const panel = await openLadder('fr');
    await generate(panel);
    const names = Object.keys(strategy(panel).tiers);
    expect(names).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'].map((id) => band(panel, id)));
    // Only meaningful while the French names differ from the English ones.
    expect(names).not.toEqual(['T1', 'T2', 'T3', 'T4', 'T5'].map((id) => en(`band.${id}.label` as 'band.T1.label')));
    for (const name of names) expect(tierItem(panel, name)).toBeTruthy();
  });

  it('uses the chosen curve', async () => {
    const panel = await openLadder();
    await panel.user.click(screen.getByRole('radio', { name: panel.t('curve.aggressive.label') }));
    await generate(panel);
    expect(Object.values(strategy(panel).tiers)).toEqual(CURVES.aggressive.shares);
  });

  it('moves the generator behind "Regenerate", which replaces the tiers', async () => {
    const panel = await openLadder();
    await generate(panel);
    expect(screen.queryByRole('heading', { name: panel.t('strategy.ladder.title') })).toBeNull();
    await panel.user.click(screen.getByText(panel.t('strategy.ladder.regenerate')));
    await panel.user.click(screen.getByRole('radio', { name: panel.t('curve.flat.label') }));
    await panel.user.click(screen.getByRole('button', { name: startsWith(panel.t('strategy.ladder.regenerateAction')) }));
    expect(Object.values(strategy(panel).tiers)).toEqual(CURVES.flat.shares);
  });
});

describe('editing the ladder by hand', () => {
  it('changes one tier’s share', async () => {
    const panel = await openLadder();
    await generate(panel);
    const tier = band(panel, 'T3');
    const share = screen.getByLabelText(panel.t('strategy.tiers.share', { tier }));
    await panel.user.clear(share);
    await panel.user.type(share, '55');
    expect(strategy(panel).tiers[tier]).toBeCloseTo(0.55);
  });

  it('assigns a whole sub-region to a tier in one step, moving it from its band', async () => {
    const panel = await openLadder();
    await generate(panel);
    const tier = band(panel, 'T2');
    await panel.user.selectOptions(
      screen.getByRole('combobox', { name: panel.t('strategy.tiers.addRegionLabel', { tier }) }),
      'subregion:North Africa',
    );
    expect(strategy(panel).assignment.MA).toBe(tier);
    expect(strategy(panel).assignment.DZ).toBe(tier);
    expect(strategy(panel).assignment.KE).toBe(band(panel, 'T4'));
  });

  it('only offers regions this product actually prices, with their counts', async () => {
    const panel = await openLadder();
    await generate(panel);
    const select = screen.getByRole('combobox', {
      name: panel.t('strategy.tiers.addRegionLabel', { tier: band(panel, 'T1') }),
    });
    const labels = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(labels).toContain(panel.t('strategy.tiers.groupOption', { name: panel.t('subregion.North Africa'), count: 2 }));
    expect(labels.some((label) => label?.startsWith(panel.t('subregion.East Asia')))).toBe(false);
  });

  it('lists the countries behind a count, and removes one', async () => {
    const panel = await openLadder();
    await generate(panel);
    const tier = band(panel, 'T4');
    await panel.user.click(within(tierItem(panel, tier)).getByRole('button', { name: startsWith(panel.t('count.countries', { count: 3 })) }));

    const members = screen.getByRole('list', { name: panel.t('strategy.tiers.members', { tier }) });
    expect(within(members).getByText('Morocco')).toBeTruthy();
    await panel.user.click(
      screen.getByRole('button', { name: panel.t('strategy.tiers.removeCountry', { country: 'Morocco', tier }) }),
    );
    expect(strategy(panel).assignment.MA).toBeUndefined();
    expect(within(members).queryByText('Morocco')).toBeNull();
    expect(screen.getByText(panel.t('strategy.tiers.untiered', { count: 1 }))).toBeTruthy();
  });

  it('removes a tier, leaving its countries unchanged', async () => {
    const panel = await openLadder();
    await generate(panel);
    const tier = band(panel, 'T5');
    await panel.user.click(screen.getByRole('button', { name: panel.t('strategy.tiers.remove', { tier }) }));
    expect(strategy(panel).tiers[tier]).toBeUndefined();
    expect(strategy(panel).assignment.IN).toBeUndefined();
  });

  it('adds a tier by name, refusing a duplicate', async () => {
    const panel = await openLadder();
    await generate(panel);
    const field = screen.getByLabelText(panel.t('strategy.tiers.newLabel'));
    await panel.user.type(field, band(panel, 'T1'));
    expect(screen.getByText(panel.t('strategy.tiers.exists'))).toBeTruthy();
    await panel.user.clear(field);
    await panel.user.type(field, 'Maghreb{Enter}');
    expect(strategy(panel).tiers.Maghreb).toBe(1);
  });
});

describe('tiered but unselected countries', () => {
  it('warns that they will not be written, and selects them in one click', async () => {
    const panel = await openLadder();
    await generate(panel);
    await toMarkets(panel);
    await panel.user.click(screen.getByRole('button', { name: panel.t('markets.selection.none') }));
    await panel.user.click(screen.getByRole('button', { name: panel.t('action.back') }));

    expect(await screen.findByText(panel.t('strategy.tiers.notSelected', { count: CODES.length }))).toBeTruthy();
    await panel.user.click(screen.getByRole('button', { name: panel.t('strategy.tiers.selectThem') }));
    await waitFor(() => expect(selection(panel)).toEqual(CODES));
  });
});
