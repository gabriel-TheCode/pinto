import { useStore, type View } from '@/app/store';
import { useT } from '@/i18n/react';
import { Button, ErrorPanel, IconButton, Logo } from '@/ui';
import { HistoryScreen } from '@/features/history/HistoryScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { HelpScreen } from '@/features/help/HelpScreen';
import { Workspace } from './Workspace';

/** Apply reloads by itself after apply/stale and api/conflict; these need the button. */
const RELOAD_CODES = new Set(['api/regions-version', 'apply/not-applied']);

/**
 * One place to work, three places to look things up. The workspace is the
 * job; History, Help and Settings are side trips reached from the header and
 * left with their back button — there are no peer tabs to choose between.
 */
export function Shell() {
  const view = useStore((state) => state.view);
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const productsLoaded = useStore((state) => state.productsLoaded);
  const pricing = useStore((state) => state.pricing);
  const reloadPricing = useStore((state) => state.reloadPricing);
  const loadingPricing = useStore((state) => state.loadingPricing);
  const t = useT();
  // Errors whose next step is "reload the prices" get a button that does it.
  const reloadable = !!error && RELOAD_CODES.has(error.code) && !!pricing;

  // Errors the workspace already shows in place (listing or loading prices)
  // are not repeated in the banner.
  const inPlace = view === 'workspace' && (!productsLoaded || !pricing);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header />
      {error && !inPlace && (
        <div className="shrink-0 border-b border-ink-200 bg-white p-3">
          <ErrorPanel
            error={error}
            onDismiss={() => setError(null)}
            action={
              reloadable ? (
                <Button
                  size="sm"
                  icon="refresh"
                  loading={loadingPricing}
                  onClick={async () => {
                    await reloadPricing({ keepSelection: true });
                    setError(null);
                  }}
                >
                  {t('action.reload')}
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {view === 'workspace' && <Workspace />}
        {view === 'history' && <HistoryScreen />}
        {view === 'settings' && <SettingsScreen />}
        {view === 'help' && <HelpScreen />}
      </main>
    </div>
  );
}

function Header() {
  const t = useT();
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);
  const context = useStore((state) => state.context);
  const progress = useStore((state) => state.progress);

  const go = (target: View) => setView(view === target ? 'workspace' : target);

  return (
    <header className="flex shrink-0 items-center gap-2.5 border-b border-ink-200 bg-white px-3 py-2">
      <button
        type="button"
        onClick={() => setView('workspace')}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left"
      >
        <Logo size={26} />
        <span className="flex min-w-0 flex-col">
          <span className="text-body leading-tight font-semibold tracking-[-0.01em] text-ink-900">
            {t('app.name')}
          </span>
          {context?.packageName && (
            <span className="truncate font-mono text-meta text-ink-500">
              <span className="sr-only">{t('workspace.header.packageLabel')} </span>
              {context.packageName}
            </span>
          )}
        </span>
      </button>
      <nav className="flex items-center gap-0.5">
        <IconButton
          icon="history"
          label={t('workspace.header.history')}
          active={view === 'history'}
          aria-current={view === 'history' ? 'page' : undefined}
          disabled={!!progress}
          onClick={() => go('history')}
        />
        <IconButton
          icon="help"
          label={t('workspace.header.help')}
          active={view === 'help'}
          aria-current={view === 'help' ? 'page' : undefined}
          onClick={() => go('help')}
        />
        <IconButton
          icon="settings"
          label={t('workspace.header.settings')}
          active={view === 'settings'}
          aria-current={view === 'settings' ? 'page' : undefined}
          disabled={!!progress}
          onClick={() => go('settings')}
        />
      </nav>
    </header>
  );
}
