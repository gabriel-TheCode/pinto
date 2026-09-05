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

  // Let the conversion table land and React paint before the shot is taken.
  await new Promise((resolve) => setTimeout(resolve, 400));
}

/** The signal every capture script waits on, instead of a guessed delay. */
export function markReady(): void {
  document.documentElement.setAttribute('data-ready', 'true');
}
