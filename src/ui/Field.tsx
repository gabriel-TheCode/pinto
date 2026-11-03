import {
  type CSSProperties,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { create } from 'zustand';
import { cx } from '@/lib/cx';
import { useFormat } from '@/i18n/react';
import { Icon } from './Icon';

const CONTROL =
  'w-full h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-body text-ink-900 ' +
  'placeholder:text-ink-400 transition-colors hover:border-ink-300 ' +
  'focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 ' +
  'disabled:bg-ink-50 disabled:text-ink-500 aria-[invalid=true]:border-danger-500';

export function Label({
  children,
  htmlFor,
  id,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  id?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} id={id} className={cx('text-small font-medium text-ink-800', className)}>
      {children}
    </label>
  );
}

export function Hint({
  children,
  tone = 'muted',
  id,
}: {
  children: ReactNode;
  tone?: 'muted' | 'error';
  id?: string;
}) {
  return (
    <p
      id={id}
      className={cx('text-small', tone === 'error' ? 'text-danger-500' : 'text-ink-500')}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {children}
    </p>
  );
}

interface FieldShellProps {
  label?: ReactNode;
  /** When the label is not shown, still name the control. */
  srLabel?: string;
  hint?: ReactNode;
  error?: ReactNode | null;
  className?: string;
}

/** Label, control, then hint or error — linked to the control for screen readers. */
function FieldShell({
  id,
  label,
  srLabel,
  hint,
  error,
  className,
  children,
}: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? (
        <Label htmlFor={id}>{label}</Label>
      ) : srLabel ? (
        <label htmlFor={id} className="sr-only">
          {srLabel}
        </label>
      ) : null}
      {children}
      {error ? (
        <Hint tone="error" id={`${id}-msg`}>
          {error}
        </Hint>
      ) : hint ? (
        <Hint id={`${id}-msg`}>{hint}</Hint>
      ) : null}
    </div>
  );
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>,
    FieldShellProps {
  suffix?: ReactNode;
  prefix?: ReactNode;
  inputClassName?: string;
}

export function TextField({
  label,
  srLabel,
  hint,
  error,
  suffix,
  prefix,
  className,
  inputClassName,
  id: idProp,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} srLabel={srLabel} hint={hint} error={error} className={className}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-small text-ink-500">
            {prefix}
          </span>
        )}
        <input
          id={id}
          {...rest}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cx(CONTROL, prefix && 'pl-8', suffix && 'pr-12', inputClassName)}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-small text-ink-500">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

/**
 * Number fields currently holding text that is not a valid value. The store
 * keeps the last valid number meanwhile, so a step must not move on while the
 * screen shows something else: `useInvalidFields() > 0` blocks "Next".
 */
const useInvalid = create<{ ids: Set<string> }>(() => ({ ids: new Set() }));

function markInvalid(id: string, invalid: boolean): void {
  const { ids } = useInvalid.getState();
  if (ids.has(id) === invalid) return;
  const next = new Set(ids);
  if (invalid) next.add(id);
  else next.delete(id);
  useInvalid.setState({ ids: next });
}

export function useInvalidFields(): number {
  return useInvalid((state) => state.ids.size);
}

export interface NumberFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'inputMode' | 'error'> {
  value: number | null;
  /** Called with every value that parses; never with a half-typed one. */
  onCommit: (value: number | null) => void;
  /** Empty means "no value" (null) instead of an error. */
  allowEmpty?: boolean;
  min?: number;
  max?: number;
  /** Shown when the text is not a number, or out of range, once the field is left. */
  invalidMessage: string;
  /** An error from the caller (e.g. a cross-field rule), shown as is. */
  error?: ReactNode | null;
}

/**
 * A number typed by a person.
 *
 * The text is the source of truth while the field has focus: "4." and "-"
 * are kept as typed instead of being turned into 4 and 0 on the next render,
 * which used to make 4.99 come out as 499. Each keystroke that parses is
 * committed, so previews stay live; one that does not is left alone and
 * flagged when the field is left. Both "4,99" and "4.99" are accepted, and the
 * value is shown back with the interface language's separator.
 */
