import { useMemo, useState } from 'react';
import { useStore } from '@/app/store';
import type { Continent, RegionCode } from '@/types';
import { CONTINENTS, KEY_MARKETS, countryOrPlaceholder } from '@/domain/regions/countries';
import { formatMicros } from '@/domain/money/money';
import { Label, Hint } from '@/components/Field';
import { cx } from '@/lib/cx';

/**
 * Picker for a *reference* market — the one a fixed price is quoted in, the
 * source of a copy, or what `base` means in a formula.
 *
 * A global product prices around a hundred countries but bills them in a few
 * dozen currencies, so listing every region produces page after page of
 * duplicates (`AT · USD`, `BE · USD`, `BG · USD`…). The default is therefore a
 * shortlist of well-known markets, grouped by continent and showing each one's
 * current price, with the full list one click away. Nothing is removed — the
 * shortlist is presentation, and a market that is not on it can still be
 * chosen, and is still priced like any other.
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
  /** Regions this product actually prices. */
  regions: RegionCode[];
  onChange: (region: RegionCode) => void;
}) {
  const pricing = useStore((state) => state.pricing);
  const [showAll, setShowAll] = useState(false);

  const priceOf = useMemo(
    () => new Map(pricing?.prices.map((price) => [price.regionCode, price])),
    [pricing],
  );

  const shortlist = useMemo(() => {
    const available = new Set(regions);
    const picked = KEY_MARKETS.filter((region) => available.has(region));

    // A currency that no shortlisted market covers would otherwise be
    // unreachable without expanding, so one representative is added for each.
    const covered = new Set(picked.map((region) => priceOf.get(region)?.currency));
    for (const region of regions) {
      const currency = priceOf.get(region)?.currency;
      if (!currency || covered.has(currency)) continue;
      covered.add(currency);
      picked.push(region);
    }

    // Whatever is currently selected always stays visible, shortlist or not.
    if (!picked.includes(value) && regions.includes(value)) picked.push(value);
    return picked;
  }, [regions, priceOf, value]);

  const visible = showAll ? regions : shortlist;
  const grouped = useMemo(() => groupByContinent(visible), [visible]);
  const hidden = regions.length - shortlist.length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className={cx(
              'text-[11px] transition-colors',
              showAll ? 'text-ink-500 hover:text-ink-900' : 'text-accent-700 hover:underline',
            )}
          >
            {showAll ? 'Show key markets' : `All markets (${regions.length})`}
          </button>
        )}
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full cursor-pointer rounded-lg border border-ink-200 bg-white px-2.5 pr-8 text-[13px] text-ink-900 transition-colors hover:border-ink-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none"
      >
        {grouped.map(([continent, members]) => (
          <optgroup key={continent} label={continent}>
            {members.map((region) => {
              const price = priceOf.get(region);
              return (
                <option key={region} value={region}>
                  {countryOrPlaceholder(region).name}
                  {price ? ` · ${formatMicros(price.micros, price.currency)}` : ''}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>

      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

function groupByContinent(regions: RegionCode[]): [Continent, RegionCode[]][] {
  const buckets = new Map<Continent, RegionCode[]>();
  for (const region of regions) {
    const { continent } = countryOrPlaceholder(region);
    const bucket = buckets.get(continent);
    if (bucket) bucket.push(region);
    else buckets.set(continent, [region]);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) =>
      countryOrPlaceholder(a).name.localeCompare(countryOrPlaceholder(b).name),
    );
  }
  return CONTINENTS.filter((continent) => buckets.has(continent)).map((continent) => [
    continent,
    buckets.get(continent)!,
  ]);
}
