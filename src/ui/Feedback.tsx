import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { cx } from '@/lib/cx';
import { useFormat, useT } from '@/i18n/react';
import { errorText } from '@/i18n/describe';
import type { PintoErrorPayload } from '@/services/messages';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export type Tone = 'neutral' | 'rise' | 'fall' | 'warn' | 'accent' | 'info' | 'success' | 'danger';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  rise: 'bg-rise-50 text-rise-500',
  fall: 'bg-fall-50 text-fall-500',
  warn: 'bg-warn-50 text-warn-500',
  accent: 'bg-accent-50 text-accent-700',
  info: 'bg-cyan-50 text-cyan-700',
  success: 'bg-success-50 text-success-500',
  danger: 'bg-danger-50 text-danger-500',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px text-meta font-medium tabular whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

const CALLOUT: Record<'info' | 'warn' | 'danger' | 'success' | 'neutral', { box: string; icon: IconName; color: string }> = {
  info: { box: 'border-cyan-500/25 bg-cyan-50', icon: 'info', color: 'text-cyan-700' },
  warn: { box: 'border-warn-bright/40 bg-warn-50', icon: 'warning', color: 'text-warn-500' },
  danger: { box: 'border-danger-500/25 bg-danger-50', icon: 'error', color: 'text-danger-500' },
  success: { box: 'border-success-500/25 bg-success-50', icon: 'success', color: 'text-success-500' },
  neutral: { box: 'border-ink-200 bg-ink-50', icon: 'info', color: 'text-ink-500' },
};

/** A message inside a screen: what is going on, and the action that fixes it. */
export function Callout({
  tone = 'info',
  title,
  children,
  action,
  className,
  role,
}: {
  tone?: keyof typeof CALLOUT;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}) {
  const style = CALLOUT[tone];
  return (
    <div role={role} className={cx('flex gap-2.5 rounded-lg border px-3 py-2.5', style.box, className)}>
      <Icon name={style.icon} className={cx('mt-px', style.color)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="text-body font-medium text-ink-900">{title}</p>}
        {children && <div className="text-small text-ink-700">{children}</div>}
        {action && <div className="mt-1 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  body,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center gap-3 px-8 py-12 text-center', className)}>
      <span className="grid size-10 place-items-center rounded-full bg-ink-100 text-ink-500">
        <Icon name={icon} size={18} />
      </span>
      <div className="flex max-w-[36ch] flex-col gap-1">
        <h2 className="text-title font-semibold text-ink-900">{title}</h2>
        {body && <p className="text-small text-ink-500">{body}</p>}
      </div>
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * An error as a headline and a next step, in the user's language. Google's
 * own words and the code sit behind a disclosure: calm for the common case,
 * complete for a bug report.
 */
export function ErrorPanel({
  error,
  onRetry,
  onDismiss,
  action,
  className,
}: {
  error: PintoErrorPayload;
  onRetry?: () => void;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const fmt = useFormat();
  const text = errorText(t, fmt, error);
  const technical = [error.code, error.detail ?? error.message].filter(Boolean).join('\n');
  return (
    <div role="alert" className={cx('flex flex-col gap-2 rounded-lg border border-danger-500/25 bg-danger-50 p-3', className)}>
      <div className="flex items-start gap-2.5">
        <Icon name="error" className="mt-px text-danger-500" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-body font-medium text-ink-900">{text.title}</p>
          {text.hint && <p className="text-small text-ink-700">{text.hint}</p>}
        </div>
      </div>
      <details className="pl-6 text-small text-ink-600">
        <summary className="cursor-pointer select-none">{t('error.details')}</summary>
        <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-white/80 p-2 font-mono text-meta whitespace-pre-wrap text-ink-700">
          {technical}
        </pre>
      </details>
      {(onRetry || onDismiss || action) && (
        <div className="flex flex-wrap gap-2 pl-6">
          {action}
          {onRetry && error.retryable !== false && (
            <Button size="sm" icon="refresh" onClick={onRetry}>
              {t('action.retry')}
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              {t('action.dismiss')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('pinto-skeleton', className)} />;
}

export function TableSkeleton({ rows = 8, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col divide-y divide-ink-100">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-4 rounded-[4px]" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const indeterminate = total <= 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
      role="progressbar"
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx(
          'h-full rounded-full bg-accent-600 transition-[width] duration-300',
          indeterminate && 'w-1/3 animate-pulse',
        )}
        style={indeterminate ? undefined : { width: `${Math.max(percent, 4)}%` }}
      />
    </div>
  );
}

// --- Announcements ------------------------------------------------------------

const useAnnouncer = create<{ message: string; polite: boolean }>(() => ({ message: '', polite: true }));

/**
 * Tells screen readers about something that changed without moving focus —
 * progress, a count, a result. One always-mounted live region, written to
 * from anywhere.
 */
export function announce(message: string, polite = true): void {
  useAnnouncer.setState({ message: '', polite });
  // Clear first so repeating the same sentence is announced again.
  setTimeout(() => useAnnouncer.setState({ message, polite }), 30);
}

export function Announcer() {
  const { message, polite } = useAnnouncer();
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {polite ? message : ''}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive">
        {polite ? '' : message}
      </div>
    </>
  );
}

/** Copies text and says so for a moment. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return [
    copied,
    (text) => {
      void navigator.clipboard?.writeText(text).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    },
  ];
}
