import { useEffect, useState } from 'react';
import type { AuthState, PintoErrorPayload } from '@/services/messages';
import type { PageContext } from '@/types';
import { asPayload, send } from '@/services/client';
import { isPlayConsoleUrl } from '@/services/playConsoleUrl';
import { Rich, syncLocale, useT } from '@/i18n/react';
import { Button, Callout, ErrorPanel, IS_MAC, Icon, Logo, Skeleton } from '@/ui';

const PLAY_CONSOLE = 'https://play.google.com/console';

type Status =
  | { state: 'loading' }
  | { state: 'failed'; error: PintoErrorPayload }
  | { state: 'ready'; auth: AuthState; context: PageContext };

async function readStatus(): Promise<Status> {
  try {
    const [auth, context] = await Promise.all([send({ type: 'auth/state' }), send({ type: 'context/get' })]);
    return { state: 'ready', auth, context };
  } catch (error) {
    return { state: 'failed', error: asPayload(error) };
  }
}

/**
 * The toolbar popup is a status surface, not a second app: it says whether
 * Pinto is connected and whether the current tab is somewhere it can work,
 * then offers the one action that gets there. All real work happens in the
 * panel, next to the prices it is editing.
 */
export function Popup() {
  const t = useT();
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  useEffect(() => syncLocale(), []);
  useEffect(() => {
    void readStatus().then(setStatus);
  }, []);

  const retry = () => {
    setStatus({ state: 'loading' });
    void readStatus().then(setStatus);
  };

  return (
    <div className="flex flex-col gap-3 bg-white p-4">
      <header className="flex items-center gap-2.5">
        <Logo size={28} />
        <div className="flex min-w-0 flex-col">
          <h1 className="text-body font-semibold tracking-[-0.01em] text-ink-900">{t('app.name')}</h1>
          <p className="text-small text-ink-500">{t('app.tagline')}</p>
        </div>
      </header>
      {status.state === 'loading' ? (
        <div role="status" aria-label={t('popup.checking')} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 rounded-lg border border-ink-200 px-3 py-3">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : status.state === 'failed' ? (
        <ErrorPanel error={status.error} onRetry={retry} />
      ) : (
        <Ready auth={status.auth} context={status.context} />
      )}
    </div>
  );
}

function Ready({ auth, context }: { auth: AuthState; context: PageContext }) {
  const t = useT();
  const [opening, setOpening] = useState(false);
  /** A tab with no content script: open before Pinto was installed or updated. */
  const [staleTab, setStaleTab] = useState<number | null>(null);
  const onConsole = isPlayConsoleUrl(context.url);
  const openPanel = async () => {
    setOpening(true);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) {
      setOpening(false);
      return;
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'content/openPanel' });
      window.close();
    } catch {
      setStaleTab(tab.id);
      setOpening(false);
    }
  };

  const reloadTab = async (tabId: number) => {
    await chrome.tabs.reload(tabId);
    window.close();
  };

  const openConsole = async () => {
    await chrome.tabs.create({ url: PLAY_CONSOLE });
    window.close();
  };

  return (
    <>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-ink-200 px-3 py-2.5 text-small">
        <Row
          label={t('popup.account')}
          value={auth.signedIn ? (auth.email ?? t('popup.account.signedIn')) : t('popup.account.signedOut')}
          ok={auth.signedIn}
        />
        <Row
          label={t('popup.tab')}
          value={
            context.supported ? t('popup.tab.pricing') : onConsole ? t('popup.tab.console') : t('popup.tab.other')
          }
          ok={context.supported}
        />
        {context.packageName && <Row label={t('popup.app')} value={context.packageName} mono />}
      </dl>

      {staleTab !== null ? (
        <Callout
          tone="warn"
          role="alert"
          title={t('popup.stale.title')}
          action={
            <Button size="sm" variant="primary" icon="refresh" onClick={() => void reloadTab(staleTab)}>
              {t('popup.stale.action')}
            </Button>
          }
        >
          {t('popup.stale.body')}
        </Callout>
      ) : context.supported ? (
        <Button variant="primary" block loading={opening} onClick={() => void openPanel()}>
          {t('popup.open')}
        </Button>
      ) : onConsole ? (
        <p className="text-small text-ink-600">{t('popup.consoleHint')}</p>
      ) : (
        <>
          <p className="text-small text-ink-600">{t('popup.otherHint')}</p>
          <Button variant="primary" block iconAfter="external" onClick={() => void openConsole()}>
            {t('action.openPlayConsole')}
          </Button>
        </>
      )}

      {onConsole && staleTab === null && (
        <p className="text-small text-ink-500">
          <Rich text={t(IS_MAC ? 'popup.shortcut.mac' : 'popup.shortcut.other')} />
        </p>
      )}
    </>
  );
}

function Row({ label, value, ok, mono }: { label: string; value: string; ok?: boolean; mono?: boolean }) {
  return (
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-ink-900">
        {ok !== undefined && (
          <Icon
            name={ok ? 'success' : 'dot'}
            size={14}
            className={ok ? 'text-success-500' : 'text-ink-400'}
          />
        )}
        <span className={mono ? 'truncate font-mono' : 'truncate'} title={value}>
          {value}
        </span>
      </dd>
    </>
  );
}
