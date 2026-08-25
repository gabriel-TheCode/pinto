import { memo } from 'react';
import type { PriceChange } from '@/types';
import { formatMicros, formatPercent } from '@/domain/money/money';
import { Badge } from '@/components/Feedback';
import { cx } from '@/lib/cx';

export interface CountryRowProps {
  change: PriceChange;
  selected: boolean;
  onToggle: (region: string) => void;
  /** Review mode drops the checkbox and always shows the resulting price. */
  readOnly?: boolean;
}

/**
 * One country. Memoised because the table renders ~150 of these and the store
 * updates on every keystroke in the strategy form.
 */
export const CountryRow = memo(function CountryRow({
  change,
  selected,
  onToggle,
  readOnly = false,
}: CountryRowProps) {
  const error = change.issues.find((issue) => issue.level === 'error');
  const warning = change.issues.find((issue) => issue.level === 'warning');
  const showNew = change.status === 'changed' || change.status === 'invalid';

  return (
    <div
      className={cx(
        'group grid grid-cols-[16px_1fr_auto] items-center gap-2 px-3 py-1.5',
        'border-b border-ink-100 last:border-b-0',
        !readOnly && 'cursor-pointer hover:bg-ink-50',
        change.status === 'changed' && 'pinto-row-changed',
        change.status === 'invalid' && 'bg-fall-50/50',
      )}
      onClick={readOnly ? undefined : () => onToggle(change.regionCode)}
      role={readOnly ? undefined : 'checkbox'}
      aria-checked={readOnly ? undefined : selected}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={
        readOnly
          ? undefined
          : (event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                onToggle(change.regionCode);
              }
            }
      }
    >
      {readOnly ? (
        <span
          className={cx(
            'size-1.5 justify-self-center rounded-full',
            change.status === 'invalid'
              ? 'bg-fall-500'
              : warning
                ? 'bg-warn-500'
                : 'bg-accent-500',
          )}
        />
      ) : (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(change.regionCode)}
          onClick={(event) => event.stopPropagation()}
          className="size-3.5 accent-[var(--color-accent-500)]"
          aria-label={change.countryName}
        />
      )}

      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[12.5px] text-ink-900">{change.countryName}</span>
          <span className="shrink-0 font-mono text-[10px] text-ink-400">{change.regionCode}</span>
        </div>
        {(error || warning) && (
          <div
            className={cx(
              'truncate text-[11px]',
              error ? 'text-fall-500' : 'text-warn-500',
            )}
            title={(error ?? warning)!.message}
          >
            {(error ?? warning)!.message}
          </div>
        )}
        {change.rateUsed !== undefined && !error && (
          <div className="text-[10.5px] text-ink-400">
            rate ×{change.rateUsed.toFixed(change.rateUsed < 10 ? 3 : 1)}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 justify-self-end tabular">
        <span
          className={cx(
            'text-[12px] whitespace-nowrap',
            showNew ? 'text-ink-400 line-through decoration-ink-300' : 'text-ink-700',
          )}
        >
          {formatMicros(change.currentMicros, change.currency)}
        </span>
        {showNew && (
          <span className="text-[12px] font-medium whitespace-nowrap text-ink-900">
            {change.newMicros == null ? '—' : formatMicros(change.newMicros, change.currency, { withCode: false })}
          </span>
        )}
        <DeltaBadge change={change} />
      </div>
    </div>
  );
});

function DeltaBadge({ change }: { change: PriceChange }) {
  if (change.status === 'invalid') return <Badge tone="fall">error</Badge>;
  if (change.status === 'skipped') return <Badge tone="neutral">—</Badge>;
  if (change.delta === null || Math.abs(change.delta) < 0.0005) {
    return <Badge tone="neutral">0%</Badge>;
  }
  return (
    <Badge tone={change.delta > 0 ? 'rise' : 'fall'}>{formatPercent(change.delta)}</Badge>
  );
}
