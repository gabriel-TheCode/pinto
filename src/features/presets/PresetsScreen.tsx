import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/app/store';
import { safeParsePresetList } from '@/domain/presets/schema';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { EmptyState } from '@/components/Feedback';
import { describeStrategy } from '@/domain/pricing/computeChangeSet';
import { download } from '@/lib/csv';
import { toast } from '@/components/Toast';
import { send } from '@/services/client';

export function PresetsScreen() {
  const { presets, loadPresets, savePreset, deletePreset, applyPreset, selection } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  return (
    <div className="flex h-full flex-col">
      <section className="flex flex-col gap-2 border-b border-ink-200 bg-white p-3">
        <TextField
          label="Save the current strategy"
          placeholder="Europe premium"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          placeholder="What is this for?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={!name.trim()}
            onClick={async () => {
              await savePreset(name.trim(), description.trim());
              setName('');
              setDescription('');
            }}
          >
            Save preset
          </Button>
          <span className="self-center text-[11.5px] text-ink-400">
            Includes the {selection.size} selected {selection.size === 1 ? 'country' : 'countries'}
          </span>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {presets.length === 0 ? (
          <EmptyState
            title="No presets yet"
            body="Save a strategy once and reuse it across products and apps — a launch discount, a regional uplift, your standard tier map."
          />
        ) : (
          presets.map((preset) => (
            <div key={preset.id} className="border-b border-ink-100 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink-900">{preset.name}</p>
                  {preset.description && (
                    <p className="text-[11.5px] text-ink-500">{preset.description}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {describeStrategy(preset.config)} ·{' '}
                    {preset.regions.length
                      ? `${preset.regions.length} countries`
                      : 'current selection'}
                  </p>
                </div>
                <Button size="sm" onClick={() => applyPreset(preset)}>
                  Use
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void deletePreset(preset.id)}>
                  ✕
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-ink-200 bg-white px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={!presets.length}
          onClick={() =>
            download('pinto-presets.json', JSON.stringify(presets, null, 2))
          }
        >
          Export JSON
        </Button>
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
          Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const result = safeParsePresetList(JSON.parse(await file.text()));
              if (!result.ok) {
                toast(`Could not import: ${result.error}`, 'error');
                event.target.value = '';
                return;
              }
              for (const preset of result.presets) {
                await send({ type: 'presets/save', preset: { ...preset, id: crypto.randomUUID() } });
              }
              await loadPresets();
              toast(`Imported ${result.presets.length} presets.`, 'success');
            } catch {
              toast('That file is not valid JSON.', 'error');
            }
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
