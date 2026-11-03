import { cx } from '@/lib/cx';
import { useFormat, useT } from '@/i18n/react';
import { errorText } from '@/i18n/describe';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { useToasts, type Toast } from './toastStore';

const TONES: Record<Toast['tone'], { box: string; icon: 'success' | 'error' | 'info'; color: string }> = {
  neutral: { box: 'border-ink-200 bg-white', icon: 'info', color: 'text-ink-500' },
  success: { box: 'border-success-500/30 bg-white', icon: 'success', color: 'text-success-500' },
  error: { box: 'border-danger-500/30 bg-white', icon: 'error', color: 'text-danger-500' },
};

/**
 * Toasts sit at the top of the panel, clear of the footer and its primary
 * button, and are announced through a live region that is always mounted.
 */
export function ToastViewport() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  const t = useT();
  const fmt = useFormat();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-3 top-3 z-50 flex flex-col items-stretch gap-2"
    >
      {toasts.map((item) => {
        const tone = TONES[item.tone];
        const text =
          'error' in item.message
            ? errorText(t, fmt, item.message.error)
            : {
                title: (t as (key: string, vars?: Record<string, string | number>) => string)(
                  item.message.key,
                  item.message.vars,
                ),
                hint: '',
              };
        return (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3 py-2 shadow-lg shadow-ink-900/8',
              tone.box,
            )}
          >
            <Icon name={tone.icon} className={cx('mt-px', tone.color)} />
            <div className="min-w-0 flex-1">
              <p className="text-body text-ink-900">{text.title}</p>
              {text.hint && <p className="text-small text-ink-600">{text.hint}</p>}
            </div>
            <IconButton icon="close" size="sm" label={t('action.dismiss')} onClick={() => dismiss(item.id)} />
          </div>
        );
      })}
    </div>
  );
}
