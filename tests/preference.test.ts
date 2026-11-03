import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SETTINGS_KEY,
  detectBrowserLocale,
  readLocalePreference,
  resolveLocale,
  watchLocale,
} from '@/i18n/preference';
import { DEFAULT_SETTINGS, storage } from '@/services/storage';
import { installChromeMock } from './chromeMock';

const chromeMock = installChromeMock();

function browserLanguages(languages: string[]) {
  vi.stubGlobal('navigator', { languages, language: languages[0] ?? '' });
}

/** Lets the initial async read inside watchLocale settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => chromeMock.reset());
afterEach(() => vi.unstubAllGlobals());

describe('detectBrowserLocale', () => {
  it('takes the first supported language, ignoring the region', () => {
    expect(detectBrowserLocale(['fr-CA'])).toBe('fr');
    expect(detectBrowserLocale(['de-DE', 'fr-FR', 'en'])).toBe('fr');
    expect(detectBrowserLocale(['EN-gb'])).toBe('en');
  });

  it('falls back to English for a language Pinto does not speak', () => {
    expect(detectBrowserLocale(['de'])).toBe('en');
    expect(detectBrowserLocale([])).toBe('en');
  });

  it('reads navigator.languages by default', () => {
    browserLanguages(['fr-BE', 'en']);
    expect(detectBrowserLocale()).toBe('fr');
  });
});

describe('resolveLocale', () => {
  it('follows the browser for auto or no preference', () => {
    browserLanguages(['fr-CA']);
    expect(resolveLocale('auto')).toBe('fr');
    expect(resolveLocale(undefined)).toBe('fr');
    browserLanguages(['de']);
    expect(resolveLocale('auto')).toBe('en');
  });

  it('lets a chosen language win over the browser', () => {
    browserLanguages(['en-US']);
    expect(resolveLocale('fr')).toBe('fr');
    browserLanguages(['fr-FR']);
    expect(resolveLocale('en')).toBe('en');
  });

  it('treats anything unexpected as auto', () => {
    browserLanguages(['fr']);
    expect(resolveLocale('klingon')).toBe('fr');
  });
});

describe('the stored preference', () => {
  it('defaults to following the browser', () => {
    expect(DEFAULT_SETTINGS.locale).toBe('auto');
  });

  it('is read from the settings Pinto saves, under the same key', async () => {
    expect(await readLocalePreference()).toBe('auto');
    await storage.setSettings({ locale: 'fr' });
    expect(chromeMock.local[SETTINGS_KEY]).toMatchObject({ locale: 'fr' });
    expect(await readLocalePreference()).toBe('fr');
  });

  it('ignores a corrupt stored value', async () => {
    chromeMock.local[SETTINGS_KEY] = { locale: 'xx' };
    expect(await readLocalePreference()).toBe('auto');
  });
});

describe('watchLocale', () => {
  it('reports the current language, then every change made by any surface', async () => {
    browserLanguages(['en-US']);
    chromeMock.local[SETTINGS_KEY] = { locale: 'fr' };
    const onChange = vi.fn();
    const stop = watchLocale(onChange);
    await settle();
    expect(onChange).toHaveBeenLastCalledWith('fr', 'fr');

    await storage.setSettings({ locale: 'en' });
    expect(onChange).toHaveBeenLastCalledWith('en', 'en');

    browserLanguages(['fr-CA']);
    await storage.setSettings({ locale: 'auto' });
    expect(onChange).toHaveBeenLastCalledWith('fr', 'auto');

    stop();
    await storage.setSettings({ locale: 'en' });
    expect(onChange).toHaveBeenLastCalledWith('fr', 'auto');
  });

  it('ignores changes to other keys and other storage areas', async () => {
    const onChange = vi.fn();
    const stop = watchLocale(onChange);
    await settle();
    onChange.mockClear();

    await chrome.storage.local.set({ 'pinto.history': [] });
    await chrome.storage.session.set({ [SETTINGS_KEY]: { locale: 'fr' } });
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('does not report the initial read after it was stopped', async () => {
    const onChange = vi.fn();
    watchLocale(onChange)();
    await settle();
    expect(onChange).not.toHaveBeenCalled();
  });
});
