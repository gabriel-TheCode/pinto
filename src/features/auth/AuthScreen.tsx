import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { ErrorPanel } from '@/components/Feedback';
import { send } from '@/services/client';

/**
 * Signed-out screen. Pinto asks for exactly one thing before it can work —
 * an OAuth client id — and says why, because a tool that writes prices should
 * never be vague about what it is about to be allowed to do.
 */
export function AuthScreen() {
  const { auth, error, signIn, setClientId, setError } = useStore();
  const [clientId, setClientIdInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    void send({ type: 'auth/getClientId' })
      .then((result) => {
        if (result.clientId) setClientIdInput(result.clientId);
        else setShowSetup(true);
      })
      .catch(() => setShowSetup(true));
  }, []);

  const needsSetup = !auth?.clientIdConfigured;

  return (
    <div className="flex h-full flex-col justify-center bg-white px-7">
      <div className="mx-auto flex w-full max-w-[340px] flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <div className="grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-[#ff9100] to-[#df301c] text-[15px] font-bold text-white">
            P.
          </div>
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink-900">Pinto</h1>
            <p className="text-[13px] text-ink-500">Bulk pricing, without the bulk work.</p>
          </div>
        </div>

        <p className="text-[12.5px] leading-relaxed text-ink-600">
          Pinto reads and writes your product prices through the Google Play Developer API, using
          your own Google account. Prices are never sent anywhere except to Google — there is no
          Pinto server.
        </p>

        {error && <ErrorPanel error={error} onDismiss={() => setError(null)} />}

        {needsSetup || showSetup ? (
          <div className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-[12.5px] font-semibold text-ink-900">One-time setup</h2>
              <p className="text-[11.5px] leading-relaxed text-ink-500">
                Paste the OAuth client ID from your Google Cloud project. Pinto ships without one on
                purpose: the client belongs to you, so the Play Developer API access is yours to
                grant and revoke. The README walks through creating it.
              </p>
            </div>
            <TextField
              value={clientId}
              onChange={(event) => setClientIdInput(event.target.value)}
              placeholder="1234567890-abc.apps.googleusercontent.com"
              spellCheck={false}
              autoComplete="off"
            />
            <RedirectUri />
            <Button
              variant="primary"
              disabled={!clientId.trim()}
              onClick={() => void setClientId(clientId)}
            >
              Save client ID
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="md"
            loading={busy}
            disabled={!auth?.clientIdConfigured}
            onClick={async () => {
              setBusy(true);
              await signIn();
              setBusy(false);
            }}
            icon={<GoogleMark />}
          >
            Continue with Google
          </Button>
          {!auth?.clientIdConfigured && (
            <p className="text-center text-[11.5px] text-ink-400">
              Add a client ID above to enable sign-in.
            </p>
          )}
          {auth?.clientIdConfigured && !showSetup && (
            <button
              type="button"
              className="text-[11.5px] text-ink-500 hover:text-ink-800 hover:underline"
              onClick={() => setShowSetup(true)}
            >
              Change OAuth client ID
            </button>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-ink-400">
          Pinto requests the <span className="font-mono">androidpublisher</span> scope to read and
          update prices, plus your email and name so it can show which account is connected. The
          access token is kept in memory for the browser session only and is never written to disk.
        </p>
      </div>
    </div>
  );
}

/** The redirect URI must be registered on the Cloud client, so make it copyable. */
function RedirectUri() {
  const [copied, setCopied] = useState(false);
  const uri = chrome.identity.getRedirectURL();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-600">
        Authorised redirect URI for that client
      </span>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-left font-mono text-[10.5px] break-all text-ink-700 hover:border-ink-300"
        onClick={() => {
          void navigator.clipboard.writeText(uri);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <span className="flex-1">{uri}</span>
        <span className="shrink-0 text-[10px] text-ink-400">{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
      <path
        fill="#fff"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#fff"
        fillOpacity=".82"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#fff"
        fillOpacity=".64"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#fff"
        fillOpacity=".9"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
