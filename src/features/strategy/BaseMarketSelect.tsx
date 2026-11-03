import { useMemo, useState } from 'react';
import { useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { continentName } from '@/i18n/describe';
import { CONTINENTS, KEY_MARKETS, countryOrPlaceholder } from '@/domain/regions/countries';
import type { Continent, RegionCode } from '@/types';
import { Button, SelectField } from '@/ui';

/**
 * Picks a reference country: the one a fixed price is quoted in, the source
 * of a copy, a ladder's anchor, or what `base` means in a formula.
 *
 * A global product prices ~100 countries in a few dozen currencies, so the
 * full list is mostly duplicates. The default is a shortlist — well-known
 * markets, one country for every currency they miss, and the current value —
 * with every country one click away. Each option shows its current price.
 */
export function BaseMarketSelect({
  label,
  hint,
  value,
  regions,
  onChange,
}: {
  label: string;
  hint?: string;
  value: RegionCode;
  /** Countries this product prices. */
  regions: readonly RegionCode[];
  onChange: (region: RegionCode) => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const pricing = useStore((state) => state.pricing);
  const [showAll, setShowAll] = useState(false);

  const priceOf = useMemo(
    () => new Map(pricing?.prices.map((price) => [price.regionCode, price])),
    [pricing],
  );

  const shortlist = useMemo(() => {
    const available = new Set(regions);
    const picked = KEY_MARKETS.filter((region) => available.has(region));
    // A currency no key market bills in would be unreachable without
    // expanding, so one country is added for each.
    const covered = new Set(picked.map((region) => priceOf.get(region)?.currency));
    for (const region of [...regions].sort()) {
      const currency = priceOf.get(region)?.currency;
      if (!currency || covered.has(currency)) continue;
      covered.add(currency);
      picked.push(region);
    }
    return picked;
  }, [regions, priceOf]);

  const visible = showAll ? [...regions] : shortlist;
  // The current value is always an option, or the select would show another.
  if (!visible.includes(value)) visible.push(value);
  const hidden = regions.length - shortlist.length;

  const buckets = new Map<Continent, RegionCode[]>();
  for (const region of visible) {
    const { continent } = countryOrPlaceholder(region);
    buckets.set(continent, [...(buckets.get(continent) ?? []), region]);
  }
  const groups = [...CONTINENTS, 'Other' as const]
    .filter((continent) => buckets.has(continent))
    .map((continent) => ({
      continent,
      members: buckets.get(continent)!.sort((a, b) => fmt.compare(fmt.region(a), fmt.region(b))),
    }));

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SelectField label={label} hint={hint} value={value} onChange={(event) => onChange(event.target.value)}>
        {groups.map(({ continent, members }) => (
          <optgroup key={continent} label={continentName(t, continent)}>
            {members.map((region) => {
              const price = priceOf.get(region);
              return (
                <option key={region} value={region}>
                  {price
                    ? t('strategy.base.option', {
                        country: fmt.region(region),
                        price: fmt.money(price.micros, price.currency),
                      })
                    : fmt.region(region)}
                </option>
              );
            })}
          </optgroup>
        ))}
      </SelectField>
      {hidden > 0 && (
        <Button size="sm" variant="ghost" className="-ml-2.5 self-start" onClick={() => setShowAll(!showAll)}>
          {showAll ? t('strategy.base.showKey') : t('strategy.base.showAll', { count: regions.length })}
        </Button>
      )}
    </div>
  );
}
