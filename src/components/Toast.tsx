import { create } from 'zustand';
import { cx } from '@/lib/cx';

export interface Toast {
  id: string;
  tone: 'neutral' | 'success' | 'error';
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, ttlMs?: number) => string;
  dismiss: (id: string) => void;
}

/**
 * Non-blocking feedback only. Anything the user must decide on is a real
 * screen with a confirm button, never a toast that can be missed.
 */
export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push(toast, ttlMs = 5000) {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    if (ttlMs > 0) setTimeout(() => get().dismiss(id), ttlMs);
    return id;
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export function toast(message: string, tone: Toast['tone'] = 'neutral'): void {
  useToasts.getState().push({ tone, message });
}

const TONES: Record<Toast['tone'], string> = {
  neutral: 'border-ink-200 bg-white text-ink-800',
  success: 'border-rise-500/30 bg-rise-50 text-ink-900',
  error: 'border-fall-500/30 bg-fall-50 text-ink-900',
};

export function ToastViewport() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-50 flex flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cx(
            'pointer-events-auto flex items-center gap-3 rounded-lg border px-3 py-2 text-[12.5px] shadow-lg shadow-ink-900/5',
            TONES[item.tone],
          )}
        >
          <span className="flex-1">{item.message}</span>
          {item.action && (
            <button
              type="button"
              className="font-medium text-accent-700 hover:underline"
              onClick={() => {
                item.action?.run();
                dismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="text-ink-400 hover:text-ink-700"
            onClick={() => dismiss(item.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
