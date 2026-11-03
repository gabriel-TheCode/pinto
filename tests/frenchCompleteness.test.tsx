/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import type { State } from '@/app/store';
import { DICTIONARIES } from '@/i18n';
import { render as renderMessage, type Dictionary, type Message } from '@/i18n/core';
import { unitsToMicros } from '@/domain/money/money';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';
import type { ApplyProgress, LogEntry, ProductSummary } from '@/services/messages';
import type { OperationRecord, Preset, RegionalPrice, StrategyConfig, StrategyKind } from '@/types';
import {
  PACKAGE,
  SUBSCRIPTION,
  type FakeWorker,
  type Panel,
  chooseKind,
  context,
  createWorker,
  error,
  fr as t,
  norm,
  price,
  renderPanel,
  renderPopup,
  startsWith,
  toMarkets,
  toReview,
  workspace,
} from './panelHarness';

/**
 * Acceptance test: selecting French gives a fully French interface.
 *
 * The real panel and popup are driven through every screen and state they can
 * reach, in French. Each state's text — text nodes plus title, aria-label,
 * placeholder, alt and label attributes — must contain no English-only
 * dictionary text and none of the common English UI words. A failure names the
 * state, the English fragment and the key it came from.
 */

// --- What counts as English ------------------------------------------------------

const EN = DICTIONARIES.en as Dictionary;
const FR = DICTIONARIES.fr as Dictionary;

const variants = (message: Message): string[] =>
  typeof message === 'string' ? [message] : Object.values(message).filter((v): v is string => typeof v === 'string');
/** Rich markup renders as its inner text. */
const plain = (text: string) => norm(text.replace(/<\/?\w+>/g, ''));

/** Every French string, so a fragment French shares with English (Google Play, Play Console…) is not a leak. */
const FR_CORPUS = Object.values(FR).flatMap(variants).map(plain).join('\n');

/** The static parts of a message, long enough to be unambiguous: ≥ 2 words or ≥ 8 letters. */
function fragments(template: string): string[] {
  return plain(template)
    .split(/\{\w+\}/)
    .map(norm)
    .filter((fragment) => {
      const words = fragment.match(/\p{L}+/gu) ?? [];
      return words.length >= 2 || words.join('').length >= 8;
    });
}

/** English fragment → the key it comes from, for every key whose French differs. */
const ENGLISH_ONLY = new Map<string, string>();
for (const key of Object.keys(EN)) {
  const en = EN[key]!;
  const fr = FR[key]!;
  if (renderMessage('en', en, { count: 2 }) === renderMessage('fr', fr, { count: 2 })) continue;
  for (const variant of variants(en)) {
    for (const fragment of fragments(variant)) if (!FR_CORPUS.includes(fragment)) ENGLISH_ONLY.set(fragment, key);
  }
}

/** Interface words that must never show in French, as whole words, case-sensitive. */
const ENGLISH_WORDS = [
  'Review', 'Apply', 'Cancel', 'Back', 'Countries', 'Settings', 'History', 'Help', 'Sign in', 'Loading',
  'Search', 'Select', 'Save', 'Delete', 'Export', 'Undo', 'Restore', 'Simulate', 'Change', 'Prices',
  'Next', 'Done', 'Close', 'Dismiss', 'Retry',
].map((word) => [word, new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'u')] as const);

/**
 * Not interface text: technical blocks (`<pre>`, Google's own words, the log)
 * and anything explicitly marked as another language (the "English" option).
 */
const SKIP = 'pre, script, style, [lang]:not([lang="fr"])';
const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'label'];

/**
 * User data shown as stored. Records written before 1.1 kept an English
 * description and Google's English sentence; they are shown as data.
 */
const LEGACY_LABEL = 'Raise all prices by 10%';
const LEGACY_REASON = 'Price is below the minimum allowed for this region';
const LEGACY_MESSAGE = 'Updated 4 regions successfully';
const DATA = [LEGACY_LABEL, LEGACY_REASON];

function visibleText(): { flat: string; spaced: string } {
  const nodes: string[] = [];
  const attributes: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push(node.nodeValue ?? '');
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.matches(SKIP)) {
      nodes.push(' ');
      return;
    }
    for (const name of ATTRIBUTES) {
      const value = node.getAttribute(name);
      if (value) attributes.push(value);
    }
    node.childNodes.forEach(visit);
  };
  visit(document.body);
  const strip = (text: string) => DATA.reduce((out, data) => out.split(data).join(' ¦ '), norm(text));
  return {
    flat: strip(`${nodes.join('')}\n${attributes.join('\n')}`),
    spaced: strip(`${nodes.join(' ')}\n${attributes.join('\n')}`),
  };
}

function leaksIn(state: string): string[] {
  const { flat, spaced } = visibleText();
  const leaks: string[] = [];
  for (const [fragment, key] of ENGLISH_ONLY) {
    if (flat.includes(fragment)) leaks.push(`[${state}] "${fragment}" (en: ${key})`);
  }
  for (const [word, pattern] of ENGLISH_WORDS) {
    if (pattern.test(spaced)) leaks.push(`[${state}] English word "${word}"`);
  }
  return leaks;
}

