import { memo, useId } from 'react';
import type { PriceChange, RegionCode } from '@/types';
import { useFormat, useT } from '@/i18n/react';
import { issueText } from '@/i18n/describe';
import { cx } from '@/lib/cx';
import { Badge, Icon } from '@/ui';

/** Shared with the column header so both line up. */
export const ROW_GRID = 'grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-x-2.5 px-4';

/**
 * One country: a `<label>` around a native checkbox, so the row is one tab
 * stop and one click target. The checkbox is named by the country alone; the
 * prices and notes are its description, read after the name.
 * Memoised: ~175 rows, and filtering re-renders the list on every keystroke.
 */
export const CountryRow = memo(function CountryRow({
  change,
  selected,
  onToggle,
}: {
  change: PriceChange;
  selected: boolean;
  onToggle: (region: RegionCode) => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const id = useId();
  const name = fmt.region(change.regionCode);
  const { status, currency, currentMicros, newMicros, delta, issues } = change;
  const skipped = status === 'skipped';
  const amount = (micros: number | null) => fmt.money(micros, currency, { code: false });
  const money = (micros: number | null) => fmt.money(micros, currency);

  const error = status === 'invalid' ? issues.find((issue) => issue.level === 'error') : undefined;
  const warning = error ? undefined : issues.find((issue) => issue.level === 'warning');
  const info = issues.filter((issue) => issue.level === 'info');
  const hasNotes = Boolean(error || warning || info.length);
  const tone = !delta ? 'neutral' : delta > 0 ? 'rise' : 'fall';

  return (
    <li>
      <label
        className={cx(
          ROW_GRID,
          'cursor-pointer items-start py-2 transition-colors hover:bg-ink-50',
          status === 'changed' && 'pinto-row-changed',
        )}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(change.regionCode)}
          aria-labelledby={`${id}-name`}
          aria-describedby={hasNotes ? `${id}-price ${id}-notes` : `${id}-price`}
          className="mt-0.5 size-4 cursor-pointer accent-[var(--color-accent-600)]"
        />

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span
              id={`${id}-name`}
              title={name}
              className={cx('truncate text-body', skipped ? 'text-ink-500' : 'text-ink-900')}
            >
              {name}
            </span>
            <span className="shrink-0 font-mono text-meta text-ink-500">{change.regionCode}</span>
            <span className="shrink-0 text-meta text-ink-500">{currency}</span>
          </span>
          {hasNotes && (
            <span id={`${id}-notes`} className="flex flex-col gap-0.5">
              {error && (
                <span className="flex items-start gap-1 text-small text-danger-500">
                  <Icon name="error" size={12} className="mt-0.5 shrink-0" />
                  {issueText(t, fmt, error)}
                </span>
              )}
              {warning && (
                <span className="flex items-start gap-1 text-small text-warn-500">
                  <Icon name="warning" size={12} className="mt-0.5 shrink-0" />
                  {issueText(t, fmt, warning)}
                </span>
              )}
              {info.length > 0 && (
                <span className="text-meta text-ink-500">
                  {info.map((issue) => issueText(t, fmt, issue)).join(' ')}
                </span>
              )}
            </span>
          )}
        </span>

        <span id={`${id}-price`} className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 tabular">
          {status === 'changed' ? (
            <>
              <span aria-hidden="true" className="flex items-baseline gap-1.5 whitespace-nowrap">
                <s className="text-small text-ink-500 decoration-ink-400">{amount(currentMicros)}</s>
                <span className="text-body font-semibold text-ink-900">{amount(newMicros)}</span>
              </span>
              <span className="sr-only">
                {t('markets.row.change', { from: money(currentMicros), to: money(newMicros) })}
              </span>
              {delta != null && (
                <Badge tone={tone}>{fmt.delta(delta)}</Badge>
              )}
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className={cx('text-small whitespace-nowrap', skipped ? 'text-ink-500' : 'text-ink-700')}
              >
                {amount(currentMicros)}
              </span>
              <span className="sr-only">{money(currentMicros)}</span>
              {status === 'unchanged' && (
                <span className="text-meta text-ink-500">{t('markets.row.noChange')}</span>
              )}
              {status === 'invalid' && (
                <Badge tone="danger" icon="error">
                  {t('markets.row.blocked')}
                </Badge>
              )}
            </>
          )}
        </span>
      </label>
    </li>
  );
});
