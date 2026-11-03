import { useId } from 'react';
import { productKeyOf, useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { errorText, productName } from '@/i18n/describe';
import type { ProductKind } from '@/types';
import { Badge, Button, Callout, Icon, IconButton } from '@/ui';

const KINDS: ProductKind[] = ['subscription', 'onetime', 'inapp'];

/**
 * Failures that say the same thing every time they happen. Closing one of
 * these is remembered; closing a passing failure (an outage, a network drop, a
 * bug) lasts for this panel only, so its next occurrence is reported again.
 */
const STABLE_CODES = new Set(['api/forbidden', 'api/not-found']);

/**
 * Which product is being priced: the context every other decision applies
 * to, so it sits above the steps and is never more than one control away.
 */
export function ProductBar({ dismissible = true }: { dismissible?: boolean }) {
  const t = useT();
  const fmt = useFormat();
  const id = useId();
  const products = useStore((state) => state.products);
  const unavailable = useStore((state) => state.unavailable);
  const productKey = useStore((state) => state.productKey);
  const pricing = useStore((state) => state.pricing);
  const selectProduct = useStore((state) => state.selectProduct);
  const loadProducts = useStore((state) => state.loadProducts);
  const packageName = useStore((state) => state.context?.packageName ?? '');
  const dismissed = useStore((state) => state.dismissedNotices);
  const dismissNotice = useStore((state) => state.dismissNotice);

  const current = products.find((product) => productKeyOf(product) === productKey);
  const oneTime = products.filter((product) => product.kind !== 'subscription');

  // A notice is closed for this app and this exact failure; another failure,
  // or the same one on another app, shows again.
  const unavailableId = `${packageName}:unavailable:${unavailable
    .map((entry) => `${entry.kind}=${entry.code}`)
    .sort()
    .join(',')}`;
  const noOneTimeId = `${packageName}:no-onetime`;
  const showUnavailable = unavailable.length > 0 && !(dismissible && dismissed.includes(unavailableId));
  const showNoOneTime =
    !unavailable.length &&
    products.length > 0 &&
    oneTime.length === 0 &&
    !dismissed.includes(noOneTimeId);
  const technical = unavailable
    .map((entry) => [entry.kind, entry.code, entry.detail].filter(Boolean).join(' · '))
    .join('\n');

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-ink-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="shrink-0 text-small font-medium text-ink-600">
          {t('workspace.product.label')}
        </label>
        {products.length > 1 ? (
          <div className="relative min-w-0 flex-1">
            <select
              id={id}
              value={productKey ?? ''}
              onChange={(event) => void selectProduct(event.target.value)}
              className="h-8 w-full cursor-pointer appearance-none rounded-lg border border-ink-200 bg-white pr-8 pl-2.5 text-body font-medium text-ink-900 hover:border-ink-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none"
            >
              <option value="" disabled>
                {t('workspace.product.choose')}
              </option>
              {KINDS.map((kind) => {
                const group = products.filter((product) => product.kind === kind);
                if (!group.length) return null;
                return (
                  <optgroup key={kind} label={t(`product.group.${kind}`)}>
                    {group.map((product) => (
                      <option key={productKeyOf(product)} value={productKeyOf(product)}>
                        {productName(t, product)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <Icon
              name="chevronDown"
              size={14}
              className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-500"
            />
          </div>
        ) : (
          <span id={id} className="min-w-0 flex-1 truncate text-body font-medium text-ink-900">
            {current ? productName(t, current) : '—'}
          </span>
        )}
      </div>

      {current && (
        <div className="flex items-center gap-2 text-small text-ink-500">
          <Badge tone="neutral">{t(`product.kind.${current.kind}`)}</Badge>
          <span className="truncate">
            {t('workspace.product.priced', { count: pricing?.prices.length ?? current.regionCount })}
          </span>
        </div>
      )}

      {/* One compact notice for every product type that could not be
          listed, closable: it matters once, then it only takes room. */}
      {showUnavailable && (
        <Callout
          tone="warn"
          title={t('workspace.product.unavailableGroupTitle', { count: unavailable.length })}
          {...(dismissible
            ? {
                onDismiss: () =>
                  dismissNotice(unavailableId, {
                    persist: unavailable.every((entry) => STABLE_CODES.has(entry.code)),
                  }),
                dismissLabel: t('action.dismiss'),
              }
            : {})}
        >
          <ul className="flex flex-col gap-0.5">
            {unavailable.map((entry) => (
              <li key={entry.kind}>
                {t('workspace.product.unavailableItem', {
                  group: t(`product.group.${entry.kind}`),
                  reason: errorText(t, fmt, entry).title,
                })}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-ink-600">{t('workspace.product.unavailableNote')}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {/* Without products the workspace offers its own reload. */}
            {dismissible && (
              <Button size="sm" icon="refresh" onClick={() => void loadProducts()}>
                {t('action.retry')}
              </Button>
            )}
            <details className="min-w-0 text-small text-ink-600">
              <summary className="cursor-pointer select-none">{t('error.details')}</summary>
              <pre className="mt-1 max-h-28 overflow-auto rounded-md bg-white/80 p-2 font-mono text-meta whitespace-pre-wrap text-ink-700">
                {technical}
              </pre>
            </details>
          </div>
        </Callout>
      )}

      {showNoOneTime && (
        <div className="flex items-start gap-1.5">
          <p className="flex-1 text-small text-ink-500">{t('workspace.product.noOneTime')}</p>
          <IconButton
            icon="close"
            size="sm"
            label={t('action.dismiss')}
            onClick={() => dismissNotice(noOneTimeId)}
          />
        </div>
      )}
    </div>
  );
}
