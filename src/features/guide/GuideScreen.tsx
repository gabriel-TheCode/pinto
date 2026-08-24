import type { ReactNode } from 'react';
import { useT } from '@/app/store';
import type { TranslationKey } from '@/app/i18n';
import { Badge } from '@/components/Feedback';

/**
 * In-app documentation.
 *
 * Pinto asks the user to authorise API access, choose an economic model and
 * then write real prices to a live store — the cost of a misunderstanding is
 * money, so the explanation belongs next to the controls rather than in a
 * README nobody opens. It reads top to bottom in the order the work happens.
 */
export function GuideScreen() {
  const t = useT();

  return (
    <div className="h-full overflow-y-auto bg-white">
      <header className="border-b border-ink-200 px-4 py-3.5">
        <h1 className="text-[15px] font-semibold tracking-[-0.015em] text-ink-900">
          {t('guide.title')}
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">{t('guide.intro')}</p>
      </header>

      <Section title={t('guide.beforeTitle')}>
        <Bullets items={['guide.before1', 'guide.before2', 'guide.before3']} />
      </Section>

      <Section title={t('guide.flowTitle')}>
        <div className="flex flex-col gap-2.5">
          <Step title={t('guide.step1Title')} body={t('guide.step1Body')} />
          <Step title={t('guide.step2Title')} body={t('guide.step2Body')} />
          <Step title={t('guide.step3Title')} body={t('guide.step3Body')} />
          <Step title={t('guide.step4Title')} body={t('guide.step4Body')} />
        </div>
      </Section>

      <Section title={t('guide.strategiesTitle')}>
        <Bullets
          items={[
            'guide.stratPercentage',
            'guide.stratMultiplier',
            'guide.stratFixed',
            'guide.stratCopy',
            'guide.stratTiers',
            'guide.stratFormula',
          ]}
        />
      </Section>

      <Section title={t('guide.zoneTitle')} tone="accent">
        <p className="text-[12px] leading-relaxed text-ink-700">{t('guide.zoneBody')}</p>
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12px] leading-relaxed text-ink-600">
          <li>{t('guide.zone1')}</li>
          <li>{t('guide.zone2')}</li>
          <li>{t('guide.zone3')}</li>
        </ol>
        {/* The caveat sits with the feature, not in a footnote: the bands are a
            judgement and the user is the one answerable for the prices. */}
        <p className="rounded-md bg-warn-50 px-2 py-1.5 text-[11.5px] leading-relaxed text-ink-700">
          {t('guide.zoneCaveat')}
        </p>
      </Section>

      <Section title={t('guide.safetyTitle')}>
        <Bullets items={['guide.safety1', 'guide.safety2', 'guide.safety3', 'guide.safety4']} />
      </Section>

      <Section title={t('guide.troubleTitle')}>
        <Bullets
          items={[
            'guide.troubleNotAvailable',
            'guide.troubleRegionsVersion',
            'guide.troubleNoRate',
            'guide.troubleBlocked',
          ]}
        />
      </Section>

      <Section title={t('guide.panelTitle')}>
        <p className="text-[12px] leading-relaxed text-ink-600">{t('guide.panelBody')}</p>
      </Section>

      <Section title={t('guide.shortcutsTitle')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px] text-ink-600">
          <Shortcut keys="⇧P" label={t('guide.scOpen')} />
          <Shortcut keys="/" label={t('guide.scSearch')} />
          <Shortcut keys="⌘/Ctrl A" label={t('guide.scSelectAll')} />
          <Shortcut keys="⌘/Ctrl ↵" label={t('guide.scReview')} />
          <Shortcut keys="Esc" label={t('guide.scClose')} />
        </dl>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: ReactNode;
  tone?: 'accent';
}) {
  return (
    <section className="flex flex-col gap-2 border-b border-ink-200 px-4 py-3.5">
      <h2 className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[-0.01em] text-ink-900">
        {title}
        {tone === 'accent' && <Badge tone="accent">Pinto</Badge>}
      </h2>
      {children}
    </section>
  );
}

function Step({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-ink-200 px-2.5 py-2">
      <p className="text-[12px] font-medium text-ink-900">{title}</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-600">{body}</p>
    </div>
  );
}

function Bullets({ items }: { items: TranslationKey[] }) {
  const t = useT();
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[12px] leading-relaxed text-ink-600">
      {items.map((key) => (
        <li key={key}>{t(key)}</li>
      ))}
    </ul>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="contents">
      <kbd className="justify-self-start rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-700">
        {keys}
      </kbd>
      <span>{label}</span>
    </div>
  );
}
