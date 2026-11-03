import { useId } from 'react';
import { productKeyOf, useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { errorText, productName } from '@/i18n/describe';
import type { ProductKind } from '@/types';
import { Badge, Callout, Icon } from '@/ui';

const KINDS: ProductKind[] = ['subscription', 'onetime', 'inapp'];

/**
 * Which product is being priced: the context every other decision applies
 * to, so it sits above the steps and is never more than one control away.
 */
export function ProductBar() {
  const t = useT();
  const fmt = useFormat();
  const id = useId();
  const products = useStore((state) => state.products);
  const unavailable = useStore((state) => state.unavailable);
  const productKey = useStore((state) => state.productKey);
  const pricing = useStore((state) => state.pricing);
  const selectProduct = useStore((state) => state.selectProduct);

  const current = products.find((product) => productKeyOf(product) === productKey);
  const oneTime = products.filter((product) => product.kind !== 'subscription');

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

      {unavailable.map((entry) => {
        const reason = errorText(t, fmt, entry);
        return (
          <Callout
            key={entry.kind}
            tone="warn"
            title={t('workspace.product.unavailableTitle', { group: t(`product.group.${entry.kind}`) })}
          >
            <p>{reason.title}</p>
            <p>{t('workspace.product.unavailableNote')}</p>
          </Callout>
        );
      })}

      {!unavailable.length && products.length > 0 && oneTime.length === 0 && (
        <p className="text-small text-ink-500">{t('workspace.product.noOneTime')}</p>
      )}
    </div>
  );
}
