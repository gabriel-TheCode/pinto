import { useState } from 'react';
import { useStore } from '@/app/store';
import { Rich, useT } from '@/i18n/react';
import { Button, ErrorPanel, TextField } from '@/ui';
import { Frame, Hero } from './Frame';
import { isPackageName } from '@/services/playConsoleUrl';


/**
 * Play Console's URL only carries an internal app id, and the Play Developer
 * API is keyed by package name. When the page did not give it away, Pinto
 * asks once, says where to find it, and remembers the answer for this app.
 */
export function PackageScreen() {
  const t = useT();
  const consoleAppId = useStore((state) => state.context?.consoleAppId ?? '');
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const setPackageName = useStore((state) => state.setPackageName);
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const name = value.trim();
  const valid = isPackageName(name);

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    await setPackageName(name);
    setSaving(false);
  };

  return (
    <Frame>
      <Hero
        title={t('onboarding.package.title')}
        lead={<Rich text={t('onboarding.package.why', { id: consoleAppId })} />}
      />
      {error && <ErrorPanel error={error} onDismiss={() => setError(null)} />}
      <section className="flex flex-col gap-1.5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
        <h2 className="text-small font-semibold text-ink-900">{t('onboarding.package.whereTitle')}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-small text-ink-600">
          <li>{t('onboarding.package.whereDashboard')}</li>
          <li>
            <Rich text={t('onboarding.package.whereStore')} />
          </li>
        </ul>
      </section>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label={t('onboarding.package.label')}
          placeholder={t('onboarding.package.placeholder')}
          value={value}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          inputClassName="font-mono"
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setTouched(true)}
          error={touched && name && !valid ? t('onboarding.package.invalid') : null}
        />
        <Button type="submit" variant="primary" block loading={saving} disabled={!name}>
          {t('onboarding.package.submit')}
        </Button>
      </form>
    </Frame>
  );
}
