import { useMemo, useState } from 'react';
import { useChangeSet, useStore } from '@/app/store';
import type { RegionCode, Strategy, StrategyKind } from '@/types';
import { Button } from '@/components/Button';
import { TextField, Toggle, Label, Hint } from '@/components/Field';
import { BaseMarketSelect } from './BaseMarketSelect';
import { Badge } from '@/components/Feedback';
import { cx } from '@/lib/cx';
import { MICROS_PER_UNIT, formatMicros, unitsToMicros } from '@/domain/money/money';
import { validateFormula } from '@/domain/formula/parser';
import { generateLadder } from '@/domain/regions/economicBands';
import { TierEditor } from './TierEditor';
import { RoundingEditor } from './RoundingEditor';

const KINDS: { id: StrategyKind; label: string; blurb: string }[] = [
  { id: 'percentage', label: 'Percentage', blurb: 'Move every selected price by a percentage.' },
  { id: 'multiplier', label: 'Multiplier', blurb: 'Multiply the current price by a factor.' },
  { id: 'fixed', label: 'Fixed price', blurb: 'Target one price, converted per market.' },
  { id: 'copy', label: 'Copy from', blurb: 'Take one market’s price everywhere.' },
  { id: 'tiers', label: 'Tiers', blurb: 'Share of a base price, per tier you define.' },
  { id: 'formula', label: 'Formula', blurb: 'Write the arithmetic yourself.' },
];