/** Collects leaks across the states of one test, then asserts once with all of them. */
function audit(panel: Panel) {
  const leaks: string[] = [];
  let states = 0;
  return {
    check(state: string) {
      states += 1;
      leaks.push(...leaksIn(state));
    },
    async done() {
      expect(states).toBeGreaterThan(0);
      expect(leaks, `English text in the French interface:\n${leaks.join('\n')}`).toEqual([]);
      expect([...panel.missingKeys]).toEqual([]);
      await waitFor(() => expect(document.documentElement.lang).toBe('fr'));
    },
  };
}

// --- Fixtures ---------------------------------------------------------------------------

const DAY = 86_400_000;

const PRICES: RegionalPrice[] = [
  price('US', 'USD', 4.99),
  price('FR', 'EUR', 4.99),
  price('DE', 'EUR', 4.99),
  price('GB', 'GBP', 4.49),
  price('JP', 'JPY', 800),
  price('BR', 'BRL', 24.9),
  price('MA', 'MAD', 49),
  price('KE', 'KES', 500),
  price('IN', 'INR', 399),
  price('PL', 'PLN', 19.99),
];

const ONE_TIME: ProductSummary = {
  kind: 'onetime',
  productId: 'lifetime',
  basePlanId: 'buy',
  label: 'lifetime · buy',
  details: { option: 'buy', state: 'draft' },
  regionCount: PRICES.length,
};
const MANAGED: ProductSummary = { kind: 'inapp', productId: 'coins', basePlanId: 'DEFAULT', label: 'coins', regionCount: 3 };

const RAISE: StrategyConfig = {
  strategy: { kind: 'percentage', percent: 10 },
  rounding: DEFAULT_ROUNDING,
  floorMicros: null,
  ceilingMicros: null,
};

function record(patch: Partial<OperationRecord>): OperationRecord {
  return {
    id: 'op-1',
    timestamp: Date.now() - DAY / 2,
    packageName: PACKAGE,
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    config: RAISE,
    requested: 2,
    regionsAffected: 2,
    status: 'succeeded',
    snapshot: [price('US', 'USD', 4.49), price('FR', 'EUR', 4.49)],
    written: { US: unitsToMicros(4.99), FR: unitsToMicros(5.49) },
    failures: [],
    ...patch,
  };
}

const HISTORY: OperationRecord[] = [
  record({ id: 'op-ok' }),
  record({
    id: 'op-partial',
    timestamp: Date.now() - DAY,
    status: 'partial',
    regionsAffected: 1,
    failures: [{ regionCode: 'FR', code: 'api/region-not-configured', params: { region: 'FR' }, detail: 'INVALID_ARGUMENT' }],
  }),
  record({ id: 'op-sim', timestamp: Date.now() - 3 * DAY, status: 'dry-run', written: undefined }),
  record({
    id: 'op-failed',
    timestamp: Date.now() - 4 * DAY,
    status: 'failed',
    regionsAffected: 0,
    failures: [{ regionCode: 'US', code: 'api/forbidden' }, { regionCode: 'FR', code: 'api/forbidden' }],
  }),
  record({ id: 'op-unverified', timestamp: Date.now() - 5 * DAY, status: 'unverified' }),
  record({ id: 'op-restored', timestamp: Date.now() - 6 * DAY, revertedBy: 'op-revert' }),
  record({ id: 'op-revert', timestamp: Date.now() - 6 * DAY + 1000, revertOf: 'op-restored', config: undefined }),
  record({ id: 'op-other-app', timestamp: Date.now() - 7 * DAY, packageName: 'com.other.app' }),
  record({
    id: 'op-other-product',
    timestamp: Date.now() - 8 * DAY,
    kind: 'onetime',
    productId: 'lifetime',
    basePlanId: 'buy',
    // Large enough to ask for the count to be typed.
    snapshot: PRICES.concat(
      ['CA', 'MX', 'AR', 'CL', 'CO', 'PE', 'IE', 'IT', 'ES', 'PT', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO'].map((code) =>
        price(code, 'USD', 4.99),
      ),
    ),
    requested: 26,
    regionsAffected: 26,
  }),
  // Written before 1.1: an English label and summary, Google's sentence, nothing else.
  {
    id: 'op-legacy',
    timestamp: Date.now() - 30 * DAY,
    packageName: PACKAGE,
    kind: 'subscription',
    productId: 'premium',
    basePlanId: 'monthly',
    strategyLabel: LEGACY_LABEL,
    message: LEGACY_MESSAGE,
    regionsAffected: 1,
    status: 'partial',
    snapshot: [price('US', 'USD', 4.49), price('JP', 'JPY', 700)],
    failures: [{ regionCode: 'JP', reason: LEGACY_REASON }],
  },
];

