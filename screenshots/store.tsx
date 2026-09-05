/**
 * Chrome Web Store listing assets, rendered from the shipping components.
 *
 * The five screenshots frame the real panel — same fixtures as the README
 * harness, same store, same change-set computation — against a branded ground,
 * because the store wants 1280x800 landscape and the panel is a 460px window.
 * Framing it is honest; redrawing it would not be.
 *
 * `?asset=` picks the template and `?shot=` the screen, so each image is one
 * page load and the whole set is reproducible with `npm run store:assets`.
 */
import { createRoot } from 'react-dom/client';
import { installChromeStub, FIXTURE_PRODUCT } from './fixtures';
import { poseStore, markReady } from './pose';

installChromeStub();
await import('./styles.css');

/** The icon glyph: a blocky P with a period, 6 wide by 8 tall. */
const GLYPH = [
  '111100',
  '100100',
  '100100',
  '111100',
  '100000',
  '100000',
  '100011',
  '000011',
];

function Mark({ size }: { size: number }) {
  // Snap every cell to a whole pixel, the way generate-icons.mjs does, so the
  // mark reads as pixel art rather than a blurry letterform.
  const cell = Math.floor((size * 0.42) / 6);
  const pad = Math.round((size - cell * 6) / 2);
  return (
    <div
      className="mark"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        padding: `${Math.round((size - cell * 8) / 2)}px ${pad}px`,
      }}
      aria-label="Pinto"
    >
      {GLYPH.flatMap((row, y) =>
        [...row].map((on, x) => <i key={`${x}-${y}`} className={on === '1' ? 'on' : ''} />),
      )}
    </div>
  );
}

interface Shot {
  screen: string;
  strategy?: 'tiers';
  headline: [string, string];
  body: string;
  bullets: string[];
  panelHeight: number;
}

/**
 * One caption per screenshot, each naming what that screen decides. A listing
 * read in a hurry is five headlines, so each has to stand alone.
 */
const SHOTS: Record<string, Shot> = {
  pricing: {
    screen: 'pricing',
    strategy: 'tiers',
    headline: ['Every price,', 'one table.'],
    body: 'Filter your markets by search, continent, sub-region or currency. The new price sits beside the old one, with the change beside both.',
    bullets: ['Search and filter', 'Per-country selection', 'Live preview'],
    panelHeight: 660,
  },
  tiers: {
    screen: 'strategy',
    strategy: 'tiers',
    headline: ['Price by', 'economic zone.'],
    body: 'The thing Play Console cannot do. Generate a purchasing-power ladder across five bands, pick how steep it is, then edit any share or any country.',
    bullets: ['Five income bands', 'Four steepness curves', 'Editable everywhere'],
    panelHeight: 700,
  },
  review: {
    screen: 'review',
    strategy: 'tiers',
    headline: ['Nothing is written', 'until you say so.'],
    body: 'Review splits into changing, warnings, blocked and unchanged. Blocked rows never reach Google, and every row tells you why.',
    bullets: ['Row-by-row diff', 'Warnings before writes', 'Blocked rows explained'],
    panelHeight: 660,
  },
  history: {
    screen: 'history',
    strategy: 'tiers',
    headline: ['Undo, from a', 'real snapshot.'],
    body: 'Prices are captured immediately before every write. When a run goes wrong, put them back exactly as they were — not as they were guessed to be.',
    bullets: ['Snapshot per operation', 'One-click undo', 'Per-country outcome'],
    panelHeight: 505,
  },
  guide: {
    screen: 'guide',
    headline: ['Learn it', 'in the app.'],
    body: 'A Guide tab walks through the workflow, the strategies, the safety rails and the error messages Google actually returns — in English or French.',
    bullets: ['Built-in guide', 'English and French', 'Real error messages'],
    panelHeight: 700,
  },
};

const TAGLINE = 'Bulk pricing, without the bulk work.';

