import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@/app/store';
import { LOCALES, LOCALE_NAMES, type LocalePreference } from '@/i18n';
import { errorText } from '@/i18n/describe';
import { Rich, useFormat, useI18n, useT } from '@/i18n/react';
import { send } from '@/services/client';
import {
  Button,
  Callout,
  ErrorPanel,
  ExternalLink,
  Icon,
  Segmented,
  TextField,
  announce,
  useCopy,
} from '@/ui';
import { Frame, Hero } from './Frame';

const CLIENT_ID = /^[\w-]+\.apps\.googleusercontent\.com$/;

const CLOUD = {
  api: 'https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com',
  consent: 'https://console.cloud.google.com/apis/credentials/consent',
  client: 'https://console.cloud.google.com/apis/credentials/oauthclient',
};

/**
 * Signed out. Pinto needs an OAuth client of the user's own before it can
 * sign in, so a first-time user gets the whole Cloud Console setup here, step
 * by step with deep links — no README to go and find. Once a client exists,
 * the screen is a sign-in button and what signing in grants.
 */
export function SetupScreen() {
  const t = useT();
  const auth = useStore((state) => state.auth);
  const error = useStore((state) => state.error);
  const boot = useStore((state) => state.boot);

  // No auth state: the worker could not be reached (typically the extension
  // was updated under an open tab). The fix is a reload, not a new setup.
  if (!auth) {
    return (
      <Frame>
        <Hero logo title={t('app.name')} lead={t('onboarding.signIn.lead')} />
        {error && <ErrorPanel error={error} onRetry={() => void boot()} />}
        <LanguageSwitch />
      </Frame>
    );
  }
  return auth.clientIdConfigured ? <SignIn /> : <Checklist />;
}

function Checklist() {
  const t = useT();
  const newTab = t('a11y.external');
  return (
    <Frame>
      <Hero logo title={t('onboarding.setup.title')} lead={t('onboarding.setup.lead')} />
      <SignInError />
      <ol aria-label={t('onboarding.setup.stepsLabel')} className="flex flex-col">
        <Step number={1} title={t('onboarding.setup.api.title')} body={t('onboarding.setup.api.body')}>
          <ExternalLink href={CLOUD.api} newTabLabel={newTab} className="self-start text-small">
            {t('onboarding.setup.api.link')}
          </ExternalLink>
        </Step>
        <Step number={2} title={t('onboarding.setup.consent.title')} body={t('onboarding.setup.consent.body')}>
          <ExternalLink href={CLOUD.consent} newTabLabel={newTab} className="self-start text-small">
            {t('onboarding.setup.consent.link')}
          </ExternalLink>
        </Step>
        <Step number={3} title={t('onboarding.setup.client.title')} body={t('onboarding.setup.client.body')}>
          <RedirectUri />
          <ExternalLink href={CLOUD.client} newTabLabel={newTab} className="self-start text-small">
            {t('onboarding.setup.client.link')}
          </ExternalLink>
        </Step>
        <Step number={4} title={t('onboarding.setup.link.title')} body={t('onboarding.setup.link.body')} />
        <Step number={5} title={t('onboarding.setup.paste.title')} body={t('onboarding.setup.paste.body')}>
          <ClientIdForm primary />
        </Step>
      </ol>
      <LanguageSwitch />
    </Frame>
  );
}

function Step({
  number,
  title,
  body,
  children,
}: {
  number: number;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-5 before:absolute before:top-7 before:bottom-1.5 before:left-3 before:w-px before:bg-ink-200 last:pb-0 last:before:hidden">
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-50 text-small font-semibold text-ink-700 tabular"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
        <h2 className="text-body font-medium text-ink-900">{title}</h2>
        <p className="text-small text-ink-600">
          <Rich text={body} />
        </p>
        {children}
      </div>
    </li>
  );
}

