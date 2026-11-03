import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { bandBlurb, bandName, continentName, curveBlurb, curveName, subregionName } from '@/i18n/describe';
import { microsToUnits, unitsToMicros } from '@/domain/money/money';
import { CURVES, ECONOMIC_BANDS, generateLadder, type LadderCurve } from '@/domain/regions/economicBands';
import { builtInGroups } from '@/domain/regions/groups';
import type { RegionCode, TierStrategy } from '@/types';
import {
  Button,
  Callout,
  Disclosure,
  Hint,
  IconButton,
  NumberField,
  Segmented,
  SelectField,
  TextField,
  toast,
} from '@/ui';
import { BaseMarketSelect } from './BaseMarketSelect';
import { ConvertOption, useCurrencyOf } from './controls';
import { LADDER_CURVES, assignToTier, removeTier, unassign } from './model';
import { commitStrategy } from './state';

interface RegionOption {
  id: string;
  label: string;
  members: RegionCode[];
}

/**
 * Purchasing-power pricing: the ladder generator first (it is what people
 * open this for), then every tier and every country editable by hand.
 * Nothing is generated until asked, and nothing is written before Review.
 */
export function TierFields({ strategy, regions }: { strategy: TierStrategy; regions: readonly RegionCode[] }) {
  const t = useT();
  const fmt = useFormat();
  const selection = useStore((state) => state.selection);
  const addRegions = useStore((state) => state.addRegions);
  const customGroups = useStore((state) => state.groups);
  const pricing = useStore((state) => state.pricing);
  const currencyOf = useCurrencyOf();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newTier, setNewTier] = useState('');
  const editorHeading = useRef<HTMLHeadingElement>(null);

  const tierNames = Object.keys(strategy.tiers);
  const hasLadder = tierNames.length > 0;
  const anchor =
    strategy.anchorMicros ?? pricing?.prices.find((price) => price.regionCode === strategy.baseRegion)?.micros ?? null;
  const currency = currencyOf(strategy.baseRegion);

  // Continents and sub-regions narrowed to this product's countries, with the
  // user's own groups first: assigning "West Africa" in one click is the point.
  const groups = useMemo(() => {
    const available = new Set(regions);
    const within = (members: RegionCode[]) => members.filter((member) => available.has(member));
    const sorted = (options: RegionOption[]) =>
      options.filter((option) => option.members.length).sort((a, b) => fmt.compare(a.label, b.label));
    const builtIn = builtInGroups();
    const named = (kind: 'continent' | 'subregion') =>
      sorted(
        builtIn
          .filter((group) => group.kind === kind)
          .map((group) => ({
            id: group.id,
            label: kind === 'continent' ? continentName(t, group.label) : subregionName(t, group.label),
            members: within(group.members),
          })),
      );
    const mine = sorted(
      customGroups.map((group) => ({ id: `custom:${group.id}`, label: group.label, members: within(group.members) })),
    );
    const continents = named('continent');
    const subregions = named('subregion');
    return { mine, continents, subregions, all: [...mine, ...continents, ...subregions] };
  }, [regions, customGroups, t, fmt]);

  const membersOf = (tier: string) =>
    regions
      .filter((region) => strategy.assignment[region] === tier)
      .sort((a, b) => fmt.compare(fmt.region(a), fmt.region(b)));

  const untiered = regions.filter((region) => !strategy.assignment[region]).length;
  const notSelected = regions.filter((region) => strategy.assignment[region] && !selection.has(region));
  const selectedHere = regions.filter((region) => selection.has(region));
  const newName = newTier.trim();
  const exists = newName in strategy.tiers;

  const generator = (
    <LadderGenerator
      strategy={strategy}
      regions={regions}
      replacing={hasLadder}
      onGenerated={() => {
        setExpanded(null);
        requestAnimationFrame(() => editorHeading.current?.focus());
      }}
    />
  );

  return (
    <>
      {hasLadder ? (
        <Disclosure title={t('strategy.ladder.regenerate')} summary={t('strategy.ladder.regenerateSummary')}>
          {generator}
        </Disclosure>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-body font-semibold text-ink-900">{t('strategy.ladder.title')}</h3>
            <p className="text-small text-ink-600">{t('strategy.ladder.intro')}</p>
          </div>
          {generator}
        </div>
      )}

      {hasLadder && (
        <div className="flex flex-col gap-3">
          <h3 ref={editorHeading} tabIndex={-1} className="text-body font-semibold text-ink-900">
            {t('strategy.tiers.title', { count: tierNames.length })}
          </h3>
          <NumberField
            label={t('strategy.tiers.anchor', { country: fmt.region(strategy.baseRegion) })}
            value={anchor == null ? null : microsToUnits(anchor)}
            onCommit={(units) => units != null && commitStrategy({ ...strategy, anchorMicros: unitsToMicros(units) })}
            min={0.01}
            suffix={currency}
            invalidMessage={t('strategy.amount.invalid')}
            hint={t('strategy.tiers.anchorHint')}
          />
          <ul className="flex flex-col gap-2">
            {tierNames.map((tier) => {
              const share = strategy.tiers[tier] ?? 1;
              const members = membersOf(tier);
              const open = expanded === tier && members.length > 0;
              return (
                <li key={tier} className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-900" title={tier}>
                      {tier}
                    </span>
                    <span className="text-body font-medium text-ink-900 tabular">
                      {fmt.money(anchor == null ? null : Math.round(anchor * share), currency)}
                    </span>
                    <IconButton
                      icon="trash"
                      size="sm"
                      label={t('strategy.tiers.remove', { tier })}
                      onClick={() => commitStrategy(removeTier(strategy, tier))}
                    />
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <NumberField
                      srLabel={t('strategy.tiers.share', { tier })}
                      value={share * 100}
                      onCommit={(percent) =>
                        percent != null &&
                        commitStrategy({ ...strategy, tiers: { ...strategy.tiers, [tier]: percent / 100 } })
                      }
                      min={0}
                      max={1000}
                      suffix="%"
                      className="w-28"
                      invalidMessage={t('strategy.tiers.shareInvalid', { max: 1000 })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1"
                      iconAfter={open ? 'chevronDown' : 'chevronRight'}
                      aria-expanded={open}
                      disabled={!members.length}
                      onClick={() => setExpanded(open ? null : tier)}
                    >
                      {t('count.countries', { count: members.length })}
                    </Button>
                  </div>
                  {open && (
                    <ul
                      aria-label={t('strategy.tiers.members', { tier })}
                      className="flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded-md bg-ink-50 p-1.5"
                    >
                      {members.map((region) => (
                        <li
                          key={region}
                          className="inline-flex items-center gap-0.5 rounded-md border border-ink-200 bg-white py-0.5 pr-0.5 pl-2 text-small text-ink-800"
                        >
                          {fmt.region(region)}
                          <IconButton
                            icon="close"
                            size="sm"
                            label={t('strategy.tiers.removeCountry', { country: fmt.region(region), tier })}
                            onClick={() => commitStrategy(unassign(strategy, [region]))}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <SelectField
                      srLabel={t('strategy.tiers.addRegionLabel', { tier })}
                      value=""
                      className="min-w-40 flex-1"
                      onChange={(event) => {
                        const group = groups.all.find((option) => option.id === event.target.value);
                        if (group) commitStrategy(assignToTier(strategy, tier, group.members));
                      }}
                    >
                      <option value="">{t('strategy.tiers.addRegion')}</option>
                      {(
                        [
                          ['strategy.tiers.groups.mine', groups.mine],
                          ['strategy.tiers.groups.continents', groups.continents],
                          ['strategy.tiers.groups.subregions', groups.subregions],
                        ] as const
                      ).map(
                        ([key, options]) =>
                          options.length > 0 && (
                            <optgroup key={key} label={t(key)}>
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {t('strategy.tiers.groupOption', { name: option.label, count: option.members.length })}
                                </option>
                              ))}
                            </optgroup>
                          ),
                      )}
                    </SelectField>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="plus"
                      disabled={!selectedHere.length}
                      onClick={() => commitStrategy(assignToTier(strategy, tier, selectedHere))}
                    >
                      {t('strategy.tiers.addSelected', { count: selectedHere.length })}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newName || exists) return;
          commitStrategy({ ...strategy, tiers: { ...strategy.tiers, [newName]: 1 } });
          setNewTier('');
        }}
      >
        <TextField
          srLabel={t('strategy.tiers.newLabel')}
          placeholder={t('strategy.tiers.newPlaceholder')}
          value={newTier}
          maxLength={40}
          onChange={(event) => setNewTier(event.target.value)}
          error={exists ? t('strategy.tiers.exists') : null}
          className="flex-1"
        />
        <Button type="submit" icon="plus" disabled={!newName || exists}>
          {t('strategy.tiers.add')}
        </Button>
      </form>

      {hasLadder && untiered > 0 && <Hint>{t('strategy.tiers.untiered', { count: untiered })}</Hint>}

      {notSelected.length > 0 && (
        <Callout
          tone="info"
          action={
            <Button size="sm" onClick={() => addRegions(notSelected)}>
              {t('strategy.tiers.selectThem')}
            </Button>
          }
        >
          {t('strategy.tiers.notSelected', { count: notSelected.length })}
        </Callout>
      )}

      <ConvertOption strategy={strategy} />
    </>
  );
}

/**
 * Builds a ladder from the purchasing-power bands. Reference country first,
 * since the anchor is a price in its currency; the anchor follows it. The
 * resulting prices are shown before anything is generated.
 */
function LadderGenerator({
  strategy,
  regions,
  replacing,
  onGenerated,
}: {
  strategy: TierStrategy;
  regions: readonly RegionCode[];
  replacing: boolean;
  onGenerated: () => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const pricing = useStore((state) => state.pricing);
  const setSelection = useStore((state) => state.setSelection);
  const priceOf = (region: RegionCode) => pricing?.prices.find((price) => price.regionCode === region);

  const [base, setBase] = useState(strategy.baseRegion);
  const [anchor, setAnchor] = useState<number | null>(
    () => strategy.anchorMicros ?? priceOf(strategy.baseRegion)?.micros ?? null,
  );
  const [curve, setCurve] = useState<LadderCurve>('balanced');

  const basePrice = priceOf(base);
  const currency = basePrice?.currency ?? 'USD';
  const shares = CURVES[curve].shares;
  const available = new Set(regions);

  const generate = () => {
    if (anchor == null) return;
    const next = generateLadder({
      curve,
      baseRegion: base,
      anchorMicros: anchor,
      convert: strategy.convert,
      restrictTo: [...regions],
      nameOf: (band) => bandName(t, band.id, band.label),
    });
    commitStrategy(next);
    // Tiering decides a country's price; selecting it decides whether that
    // price is written. Generating means intending to price the ladder.
    const tiered = Object.keys(next.assignment);
    setSelection(tiered);
    toast({ key: 'strategy.ladder.selectionSet', vars: { count: tiered.length } }, 'success');
    onGenerated();
  };

  return (
    <div className="flex flex-col gap-3">
      <BaseMarketSelect
        label={t('strategy.ladder.base')}
        value={base}
        regions={regions}
        onChange={(region) => {
          setBase(region);
          setAnchor(priceOf(region)?.micros ?? null);
        }}
      />
      <div className="flex flex-col gap-1">
        <NumberField
          label={t('strategy.ladder.anchor')}
          value={anchor == null ? null : microsToUnits(anchor)}
          onCommit={(units) => units != null && setAnchor(unitsToMicros(units))}
          min={0.01}
          suffix={currency}
          invalidMessage={t('strategy.amount.invalid')}
          hint={t('strategy.ladder.anchorHint')}
        />
        {basePrice && anchor !== basePrice.micros && (
          <Button size="sm" variant="ghost" className="-ml-2.5 self-start" onClick={() => setAnchor(basePrice.micros)}>
            {t('strategy.ladder.useCurrent', { price: fmt.money(basePrice.micros, basePrice.currency) })}
          </Button>
        )}
      </div>
      <Segmented
        label={t('strategy.ladder.curve')}
        value={curve}
        columns={2}
        onChange={setCurve}
        options={LADDER_CURVES.map((id) => ({ value: id, label: curveName(t, id), description: curveBlurb(t, id) }))}
      />
      <table className="w-full overflow-hidden rounded-md border border-ink-200 bg-white text-small">
        <caption className="sr-only">{t('strategy.ladder.previewCaption')}</caption>
        <thead>
          <tr className="border-b border-ink-200 text-meta text-ink-500">
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              {t('strategy.ladder.col.band')}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              {t('strategy.ladder.col.countries')}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              {t('strategy.ladder.col.share')}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              {t('strategy.ladder.col.price')}
            </th>
          </tr>
        </thead>
        <tbody>
          {ECONOMIC_BANDS.map((band, index) => {
            const share = shares[index] ?? 1;
            return (
              <tr key={band.id} className="border-b border-ink-100 last:border-b-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal">
                  <span className="block font-medium text-ink-900">{bandName(t, band.id, band.label)}</span>
                  <span className="block text-meta text-ink-500">{bandBlurb(t, band.id)}</span>
                </th>
                <td className="px-2 py-1.5 text-right text-ink-700 tabular">
                  {fmt.number(band.members.filter((code) => available.has(code)).length)}
                </td>
                <td className="px-2 py-1.5 text-right text-ink-700 tabular">{fmt.share(share)}</td>
                <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap text-ink-900 tabular">
                  {fmt.money(anchor == null ? null : Math.round(anchor * share), currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-meta text-ink-500">{t('band.basis')}</p>
      <p className="text-small text-ink-600">
        {replacing ? t('strategy.ladder.replaces') : t('strategy.ladder.note')}
      </p>
      <Button
        variant={replacing ? 'secondary' : 'primary'}
        icon="sparkle"
        className="self-start"
        disabled={anchor == null}
        onClick={generate}
      >
        {replacing ? t('strategy.ladder.regenerateAction') : t('strategy.ladder.generate')}
      </Button>
    </div>
  );
}
