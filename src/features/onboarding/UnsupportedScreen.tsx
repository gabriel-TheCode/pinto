import { useState } from 'react';
import { useStore } from '@/app/store';
import { Rich, useT } from '@/i18n/react';
import { Button, ErrorPanel, Icon, announce } from '@/ui';
import { Frame, Hero } from './Frame';

/**
 * The panel is open on a Play Console page without prices. Pinto follows the
 * tab on its own, so this screen only has to say where to go.
 */
export function UnsupportedScreen() {
  const t = useT();
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const refreshContext = useStore((state) => state.refreshContext);
  const [checking, setChecking] = useState(false);
  const [still, setStill] = useState(false);

  const check = async () => {
    setChecking(true);
    setStill(false);
    await refreshContext();
    setChecking(false);
    // Same page as before: say so, or the button looks broken.
    const { context, error: failed } = useStore.getState();
    if (!context?.supported && !failed) {
      setStill(true);
      announce(t('onboarding.unsupported.still'));
    }
  };

  return (
    <Frame>
      <span className="grid size-10 place-items-center rounded-full bg-ink-100 text-ink-500">
        <Icon name="tag" size={18} />
      </span>
      <Hero title={t('onboarding.unsupported.title')} lead={t('onboarding.unsupported.body')} />
      {error && <ErrorPanel error={error} onDismiss={() => setError(null)} />}
      <section className="flex flex-col gap-1.5">
        <h2 className="text-small font-semibold text-ink-900">{t('onboarding.unsupported.howTitle')}</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-small text-ink-600">
          <li>{t('onboarding.unsupported.how1')}</li>
          <li>
            <Rich text={t('onboarding.unsupported.how2')} />
          </li>
          <li>{t('onboarding.unsupported.how3')}</li>
        </ol>
      </section>
      <div className="flex flex-col items-start gap-2">
        <Button icon="refresh" loading={checking} onClick={() => void check()}>
          {t('onboarding.unsupported.check')}
        </Button>
        {still && <p className="text-small text-ink-500">{t('onboarding.unsupported.still')}</p>}
      </div>
    </Frame>
  );
}
