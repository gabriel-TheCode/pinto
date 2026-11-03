/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  PACKAGE,
  choosePercent,
  context,
  createWorker,
  en as t,
  error,
  renderPanel,
  startsWith,
  workspace,
} from './panelHarness';

/**
 * The panel mounts and moves through its gates — booting, signed out, wrong
 * page, unknown app — to the workspace, which opens on step 1 with nothing
 * armed. These are the screens a user gets stuck on when something is wrong,
 * so each is asserted rather than assumed.
 */

describe('gates', () => {
  it('shows a loading skeleton until the worker answers', async () => {
    const worker = createWorker();
    const release = worker.hold('auth/state');
    const panel = await renderPanel(worker);

    expect(screen.getByRole('status', { name: t('workspace.loading') })).toBeTruthy();
    release();
    await workspace(panel);
    expect(screen.queryByRole('status', { name: t('workspace.loading') })).toBeNull();
  });

  it('offers sign-in when signed out with a client ID, and opens the workspace once signed in', async () => {
    const worker = createWorker();
    worker.signedIn = false;
    const panel = await renderPanel(worker);

    const signIn = await screen.findByRole('button', { name: t('onboarding.signIn.action') });
    expect((signIn as HTMLButtonElement).disabled).toBe(false);
    await panel.user.click(signIn);

    await workspace(panel);
    expect(worker.sent('auth/signIn')).toHaveLength(1);
  });

  it('walks a first-time user through the Cloud setup when no client ID exists', async () => {
    const worker = createWorker();
    worker.signedIn = false;
    worker.clientId = null;
    const panel = await renderPanel(worker);

    expect(await screen.findByRole('heading', { level: 1, name: t('onboarding.setup.title') })).toBeTruthy();
    const steps = screen.getByRole('list', { name: t('onboarding.setup.stepsLabel') });
    expect(within(steps).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    // Sign-in is not offered before a client exists.
    expect(screen.queryByRole('button', { name: t('onboarding.signIn.action') })).toBeNull();

    const field = screen.getByLabelText(t('onboarding.clientId.label'));
    await panel.user.type(field, 'GOCSPX-secret');
    await panel.user.tab();
    expect(screen.getByText(t('onboarding.clientId.invalid'))).toBeTruthy();

    await panel.user.clear(field);
    await panel.user.type(field, '123-abc.apps.googleusercontent.com');
    await panel.user.click(screen.getByRole('button', { name: t('onboarding.clientId.save') }));

    expect(await screen.findByRole('button', { name: t('onboarding.signIn.action') })).toBeTruthy();
    expect(worker.sent('auth/setClientId')[0]!.clientId).toBe('123-abc.apps.googleusercontent.com');
  });

  it('treats a cancelled Google window as a calm note, not an error', async () => {
    const worker = createWorker();
    worker.signedIn = false;
    worker.failures['auth/signIn'] = error('auth/cancelled');
    const panel = await renderPanel(worker);

    await panel.user.click(await screen.findByRole('button', { name: t('onboarding.signIn.action') }));

    const title = await screen.findByText(t('error.auth.cancelled.title'));
    expect(title.closest('[role]')!.getAttribute('role')).toBe('status');
    expect(screen.getByText(t('error.auth.cancelled.hint'))).toBeTruthy();
    await panel.user.click(screen.getByRole('button', { name: t('action.dismiss') }));
    expect(screen.queryByText(t('error.auth.cancelled.title'))).toBeNull();
  });

  it('says the extension cannot be reached, and retries', async () => {
    const worker = createWorker();
    worker.signedIn = null;
    const panel = await renderPanel(worker);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(t('error.runtime.disconnected.title'))).toBeTruthy();

    worker.signedIn = true;
    await panel.user.click(screen.getByRole('button', { name: t('action.retry') }));
    await workspace(panel);
  });

  it('explains itself on a page without prices instead of showing an empty table', async () => {
    const worker = createWorker();
    worker.context = context({ supported: false, productId: null, basePlanId: null });
    const panel = await renderPanel(worker);

    expect(await screen.findByRole('heading', { level: 1, name: t('onboarding.unsupported.title') })).toBeTruthy();
    await panel.user.click(screen.getByRole('button', { name: t('onboarding.unsupported.check') }));
    expect(await screen.findByText(t('onboarding.unsupported.still'))).toBeTruthy();

    worker.context = context();
    await panel.user.click(screen.getByRole('button', { name: t('onboarding.unsupported.check') }));
    await workspace(panel);
  });

  it('asks for the package name when it cannot be resolved, and validates it', async () => {
    const worker = createWorker();
    worker.context = context({ packageName: null, packageNameSource: null });
    const panel = await renderPanel(worker);

    expect(await screen.findByRole('heading', { level: 1, name: t('onboarding.package.title') })).toBeTruthy();
    const field = screen.getByLabelText(t('onboarding.package.label'));
    await panel.user.type(field, 'Not A Package');
    await panel.user.click(screen.getByRole('button', { name: t('onboarding.package.submit') }));
    expect(screen.getByText(t('onboarding.package.invalid'))).toBeTruthy();
    expect(worker.sent('context/setPackageName')).toHaveLength(0);

    await panel.user.clear(field);
    await panel.user.type(field, PACKAGE);
    await panel.user.click(screen.getByRole('button', { name: t('onboarding.package.submit') }));
    await workspace(panel);
    expect(worker.sent('context/setPackageName')[0]!.packageName).toBe(PACKAGE);
  });

  it('asks to confirm a package name read from the page before anything is priced', async () => {
    const worker = createWorker();
    worker.context = context({ packageNameSource: 'page' });
    const panel = await renderPanel(worker);
    await workspace(panel);

    expect(screen.getByText(t('workspace.package.detectedTitle', { package: PACKAGE }))).toBeTruthy();
    await panel.user.click(screen.getByRole('button', { name: t('workspace.package.confirm') }));
    await waitFor(() => expect(screen.queryByText(t('workspace.package.detectedTitle', { package: PACKAGE }))).toBeNull());
    expect(worker.sent('context/setPackageName')[0]!.packageName).toBe(PACKAGE);
  });

  it('closes the panel on Escape', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await panel.user.keyboard('{Escape}');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'panel/close' });
  });
});

