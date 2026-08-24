import type { PageContext } from '@/types';
import { toPayload, ERRORS } from '@/lib/errors';
import { parsePreset } from '@/domain/presets/schema';
import { parseCustomGroup } from '@/domain/regions/schema';
import { auth } from '@/services/auth';
import { log } from '@/services/logger';
import { PlayApi } from '@/services/playApi';
import { storage, type Settings } from '@/services/storage';
import { parsePlayConsoleUrl } from '@/services/playConsoleUrl';
import type { ApplyResult, Event, Request, Response } from '@/services/messages';
import { applyPricing, revertRequest } from './applyEngine';

/**
 * The service worker owns everything that must survive the panel being closed
 * or the tab being navigated: authentication, API access, the apply engine and
 * all persistence. The panel is a pure view over this.
 */

async function api(): Promise<PlayApi> {
  const settings = await storage.getSettings();
  return new PlayApi({
    getAccessToken: () => auth.getAccessToken(),
    regionsVersion: settings.regionsVersion,
  });
}

function broadcast(event: Event): void {
  chrome.runtime.sendMessage(event).catch(() => {
    // No panel open. Progress is also persisted in history, so nothing is lost.
  });
}

/**
 * Resolves the package name for the current tab. The URL only carries Play
 * Console's internal app id, so Pinto tries, in order: a package name the user
 * already confirmed for this app, then a best-effort read from the page. If
 * both fail the UI asks once and remembers the answer.
 */
async function resolveContext(tabId: number | undefined): Promise<PageContext> {
  const tab = tabId
    ? await chrome.tabs.get(tabId).catch(() => undefined)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  const context = parsePlayConsoleUrl(tab?.url ?? '');
  if (!context.consoleAppId) return context;

  const map = await storage.getPackageMap();
  const cached = map[context.consoleAppId];
  if (cached) return { ...context, packageName: cached, packageNameSource: 'cache' };

  if (tab?.id !== undefined) {
    const sniffed = await sniffPackageName(tab.id);
    if (sniffed) {
      await storage.setPackageName(context.consoleAppId, sniffed);
      return { ...context, packageName: sniffed, packageNameSource: 'page' };
    }
  }
  return context;
}

async function sniffPackageName(tabId: number): Promise<string | null> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, { type: 'content/sniffPackage' })) as
      | { packageName: string | null }
      | undefined;
    return response?.packageName ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handle(request: Request, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const tabId = sender.tab?.id;

  switch (request.type) {
    case 'auth/state':
      return auth.getState();

    case 'auth/signIn': {
      const state = await auth.signIn();
      broadcast({ type: 'auth/changed', state });
      return state;
    }

    case 'auth/signOut': {
      const state = await auth.signOut();
      broadcast({ type: 'auth/changed', state });
      return state;
    }

    case 'auth/setClientId': {
      await storage.setClientId(request.clientId);
      const state = await auth.getState();
      broadcast({ type: 'auth/changed', state });
      return state;
    }

    case 'auth/getClientId':
      return { clientId: await storage.getClientId() };

    case 'context/get':
      return resolveContext(request.tabId ?? tabId);

    case 'context/setPackageName': {
      await storage.setPackageName(request.consoleAppId, request.packageName.trim());
      const context = await resolveContext(tabId);
      return { ...context, packageNameSource: 'manual' as const };
    }

    case 'products/list':
      return (await api()).listProducts(request.packageName);

    case 'products/pricing':
      return (await api()).getPricing(
        request.packageName,
        request.kind,
        request.productId,
        request.basePlanId,
      );

    case 'pricing/convert':
      return (await api()).conversionTable(
        request.packageName,
        request.referenceMicros,
        request.referenceCurrency,
      );

    case 'pricing/apply': {
      const record = await applyPricing(await api(), request.request, (progress) =>
        broadcast({ type: 'apply/progress', progress }),
      );
      return { operation: record } satisfies ApplyResult;
    }

    case 'history/list':
      return storage.getHistory();

    case 'history/revert': {
      const history = await storage.getHistory();
      const original = history.find((h) => h.id === request.operationId);
      if (!original) throw ERRORS.apiNotFound('that operation');
      if (!original.snapshot.length) {
        throw ERRORS.apiNotFound('a snapshot for that operation');
      }
      const record = await applyPricing(await api(), revertRequest(original), (progress) =>
        broadcast({ type: 'apply/progress', progress }),
      );
      await storage.updateHistory(original.id, { revertedBy: record.id });
      return { operation: record } satisfies ApplyResult;
    }

    case 'history/clear':
      await storage.clearHistory();
      return null;

    case 'presets/list':
      return storage.getPresets();

    case 'presets/save':
      // Presets can come from an imported file, so they are validated at the
      // boundary rather than trusted because they arrived over a typed channel.
      return storage.savePreset(parsePreset(request.preset));

    case 'presets/delete':
      return storage.deletePreset(request.id);

    case 'settings/get':
      return storage.getSettings();

    case 'settings/update':
      return storage.setSettings(request.patch as Partial<Settings>);

    case 'groups/list':
      return storage.getGroups();

    case 'groups/save':
      return storage.saveGroup(parseCustomGroup(request.group));

    case 'groups/delete':
      return storage.deleteGroup(request.id);

    case 'panel/close': {
      if (tabId !== undefined) {
        await chrome.tabs.sendMessage(tabId, { type: 'content/closePanel' }).catch(() => {});
      }
      return null;
    }

    case 'log/list':
      return storage.getLog();

    default: {
      const exhaustive: never = request;
      throw new Error(`Unknown request ${JSON.stringify(exhaustive)}`);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message)) return false;
  const request = message as Request;
  // Events broadcast by this worker come back through the same channel.
  if (!isRequest(request.type)) return false;

  handle(request, sender)
    .then((data) => sendResponse({ ok: true, data } satisfies Response))
    .catch((error) => {
      const payload = toPayload(error);
      // Closing the sign-in window is a decision, not a fault. Logging it at
      // error level put a red badge on the extension card in chrome://extensions,
      // which reads as a crash — and an error badge that fires on normal use
      // stops meaning anything.
      if (EXPECTED_OUTCOMES.has(payload.code)) {
        log.info('router', `${request.type} ended early: ${payload.code}`);
      } else {
        log.error('router', `${request.type} failed`, error);
      }
      sendResponse({ ok: false, error: payload } satisfies Response);
    });
  return true; // keep the message channel open for the async response
});

/** Outcomes that are part of normal use, not failures to alert on. */
const EXPECTED_OUTCOMES = new Set(['auth/cancelled', 'auth/silent-failed']);

const REQUEST_PREFIXES = [
  'auth/',
  'context/',
  'products/',
  'pricing/',
  'history/',
  'presets/',
  'settings/',
  'groups/',
  'panel/',
  'log/',
];

function isRequest(type: string): boolean {
  if (type === 'apply/progress' || type === 'auth/changed' || type === 'context/changed') {
    return false;
  }
  return REQUEST_PREFIXES.some((prefix) => type.startsWith(prefix));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const context = parsePlayConsoleUrl(tab.url);
  if (context.supported) {
    log.debug('context', `Play Console pricing page detected in tab ${tabId}`);
    broadcast({ type: 'context/changed', context });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  log.info('lifecycle', `Pinto ${details.reason}`);
});
