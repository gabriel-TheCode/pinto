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

  if (options.strategy === 'tiers') {
    const { generateLadder } = await import('@/domain/regions/economicBands');
    const regions = useStore.getState().pricing!.prices.map((price) => price.regionCode);
    useStore.getState().setConfig({
      strategy: generateLadder({
        curve: options.curve ?? 'balanced',
        baseRegion: 'US',
        anchorMicros: 4_990_000,
        restrictTo: regions,
      }),
    });
  }

  if (options.screen) useStore.getState().setScreen(options.screen as never);

  /*
   * Wait for Google's conversion table, rather than sleeping and hoping.
   * ensureConversion() is async, so a fixed delay caught it on some runs and
   * not others — and the two sources round a rate differently, so the same
   * command produced different images. Whichever source a shot ends up using
   * has to be the same one every time.
   */
  await waitFor(() => useStore.getState().conversionTable != null, 5_000);

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