describe('product catalogue', () => {
  it('never lets a failed listing look like "you have none"', async () => {
    const worker = createWorker();
    worker.unavailable = [{ kind: 'onetime', code: 'api/forbidden' }];
    const panel = await renderPanel(worker);
    await workspace(panel);

    expect(screen.getByText(t('workspace.product.unavailableGroupTitle', { count: 1 }))).toBeTruthy();
    expect(screen.getByText(t('workspace.product.unavailableNote'))).toBeTruthy();
    expect(screen.queryByText(t('workspace.product.noOneTime'))).toBeNull();
  });

  it('groups the listing failures in one notice that can be closed, and remembers it', async () => {
    const worker = createWorker();
    worker.unavailable = [
      { kind: 'inapp', code: 'api/forbidden' },
      { kind: 'onetime', code: 'unexpected', detail: 'TypeError: boom' },
    ];
    const panel = await renderPanel(worker);
    await workspace(panel);

    const title = t('workspace.product.unavailableGroupTitle', { count: 2 });
    expect(screen.getAllByText(title)).toHaveLength(1);
    expect(screen.getByText('TypeError: boom', { exact: false })).toBeTruthy();

    const notice = screen.getByText(title).closest('div.rounded-lg') as HTMLElement;
    await panel.user.click(within(notice).getByRole('button', { name: t('action.dismiss') }));
    await waitFor(() => expect(screen.queryByText(title)).toBeNull());
    // One of the two is a passing failure: closed here, reported next time.
    expect(worker.sent('settings/update').some((r) => 'dismissedNotices' in r.patch)).toBe(false);
  });

  it('remembers a closed notice when the failure is one that never changes', async () => {
    const worker = createWorker();
    worker.unavailable = [{ kind: 'inapp', code: 'api/forbidden' }];
    const panel = await renderPanel(worker);
    await workspace(panel);

    const title = t('workspace.product.unavailableGroupTitle', { count: 1 });
    const notice = screen.getByText(title).closest('div.rounded-lg') as HTMLElement;
    await panel.user.click(within(notice).getByRole('button', { name: t('action.dismiss') }));
    await waitFor(() => expect(screen.queryByText(title)).toBeNull());
    // Only the new id is sent: the worker adds it to what other tabs saved.
    expect(worker.sent('settings/update').at(-1)!.patch.dismissedNotices).toEqual([
      `${PACKAGE}:unavailable:inapp=api/forbidden`,
    ]);
  });

  it('offers one reload, not two, when nothing could be listed', async () => {
    const worker = createWorker();
    worker.products = [];
    worker.unavailable = [{ kind: 'subscription', code: 'api/server' }];
    await renderPanel(worker);
    await screen.findByText(t('workspace.listFailed.title'));

    expect(screen.queryByRole('button', { name: t('action.dismiss') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('action.retry') })).toBeNull();
    expect(screen.getAllByRole('button', { name: t('action.reload') })).toHaveLength(1);
  });

  it('keeps a closed notice closed on the next visit, and shows a different failure again', async () => {
    const worker = createWorker();
    worker.unavailable = [{ kind: 'inapp', code: 'api/forbidden' }];
    const settings = { dismissedNotices: [`${PACKAGE}:unavailable:inapp=api/forbidden`] };
    let panel = await renderPanel(worker, { settings });
    await workspace(panel);
    expect(screen.queryByText(t('workspace.product.unavailableGroupTitle', { count: 1 }))).toBeNull();
    cleanup();

    worker.unavailable = [{ kind: 'inapp', code: 'api/server' }];
    panel = await renderPanel(worker, { settings });
    await workspace(panel);
    expect(screen.getByText(t('workspace.product.unavailableGroupTitle', { count: 1 }))).toBeTruthy();
  });

  it('lets the "no one-time products" hint be closed', async () => {
    const worker = createWorker();
    const panel = await renderPanel(worker);
    await workspace(panel);
    const hint = screen.getByText(t('workspace.product.noOneTime'));
    await panel.user.click(within(hint.parentElement!).getByRole('button', { name: t('action.dismiss') }));
    await waitFor(() => expect(screen.queryByText(t('workspace.product.noOneTime'))).toBeNull());
  });

  it('says where to create a one-time product when the app genuinely has none', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    expect(screen.getByText(t('workspace.product.noOneTime'))).toBeTruthy();
  });

  it('offers a retry when the products cannot be listed', async () => {
    const worker = createWorker();
    worker.failures['products/list'] = error('api/forbidden');
    const panel = await renderPanel(worker);

    expect(await screen.findByRole('heading', { name: t('workspace.listFailed.title') })).toBeTruthy();
    delete worker.failures['products/list'];
    await panel.user.click(screen.getByRole('button', { name: t('action.retry') }));
    await workspace(panel);
  });
});

