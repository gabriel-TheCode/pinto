import { useEffect } from 'react';
import { onEvent, send } from '@/services/client';
import { syncLocale, useT } from '@/i18n/react';
import { Announcer, Skeleton, ToastViewport, useHotkey } from '@/ui';
import { SetupScreen } from '@/features/onboarding/SetupScreen';
import { PackageScreen } from '@/features/onboarding/PackageScreen';
import { UnsupportedScreen } from '@/features/onboarding/UnsupportedScreen';
import { Shell } from '@/features/workspace/Shell';
import { useStore } from './store';

/**
 * The panel. Gates first — signed in, on a pricing page, app identified —
 * then the shell. Each gate is a full screen that explains itself and offers
 * the one thing that moves the user forward.
 */
export function App() {
  const ready = useStore((state) => state.ready);
  const auth = useStore((state) => state.auth);
  const context = useStore((state) => state.context);

  useEffect(() => syncLocale(), []);

  useEffect(() => {
    void useStore.getState().boot();
  }, []);

  useEffect(
    () =>
      onEvent((event) => {
        const store = useStore.getState();
        // Progress belongs to the panel that started the write (or found it
        // running at boot). Panels in other tabs must not freeze on it, and
        // "done" is followed by the real result, which clears it.
        if (event.type === 'apply/progress' && store.progress) {
          if (event.progress.phase !== 'done') store.setProgress(event.progress);
          // A write adopted at boot has no response to wait for: "done" is
          // the signal, and its record in history is the result.
          else if (store.progressAdopted) void store.finishAdopted();
        }
        if (event.type === 'auth/changed') store.setAuth(event.state);
        if (event.type === 'context/changed') void store.refreshContext();
      }),
    [],
  );

  // An expired session is a signed-out session: show the sign-in screen,
  // which explains it, instead of an error with no way forward.
  useEffect(
    () =>
      useStore.subscribe((state) => {
        if (state.error?.code === 'auth/expired' && state.auth?.signedIn) {
          useStore.setState({ auth: { ...state.auth, signedIn: false } });
        }
      }),
    [],
  );

  useHotkey('Escape', () => void send({ type: 'panel/close' }).catch(() => undefined));

  return (
    <div className="relative flex h-full flex-col bg-ink-50">
      {!ready ? (
        <BootSkeleton />
      ) : !auth?.signedIn ? (
        <SetupScreen />
      ) : context && !context.supported ? (
        <UnsupportedScreen />
      ) : context && !context.packageName ? (
        <PackageScreen />
      ) : (
        <Shell />
      )}
      <ToastViewport />
      <Announcer />
    </div>
  );
}

function BootSkeleton() {
  const t = useT();
  return (
    <div role="status" aria-label={t('workspace.loading')} className="flex h-full flex-col gap-3 bg-white p-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="mt-2 flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
