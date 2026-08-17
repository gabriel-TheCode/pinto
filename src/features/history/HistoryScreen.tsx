import { useEffect } from 'react';
import { useStore } from '@/app/store';
import { Button } from '@/components/Button';
import { Badge, EmptyState } from '@/components/Feedback';
import { send } from '@/services/client';

const FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function HistoryScreen() {
  const { history, loadHistory, revert, progress } = useStore();

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (!history.length) {
    return (
      <EmptyState
        title="No operations yet"
        body="Every bulk change you apply is recorded here with the prices as they were, so you can always put them back."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {history.map((record) => (
          <article key={record.id} className="border-b border-ink-100 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  record.status === 'succeeded'
                    ? 'rise'
                    : record.status === 'failed'
                      ? 'fall'
                      : record.status === 'dry-run'
                        ? 'neutral'
                        : 'warn'
                }
              >
                {record.status === 'dry-run' ? 'dry run' : record.status}
              </Badge>
              <span className="text-[11px] text-ink-400">{FORMATTER.format(record.timestamp)}</span>
              {record.revertedBy && <Badge tone="neutral">reverted</Badge>}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-900">{record.message}</p>
            <p className="text-[11.5px] text-ink-500">
              {record.productId} · {record.basePlanId} · {record.strategyLabel}
            </p>
            {record.snapshot.length > 0 && !record.revertedBy && record.status !== 'dry-run' && (
              <div className="mt-1.5">
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!!progress}
                  onClick={() => void revert(record.id)}
                >
                  Restore these {record.snapshot.length} prices
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-ink-200 bg-white px-3 py-2">
        <span className="text-[11.5px] text-ink-400">
          Stored locally on this machine · {history.length} of the last 50 operations
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await send({ type: 'history/clear' });
            await loadHistory();
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
