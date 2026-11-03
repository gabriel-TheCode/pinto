import { useEffect, useState, type FormEvent } from 'react';
import { useStore } from '@/app/store';
import { asPayload, send } from '@/services/client';
import { LOCALE_NAMES, LOCALES, detectBrowserLocale, type LocalePreference } from '@/i18n';
import { useFormat, useI18n, useT } from '@/i18n/react';
import type { LogEntry } from '@/services/messages';
import {
  Button,
  ConfirmDialog,
  ScreenHeader,
  Section,
  Segmented,
  TextField,
  announce,
  toast,
  useCopy,
  type SegmentedOption,
} from '@/ui';
import { ShortcutTable } from './ShortcutTable';
import { isPackageName } from '@/services/playConsoleUrl';

const CLIENT_ID = /^[\w-]+\.apps\.googleusercontent\.com$/;

export function SettingsScreen() {
  const t = useT();
  const setView = useStore((state) => state.setView);
  const version = chrome.runtime?.getManifest?.()?.version;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        title={t('workspace.header.settings')}
        onBack={() => setView('workspace')}
        backLabel={t('action.back')}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LanguageSection />
        <AccountSection />
        <AppSection />
        <CloudSection />
        <Section title={t('settings.storage.title')}>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-small text-ink-700">
            <li>{t('settings.storage.machine')}</li>
            <li>{t('settings.storage.session')}</li>
            <li>{t('settings.storage.nowhere')}</li>
          </ul>
        </Section>
        <DiagnosticsSection />
        <Section title={t('settings.keys.title')}>
          <ShortcutTable />
        </Section>
        <Section title={t('settings.about.title', { app: t('app.name') })}>
          <p className="text-small text-ink-700">{t('app.tagline')}</p>
          {version && <p className="text-small text-ink-500 tabular">{t('settings.about.version', { version })}</p>}
        </Section>
      </div>
    </div>
  );
}

function LanguageSection() {
  const t = useT();
  const preference = useI18n((state) => state.preference);
  const setLocalePreference = useStore((state) => state.setLocalePreference);
  const options: SegmentedOption<LocalePreference>[] = [
    {
      value: 'auto',
      label: t('settings.language.auto'),
      description: t('settings.language.browser', { language: LOCALE_NAMES[detectBrowserLocale()] }),
    },
    // Each language is named in itself, and marked so a screen reader says it right.
    ...LOCALES.map((locale) => ({ value: locale, label: <span lang={locale}>{LOCALE_NAMES[locale]}</span> })),
  ];
  return (
    <Section title={t('settings.language.title')} description={t('settings.language.description')}>
      <Segmented
        label={t('settings.language.label')}
        value={preference}
        options={options}
        onChange={(next) => void setLocalePreference(next)}
      />
    </Section>
  );
}

