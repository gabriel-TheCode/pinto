import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { Rich, useFormat, useT } from '@/i18n/react';
import { formulaErrorText } from '@/i18n/describe';
import { validateFormula } from '@/domain/formula/parser';
import { microsToUnits, unitsToMicros } from '@/domain/money/money';
import type {
  CopyStrategy,
  FixedStrategy,
  FormulaStrategy,
  MultiplierStrategy,
  PercentageStrategy,
  RegionCode,
  Strategy,
} from '@/types';
import { NumberField, TextField } from '@/ui';
import { Chip, ConvertOption, useCurrencyOf } from './controls';
import { BaseMarketSelect } from './BaseMarketSelect';
import { FORMULA_EXAMPLES } from './model';
import { commitStrategy } from './state';
import { TierFields } from './TierFields';

const QUICK_PERCENTAGES = [-20, -10, 5, 10, 20];

/** The parameters of the strategy in force, one form per kind. */
export function KindFields({ strategy, regions }: { strategy: Strategy; regions: readonly RegionCode[] }) {
  switch (strategy.kind) {
    case 'percentage':
      return <PercentageFields strategy={strategy} />;
    case 'multiplier':
      return <MultiplierFields strategy={strategy} />;
    case 'fixed':
      return <FixedFields strategy={strategy} regions={regions} />;
    case 'copy':
      return <CopyFields strategy={strategy} regions={regions} />;
    case 'tiers':
      return <TierFields strategy={strategy} regions={regions} />;
    case 'formula':
      return <FormulaFields strategy={strategy} regions={regions} />;
  }
}

function PercentageFields({ strategy }: { strategy: PercentageStrategy }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <>
      <NumberField
        label={t('strategy.percentage.label')}
        value={strategy.percent}
        onCommit={(percent) => commitStrategy({ ...strategy, percent: percent ?? 0 })}
        min={-99}
        max={1000}
        suffix="%"
        invalidMessage={t('strategy.percentage.invalid', { min: -99, max: 1000 })}
        hint={t('strategy.percentage.hint')}
      />
      <div role="group" aria-label={t('strategy.percentage.quick')} className="flex flex-wrap gap-1.5">
        {QUICK_PERCENTAGES.map((percent) => (
          <Chip
            key={percent}
            pressed={strategy.percent === percent}
            onClick={() => commitStrategy({ ...strategy, percent })}
          >
            {fmt.delta(percent / 100)}
          </Chip>
        ))}
      </div>
    </>
  );
}

function MultiplierFields({ strategy }: { strategy: MultiplierStrategy }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <NumberField
      label={t('strategy.multiplier.label')}
      value={strategy.factor}
      onCommit={(factor) => commitStrategy({ ...strategy, factor: factor ?? 1 })}
      min={0.01}
      max={100}
      suffix="×"
      invalidMessage={t('strategy.multiplier.invalid', { min: 0.01, max: 100 })}
      hint={t('strategy.multiplier.hint', { factor: fmt.number(1.2), delta: fmt.delta(0.2) })}
    />
  );
}

function FixedFields({ strategy, regions }: { strategy: FixedStrategy; regions: readonly RegionCode[] }) {
  const t = useT();
  const currencyOf = useCurrencyOf();
  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <NumberField
          label={t('strategy.fixed.amount')}
          value={microsToUnits(strategy.micros)}
          onCommit={(units) => units != null && commitStrategy({ ...strategy, micros: unitsToMicros(units) })}
          min={0.01}
          suffix={currencyOf(strategy.baseRegion)}
          invalidMessage={t('strategy.amount.invalid')}
        />
        <BaseMarketSelect
          label={t('strategy.fixed.base')}
          value={strategy.baseRegion}
          regions={regions}
          onChange={(baseRegion) => commitStrategy({ ...strategy, baseRegion })}
        />
      </div>
      <ConvertOption strategy={strategy} />
    </>
  );
}

function CopyFields({ strategy, regions }: { strategy: CopyStrategy; regions: readonly RegionCode[] }) {
  const t = useT();
  const fmt = useFormat();
  const source = useStore((state) => state.pricing?.prices.find((price) => price.regionCode === strategy.fromRegion));
  return (
    <>
      <BaseMarketSelect
        label={t('strategy.copy.from')}
        value={strategy.fromRegion}
        regions={regions}
        onChange={(fromRegion) => commitStrategy({ ...strategy, fromRegion })}
        {...(source ? { hint: t('strategy.copy.current', { price: fmt.money(source.micros, source.currency) }) } : {})}
      />
      <ConvertOption strategy={strategy} />
    </>
  );
}

function FormulaFields({ strategy, regions }: { strategy: FormulaStrategy; regions: readonly RegionCode[] }) {
  const t = useT();
  const [text, setText] = useState(strategy.expression);
  // Follow a formula set elsewhere (a preset, an example chip).
  useEffect(() => setText(strategy.expression), [strategy.expression]);
  const check = validateFormula(text);

  const write = (expression: string) => {
    setText(expression);
    if (validateFormula(expression).ok) commitStrategy({ ...strategy, expression });
  };

  return (
    <>
      <TextField
        label={t('strategy.formula.label')}
        value={text}
        onChange={(event) => write(event.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        inputClassName="font-mono"
        error={check.ok ? null : formulaErrorText(t, check.error)}
        hint={t('strategy.formula.hint')}
      />
      <div role="group" aria-label={t('strategy.formula.examples')} className="flex flex-wrap gap-1.5">
        {FORMULA_EXAMPLES.map((example) => (
          <Chip key={example} mono pressed={text === example} onClick={() => write(example)}>
            {example}
          </Chip>
        ))}
      </div>
      <p className="text-small text-ink-600">
        <Rich text={t('strategy.formula.help')} />
      </p>
      <BaseMarketSelect
        label={t('strategy.formula.base')}
        value={strategy.baseRegion}
        regions={regions}
        onChange={(baseRegion) => commitStrategy({ ...strategy, baseRegion })}
      />
    </>
  );
}