export function NumberField({
  value,
  onCommit,
  allowEmpty = false,
  min,
  max,
  invalidMessage,
  error,
  onBlur,
  onFocus,
  ...rest
}: NumberFieldProps) {
  const fmt = useFormat();
  const fieldId = useId();
  const [draft, setDraft] = useState(() => fmt.editable(value));
  const [touched, setTouched] = useState(false);
  const focused = useRef(false);

  // Follow outside changes (a preset, a quick pick) unless the user is typing.
  useEffect(() => {
    if (!focused.current) setDraft(fmt.editable(value));
  }, [value, fmt]);

  const parse = (text: string): { ok: boolean; value: number | null } => {
    if (!text.trim()) return { ok: allowEmpty, value: null };
    const n = fmt.parseDecimal(text);
    if (!Number.isFinite(n)) return { ok: false, value: null };
    if ((min !== undefined && n < min) || (max !== undefined && n > max)) return { ok: false, value: n };
    return { ok: true, value: n };
  };

  const state = parse(draft);
  const showInvalid = touched && !state.ok;

  useEffect(() => {
    markInvalid(fieldId, !state.ok);
    return () => markInvalid(fieldId, false);
  }, [fieldId, state.ok]);

  return (
    <TextField
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={draft}
      error={error ?? (showInvalid ? invalidMessage : null)}
      onFocus={(event) => {
        focused.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const next = parse(text);
        if (next.ok) onCommit(next.value);
      }}
      onBlur={(event) => {
        focused.current = false;
        setTouched(true);
        const next = parse(draft);
        if (next.ok) setDraft(fmt.editable(next.value));
        onBlur?.(event);
      }}
    />
  );
}

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    FieldShellProps {}

export function SelectField({
  label,
  srLabel,
  hint,
  error,
  className,
  children,
  id: idProp,
  ...rest
}: SelectFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} srLabel={srLabel} hint={hint} error={error} className={className}>
      <div className="relative">
        <select
          id={id}
          {...rest}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cx(CONTROL, 'cursor-pointer appearance-none pr-8')}
        >
          {children}
        </select>
        <Icon
          name="chevronDown"
          size={14}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-500"
        />
      </div>
    </FieldShell>
  );
}

/** An on/off setting with its consequence spelled out underneath. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'mt-0.5 inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-accent-600' : 'bg-ink-300',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cx(
            'size-[14px] rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-3',
          )}
        />
      </button>
      <span className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-body font-medium text-ink-900">
          {label}
        </label>
        {description && (
          <span id={`${id}-desc`} className="text-small text-ink-500">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  srOnlyLabel = false,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  srOnlyLabel?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-small text-ink-700', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 cursor-pointer accent-[var(--color-accent-600)]"
      />
      <span className={srOnlyLabel ? 'sr-only' : undefined}>{label}</span>
    </label>
  );
}

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  /** Shown under the control for the selected option. */
  description?: ReactNode;
}

/**
 * A single choice among a few, as a radio group: arrow keys move between
 * options, the selection is announced, and the selected option's description
 * is shown in full rather than hidden in a tooltip.
 */
export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  columns,
  narrowColumns,
  hideLabel = false,
}: {
  label: string;
  value: V;
  options: SegmentedOption<V>[];
  onChange: (value: V) => void;
  /** Grid columns; defaults to the option count, wrapping on narrow panels. */
  columns?: number;
  /** Columns under 400px wide, where four labels no longer fit side by side. */
  narrowColumns?: number;
  /** Keep the group named for screen readers without a visible caption. */
  hideLabel?: boolean;
}) {
  const id = useId();
  const selected = options.find((option) => option.value === value);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className={hideLabel ? 'sr-only' : 'text-small font-medium text-ink-800'}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-1 rounded-lg bg-ink-100 p-0.5 max-[400px]:grid-cols-[repeat(var(--cols-narrow),minmax(0,1fr))]"
        style={
          {
            '--cols': columns ?? options.length,
            '--cols-narrow': narrowColumns ?? columns ?? options.length,
          } as CSSProperties
        }
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const index = options.findIndex((option) => option.value === value);
          const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
          const next = options[(index + step + options.length) % options.length]!;
          onChange(next.value);
          (event.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
        }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-value={option.value}
              onClick={() => onChange(option.value)}
              className={cx(
                'min-h-7 rounded-md px-2 py-1 text-small font-medium transition-colors',
                active
                  ? 'bg-white text-ink-900 shadow-[0_1px_2px_rgb(16_24_40/0.12)]'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {selected?.description && <p className="text-small text-ink-500">{selected.description}</p>}
    </div>
  );
}
