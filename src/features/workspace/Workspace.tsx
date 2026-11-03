import { useStore } from '@/app/store';
import { useT } from '@/i18n/react';
import { Button, Callout, EmptyState, ErrorPanel, TableSkeleton } from '@/ui';
import { StrategyStep } from '@/features/strategy/StrategyStep';
import { MarketsStep } from '@/features/markets/MarketsStep';
import { ReviewStep } from '@/features/review/ReviewStep';
import { ProgressView } from '@/features/review/ProgressView';
import { ResultView } from '@/features/review/ResultView';
import { ProductBar } from './ProductBar';
import { Stepper } from './Stepper';

/**
 * The job itself: product, then the three steps. Every state on the way —
 * loading, nothing to price, nothing chosen, writing, result — is a screen
 * that says what is going on and what to do next, never a blank.
 */
export function Workspace() {
  const t = useT();
  const productsLoaded = useStore((state) => state.productsLoaded);
  const products = useStore((state) => state.products);
  const unavailable = useStore((state) => state.unavailable);
  const productKey = useStore((state) => state.productKey);
  const pricing = useStore((state) => state.pricing);
  const loadingPricing = useStore((state) => state.loadingPricing);
  const progress = useStore((state) => state.progress);
  const lastOperation = useStore((state) => state.lastOperation);
  const step = useStore((state) => state.step);
  const error = useStore((state) => state.error);
  const loadProducts = useStore((state) => state.loadProducts);
  const reloadPricing = useStore((state) => state.reloadPricing);

  // Writing and its outcome take the whole workspace: nothing else may be
  // edited while Google is being written to, and a result must be read.
  if (progress) return <ProgressView />;
  if (lastOperation) return <ResultView />;

  if (!productsLoaded) {
    return <TableSkeleton rows={10} label={t('workspace.loadingProducts')} />;
  }

  if (!products.length) {
    if (unavailable.length || error) {
      return (
        <div className="flex flex-col gap-3 p-4">
          <h1 className="text-title font-semibold text-ink-900">{t('workspace.listFailed.title')}</h1>
          {error && <ErrorPanel error={error} onRetry={() => void loadProducts()} />}
          {!error && <ProductBar />}
          {!error && (
            <Button icon="refresh" onClick={() => void loadProducts()}>
              {t('action.reload')}
            </Button>
          )}
        </div>
      );
    }
    return (
      <EmptyState
        icon="tag"
        title={t('workspace.noProducts.title')}
        body={t('workspace.noProducts.body')}
        action={
          <Button icon="refresh" onClick={() => void loadProducts()}>
            {t('action.reload')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ProductBar />
      <PackageCheck />
      {!productKey ? (
        <EmptyState icon="tag" title={t('workspace.chooseProduct.title')} body={t('workspace.chooseProduct.body')} />
      ) : !pricing ? (
        loadingPricing ? (
          <TableSkeleton rows={10} label={t('workspace.loadingPrices')} />
        ) : error ? (
          <div className="p-4">
            <ErrorPanel error={error} onRetry={() => void reloadPricing()} />
          </div>
        ) : null
      ) : (
        <>
          <Stepper />
          <div className="flex min-h-0 flex-1 flex-col">
            {step === 'strategy' && <StrategyStep />}
            {step === 'markets' && <MarketsStep />}
            {step === 'review' && <ReviewStep />}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A package name read from the page is a guess until the user says it is
 * right: pricing the wrong app is the costliest mistake Pinto could make.
 */
function PackageCheck() {
  const t = useT();
  const context = useStore((state) => state.context);
  const setPackageName = useStore((state) => state.setPackageName);
  const setView = useStore((state) => state.setView);
  if (context?.packageNameSource !== 'page' || !context.packageName) return null;
  return (
    <div className="shrink-0 border-b border-ink-200 bg-white px-4 py-2.5">
      <Callout
        tone="info"
        title={t('workspace.package.detectedTitle', { package: context.packageName })}
        action={
          <>
            <Button size="sm" variant="primary" onClick={() => void setPackageName(context.packageName!)}>
              {t('workspace.package.confirm')}
            </Button>
            <Button size="sm" onClick={() => setView('settings')}>
              {t('workspace.package.change')}
            </Button>
          </>
        }
      >
        {t('workspace.package.detectedBody')}
      </Callout>
    </div>
  );
}
