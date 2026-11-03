import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { useT } from '@/i18n/react';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * A modal built on the native `<dialog>`: the browser traps focus, closes on
 * Esc, makes the rest of the panel inert and returns focus to the opener.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tone = 'neutral',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: 'neutral' | 'danger';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom lacks showModal; fall back to a plain open attribute there.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className="pinto-dialog m-auto w-[min(400px,calc(100vw-24px))] rounded-xl border border-ink-200 bg-white p-0 text-ink-900 shadow-2xl"
    >
      {open && (
        <div className="flex max-h-[calc(100vh-48px)] flex-col">
          <div className="flex items-start gap-3 px-4 pt-4">
            {tone === 'danger' && (
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger-50 text-danger-500">
                <Icon name="warning" />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={`${id}-title`} className="text-title font-semibold">
                {title}
              </h2>
              {description && (
                <p id={`${id}-desc`} className="text-small text-ink-600">
                  {description}
                </p>
              )}
            </div>
          </div>
          {children && <div className="min-h-0 overflow-y-auto px-4 pt-3">{children}</div>}
          <div className={cx('flex flex-wrap justify-end gap-2 px-4 pt-4 pb-4')}>{footer}</div>
        </div>
      )}
    </dialog>
  );
}

/**
 * "Are you sure?" with the consequence stated. For large or irreversible
 * actions, `typeToConfirm` asks for a value (a count) to be typed, so the
 * confirmation is read rather than clicked through.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = 'neutral',
  children,
  typeToConfirm,
  typePrompt,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  tone?: 'neutral' | 'danger';
  children?: ReactNode;
  typeToConfirm?: string;
  typePrompt?: string;
}) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const inputId = useId();
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const ready = !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={!ready}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {typeToConfirm && (
        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-small text-ink-700">
            {typePrompt}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="h-9 w-28 rounded-lg border border-ink-200 px-2.5 text-body tabular focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none"
          />
        </div>
      )}
    </Dialog>
  );
}