function AccountSection() {
  const t = useT();
  const fmt = useFormat();
  const auth = useStore((state) => state.auth);
  const signOut = useStore((state) => state.signOut);
  const initial = (auth?.name ?? auth?.email ?? '?').slice(0, 1).toUpperCase();
  return (
    <Section title={t('settings.account.title')}>
      <div className="flex items-center gap-3">
        {auth?.picture ? (
          <img src={auth.picture} alt="" className="size-9 shrink-0 rounded-full" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-100 text-body font-semibold text-ink-600"
          >
            {initial}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-medium text-ink-900" title={auth?.name ?? auth?.email ?? ''}>
            {auth?.name ?? auth?.email}
          </span>
          {auth?.name && auth.email && (
            <span className="truncate text-small text-ink-500" title={auth.email}>
              {auth.email}
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => void signOut()}>
          {t('settings.account.signOut')}
        </Button>
      </div>
      {auth?.expiresAt && (
        <p className="text-small text-ink-500">{t('settings.account.token', { time: fmt.time(auth.expiresAt) })}</p>
      )}
    </Section>
  );
}

function AppSection() {
  const t = useT();
  const context = useStore((state) => state.context);
  const setPackageName = useStore((state) => state.setPackageName);
  const [draft, setDraft] = useState(context?.packageName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(context?.packageName ?? ''), [context?.packageName]);

  const value = draft.trim();
  const valid = isPackageName(value);
  // Saving the name read from the page confirms it, so that stays possible.
  const unchanged = value === context?.packageName && context.packageNameSource !== 'page';
  const hint = [
    context?.packageNameSource ? t(`settings.app.source.${context.packageNameSource}`) : '',
    context?.consoleAppId
      ? t('settings.app.consoleId', { id: context.consoleAppId })
      : t('settings.app.noConsoleId'),
  ]
    .filter(Boolean)
    .join(' ');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || unchanged || !context?.consoleAppId) return;
    setSaving(true);
    await setPackageName(value);
    setSaving(false);
    if (!useStore.getState().error) toast({ key: 'settings.app.saved', vars: { package: value } }, 'success');
  };

  return (
    <Section title={t('settings.app.title')} description={t('settings.app.description')}>
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-2">
        <TextField
          label={t('settings.app.package')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!context?.consoleAppId}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          inputClassName="font-mono"
          error={value && !valid ? t('settings.app.invalid') : null}
          hint={hint}
        />
        <div>
          <Button type="submit" size="sm" loading={saving} disabled={!valid || unchanged || !context?.consoleAppId}>
            {t('action.save')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function CloudSection() {
  const t = useT();
  const setClientId = useStore((state) => state.setClientId);
  const signOut = useStore((state) => state.signOut);
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void send({ type: 'auth/getClientId' })
      .then(({ clientId }) => {
        setSaved(clientId);
        setDraft(clientId ?? '');
      })
      .catch(() => undefined);
  }, []);

  const value = draft.trim();
  const valid = CLIENT_ID.test(value);
  const redirectUri = redirectUrl();

  return (
    <Section title={t('settings.cloud.title')} description={t('settings.cloud.description')}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && value !== saved) setConfirming(true);
        }}
        className="flex flex-col gap-2"
      >
        <TextField
          label={t('settings.cloud.clientId')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('settings.cloud.placeholder')}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          inputClassName="font-mono text-small"
          error={value && !valid ? t('settings.cloud.invalid') : null}
          hint={t('settings.cloud.hint')}
        />
        <div>
          <Button type="submit" size="sm" disabled={!valid || value === saved}>
            {t('action.save')}
          </Button>
        </div>
      </form>

      {redirectUri && (
        <div className="flex flex-col gap-1.5">
          <p className="text-small font-medium text-ink-800">{t('settings.cloud.redirect')}</p>
          <code className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5 font-mono text-meta break-all text-ink-800">
            {redirectUri}
          </code>
          <p className="text-small text-ink-500">{t('settings.cloud.redirectHint')}</p>
          <div>
            <CopyButton text={redirectUri} label={t('settings.cloud.copyRedirect')} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          void setClientId(value).then(async (ok) => {
            if (!ok) return;
            setSaved(value);
            // The worker keeps the old token; a session from another client
            // must not outlive the change.
            await signOut();
          })
        }
        title={t('settings.cloud.confirmTitle')}
        description={t('settings.cloud.confirmBody')}
        confirmLabel={t('settings.cloud.confirm')}
      />
    </Section>
  );
}

function DiagnosticsSection() {
  const t = useT();
  const setError = useStore((state) => state.setError);
  const [log, setLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setLog((await send({ type: 'log/list' })).map(logLine).join('\n'));
    } catch (error) {
      setError(asPayload(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title={t('settings.log.title')} description={t('settings.log.description')}>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={log === null ? 'download' : 'refresh'} loading={loading} onClick={() => void load()}>
          {log === null ? t('settings.log.load') : t('action.reload')}
        </Button>
        {log && <CopyButton text={log} label={t('settings.log.copy')} />}
      </div>
      {log === '' && <p className="text-small text-ink-500">{t('settings.log.empty')}</p>}
      {log && (
        <pre
          lang="en"
          tabIndex={0}
          aria-label={t('settings.log.label')}
          className="max-h-56 overflow-auto rounded-md border border-ink-200 bg-ink-50 p-2 font-mono text-meta whitespace-pre text-ink-700"
        >
          {log}
        </pre>
      )}
    </Section>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT();
  const [copied, copy] = useCopy();
  useEffect(() => {
    if (copied) announce(t('action.copied'));
  }, [copied, t]);
  return (
    <Button size="sm" variant="ghost" icon={copied ? 'check' : 'copy'} onClick={() => copy(text)}>
      {copied ? t('action.copied') : label}
    </Button>
  );
}

/** Technical, for bug reports: ISO times and the worker's own English words. */
function logLine(entry: LogEntry): string {
  const detail = entry.detail ? ` — ${entry.detail}` : '';
  return `${new Date(entry.at).toISOString()} ${entry.level.padEnd(5)} ${entry.scope}: ${entry.message}${detail}`;
}

function redirectUrl(): string | null {
  try {
    return chrome.identity?.getRedirectURL?.() ?? null;
  } catch {
    return null;
  }
}
