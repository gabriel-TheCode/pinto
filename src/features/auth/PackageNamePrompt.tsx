import { useState } from 'react';
import { useStore } from '@/app/store';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';

const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

/**
 * Play Console's URL only carries an internal numeric app id, and the Play
 * Developer API is keyed by package name. Rather than depend on scraping the
 * page — which would break the day Google reshuffles a header — Pinto asks
 * once and remembers the answer for that app.
 */
export function PackageNamePrompt() {
  const { context, setPackageName } = useStore();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const invalid = touched && !PACKAGE.test(value.trim());

  return (
    <div className="flex h-full flex-col justify-center bg-white px-7">
      <div className="mx-auto flex w-full max-w-[340px] flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[16px] font-semibold tracking-[-0.015em] text-ink-900">
            Which app is this?
          </h1>
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Play Console identifies this app as{' '}
            <span className="font-mono text-ink-700">#{context?.consoleAppId}</span> in the URL, but
            the Play Developer API needs its package name. Pinto asks once and remembers it.
          </p>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (PACKAGE.test(value.trim())) void setPackageName(value.trim());
          }}
        >
          <TextField
            label="Package name"
            placeholder="com.example.app"
            value={value}
            spellCheck={false}
            autoFocus
            autoComplete="off"
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setTouched(true)}
            error={invalid ? 'That does not look like a package name.' : null}
            hint="Play Console shows it under App information, or in the Play Store URL for the app."
          />
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
