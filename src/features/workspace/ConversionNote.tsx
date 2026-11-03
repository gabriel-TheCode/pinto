import { conversionKeyOf, useStore } from '@/app/store';
import { useT } from '@/i18n/react';
import { Icon, Spinner } from '@/ui';
import { cx } from '@/lib/cx';

/**
 * Where converted prices come from, for strategies that convert across
 * currencies: Google's own rates, or — when they could not be fetched — the
 * rates implied by this product's prices, which is only an estimate. Shown
 * wherever converted prices are, so a number is never read without its source.
 */
export function ConversionNote({ className }: { className?: string }) {
  const t = useT();
  const source = useStore((state) => {
    const key = conversionKeyOf(state);
    if (!key) return null;
    if (state.conversionLoading) return 'loading';
    return state.conversionTable && state.conversionKey === key ? 'google' : 'fallback';
  });
  if (!source) return null;
  return (
    <p role="status" className={cx('flex items-start gap-1.5 text-small text-ink-600', className)}>
      {source === 'loading' ? (
        <Spinner className="mt-0.5" />
      ) : (
        <Icon
          name={source === 'google' ? 'globe' : 'warning'}
          size={14}
          className={cx('mt-0.5 shrink-0', source === 'google' ? 'text-ink-500' : 'text-warn-500')}
        />
      )}
      {t(`conversion.${source}`)}
    </p>
  );
}
