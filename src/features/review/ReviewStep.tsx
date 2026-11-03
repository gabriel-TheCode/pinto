import { useId, useLayoutEffect, useMemo, useState } from 'react';
import { currencyLookup, useChangeSet, useStore } from '@/app/store';
import { conversionKeyOf } from '@/app/store/selectors';
import { useFormat, useT } from '@/i18n/react';
import { issueText, productName, strategySummary } from '@/i18n/describe';
import { download } from '@/lib/csv';
import { cx } from '@/lib/cx';
import type { ChangeIssue, PriceChange } from '@/types';
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Footer,
  Hint,
  Icon,
  IS_MAC,
  MOD_LABEL,
  ScreenTitle,
  Segmented,
  Spinner,
  useHotkey,
} from '@/ui';
import { ChangeSummary } from '@/features/workspace/ChangeSummary';
import {
  FILTERS,
  TYPED_CONFIRM_AT,
  bucketsOf,
  changesCsv,
  csvFilename,
  deltaRange,
  type Filter,
} from './model';

/**
 * Step 3. Nothing reaches Google Play without passing through here, and the
 * rows shown are the exact values written: the store's apply reads the same
 * derived change set. Problems come first — blocked, then large changes —
 * and large changes must be acknowledged before Apply unlocks.
 */