describe('step 1: the change', () => {
  it('opens on no change: nothing chosen, nothing to write, the next step locked', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);

    expect(screen.getByText(t('workspace.summary.none'))).toBeTruthy();
    const next = screen.getByRole('button', { name: startsWith(t('workspace.next.markets')) }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByText(t('strategy.next.hint'))).toBeTruthy();
    // No kind is pre-selected.
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLInputElement).checked).toBe(false);
    // The stepper says nothing is chosen, and Review cannot be opened yet.
    const steps = screen.getByRole('navigation', { name: t('workspace.steps.label') });
    expect(within(steps).getByText(t('workspace.step.strategy.empty'))).toBeTruthy();
    const review = within(steps).getByRole('button', { name: new RegExp(t('workspace.step.review')) });
    expect((review as HTMLButtonElement).disabled).toBe(true);
  });

  it('choosing Percentage alone still changes nothing', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await panel.user.click(screen.getByRole('radio', { name: startsWith(t('strategy.percentage.name')) }));

    expect(screen.getByText(t('workspace.summary.none'))).toBeTruthy();
    const next = screen.getByRole('button', { name: startsWith(t('workspace.next.markets')) }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('typing +10 % key by key arms the change and unlocks the countries step', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await choosePercent(panel, '10');

    expect((screen.getByLabelText(t('strategy.percentage.label')) as HTMLInputElement).value).toBe('10');
    expect(panel.useStore.getState().config.strategy).toEqual({ kind: 'percentage', percent: 10 });
    expect(screen.getByText(t('workspace.summary.changes', { count: 4 }))).toBeTruthy();
    const next = screen.getByRole('button', { name: startsWith(t('workspace.next.markets')) }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    // The stepper now summarises the decision.
    const steps = screen.getByRole('navigation', { name: t('workspace.steps.label') });
    expect(within(steps).getByText(t('workspace.step.review.summary', { count: 4 }))).toBeTruthy();
  });

  it('Ctrl+Enter moves on from the field being typed in, and only once a change is armed', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await panel.user.keyboard('{Control>}{Enter}{/Control}');
    expect(screen.getByRole('heading', { level: 1, name: t('strategy.title') })).toBeTruthy();

    await choosePercent(panel, '10');
    await panel.user.keyboard('{Control>}{Enter}{/Control}');
    expect(await screen.findByRole('heading', { level: 1, name: t('markets.title') })).toBeTruthy();
  });

  it('previews the effect before any country is chosen', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await choosePercent(panel, '10');

    expect(screen.getByRole('heading', { name: t('strategy.preview.title') })).toBeTruthy();
    expect(screen.getByText(t('strategy.preview.count', { count: 4 }))).toBeTruthy();
  });
});