const PRESETS: Preset[] = [
  { id: 'p1', name: 'Hausse de printemps', description: '', config: { ...RAISE, strategy: { kind: 'percentage', percent: 5 } }, regions: ['FR', 'DE'], createdAt: 1 },
  {
    id: 'p2',
    name: 'Ancien modèle',
    description: 'Avec plancher et prix imposés',
    config: { ...RAISE, floorMicros: unitsToMicros(1), ceilingMicros: unitsToMicros(99), overrides: { FR: unitsToMicros(3.99) } },
    regions: [],
    createdAt: 2,
  },
];

const LOG: LogEntry[] = [
  { at: Date.UTC(2026, 10, 1), level: 'info', scope: 'apply', message: 'Applied 4 prices', detail: 'Done in 2 batches' },
];

function frenchWorker(prices: RegionalPrice[] = PRICES): FakeWorker {
  const worker = createWorker(prices);
  worker.products = [{ ...SUBSCRIPTION, regionCount: prices.length }, ONE_TIME, MANAGED];
  worker.groups = [{ id: 'g1', label: 'Europe riche', members: ['FR', 'DE', 'GB'], createdAt: 1 }];
  worker.presets = PRESETS.map((preset) => ({ ...preset }));
  worker.history = HISTORY.map((op) => ({ ...op }));
  worker.log = LOG;
  return worker;
}

async function french(worker: FakeWorker = frenchWorker(), settings: Record<string, unknown> = {}): Promise<Panel> {
  return renderPanel(worker, { locale: 'fr', settings });
}

const set = (panel: Panel, patch: Partial<State>) =>
  act(() => panel.useStore.setState(patch));

const button = (name: string) => screen.getByRole('button', { name: startsWith(name) });

beforeEach(() => {
  document.documentElement.lang = '';
});

// --- The detector itself --------------------------------------------------------------

describe('the leak detector', () => {
  it('flags English dictionary text and English UI words, and ignores technical blocks', () => {
    render(
      <div>
        <p>{EN['review.simulate.hint'] as string}</p>
        <button type="button" aria-label="Close" />
        <pre>Applied 4 prices — Done</pre>
        <span lang="en">English</span>
      </div>,
    );
    const leaks = leaksIn('probe');
    expect(leaks.some((leak) => leak.includes('review.simulate.hint'))).toBe(true);
    expect(leaks).toContain('[probe] English word "Close"');
    expect(leaks.some((leak) => leak.includes('"Done"'))).toBe(false);
  });

  it('has a meaningful list to look for', () => {
    expect(ENGLISH_ONLY.size).toBeGreaterThan(300);
  });
});

// --- Before the workspace ----------------------------------------------------------------

describe('before the workspace, in French', () => {
  it('boot skeleton', async () => {
    const worker = frenchWorker();
    const release = worker.hold('auth/state');
    const panel = await french(worker);
    const report = audit(panel);
    expect(screen.getByRole('status', { name: t('workspace.loading') })).toBeTruthy();
    report.check('boot');
    release();
    await workspace(panel);
    await report.done();
  });

  it('extension unreachable', async () => {
    const worker = frenchWorker();
    worker.signedIn = null;
    const panel = await french(worker);
    const report = audit(panel);
    await screen.findByRole('alert');
    report.check('setup: worker unreachable');
    await report.done();
  });

  it('setup checklist, with an invalid client ID', async () => {
    const worker = frenchWorker();
    worker.signedIn = false;
    worker.clientId = null;
    const panel = await french(worker);
    const report = audit(panel);
    await screen.findByRole('heading', { level: 1, name: t('onboarding.setup.title') });
    report.check('setup: checklist');
    await panel.user.type(screen.getByLabelText(t('onboarding.clientId.label')), 'GOCSPX-secret');
    await panel.user.tab();
    expect(screen.getByText(norm(t('onboarding.clientId.invalid')))).toBeTruthy();
    report.check('setup: invalid client ID');
    await report.done();
  });

  it('sign-in, with the client ID editor and every sign-in message', async () => {
    const worker = frenchWorker();
    worker.signedIn = false;
    const panel = await french(worker);
    const report = audit(panel);
    await screen.findByRole('button', { name: t('onboarding.signIn.action') });
    report.check('sign-in');
    await panel.user.click(button(t('onboarding.clientId.change')));
    report.check('sign-in: client ID editor');
    for (const code of ['auth/cancelled', 'auth/expired', 'auth/denied', 'auth/no-token']) {
      act(() => panel.useStore.getState().setError(error(code)));
      report.check(`sign-in: ${code}`);
    }
    await report.done();
  });

  it('page without prices, after checking again', async () => {
    const worker = frenchWorker();
    worker.context = context({ supported: false });
    const panel = await french(worker);
    const report = audit(panel);
    await screen.findByRole('heading', { level: 1, name: t('onboarding.unsupported.title') });
    report.check('unsupported');
    await panel.user.click(button(t('onboarding.unsupported.check')));
    await screen.findByText(norm(t('onboarding.unsupported.still')));
    report.check('unsupported: still');
    await report.done();
  });

  it('package prompt, with an invalid name and an error', async () => {
    const worker = frenchWorker();
    worker.context = context({ packageName: null, packageNameSource: null });
    const panel = await french(worker);
    const report = audit(panel);
    await screen.findByRole('heading', { level: 1, name: t('onboarding.package.title') });
    report.check('package');
    await panel.user.type(screen.getByLabelText(t('onboarding.package.label')), 'Pas Un Package');
    await panel.user.click(button(t('onboarding.package.submit')));
    report.check('package: invalid');
    act(() => panel.useStore.getState().setError(error('api/not-found')));
    report.check('package: error');
    await report.done();
  });
});

