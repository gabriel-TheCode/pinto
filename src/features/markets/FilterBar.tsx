import { useId, useMemo, useState, type ReactNode } from 'react';
import { useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { continentName, subregionName } from '@/i18n/describe';
import { CONTINENTS, countryOrPlaceholder } from '@/domain/regions/countries';
import { cx } from '@/lib/cx';
import type { Continent, PriceChange } from '@/types';
import { Badge, Button, Icon, Kbd, SelectField, TextField, useHotkey } from '@/ui';
import { activeFilterCount } from './rows';

const CONTINENT_ORDER: readonly Continent[] = [...CONTINENTS, 'Other'];

/**
 * Search, always visible, and the rest of the filters one click away behind
 * "Filters" (with the count of those on). Places and currencies are offered
 * only when the product is priced there: an option that can only empty the
 * table is noise. Sub-regions drill down from the continents picked.
 */
export function FilterBar({ rows }: { rows: readonly PriceChange[] }) {
  const t = useT();
  const fmt = useFormat();
  const searchId = useId();
  const panelId = useId();
  const filter = useStore((state) => state.filter);
  const setFilter = useStore((state) => state.setFilter);
  const resetFilter = useStore((state) => state.resetFilter);
  const active = activeFilterCount(filter);
  const [open, setOpen] = useState(active > 0);

  const focusSearch = () => document.getElementById(searchId)?.focus();
  useHotkey('/', focusSearch);
  // "/" takes Shift on AZERTY and QWERTZ keyboards.
  useHotkey('/', focusSearch, { shift: true });

  const present = useMemo(() => {
    const subregions = new Map<Continent, Set<string>>();
    const currencies = new Set<string>();
    for (const row of rows) {
      const { continent, subregion } = countryOrPlaceholder(row.regionCode);
      subregions.set(continent, (subregions.get(continent) ?? new Set()).add(subregion));
      currencies.add(row.currency);
    }
    return { subregions, currencies: [...currencies].sort() };
  }, [rows]);

  const continents = filter.continents ?? [];
  const subregions = filter.subregions ?? [];
  const subregionChoices = [
    ...new Set([...continents.flatMap((c) => [...(present.subregions.get(c) ?? [])]), ...subregions]),
  ].sort((a, b) => fmt.compare(subregionName(t, a), subregionName(t, b)));

  const toggleContinent = (continent: Continent) => {
    if (!continents.includes(continent)) {
      setFilter({ continents: [...continents, continent] });
      return;
    }
    // Its sub-regions go with it, so no filter stays on out of sight.
    const own = present.subregions.get(continent);
    setFilter({
      continents: continents.filter((c) => c !== continent),
      subregions: subregions.filter((s) => !own?.has(s)),
    });
  };

  const toggleSubregion = (subregion: string) =>
    setFilter({
      subregions: subregions.includes(subregion)
        ? subregions.filter((s) => s !== subregion)
        : [...subregions, subregion],
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <TextField
          id={searchId}
          type="search"
          className="flex-1"
          srLabel={t('markets.search.label')}
          placeholder={t('markets.search.placeholder')}
          prefix={<Icon name="search" size={14} />}
          suffix={filter.query ? undefined : <Kbd>/</Kbd>}
          aria-keyshortcuts="/"
          autoComplete="off"
          spellCheck={false}
          value={filter.query ?? ''}
          onChange={(event) => setFilter({ query: event.target.value })}
        />
        <Button
          icon="filter"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {t('markets.filters.toggle')}
          {active > 0 && (
            <Badge tone="accent">
              <span aria-hidden="true">{fmt.number(active)}</span>
              <span className="sr-only">{t('markets.filters.active', { count: active })}</span>
            </Badge>
          )}
        </Button>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3"
      >
        <ChipGroup label={t('markets.filters.continents')}>
          {CONTINENT_ORDER.filter((c) => present.subregions.has(c)).map((continent) => (
            <Chip
              key={continent}
              pressed={continents.includes(continent)}
              onClick={() => toggleContinent(continent)}
            >
              {continentName(t, continent)}
            </Chip>
          ))}
        </ChipGroup>

        {subregionChoices.length > 0 && (
          <ChipGroup label={t('markets.filters.subregions')}>
            {subregionChoices.map((subregion) => (
              <Chip
                key={subregion}
                pressed={subregions.includes(subregion)}
                onClick={() => toggleSubregion(subregion)}
              >
                {subregionName(t, subregion)}
              </Chip>
            ))}
          </ChipGroup>
        )}

        <SelectField
          label={t('markets.filters.currency')}
          value={filter.currencies?.[0] ?? ''}
          onChange={(event) => setFilter({ currencies: event.target.value ? [event.target.value] : [] })}
        >
          <option value="">{t('markets.filters.allCurrencies')}</option>
          {present.currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </SelectField>

        {(active > 0 || filter.query) && (
          <Button size="sm" variant="ghost" className="self-start" onClick={resetFilter}>
            {t('markets.filters.reset')}
          </Button>
        )}
      </div>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-small font-medium text-ink-700">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1">
        {children}
      </div>
    </div>
  );
}

/** A filter chip: round and ink, set apart from the square accent group chips. */
function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-small transition-colors',
        pressed
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
      )}
    >
      {pressed && <Icon name="check" size={12} />}
      {children}
    </button>
  );
}
