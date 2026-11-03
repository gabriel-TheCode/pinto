/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, type Mock } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { formatter } from '@/i18n';
import type { ApplyProgress } from '@/services/messages';
import type { RegionalPrice } from '@/types';
import {
  DEFAULT_PRICES,
  type FakeWorker,
  type Panel,
  chooseKind,
  choosePercent,
  createWorker,
  price,
  renderPanel,
  startsWith,
  toMarkets,
  toReview,
  workspace,
} from './panelHarness';

/**
 * Step 3 and what follows it. Nothing reaches Google Play without passing
 * through Review; problems come first and must be acknowledged; a large write
 * is typed, not clicked; and the outcome says exactly what happened.
 */

async function reviewRaise(
  prices: RegionalPrice[] = DEFAULT_PRICES,
  setup: (worker: FakeWorker) => void = () => undefined,
): Promise<{ panel: Panel; worker: FakeWorker }> {
  const worker = createWorker(prices);
  setup(worker);
  const panel = await renderPanel(worker);
  await workspace(panel);
  await choosePercent(panel, '10');
  await toMarkets(panel);
  await toReview(panel);
  return { panel, worker };
}

/** US loses 80 % (to check), FR would go negative (blocked), DE changes normally, JP rounds back to 800. */
const PROBLEM_PRICES = [
  price('US', 'USD', 4.99),
  price('FR', 'EUR', 2.99),
  price('DE', 'EUR', 9.99),
  price('JP', 'JPY', 800),
];

async function reviewProblems(): Promise<{ panel: Panel; worker: FakeWorker }> {
  const worker = createWorker(PROBLEM_PRICES);
  const panel = await renderPanel(worker);
  await workspace(panel);
  await chooseKind(panel, 'formula');
  const field = screen.getByLabelText(panel.t('strategy.formula.label'));
  await panel.user.clear(field);
  await panel.user.type(field, 'current - 4');
  await toMarkets(panel);
  await toReview(panel);
  return { panel, worker };
}

const applyButton = (panel: Panel, count: number) =>
  screen.getByRole('button', { name: startsWith(panel.t('review.apply', { count })) }) as HTMLButtonElement;

/** Pushes a progress event the way the worker does, through runtime messages. */
function pushProgress(progress: ApplyProgress) {
  const calls = (chrome.runtime.onMessage.addListener as Mock).mock.calls;
  const listener = calls[calls.length - 1]![0] as (message: unknown) => void;
  act(() => listener({ type: 'apply/progress', progress }));
}

describe('what Review shows', () => {
  it('states the change, the product and the count', async () => {
    const { panel } = await reviewRaise();
    // In the stepper and in the review header.
    expect(screen.getAllByText(panel.t('strategy.summary.percentage', { delta: formatter('en').delta(0.1) }))).toHaveLength(2);
    const heading = screen.getByRole('heading', { level: 1, name: panel.t('review.title') });
    expect(heading.parentElement!.parentElement!.textContent).toContain('premium · monthly');
    expect(within(screen.getByRole('list', { name: panel.t('review.filter.changing') })).getAllByRole('listitem')).toHaveLength(4);
    expect(applyButton(panel, 4).disabled).toBe(false);
  });

  it('puts blocked countries first and says the rest still applies', async () => {
    const { panel } = await reviewProblems();
    expect(screen.getByText(panel.t('review.blocked.title', { count: 1 }))).toBeTruthy();
    expect(screen.getByText(panel.t('review.blocked.body'))).toBeTruthy();
    // The blocked filter is selected on arrival, and lists France with its reason.
    const blocked = screen.getByRole('list', { name: panel.t('review.filter.blocked') });
    expect(within(blocked).getByText('France')).toBeTruthy();
    expect(within(blocked).getByText(panel.t('issue.not-positive'))).toBeTruthy();
  });

  it('asks for an acknowledgement before applying prices that need a look', async () => {
    const { panel } = await reviewProblems();
    expect(screen.getByText(panel.t('review.check.title', { count: 1 }))).toBeTruthy();
    const apply = applyButton(panel, 2);
    expect(apply.disabled).toBe(true);

    await panel.user.click(screen.getByRole('button', { name: panel.t('review.check.show') }));
    const check = screen.getByRole('list', { name: panel.t('review.filter.check') });
    expect(within(check).getByText('United States')).toBeTruthy();

    await panel.user.click(screen.getByRole('checkbox', { name: panel.t('review.check.confirm', { count: 1 }) }));
    expect(apply.disabled).toBe(false);
    await panel.user.click(screen.getByRole('checkbox', { name: panel.t('review.check.confirm', { count: 1 }) }));
    expect(apply.disabled).toBe(true);
  });

  it('never writes a blocked country', async () => {
    const { panel, worker } = await reviewProblems();
    await panel.user.click(screen.getByRole('checkbox', { name: panel.t('review.check.confirm', { count: 1 }) }));
    await panel.user.click(applyButton(panel, 2));
    await screen.findByRole('heading', { level: 1, name: panel.t('review.result.succeeded.title') });
    expect(Object.keys(worker.sent('pricing/apply')[0]!.request.updates).sort()).toEqual(['DE', 'US']);
  });
});

