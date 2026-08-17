import type { LogEntry } from './messages';
import { storage } from './storage';

/**
 * Technical detail goes here, never into the main UI. Prices themselves are
 * not logged — only region codes, product ids and API status codes — so the
 * log can be read or exported without spreading a developer's price table.
 */
function write(level: LogEntry['level'], scope: string, message: string, detail?: unknown): void {
  const entry: LogEntry = { at: Date.now(), level, scope, message };
  if (detail !== undefined) entry.detail = stringify(detail);
  void storage.appendLog(entry);
  if (level === 'error') console.error(`[pinto:${scope}]`, message, detail ?? '');
  else if (level === 'warn') console.warn(`[pinto:${scope}]`, message, detail ?? '');
}

function stringify(detail: unknown): string {
  if (typeof detail === 'string') return detail.slice(0, 2000);
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
  try {
    return JSON.stringify(detail).slice(0, 2000);
  } catch {
    return String(detail);
  }
}

export const log = {
  debug: (scope: string, message: string, detail?: unknown) =>
    write('debug', scope, message, detail),
  info: (scope: string, message: string, detail?: unknown) => write('info', scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) => write('warn', scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) =>
    write('error', scope, message, detail),
};
