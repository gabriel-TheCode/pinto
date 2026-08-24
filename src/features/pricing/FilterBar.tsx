import { useMemo, useRef, useEffect } from 'react';
import { useStore, useT } from '@/app/store';
import { CONTINENTS, subregionsOf } from '@/domain/regions/countries';
import { cx } from '@/lib/cx';
import type { Continent } from '@/types';

/**
 * Search plus continent chips. Deliberately not a filter panel behind a
 * button: in a 150-row table, filtering is the main verb, so it stays visible
 * and one click deep.
 */
export function FilterBar({ currencies }: { currencies: string[] }) {
  const { filter, setFilter } = useStore();
  const t = useT();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement !== searchRef.current) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeContinents = useMemo(() => new Set(filter.continents ?? []), [filter.continents]);
  const activeSubregions = useMemo(() => new Set(filter.subregions ?? []), [filter.subregions]);

  /**
   * Sub-regions only appear once a continent is picked. Showing all seventeen
   * at once would be a wall of chips; showing the five inside Africa the
   * moment you click Africa is a drill-down.
   */
  const availableSubregions = useMemo(() => {
    const list = [...activeContinents].flatMap((continent) => subregionsOf(continent));
    // Keep any active sub-region visible even after its continent is unticked,
    // otherwise the filter stays applied with no way to see or clear it.
    return [...new Set([...list, ...activeSubregions])].sort();
  }, [activeContinents, activeSubregions]);

  const toggleContinent = (continent: Continent) => {
    const next = new Set(activeContinents);
    if (next.has(continent)) next.delete(continent);
    else next.add(continent);
    setFilter({ continents: [...next] });
  };

  const toggleSubregion = (subregion: string) => {
    const next = new Set(activeSubregions);
    if (next.has(subregion)) next.delete(subregion);
    else next.add(subregion);
    setFilter({ subregions: [...next] });
  };

  return (
    <div className="flex flex-col gap-2 border-b border-ink-200 bg-white px-3 py-2.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-ink-400">
            ⌕
          </span>
          <input
            ref={searchRef}
            value={filter.query ?? ''}
            onChange={(event) => setFilter({ query: event.target.value })}
            placeholder={t('pricing.searchPlaceholder')}
            className="h-8 w-full rounded-lg border border-ink-200 bg-white pr-8 pl-7 text-[12.5px] placeholder:text-ink-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-ink-400">
            /
          </kbd>
        </div>
        <select
          value={filter.currencies?.[0] ?? ''}
          onChange={(event) =>
            setFilter({ currencies: event.target.value ? [event.target.value] : [] })
          }
          className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-[12px] text-ink-700 focus:border-accent-500 focus:outline-none"
        >
          <option value="">{t('pricing.allCurrencies')}</option>
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1">
        {CONTINENTS.map((continent) => (
          <button
            key={continent}
            type="button"
            onClick={() => toggleContinent(continent)}
            className={cx(
              'rounded-full border px-2 py-0.5 text-[11.5px] transition-colors',
              activeContinents.has(continent)
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50',
            )}
          >
            {continent}
          </button>
        ))}
        {(filter.continents?.length ||
          filter.subregions?.length ||
          filter.query ||
          filter.currencies?.length) && (
          <button
            type="button"
            onClick={() =>
              setFilter({ continents: [], subregions: [], query: '', currencies: [] })
            }
            className="rounded-full px-2 py-0.5 text-[11.5px] text-ink-500 hover:text-ink-900 hover:underline"
          >
            {t('pricing.resetFilters')}
          </button>
        )}
      </div>

      {availableSubregions.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-ink-100 pt-2">
          {availableSubregions.map((subregion) => (
            <button
              key={subregion}
              type="button"
              onClick={() => toggleSubregion(subregion)}
              className={cx(
                'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                activeSubregions.has(subregion)
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:bg-ink-50',
              )}
            >
              {subregion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