describe('confirming a large write', () => {
  const MANY = ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT',
    'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'JP', 'KR', 'IN', 'ID', 'AU'].map((code) =>
    price(code, 'USD', 4.99),
  );

  it('asks for the count to be typed from 25 countries', async () => {
    const { panel, worker } = await reviewRaise(MANY);
    await panel.user.click(applyButton(panel, 30));

    const dialog = screen.getByRole('dialog', { name: panel.t('review.confirm.title', { count: 30 }) });
    const confirm = within(dialog).getByRole('button', { name: panel.t('review.apply', { count: 30 }) }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    const field = within(dialog).getByLabelText(panel.t('review.confirm.type', { number: '30' }));
    await panel.user.type(field, '29');
    expect(confirm.disabled).toBe(true);
    await panel.user.clear(field);
    await panel.user.type(field, '30');
    expect(confirm.disabled).toBe(false);
    expect(worker.sent('pricing/apply')).toHaveLength(0);

    await panel.user.click(confirm);
    await screen.findByRole('heading', { level: 1, name: panel.t('review.result.succeeded.title') });
    expect(Object.keys(worker.sent('pricing/apply')[0]!.request.updates)).toHaveLength(30);
  });

  it('writes nothing when the dialog is cancelled', async () => {
    const { panel, worker } = await reviewRaise(MANY);
    await panel.user.click(applyButton(panel, 30));
    await panel.user.click(screen.getByRole('button', { name: panel.t('action.cancel') }));
    expect(worker.sent('pricing/apply')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: panel.t('review.title') })).toBeTruthy();
  });

  it('applies a small write directly', async () => {
    const { panel, worker } = await reviewRaise();
    await panel.user.click(applyButton(panel, 4));
    expect(screen.queryByRole('dialog')).toBeNull();
    await screen.findByRole('heading', { level: 1, name: panel.t('review.result.succeeded.title') });
    expect(worker.sent('pricing/apply')).toHaveLength(1);
  });
});

describe('simulating', () => {
  it('records a dry run and sends nothing to Google Play', async () => {
    const { panel, worker } = await reviewRaise();
    await panel.user.click(screen.getByRole('button', { name: panel.t('review.simulate') }));

    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.result.dryRun.title') })).toBeTruthy();
    expect(screen.getByText(panel.t('review.result.dryRun.body', { count: 4 }))).toBeTruthy();
    expect(worker.sent('pricing/apply')[0]!.request.dryRun).toBe(true);
    // Prices are untouched, and no undo is offered for a simulation.
    expect(worker.prices.get('US')!.micros).toBe(4_990_000);
    expect(screen.queryByRole('button', { name: panel.t('review.result.undo') })).toBeNull();
  });

  it('leads back to Review to apply for real, with the same change', async () => {
    const { panel } = await reviewRaise();
    await panel.user.click(screen.getByRole('button', { name: panel.t('review.simulate') }));
    await panel.user.click(await screen.findByRole('button', { name: panel.t('review.result.applyForReal') }));
    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.title') })).toBeTruthy();
    expect(applyButton(panel, 4).disabled).toBe(false);
  });
});

