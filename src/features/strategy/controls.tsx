import type { ReactNode } from 'react';
import { useStore } from '@/app/store';
import { useT } from '@/i18n/react';
import type { RegionCode, Strategy } from '@/types';
import { Button, Callout, Disclosure, Toggle } from '@/ui';
import { cx } from '@/lib/cx';
import { commitStrategy } from './state';

/** Small pieces shared by the strategy forms. */

/** The currency a country is billed in for the open product. */
export function useCurrencyOf(): (region: RegionCode) => string {
  const pricing = useStore((state) => state.pricing);
  return (region) => pricing?.prices.find((price) => price.regionCode === region)?.currency ?? 'USD';
}

/** A small toggle button; `aria-pressed` carries the state, not the colour alone. */
export function Chip({
  pressed,
  onClick,
  children,
  mono = false,
}: {
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'min-h-7 rounded-md border px-2 py-1 text-small tabular transition-colors',
        mono && 'font-mono',
        pressed
          ? 'border-accent-500 bg-accent-50 font-medium text-accent-700'
          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Converting is what makes one amount mean the same thing everywhere. Turning
 * it off writes one number in every currency, so the switch sits behind a
 * disclosure and the consequence stays in view whenever it is off.
 */
export function ConvertOption({ strategy }: { strategy: Extract<Strategy, { convert: boolean }> }) {
  const t = useT();
  const set = (convert: boolean) => commitStrategy({ ...strategy, convert });
  return (
    <>
      {!strategy.convert && (
        <Callout
          tone="warn"
          title={t('strategy.convert.offTitle')}
          action={
            <Button size="sm" onClick={() => set(true)}>
              {t('strategy.convert.turnOn')}
            </Button>
          }
        >
          {t('strategy.convert.offBody')}
        </Callout>
      )}
      <Disclosure
        title={t('strategy.convert.title')}
        summary={strategy.convert ? t('strategy.convert.on') : t('strategy.convert.off')}
      >
        <Toggle
          checked={strategy.convert}
          onChange={set}
          label={t('strategy.convert.label')}
          description={t('strategy.convert.description')}
        />
      </Disclosure>
    </>
  );
}
