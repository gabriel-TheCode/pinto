import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: IconName;
  iconAfter?: IconName;
  /** Visual shortcut hint, e.g. "⌘↵". Hidden from screen readers; pair with aria-keyshortcuts. */
  shortcut?: string;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  // accent-600, not the brand 500: white on #DF301C is 4.2:1, below AA at 13px.
  primary:
    'bg-accent-600 text-white border-accent-600 hover:bg-accent-700 hover:border-accent-700 shadow-[0_1px_0_rgb(0_0_0/0.08)] disabled:bg-ink-200 disabled:border-ink-200 disabled:text-ink-500 disabled:shadow-none',
  secondary:
    'bg-white text-ink-800 border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100 disabled:text-ink-400',
  ghost: 'bg-transparent text-ink-700 border-transparent hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-400',
  // Set apart from primary by shape and shade, not hittable by muscle memory.
  danger:
    'bg-white text-danger-500 border-danger-500/40 hover:bg-danger-50 hover:border-danger-500/60 disabled:text-ink-400 disabled:border-ink-200',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-small gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-body gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconAfter,
    shortcut,
    block = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center border font-medium whitespace-nowrap',
        'transition-colors duration-100 select-none disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
      {iconAfter && !loading && <Icon name={iconAfter} size={size === 'sm' ? 14 : 16} />}
      {shortcut && (
        <kbd
          aria-hidden="true"
          className="ml-0.5 rounded border border-current/25 px-1 font-sans text-meta font-normal opacity-75"
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
});

/**
 * A button that is only an icon. The label is required and becomes both the
 * accessible name and the tooltip, so no icon in Pinto is ever unnamed.
 */
export function IconButton({
  icon,
  label,
  className,
  size = 'md',
  active = false,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName;
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-md text-ink-600 transition-colors',
        'hover:bg-ink-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-400',
        size === 'sm' ? 'size-6' : 'size-8',
        active && 'bg-ink-100 text-ink-900',
        className,
      )}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      className={cx('size-3.5 shrink-0 animate-spin', className)}
      viewBox="0 0 16 16"
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A link styled as text, for external destinations; says it opens a new tab. */
export function ExternalLink({
  href,
  children,
  newTabLabel,
  className,
}: {
  href: string;
  children: ReactNode;
  newTabLabel: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cx(
        'inline-flex items-center gap-1 font-medium text-accent-700 underline-offset-2 hover:underline',
        className,
      )}
    >
      {children}
      <Icon name="external" size={12} />
      <span className="sr-only">{newTabLabel}</span>
    </a>
  );
}
