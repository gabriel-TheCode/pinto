import { useEffect, useMemo } from 'react';
import { useChangeSet, useStore } from '@/app/store';
import { CountryRow } from './CountryRow';
import { FilterBar } from './FilterBar';
import { ProductPicker } from './ProductPicker';
import { GroupBar } from '@/features/regions/GroupBar';
import { Button } from '@/components/Button';
import { EmptyState, TableSkeleton } from '@/components/Feedback';
import { filterCountries, normalise } from '@/domain/regions/groups';
import { countryOrPlaceholder } from '@/domain/regions/countries';
import { describeStrategy } from '@/domain/pricing/computeChangeSet';

export function PricingScreen() {
  const {
    products,
    productKey,
    pricing,
    loadingPricing,
    selection,
    filter,
    config,
    toggleRegion,
    addRegions,
    removeRegions,
    setScreen,
    selectProduct,
  } = useStore();
  const changeSet = useChangeSet();

  const currencies = useMemo(
    () => [...new Set(pricing?.prices.map((p) => p.currency) ?? [])].sort(),
    [pricing],
  );

  const currencyOf = useMemo(() => {
    const map = new Map(pricing?.prices.map((p) => [p.regionCode, p.currency]));
    return (code: string) => map.get(code);
  }, [pricing]);

  const visible = useMemo(() => {
    if (!changeSet) return [];
    const allowed = new Set(
      filterCountries(
        changeSet.changes.map((change) => countryOrPlaceholder(change.regionCode)),
        filter,
        currencyOf,
      ).map((country) => country.code),
    );
    // Region codes the country table does not know about still have to be
    // findable, so they match on the raw code.
    const query = filter.query ? normalise(filter.query) : '';
    return changeSet.changes.filter(
      (change) =>
        allowed.has(change.regionCode) ||
        (!!query && normalise(change.regionCode).includes(query)),
    );
  }, [changeSet, filter, currencyOf]);

  const visibleCodes = useMemo(() => visible.map((change) => change.regionCode), [visible]);
  const allVisibleSelected =
    visibleCodes.length > 0 && visibleCodes.every((code) => selection.has(code));

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (allVisibleSelected) removeRegions(visibleCodes);
        else addRegions(visibleCodes);
      }
      if (meta && event.key === 'Enter' && changeSet?.summary.changed) {
        event.preventDefault();
        setScreen('review');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allVisibleSelected, visibleCodes, addRegions, removeRegions, changeSet, setScreen]);

  if (!products.length && !loadingPricing) {
    return (
      <EmptyState
        title="No priceable products"
        body="This app has no subscriptions or one-time products that Pinto can read. Create one in Play Console first."
        action={<Button size="sm" onClick={() => void useStore.getState().loadProducts()}>Reload</Button>}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ProductPicker
        products={products}
        value={productKey}
        onChange={(key) => void selectProduct(key)}
      />
      <FilterBar currencies={currencies} />
      <GroupBar />

      <div className="flex shrink-0 items-center justify-between border-b border-ink-200 bg-white px-3 py-1.5">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-600">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() =>
                allVisibleSelected ? removeRegions(visibleCodes) : addRegions(visibleCodes)
              }
              className="size-3.5 accent-[var(--color-accent-500)]"
            />
            Select all visible
          </label>
          <span className="text-[11.5px] text-ink-400">
            {visible.length} shown · {selection.size} selected
          </span>
        </div>
        <button
          type="button"
          onClick={() => setScreen('strategy')}
          className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-accent-700 hover:bg-accent-50"
        >
          {describeStrategy(config)} ↗
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {loadingPricing ? (
          <TableSkeleton rows={12} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No countries match"
            body="Try a different search, or reset the filters."
          />
        ) : (
          visible.map((change) => (
            <CountryRow
              key={change.regionCode}
              change={change}
              selected={selection.has(change.regionCode)}
              onToggle={toggleRegion}
            />
          ))
        )}
      </div>

      <ActionBar />
    </div>
  );
}

function ActionBar() {
  const { selection, clearSelection, setScreen } = useStore();
  const changeSet = useChangeSet();
  const changed = changeSet?.summary.changed ?? 0;
  const invalid = changeSet?.summary.invalid ?? 0;

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-ink-200 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-ink-900">
          {selection.size} {selection.size === 1 ? 'country' : 'countries'} selected
        </div>
        <div className="truncate text-[11.5px] text-ink-500">
          {changed} will change
          {invalid > 0 && <span className="text-fall-500"> · {invalid} need attention</span>}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={clearSelection} disabled={!selection.size}>
        Clear
      </Button>
      <Button
        size="sm"
        variant="primary"
        disabled={changed === 0}
        shortcut="⌘↵"
        onClick={() => setScreen('review')}
      >
        Review changes
      </Button>
    </div>
  );
}
