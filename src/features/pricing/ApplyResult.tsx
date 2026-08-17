import { useStore } from '@/app/store';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Feedback';
import { countryOrPlaceholder } from '@/domain/regions/countries';
import { download, exportFailuresCsv } from '@/lib/csv';

/**
 * What actually happened. Success, partial success and failure all land here,
 * and a partial result names every country that did not make it along with
 * what Google Play said about it.
 */
export function ApplyResult() {
  const { lastOperation, setScreen, setSelection, apply, revert } = useStore();
  if (!lastOperation) return null;

  const { status, message, failures, regionsAffected } = lastOperation;
  const tone = status === 'succeeded' ? 'rise' : status === 'failed' ? 'fall' : 'warn';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-ink-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>
            {status === 'dry-run' ? 'dry run' : status === 'succeeded' ? 'done' : status}
          </Badge>
          <span className="text-[11.5px] text-ink-400">{lastOperation.strategyLabel}</span>
        </div>
        <h2 className="text-[15px] leading-snug font-semibold tracking-[-0.015em] text-ink-900">
          {message}
        </h2>
        {status !== 'dry-run' && (
          <p className="text-[12px] text-ink-500">
            {regionsAffected} {regionsAffected === 1 ? 'country' : 'countries'} confirmed by reading
            the prices back from Google Play.
          </p>
        )}
      </div>

      {failures.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <div className="flex items-center justify-between px-3 py-2 text-[11.5px] text-ink-500">
            <span>Countries that need attention</span>
            <button
              type="button"
              className="text-accent-700 hover:underline"
              onClick={() =>
                download(`pinto-failures-${lastOperation.id.slice(0, 8)}.csv`, exportFailuresCsv(lastOperation))
              }
            >
              Export
            </button>
          </div>
          {failures.map((failure) => (
            <div key={failure.regionCode} className="border-t border-ink-100 px-3 py-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[12.5px] text-ink-900">
                  {countryOrPlaceholder(failure.regionCode).name}
                </span>
                <span className="font-mono text-[10px] text-ink-400">{failure.regionCode}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{failure.reason}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex shrink-0 flex-wrap items-center gap-2 border-t border-ink-200 bg-white px-3 py-2.5">
        {failures.length > 0 && (
          <Button
            size="sm"
            onClick={() => {
              setSelection(failures.map((failure) => failure.regionCode));
              useStore.setState({ lastOperation: null });
              setScreen('pricing');
            }}
          >
            Select failed only
          </Button>
        )}
        {failures.length > 0 && (
          <Button
            size="sm"
            onClick={() => {
              setSelection(failures.map((failure) => failure.regionCode));
              useStore.setState({ lastOperation: null });
              void apply();
            }}
          >
            Retry failed
          </Button>
        )}
        {status !== 'dry-run' && lastOperation.snapshot.length > 0 && (
          <Button size="sm" variant="danger" onClick={() => void revert(lastOperation.id)}>
            Undo this change
          </Button>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            useStore.setState({ lastOperation: null });
            setScreen('pricing');
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
