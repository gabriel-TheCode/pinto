import { parsePlayConsoleUrl } from '@/services/playConsoleUrl';
import { sniffPackageName } from './packageSniffer';
import { injectInlineEntryPoint, injectUi, type InjectedUi } from './ui';

/**
 * Content script: detect, inject, relay. Nothing else.
 *
 * No pricing logic, no API calls and no React live here. Play Console is a
 * single-page app that rewrites its DOM constantly, so the content script is
 * kept small enough to be obviously correct and re-runs its one job whenever
 * the route changes.
 */

const PANEL_URL = chrome.runtime.getURL('src/panel/index.html');

let ui: InjectedUi | null = null;
let lastUrl = '';

function sync(): void {
  const url = location.href;
  if (url === lastUrl) return;
  lastUrl = url;

  const context = parsePlayConsoleUrl(url);

  if (!context.supported) {
    ui?.close();
    return;
  }

  ui ??= injectUi(PANEL_URL);
  // Play Console renders its tables asynchronously, so the inline entry point
  // is retried a few times before giving up on it for this route.
  retryInline(0);
}

function retryInline(attempt: number): void {
  if (attempt > 8) return;
  if (injectInlineEntryPoint(() => ui?.open())) return;
  setTimeout(() => retryInline(attempt + 1), 400 * (attempt + 1));
}

// --- SPA route changes -------------------------------------------------------

function watchNavigation(): void {
  const notify = () => queueMicrotask(sync);
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
  }
  window.addEventListener('popstate', notify);
  // Belt and braces: some navigations inside Play Console do not go through
  // the History API at all.
  setInterval(() => {
    if (location.href !== lastUrl) sync();
  }, 1000);
}

// --- Messaging ---------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  const { type } = message as { type?: string };

  if (type === 'content/sniffPackage') {
    sendResponse({ packageName: sniffPackageName() });
    return true;
  }
  if (type === 'content/closePanel') {
    ui?.close();
    sendResponse({ ok: true });
    return true;
  }
  if (type === 'content/openPanel') {
    ui?.open();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

// --- Keyboard ----------------------------------------------------------------

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const typing =
    target?.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
  if (typing) return;
  if (event.shiftKey && !event.metaKey && !event.ctrlKey && event.key.toLowerCase() === 'p') {
    event.preventDefault();
    ui?.toggle();
  }
});

sync();
watchNavigation();
