import type { RegionCode, TierStrategy } from '@/types';
import { COUNTRIES } from './countries';

/**
 * Purchasing-power bands, and the generator that turns them into a tier ladder.
 *
 * This is the capability Play Console lacks: it can set one price everywhere,
 * or make you edit 150 countries by hand, but it cannot say "price this market
 * at 60% of the US price because that is what people there can pay". So the
 * classification has to live in the product — a tool that cannot produce the
 * ladder it consumes is not solving the problem it exists for.
 *
 * The safeguards are what keep this honest, and they are not optional:
 *
 *   - Nothing here is ever applied automatically. The user asks for a ladder,
 *     sees every band and every country, and passes through Review before a
 *     single price is written.
 *   - Every share is editable, every country can be moved between bands or
 *     dropped entirely, in the Tiers editor.
 *   - The basis is stated, not implied — see BAND_BASIS below.
 *
 * Basis: World Bank income groupings and GNI per capita at purchasing power
 * parity, adjusted for observed app-store spending, which runs materially
 * below income alone in several upper-middle-income markets. It is a defensible
 * starting point, not a measurement, and it ages — treat it as a first draft of
 * your pricing, not an answer.
 */

export const BAND_BASIS =
  'World Bank income groups and GNI per capita at PPP, adjusted for observed app-store spend. A starting point to edit, not a measurement.';

export interface EconomicBand {
  id: string;
  label: string;
  /** One-line description of who is in this band, shown in the editor. */
  blurb: string;
  members: RegionCode[];
}

function codes(list: string): RegionCode[] {
  return list.split(/\s+/).filter(Boolean);
}

export const ECONOMIC_BANDS: EconomicBand[] = [
  {
    id: 'T1',
    label: 'T1 · Premium',
    blurb: 'High income, high app spend',
    members: codes(`AE AT AU BE BH BM BN CA CH DE DK FI FR GB HK IE IL IS JP KR KW KY
                    LI LU NL NO NZ QA SE SG TW US`),
  },
  {
    id: 'T2',
    label: 'T2 · Established',
    blurb: 'High income, softer app spend',
    members: codes(`AG BB BS CL CY CZ EE ES GR HR IT LT LV MT OM PA PL PT SA SI SK TT UY`),
  },
  {
    id: 'T3',
    label: 'T3 · Upper-mid',
    blurb: 'Upper-middle income',
    members: codes(`AL AM AR AZ BA BG BR BW BY CG CN CR DO GA GE HU IQ JM JO KZ LB LY
                    ME MK MU MX MY NA RO RS RU TH TR ZA`),
  },
  {
    id: 'T4',
    label: 'T4 · Lower-mid',
    blurb: 'Lower-middle income',
    members: codes(`AO BO BT BZ CI CM CO DZ EC EG FJ GH GT GY HN HT ID KE KG LK MA MD
                    MN MV NG NI PE PG PH PS PY SN SR SV TJ TM TN UA UZ VE VN ZM ZW`),
  },
  {
    id: 'T5',
    label: 'T5 · Volume',
    blurb: 'Low income, price-sensitive, high volume',
    members: codes(`AF BD BF BJ CD ET GN IN KH LA MG ML MM MW MZ NE NP PK RW TD TG TZ UG YE`),
  },
];

/**
 * How steeply prices fall across the bands.
 *
 * The classification (which country sits in which band) is data; how much
 * discount each band gets is a business decision, so it is a dial rather than
 * a constant. `flat` exists so a user can start from "same price everywhere"
 * and open the gap themselves.
 */
export type LadderCurve = 'gentle' | 'balanced' | 'aggressive' | 'flat';

export const CURVES: Record<LadderCurve, { label: string; blurb: string; shares: number[] }> = {
  flat: {
    label: 'Flat',
    blurb: 'Same price everywhere — open the gaps yourself.',
    shares: [1, 1, 1, 1, 1],
  },
  gentle: {
    label: 'Gentle',
    blurb: 'Small discounts. Protects revenue per sale.',
    shares: [1, 0.9, 0.8, 0.7, 0.65],
  },
  balanced: {
    label: 'Balanced',
    blurb: 'Moderate. A good default for one-time purchases.',
    shares: [1, 0.85, 0.7, 0.6, 0.55],
  },
  aggressive: {
    label: 'Aggressive',
    blurb: 'Deep discounts. Favours volume in emerging markets.',
    shares: [1, 0.8, 0.6, 0.5, 0.4],
  },
};

export interface LadderOptions {
  curve: LadderCurve;
  /** Reference market the ladder is a share of. */
  baseRegion: RegionCode;
  /** Absolute anchor price in the base region's currency (micros). */
  anchorMicros?: number;
  convert?: boolean;
  /**
   * Restrict the ladder to these regions — normally the ones the product
   * actually prices. Bands are still complete; members outside the set are
   * simply left unassigned so they are never touched.
   */
  restrictTo?: RegionCode[] | null;
}

/**
 * Builds a ready-to-edit tier strategy from the bands and a curve.
 *
 * Returned, not applied: the caller drops it into the Tiers editor where every
 * number and every country is still open for change.
 */
export function generateLadder(options: LadderOptions): TierStrategy {
  const { curve, baseRegion, anchorMicros, convert = true, restrictTo } = options;
  const shares = CURVES[curve].shares;
  const allowed = restrictTo ? new Set(restrictTo) : null;

  const tiers: Record<string, number> = {};
  const assignment: Record<RegionCode, string> = {};

  ECONOMIC_BANDS.forEach((band, index) => {
    const members = allowed ? band.members.filter((code) => allowed.has(code)) : band.members;
    // An empty band would show as a dead row in the editor, so it is omitted.
    if (!members.length) return;
    tiers[band.label] = shares[index] ?? 1;
    for (const code of members) assignment[code] = band.label;
  });

  const strategy: TierStrategy = {
    kind: 'tiers',
    baseRegion,
    tiers,
    assignment,
    convert,
  };
  if (anchorMicros != null) strategy.anchorMicros = anchorMicros;
  return strategy;
}

/** Countries Pinto knows that no band covers — surfaced rather than hidden. */
export function unbandedCountries(): RegionCode[] {
  const banded = new Set(ECONOMIC_BANDS.flatMap((band) => band.members));
  return COUNTRIES.map((country) => country.code).filter((code) => !banded.has(code));
}

export function bandOf(region: RegionCode): EconomicBand | undefined {
  return ECONOMIC_BANDS.find((band) => band.members.includes(region));
}
