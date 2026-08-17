import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { cx } from '@/lib/cx';

const CONTROL =
  'w-full h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-[13px] text-ink-900 ' +
  'placeholder:text-ink-400 transition-colors hover:border-ink-300 ' +
  'focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 ' +
  'disabled:bg-ink-50 disabled:text-ink-400';

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[12px] font-medium text-ink-700">
      {children}
    </label>
  );
}

export function Hint({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <p className={cx('text-[11.5px]', tone === 'error' ? 'text-fall-500' : 'text-ink-500')}>
      {children}
    </p>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  suffix?: ReactNode;
}

export function TextField({ label, hint, error, suffix, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <input
          id={id}
          {...rest}
          aria-invalid={!!error}
          className={cx(CONTROL, error && 'border-fall-500 focus:border-fall-500', suffix && 'pr-14', className)}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[12px] text-ink-400">
            {suffix}
          </span>
        )}
      </div>
      {error ? <Hint tone="error">{error}</Hint> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: ReactNode;
}

export function SelectField({ label, hint, className, children, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <select id={id} {...rest} className={cx(CONTROL, 'cursor-pointer pr-8', className)}>
        {children}
      </select>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-ink-50"
    >
      <span
        className={cx(
          'mt-0.5 inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-accent-500' : 'bg-ink-300',
        )}
      >
        <span
          className={cx(
            'size-[14px] rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-3',
          )}
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-medium text-ink-800">{label}</span>
        {description && <span className="text-[11.5px] text-ink-500">{description}</span>}
      </span>
    </button>
  );
}
