import { useEffect } from 'react';
import { onEvent, send } from '@/services/client';
import { useStore, type Screen } from './store';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { PricingScreen } from '@/features/pricing/PricingScreen';
import { StrategyScreen } from '@/features/strategies/StrategyScreen';
import { ReviewScreen } from '@/features/pricing/ReviewScreen';
import { HistoryScreen } from '@/features/history/HistoryScreen';
import { PresetsScreen } from '@/features/presets/PresetsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { PackageNamePrompt } from '@/features/auth/PackageNamePrompt';
import { UnsupportedPage } from '@/features/pricing/UnsupportedPage';
import { ToastViewport } from '@/components/Toast';
import { ErrorPanel, Skeleton } from '@/components/Feedback';
import { cx } from '@/lib/cx';

const NAV: { id: Screen; label: string }[] = [
  { id: 'pricing', label: 'Pricing' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'presets', label: 'Presets' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const {
    ready,
    screen,
    auth,
    context,
    error,
    boot,
    setScreen,
    setAuth,
    setProgress,
    refreshContext,
    setError,
  } = useStore();

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(
    () =>
      onEvent((event) => {
        if (event.type === 'apply/progress') setProgress(event.progress);
        if (event.type === 'auth/changed') setAuth(event.state);
        if (event.type === 'context/changed') void refreshContext();
      }),
    [setProgress, setAuth, refreshContext],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void send({ type: 'panel/close' }).catch(() => {});
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!ready) return <BootSkeleton />;
  if (!auth?.signedIn) return <AuthScreen />;
  if (context && !context.supported) return <UnsupportedPage />;
  if (context && !context.packageName) return <PackageNamePrompt />;

  return (
    <div className="relative flex h-full flex-col bg-ink-50">
      <Header />
      <nav className="flex shrink-0 gap-0.5 border-b border-ink-200 bg-white px-2">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            className={cx(
              'relative px-2.5 py-2 text-[12.5px] font-medium transition-colors',
              screen === item.id || (screen === 'review' && item.id === 'pricing')
                ? 'text-ink-900'
                : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {item.label}
            {(screen === item.id || (screen === 'review' && item.id === 'pricing')) && (
              <span className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-ink-900" />
            )}
          </button>
        ))}
      </nav>

      {error && (
        <div className="border-b border-ink-200 bg-white p-3">
          <ErrorPanel error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-hidden">
        {screen === 'pricing' && <PricingScreen />}
        {screen === 'strategy' && <StrategyScreen />}
        {screen === 'review' && <ReviewScreen />}
        {screen === 'presets' && <PresetsScreen />}
        {screen === 'history' && <HistoryScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>

      <ToastViewport />
    </div>
  );
}

function Header() {
  const { auth, context, pricing, signOut, setScreen } = useStore();

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-ink-200 bg-white px-3 py-2.5">
      <div className="grid size-6 place-items-center rounded-[7px] bg-gradient-to-br from-[#ff9100] to-[#df301c] text-[11px] font-bold text-white">
        P.
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold tracking-[-0.015em] text-ink-900">Pinto</span>
          <span className="truncate text-[11.5px] text-ink-400">
            {pricing?.label ?? context?.packageName ?? 'Bulk pricing for Google Play'}
          </span>
        </div>
        {context?.packageName && (
          <div className="truncate font-mono text-[10.5px] text-ink-400">
            {context.packageName}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setScreen('settings')}
        title={auth?.email ?? 'Account'}
        className="flex items-center gap-1.5 rounded-full border border-ink-200 py-0.5 pr-2 pl-0.5 hover:bg-ink-50"
      >
        {auth?.picture ? (
          <img src={auth.picture} alt="" className="size-5 rounded-full" />
        ) : (
          <span className="grid size-5 place-items-center rounded-full bg-ink-200 text-[10px] font-semibold text-ink-600">
            {(auth?.email ?? '?').slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="max-w-[90px] truncate text-[11.5px] text-ink-600">
          {auth?.email ?? 'Account'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-md px-1.5 py-1 text-[11.5px] text-ink-500 hover:bg-ink-100 hover:text-ink-800"
      >
        Sign out
      </button>
    </header>
  );
}

function BootSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 bg-white p-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-4 w-40" />
      <div className="mt-2 flex flex-col gap-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