function ScreenshotFrame({ shot }: { shot: Shot }) {
  return (
    <div className="canvas">
      <div className="shot">
        <div className="copy">
          <div className="brandline">
            <Mark size={40} />
            <span className="wordmark" style={{ fontSize: 26 }}>
              Pinto
            </span>
          </div>
          <h1>
            {shot.headline[0]}
            <br />
            <em>{shot.headline[1]}</em>
          </h1>
          <p>{shot.body}</p>
          <ul>
            {shot.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <div className="panelframe" style={{ height: shot.panelHeight }}>
          <div id="root" style={{ height: shot.panelHeight }} />
        </div>
      </div>
    </div>
  );
}

/**
 * The marquee's before/after prices, computed by the same function the review
 * screen and the apply engine use. Typing them by hand would have made the
 * banner the one surface in the project allowed to claim a number it cannot
 * produce.
 */
async function ladderChips(): Promise<[string, string, string][]> {
  const [{ computeChangeSet }, { generateLadder }, { formatMicros }, { countryOrPlaceholder }] =
    await Promise.all([
      import('@/domain/pricing/computeChangeSet'),
      import('@/domain/regions/economicBands'),
      import('@/domain/money/money'),
      import('@/domain/regions/countries'),
    ]);

  const regions = FIXTURE_PRODUCT.prices.map((price) => price.regionCode);
  const { changes } = computeChangeSet({
    product: FIXTURE_PRODUCT,
    selection: regions,
    config: {
      strategy: generateLadder({
        curve: 'aggressive',
        baseRegion: 'US',
        anchorMicros: 4_990_000,
        restrictTo: regions,
      }),
      rounding: { mode: 'charm', endings: [0.99, 0.49], zeroDecimalStep: 100 },
      floorMicros: null,
      ceilingMicros: null,
    },
  });

  // Five markets that actually move, spread across the bands and the
  // currencies — a chip whose two prices are identical reads as a bug rather
  // than as the anchor holding still.
  const wanted = ['BR', 'ZA', 'IN', 'ID', 'KE'];
  return wanted
    .map((region) => changes.find((change) => change.regionCode === region))
    .filter((change) => change && change.newMicros != null && change.newMicros !== change.currentMicros)
    .slice(0, 5)
    .map((change) => [
      countryOrPlaceholder(change!.regionCode).name,
      // The old price carries the currency code; repeating it on the new one
      // would just be noise in a chip that is two numbers wide.
      formatMicros(change!.currentMicros, change!.currency),
      formatMicros(change!.newMicros!, change!.currency, { withCode: false }),
    ]);
}

function Tile({ kind, chips }: { kind: 'small' | 'marquee'; chips: [string, string, string][] }) {
  const marquee = kind === 'marquee';
  return (
    <div className="canvas">
      <div className={`tile ${kind}`}>
        <div className="row">
          <Mark size={marquee ? 150 : 68} />
          <span className="wordmark">Pinto</span>
        </div>
        <p className="tagline">{TAGLINE}</p>
        {marquee && (
          <>
            <p className="sub">
              Change Google Play prices across every country from one
              review-before-apply workflow — by percentage, by formula, or by
              purchasing-power band.
            </p>
            <div className="chips">
              {chips.map(([country, before, after]) => (
                <span className="chip" key={country}>
                  {country} <s>{before}</s> <u>{after}</u>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const params = new URLSearchParams(location.search);
const asset = params.get('asset') ?? 'shot';
const canvas = createRoot(document.getElementById('canvas')!);

if (asset === 'shot') {
  const shot = SHOTS[params.get('shot') ?? 'pricing'];
  if (!shot) throw new Error(`unknown shot: ${params.get('shot')}`);
  canvas.render(<ScreenshotFrame shot={shot} />);

  // The frame has to exist before the panel can be mounted into it.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const { App } = await import('@/app/App');
  createRoot(document.getElementById('root')!).render(<App />);
  await poseStore({ screen: shot.screen, strategy: shot.strategy ?? null, curve: 'aggressive' });
} else {
  const marquee = asset === 'marquee';
  canvas.render(<Tile kind={marquee ? 'marquee' : 'small'} chips={marquee ? await ladderChips() : []} />);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

markReady();
