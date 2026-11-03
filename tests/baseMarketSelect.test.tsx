/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unitsToMicros } from '@/domain/money/money';
import { translator } from '@/i18n';
import type { Locale } from '@/i18n/core';
import type { RegionalPrice } from '@/types';
import { norm } from './panelHarness';

/**
 * The reference-country picker. A global product prices ~100 countries in a
 * few dozen currencies, so the picker stays short without ever making a
 * country unreachable.
 */

// Twelve countries, but only five currencies: USD covers seven of them.
const PRICES: RegionalPrice[] = [
  { regionCode: 'US', currency: 'USD', micros: unitsToMicros(4.99) },
  { regionCode: 'AT', currency: 'USD', micros: unitsToMicros(4.79) },
  { regionCode: 'BE', currency: 'USD', micros: unitsToMicros(4.79) },
  { regionCode: 'BG', currency: 'USD', micros: unitsToMicros(4.79) },
  { regionCode: 'PA', currency: 'USD', micros: unitsToMicros(4.99) },
  { regionCode: 'BH', currency: 'USD', micros: unitsToMicros(4.99) },
  { regionCode: 'KH', currency: 'USD', micros: unitsToMicros(4.49) },
  { regionCode: 'FR', currency: 'EUR', micros: unitsToMicros(4.79) },
  { regionCode: 'DE', currency: 'EUR', micros: unitsToMicros(4.79) },
  { regionCode: 'JP', currency: 'JPY', micros: unitsToMicros(800) },
  { regionCode: 'BR', currency: 'BRL', micros: unitsToMicros(24.9) },
  // Only country billing in RWF — must stay reachable without expanding.
  { regionCode: 'RW', currency: 'RWF', micros: unitsToMicros(5000) },
];

const REGIONS = PRICES.map((price) => price.regionCode);

beforeEach(() => {
  vi.resetModules();
});

async function renderSelect({
  value = 'US',
  onChange = vi.fn(),
  prices = PRICES,
  locale = 'en',
}: { value?: string; onChange?: (region: string) => void; prices?: RegionalPrice[]; locale?: Locale } = {}) {
  const [{ useStore }, { useI18n }, { BaseMarketSelect }] = await Promise.all([
    import('@/app/store'),
    import('@/i18n/react'),
    import('@/features/strategy/BaseMarketSelect'),
  ]);
  act(() => {
    useI18n.getState().setPreference(locale, locale);
    useStore.setState({
      pricing: {
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        label: 'premium · monthly',
        prices,
        raw: {},
      },
    });
  });
  render(
    <BaseMarketSelect
      label="Priced in"
      value={value}
      regions={prices.map((price) => price.regionCode)}
      onChange={onChange}
    />,
  );
  return { select: screen.getByRole('combobox', { name: 'Priced in' }), onChange, t: translator(locale) };
}

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => norm(option.textContent ?? ''));
}

describe('shortlist', () => {
  it('shows far fewer options than the product has countries', async () => {
    const { select } = await renderSelect();
    expect(optionLabels(select).length).toBeLessThan(REGIONS.length);
  });

  it('drops the duplicate USD countries but keeps one', async () => {
    const { select } = await renderSelect();
    const labels = optionLabels(select);
    expect(labels.some((label) => label.startsWith('United States'))).toBe(true);
    for (const dropped of ['Austria', 'Belgium', 'Bulgaria', 'Panama', 'Bahrain', 'Cambodia']) {
      expect(labels.some((label) => label.startsWith(dropped)), dropped).toBe(false);
    }
  });

  it('keeps the only country for a currency, even off the key list', async () => {
    const { select } = await renderSelect();
    // Rwanda is not a key market, but nothing else bills in RWF.
    expect(optionLabels(select).some((label) => label.startsWith('Rwanda'))).toBe(true);
  });

  it('always shows the current selection, shortlist or not', async () => {
    const { select } = await renderSelect({ value: 'KH' });
    expect(optionLabels(select).some((label) => label.startsWith('Cambodia'))).toBe(true);
    expect((select as HTMLSelectElement).value).toBe('KH');
  });

  it('labels each option with the country name and its current price', async () => {
    const { select, t } = await renderSelect();
    expect(optionLabels(select)).toContain(norm(t('strategy.base.option', { country: 'Japan', price: 'JPY 800' })));
    expect(optionLabels(select)).toContain(norm(t('strategy.base.option', { country: 'United States', price: 'USD 4.99' })));
  });

  it('groups options by continent, in the interface language', async () => {
    const { select, t } = await renderSelect({ locale: 'fr' });
    const labels = [...select.querySelectorAll('optgroup')].map((group) => group.getAttribute('label'));
    expect(labels).toContain(t('continent.Europe'));
    expect(labels).toContain(t('continent.Asia'));
    expect(optionLabels(select).some((label) => label.startsWith('États-Unis'))).toBe(true);
  });
});

describe('expanding to every country', () => {
  it('offers the full list behind one click, and goes back', async () => {
    const user = userEvent.setup();
    const { select, t } = await renderSelect();

    await user.click(screen.getByRole('button', { name: t('strategy.base.showAll', { count: REGIONS.length }) }));
    expect(optionLabels(select)).toHaveLength(REGIONS.length);
    expect(optionLabels(select).some((label) => label.startsWith('Austria'))).toBe(true);

    await user.click(screen.getByRole('button', { name: t('strategy.base.showKey') }));
    expect(optionLabels(select).length).toBeLessThan(REGIONS.length);
  });

  it('hides the toggle when nothing is hidden', async () => {
    const { t } = await renderSelect({ prices: PRICES.slice(0, 1) });
    expect(screen.queryByRole('button', { name: t('strategy.base.showAll', { count: 1 }) })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('selection', () => {
  it('reports the chosen country', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { select } = await renderSelect({ onChange });
    await user.selectOptions(select, 'JP');
    expect(onChange).toHaveBeenCalledWith('JP');
  });
});