function SignIn() {
  const t = useT();
  const signIn = useStore((state) => state.signIn);
  const setError = useStore((state) => state.setError);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const signInButton = useRef<HTMLButtonElement>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    await signIn();
    setBusy(false);
  };

  const closeEditor = () => {
    setEditing(false);
    signInButton.current?.focus();
  };

  return (
    <Frame>
      <Hero logo title={t('app.name')} lead={t('onboarding.signIn.lead')} />
      <SignInError />
      <div className="flex flex-col gap-2">
        <Button ref={signInButton} variant="primary" block loading={busy} onClick={() => void start()}>
          {t('onboarding.signIn.action')}
        </Button>
        {editing ? (
          <ClientIdForm autoFocus onDone={closeEditor} />
        ) : (
          <Button variant="ghost" size="sm" className="self-center" onClick={() => setEditing(true)}>
            {t('onboarding.clientId.change')}
          </Button>
        )}
      </div>
      <p className="flex gap-2 text-small text-ink-500">
        <Icon name="lock" size={14} className="mt-0.5" />
        <span>
          <Rich text={t('onboarding.privacy')} />
        </span>
      </p>
      <LanguageSwitch />
    </Frame>
  );
}

/**
 * Backing out of Google's window, or a session that ran out, is not a fault:
 * it gets a calm note with the way forward. Anything else is a real error.
 */
function SignInError() {
  const t = useT();
  const fmt = useFormat();
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  if (!error) return null;

  const dismiss = () => setError(null);
  if (error.code !== 'auth/cancelled' && error.code !== 'auth/expired') {
    return <ErrorPanel error={error} onDismiss={dismiss} />;
  }
  const text = errorText(t, fmt, error);
  return (
    <Callout
      tone="info"
      role="status"
      title={text.title}
      action={
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t('action.dismiss')}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p>{text.hint}</p>
        {error.code === 'auth/cancelled' && <RedirectUri />}
      </div>
    </Callout>
  );
}

/** The redirect URI must be registered on the Cloud client exactly, so it is copied, never retyped. */
function RedirectUri() {
  const t = useT();
  const [copied, copy] = useCopy();
  const uri = chrome.identity.getRedirectURL();

  useEffect(() => {
    if (copied) announce(t('action.copied'));
  }, [copied, t]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-meta font-medium text-ink-600">{t('onboarding.redirect.label')}</span>
      <div className="flex items-center gap-1 rounded-md border border-ink-200 bg-white py-1 pr-1 pl-2.5">
        <code className="min-w-0 flex-1 font-mono text-small break-all text-ink-800">{uri}</code>
        <Button
          size="sm"
          variant="ghost"
          icon={copied ? 'check' : 'copy'}
          aria-label={t('onboarding.redirect.copy')}
          onClick={() => copy(uri)}
        >
          {copied ? t('action.copied') : t('action.copy')}
        </Button>
      </div>
    </div>
  );
}

function ClientIdForm({
  primary = false,
  autoFocus = false,
  onDone,
}: {
  primary?: boolean;
  autoFocus?: boolean;
  /** Set when the form can be closed (changing an existing client). */
  onDone?: () => void;
}) {
  const t = useT();
  const setClientId = useStore((state) => state.setClientId);
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Changing the client starts from the current one.
  useEffect(() => {
    void send({ type: 'auth/getClientId' })
      .then(({ clientId }) => {
        if (clientId) setValue((current) => current || clientId);
      })
      .catch(() => undefined);
  }, []);

  const id = value.trim();
  const valid = CLIENT_ID.test(id);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    const saved = await setClientId(id);
    setSaving(false);
    if (!saved) return;
    announce(t('onboarding.clientId.saved'));
    onDone?.();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        label={t('onboarding.clientId.label')}
        placeholder={t('onboarding.clientId.placeholder')}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        inputClassName="font-mono text-small"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setTouched(true)}
        error={touched && id && !valid ? t('onboarding.clientId.invalid') : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={primary ? 'primary' : 'secondary'} loading={saving} disabled={!id}>
          {t('onboarding.clientId.save')}
        </Button>
        {onDone && (
          <Button variant="ghost" onClick={onDone}>
            {t('action.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Settings is out of reach before sign-in, so the language is chosen here. */
function LanguageSwitch() {
  const t = useT();
  const preference = useI18n((state) => state.preference);
  const setLocalePreference = useStore((state) => state.setLocalePreference);
  return (
    <div className="mt-auto border-t border-ink-200 pt-4">
      <Segmented<LocalePreference>
        label={t('onboarding.language.label')}
        value={preference}
        onChange={(next) => void setLocalePreference(next)}
        options={[
          { value: 'auto', label: t('onboarding.language.auto') },
          ...LOCALES.map((locale) => ({
            value: locale,
            label: <span lang={locale}>{LOCALE_NAMES[locale]}</span>,
          })),
        ]}
      />
    </div>
  );
}
