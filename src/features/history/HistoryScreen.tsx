import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { failureText, operationSummary } from '@/i18n/describe';
import type { OperationRecord, OperationStatus } from '@/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  Disclosure,
  EmptyState,
  IconButton,
  ScreenHeader,
  TableSkeleton,
  toast,
  type IconName,
  type Tone,
} from '@/ui';
import { RestoreDialog } from './RestoreDialog';

/** Must match MAX_HISTORY in services/storage.ts. */
const MAX_HISTORY = 50;

const STATUS: Record<OperationStatus, { tone: Tone; icon: IconName }> = {
  succeeded: { tone: 'success', icon: 'success' },
  partial: { tone: 'warn', icon: 'warning' },
  unverified: { tone: 'warn', icon: 'warning' },
  failed: { tone: 'danger', icon: 'error' },
  'dry-run': { tone: 'neutral', icon: 'flask' },
};

/** Only a write that reached Google has prices worth putting back. */
const RESTORABLE: readonly OperationStatus[] = ['succeeded', 'partial', 'unverified'];

function canRestore(record: OperationRecord): boolean {
  return RESTORABLE.includes(record.status) && record.snapshot.length > 0 && !record.revertedBy;
}

/**
 * Every operation, newest first, grouped by day. History is where a change is
 * undone, so each record says what was written where, and restoring goes
 * through a dialog that shows the prices it will put back.
 */
export function HistoryScreen() {
  const t = useT();
  const history = useStore((state) => state.history);
  const error = useStore((state) => state.error);
  const loadHistory = useStore((state) => state.loadHistory);
  const clearHistory = useStore((state) => state.clearHistory);
  const setView = useStore((state) => state.setView);
  const [loaded, setLoaded] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [restoring, setRestoring] = useState<OperationRecord | null>(null);

  const load = () => {
    setLoaded(false);
    void loadHistory().finally(() => setLoaded(true));
  };
  useEffect(load, [loadHistory]);

  const days = groupByDay(history);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        title={t('workspace.header.history')}
        onBack={() => setView('workspace')}
        backLabel={t('action.back')}
        actions={
          history.length > 0 && (
            <IconButton icon="trash" label={t('history.clear.action')} onClick={() => setClearing(true)} />
          )
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loaded && !history.length ? (
          <TableSkeleton rows={6} label={t('history.loading')} />
        ) : !history.length ? (
          error ? (
            // The banner above says what failed; this only offers the way out.
            <div className="flex justify-center p-6">
              <Button icon="refresh" onClick={load}>
                {t('action.retry')}
              </Button>
            </div>
          ) : (
            <EmptyState icon="history" title={t('history.empty.title')} body={t('history.empty.body')} />
          )
        ) : (
          <>
            {days.map((day) => (
              <section key={day.key} aria-labelledby={`day-${day.key}`} className="bg-white">
                <h2
                  id={`day-${day.key}`}
                  className="sticky top-0 z-10 border-b border-ink-200 bg-ink-50 px-4 py-1.5 text-meta font-semibold text-ink-600"
                >
                  <DayName timestamp={day.timestamp} />
                </h2>
                <ul className="divide-y divide-ink-100 border-b border-ink-200">
                  {day.records.map((record) => (
                    <li key={record.id}>
                      <RecordItem record={record} onRestore={() => setRestoring(record)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="px-4 py-3 text-small text-ink-500">{t('history.note', { max: MAX_HISTORY })}</p>
          </>
        )}
      </div>

      <RestoreDialog record={restoring} onClose={() => setRestoring(null)} />

      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={() =>
          void clearHistory().then(() => {
            if (!useStore.getState().history.length) toast({ key: 'history.cleared' }, 'success');
          })
        }
        tone="danger"
        title={t('history.clear.title')}
        description={t('history.clear.body', { count: history.length })}
        confirmLabel={t('history.clear.confirm')}
      />
    </div>
  );
}

function RecordItem({ record, onRestore }: { record: OperationRecord; onRestore: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const progress = useStore((state) => state.progress);
  const status = STATUS[record.status];
  const ids = record.kind === 'inapp' ? [record.productId] : [record.productId, record.basePlanId];
  // Records from before 1.1 did not store the request size.
  const requested = record.requested ?? (record.snapshot.length || record.regionsAffected);
  const counts = { affected: record.regionsAffected, count: requested };

  return (
    <article className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={status.tone} icon={status.icon}>
          {t(`operation.status.${record.status}`)}
        </Badge>
        {record.revertedBy && (
          <Badge tone="neutral" icon="undo">
            {t('operation.reverted')}
          </Badge>
        )}
        <time
          dateTime={new Date(record.timestamp).toISOString()}
          title={fmt.dateTime(record.timestamp)}
          className="ml-auto text-meta text-ink-500 tabular"
        >
          {/* The day is the section heading; within it, the time — or "2 hours ago" today. */}
          {new Date(record.timestamp).toDateString() === new Date().toDateString()
            ? fmt.relative(record.timestamp)
            : fmt.time(record.timestamp)}
        </time>
      </div>

      <p className="text-body font-medium text-ink-900">{operationSummary(t, fmt, record)}</p>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-small text-ink-700" title={ids.join(' · ')}>
          {ids.join(' · ')}
        </span>
        <span className="truncate font-mono text-meta text-ink-500" title={record.packageName}>
          {record.packageName}
        </span>
      </div>
      <p className="text-small text-ink-600 tabular">
        {record.status === 'dry-run'
          ? t('history.record.simulated', counts)
          : t('history.record.countries', counts)}
      </p>

      {record.failures.length > 0 && (
        <Disclosure title={t('history.record.failures', { count: record.failures.length })}>
          <ul className="flex flex-col gap-2">
            {record.failures.map((failure) => {
              const text = failureText(t, fmt, failure);
              return (
                <li key={failure.regionCode} className="flex flex-col text-small">
                  <span className="font-medium text-ink-900">{fmt.region(failure.regionCode)}</span>
                  <span className="text-ink-700">{text.title}</span>
                  {text.hint && <span className="text-ink-500">{text.hint}</span>}
                </li>
              );
            })}
          </ul>
        </Disclosure>
      )}

      {canRestore(record) && (
        <div>
          <Button size="sm" icon="undo" disabled={!!progress} onClick={onRestore}>
            {record.revertOf ? t('history.restore.undoRestore') : t('history.restore.action')}
          </Button>
        </div>
      )}
    </article>
  );
}

function DayName({ timestamp }: { timestamp: number }) {
  const t = useT();
  const fmt = useFormat();
  const day = startOfDay(timestamp);
  const today = startOfDay(Date.now());
  if (day === today) return <>{t('history.day.today')}</>;
  if (day === startOfDay(today - 1)) return <>{t('history.day.yesterday')}</>;
  return <>{fmt.date(timestamp)}</>;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function groupByDay(history: OperationRecord[]) {
  const days: { key: number; timestamp: number; records: OperationRecord[] }[] = [];
  for (const record of [...history].sort((a, b) => b.timestamp - a.timestamp)) {
    const key = startOfDay(record.timestamp);
    const last = days[days.length - 1];
    if (last?.key === key) last.records.push(record);
    else days.push({ key, timestamp: record.timestamp, records: [record] });
  }
  return days;
}