describe('applying', () => {
  it('shows each phase while Google Play is written, then the confirmed result', async () => {
    const { panel, worker } = await reviewRaise();
    const release = worker.hold('pricing/apply');
    await panel.user.click(applyButton(panel, 4));

    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.progress.title') })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: panel.t('review.progress.title') })).toBeTruthy();
    expect(screen.getByText(panel.t('review.progress.phase.preparing'))).toBeTruthy();
    // Isolating is only listed once it happens.
    expect(screen.queryByText(panel.t('review.progress.phase.isolating'))).toBeNull();
    // Side trips that could start another write are locked meanwhile.
    expect((screen.getByRole('button', { name: panel.t('workspace.header.history') }) as HTMLButtonElement).disabled).toBe(true);

    pushProgress({ phase: 'writing', completed: 2, total: 4 });
    expect(screen.getByText(panel.t('review.progress.count', { completed: 2, total: 4 }))).toBeTruthy();
    pushProgress({ phase: 'isolating', completed: 2, total: 4, rejected: 1 });
    expect(screen.getByText(panel.t('review.progress.phase.isolating'))).toBeTruthy();
    expect(screen.getByText(panel.t('review.progress.rejected', { count: 1 }))).toBeTruthy();
    pushProgress({ phase: 'verifying', completed: 4, total: 4 });
    expect(screen.getByText(panel.t('review.progress.phase.verifying')).closest('li')!.getAttribute('aria-current')).toBe('step');

    release();
    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.result.succeeded.title') })).toBeTruthy();
    expect(screen.getByText(panel.t('review.result.succeeded.body', { count: 4 }))).toBeTruthy();
    expect(worker.prices.get('US')!.micros).toBeGreaterThan(4_990_000);
  });

  it('Done goes back to step 1 with no change, so the raise does not compound', async () => {
    const { panel } = await reviewRaise();
    await panel.user.click(applyButton(panel, 4));
    await panel.user.click(await screen.findByRole('button', { name: panel.t('action.done') }));

    await workspace(panel);
    expect(screen.getByText(panel.t('workspace.summary.none'))).toBeTruthy();
    expect(panel.useStore.getState().config.strategy).toEqual({ kind: 'percentage', percent: 0 });
    // The change just applied is offered — not armed — for next time.
    expect(screen.getByRole('button', { name: panel.t('strategy.recent.use') })).toBeTruthy();
  });

  it('names every country that failed, with the reason, and puts them back into review', async () => {
    const { panel } = await reviewRaise(DEFAULT_PRICES, (worker) => worker.reject.add('JP'));
    await panel.user.click(applyButton(panel, 4));

    expect(
      await screen.findByRole('heading', { level: 1, name: panel.t('review.result.partial.title', { ok: 3, count: 4 }) }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: panel.t('review.result.failures', { count: 1 }) })).toBeTruthy();
    expect(screen.getByText(panel.t('error.api.region-not-configured.title', { region: 'Japan' }))).toBeTruthy();

    await panel.user.click(screen.getByRole('button', { name: panel.t('review.result.reviewFailed') }));
    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.title') })).toBeTruthy();
    expect([...panel.useStore.getState().selection]).toEqual(['JP']);
  });

  it('says when Google accepted the write but it could not be confirmed', async () => {
    const { panel } = await reviewRaise(DEFAULT_PRICES, (worker) => (worker.outcome = 'unverified'));
    await panel.user.click(applyButton(panel, 4));
    expect(
      await screen.findByRole('heading', { level: 1, name: panel.t('review.result.unverified.title', { count: 4 }) }),
    ).toBeTruthy();
    expect(screen.getByText(panel.t('review.result.unverified.body'))).toBeTruthy();
  });

  it('offers to undo, showing the prices it puts back', async () => {
    const { panel, worker } = await reviewRaise();
    await panel.user.click(applyButton(panel, 4));
    await panel.user.click(await screen.findByRole('button', { name: panel.t('review.result.undo') }));

    const dialog = screen.getByRole('dialog', { name: panel.t('review.result.undo.title', { count: 4 }) });
    expect(within(dialog).getByText('Japan')).toBeTruthy();
    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('review.result.restoreConfirm', { count: 4 }) }));

    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.result.restored.title') })).toBeTruthy();
    expect(worker.sent('history/revert')[0]!.operationId).toBe(worker.history.find((op) => op.revertedBy)!.id);
    expect(worker.prices.get('US')!.micros).toBe(4_990_000);
  });

  it('keeps the change after a write that failed outright, since nothing changed', async () => {
    const { panel } = await reviewRaise(DEFAULT_PRICES, (worker) => (worker.outcome = 'failed'));
    await panel.user.click(applyButton(panel, 4));
    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.result.failed.title') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: panel.t('review.result.undo') })).toBeNull();
    await panel.user.click(screen.getByRole('button', { name: panel.t('action.done') }));
    await workspace(panel);
    expect(panel.useStore.getState().config.strategy).toEqual({ kind: 'percentage', percent: 10 });
  });

  it('Ctrl+Enter applies from Review', async () => {
    const { panel, worker } = await reviewRaise();
    await panel.user.keyboard('{Control>}{Enter}{/Control}');
    await screen.findByRole('heading', { level: 1, name: panel.t('review.result.succeeded.title') });
    expect(worker.sent('pricing/apply')[0]!.request.dryRun).toBe(false);
  });

  it('shows the error and keeps the review when the write is refused outright', async () => {
    const { panel } = await reviewRaise(DEFAULT_PRICES, (worker) => {
      worker.failures['pricing/apply'] = { code: 'api/forbidden', message: 'E_FORBIDDEN', retryable: false };
    });
    await panel.user.click(applyButton(panel, 4));
    expect(await screen.findByText(panel.t('error.api.forbidden.title'))).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: panel.t('review.title') })).toBeTruthy());
  });
});
