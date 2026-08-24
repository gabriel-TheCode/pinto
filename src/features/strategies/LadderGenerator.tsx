import { useState } from 'react';
import { useStore } from '@/app/store';
import type { RegionCode, Strategy, TierStrategy } from '@/types';
import { Button } from '@/components/Button';
import { Label, Hint } from '@/components/Field';
import { cx } from '@/lib/cx';
import { MICROS_PER_UNIT, formatMicros, unitsToMicros } from '@/domain/money/money';
import {
  BAND_BASIS,
  CURVES,
  ECONOMIC_BANDS,
  generateLadder,
  type LadderCurve,
} from '@/domain/regions/economicBands';

const CURVE_ORDER: LadderCurve[] = ['flat', 'gentle', 'balanced', 'aggressive'];

/**
 * Builds a purchasing-power ladder in one step.
 *
 * This is the feature the extension exists for: Google Play can set one price
 * for every country, or make you edit them one at a time, but it has no notion
 * of "charge less where people earn less". Generating that ladder is therefore
 * the product, not a convenience — and keeping it out of the app on principle
 * only moved the work somewhere the user could not reach.
 *
 * The judgement stays the user's: the generator runs on request, shows what it
 * produced, and hands back something entirely editable. Nothing is written
 * until Review.
 */
export function LadderGenerator({
  strategy,
  regions,
  onChange,
  onGenerated,
}: {
  strategy: TierStrategy;
  regions: RegionCode[];
  onChange: (strategy: Strategy) => void;
  onGenerated?: () => void;
}) {
  const pricing = useStore((state) => state.pricing);
  const setSelection = useStore((state) => state.setSelection);
  const [curve, setCurve] = useState<LadderCurve>('balanced');
  const [open, setOpen] = useState(false);

  const basePrice = pricing?.prices.find((p) => p.regionCode === strategy.baseRegion);
  const baseCurrency = basePrice?.currency ?? 'USD';
  const currentAnchor = strategy.anchorMicros ?? basePrice?.micros ?? 0;
  const [anchor, setAnchor] = useState(String(currentAnchor / MICROS_PER_UNIT || ''));

  const anchorMicros = unitsToMicros(Number(anchor) || 0);
  const shares = CURVES[curve].shares;

  const generate = () => {
    const next = generateLadder({
      curve,
      baseRegion: strategy.baseRegion,
      convert: strategy.convert,
      restrictTo: regions,
      ...(anchorMicros > 0 ? { anchorMicros } : {}),
    });
    onChange(next);
    // Tiering a market decides its price; selecting it decides whether that
    // price is written. Generating a ladder means intending to price those
    // markets, so the selection is brought in line with it.
    setSelection(Object.keys(next.assignment));
    onGenerated?.();
  };

  if (!open) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-accent-500/30 bg-accent-50 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-ink-900">Price by economic zone</p>
          <p className="text-[11.5px] text-ink-600">
            Build a ladder across {ECONOMIC_BANDS.length} purchasing-power bands, then edit it.
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
          Generate
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent-500/30 bg-accent-50/60 p-2.5">
      <div className="flex items-baseline justify-between">
        <Label>Generate a purchasing-power ladder</Label>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-ink-500 hover:text-ink-900"
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11.5px] text-ink-600">
          Anchor price in {strategy.baseRegion} ({baseCurrency})
        </span>
        <div className="flex items-center gap-2">
          <input
            value={anchor}
            onChange={(event) => setAnchor(event.target.value)}
            inputMode="decimal"
            placeholder={basePrice ? String(basePrice.micros / MICROS_PER_UNIT) : '4.99'}
            className="h-8 w-28 rounded-md border border-ink-200 bg-white px-2 text-[12.5px] tabular focus:border-accent-500 focus:outline-none"
            aria-label="Anchor price"
          />
          {basePrice && (
            <button
              type="button"
              onClick={() => setAnchor(String(basePrice.micros / MICROS_PER_UNIT))}
              className="text-[11px] text-accent-700 hover:underline"
            >
              use current ({formatMicros(basePrice.micros, basePrice.currency)})
            </button>
          )}
        </div>
        <Hint>Every band is a share of this. Leave empty to use the current base price.</Hint>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11.5px] text-ink-600">How steeply prices fall</span>
        <div className="grid grid-cols-4 gap-1.5">
          {CURVE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCurve(id)}
              className={cx(
                'rounded-md border px-1.5 py-1.5 text-[11.5px] font-medium transition-colors',
                curve === id
                  ? 'border-accent-500 bg-accent-500 text-white'
                  : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50',
              )}
            >
              {CURVES[id].label}
            </button>
          ))}
        </div>
        <Hint>{CURVES[curve].blurb}</Hint>
      </div>

      {/* Show the resulting prices before generating — the whole point is that
          the user judges the ladder, so it cannot be a black box. */}
      <div className="overflow-hidden rounded-md border border-ink-200 bg-white">
        {ECONOMIC_BANDS.map((band, index) => {
          const share = shares[index] ?? 1;
          const count = band.members.filter((code) => regions.includes(code)).length;
          return (
            <div
              key={band.id}
              className="flex items-center gap-2 border-b border-ink-100 px-2 py-1 last:border-b-0"
            >
              <span className="w-[86px] shrink-0 truncate text-[11.5px] text-ink-800">
                {band.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-400">
                {band.blurb}
              </span>
              <span className="shrink-0 text-[10.5px] text-ink-400 tabular">{count}</span>
              <span className="w-9 shrink-0 text-right text-[11.5px] text-ink-600 tabular">
                {Math.round(share * 100)}%
              </span>
              <span className="w-16 shrink-0 text-right text-[11.5px] font-medium text-ink-900 tabular">
                {anchorMicros > 0
                  ? formatMicros(anchorMicros * share, baseCurrency, { withCode: false })
                  : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10.5px] leading-relaxed text-ink-500">
        {BAND_BASIS} Generating replaces the current bands; every share and every country stays
        editable below, and nothing is written until you review it.
      </p>

      <Button size="sm" variant="primary" onClick={generate}>
        Generate ladder
      </Button>
    </div>
  );
}
