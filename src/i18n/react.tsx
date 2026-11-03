import { Fragment, type ReactNode } from 'react';
import { create } from 'zustand';
import { formatter, type Formatter } from './format';
import { translator, type T } from './index';
import { parseRich, type Locale } from './core';
import { detectBrowserLocale, watchLocale, type LocalePreference } from './preference';

/**
 * The interface language for a React surface (panel or popup).
 *
 * A store of its own rather than a field of the app store, because the popup
 * has no app store and the language must not depend on which screen is up.
 * Every component that reads text subscribes through `useT`, so a language
 * change re-renders all of it at once.
 */
interface I18nState {
  locale: Locale;
  preference: LocalePreference;
  setPreference: (preference: LocalePreference, locale: Locale) => void;
}

export const useI18n = create<I18nState>((set) => ({
  locale: detectBrowserLocale(),
  preference: 'auto',
  setPreference: (preference, locale) => set({ preference, locale }),
}));

/**
 * Starts following the stored preference: applies it now and whenever any
 * Pinto surface changes it. Also keeps `<html lang>` right, which screen
 * readers use to pick a voice. Returns the unsubscribe function.
 */
export function syncLocale(): () => void {
  return watchLocale((locale, preference) => {
    useI18n.getState().setPreference(preference, locale);
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  });
}

export function useLocale(): Locale {
  return useI18n((state) => state.locale);
}

export function useT(): T {
  return translator(useLocale());
}

export function useFormat(): Formatter {
  return formatter(useLocale());
}

/** For code outside React (store actions, toasts) that needs the current language. */
export function currentT(): T {
  return translator(useI18n.getState().locale);
}

/**
 * Renders a translated sentence with inline markup: `<kbd>`, `<code>`, `<b>`
 * and `<em>` by default, or any tag mapped in `tags`. The sentence stays one
 * string in the dictionary, so its word order is the translator's to decide.
 */
export function Rich({
  text,
  tags = {},
}: {
  text: string;
  tags?: Record<string, (children: string) => ReactNode>;
}) {
  return (
    <>
      {parseRich(text).map((segment, index) => {
        if (typeof segment === 'string') return <Fragment key={index}>{segment}</Fragment>;
        const custom = tags[segment.tag];
        if (custom) return <Fragment key={index}>{custom(segment.text)}</Fragment>;
        switch (segment.tag) {
          case 'kbd':
            return (
              <kbd
                key={index}
                className="rounded border border-ink-200 bg-ink-50 px-1 font-mono text-[11px] text-ink-700"
              >
                {segment.text}
              </kbd>
            );
          case 'code':
            return (
              <code key={index} className="font-mono text-[0.92em] text-ink-800">
                {segment.text}
              </code>
            );
          case 'b':
            return (
              <strong key={index} className="font-semibold text-ink-900">
                {segment.text}
              </strong>
            );
          default:
            return <em key={index}>{segment.text}</em>;
        }
      })}
    </>
  );
}
