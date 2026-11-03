import { createTranslator, type Locale } from './core';
import { content as en } from './locales/en/content';
import { content as fr } from './locales/fr/content';

/** The content script's own translator: its namespace only. */
export function contentTranslator(locale: Locale) {
  return createTranslator<typeof en>({ en, fr }, locale);
}
