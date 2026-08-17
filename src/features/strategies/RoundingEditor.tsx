import { useStore } from '@/app/store';
import { Label, Hint, TextField } from '@/components/Field';
import { cx } from '@/lib/cx';
import type { RoundingMode } from '@/types';

const MODES: { id: RoundingMode; label: string; blurb: string }[] = [
  {
    id: 'charm',
    label: 'Charm',
    blurb: 'Snap to .99, .95, .90 or .49 — whichever is closest. Never .00 or .50.',
  },
  { id: 'endings', label: 'My endings', blurb: 'Only the endings you list below.' },
  { id: 'integer', label: 'Whole units', blurb: 'Round to whole currency units.' },
  { id: 'none', label: 'Off', blurb: 'Keep the calculated price exactly.' },
];

export function RoundingEditor() {
  const { config, setConfig } = useStore();
  const rounding = config.rounding;

  return (
    <section className="flex flex-col gap-2.5 border-b border-ink-200 bg-white p-3">
      <Label>Rounding</Label>
      <div className="grid grid-cols-4 gap-1.5">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setConfig({ rounding: { ...rounding, mode: mode.id } })}
            className={cx(
              'rounded-md border px-2 py-1.5 text-[11.5px] font-medium transition-colors',
              rounding.mode === mode.id
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-200 text-ink-600 hover:bg-ink-50',
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <Hint>{MODES.find((mode) => mode.id === rounding.mode)?.blurb}</Hint>

      {rounding.mode === 'endings' && (
        <TextField
          label="Preferred endings"
          value={rounding.endings.join(', ')}
          placeholder="0.99, 0.49"
          onChange={(event) =>
            setConfig({
              rounding: {
                ...rounding,
                endings: event.target.value
                  .split(',')
                  .map((value) => Number(value.trim()))
                  .filter((value) => Number.isFinite(value) && value >= 0 && value < 1),
              },
            })
          }
          hint="Fractional parts between 0 and 1, comma separated."
        />
      )}

      {rounding.mode !== 'none' && (
        <TextField
          label="Step for currencies without decimals"
          inputMode="numeric"
          value={String(rounding.zeroDecimalStep)}
          onChange={(event) =>
            setConfig({
              rounding: { ...rounding, zeroDecimalStep: Number(event.target.value) || 100 },
            })
          }
          hint="JPY, KRW, CLP, VND, XAF and friends have no cents, so they snap to this step scaled to the size of the price."
        />
      )}

      <p className="rounded-md bg-ink-50 px-2 py-1.5 text-[11px] leading-relaxed text-ink-500">
        Rounding never moves a price by more than one whole unit, so it can tidy 5.42 into 5.49 but
        it will never quietly turn it into 9.99.
      </p>
    </section>
  );
}
