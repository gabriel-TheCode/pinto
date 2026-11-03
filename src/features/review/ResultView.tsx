import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { failureText, operationSummary, productName } from '@/i18n/describe';
import { download } from '@/lib/csv';
import { cx } from '@/lib/cx';
import type { T } from '@/i18n';
import type { ProductSummary } from '@/services/messages';
import type { OperationRecord, OperationStatus, RegionCode } from '@/types';
import { Button, ConfirmDialog, Footer, Icon, ScreenTitle, Section, announce, type IconName } from '@/ui';
import { TYPED_CONFIRM_AT, csvFilename, failuresCsv } from './model';

const LOOK: Record<OperationStatus, { icon: IconName; box: string }> = {
  succeeded: { icon: 'success', box: 'bg-success-50 text-success-500' },
  partial: { icon: 'warning', box: 'bg-warn-50 text-warn-500' },
  unverified: { icon: 'warning', box: 'bg-warn-50 text-warn-500' },
  failed: { icon: 'error', box: 'bg-danger-50 text-danger-500' },
  'dry-run': { icon: 'flask', box: 'bg-ink-100 text-ink-600' },
};

/**
 * What actually happened, never more. "Confirmed" is said only for prices
 * read back from Google Play; an unconfirmed write and a simulation say what
 * they are. Every failed country is named with the reason and the next step.
 */
