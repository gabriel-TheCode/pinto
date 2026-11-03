import { useEffect, useRef } from 'react';

/**
 * Keyboard shortcuts that never fight the user's typing. A global handler
 * that fires inside a text field steals ⌘A, "/" and Esc from the field; every
 * shortcut in Pinto goes through `useHotkey`, which stands aside whenever the
 * focus is in something editable or another handler already acted.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== 'string') return false;
  if (element.isContentEditable) return true;
  if (element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') return true;
  if (element.tagName !== 'INPUT') return false;
  const type = (element as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
}

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** "⌘" on a Mac, "Ctrl" elsewhere — shown in hints, never in accessible names. */
export const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl';

export interface HotkeyOptions {
  /** Requires ⌘ on a Mac, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  /** Fire even while typing (for ⌘↵ in a form, say). */
  whileTyping?: boolean;
  enabled?: boolean;
}

export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  { mod = false, shift = false, whileTyping = false, enabled = true }: HotkeyOptions = {},
): void {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      const modDown = IS_MAC ? event.metaKey : event.ctrlKey;
      if (mod !== modDown || shift !== event.shiftKey || event.altKey) return;
      if (!whileTyping && isTypingTarget(event.target)) return;
      // An open dialog owns the keyboard: its own Esc closes it, and no
      // shortcut may act on the screen behind it.
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      latest.current(event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [key, mod, shift, whileTyping, enabled]);
}
