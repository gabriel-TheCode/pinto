/**
 * Drives the app into the state a capture wants, without clicking anything.
 *
 * Every shot is one page load with a query parameter, so the images are
 * reproducible and no capture depends on a script finding a button. The store
 * is imported lazily because it reads `chrome` at module load — the stub has to
 * be installed first.
 */
export async function poseStore(options: {
  screen?: string | null;
  strategy?: string | null;
  curve?: 'flat' | 'gentle' | 'balanced' | 'aggressive';
}): Promise<void> {
  const { useStore } = await import('@/app/store');

  // Boot has to settle first, or loadProducts overwrites what we just set.
  await new Promise<void>((resolve) => {
    if (useStore.getState().pricing) return resolve();
    const stop = useStore.subscribe((state) => {
      if (state.pricing) {
        stop();
        resolve();
      }
    });
  });

  const store = useStore.getState();
  const regions = store.pricing!.prices.map((price) => price.regionCode);

  if (options.strategy === 'tiers') {
    const { generateLadder } = await import('@/domain/regions/economicBands');
    const { translator } = await import('@/i18n');
    const { useI18n } = await import('@/i18n/react');
    const { bandName } = await import('@/i18n/describe');
    const t = translator(useI18n.getState().locale);
    const ladder = generateLadder({
      curve: options.curve ?? 'balanced',
      baseRegion: 'US',
      anchorMicros: 4_990_000,
      restrictTo: regions,
      nameOf: (band) => bandName(t, band.id, band.label),
    });
    store.setStrategy(ladder);
    store.setSelection(Object.keys(ladder.assignment));
  }
  if (options.strategy === 'percentage') {
    store.setStrategy({ kind: 'percentage', percent: 10 });
  }

  // `screen` is a step of the workspace or one of the side views.
  const steps = ['strategy', 'markets', 'review'];
  const views = ['history', 'settings', 'help'];
  if (options.screen && steps.includes(options.screen)) store.setStep(options.screen as never);
  if (options.screen && views.includes(options.screen)) {
    if (options.screen === 'history') await store.loadHistory();
    store.setView(options.screen as never);
  }
  if (options.screen === 'result') {
    await store.loadHistory();
    const [latest] = useStore.getState().history;
    if (latest) useStore.setState({ lastOperation: latest });
  }

  /*
   * Wait for Google's conversion table, rather than sleeping and hoping.
   * ensureConversion() is async, so a fixed delay caught it on some runs and
   * not others — and the two sources round a rate differently, so the same
   * command produced different images. Whichever source a shot ends up using
   * has to be the same one every time.
   */
  const { conversionKeyOf } = await import('@/app/store');
  if (conversionKeyOf(useStore.getState())) {
    await useStore.getState().ensureConversion();
    await waitFor(() => useStore.getState().conversionTable != null, 5_000);
  }

  // Then let React paint what just landed.
  await new Promise((resolve) => setTimeout(resolve, 400));
}

/** Resolves when `predicate` holds, or after `timeout` — never hangs a run. */
async function waitFor(predicate: () => boolean, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** The signal every capture script waits on, instead of a guessed delay. */
export function markReady(): void {
  document.documentElement.setAttribute('data-ready', 'true');
}