export function StrategyScreen() {
  const { config, setConfig, pricing, selection, setScreen } = useStore();
  const changeSet = useChangeSet();

  const regions = useMemo(
    () => [...new Set(pricing?.prices.map((p) => p.regionCode) ?? [])].sort(),
    [pricing],
  );
  const baseCurrency = (region: RegionCode) =>
    pricing?.prices.find((p) => p.regionCode === region)?.currency ?? 'USD';

  const setStrategy = (strategy: Strategy) => setConfig({ strategy });

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-ink-200 bg-white p-3">
          <Label>Strategy</Label>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {KINDS.map((kind) => (
              <button
                key={kind.id}
                type="button"
                onClick={() => setStrategy(defaultFor(kind.id, regions[0] ?? 'US', regions))}
                title={kind.blurb}
                className={cx(
                  'rounded-lg border px-2 py-2 text-left transition-colors',
                  config.strategy.kind === kind.id
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
                )}
              >
                <div className="text-[12px] font-medium">{kind.label}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-500">
            {KINDS.find((k) => k.id === config.strategy.kind)?.blurb}
          </p>
        </section>

        <section className="flex flex-col gap-3 border-b border-ink-200 bg-white p-3">
          <StrategyFields
            regions={regions}
            baseCurrency={baseCurrency}
            onChange={setStrategy}
          />
        </section>

        <RoundingEditor />

        <section className="flex flex-col gap-3 border-b border-ink-200 bg-white p-3">
          <Label>Guard rails</Label>
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Never below"
              placeholder="none"
              inputMode="decimal"
              value={config.floorMicros == null ? '' : String(config.floorMicros / MICROS_PER_UNIT)}
              onChange={(event) =>
                setConfig({
                  floorMicros: event.target.value ? unitsToMicros(Number(event.target.value)) : null,
                })
              }
            />
            <TextField
              label="Never above"
              placeholder="none"
              inputMode="decimal"
              value={
                config.ceilingMicros == null ? '' : String(config.ceilingMicros / MICROS_PER_UNIT)
              }
              onChange={(event) =>
                setConfig({
                  ceilingMicros: event.target.value
                    ? unitsToMicros(Number(event.target.value))
                    : null,
                })
              }
            />
          </div>
          <Hint>
            Applied in each market’s own currency, after rounding. Leave empty for no limit.
          </Hint>
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-ink-200 bg-white px-3 py-2.5">
        <div className="flex-1 text-[11.5px] text-ink-500">
          <span className="font-medium text-ink-900">{changeSet?.summary.changed ?? 0}</span> of{' '}
          {selection.size} selected will change
          {(changeSet?.summary.invalid ?? 0) > 0 && (
            <Badge tone="fall" className="ml-1.5">
              {changeSet!.summary.invalid} blocked
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setScreen('pricing')}>
          Back to countries
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!changeSet?.summary.changed}
          onClick={() => setScreen('review')}
        >
          Review changes
        </Button>
      </div>
    </div>
  );
}

function StrategyFields({
  regions,
  baseCurrency,
  onChange,
}: {
  regions: RegionCode[];
  baseCurrency: (region: RegionCode) => string;
  onChange: (strategy: Strategy) => void;
}) {
  const strategy = useStore((state) => state.config.strategy);
  const pricing = useStore((state) => state.pricing);
  const [formulaText, setFormulaText] = useState(
    strategy.kind === 'formula' ? strategy.expression : 'current * 1.1',
  );

  switch (strategy.kind) {
    case 'percentage':
      return (
        <>
          <TextField
            label="Adjustment"
            inputMode="decimal"
            suffix="%"
            value={String(strategy.percent)}
            onChange={(event) =>
              onChange({ kind: 'percentage', percent: Number(event.target.value) || 0 })
            }
            hint="Negative values reduce prices, e.g. −20."
          />
          <div className="flex gap-1.5">
            {[-20, -10, 5, 10, 20].map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => onChange({ kind: 'percentage', percent })}
                className="rounded-md border border-ink-200 px-2 py-1 text-[11.5px] text-ink-600 hover:bg-ink-50"
              >
                {percent > 0 ? `+${percent}` : percent}%
              </button>
            ))}
          </div>
        </>
      );

    case 'multiplier':
      return (
        <TextField
          label="Factor"
          inputMode="decimal"
          suffix="×"
          value={String(strategy.factor)}
          onChange={(event) =>
            onChange({ kind: 'multiplier', factor: Number(event.target.value) || 1 })
          }
          hint="1.2 raises prices by a fifth; 0.8 cuts them by a fifth."
        />
      );

    case 'fixed': {
      const currency = baseCurrency(strategy.baseRegion);
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label={`Target price (${currency})`}
              inputMode="decimal"
              value={String(strategy.micros / MICROS_PER_UNIT)}
              onChange={(event) =>
                onChange({ ...strategy, micros: unitsToMicros(Number(event.target.value) || 0) })
              }
            />
            <BaseMarketSelect
              label="Priced in"
              value={strategy.baseRegion}
              regions={regions}
              onChange={(baseRegion) => onChange({ ...strategy, baseRegion })}
            />
          </div>
          <Toggle
            checked={strategy.convert}
            onChange={(convert) => onChange({ ...strategy, convert })}
            label="Convert into each market’s currency"
            description="Uses Google’s own conversion rates for this product, falling back to the rates its existing prices imply. Markets with no price and no rate are flagged rather than guessed."
          />
        </>
      );
    }

    case 'copy': {
      const source = pricing?.prices.find((p) => p.regionCode === strategy.fromRegion);
      return (
        <>
          <BaseMarketSelect
            label="Copy the price from"
            value={strategy.fromRegion}
            regions={regions}
            onChange={(fromRegion) => onChange({ ...strategy, fromRegion })}
            {...(source
              ? { hint: `Currently ${formatMicros(source.micros, source.currency)}.` }
              : {})}
          />
          <Toggle
            checked={strategy.convert}
            onChange={(convert) => onChange({ ...strategy, convert })}
            label="Convert into each market’s currency"
            description="Off means the same number is written everywhere, which is almost never what you want across currencies."
          />
        </>
      );
    }

    case 'tiers':
      return <TierEditor strategy={strategy} regions={regions} onChange={onChange} />;

    case 'formula': {
      const check = validateFormula(formulaText);
      return (
        <>
          <TextField
            label="Expression"
            value={formulaText}
            spellCheck={false}
            className="font-mono"
            onChange={(event) => {
              setFormulaText(event.target.value);
              if (validateFormula(event.target.value).ok) {
                onChange({ ...strategy, expression: event.target.value });
              }
            }}
            error={check.ok ? null : check.error}
            hint="Variables: current, base. Functions: min, max, round, floor, ceil, abs."
          />
          <div className="flex flex-wrap gap-1.5">
            {['current * 1.1', 'current * 0.8', 'base * 1.25', 'min(current * 1.15, 19.99)'].map(
              (example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setFormulaText(example);
                    onChange({ ...strategy, expression: example });
                  }}
                  className="rounded-md border border-ink-200 px-2 py-1 font-mono text-[11px] text-ink-600 hover:bg-ink-50"
                >
                  {example}
                </button>
              ),
            )}
          </div>
          <BaseMarketSelect
            label="“base” refers to"
            value={strategy.baseRegion}
            regions={regions}
            onChange={(baseRegion) => onChange({ ...strategy, baseRegion })}
            hint="Formulas run in each market’s own currency, so “base” is that market’s reference price rather than a converted amount."
          />
        </>
      );
    }

    default:
      return null;
  }
}

function defaultFor(
  kind: StrategyKind,
  region: RegionCode,
  regions: RegionCode[] = [],
): Strategy {
  switch (kind) {
    case 'percentage':
      return { kind: 'percentage', percent: 10 };
    case 'multiplier':
      return { kind: 'multiplier', factor: 1.1 };
    case 'fixed':
      return { kind: 'fixed', micros: unitsToMicros(4.99), baseRegion: region, convert: true };
    case 'copy':
      return { kind: 'copy', fromRegion: region, convert: true };
    case 'tiers':
      // Start from a real purchasing-power ladder rather than four empty
      // bands: pricing by economic zone is what people open this screen for,
      // and an empty grid makes them do by hand the one job Play Console
      // already refuses to do. Every share and country is editable from here.
      return generateLadder({ curve: 'balanced', baseRegion: region, restrictTo: regions });
    case 'formula':
      return { kind: 'formula', expression: 'current * 1.1', baseRegion: region };
    default:
      return { kind: 'percentage', percent: 10 };
  }
}
