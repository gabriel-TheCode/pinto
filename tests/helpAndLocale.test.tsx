/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import {
  SETTINGS_KEY,
  type Panel,
  choosePercent,
  createWorker,
  en,
  fr,
  freshModules,
  installWorker,
  renderPanel,
  startsWith,
  workspace,
} from './panelHarness';

/**
 * Help explains the job in the order it happens, and the language switch in
 * Settings re-renders everything at once — chrome, open screen, toasts — and
 * is remembered for every Pinto surface.
 */

async function openSettings(panel: Panel) {
  await panel.user.click(screen.getByRole('button', { name: panel.t('workspace.header.settings') }));
  await screen.findByRole('heading', { level: 1, name: panel.t('workspace.header.settings') });
}

async function storedLocale(): Promise<unknown> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return (stored[SETTINGS_KEY] as { locale?: unknown } | undefined)?.locale;
}

describe('Help', () => {
  it('is reachable from the header and explains the job end to end', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await panel.user.click(screen.getByRole('button', { name: en('workspace.header.help') }));

    expect(await screen.findByRole('heading', { level: 1, name: en('workspace.header.help') })).toBeTruthy();
    for (const key of [
      'help.intro.title',
      'help.before.title',
      'help.steps.title',
      'help.strategies.title',
      'strategy.tiers.name',
      'help.safety.title',
      'help.messages.title',
      'help.panel.title',
    ] as const) {
      expect(screen.getByRole('heading', { level: 2, name: en(key) }), key).toBeTruthy();
    }
  });

  it('names the steps and strategies exactly as the workspace does', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await panel.user.click(screen.getByRole('button', { name: en('workspace.header.help') }));
    const steps = screen.getByRole('heading', { level: 2, name: en('help.steps.title') }).closest('section')!;
    for (const key of ['workspace.step.strategy', 'workspace.step.markets', 'workspace.step.review'] as const) {
      expect(within(steps).getByText(en(key))).toBeTruthy();
    }
    const kinds = screen.getByRole('heading', { level: 2, name: en('help.strategies.title') }).closest('section')!;
    expect(within(kinds).getByText(en('strategy.formula.name'))).toBeTruthy();
  });

  it('states the caveat on the purchasing-power bands where the feature is explained', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await panel.user.click(screen.getByRole('button', { name: en('workspace.header.help') }));
    expect(screen.getByText(en('band.basis'))).toBeTruthy();
  });

  it('is left with its back button, and the header toggles it', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    const help = screen.getByRole('button', { name: en('workspace.header.help') });
    await panel.user.click(help);
    expect(help.getAttribute('aria-current')).toBe('page');
    await panel.user.click(screen.getByRole('button', { name: en('action.back') }));
    await workspace(panel);
  });
});

describe('language', () => {
  it('switches the whole interface to French at once, and stores the choice', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    await choosePercent(panel, '10');
    act(() => panel.toast({ key: 'history.cleared' }, 'success'));
    await openSettings(panel);

    await panel.user.click(screen.getByRole('radio', { name: 'Français' }));

    // The open screen, the header and a toast already on screen.
    expect(await screen.findByRole('heading', { level: 1, name: fr('workspace.header.settings') })).toBeTruthy();
    expect(screen.getByRole('button', { name: fr('workspace.header.history') })).toBeTruthy();
    expect(screen.getByRole('button', { name: fr('workspace.header.help') })).toBeTruthy();
    expect(screen.getByText(fr('history.cleared'))).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: fr('settings.language.title') })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Français' }).getAttribute('aria-checked')).toBe('true');

    expect(await storedLocale()).toBe('fr');
    await waitFor(() => expect(document.documentElement.lang).toBe('fr'));

    // Back in the workspace, the step and its numbers speak French too.
    await panel.user.click(screen.getByRole('button', { name: fr('action.back') }));
    expect(await screen.findByRole('heading', { level: 1, name: fr('strategy.title') })).toBeTruthy();
    expect(screen.getByText(fr('workspace.summary.changes', { count: 4 }))).toBeTruthy();
    expect(screen.getByRole('button', { name: startsWith(fr('workspace.next.markets')) })).toBeTruthy();
    // The typed value is shown in the French convention, and kept.
    expect((screen.getByLabelText(fr('strategy.percentage.label')) as HTMLInputElement).value).toBe('10');
  });

  it('goes back to English', async () => {
    const panel = await renderPanel(createWorker(), { locale: 'fr' });
    await screen.findByRole('heading', { level: 1, name: fr('strategy.title') });
    await panel.user.click(screen.getByRole('button', { name: fr('workspace.header.settings') }));
    await panel.user.click(await screen.findByRole('radio', { name: 'English' }));

    expect(await screen.findByRole('heading', { level: 1, name: en('workspace.header.settings') })).toBeTruthy();
    expect(await storedLocale()).toBe('en');
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
  });

  it('follows the browser on Automatic', async () => {
    const panel = await renderPanel(createWorker(), { locale: 'fr' });
    await screen.findByRole('heading', { level: 1, name: fr('strategy.title') });
    await panel.user.click(screen.getByRole('button', { name: fr('workspace.header.settings') }));
    await panel.user.click(await screen.findByRole('radio', { name: fr('settings.language.auto') }));

    // jsdom's browser language is English.
    expect(await screen.findByRole('heading', { level: 1, name: en('workspace.header.settings') })).toBeTruthy();
    expect(screen.getByText(en('settings.language.browser', { language: 'English' }))).toBeTruthy();
    expect(await storedLocale()).toBe('auto');
  });

  it('restores the stored language on boot, before anything else is chosen', async () => {
    installWorker(createWorker());
    const modules = await freshModules();
    await chrome.storage.local.set({ [SETTINGS_KEY]: { locale: 'fr' } });
    render(<modules.App />);

    expect(await screen.findByRole('heading', { level: 1, name: fr('strategy.title') })).toBeTruthy();
    expect(document.documentElement.lang).toBe('fr');
  });

  it('follows a change made in another Pinto surface', async () => {
    const panel = await renderPanel(createWorker());
    await workspace(panel);
    // The popup or the launcher writes the preference; the panel hears it.
    await act(() => chrome.storage.local.set({ [SETTINGS_KEY]: { locale: 'fr' } }));
    expect(await screen.findByRole('heading', { level: 1, name: fr('strategy.title') })).toBeTruthy();
  });

  it('can be chosen before signing in', async () => {
    const worker = createWorker();
    worker.signedIn = false;
    const panel = await renderPanel(worker);
    await screen.findByRole('button', { name: en('onboarding.signIn.action') });
    await panel.user.click(screen.getByRole('radio', { name: 'Français' }));
    expect(await screen.findByRole('button', { name: fr('onboarding.signIn.action') })).toBeTruthy();
    expect(await storedLocale()).toBe('fr');
  });
});