export function ResultView() {
  const t = useT();
  const fmt = useFormat();
  const op = useStore((state) => state.lastOperation);
  const products = useStore((state) => state.products);
  const reviewFailed = useStore((state) => state.reviewFailed);
  const dismissResult = useStore((state) => state.dismissResult);
  const setStep = useStore((state) => state.setStep);
  const revert = useStore((state) => state.revert);
  const [dialog, setDialog] = useState<'undo' | 'retry' | null>(null);

  const text = op ? outcome(t, op) : null;
  useEffect(() => {
    if (text) announce(`${text.title}. ${text.body}`);
    // Once per operation.
  }, [op?.id]);

  if (!op || !text) return null;

  const look = LOOK[op.status];
  const name = productName(t, productOf(products, op));
  const failed = op.failures.map((failure) => failure.regionCode);
  const failedSet = new Set(failed);
  const before = new Map(op.snapshot.map((price) => [price.regionCode, price]));
  const dryRun = op.status === 'dry-run';
  const canUndo =
    (op.status === 'succeeded' || op.status === 'partial' || op.status === 'unverified') &&
    op.snapshot.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 border-b border-ink-200 bg-white px-4 py-5">
          <div className="flex items-start gap-3">
            <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', look.box)}>
              <Icon name={look.icon} size={18} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <ScreenTitle>{text.title}</ScreenTitle>
              <p className="text-body text-ink-700">{text.body}</p>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 pl-12 text-small">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 truncate font-medium text-ink-800" title={name}>
                {name}
              </span>
              <span className="min-w-0 truncate font-mono text-meta text-ink-500" title={op.packageName}>
                <span className="sr-only">{t('workspace.header.packageLabel')} </span>
                {op.packageName}
              </span>
            </p>
            <p className="text-ink-600">{operationSummary(t, fmt, op)}</p>
            {!dryRun && op.status !== 'failed' && (
              <p className="mt-1 text-ink-500">{t('review.result.reloadHint')}</p>
            )}
          </div>
        </div>

        {op.failures.length > 0 && (
          <Section
            title={t('review.result.failures', { count: op.failures.length })}
            actions={
              <Button
                size="sm"
                variant="ghost"
                icon="download"
                onClick={() => download(csvFilename(['failures', op.productId]), failuresCsv(t, fmt, op))}
              >
                {t('action.exportCsv')}
              </Button>
            }
          >
            <ul className="-mx-4 divide-y divide-ink-100 border-t border-ink-100">
              {op.failures.map((failure) => {
                const reason = failureText(t, fmt, failure);
                const technical = [failure.code, failure.detail].filter(Boolean).join('\n');
                return (
                  <li key={failure.regionCode} className="flex flex-col gap-0.5 px-4 py-2.5">
                    <p className="flex items-baseline gap-2">
                      <span className="min-w-0 truncate text-body font-medium text-ink-900">
                        {fmt.region(failure.regionCode)}
                      </span>
                      <span className="shrink-0 font-mono text-meta text-ink-500">{failure.regionCode}</span>
                    </p>
                    <p className="text-small text-ink-700">{reason.title}</p>
                    {reason.hint && <p className="text-small text-ink-500">{reason.hint}</p>}
                    {technical && (
                      <details className="text-small text-ink-600">
                        <summary className="cursor-pointer select-none">{t('error.details')}</summary>
                        <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-ink-50 p-2 font-mono text-meta whitespace-pre-wrap text-ink-700">
                          {technical}
                        </pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
      </div>

      <Footer>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {failed.length > 0 && (
            <Button
              className="mr-auto"
              icon={op.revertOf ? 'refresh' : undefined}
              onClick={() => (op.revertOf ? setDialog('retry') : reviewFailed())}
            >
              {op.revertOf ? t('review.result.retryRestore') : t('review.result.reviewFailed')}
            </Button>
          )}
          {canUndo && (
            <Button
              variant="danger"
              icon="undo"
              className={cx(!failed.length && 'mr-auto')}
              onClick={() => setDialog('undo')}
            >
              {t('review.result.undo')}
            </Button>
          )}
          {dryRun ? (
            <>
              <Button className="mr-auto" onClick={dismissResult}>
                {t('action.done')}
              </Button>
              <Button variant="primary" icon="play" onClick={() => setStep('review')}>
                {t('review.result.applyForReal')}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={dismissResult}>
              {t('action.done')}
            </Button>
          )}
        </div>
      </Footer>

      <RestoreDialog
        open={dialog === 'undo'}
        onClose={() => setDialog(null)}
        // A country that failed kept its old price: restoring it changes nothing.
        rows={op.snapshot.map((price) => ({
          region: price.regionCode,
          currency: price.currency,
          from: failedSet.has(price.regionCode) ? price.micros : op.written?.[price.regionCode],
          to: price.micros,
        }))}
        title={t('review.result.undo.title', { count: op.snapshot.length })}
        description={t('review.result.undo.body')}
        onConfirm={() => void revert(op.id)}
      />
      {op.revertOf && (
        <RestoreDialog
          open={dialog === 'retry'}
          onClose={() => setDialog(null)}
          // This restore's snapshot is where those countries still are; what it
          // wrote is where they should go back to.
          rows={failed.map((region) => ({
            region,
            currency: before.get(region)?.currency ?? '',
            from: before.get(region)?.micros,
            to: op.written?.[region],
          }))}
          title={t('review.result.retry.title', { count: failed.length })}
          description={t('review.result.retry.body')}
          onConfirm={() => void revert(op.revertOf!, failed)}
        />
      )}
    </div>
  );
}

interface RestoreRow {
  region: RegionCode;
  currency: string;
  from: number | undefined;
  to: number | undefined;
}

/** A restore, confirmed with the prices it puts back, country by country. */
function RestoreDialog({
  open,
  onClose,
  onConfirm,
  rows,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  rows: RestoreRow[];
  title: string;
  description: string;
}) {
  const t = useT();
  const fmt = useFormat();
  const count = rows.length;

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      tone="danger"
      title={title}
      description={description}
      confirmLabel={t('review.result.restoreConfirm', { count })}
      typeToConfirm={count >= TYPED_CONFIRM_AT ? String(count) : undefined}
      typePrompt={t('review.confirm.type', { number: String(count) })}
    >
      <ul className="flex max-h-48 flex-col divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-200">
        {rows.map((row) => {
          const current = fmt.money(row.from, row.currency);
          const previous = fmt.money(row.to, row.currency);
          return (
            <li key={row.region} className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-small">
              <span className="min-w-0 flex-1 truncate text-ink-900">{fmt.region(row.region)}</span>
              <span className="sr-only">{t('review.result.restoreRow', { current, previous })}</span>
              <span aria-hidden="true" className="flex items-center gap-1.5 tabular">
                <span className="text-ink-500">{current}</span>
                <Icon name="arrowRight" size={12} className="text-ink-500" />
                <span className="font-medium text-ink-900">{previous}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </ConfirmDialog>
  );
}

/** The listed product carries its details ("1 month"); a record only has ids. */
function productOf(
  products: ProductSummary[],
  op: OperationRecord,
): Pick<ProductSummary, 'kind' | 'productId' | 'basePlanId' | 'details'> {
  return (
    products.find(
      (p) => p.kind === op.kind && p.productId === op.productId && p.basePlanId === op.basePlanId,
    ) ?? op
  );
}

function outcome(t: T, op: OperationRecord): { title: string; body: string } {
  const ok = op.regionsAffected;
  const failures = op.failures.length;
  switch (op.status) {
    case 'succeeded':
      return {
        title: op.revertOf ? t('review.result.restored.title') : t('review.result.succeeded.title'),
        body: t('review.result.succeeded.body', { count: ok }),
      };
    case 'partial':
      return {
        title: t('review.result.partial.title', { ok, count: op.requested ?? ok + failures }),
        body: t('review.result.partial.body', { count: failures }),
      };
    case 'failed':
      return { title: t('review.result.failed.title'), body: t('review.result.failed.body') };
    case 'unverified':
      return {
        // regionsAffected is what Google accepted; refused ones are listed below.
        title: t('review.result.unverified.title', { count: ok }),
        body: t('review.result.unverified.body'),
      };
    case 'dry-run':
      return { title: t('review.result.dryRun.title'), body: t('review.result.dryRun.body', { count: ok }) };
  }
}
