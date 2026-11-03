import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { useT } from '@/i18n/react';
import type { ApplyProgress } from '@/services/messages';
import { cx } from '@/lib/cx';
import { Callout, Icon, ProgressBar, ScreenTitle, Spinner, announce } from '@/ui';

type Phase = Exclude<ApplyProgress['phase'], 'done'>;
const PHASES: readonly Phase[] = ['preparing', 'writing', 'isolating', 'verifying'];

/**
 * The write in progress, phase by phase in plain words. Isolating is listed
 * only once it happens: most writes go through in one batch, and a pending
 * "Google Play refused part of the batch" would alarm for nothing.
 */
export function ProgressView() {
  const t = useT();
  const progress = useStore((state) => state.progress);
  const [isolated, setIsolated] = useState(false);
  if (progress?.phase === 'isolating' && !isolated) setIsolated(true);

  const phase = progress?.phase;
  const total = progress?.total ?? 0;
  const label = (id: Phase) =>
    id === 'writing' ? t('review.progress.phase.writing', { count: total }) : t(`review.progress.phase.${id}`);

  useEffect(() => {
    // Each phase once, not on every count update.
    if (phase && phase !== 'done') announce(label(phase));
  }, [phase]);

  if (!progress) return null;

  const title = progress.revert ? t('review.progress.titleRevert') : t('review.progress.title');
  const shown = PHASES.filter((id) => id !== 'isolating' || isolated);
  const index = progress.phase === 'done' ? PHASES.length : PHASES.indexOf(progress.phase);
  // One atomic write reports no count until it returns: pulse rather than sit at 0.
  const waiting = progress.phase === 'writing' && progress.completed === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
      <div className="flex flex-col gap-5 px-4 py-6">
        <ScreenTitle>{title}</ScreenTitle>

        <ol className="flex flex-col gap-2.5">
          {shown.map((id) => {
            const position = PHASES.indexOf(id);
            const state = position < index ? 'done' : position === index ? 'current' : 'pending';
            return (
              <li
                key={id}
                aria-current={state === 'current' ? 'step' : undefined}
                className={cx(
                  'flex items-start gap-2.5 text-body',
                  state === 'done' && 'text-ink-600',
                  state === 'current' && 'font-medium text-ink-900',
                  state === 'pending' && 'text-ink-500',
                )}
              >
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                  {state === 'done' && <Icon name="success" className="text-success-500" />}
                  {state === 'current' && <Spinner className="text-accent-600" />}
                  {state === 'pending' && <Icon name="dot" size={12} className="text-ink-300" />}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span>
                    <span className="sr-only">{t(`review.progress.state.${state}`)} </span>
                    {label(id)}
                  </span>
                  {id === 'isolating' && (progress.rejected ?? 0) > 0 && (
                    <span className="text-small font-normal text-ink-600">
                      {t('review.progress.rejected', { count: progress.rejected ?? 0 })}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-1.5">
          <ProgressBar value={progress.completed} total={waiting ? 0 : total} label={title} />
          {total > 0 && (
            <p className="text-small text-ink-500 tabular">
              {t('review.progress.count', { completed: progress.completed, total })}
            </p>
          )}
        </div>

        <Callout tone="neutral">{t('review.progress.note')}</Callout>
      </div>
    </div>
  );
}
