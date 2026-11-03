import { useEffect, useId, useState } from 'react';
import { useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import type { RoundingConfig } from '@/types';
import { Badge, Button, Callout, Disclosure, Hint, NumberField, Segmented, TextField } from '@/ui';
import { ROUNDING_MODES, parseEndings } from './model';

/**
 * Rounding and limits: they apply to every kind of change and most people
 * never touch them, so they sit closed under a summary of what is set.
 * Anything that changes prices in a surprising way stays visible outside.
 */
export function AdvancedOptions() {
  const t = useT();
  const fmt = useFormat();
  const config = useStore((state) => state.config);
  const setConfig = useStore((state) => state.setConfig);
  const { rounding, maxIncrease, maxDecrease } = config;
  const setRounding = (patch: Partial<RoundingConfig>) => setConfig({ rounding: { ...rounding, ...patch } });

  const limits = [
    maxIncrease != null ? fmt.delta(maxIncrease) : null,
    maxDecrease != null ? fmt.delta(-maxDecrease) : null,
  ].filter((limit): limit is string => limit !== null);
  const roundingName = t(`strategy.rounding.${rounding.mode}`);
  const overrides = Object.keys(config.overrides ?? {}).length;
  const limitsId = useId();

  return (
    <>
      {(config.floorMicros != null || config.ceilingMicros != null) && (
        <Callout
          tone="warn"
          title={t('strategy.legacy.title')}
          action={
            <Button size="sm" onClick={() => setConfig({ floorMicros: null, ceilingMicros: null })}>
              {t('action.remove')}
            </Button>
          }
        >
          {t('strategy.legacy.body')}
        </Callout>
      )}
      {overrides > 0 && (
        <Callout
          tone="info"
          action={
            <Button size="sm" onClick={() => setConfig({ overrides: {} })}>
              {t('action.remove')}
            </Button>
          }
        >
          {t('strategy.overrides.body', { count: overrides })}
        </Callout>
      )}
      <Disclosure
        title={t('strategy.advanced.title')}
        summary={
          limits.length
            ? t('strategy.advanced.summaryLimits', { rounding: roundingName, limits: fmt.list(limits) })
            : roundingName
        }
      >
        <Segmented
          label={t('strategy.rounding.label')}
          value={rounding.mode}
          columns={2}
          onChange={(mode) => setRounding({ mode })}
          options={ROUNDING_MODES.map((mode) => ({
            value: mode,
            label: t(`strategy.rounding.${mode}`),
            description: t(`strategy.rounding.about.${mode}`),
          }))}
        />
        {rounding.mode === 'endings' && (
          <EndingsField endings={rounding.endings} onCommit={(endings) => setRounding({ endings })} />
        )}
        {(rounding.mode === 'charm' || rounding.mode === 'endings') && (
          <NumberField
            label={t('strategy.rounding.step')}
            value={rounding.zeroDecimalStep}
            onCommit={(step) => step != null && setRounding({ zeroDecimalStep: Math.round(step) })}
            min={1}
            max={1_000_000}
            invalidMessage={t('strategy.rounding.stepInvalid')}
            hint={t('strategy.rounding.stepHint')}
          />
        )}
        <Hint>{t('strategy.rounding.note')}</Hint>

        <div role="group" aria-labelledby={limitsId} className="flex flex-col gap-2 border-t border-ink-100 pt-3">
          <p id={limitsId} className="text-small font-medium text-ink-800">
            {t('strategy.limits.label')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t('strategy.limits.maxIncrease')}
              value={maxIncrease == null ? null : maxIncrease * 100}
              onCommit={(percent) => setConfig({ maxIncrease: percent == null ? null : percent / 100 })}
              allowEmpty
              min={0}
              max={10_000}
              suffix="%"
              placeholder={t('strategy.limits.none')}
              invalidMessage={t('strategy.limits.invalid')}
            />
            <NumberField
              label={t('strategy.limits.maxDecrease')}
              value={maxDecrease == null ? null : maxDecrease * 100}
              onCommit={(percent) => setConfig({ maxDecrease: percent == null ? null : percent / 100 })}
              allowEmpty
              min={0}
              max={99}
              suffix="%"
              placeholder={t('strategy.limits.none')}
              invalidMessage={t('strategy.limits.invalidDecrease')}
            />
          </div>
          <Hint>{t('strategy.limits.hint')}</Hint>
        </div>
      </Disclosure>
    </>
  );
}

/**
 * Endings are a list typed in one field, so they are read when the field is
 * left — reading on every keystroke turned "0." into 0 and a trailing comma
 * into a .00 ending. What was understood is shown back as chips.
 */
function EndingsField({ endings, onCommit }: { endings: number[]; onCommit: (endings: number[]) => void }) {
  const t = useT();
  const fmt = useFormat();
  // A comma is the decimal point in French, so the list is joined with ";" there.
  const separator = fmt.decimalSeparator === ',' ? '\u202f; ' : ', ';
  const written = endings.map((ending) => fmt.editable(ending)).join(separator);
  const [text, setText] = useState(written);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(written), [written]);

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t('strategy.rounding.endingsLabel')}
        value={text}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setText(event.target.value);
          setInvalid(false);
        }}
        onBlur={() => {
          const parsed = parseEndings(text, fmt.parseDecimal);
          setInvalid(!parsed);
          if (parsed) {
            onCommit(parsed);
            setText(parsed.map((ending) => fmt.editable(ending)).join(separator));
          }
        }}
        error={invalid ? t('strategy.rounding.endingsInvalid') : null}
        hint={t('strategy.rounding.endingsHint')}
      />
      {endings.length > 0 && (
        <ul aria-label={t('strategy.rounding.endingsApplied')} className="flex flex-wrap gap-1">
          {endings.map((ending) => (
            <li key={ending}>
              <Badge tone="neutral">{fmt.number(ending, { minimumFractionDigits: 2 })}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
