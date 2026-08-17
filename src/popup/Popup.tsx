import { useEffect, useState } from 'react';
import type { AuthState } from '@/services/messages';
import type { PageContext } from '@/types';
import { send } from '@/services/client';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Feedback';

/**
 * The toolbar popup is a status surface, not a second app: it says whether
 * Pinto is connected and whether the current tab is somewhere it can work,
 * then gets out of the way. All real work happens in the panel, next to the
 * prices it is editing.
 */
export function Popup() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [context, setContext] = useState<PageContext | null>(null);

  useEffect(() => {
    void Promise.all([send({ type: 'auth/state' }), send({ type: 'context/get' })])
      .then(([authState, pageContext]) => {
        setAuth(authState);
        setContext(pageContext);
      })
      .catch(() => undefined);
  }, []);

  const openPanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;
    await chrome.tabs.sendMessage(tab.id, { type: 'content/openPanel' }).catch(() => undefined);
    window.close();
  };

  return (
    <div className="flex flex-col gap-3 bg-white p-3.5">
      <div className="flex items-center gap-2">
        <div className="grid size-6 place-items-center rounded-[7px] bg-gradient-to-br from-[#ff9100] to-[#df301c] text-[11px] font-bold text-white">
          P.
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold tracking-[-0.015em] text-ink-900">Pinto</p>
          <p className="text-[11px] text-ink-500">Bulk pricing, without the bulk work.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-ink-200 p-2.5">
        <Row
          label="Account"
          value={auth?.signedIn ? (auth.email ?? 'Signed in') : 'Not signed in'}
          tone={auth?.signedIn ? 'rise' : 'warn'}
        />
        <Row
          label="This tab"
          value={context?.supported ? 'Pricing page' : 'Not a pricing page'}
          tone={context?.supported ? 'rise' : 'neutral'}
        />
        {context?.packageName && <Row label="App" value={context.packageName} tone="neutral" />}
      </div>

      {context?.supported ? (
        <Button variant="primary" onClick={() => void openPanel()}>
          Open Pinto
        </Button>
      ) : (
        <p className="text-[11.5px] leading-relaxed text-ink-500">
          Open a Play Console subscription, one-time product or pricing page, then click the Pinto
          launcher — or press <kbd className="font-mono">⇧P</kbd>.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'rise' | 'warn' | 'neutral';
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-ink-500">{label}</span>
      <Badge tone={tone} className="max-w-[190px] truncate">
        {value}
      </Badge>
    </div>
  );
}
