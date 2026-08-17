import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  /** Rendered right-aligned inside the button, e.g. "⌘↵". */
  shortcut?: string;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-white border-accent-500 hover:bg-accent-600 active:bg-accent-700 disabled:bg-ink-300 disabled:border-ink-300',
  secondary:
    'bg-white text-ink-800 border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100',
  ghost: 'bg-transparent text-ink-600 border-transparent hover:bg-ink-100 hover:text-ink-900',
  // Primary is filled brand red, so destructive is set apart by a deeper,
  // outlined red — a different shade and shape, not hittable by muscle memory.
  danger: 'bg-white text-accent-700 border-accent-700/45 hover:bg-accent-50 active:bg-accent-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  shortcut,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center border font-medium tracking-[-0.01em]',
        'transition-colors duration-100 select-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {shortcut && (
        <kbd className="ml-1 rounded border border-current/20 px-1 text-[10px] font-normal opacity-60">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('size-3.5 animate-spin', className)}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
