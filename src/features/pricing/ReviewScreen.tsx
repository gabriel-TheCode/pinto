import { useMemo, useState } from 'react';
import { useChangeSet, useStore } from '@/app/store';
import { CountryRow } from './CountryRow';
import { Button } from '@/components/Button';
import { Badge, EmptyState, ProgressBar } from '@/components/Feedback';
import { Toggle } from '@/components/Field';
import { describeStrategy, writableChanges } from '@/domain/pricing/computeChangeSet';
import { exportChangeSetCsv, download } from '@/lib/csv';
import { cx } from '@/lib/cx';
import { ApplyResult } from './ApplyResult';

type Tab = 'changed' | 'warnings' | 'blocked' | 'unchanged';

/**
 * Review-before-apply. Nothing reaches Google Play without passing through
 * this screen, and the rows shown here are the exact values that get written —
 * they come from the same pure computation, not a re-render of it.
 */
export function ReviewScreen() {
  const {
    config,
    dryRun,
    setDryRun,
    setScreen,
    apply,
    progress,
    lastOperation,
    selection,
    conversionTable,
    conversionLoading,
  } = useStore();
  const changeSet = useChangeSet();
  const [tab, setTab] = useState<Tab>('changed');
  const [confirmText, setConfirmText] = useState('');

  const buckets = useMemo(() => {
    const changes = changeSet?.changes ?? [];
    return {
      changed: changes.filter((c) => c.status === 'changed'),
      warnings: changes.filter((c) => c.issues.some((i) => i.level === 'warning')),
      blocked: changes.filter((c) => c.status === 'invalid'),
      unchanged: changes.filter((c) => c.status === 'unchanged'),
    } satisfies Record<Tab, typeof changes>;
  }, [changeSet]);

  if (progress) return <ApplyProgressView />;
  if (lastOperation) return <ApplyResult />;
  if (!changeSet) return null;
  if (conversionLoading && !conversionTable) return <ConversionLoading />;

  const writable = writableChanges(changeSet);
  const needsTypedConfirmation = writable.length >= 25;
  const confirmed = !needsTypedConfirmation || confirmText.trim() === String(writable.length);

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'changed', label: 'Changing', count: buckets.changed.length },
    { id: 'warnings', label: 'Warnings', count: buckets.warnings.length },
    { id: 'blocked', label: 'Blocked', count: buckets.blocked.length },
    { id: 'unchanged', label: 'Unchanged', count: buckets.unchanged.length },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start gap-2 border-b border-ink-200 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={() => setScreen('pricing')}
          className="mt-0.5 text-[12px] text-ink-500 hover:text-ink-900"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink-900">
            Review changes
          </h2>
          <p className="text-[11.5px] text-ink-500">
            {describeStrategy(config)} · {selection.size} selected ·{' '}
            <span className="font-medium text-ink-800">{writable.length} will be written</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            download(
              `pinto-${changeSet.product.productId}-${Date.now()}.csv`,
              exportChangeSetCsv(changeSet),
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-ink-200 bg-white px-3 py-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cx(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors',
              tab === item.id ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-50',
            )}
          >
            {item.label}
            <span
              className={cx(
                'tabular',
                item.id === 'blocked' && item.count > 0 && 'text-fall-500',
                item.id === 'warnings' && item.count > 0 && 'text-warn-500',
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {buckets[tab].length === 0 ? (
          <EmptyState
            title={
              tab === 'blocked'
                ? 'Nothing is blocked'
                : tab === 'warnings'
                  ? 'No warnings'
                  : 'Nothing here'
            }
            body={
              tab === 'blocked'
                ? 'Every selected country produced a valid price.'
                : tab === 'warnings'
                  ? 'No price moves by more than half its current value.'
                  : 'Adjust the selection or the strategy to see rows here.'
            }
          />
        ) : (
          buckets[tab].map((change) => (
            <CountryRow key={change.regionCode} change={change} selected readOnly onToggle={() => {}} />
          ))
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-ink-200 bg-white px-3 py-2.5">
        {buckets.blocked.length > 0 && (
          <p className="rounded-md bg-fall-50 px-2 py-1.5 text-[11.5px] text-ink-700">
            {buckets.blocked.length} blocked{' '}
            {buckets.blocked.length === 1 ? 'country is' : 'countries are'} excluded from this
            write. Everything else still applies.
          </p>
        )}

        <Toggle
          checked={dryRun}
          onChange={setDryRun}
          label="Dry run"
          description="Record the operation in history without sending anything to Google Play."
        />

        {needsTypedConfirmation && !dryRun && (
          <label className="flex items-center gap-2 rounded-md border border-warn-500/30 bg-warn-50 px-2 py-1.5">
            <span className="text-[11.5px] text-ink-700">
              This changes {writable.length} countries. Type{' '}
              <span className="font-mono font-semibold">{writable.length}</span> to confirm.
            </span>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="h-6 w-14 rounded border border-ink-300 bg-white px-1.5 text-center text-[12px] tabular focus:border-accent-500 focus:outline-none"
              inputMode="numeric"
              aria-label="Type the number of countries to confirm"
            />
          </label>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setScreen('pricing')}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="primary"
            disabled={!writable.length || !confirmed}
            onClick={() => void apply()}
          >
            {dryRun
              ? `Simulate ${writable.length}`
              : `Apply to ${writable.length} ${writable.length === 1 ? 'country' : 'countries'}`}
          </Button>
        </div>

        {!dryRun && changeSet.product.kind === 'subscription' && (
          <p className="text-[11px] leading-relaxed text-ink-400">
            New prices apply to new subscribers. Existing subscribers keep their current price until
            you run a price change in Play Console, which has its own notice and consent rules.
          </p>
        )}
      </div>
    </div>
  );
}

function ConversionLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-white px-8 text-center">
      <Badge tone="info">Fetching Google’s conversion rates</Badge>
      <p className="max-w-[32ch] text-[12.5px] text-ink-500">
        Pinto is asking Google Play for the exact currency conversion, so the prices you review are
        the prices that get written — and re-applying changes nothing.
      </p>
    </div>
  );
}

function ApplyProgressView() {
  const progress = useStore((state) => state.progress);
  if (!progress) return null;

  const PHASES = ['preparing', 'writing', 'isolating', 'verifying', 'done'] as const;
  const index = PHASES.indexOf(progress.phase);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-white px-8">
      <div className="w-full max-w-[300px] space-y-3">
        <ProgressBar value={progress.completed} total={Math.max(progress.total, 1)} />
        <div className="text-center">
          <p className="text-[13px] font-medium text-ink-900">{progress.message}</p>
          {progress.total > 0 && (
            <p className="text-[11.5px] text-ink-500 tabular">
              {progress.completed} of {progress.total}
            </p>
          )}
        </div>
        <ol className="flex flex-col gap-1">
          {PHASES.slice(0, 4).map((phase, position) => (
            <li
              key={phase}
              className={cx(
                'flex items-center gap-2 text-[11.5px]',
                position < index
                  ? 'text-ink-400'
                  : position === index
                    ? 'text-ink-900'
                    : 'text-ink-300',
              )}
            >
              <span>{position < index ? '✓' : position === index ? '•' : '·'}</span>
              <span className="capitalize">{phase}</span>
            </li>
          ))}
        </ol>
      </div>
      <Badge tone="neutral">Leave this panel open until it finishes</Badge>
    </div>
  );
}
