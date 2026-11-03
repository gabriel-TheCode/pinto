import { useEffect, useId, useMemo } from 'react';
import { conversionReference, useChangeSet, useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { productName } from '@/i18n/describe';
import type { PriceChange, RegionCode, StrategyKind } from '@/types';
import { ChangeSummary } from '@/features/workspace/ChangeSummary';
import { cx } from '@/lib/cx';
import {
  Badge,
  Button,
  Footer,
  Hint,
  IS_MAC,
  Icon,
  MOD_LABEL,
  ScreenTitle,
  Section,
  useHotkey,
  useInvalidFields,
  type IconName,
} from '@/ui';
import { AdvancedOptions } from './AdvancedOptions';
import { KindFields } from './KindFields';
import { PresetManager, StartFrom } from './Presets';
import { STRATEGY_KINDS, initialStrategy, isNeutral, referenceRegion } from './model';
import { commitStrategy, useStrategyDrafts } from './state';
import { ConversionNote } from '@/features/workspace/ConversionNote';

const KIND_ICONS: Record<StrategyKind, IconName> = {
  percentage: 'tag',
  fixed: 'lock',
  tiers: 'layers',
  copy: 'copy',
  multiplier: 'sparkle',
  formula: 'flask',
};

/**
 * Step 1: how prices change. Asked before "where", so the countries step can
 * show what each country will get. The workspace opens on no change; the user
 * picks a kind, tunes it while a preview shows its effect, then moves on.
 */
export function StrategyStep() {
  const t = useT();
  const pricing = useStore((state) => state.pricing);
  const config = useStore((state) => state.config);
  const setStep = useStore((state) => state.setStep);
  const loadPresets = useStore((state) => state.loadPresets);
  const loadGroups = useStore((state) => state.loadGroups);
  const chosen = useStrategyDrafts((state) => state.chosen);
  const neutral = isNeutral(config);
  const regions = useMemo(() => pricing?.prices.map((price) => price.regionCode) ?? [], [pricing]);

  useEffect(() => {
    void loadPresets();
    void loadGroups();
  }, [loadPresets, loadGroups]);

  // The preview should use Google's rates too, not only the next steps:
  // fetch them once the settings stop moving. Deduplicated by the store.
  const ensureConversion = useStore((state) => state.ensureConversion);
  useEffect(() => {
    const timer = setTimeout(() => void ensureConversion(), 400);
    return () => clearTimeout(timer);
  }, [config, ensureConversion]);

  // A field showing text that is not a number holds back its last valid
  // value in the store; moving on would act on a number the user no longer sees.
  const invalidFields = useInvalidFields();
  const blocked = neutral || invalidFields > 0;
  const next = () => {
    if (!blocked) setStep('markets');
  };
  useHotkey('Enter', next, { mod: true, whileTyping: true });

  if (!pricing) return null;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 bg-white px-4 pt-4 pb-1">
          <ScreenTitle>{t('strategy.title')}</ScreenTitle>
          <p className="text-small text-ink-500">{t('strategy.subtitle', { product: productName(t, pricing) })}</p>
        </div>
        <StartFrom />
        <Section>
          <KindPicker chosen={chosen} regions={regions} />
        </Section>
        {chosen && (
          <Section title={t(`strategy.${config.strategy.kind}.name`)}>
            <KindFields strategy={config.strategy} regions={regions} />
            {!neutral && <Preview />}
          </Section>
        )}
        <div className="flex flex-col gap-3 px-4 py-4">
          {chosen && <AdvancedOptions />}
          <PresetManager />
        </div>
      </div>
      <Footer>
        {/* Wraps on a narrow panel rather than truncating the count. */}
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <div className="flex min-w-44 flex-1">
            <ChangeSummary />
          </div>
          <Button
            variant="primary"
            iconAfter="arrowRight"
            disabled={blocked}
            onClick={next}
            shortcut={`${MOD_LABEL}↵`}
            aria-keyshortcuts={IS_MAC ? 'Meta+Enter' : 'Control+Enter'}
          >
            {t('workspace.next.markets')}
          </Button>
        </div>
        {neutral ? (
          <Hint>{t('strategy.next.hint')}</Hint>
        ) : invalidFields > 0 ? (
          <Hint tone="error">{t('strategy.next.invalid')}</Hint>
        ) : null}
      </Footer>
    </>
  );
}

/**
 * The six kinds as cards, a native radio group underneath: arrow keys, one
 * tab stop and the checked state come from the browser. Nothing is checked
 * until the user picks; picking the active card again changes nothing, and
 * returning to a kind restores its last parameters.
 */
