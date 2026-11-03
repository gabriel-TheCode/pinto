import type { ReactNode } from 'react';
import { useStore } from '@/app/store';
import { Rich, useFormat, useT } from '@/i18n/react';
import { bandBlurb, bandName, curveBlurb, curveName } from '@/i18n/describe';
import { CURVES, ECONOMIC_BANDS, type LadderCurve } from '@/domain/regions/economicBands';
import { STRATEGY_KINDS } from '@/features/strategy/model';
import { ShortcutTable } from '@/features/settings/ShortcutTable';
import type { StrategyKind } from '@/types';
import { Callout, ScreenHeader, Section } from '@/ui';
import { TYPED_CONFIRM_AT } from '@/features/review/model';

const CURVE_ORDER: readonly LadderCurve[] = ['flat', 'gentle', 'balanced', 'aggressive'];

/** Same threshold the Review step and the restore dialog use. */

/**
 * The guide, in the order the work happens. Every control it names is the
 * control's own dictionary key, passed into the sentence, so renaming a
 * button renames it here too.
 */
export function HelpScreen() {
  const t = useT();
  const fmt = useFormat();
  const setView = useStore((state) => state.setView);
  const history = t('workspace.header.history');

  const steps = [
    {
      name: t('workspace.step.strategy'),
      body: t('help.steps.strategy', { zero: fmt.delta(0), next: t('workspace.next.markets') }),
    },
    { name: t('workspace.step.markets'), body: t('help.steps.markets', { next: t('workspace.next.review') }) },
    { name: t('workspace.step.review'), body: t('help.steps.review') },
  ];

  const strategies: Record<StrategyKind, string> = {
    percentage: t('help.strategy.percentage'),
    fixed: t('help.strategy.fixed'),
    tiers: t('help.strategy.tiers'),
    copy: t('help.strategy.copy'),
    multiplier: t('help.strategy.multiplier', { factor: fmt.number(1.2), share: fmt.share(0.2) }),
    formula: t('help.strategy.formula'),
  };

  // Real messages with example values: the guide quotes what the panel shows.
  const messages = [
    {
      title: t('error.api.region-not-configured.title', { region: fmt.region('BR') }),
      hint: t('error.api.region-not-configured.hint'),
    },
    {
      title: t('error.api.regions-version.title', { region: fmt.region('BG'), got: 'EUR', expected: 'BGN' }),
      hint: t('error.api.regions-version.hint'),
    },
    { title: t('error.apply.stale.title', { count: 3 }), hint: t('error.apply.stale.hint') },
    { title: t('error.api.forbidden.title'), hint: t('error.api.forbidden.hint') },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        title={t('workspace.header.help')}
        onBack={() => setView('workspace')}
        backLabel={t('action.back')}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title={t('help.intro.title')}>
          <p className="text-body text-ink-700">{t('help.intro.body')}</p>
        </Section>

        <Section title={t('help.before.title')}>
          <Bullets
            items={[t('help.before.permission'), t('help.before.api'), t('help.before.page')]}
          />
        </Section>

        <Section title={t('help.steps.title')} description={t('help.steps.intro')}>
          <ol className="flex flex-col gap-2.5">
            {steps.map((step, index) => (
              <li key={step.name} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-ink-100 text-meta font-semibold text-ink-700 tabular"
                >
                  {fmt.number(index + 1)}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-small font-semibold text-ink-900">{step.name}</span>
                  <span className="text-small text-ink-700">
                    <Rich text={step.body} />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title={t('help.strategies.title')}>
          <Terms
            items={STRATEGY_KINDS.map((kind) => ({
              term: t(`strategy.${kind}.name`),
              text: <Rich text={strategies[kind]} />,
            }))}
          />
        </Section>

        <Section title={t('strategy.tiers.name')}>
          <p className="text-small text-ink-700">{t('help.tiers.body', { count: ECONOMIC_BANDS.length })}</p>
          <h3 className="text-small font-semibold text-ink-900">{t('help.tiers.bands')}</h3>
          <Terms
            items={ECONOMIC_BANDS.map((band) => ({
              term: bandName(t, band.id, band.label),
              text: bandBlurb(t, band.id),
            }))}
          />
          <h3 className="text-small font-semibold text-ink-900">{t('help.tiers.curves')}</h3>
          <Terms
            items={CURVE_ORDER.map((curve) => ({
              term: curveName(t, curve),
              text: `${curveBlurb(t, curve)} ${t('help.tiers.floor', {
                share: fmt.share(Math.min(...CURVES[curve].shares)),
              })}`,
            }))}
          />
          {/* The caveat sits with the feature: the tiers are a judgement, and
              the user answers for the prices. */}
          <Callout tone="neutral" title={t('help.tiers.basis')}>
            {t('band.basis')}
          </Callout>
        </Section>

        <Section title={t('help.safety.title')}>
          <Bullets
            items={[
              t('help.safety.review', { review: t('workspace.step.review') }),
              t('help.safety.simulate', { history }),
              t('help.safety.typed', { count: TYPED_CONFIRM_AT }),
              t('help.safety.restore', { history, restore: t('history.restore.action') }),
              t('help.safety.verify', {
                partial: t('operation.status.partial'),
                unverified: t('operation.status.unverified'),
              }),
              t('help.safety.subscribers'),
            ]}
          />
        </Section>

        <Section title={t('help.messages.title')} description={t('help.messages.intro')}>
          <Terms
            items={messages.map((message) => ({
              term: t('help.messages.quote', { text: message.title }),
              text: message.hint,
            }))}
          />
        </Section>

        <Section title={t('help.panel.title')}>
          <p className="text-small text-ink-700">
            <Rich
              text={t('help.panel.body', {
                left: t('content.dockLeft'),
                right: t('content.dockRight'),
                float: t('content.float'),
                collapse: t('content.collapse'),
              })}
            />
          </p>
          <ShortcutTable />
        </Section>
      </div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-small text-ink-700">
      {items.map((item) => (
        <li key={item}>
          <Rich text={item} />
        </li>
      ))}
    </ul>
  );
}

function Terms({ items }: { items: { term: string; text: ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.term} className="flex flex-col gap-0.5">
          <dt className="text-small font-semibold text-ink-900">{item.term}</dt>
          <dd className="text-small text-ink-700">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}
