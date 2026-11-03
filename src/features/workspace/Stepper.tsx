import { useChangeSet, useStore, currencyLookup, STEPS, type Step } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { strategySummary } from '@/i18n/describe';
import { isNeutral } from '@/features/strategy/model';
import { Icon } from '@/ui';
import { cx } from '@/lib/cx';

/**
 * The three steps of a price change, always visible and always summarised,
 * so the answer to "where am I and what have I decided" is on screen rather
 * than in the user's memory. Steps are links: any can be revisited; Review
 * opens only once something would change.
 */
export function Stepper() {
  const t = useT();
  const fmt = useFormat();
  const step = useStore((state) => state.step);
  const setStep = useStore((state) => state.setStep);
  const config = useStore((state) => state.config);
  const selection = useStore((state) => state.selection);
  const pricing = useStore((state) => state.pricing);
  const changeSet = useChangeSet();
  const changed = changeSet?.summary.changed ?? 0;
  const total = pricing?.prices.length ?? 0;

  const summaries: Record<Step, string> = {
    strategy: isNeutral(config)
      ? t('workspace.step.strategy.empty')
      : strategySummary(t, fmt, config, currencyLookup({ pricing })),
    markets: t('workspace.step.markets.summary', { selected: selection.size, total }),
    review: changed
      ? t('workspace.step.review.summary', { count: changed })
      : t('workspace.step.review.empty'),
  };

  const index = STEPS.indexOf(step);

  return (
    <nav aria-label={t('workspace.steps.label')} className="shrink-0 border-b border-ink-200 bg-white px-2 py-1.5">
      <ol className="grid grid-cols-3 gap-1">
        {STEPS.map((id, position) => {
          const current = id === step;
          const done = position < index;
          const disabled = id === 'review' && changed === 0;
          return (
            <li key={id} className="min-w-0">
              <button
                type="button"
                disabled={disabled}
                aria-current={current ? 'step' : undefined}
                onClick={() => setStep(id)}
                className={cx(
                  'flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                  // Under 400px the label needs the whole width: number on top.
                  'max-[400px]:flex-col max-[400px]:items-center max-[400px]:gap-1 max-[400px]:px-1 max-[400px]:text-center',
                  current ? 'bg-ink-100' : 'hover:bg-ink-50',
                  disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-px grid size-[18px] shrink-0 place-items-center rounded-full text-meta font-semibold',
                    current
                      ? 'bg-accent-600 text-white'
                      : done
                        ? 'bg-ink-800 text-white'
                        : 'border border-ink-300 text-ink-600',
                  )}
                >
                  {done ? <Icon name="check" size={11} /> : position + 1}
                </span>
                <span className="flex min-w-0 max-w-full flex-col">
                  <span className="sr-only">
                    {t('workspace.step.position', { current: position + 1, total: STEPS.length })}
                  </span>
                  <span className={cx('truncate text-small font-semibold', current ? 'text-ink-900' : 'text-ink-700')}>
                    {t(`workspace.step.${id}`)}
                  </span>
                  <span className="truncate text-meta text-ink-500 max-[400px]:sr-only">{summaries[id]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
