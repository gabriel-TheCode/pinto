import { create } from 'zustand';
import type { TranslationKey } from '@/i18n';
import type { PintoErrorPayload } from '@/services/messages';

/**
 * Non-blocking confirmations ("Group saved"). Anything the user must decide on
 * is a dialog or a screen, never a toast that can be missed.
 *
 * A toast holds a dictionary key, not a sentence, so it is worded when drawn:
 * a language change while it is visible re-renders it in the new language.
 */
export type ToastMessage =
  | { key: TranslationKey; vars?: Record<string, string | number> }
  | { error: PintoErrorPayload };

export interface Toast {
  id: string;
  tone: 'neutral' | 'success' | 'error';
  message: ToastMessage;
}

interface ToastStore {
  toasts: Toast[];
  push(message: ToastMessage, tone?: Toast['tone'], ttlMs?: number): string;
  dismiss(id: string): void;
}

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push(message, tone = 'neutral', ttlMs = 5000) {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, tone, message }] }));
    if (ttlMs > 0) setTimeout(() => get().dismiss(id), ttlMs);
    return id;
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

export function toast(message: ToastMessage, tone: Toast['tone'] = 'neutral'): void {
  useToasts.getState().push(message, tone);
}