export function ReviewStep() {
  const t = useT();
  const fmt = useFormat();
  const hintId = useId();
  const changeSet = useChangeSet();
  const pricing = useStore((state) => state.pricing);
  const config = useStore((state) => state.config);
  const loading = useStore((state) => state.conversionLoading);
  // The strategy converts, but the table loaded is not for it: implied rates.
  const estimated = useStore((state) => {
    const key = conversionKeyOf(state);
    return (
      key != null && !state.conversionLoading && (state.conversionKey !== key || !state.conversionTable)
    );
  });
  const setStep = useStore((state) => state.setStep);
  const apply = useStore((state) => state.apply);
  const ensureConversion = useStore((state) => state.ensureConversion);

  const [chosenFilter, setFilter] = useState<Filter | null>(null);
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Before paint, so "rates could not be loaded" never flashes on arrival.
  useLayoutEffect(() => {
    if (!useStore.getState().conversionLoading) void useStore.getState().ensureConversion();
  }, []);

  const buckets = useMemo(() => {
    const raw = changeSet ? bucketsOf(changeSet) : null;
    if (!raw) return null;
    const byName = (a: PriceChange, b: PriceChange) =>
      fmt.compare(fmt.region(a.regionCode), fmt.region(b.regionCode));
    return Object.fromEntries(FILTERS.map((id) => [id, [...raw[id]].sort(byName)])) as Record<
      Filter,
      PriceChange[]
    >;
  }, [changeSet, fmt]);

  const count = buckets?.changing.length ?? 0;
  const toCheck = buckets?.check ?? [];
  // The acknowledgement covers these exact prices; any other set asks again.
  const checkKey = toCheck.map((row) => `${row.regionCode}:${row.newMicros}`).join();
  const checked = toCheck.length === 0 || checkedKey === checkKey;
  const canSimulate = !loading && count > 0;
  const canApply = canSimulate && checked;

  const requestApply = () => {
    if (!canApply) return;
    if (count >= TYPED_CONFIRM_AT) setConfirming(true);
    else void apply('apply');
  };
  useHotkey('Enter', requestApply, { mod: true });

  if (!changeSet || !pricing || !buckets) return null;

  const filter = chosenFilter ?? (buckets.blocked.length ? 'blocked' : 'changing');
  const range = deltaRange(buckets.changing);
  const product = productName(t, pricing);
  const rows = buckets[filter];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 border-b border-ink-200 bg-white px-4 pt-4 pb-3">
          <div className="flex items-start gap-2">
            <ScreenTitle className="min-w-0 flex-1">{t('review.title')}</ScreenTitle>
            <Button
              size="sm"
              variant="ghost"
              icon="download"
              disabled={loading}
              onClick={() =>
                download(csvFilename([pricing.productId]), changesCsv(t, fmt, changeSet))
              }
            >
              {t('action.exportCsv')}
            </Button>
          </div>
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-small">
            <span className="min-w-0 truncate font-medium text-ink-800" title={product}>
              {product}
            </span>
            <span className="min-w-0 truncate font-mono text-meta text-ink-500" title={pricing.packageName}>
              <span className="sr-only">{t('workspace.header.packageLabel')} </span>
              {pricing.packageName}
            </span>
          </p>
          <p className="text-small text-ink-600">
            {strategySummary(t, fmt, config, currencyLookup({ pricing }))}
          </p>
        </div>

        {loading ? (
          <div role="status" className="flex flex-col items-center gap-2 px-8 py-12 text-center">
            <Spinner className="size-5 text-ink-500" />
            <p className="text-body font-medium text-ink-900">{t('review.rates.loading.title')}</p>
            <p className="max-w-[36ch] text-small text-ink-500">{t('review.rates.loading.body')}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-ink-200 bg-white px-4 py-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 min-[400px]:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                <Stat label={t('review.stat.changing')} value={fmt.number(count)} />
                <Stat
                  label={t('review.stat.range')}
                  value={
                    !range || fmt.delta(range.min) === fmt.delta(range.max)
                      ? fmt.delta(range?.min)
                      : t('review.stat.rangeValue', { min: fmt.delta(range.min), max: fmt.delta(range.max) })
                  }
                />
                <Stat
                  label={t('review.stat.blocked')}
                  value={fmt.number(buckets.blocked.length)}
                  tone={buckets.blocked.length ? 'danger' : undefined}
                />
                <Stat label={t('review.stat.unchanged')} value={fmt.number(buckets.unchanged.length)} />
              </dl>

              {buckets.blocked.length > 0 && (
                <Callout
                  tone="danger"
                  title={t('review.blocked.title', { count: buckets.blocked.length })}
                  action={
                    filter !== 'blocked' && (
                      <Button size="sm" onClick={() => setFilter('blocked')}>
                        {t('review.blocked.show')}
                      </Button>
                    )
                  }
                >
                  {t('review.blocked.body')}
                </Callout>
              )}

              {estimated && (
                <Callout
                  tone="warn"
                  title={t('review.rates.fallback.title')}
                  action={
                    <Button size="sm" icon="refresh" onClick={() => void ensureConversion()}>
                      {t('action.retry')}
                    </Button>
                  }
                >
                  {t('review.rates.fallback.body')}
                </Callout>
              )}

              {toCheck.length > 0 && (
                <Callout
                  tone="warn"
                  title={t('review.check.title', { count: toCheck.length })}
                  action={
                    filter !== 'check' && (
                      <Button size="sm" onClick={() => setFilter('check')}>
                        {t('review.check.show')}
                      </Button>
                    )
                  }
                >
                  {t('review.check.body')}
                </Callout>
              )}

              {/* Always on screen before Apply, but folded to its headline so the
                  rows it is about stay in view; the explanation is one click away. */}
              {pricing.kind === 'subscription' && count > 0 && (
                <details className="group rounded-lg border border-cyan-500/25 bg-cyan-50 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 text-body font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                    <Icon name="info" className="shrink-0 text-cyan-700" />
                    <span className="min-w-0 flex-1">{t('review.subscription.title')}</span>
                    <Icon name="chevronDown" size={14} className="shrink-0 text-ink-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-1.5 pl-6.5 text-small text-ink-700">{t('review.subscription.body')}</p>
                </details>
              )}

              <Segmented
                label={t('review.filter.label')}
                value={filter}
                onChange={setFilter}
                narrowColumns={2}
                hideLabel
                options={FILTERS.map((id) => ({
                  value: id,
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      {t(`review.filter.${id}`)}
                      <span className="tabular text-ink-500">{fmt.number(buckets[id].length)}</span>
                    </span>
                  ),
                }))}
              />
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={filter === 'blocked' || filter === 'check' ? 'success' : 'info'}
                title={t(`review.empty.${filter}.title`)}
                body={t(`review.empty.${filter}.body`)}
              />
            ) : (
              <ul aria-label={t(`review.filter.${filter}`)} className="divide-y divide-ink-100 bg-white">
                {rows.map((row) => (
                  <Row key={row.regionCode} row={row} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Footer>
        {toCheck.length > 0 && !loading && (
          <Checkbox
            checked={checked}
            onChange={(next) => setCheckedKey(next ? checkKey : null)}
            label={t('review.check.confirm', { count: toCheck.length })}
          />
        )}
        <ChangeSummary />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" icon="arrowLeft" className="mr-auto" onClick={() => setStep('markets')}>
            {t('action.back')}
          </Button>
          <Button
            icon="flask"
            disabled={!canSimulate}
            aria-describedby={hintId}
            onClick={() => void apply('simulate')}
          >
            {t('review.simulate')}
          </Button>
          <Button
            variant="primary"
            disabled={!canApply}
            loading={loading}
            shortcut={`${MOD_LABEL}↵`}
            aria-keyshortcuts={IS_MAC ? 'Meta+Enter' : 'Control+Enter'}
            onClick={requestApply}
          >
            {t('review.apply', { count })}
          </Button>
        </div>
        <Hint id={hintId}>{t('review.simulate.hint')}</Hint>
      </Footer>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void apply('apply')}
        title={t('review.confirm.title', { count })}
        description={t('review.confirm.body', { product, package: pricing.packageName })}
        confirmLabel={t('review.apply', { count })}
        typeToConfirm={String(count)}
        typePrompt={t('review.confirm.type', { number: String(count) })}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-meta text-ink-500">{label}</dt>
      <dd className={cx('text-title font-semibold tabular', tone === 'danger' ? 'text-danger-500' : 'text-ink-900')}>
        {value}
      </dd>
    </div>
  );
}

const ISSUE_STYLE: Record<ChangeIssue['level'], { icon: 'error' | 'warning' | 'info'; color: string }> = {
  error: { icon: 'error', color: 'text-danger-500' },
  warning: { icon: 'warning', color: 'text-warn-500' },
  info: { icon: 'info', color: 'text-ink-500' },
};

/** One country, read-only: what it costs now, what it will cost, and why. */
function Row({ row }: { row: PriceChange }) {
  const t = useT();
  const fmt = useFormat();
  const name = fmt.region(row.regionCode);
  const current = fmt.money(row.currentMicros, row.currency);
  const next = fmt.money(row.newMicros, row.currency);
  const kept = row.newMicros == null || row.status === 'unchanged';
  const tone = row.delta == null || row.delta === 0 ? 'neutral' : row.delta > 0 ? 'rise' : 'fall';
  // "Adjusted by the rounding rule" is true of nearly every row; it stays in the CSV.
  const issues = row.issues.filter((issue) => issue.code !== 'rounded');

  return (
    <li className="flex flex-col gap-1 px-4 py-2.5">
      {/* Prices wrap under the name when the panel is too narrow for both. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="flex min-w-0 flex-1 basis-32 items-baseline gap-2">
          <span className="min-w-0 truncate text-body text-ink-900" title={name}>
            {name}
          </span>
          <span className="shrink-0 font-mono text-meta text-ink-500">{row.regionCode}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-baseline gap-1.5 text-small tabular">
          <span className="sr-only">
            {kept ? t('review.row.kept', { current }) : t('review.row.price', { current, next })}
          </span>
          <span aria-hidden="true" className="flex items-center gap-1.5">
            <span className={cx('text-ink-500', !kept && 'line-through decoration-ink-300')}>{current}</span>
            {!kept && (
              <>
                <Icon name="arrowRight" size={12} className="self-center text-ink-500" />
                <span className="font-medium text-ink-900">{next}</span>
              </>
            )}
          </span>
          {!kept && <Badge tone={tone}>{fmt.delta(row.delta)}</Badge>}
        </span>
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {issues.map((issue, index) => {
            const style = ISSUE_STYLE[issue.level];
            return (
              <li key={index} className="flex items-start gap-1.5 text-small text-ink-600">
                <Icon name={style.icon} size={12} className={cx('mt-0.5', style.color)} />
                <span>{issueText(t, fmt, issue)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
