import { useId, useRef, useState } from 'react';
import { currencyLookup, useStore } from '@/app/store';
import { useFormat, useT } from '@/i18n/react';
import { strategySummary } from '@/i18n/describe';
import { download } from '@/lib/csv';
import { asPayload } from '@/services/client';
import type { Preset } from '@/types';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Disclosure,
  Hint,
  Icon,
  IconButton,
  Section,
  SelectField,
  TextField,
  toast,
} from '@/ui';
import { isNeutral, isRelative } from './model';

/** One line describing a preset: what it does, and to which countries. */
function usePresetLine(): (preset: Preset) => string {
  const t = useT();
  const fmt = useFormat();
  const pricing = useStore((state) => state.pricing);
  return (preset) => {
    const summary = strategySummary(t, fmt, preset.config, currencyLookup({ pricing }));
    return preset.regions.length
      ? t('strategy.presets.regions', { summary, count: preset.regions.length })
      : t('strategy.presets.anyRegions', { summary });
  };
}

/**
 * Ways to start that are not a blank form: the last change applied, and
 * saved presets. Offered, never pre-armed — nothing changes until "Use".
 */
export function StartFrom() {
  const t = useT();
  const fmt = useFormat();
  const recent = useStore((state) => state.recent);
  const presets = useStore((state) => state.presets);
  const pricing = useStore((state) => state.pricing);
  const setConfig = useStore((state) => state.setConfig);
  const applyPreset = useStore((state) => state.applyPreset);
  const presetLine = usePresetLine();
  const [presetId, setPresetId] = useState('');

  if (!recent && !presets.length) return null;
  const preset = presets.find((candidate) => candidate.id === presetId);

  return (
    <Section title={t('strategy.start.title')}>
      {recent && (
        <div className="flex flex-col gap-2 rounded-lg border border-ink-200 p-3">
          <div className="flex items-start gap-2.5">
            <Icon name="history" className="mt-0.5 text-ink-500" />
            <p className="min-w-0 flex-1 text-body text-ink-900">
              {t('strategy.recent.text', {
                summary: strategySummary(t, fmt, recent.config, currencyLookup({ pricing })),
                when: fmt.relative(recent.at),
              })}
            </p>
            <Button
              size="sm"
              // Optional fields an older record lacks must not survive from the current change.
              onClick={() => setConfig({ maxIncrease: null, maxDecrease: null, overrides: {}, ...recent.config })}
            >
              {t('strategy.recent.use')}
            </Button>
          </div>
          {isRelative(recent.config) && (
            <p className="flex items-start gap-1.5 text-small text-warn-500">
              <Icon name="warning" size={14} className="mt-px" />
              {t('strategy.recent.compounds')}
            </p>
          )}
        </div>
      )}
      {presets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end gap-2">
            <SelectField
              label={t('strategy.presets.label')}
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
              className="flex-1"
            >
              <option value="" disabled>
                {t('strategy.presets.choose')}
              </option>
              {presets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </SelectField>
            <Button disabled={!preset} onClick={() => preset && applyPreset(preset)}>
              {t('strategy.presets.use')}
            </Button>
          </div>
          {preset && <Hint>{preset.description || presetLine(preset)}</Hint>}
        </div>
      )}
    </Section>
  );
}

/** Saving, sharing and deleting presets. Always reachable, so a first import is possible. */
export function PresetManager() {
  const t = useT();
  const fmt = useFormat();
  const presets = useStore((state) => state.presets);
  const config = useStore((state) => state.config);
  const pricing = useStore((state) => state.pricing);
  const applyPreset = useStore((state) => state.applyPreset);
  const deletePreset = useStore((state) => state.deletePreset);
  const importPresets = useStore((state) => state.importPresets);
  const presetLine = usePresetLine();
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Preset | null>(null);
  const neutral = isNeutral(config);

  return (
    <Disclosure title={t('strategy.presets.manage')} summary={t('strategy.presets.count', { count: presets.length })}>
      {presets.length === 0 ? (
        <p className="text-small text-ink-500">{t('strategy.presets.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-100">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-body font-medium text-ink-900" title={preset.name}>
                  {preset.name}
                </p>
                {preset.description && <p className="text-small text-ink-600">{preset.description}</p>}
                <p className="text-small text-ink-500">{presetLine(preset)}</p>
              </div>
              <Button size="sm" onClick={() => applyPreset(preset)}>
                {t('strategy.presets.use')}
              </Button>
              <IconButton
                icon="trash"
                label={t('strategy.presets.delete', { name: preset.name })}
                onClick={() => setDeleting(preset)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-3">
        <Button size="sm" icon="plus" disabled={neutral} onClick={() => setSaving(true)}>
          {t('strategy.presets.save')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="download"
          disabled={!presets.length}
          onClick={() => download('pinto-presets.json', JSON.stringify(presets, null, 2), 'application/json')}
        >
          {t('strategy.presets.export')}
        </Button>
        <Button size="sm" variant="ghost" icon="upload" onClick={() => fileInput.current?.click()}>
          {t('strategy.presets.import')}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          tabIndex={-1}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (file) await importPresets(await file.text());
            input.value = '';
          }}
        />
      </div>
      {neutral && <Hint>{t('strategy.presets.saveNeutral')}</Hint>}

      <SavePresetDialog
        open={saving}
        onClose={() => setSaving(false)}
        summary={neutral ? '' : strategySummary(t, fmt, config, currencyLookup({ pricing }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting && void deletePreset(deleting.id).catch((error) => toast({ error: asPayload(error) }, 'error'))
        }
        tone="danger"
        title={t('strategy.presets.deleteTitle', { name: deleting?.name ?? '' })}
        description={t('strategy.presets.deleteBody')}
        confirmLabel={t('action.delete')}
      />
    </Disclosure>
  );
}

function SavePresetDialog({ open, onClose, summary }: { open: boolean; onClose: () => void; summary: string }) {
  const t = useT();
  const selected = useStore((state) => state.selection.size);
  const savePreset = useStore((state) => state.savePreset);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [withSelection, setWithSelection] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const formId = useId();

  const close = () => {
    setName('');
    setDescription('');
    setTried(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('strategy.presets.saveTitle')}
      description={summary}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('action.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setTried(true);
          if (!name.trim()) return;
          setBusy(true);
          await savePreset(name.trim(), description.trim(), withSelection && selected > 0);
          setBusy(false);
          close();
        }}
      >
        <TextField
          label={t('strategy.presets.name')}
          placeholder={t('strategy.presets.namePlaceholder')}
          value={name}
          maxLength={80}
          aria-required
          autoFocus
          onChange={(event) => setName(event.target.value)}
          error={tried && !name.trim() ? t('strategy.presets.nameRequired') : null}
        />
        <TextField
          label={t('strategy.presets.description')}
          value={description}
          maxLength={280}
          onChange={(event) => setDescription(event.target.value)}
        />
        {selected > 0 && (
          <Checkbox
            checked={withSelection}
            onChange={setWithSelection}
            label={t('strategy.presets.withSelection', { count: selected })}
          />
        )}
        {selected > 0 && !withSelection && <Hint>{t('strategy.presets.withoutSelection')}</Hint>}
      </form>
    </Dialog>
  );
}