// --- The workspace frame -------------------------------------------------------------------

describe('the workspace frame, in French', () => {
  it('product bar with several products, a failed listing and a package read from the page', async () => {
    const worker = frenchWorker();
    worker.unavailable = [{ kind: 'inapp', code: 'api/forbidden' }];
    worker.context = context({ packageNameSource: 'page' });
    const panel = await french(worker);
    const report = audit(panel);
    await workspace(panel);
    report.check('workspace: product bar');
    await report.done();
  });

  it('loading products, then loading prices', async () => {
    const worker = frenchWorker();
    const releaseList = worker.hold('products/list');
    const releasePrices = worker.hold('products/pricing');
    const panel = await french(worker);
    const report = audit(panel);
    await screen.findByRole('status', { name: t('workspace.loadingProducts') });
    report.check('workspace: loading products');
    releaseList();
    await screen.findByRole('status', { name: t('workspace.loadingPrices') });
    report.check('workspace: loading prices');
    releasePrices();
    await workspace(panel);
    await report.done();
  });

  it('no product, listing failed, product to choose, prices failed', async () => {
    const worker = frenchWorker();
    worker.products = [];
    const panel = await french(worker);
    const report = audit(panel);
    await screen.findByText(norm(t('workspace.noProducts.title')));
    report.check('workspace: no products');

    worker.failures['products/list'] = error('api/forbidden');
    await panel.user.click(button(t('action.reload')));
    await screen.findByText(norm(t('workspace.listFailed.title')));
    report.check('workspace: listing failed');

    delete worker.failures['products/list'];
    worker.products = [ONE_TIME, MANAGED];
    worker.failures['products/pricing'] = error('api/server', { status: 503 });
    await panel.user.click(button(t('action.retry')));
    await screen.findByText(norm(t('workspace.chooseProduct.title')));
    report.check('workspace: choose a product');

    await panel.user.selectOptions(screen.getByLabelText(t('workspace.product.label')), 'onetime:lifetime:buy');
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    report.check('workspace: prices failed');
    await report.done();
  });
});

// --- Step 1 → 3 for every kind ---------------------------------------------------------------

describe('every kind of change, through the three steps, in French', () => {
  const KINDS: StrategyKind[] = ['percentage', 'multiplier', 'fixed', 'copy', 'tiers', 'formula'];

  async function arm(panel: Panel, kind: StrategyKind) {
    await chooseKind(panel, kind);
    if (kind === 'percentage') {
      const field = screen.getByLabelText(t('strategy.percentage.label'));
      await panel.user.clear(field);
      await panel.user.type(field, '10');
    }
    if (kind === 'multiplier') {
      const field = screen.getByLabelText(t('strategy.multiplier.label'));
      await panel.user.clear(field);
      await panel.user.type(field, '1,2');
    }
    if (kind === 'tiers') {
      await panel.user.click(button(t('strategy.ladder.generate')));
      await screen.findByRole('heading', { name: t('strategy.tiers.title', { count: 5 }) });
    }
  }

  for (const kind of KINDS) {
    it(kind, async () => {
      const panel = await french();
      const report = audit(panel);
      await workspace(panel);
      report.check('step 1: no change');
      await arm(panel, kind);
      report.check(`step 1: ${kind}`);

      if (kind === 'fixed' || kind === 'copy') {
        await panel.user.click(screen.getByText(norm(t('strategy.convert.title'))));
        await panel.user.click(screen.getByRole('switch', { name: t('strategy.convert.label') }));
        report.check(`step 1: ${kind}, conversion off`);
        await panel.user.click(button(t('strategy.convert.turnOn')));
      }
      if (kind === 'formula') {
        const field = screen.getByLabelText(t('strategy.formula.label'));
        await panel.user.clear(field);
        await panel.user.type(field, 'current * ');
        report.check('step 1: formula with an error');
        await panel.user.type(field, '1,1');
        report.check('step 1: formula with an error (decimal comma)');
        await panel.user.clear(field);
        await panel.user.type(field, 'min(current * 1.2, base)');
      }

      await toMarkets(panel);
      await waitFor(() => expect(panel.useStore.getState().conversionLoading).toBe(false));
      report.check(`step 2: ${kind}`);
      await toReview(panel);
      report.check(`step 3: ${kind}`);
      await report.done();
    });
  }
});

