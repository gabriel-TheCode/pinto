import { isLocale, type Locale } from './core';

/**
 * Which language Pinto speaks, decided in one place for every surface.
 *
 * The preference is stored in the settings object in `chrome.storage.local`
 * and is either a locale or `auto` (follow the browser). It is read directly
 * from storage rather than through the service worker so that the panel, the
 * popup and the launcher injected into Play Console can all listen to
 * `storage.onChanged` and switch together, the moment it changes, without a
 * reload.
 */

export type LocalePreference = Locale | 'auto';

/** Must match the settings key in services/storage.ts. */
export const SETTINGS_KEY = 'pinto.settings';

export function isLocalePreference(value: unknown): value is LocalePreference {
  return value === 'auto' || isLocale(value);
}

/** First match among the browser's preferred languages, English otherwise. */
export function detectBrowserLocale(
  languages: readonly string[] = typeof navigator === 'undefined'
    ? []
    : [...(navigator.languages ?? []), navigator.language],
): Locale {
  for (const tag of languages) {
    const base = typeof tag === 'string' ? tag.toLowerCase().split('-')[0] : '';
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function resolveLocale(preference: unknown): Locale {
  return isLocale(preference) ? preference : detectBrowserLocale();
}

function preferenceIn(settings: unknown): LocalePreference {
  const value = (settings as { locale?: unknown } | undefined)?.locale;
  return isLocalePreference(value) ? value : 'auto';
}

export async function readLocalePreference(): Promise<LocalePreference> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return preferenceIn(stored[SETTINGS_KEY]);
  } catch {
    return 'auto';
  }
}

/**
 * Calls `onChange` with the current language, then again whenever the stored
 * preference changes in any Pinto surface. Returns an unsubscribe function.
 */
export function watchLocale(
  onChange: (locale: Locale, preference: LocalePreference) => void,
): () => void {
  let active = true;
  void readLocalePreference().then((preference) => {
    if (active) onChange(resolveLocale(preference), preference);
  });

  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(SETTINGS_KEY in changes)) return;
    const preference = preferenceIn(changes[SETTINGS_KEY]?.newValue);
    onChange(resolveLocale(preference), preference);
  };
  chrome.storage.onChanged?.addListener(listener);
  return () => {
    active = false;
    chrome.storage.onChanged?.removeListener(listener);
  };
}
