import { useEffect, useState } from 'react';
import { productKeyOf, useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import type { OperationRecord } from '@/types';
import { cx } from '@/lib/cx';
import { Badge, Button, Callout, Checkbox, Dialog, TableSkeleton, TextField } from '@/ui';
import { compareWithLive, isSameProduct } from './restore';
import { TYPED_CONFIRM_AT } from '@/features/review/model';

/** Same threshold as a forward write: a large restore is typed, not clicked. */

/**
 * "Put these prices back", with what that means country by country. Kept
 * mounted so the native dialog can return focus to the button that opened it.
 */
export function RestoreDialog({ record, onClose }: { record: OperationRecord | null; onClose: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const pricing = useStore((state) => state.pricing);
  const loadingPricing = useStore((state) => state.loadingPricing);
  const context = useStore((state) => state.context);
  const products = useStore((state) => state.products);
  const selectProduct = useStore((state) => state.selectProduct);
  const reloadPricing = useStore((state) => state.reloadPricing);
  const revert = useStore((state) => state.revert);
  const [includeDrifted, setIncludeDrifted] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    setIncludeDrifted(false);
    setTyped('');
    // Compare with the prices as they are now, not as they were when the
    // product was opened: Play Console may have changed them since.
    if (record && isSameProduct(record, useStore.getState().pricing)) void reloadPricing({ keepSelection: true });
  }, [record?.id]);

  if (!record) return <Dialog open={false} onClose={onClose} title={t('history.restore.title')} />;

  const ids = record.kind === 'inapp' ? [record.productId] : [record.productId, record.basePlanId];
  const product = ids.join(' · ');
  const same = isSameProduct(record, pricing);
  const rows = same ? compareWithLive(record, pricing.prices, fmt) : [];
  const drifted = rows.filter((row) => row.drifted).length;
  const included = rows.filter((row) => includeDrifted || !row.drifted);
  const count = same ? included.length : record.snapshot.length;
  // Without a list, the worker restores the whole snapshot and retires the record.
  const regions = same && drifted > 0 && !includeDrifted ? included.map((row) => row.region) : undefined;
  const otherApp = record.packageName !== context?.packageName;
  const openable =
    !otherApp && products.some((summary) => productKeyOf(summary) === productKeyOf(record));
  const needsTyping = count >= TYPED_CONFIRM_AT;
  const ready = !loadingPricing && count > 0 && (!needsTyping || typed.trim() === String(count));

  return (
    <Dialog
      open
      onClose={onClose}
      title={record.revertOf ? t('history.restore.undoRestore') : t('history.restore.title')}
      description={t('history.restore.description', { product, when: fmt.dateTime(record.timestamp) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="primary"
            icon="undo"
            disabled={!ready}
            onClick={() => {
              onClose();
              void revert(record.id, regions);
            }}
          >
            {t('history.restore.confirm', { count })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {otherApp && (
          <Callout tone="warn" title={t('history.restore.otherApp.title', { package: record.packageName })}>
            {t('history.restore.otherApp.body')}
          </Callout>
        )}

        {loadingPricing && <TableSkeleton rows={4} label={t('workspace.loadingPrices')} />}

        {!same && !loadingPricing && (
          <Callout
            tone="info"
            title={t('history.restore.otherProduct.title', { count: record.snapshot.length })}
            action={
              openable && (
                <Button size="sm" onClick={() => void selectProduct(productKeyOf(record))}>
                  {t('history.restore.otherProduct.open')}
                </Button>
              )
            }
          >
            {t('history.restore.otherProduct.body')}
          </Callout>
        )}

        {same && !record.written && (
          <Callout tone="neutral">{t('history.restore.noCheck')}</Callout>
        )}

        {!loadingPricing && drifted > 0 && (
          <Callout tone="warn" title={t('history.restore.drift.title', { count: drifted })}>
            <p>{t('history.restore.drift.body')}</p>
            <Checkbox
              className="mt-2"
              checked={includeDrifted}
              onChange={setIncludeDrifted}
              label={t('history.restore.drift.include', { count: drifted })}
            />
          </Callout>
        )}

        {same && !loadingPricing && (
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-ink-200 text-meta text-ink-500">
                <th scope="col" className="py-1 pr-2 text-left font-medium">
                  {t('history.restore.col.country')}
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  {t('history.restore.col.now')}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t('history.restore.col.restored')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row) => {
                const skipped = row.drifted && !includeDrifted;
                return (
                  <tr key={row.region} className={skipped ? 'text-ink-500' : 'text-ink-900'}>
                    <th scope="row" className="py-1.5 pr-2 text-left align-top font-normal">
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="break-words">{row.name}</span>
                        {row.drifted && (
                          <Badge tone="warn" icon="warning">
                            {skipped ? t('history.restore.row.skipped') : t('history.restore.row.overwritten')}
                          </Badge>
                        )}
                      </span>
                    </th>
                    <td className="py-1.5 pr-2 text-right align-top whitespace-nowrap tabular">
                      {fmt.money(row.current?.micros, row.current?.currency ?? row.target.currency)}
                    </td>
                    <td
                      className={cx(
                        'py-1.5 text-right align-top whitespace-nowrap tabular',
                        skipped ? 'line-through' : 'font-medium',
                      )}
                    >
                      {fmt.money(row.target.micros, row.target.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {same && !loadingPricing && count === 0 && <Callout tone="neutral">{t('history.restore.nothing')}</Callout>}

        {needsTyping && count > 0 && (
          <TextField
            label={t('history.restore.typePrompt', { count })}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="max-w-40"
          />
        )}
      </div>
    </Dialog>
  );
}