describe('step 1 extras, in French', () => {
  it('last change, presets, saving and deleting a preset, a legacy preset', async () => {
    const panel = await french(frenchWorker(), { lastConfig: RAISE, lastAppliedAt: Date.now() - 2 * DAY });
    const report = audit(panel);
    await workspace(panel);
    await screen.findByRole('button', { name: t('strategy.recent.use') });
    await panel.user.selectOptions(screen.getByLabelText(t('strategy.presets.label')), 'p1');
    report.check('step 1: last change and presets');

    await panel.user.click(screen.getByRole('button', { name: t('strategy.recent.use') }));
    await panel.user.click(screen.getByText(norm(t('strategy.presets.manage'))));
    await panel.user.click(button(t('strategy.presets.save')));
    const save = screen.getByRole('dialog', { name: t('strategy.presets.saveTitle') });
    await panel.user.click(within(save).getByRole('button', { name: t('action.save') }));
    report.check('step 1: save preset, name missing');
    await panel.user.type(within(save).getByLabelText(t('strategy.presets.name')), 'Rentrée');
    await panel.user.click(within(save).getByRole('checkbox'));
    report.check('step 1: save preset, without the selection');
    await panel.user.click(within(save).getByRole('button', { name: t('action.save') }));
    await screen.findByText(norm(t('strategy.presets.saved', { name: 'Rentrée' })));
    report.check('step 1: preset saved');

    await panel.user.click(screen.getByRole('button', { name: t('strategy.presets.delete', { name: 'Hausse de printemps' }) }));
    report.check('step 1: delete preset dialog');
    await panel.user.click(screen.getByRole('button', { name: t('action.cancel') }));

    const legacy = screen.getAllByRole('button', { name: t('strategy.presets.use') });
    await panel.user.click(legacy[legacy.length - 1]!);
    await screen.findByText(norm(t('strategy.legacy.title')));
    report.check('step 1: legacy preset with overrides');
    await report.done();
  });

  it('advanced options: every rounding, invalid endings, limits', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    await chooseKind(panel, 'percentage');
    const field = screen.getByLabelText(t('strategy.percentage.label'));
    await panel.user.clear(field);
    await panel.user.type(field, '80');
    await panel.user.click(screen.getByText(norm(t('strategy.advanced.title'))));
    for (const mode of ['charm', 'integer', 'none', 'endings'] as const) {
      await panel.user.click(screen.getByRole('radio', { name: t(`strategy.rounding.${mode}`) }));
      report.check(`step 1: rounding ${mode}`);
    }
    const endings = screen.getByLabelText(t('strategy.rounding.endingsLabel'));
    await panel.user.clear(endings);
    await panel.user.type(endings, '1,5');
    await panel.user.tab();
    expect(screen.getByText(norm(t('strategy.rounding.endingsInvalid')))).toBeTruthy();
    report.check('step 1: invalid endings');
    await panel.user.type(screen.getByLabelText(t('strategy.limits.maxIncrease')), '50');
    await panel.user.type(screen.getByLabelText(t('strategy.limits.maxDecrease')), '120');
    await panel.user.tab();
    report.check('step 1: limits, one invalid');
    // An invalid value holds the step: it must be corrected before moving on.
    expect(screen.getByText(norm(t('strategy.next.invalid')))).toBeTruthy();
    const decrease = screen.getByLabelText(t('strategy.limits.maxDecrease'));
    await panel.user.clear(decrease);
    await panel.user.type(decrease, '20');
    await panel.user.tab();
    await toMarkets(panel);
    await toReview(panel);
    report.check('step 3: clamped by limits');
    await report.done();
  });

  it('purchasing power: generator, ladder, members, untiered and unselected countries', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    await chooseKind(panel, 'tiers');
    await panel.user.click(screen.getByRole('radio', { name: t('curve.aggressive.label') }));
    const anchor = screen.getByLabelText(t('strategy.ladder.anchor'));
    await panel.user.clear(anchor);
    await panel.user.type(anchor, '9,99');
    report.check('tiers: generator');
    await panel.user.click(button(t('strategy.ladder.generate')));
    await screen.findByRole('heading', { name: t('strategy.tiers.title', { count: 5 }) });
    report.check('tiers: ladder');

    const tier = t('band.T4.label');
    const item = screen.getByRole('button', { name: t('strategy.tiers.remove', { tier }) }).closest('li')!;
    await panel.user.click(within(item).getByRole('button', { name: startsWith(t('count.countries', { count: 2 })) }));
    await panel.user.click(
      screen.getByRole('button', { name: t('strategy.tiers.removeCountry', { country: 'Maroc', tier }) }),
    );
    await panel.user.type(screen.getByLabelText(t('strategy.tiers.newLabel')), t('band.T1.label'));
    await panel.user.click(screen.getByText(norm(t('strategy.ladder.regenerate'))));
    act(() => panel.useStore.getState().removeRegions(['FR', 'DE']));
    report.check('tiers: edited, untiered, unselected, name taken');
    await report.done();
  });
});

// --- Step 2 ------------------------------------------------------------------------------------

