import { useMemo } from 'react';
import { useChangeSet, useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import {
  announce,
  Button,
  Callout,
  Checkbox,
  EmptyState,
  Footer,
  IS_MAC,
  MOD_LABEL,
  ScreenTitle,
  useHotkey,
} from '@/ui';
import { ChangeSummary } from '@/features/workspace/ChangeSummary';
import { CountryRow, ROW_GRID } from './CountryRow';
import { FilterBar } from './FilterBar';
import { GroupBar } from './GroupBar';
import { sortRows, visibleRows } from './rows';
import { ConversionNote } from '@/features/workspace/ConversionNote';

/**
 * Step 2: where the change applies. What is written is the selection; the
 * filters only change what is visible, and when they hide selected countries
 * the step says so and offers to drop them.
 */
export function MarketsStep() {
  const t = useT();
  const fmt = useFormat();
  const changeSet = useChangeSet();
  const pricing = useStore((state) => state.pricing);
  const selection = useStore((state) => state.selection);
  const filter = useStore((state) => state.filter);
  const toggleRegion = useStore((state) => state.toggleRegion);
  const setSelection = useStore((state) => state.setSelection);
  const addRegions = useStore((state) => state.addRegions);
  const removeRegions = useStore((state) => state.removeRegions);
  const resetFilter = useStore((state) => state.resetFilter);
  const setStep = useStore((state) => state.setStep);
  const changed = changeSet?.summary.changed ?? 0;

  const rows = useMemo(() => sortRows(changeSet?.changes ?? [], fmt), [changeSet, fmt]);
  const visible = useMemo(() => visibleRows(rows, filter, fmt), [rows, filter, fmt]);
  const visibleCodes = useMemo(() => visible.map((row) => row.regionCode), [visible]);
  const priced = useMemo(() => pricing?.prices.map((price) => price.regionCode) ?? [], [pricing]);

  const shownSelected = visibleCodes.filter((code) => selection.has(code)).length;
  // Every selected country has a row, so whatever is selected and not shown is hidden.
  const hiddenSelected = selection.size - shownSelected;
  const allShown = visible.length > 0 && shownSelected === visible.length;
  const allSelected = priced.every((code) => selection.has(code));

  const bulk = (change: () => void) => {
    change();
    announce(t('workspace.summary.selected', { count: useStore.getState().selection.size }));
  };
  const toggleShown = () =>
    bulk(() => (allShown ? removeRegions(visibleCodes) : addRegions(visibleCodes)));
  const review = () => {
    // ⌘↵ typed in the group-name dialog belongs to the dialog.
    if (changed && !document.querySelector('dialog[open]')) setStep('review');
  };

  useHotkey('a', toggleShown, { mod: true });
  useHotkey('Enter', review, { mod: true, whileTyping: true });

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 bg-white px-4 pt-4 pb-3">
          <ScreenTitle>{t('markets.title')}</ScreenTitle>
          <p className="text-small text-ink-500">{t('markets.subtitle')}</p>
        </div>

        <div className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-ink-200 bg-white px-4 pb-2.5">
          <FilterBar rows={rows} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Checkbox
              checked={allShown}
              indeterminate={shownSelected > 0 && !allShown}
              onChange={toggleShown}
              label={t('markets.selection.allShown')}
            />
            <span className="text-small text-ink-500 tabular">
              {t('markets.selection.selected', { count: selection.size })}
              <span aria-hidden="true">{' · '}</span>
              {t('markets.selection.shown', { count: visible.length })}
            </span>
            <span className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={allSelected}
                onClick={() => bulk(() => setSelection(priced))}
              >
                {t('markets.selection.all')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!selection.size}
                onClick={() => bulk(() => setSelection([]))}
              >
                {t('markets.selection.none')}
              </Button>
            </span>
          </div>
          {hiddenSelected > 0 && (
            <Callout
              tone="warn"
              action={
                <>
                  <Button
                    size="sm"
                    onClick={() => bulk(() => setSelection(visibleCodes.filter((code) => selection.has(code))))}
                  >
                    {t('markets.selection.keepShown')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetFilter}>
                    {t('markets.selection.showHidden')}
                  </Button>
                </>
              }
            >
              {t('markets.selection.hidden', { count: hiddenSelected })}
            </Callout>
          )}
        </div>

        <GroupBar priced={priced} />
        <ConversionNote className="border-b border-ink-200 bg-white px-4 py-2" />

        {visible.length > 0 ? (
          <div className="bg-white">
            <div aria-hidden="true" className={`${ROW_GRID} border-b border-ink-100 py-1.5 text-meta font-medium text-ink-500`}>
              <span />
              <span>{t('markets.table.country')}</span>
              <span>{t('markets.table.price')}</span>
            </div>
            <ul aria-label={t('markets.table.label')} className="divide-y divide-ink-100">
              {visible.map((change) => (
                <CountryRow
                  key={change.regionCode}
                  change={change}
                  selected={selection.has(change.regionCode)}
                  onToggle={toggleRegion}
                />
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            icon="search"
            title={t('markets.empty.title')}
            body={t('markets.empty.body')}
            action={<Button onClick={resetFilter}>{t('markets.filters.reset')}</Button>}
          />
        )}
      </div>

      <Footer>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 grow basis-48">
            <ChangeSummary />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" icon="arrowLeft" onClick={() => setStep('strategy')}>
              {t('action.back')}
            </Button>
            <Button
              variant="primary"
              iconAfter="arrowRight"
              disabled={!changed}
              shortcut={`${MOD_LABEL}↵`}
              aria-keyshortcuts={IS_MAC ? 'Meta+Enter' : 'Control+Enter'}
              onClick={review}
            >
              {t('workspace.next.review')}
            </Button>
          </div>
        </div>
      </Footer>
    </>
  );
}
