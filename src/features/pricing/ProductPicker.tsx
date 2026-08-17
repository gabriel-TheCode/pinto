import { productKeyOf, useStore } from '@/app/store';
import type { ProductKind } from '@/types';
import type { ProductSummary } from '@/services/messages';

const KIND_LABEL: Record<ProductKind, string> = {
  subscription: 'Subscriptions',
  onetime: 'One-time products',
  inapp: 'Managed products (legacy)',
};

const KINDS: ProductKind[] = ['subscription', 'onetime', 'inapp'];

export function ProductPicker({
  products,
  value,
  onChange,
}: {
  products: ProductSummary[];
  value: string | null;
  onChange: (key: string) => void;
}) {
  const unavailable = useStore((state) => state.unavailable);
  const byKind = (kind: ProductKind) => products.filter((product) => product.kind === kind);
  const oneTime = [...byKind('onetime'), ...byKind('inapp')];

  // The picker itself only earns its place with more than one product, but the
  // notes below it matter even for a single-product app — that is precisely
  // when someone wonders where their one-time product went.
  if (!products.length && !unavailable.length) return null;

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-ink-200 bg-ink-50 px-3 py-2">
      {products.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-ink-500">Product</span>
          <select
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md border border-ink-200 bg-white px-2 text-[12px] text-ink-800 focus:border-accent-500 focus:outline-none"
          >
            <option value="" disabled>
              Choose a product…
            </option>
            {/* An empty heading reads as "you have none", which is a claim
                Pinto is not always entitled to make. */}
            {KINDS.map((kind) => {
              const group = byKind(kind);
              if (!group.length) return null;
              return (
                <optgroup key={kind} label={KIND_LABEL[kind]}>
                  {group.map((product) => (
                    <option key={productKeyOf(product)} value={productKeyOf(product)}>
                      {product.label} ({product.regionCount})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      )}

      {unavailable.map((entry) => (
        <p
          key={entry.kind}
          className="rounded-md bg-warn-50 px-2 py-1 text-[11px] leading-relaxed text-ink-700"
        >
          <span className="font-medium">{KIND_LABEL[entry.kind]} could not be listed.</span>{' '}
          {entry.reason} Anything of that type is missing from the list below — this is not the same
          as having none.
        </p>
      ))}

      {!unavailable.length && oneTime.length === 0 && byKind('subscription').length > 0 && (
        <p className="text-[11px] leading-relaxed text-ink-400">
          No one-time products on this app. A lifetime purchase is a one-time product, not a
          subscription — create it in Play Console under Monetise with Play → Products → One-time
          products, then reload here.
        </p>
      )}
    </div>
  );
}