describe('step 2, in French', () => {
  it('filters, hidden selection, groups and their dialogs, no match', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    await chooseKind(panel, 'fixed');
    await toMarkets(panel);
    await waitFor(() => expect(panel.useStore.getState().conversionLoading).toBe(false));
    report.check('markets');

    await panel.user.click(button(t('markets.filters.toggle')));
    await panel.user.click(screen.getByRole('button', { name: t('continent.Europe') }));
    await panel.user.click(screen.getByRole('button', { name: t('subregion.Western Europe') }));
    await panel.user.selectOptions(screen.getByLabelText(t('markets.filters.currency')), 'EUR');
    expect(screen.getByText(norm(t('markets.selection.hidden', { count: 8 })))).toBeTruthy();
    report.check('markets: filters hide selected countries');

    await panel.user.click(button('Europe riche'));
    report.check('markets: group chosen');
    await panel.user.click(screen.getByRole('button', { name: t('markets.groups.save') }));
    report.check('markets: save group dialog');
    await panel.user.click(screen.getByRole('button', { name: t('action.cancel') }));
    await panel.user.click(screen.getByRole('button', { name: t('markets.groups.delete', { name: 'Europe riche' }) }));
    report.check('markets: delete group dialog');
    await panel.user.click(screen.getByRole('button', { name: t('action.cancel') }));

    await panel.user.type(screen.getByRole('searchbox', { name: t('markets.search.label') }), 'zzz');
    await screen.findByText(norm(t('markets.empty.title')));
    report.check('markets: no match');
    await report.done();
  });

  it('conversion notes: loading and estimated', async () => {
    const worker = frenchWorker();
    const release = worker.hold('pricing/convert');
    const panel = await french(worker);
    const report = audit(panel);
    await workspace(panel);
    await chooseKind(panel, 'copy');
    await toMarkets(panel);
    expect(screen.getByText(norm(t('conversion.loading')))).toBeTruthy();
    report.check('markets: rates loading');
    worker.rates = null;
    release();
    await screen.findByText(norm(t('conversion.fallback')));
    report.check('markets: estimated rates');
    await toReview(panel);
    report.check('review: estimated rates');
    await report.done();
  });
});

// --- Step 3 ------------------------------------------------------------------------------------

describe('step 3, in French', () => {
  it('blocked, to check, every filter, acknowledgement', async () => {
    const worker = frenchWorker([price('US', 'USD', 4.99), price('FR', 'EUR', 2.99), price('DE', 'EUR', 9.99), price('JP', 'JPY', 800)]);
    const panel = await french(worker);
    const report = audit(panel);
    await workspace(panel);
    await chooseKind(panel, 'formula');
    const field = screen.getByLabelText(t('strategy.formula.label'));
    await panel.user.clear(field);
    await panel.user.type(field, 'current - 4');
    await toMarkets(panel);
    report.check('markets: blocked and to check');
    await toReview(panel);
    report.check('review: blocked');
    for (const filter of ['changing', 'check', 'unchanged', 'blocked'] as const) {
      await panel.user.click(screen.getByRole('radio', { name: startsWith(t(`review.filter.${filter}`)) }));
      report.check(`review: filter ${filter}`);
    }
    await panel.user.click(screen.getByRole('checkbox', { name: t('review.check.confirm', { count: 1 }) }));
    report.check('review: acknowledged');
    await report.done();
  });

  it('typed confirmation for a large write, then rates loading', async () => {
    const many = ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT',
      'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'JP', 'KR', 'IN', 'ID', 'AU'].map((code) => price(code, 'USD', 4.99));
    const worker = frenchWorker(many);
    const panel = await french(worker);
    const report = audit(panel);
    await workspace(panel);
    await chooseKind(panel, 'percentage');
    const field = screen.getByLabelText(t('strategy.percentage.label'));
    await panel.user.clear(field);
    await panel.user.type(field, '-10');
    await toMarkets(panel);
    await toReview(panel);
    await panel.user.click(button(t('review.apply', { count: 30 })));
    expect(screen.getByRole('dialog', { name: t('review.confirm.title', { count: 30 }) })).toBeTruthy();
    report.check('review: typed confirmation');
    await panel.user.click(screen.getByRole('button', { name: t('action.cancel') }));

    // Back to step 1, a change that converts, then Review while Google's rates load.
    const steps = () => within(screen.getByRole('navigation', { name: t('workspace.steps.label') })).getAllByRole('button');
    await panel.user.click(steps()[0]!);
    await chooseKind(panel, 'formula');
    const formula = screen.getByLabelText(t('strategy.formula.label'));
    await panel.user.clear(formula);
    await panel.user.type(formula, 'base * 1.1');
    worker.hold('pricing/convert');
    await panel.user.click(steps()[2]!);
    await screen.findByText(norm(t('review.rates.loading.title')));
    report.check('review: rates loading');
    await report.done();
  });
});

// --- Writing and its outcome ---------------------------------------------------------------------

