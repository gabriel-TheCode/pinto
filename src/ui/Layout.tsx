import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './Icon';
import { IconButton } from './Button';
import { BRAND, MARK, markPath } from './mark';

/**
 * The heading a screen opens with. It takes focus when the screen appears, so
 * keyboard and screen-reader users land at the top of what changed instead of
 * on <body> — the button they pressed is gone.
 */
export function ScreenTitle({
  children,
  className,
  focusOnMount = true,
  as: Tag = 'h1',
}: {
  children: ReactNode;
  className?: string;
  focusOnMount?: boolean;
  as?: 'h1' | 'h2';
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Only when focus was lost with the previous screen (it fell to <body>).
    // A user still on a control — the product list, a step button — keeps it.
    const lost = !document.activeElement || document.activeElement === document.body;
    if (focusOnMount && lost) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);
  return (
    <Tag
      ref={ref}
      tabIndex={-1}
      data-autofocus
      className={cx('text-display font-semibold tracking-[-0.015em] text-ink-900', className)}
    >
      {children}
    </Tag>
  );
}

/** Header for a side screen (History, Settings, Help): back, title, actions. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-start gap-2 border-b border-ink-200 bg-white px-3 py-3">
      {onBack && backLabel && (
        <IconButton icon="arrowLeft" label={backLabel} onClick={onBack} className="-ml-1" />
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <ScreenTitle className="text-title">{title}</ScreenTitle>
        {subtitle && <p className="text-small text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  children,
  className,
  actions,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cx('flex flex-col gap-3 border-b border-ink-200 bg-white px-4 py-4', className)}>
      {(title || actions) && (
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {title && <h2 className="text-title font-semibold text-ink-900">{title}</h2>}
            {description && <p className="text-small text-ink-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** The bar every step ends with: what will happen, and the one next action. */
export function Footer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex shrink-0 flex-col gap-2 border-t border-ink-200 bg-white px-4 py-3 shadow-[0_-1px_0_rgb(0_0_0/0.02)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Progressive disclosure for advanced options: closed by default, with a
 * summary of what is inside so nothing is hidden by surprise.
 */
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-ink-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
        <Icon name="chevronRight" size={14} className="text-ink-500 transition-transform group-open:rotate-90" />
        <span className="text-body font-medium text-ink-900">{title}</span>
        {summary && <span className="ml-auto truncate text-small text-ink-500">{summary}</span>}
      </summary>
      <div className="flex flex-col gap-3 border-t border-ink-100 px-3 py-3">{children}</div>
    </details>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-ink-200 bg-ink-50 px-1 font-sans text-meta text-ink-700">
      {children}
    </kbd>
  );
}

/** Pinto's mark. Decorative: the product name is always written next to it. */
export function Logo({ size = 24 }: { size?: number }) {
  // Several logos can share a document; each needs its own gradient id.
  const gradient = useId();
  const s = MARK.size;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${s} ${s}`} width={size} height={size} className="shrink-0">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRAND.from} />
          <stop offset="1" stopColor={BRAND.to} />
        </linearGradient>
      </defs>
      <rect width={s} height={s} rx={MARK.radius} fill={`url(#${gradient})`} />
      <path fill="#fff" fillRule="evenodd" d={markPath(MARK)} />
    </svg>
  );
}
