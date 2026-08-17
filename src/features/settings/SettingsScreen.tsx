import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { send } from '@/services/client';
import type { LogEntry } from '@/services/messages';
import { toast } from '@/components/Toast';

export function SettingsScreen() {
  const { auth, context, setClientId, setPackageName, signOut } = useStore();
  const [clientId, setClientIdInput] = useState('');
  const [packageName, setPackageNameInput] = useState(context?.packageName ?? '');
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    void send({ type: 'auth/getClientId' }).then((result) =>
      setClientIdInput(result.clientId ?? ''),
    );
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-white">
      <Section title="Account">
        <div className="flex items-center gap-2.5">
          {auth?.picture ? (
            <img src={auth.picture} alt="" className="size-8 rounded-full" />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-ink-200 text-[12px] font-semibold text-ink-600">
              {(auth?.email ?? '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink-900">
              {auth?.name ?? 'Signed in'}
            </p>
            <p className="truncate text-[11.5px] text-ink-500">{auth?.email}</p>
          </div>
          <Button size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
        {auth?.expiresAt && (
          <p className="text-[11px] text-ink-400">
            Access token expires at {new Date(auth.expiresAt).toLocaleTimeString()} and is renewed
            silently. It is held in memory only, never written to disk.
          </p>
        )}
      </Section>

      <Section title="This app">
        <TextField
          label="Package name"
          value={packageName}
          spellCheck={false}
          onChange={(event) => setPackageNameInput(event.target.value)}
          hint={
            context?.consoleAppId
              ? `Mapped to Play Console app #${context.consoleAppId} on this machine.`
              : undefined
          }
        />
        <Button
          size="sm"
          disabled={!packageName.trim() || packageName === context?.packageName}
          onClick={() => void setPackageName(packageName.trim())}
        >
          Save
        </Button>
      </Section>

      <Section title="OAuth client">
        <TextField
          value={clientId}
          spellCheck={false}
          onChange={(event) => setClientIdInput(event.target.value)}
          hint="Changing this signs you out."
        />
        <Button size="sm" onClick={() => void setClientId(clientId.trim())}>
          Save client ID
        </Button>
      </Section>

      <Section title="What Pinto stores">
        <ul className="flex list-disc flex-col gap-1 pl-4 text-[11.5px] leading-relaxed text-ink-500">
          <li>
            On this machine: your OAuth client ID, presets, operation history with price snapshots,
            the app-id to package-name map, and a technical log.
          </li>
          <li>
            In memory for this browser session only: the access token and your name, email and
            avatar.
          </li>
          <li>
            Nowhere else. Pinto has no backend — prices go straight from this panel to the Google
            Play Developer API.
          </li>
        </ul>
      </Section>

      <Section title="Operation log">
        <div className="flex gap-2">
          <Button size="sm" onClick={async () => setLog(await send({ type: 'log/list' }))}>
            Load log
          </Button>
          {log.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                toast('Log copied to the clipboard.');
              }}
            >
              Copy
            </Button>
          )}
        </div>
        {log.length > 0 && (
          <pre className="max-h-48 overflow-auto rounded-md bg-ink-50 p-2 font-mono text-[10.5px] leading-relaxed text-ink-600">
            {log
              .map(
                (entry) =>
                  `${new Date(entry.at).toISOString()} ${entry.level.padEnd(5)} ${entry.scope}: ${entry.message}${entry.detail ? ` — ${entry.detail}` : ''}`,
              )
              .join('\n')}
          </pre>
        )}
      </Section>

      <Section title="Keyboard">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
          {[
            ['⇧P', 'Open or close Pinto from Play Console'],
            ['/', 'Focus the country search'],
            ['⌘/Ctrl A', 'Select or clear all visible countries'],
            ['⌘/Ctrl ↵', 'Review changes'],
            ['Esc', 'Close the panel'],
          ].map(([key, description]) => (
            <div key={key} className="contents">
              <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-700">
                {key}
              </kbd>
              <span>{description}</span>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-ink-200 p-3">
      <h3 className="text-[12px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h3>
      {children}
    </section>
  );
}
