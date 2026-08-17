import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Button } from './Button';
import type { PintoErrorPayload } from '@/services/messages';

export type Tone = 'neutral' | 'rise' | 'fall' | 'warn' | 'accent' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600',
  rise: 'bg-rise-50 text-rise-500',
  fall: 'bg-fall-50 text-fall-500',
  warn: 'bg-warn-50 text-warn-500',
  accent: 'bg-accent-50 text-accent-700',
  info: 'bg-cyan-50 text-cyan-700',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
      {icon && <div className="text-ink-300">{icon}</div>}
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h3>
        <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-ink-500">{body}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Errors are shown as a message plus a next step. The technical payload sits
 * behind a disclosure so the surface stays calm for the common case while
 * still giving a developer something to paste into a bug report.
 */
export function ErrorPanel({
  error,
  onRetry,
  onDismiss,
}: {
  error: PintoErrorPayload;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-fall-500/25 bg-fall-50 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-fall-500" aria-hidden>
          ⚠
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[12.5px] font-medium text-ink-900">{error.message}</p>
          {error.hint && <p className="text-[12px] text-ink-600">{error.hint}</p>}
        </div>
      </div>
      {error.detail && (
        <details className="text-[11.5px] text-ink-500">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-white/70 p-2 font-mono text-[11px] whitespace-pre-wrap">
            {error.code}
            {'\n'}
            {error.detail}
          </pre>
        </details>
      )}
      {(onRetry || onDismiss) && (
        <div className="flex gap-2">
          {onRetry && error.retryable !== false && (
            <Button size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('pinto-skeleton', className)} />;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col divide-y divide-ink-100">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-3.5 rounded-[3px]" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