function KindPicker({ chosen, regions }: { chosen: StrategyKind | null; regions: readonly RegionCode[] }) {
  const t = useT();
  const name = useId();
  const choose = (kind: StrategyKind) =>
    commitStrategy(useStrategyDrafts.getState().drafts[kind] ?? initialStrategy(kind, regions));

  // Before a choice, every kind is explained in full. After it, the picker
  // shrinks to a compact row so the settings that matter now sit in view;
  // the chosen kind keeps its description.
  const compact = chosen !== null;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-title font-semibold text-ink-900">{t('strategy.kind.label')}</legend>
      <div className={cx('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-2')}>
        {STRATEGY_KINDS.map((kind) => {
          const active = chosen === kind;
          return (
            <label
              key={kind}
              className={cx(
                'flex cursor-pointer flex-col gap-1 rounded-lg border transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-500/40',
                compact ? 'px-2 py-1.5' : 'p-3',
                active
                  ? 'border-accent-500 bg-accent-50'
                  : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
              )}
            >
              <input
                type="radio"
                name={name}
                value={kind}
                checked={active}
                onChange={() => choose(kind)}
                className="sr-only"
              />
              <span className="flex min-w-0 items-center gap-1.5">
                <Icon
                  name={KIND_ICONS[kind]}
                  size={compact ? 14 : 16}
                  className={active ? 'text-accent-700' : 'text-ink-500'}
                />
                <span
                  className={cx(
                    'min-w-0 flex-1 font-medium text-ink-900',
                    compact ? 'truncate text-small' : 'text-body',
                  )}
                >
                  {t(`strategy.${kind}.name`)}
                </span>
                {active && !compact && <Icon name="check" size={14} className="text-accent-700" />}
              </span>
              {/* In compact mode the description is read out but shown only below. */}
              <span className={compact ? 'sr-only' : 'text-small text-ink-600'}>
                {t(`strategy.${kind}.blurb`)}
              </span>
            </label>
          );
        })}
      </div>
      {chosen && <p className="text-small text-ink-600">{t(`strategy.${chosen}.blurb`)}</p>}
    </fieldset>
  );
}

/**
 * What the change does before any country is chosen: the reference country,
 * then the largest rise and the largest fall.
 */
function Preview() {
  const t = useT();
  const fmt = useFormat();
  const changeSet = useChangeSet();
  const strategy = useStore((state) => state.config.strategy);
  const converts = useStore((state) => conversionReference(state) !== null);
  if (!changeSet) return null;

  const reference = referenceRegion(strategy);
  const changed = changeSet.changes.filter((row) => row.status === 'changed' && row.delta != null);
  const byDelta = [...changed].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const picks = [
    changeSet.changes.find((row) => row.regionCode === reference),
    byDelta[0],
    byDelta[byDelta.length - 1],
    ...[...changed].sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)),
  ];
  const rows = [...new Set(picks.filter((row): row is PriceChange => row !== undefined))].slice(0, 4);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-ink-50 p-3">
      <h3 className="text-small font-semibold text-ink-800">{t('strategy.preview.title')}</h3>
      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink-200/70">
          {rows.map((row) => (
            <li key={row.regionCode} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-small">
              <span className="flex min-w-0 flex-[1_1_8rem] items-center gap-1.5">
                <span className="truncate font-medium text-ink-900" title={fmt.region(row.regionCode)}>
                  {fmt.region(row.regionCode)}
                </span>
                {row.regionCode === reference && <Badge tone="neutral">{t('strategy.preview.reference')}</Badge>}
              </span>
              <span className="flex items-center gap-1.5 text-ink-700 tabular">
                {fmt.money(row.currentMicros, row.currency)}
                <Icon name="arrowRight" size={12} className="text-ink-500" />
                <span className="sr-only">{t('strategy.preview.becomes')}</span>
                <span className="font-medium text-ink-900">{fmt.money(row.newMicros, row.currency)}</span>
              </span>
              <PreviewBadge row={row} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-small text-ink-600">
        {changeSet.summary.changed
          ? t('strategy.preview.count', { count: changeSet.summary.changed })
          : t('strategy.preview.nothing')}
      </p>
      {converts && <ConversionNote />}
    </div>
  );
}

function PreviewBadge({ row }: { row: PriceChange }) {
  const t = useT();
  const fmt = useFormat();
  if (row.status === 'invalid') {
    return (
      <Badge tone="danger" icon="error">
        {t('strategy.preview.blocked')}
      </Badge>
    );
  }
  if (row.status === 'skipped') return <Badge tone="neutral">{t('strategy.preview.notSelected')}</Badge>;
  if (row.status !== 'changed' || row.delta == null) {
    return <Badge tone="neutral">{t('strategy.preview.unchanged')}</Badge>;
  }
  return <Badge tone={row.delta > 0 ? 'rise' : 'fall'}>{fmt.delta(row.delta)}</Badge>;
}
