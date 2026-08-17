/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unitsToMicros } from '@/domain/money/money';
import type { RegionalPrice } from '@/types';

/**
 * The reference-market picker. A global product prices ~100 countries in a few
 * dozen currencies, so the picker must stay short without ever making a market
 * unreachable.
 */

// Twelve markets, but only five currencies: USD covers seven of them.
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
  // Only market billing in RWF — must stay reachable without expanding.
  { regionCode: 'RW', currency: 'RWF', micros: unitsToMicros(5000) },
];

const REGIONS = PRICES.map((price) => price.regionCode);

beforeEach(() => {
  vi.resetModules();
});

async function renderSelect(value = 'US', onChange = vi.fn()) {
  const { useStore } = await import('@/app/store');
  useStore.setState({
    pricing: {
      packageName: 'com.example.app',
      kind: 'subscription',
      productId: 'premium',
      basePlanId: 'monthly',
      label: 'premium · monthly',
      prices: PRICES,
      raw: {},
    },
  });
  const { BaseMarketSelect } = await import('@/features/strategies/BaseMarketSelect');
  render(
    <BaseMarketSelect label="Priced in" value={value} regions={REGIONS} onChange={onChange} />,
  );
  return { select: screen.getByRole('combobox'), onChange };
}

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

describe('shortlist', () => {
  it('shows far fewer options than the product has markets', async () => {
    const { select } = await renderSelect();
    expect(optionLabels(select).length).toBeLessThan(REGIONS.length);
  });

  it('drops the duplicate USD markets but keeps one', async () => {
    const { select } = await renderSelect();
    const labels = optionLabels(select);

    expect(labels.some((label) => label.startsWith('United States'))).toBe(true);
    for (const dropped of ['Austria', 'Belgium', 'Bulgaria', 'Panama', 'Bahrain', 'Cambodia']) {
      expect(labels.some((label) => label.startsWith(dropped))).toBe(false);
    }
  });

  it('keeps the only market for a currency, even off the shortlist', async () => {
    const { select } = await renderSelect();
    // Rwanda is not a key market, but nothing else bills in RWF.
    expect(optionLabels(select).some((label) => label.startsWith('Rwanda'))).toBe(true);
  });

  it('always shows the current selection, shortlist or not', async () => {
    const { select } = await renderSelect('KH');
    expect(optionLabels(select).some((label) => label.startsWith('Cambodia'))).toBe(true);
    expect((select as HTMLSelectElement).value).toBe('KH');
  });

  it('labels each option with the country name and its current price', async () => {
    const { select } = await renderSelect();
    expect(optionLabels(select)).toContain('Japan · JPY 800');
    expect(optionLabels(select)).toContain('United States · USD 4.99');
  });

  it('groups options by continent', async () => {
    const { select } = await renderSelect();
    const groups = select.querySelectorAll('optgroup');
    const labels = [...groups].map((group) => group.getAttribute('label'));
    expect(labels).toContain('Europe');
    expect(labels).toContain('Asia');
  });
});

describe('expanding to every market', () => {
  it('offers the full list behind one click, and goes back', async () => {
    const user = userEvent.setup();
    const { select } = await renderSelect();

    await user.click(screen.getByText(`All markets (${REGIONS.length})`));
    expect(optionLabels(select)).toHaveLength(REGIONS.length);
    expect(optionLabels(select).some((label) => label.startsWith('Austria'))).toBe(true);

    await user.click(screen.getByText('Show key markets'));
    expect(optionLabels(select).length).toBeLessThan(REGIONS.length);
  });

  it('hides the toggle when nothing is being hidden', async () => {
    const { useStore } = await import('@/app/store');
    const few = PRICES.slice(0, 1);
    useStore.setState({
      pricing: {
        packageName: 'com.example.app',
        kind: 'subscription',
        productId: 'premium',
        basePlanId: 'monthly',
        label: 'premium · monthly',
        prices: few,
        raw: {},
      },
    });
    const { BaseMarketSelect } = await import('@/features/strategies/BaseMarketSelect');
    render(
      <BaseMarketSelect label="Priced in" value="US" regions={['US']} onChange={vi.fn()} />,
    );
    expect(screen.queryByText(/All markets/)).toBeNull();
  });
});

describe('selection', () => {
  it('reports the chosen region', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { select } = await renderSelect('US', onChange);

    await user.selectOptions(select, 'JP');
    expect(onChange).toHaveBeenCalledWith('JP');
  });
});