describe('writing and its outcome, in French', () => {
  it('progress, every phase, forward and restoring', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    const phases: ApplyProgress[] = [
      { phase: 'preparing', completed: 0, total: 12 },
      { phase: 'writing', completed: 0, total: 12 },
      { phase: 'writing', completed: 5, total: 12 },
      { phase: 'isolating', completed: 5, total: 12, rejected: 2 },
      { phase: 'verifying', completed: 10, total: 12 },
      { phase: 'done', completed: 12, total: 12 },
    ];
    for (const revert of [false, true]) {
      for (const progress of phases) {
        set(panel, { progress: { ...progress, revert } });
        expect(screen.getByRole('progressbar')).toBeTruthy();
        report.check(`progress: ${progress.phase} ${progress.completed}${revert ? ' (restore)' : ''}`);
      }
    }
    await report.done();
  });

  it('results: succeeded, partial, failed, unverified, dry run, restored, with their dialogs', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    const results: [string, OperationRecord][] = [
      ['succeeded', record({ id: 'r1' })],
      ['partial', HISTORY[1]!],
      ['failed', HISTORY[3]!],
      ['unverified', HISTORY[4]!],
      ['dry run', HISTORY[2]!],
      ['restored', record({ id: 'r2', revertOf: 'op-ok', config: undefined })],
      [
        'restore partly failed',
        record({ id: 'r3', revertOf: 'op-ok', config: undefined, status: 'partial', failures: [{ regionCode: 'FR', code: 'apply/stale', params: { count: 1 } }] }),
      ],
      ['legacy', HISTORY[HISTORY.length - 1]!],
    ];
    for (const [name, operation] of results) {
      set(panel, { lastOperation: operation, progress: null });
      expect(screen.getAllByRole('button', { name: t('action.done') }).length).toBeGreaterThan(0);
      report.check(`result: ${name}`);
    }

    set(panel, { lastOperation: record({ id: 'r4' }) });
    await panel.user.click(screen.getByRole('button', { name: t('review.result.undo') }));
    report.check('result: undo dialog');
    await panel.user.click(screen.getByRole('button', { name: t('action.cancel') }));

    set(panel, { lastOperation: results[6]![1] });
    await panel.user.click(button(t('review.result.retryRestore')));
    report.check('result: retry restore dialog');
    await panel.user.click(screen.getByRole('button', { name: t('action.cancel') }));
    await report.done();
  });
});

// --- History, Settings, Help -------------------------------------------------------------------------

describe('side screens, in French', () => {
  it('history with every kind of record, its restore dialogs and clearing', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    await panel.user.click(screen.getByRole('button', { name: t('workspace.header.history') }));
    await screen.findByRole('heading', { level: 1, name: t('workspace.header.history') });
    report.check('history');
    // A pre-1.1 summary is never displayed now.
    expect(document.body.textContent).not.toContain(LEGACY_MESSAGE);

    // Restorable records, newest first: ok, partial, unverified, other app, other product, legacy.
    const dialogs = [
      ['drift', 0],
      ['other app', 3],
      ['other product, typed', 4],
      ['legacy, no check', 5],
    ] as const;
    for (const [name, index] of dialogs) {
      await panel.user.click(screen.getAllByRole('button', { name: t('history.restore.action') })[index]!);
      await waitFor(() => expect(panel.useStore.getState().loadingPricing).toBe(false));
      const dialog = screen.getByRole('dialog');
      report.check(`history: restore dialog, ${name}`);
      const include = within(dialog).queryByRole('checkbox');
      if (include) {
        await panel.user.click(include);
        report.check(`history: restore dialog, ${name}, overwriting`);
      }
      await panel.user.click(within(dialog).getByRole('button', { name: t('action.cancel') }));
    }

    await panel.user.click(screen.getByRole('button', { name: t('history.clear.action') }));
    report.check('history: clear dialog');
    await panel.user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('history.clear.confirm') }));
    await screen.findByText(norm(t('history.empty.title')));
    report.check('history: empty, cleared toast');
    await report.done();
  });

  it('history loading', async () => {
    const worker = frenchWorker();
    const panel = await french(worker);
    const report = audit(panel);
    await workspace(panel);
    worker.hold('history/list');
    set(panel, { history: [] });
    await panel.user.click(screen.getByRole('button', { name: t('workspace.header.history') }));
    await screen.findByRole('status', { name: t('history.loading') });
    report.check('history: loading');
    await report.done();
  });

  it('settings: every section, the log, the client ID confirmation, invalid input', async () => {
    const worker = frenchWorker();
    const panel = await french(worker);
    const report = audit(panel);
    await workspace(panel);
    await panel.user.click(screen.getByRole('button', { name: t('workspace.header.settings') }));
    await screen.findByRole('heading', { level: 1, name: t('workspace.header.settings') });
    report.check('settings');

    await panel.user.click(button(t('settings.log.load')));
    await screen.findByLabelText(t('settings.log.label'));
    report.check('settings: log loaded');
    worker.log = [];
    await panel.user.click(button(t('action.reload')));
    await screen.findByText(norm(t('settings.log.empty')));
    report.check('settings: log empty');

    const pkg = screen.getByLabelText(t('settings.app.package'));
    await panel.user.clear(pkg);
    await panel.user.type(pkg, 'Pas valide');
    const client = screen.getByLabelText(t('settings.cloud.clientId'));
    await panel.user.clear(client);
    await panel.user.type(client, 'pas-un-client');
    report.check('settings: invalid package and client ID');

    await panel.user.clear(client);
    await panel.user.type(client, '42-nouveau.apps.googleusercontent.com');
    await panel.user.click(within(client.closest('form')!).getByRole('button', { name: t('action.save') }));
    report.check('settings: client ID confirmation');
    await panel.user.click(screen.getByRole('button', { name: t('action.cancel') }));

    await panel.user.clear(pkg);
    await panel.user.type(pkg, 'com.example.other');
    await panel.user.click(within(pkg.closest('form')!).getByRole('button', { name: t('action.save') }));
    await screen.findByText(norm(t('settings.app.saved', { package: 'com.example.other' })));
    report.check('settings: package saved toast');
    await report.done();
  });

  it('help', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    await panel.user.click(screen.getByRole('button', { name: t('workspace.header.help') }));
    await screen.findByRole('heading', { level: 1, name: t('workspace.header.help') });
    report.check('help');
    await report.done();
  });
});

