/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { unitsToMicros } from '@/domain/money/money';
import { NEUTRAL_CONFIG } from '@/app/store/composer';
import type { OperationRecord } from '@/types';
import {
  PACKAGE,
  type FakeWorker,
  type Panel,
  createWorker,
  price,
  renderPanel,
  workspace,
} from './panelHarness';

/**
 * History is where a change is undone. Restoring shows the prices it puts
 * back, skips countries edited since (unless asked), and clearing the history
 * — which destroys every restore point — asks first.
 */

const HOUR = 3_600_000;

/** Raised US and FR; FR was edited back by hand since, so it has drifted. */
function raise(): OperationRecord {
  return {
    id: 'op-raise',
    timestamp: Date.now() - 2 * HOUR,
    packageName: PACKAGE,
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    config: { ...NEUTRAL_CONFIG, strategy: { kind: 'percentage', percent: 10 } },
    requested: 2,
    regionsAffected: 2,
    status: 'succeeded',
    snapshot: [price('US', 'USD', 4.49), price('FR', 'EUR', 4.49)],
    written: { US: unitsToMicros(4.99), FR: unitsToMicros(5.49) },
    failures: [],
  };
}

function simulation(): OperationRecord {
  return { ...raise(), id: 'op-sim', timestamp: Date.now() - HOUR, status: 'dry-run', written: undefined };
}

async function openHistory(records: OperationRecord[]): Promise<{ panel: Panel; worker: FakeWorker }> {
  const worker = createWorker();
  worker.history = records;
  const panel = await renderPanel(worker);
  await workspace(panel);
  await panel.user.click(screen.getByRole('button', { name: panel.t('workspace.header.history') }));
  await screen.findByRole('heading', { level: 1, name: panel.t('workspace.header.history') });
  return { panel, worker };
}

async function openRestore(panel: Panel): Promise<HTMLElement> {
  await panel.user.click(await screen.findByRole('button', { name: panel.t('history.restore.action') }));
  const dialog = screen.getByRole('dialog', { name: panel.t('history.restore.title') });
  await waitFor(() => expect(panel.useStore.getState().loadingPricing).toBe(false));
  return dialog;
}

describe('the history list', () => {
  it('describes each operation in words, newest first, and offers restore only for real writes', async () => {
    const { panel } = await openHistory([raise(), simulation()]);
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(within(articles[0]!).getByText(panel.t('operation.status.dry-run'))).toBeTruthy();
    expect(within(articles[1]!).getByText(panel.t('operation.status.succeeded'))).toBeTruthy();
    expect(within(articles[1]!).getByText(panel.t('history.record.countries', { affected: 2, count: 2 }))).toBeTruthy();
    expect(screen.getAllByRole('button', { name: panel.t('history.restore.action') })).toHaveLength(1);
  });

  it('says so when there is nothing yet', async () => {
    const { panel } = await openHistory([]);
    expect(await screen.findByText(panel.t('history.empty.title'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: panel.t('history.clear.action') })).toBeNull();
  });

  it('goes back to the workspace', async () => {
    const { panel } = await openHistory([]);
    await panel.user.click(screen.getByRole('button', { name: panel.t('action.back') }));
    await workspace(panel);
  });
});

describe('restoring', () => {
  it('skips countries changed since by default, and restores the rest', async () => {
    const { panel, worker } = await openHistory([raise()]);
    const dialog = await openRestore(panel);

    expect(within(dialog).getByText(panel.t('history.restore.drift.title', { count: 1 }))).toBeTruthy();
    expect(within(dialog).getByText(panel.t('history.restore.row.skipped'))).toBeTruthy();
    const drift = within(dialog).getByRole('checkbox', { name: panel.t('history.restore.drift.include', { count: 1 }) });
    expect((drift as HTMLInputElement).checked).toBe(false);

    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('history.restore.confirm', { count: 1 }) }));

    expect(await screen.findByRole('heading', { level: 1, name: panel.t('review.result.restored.title') })).toBeTruthy();
    expect(worker.sent('history/revert')[0]).toEqual({ type: 'history/revert', operationId: 'op-raise', regions: ['US'] });
    expect(worker.prices.get('US')!.micros).toBe(unitsToMicros(4.49));
    expect(worker.prices.get('FR')!.micros).toBe(unitsToMicros(4.99));
  });

  it('overwrites the drifted countries too when asked', async () => {
    const { panel, worker } = await openHistory([raise()]);
    const dialog = await openRestore(panel);
    await panel.user.click(within(dialog).getByRole('checkbox', { name: panel.t('history.restore.drift.include', { count: 1 }) }));
    expect(within(dialog).getByText(panel.t('history.restore.row.overwritten'))).toBeTruthy();

    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('history.restore.confirm', { count: 2 }) }));
    await screen.findByRole('heading', { level: 1, name: panel.t('review.result.restored.title') });
    expect(worker.sent('history/revert')[0]).toEqual({ type: 'history/revert', operationId: 'op-raise' });
  });

  it('restores nothing when cancelled', async () => {
    const { panel, worker } = await openHistory([raise()]);
    const dialog = await openRestore(panel);
    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('action.cancel') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(worker.sent('history/revert')).toHaveLength(0);
  });

  it('warns when the operation was on another product and cannot be compared', async () => {
    const other = { ...raise(), productId: 'lifetime', basePlanId: 'buy', kind: 'onetime' as const };
    const { panel } = await openHistory([other]);
    const dialog = await openRestore(panel);
    expect(within(dialog).getByText(panel.t('history.restore.otherProduct.title', { count: 2 }))).toBeTruthy();
  });

  it('marks a restored operation and offers to undo the restore instead', async () => {
    const { panel } = await openHistory([raise()]);
    const dialog = await openRestore(panel);
    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('history.restore.confirm', { count: 1 }) }));
    await panel.user.click(await screen.findByRole('button', { name: panel.t('action.done') }));
    await panel.user.click(screen.getByRole('button', { name: panel.t('workspace.header.history') }));

    expect(await screen.findByText(panel.t('operation.reverted'))).toBeTruthy();
    expect(screen.getByRole('button', { name: panel.t('history.restore.undoRestore') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: panel.t('history.restore.action') })).toBeNull();
  });
});

describe('clearing the history', () => {
  it('asks first, then deletes every record', async () => {
    const { panel, worker } = await openHistory([raise(), simulation()]);
    await panel.user.click(screen.getByRole('button', { name: panel.t('history.clear.action') }));

    const dialog = screen.getByRole('dialog', { name: panel.t('history.clear.title') });
    expect(within(dialog).getByText(panel.t('history.clear.body', { count: 2 }))).toBeTruthy();
    expect(worker.sent('history/clear')).toHaveLength(0);
    await panel.user.click(within(dialog).getByRole('button', { name: panel.t('history.clear.confirm') }));

    expect(await screen.findByText(panel.t('history.empty.title'))).toBeTruthy();
    expect(worker.sent('history/clear')).toHaveLength(1);
    expect(await screen.findByText(panel.t('history.cleared'))).toBeTruthy();
  });

  it('keeps everything when cancelled', async () => {
    const { panel, worker } = await openHistory([raise()]);
    await panel.user.click(screen.getByRole('button', { name: panel.t('history.clear.action') }));
    await panel.user.click(screen.getByRole('button', { name: panel.t('action.cancel') }));
    expect(worker.sent('history/clear')).toHaveLength(0);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});
