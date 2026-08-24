import { useMemo, useState } from 'react';
import { useStore } from '@/app/store';
import type { RegionCode, Strategy, TierStrategy } from '@/types';
import { Button } from '@/components/Button';
import { Toggle, Label, Hint } from '@/components/Field';
import { countryOrPlaceholder } from '@/domain/regions/countries';
import { builtInGroups } from '@/domain/regions/groups';
import { BaseMarketSelect } from './BaseMarketSelect';
import { LadderGenerator } from './LadderGenerator';

/**
 * Relative regional pricing, made explicit.
 *
 * Pricing by economic zone is the thing Play Console cannot do — it applies one
 * price everywhere or makes you edit 150 countries by hand — so Pinto generates
 * the ladder for you. What it does not do is decide silently: the generator is
 * something the user asks for, every share and every country stays editable
 * afterwards, and nothing reaches Google without passing through Review.
 */
function untieredSelected(tiered: RegionCode[], selection: Set<RegionCode>): number {
  return tiered.filter((region) => !selection.has(region)).length;
}

export function TierEditor({
  strategy,
  regions,
  onChange,
}: {
  strategy: TierStrategy;
  regions: RegionCode[];
  onChange: (strategy: Strategy) => void;
}) {
  const selection = useStore((state) => state.selection);
  const setSelection = useStore((state) => state.setSelection);
  const customGroups = useStore((state) => state.groups);
  const [newTier, setNewTier] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const tier of Object.values(strategy.assignment)) {
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }

  /**
   * Continent and sub-region groups, narrowed to the markets this product
   * actually prices. Assigning "West Africa" to a tier in one click is the
   * whole point of tiering — making the user go back to the country list,
   * filter, select and come back for each of five sub-regions turned a
   * two-minute job into a chore.
   */
  const groups = useMemo(() => {
    const available = new Set(regions);
    const geographic = builtInGroups().filter(
      (group) => group.kind === 'continent' || group.kind === 'subregion',
    );
    // A user's own grouping is usually a better fit for a price band than any
    // continent, so it belongs in the same menu rather than a separate flow.
    const mine = customGroups.map((group) => ({
      id: `custom:${group.id}`,
      label: group.label,
      kind: 'custom' as const,
      members: group.members,
    }));
    return [...geographic, ...mine]
      .map((group) => ({
        ...group,
        members: group.members.filter((member) => available.has(member)),
      }))
      .filter((group) => group.members.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [regions, customGroups]);

  const assign = (tier: string, members: Iterable<RegionCode>) => {
    const assignment = { ...strategy.assignment };
    for (const region of members) assignment[region] = tier;
    onChange({ ...strategy, assignment });
  };

  const assignGroup = (tier: string, groupId: string) => {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (group) assign(tier, group.members);
  };

  const tiered = Object.keys(strategy.assignment).filter((region) => regions.includes(region));

  const membersOf = (tier: string) =>
    Object.entries(strategy.assignment)
      .filter(([region, value]) => value === tier && regions.includes(region))
      .map(([region]) => region)
      .sort((a, b) =>
        countryOrPlaceholder(a).name.localeCompare(countryOrPlaceholder(b).name),
      );

  const unassignOne = (region: RegionCode) => {
    const assignment = { ...strategy.assignment };
    delete assignment[region];
    onChange({ ...strategy, assignment });
  };

  const clearTier = (tier: string) => {
    const assignment = Object.fromEntries(
      Object.entries(strategy.assignment).filter(([, value]) => value !== tier),
    );
    onChange({ ...strategy, assignment });
  };

  const setShare = (tier: string, share: number) => {
    onChange({ ...strategy, tiers: { ...strategy.tiers, [tier]: share } });
  };

  const unassigned = regions.filter((region) => !strategy.assignment[region]);

  return (
    <>
      <LadderGenerator
        strategy={strategy}
        regions={regions}
        onChange={onChange}
        onGenerated={() => setExpanded(null)}
      />

      <BaseMarketSelect
        label="Base market"
        value={strategy.baseRegion}
        regions={regions}
        onChange={(baseRegion) => onChange({ ...strategy, baseRegion })}
        hint="Every tier is a share of this market’s price."
      />

      <div className="flex flex-col gap-1.5">
        <Label>Tiers</Label>
        {Object.entries(strategy.tiers).map(([tier, share]) => (
          <div
            key={tier}
            className="flex flex-col gap-1.5 rounded-lg border border-ink-200 px-2 py-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-[12.5px] font-medium text-ink-800">{tier}</span>
              {/* The count is the disclosure: after adding "Western Europe" the
                  only honest answer to "what is in this tier" is the list of
                  countries, since a market can arrive from several groups. */}
              <button
                type="button"
                disabled={!(counts.get(tier) ?? 0)}
                onClick={() => setExpanded(expanded === tier ? null : tier)}
                aria-expanded={expanded === tier}
                className="rounded px-1 text-[11px] text-ink-400 tabular hover:text-ink-800 disabled:hover:text-ink-400"
              >
                {counts.get(tier) ?? 0} markets {(counts.get(tier) ?? 0) > 0 && (expanded === tier ? '▾' : '▸')}
              </button>
              <input
                type="number"
                min={0}
                max={500}
                step={5}
                value={Math.round(share * 100)}
                onChange={(event) => setShare(tier, Number(event.target.value) / 100)}
                className="h-6 w-14 rounded border border-ink-200 px-1 text-right text-[12px] tabular focus:border-accent-500 focus:outline-none"
                aria-label={`Share of the base price for ${tier}`}
              />
              <span className="text-[11px] text-ink-400">%</span>
              {(counts.get(tier) ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => clearTier(tier)}
                  className="text-[11px] text-ink-400 hover:text-fall-500"
                  title={`Unassign every market from ${tier}`}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value=""
                onChange={(event) => {
                  assignGroup(tier, event.target.value);
                  event.target.value = '';
                }}
                aria-label={`Add a region to ${tier}`}
                className="h-6 min-w-0 flex-1 rounded border border-ink-200 bg-white px-1.5 text-[11.5px] text-ink-600 focus:border-accent-500 focus:outline-none"
              >
                <option value="">Add a region…</option>
                {groups.some((group) => group.kind === 'custom') && (
                  <optgroup label="My groups">
                    {groups
                      .filter((group) => group.kind === 'custom')
                      .map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.label} ({group.members.length})
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Continents">
                  {groups
                    .filter((group) => group.kind === 'continent')
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label} ({group.members.length})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Sub-regions">
                  {groups
                    .filter((group) => group.kind === 'subregion')
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label} ({group.members.length})
                      </option>
                    ))}
                </optgroup>
              </select>
              <Button
                size="sm"
                variant="ghost"
                disabled={!selection.size}
                onClick={() => assign(tier, selection)}
              >
                Add selected ({selection.size})
              </Button>
            </div>

            {expanded === tier && (
              <div
                className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md bg-ink-50 p-1.5"
                aria-label={`Markets in ${tier}`}
              >
                {membersOf(tier).map((region) => (
                  <span
                    key={region}
                    className="inline-flex items-center gap-1 rounded border border-ink-200 bg-white py-0.5 pr-1 pl-1.5 text-[11px] text-ink-700"
                  >
                    {countryOrPlaceholder(region).name}
                    <button
                      type="button"
                      aria-label={`Remove ${countryOrPlaceholder(region).name} from ${tier}`}
                      onClick={() => unassignOne(region)}
                      className="text-ink-300 hover:text-fall-500"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-2">
          <input
            value={newTier}
            onChange={(event) => setNewTier(event.target.value)}
            placeholder="New tier name"
            className="h-7 flex-1 rounded-md border border-ink-200 px-2 text-[12px] focus:border-accent-500 focus:outline-none"
          />
          <Button
            size="sm"
            disabled={!newTier.trim() || newTier in strategy.tiers}
            onClick={() => {
              setShare(newTier.trim(), 1);
              setNewTier('');
            }}
          >
            Add tier
          </Button>
        </div>
      </div>

      {unassigned.length > 0 && (
        <Hint>
          {unassigned.length} priced {unassigned.length === 1 ? 'market is' : 'markets are'} not in
          any tier and will be left untouched.
        </Hint>
      )}

      {/* Tiering a market decides its price; selecting it decides whether that
          price is written. Getting one without the other produces a confusing
          "nothing changed", so the gap is named and fixable in one click. */}
      {tiered.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-2 py-1.5">
          <span className="flex-1 text-[11.5px] text-ink-600">
            {untieredSelected(tiered, selection) === 0
              ? `All ${tiered.length} tiered markets are selected.`
              : `${untieredSelected(tiered, selection)} tiered ${
                  untieredSelected(tiered, selection) === 1 ? 'market is' : 'markets are'
                } not selected, so they will not be written.`}
          </span>
          <Button
            size="sm"
            disabled={untieredSelected(tiered, selection) === 0}
            onClick={() => setSelection([...new Set([...selection, ...tiered])])}
          >
            Select them
          </Button>
        </div>
      )}

      <Toggle
        checked={strategy.convert}
        onChange={(convert) => onChange({ ...strategy, convert })}
        label="Convert into each market’s currency"
        description="Uses the rates implied by this product’s existing prices."
      />
    </>
  );
}