// --- Messages ------------------------------------------------------------------------------------------

describe('messages, in French', () => {
  it('toasts', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    const toasts: Parameters<Panel['toast']>[0][] = [
      { key: 'history.cleared' },
      { key: 'markets.groups.saved', vars: { name: 'Europe riche', count: 3 } },
      { key: 'settings.app.saved', vars: { package: PACKAGE } },
      { key: 'strategy.ladder.selectionSet', vars: { count: 9 } },
      { key: 'strategy.presets.applied', vars: { name: 'Hausse de printemps' } },
      { key: 'strategy.presets.imported', vars: { count: 2 } },
      { key: 'strategy.presets.saved', vars: { name: 'Rentrée' } },
      { error: error('preset/invalid-json') },
      { error: error('preset/invalid-file', { path: '0.config' }) },
    ];
    for (const message of toasts) {
      act(() => panel.useToasts.setState({ toasts: [] }));
      act(() => panel.toast(message, 'error' in message ? 'error' : 'success'));
      expect(screen.getByRole('button', { name: t('action.dismiss') })).toBeTruthy();
      report.check(`toast: ${'key' in message ? message.key : message.error.code}`);
    }
    await report.done();
  });

  it('every error the worker can raise, in the banner', async () => {
    const panel = await french();
    const report = audit(panel);
    await workspace(panel);
    const codes = Object.keys(EN)
      .filter((key) => /^error\..+\.title$/.test(key))
      .map((key) => key.slice('error.'.length, -'.title'.length).replace('.', '/'));
    expect(codes.length).toBeGreaterThan(20);
    const params = { region: 'JP', got: 'EUR', expected: 'BGN', count: 3, path: '0.config', status: 503 };
    // auth/expired signs out, so it is checked on the sign-in screen instead.
    for (const code of [...codes.filter((code) => code !== 'auth/expired'), 'some/unknown-code']) {
      act(() => panel.useStore.getState().setError({ ...error(code, params), detail: 'Request had invalid authentication credentials.' }));
      expect(screen.getByText(t('error.details'))).toBeTruthy();
      report.check(`error: ${code}`);
    }
    await report.done();
  });
});

// --- The toolbar popup ----------------------------------------------------------------------------------

describe('the popup, in French', () => {
  it('checking', async () => {
    const worker = createWorker();
    worker.hold('auth/state');
    const popup = await renderPopup(worker, 'fr');
    const report = audit(popup);
    expect(screen.getByRole('status', { name: t('popup.checking') })).toBeTruthy();
    report.check('popup: checking');
    await report.done();
  });

  it('failed', async () => {
    const worker = createWorker();
    worker.signedIn = null;
    const popup = await renderPopup(worker, 'fr');
    const report = audit(popup);
    await screen.findByRole('alert');
    report.check('popup: failed');
    await report.done();
  });

  it('signed in, on a pricing page, then a tab opened before Pinto was installed', async () => {
    const worker = createWorker();
    const popup = await renderPopup(worker, 'fr');
    const report = audit(popup);
    await screen.findByRole('button', { name: t('popup.open') });
    report.check('popup: pricing page');

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([{ id: 7 }] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(new Error('Receiving end does not exist.'));
    await popup.user.click(screen.getByRole('button', { name: t('popup.open') }));
    await screen.findByText(norm(t('popup.stale.title')));
    report.check('popup: stale tab');
    await report.done();
  });

  it('signed out, on Play Console but not a pricing page', async () => {
    const worker = createWorker();
    worker.signedIn = false;
    worker.context = context({ supported: false, packageName: null });
    const popup = await renderPopup(worker, 'fr');
    const report = audit(popup);
    await screen.findByText(norm(t('popup.consoleHint')));
    report.check('popup: console, signed out');
    await report.done();
  });

  it('another site', async () => {
    const worker = createWorker();
    worker.context = context({ supported: false, packageName: null, url: 'https://example.com/' });
    const popup = await renderPopup(worker, 'fr');
    const report = audit(popup);
    await screen.findByText(norm(t('popup.otherHint')));
    report.check('popup: other site');
    await report.done();
  });
});
