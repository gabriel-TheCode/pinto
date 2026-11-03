import type {
  ChangeIssue,
  Continent,
  OperationFailure,
  OperationRecord,
  ProductDetails,
  ProductKind,
  RegionCode,
  StrategyConfig,
} from '@/types';
import type { PintoErrorPayload, ProductSummary } from '@/services/messages';
import type { LadderCurve } from '@/domain/regions/economicBands';
import type { Formatter } from './format';
import { maybe, type T } from './index';

/**
 * Domain values in words. The pricing core, the API client and the worker
 * speak in codes and numbers; this is the one place those become sentences,
 * so every screen describes a strategy, an issue or an error the same way.
 */

// --- Places -------------------------------------------------------------------

export function continentName(t: T, continent: Continent | string): string {
  return maybe(t, `continent.${continent}`) ?? continent;
}

export function subregionName(t: T, subregion: string): string {
  return maybe(t, `subregion.${subregion}`) ?? subregion;
}

export function bandName(t: T, bandId: string, fallback: string): string {
  return maybe(t, `band.${bandId}.label`) ?? fallback;
}

export function bandBlurb(t: T, bandId: string): string {
  return maybe(t, `band.${bandId}.blurb`) ?? '';
}

export function curveName(t: T, curve: LadderCurve): string {
  return t(`curve.${curve}.label`);
}

export function curveBlurb(t: T, curve: LadderCurve): string {
  return t(`curve.${curve}.blurb`);
}

// --- Products -----------------------------------------------------------------

/** `P1M` → "1 month". Unknown shapes are shown as Google wrote them. */
export function periodName(t: T, iso: string): string {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso);
  if (!match) return iso;
  const [, y, m, w, d] = match;
  if (y) return t('period.year', { count: Number(y) });
  if (m) return t('period.month', { count: Number(m) });
  if (w) return t('period.week', { count: Number(w) });
  if (d) return t('period.day', { count: Number(d) });
  return iso;
}

/** The words after the ids: "1 month", "buy · draft". */
export function productDetailsText(t: T, details: ProductDetails | undefined): string[] {
  const parts: string[] = [];
  if (!details) return parts;
  if (details.period) parts.push(periodName(t, details.period));
  if (details.option) parts.push(t(`product.option.${details.option}`));
  if (details.state) parts.push(maybe(t, `product.state.${details.state}`) ?? details.state);
  return parts;
}

/** `premium · monthly · 1 month` — ids stay as typed in Play Console. */
export function productName(
  t: T,
  product: Pick<ProductSummary, 'kind' | 'productId' | 'basePlanId' | 'details'>,
): string {
  const ids = product.kind === 'inapp' ? [product.productId] : [product.productId, product.basePlanId];
  return [...ids, ...productDetailsText(t, product.details)].join(' · ');
}

export function productKindName(t: T, kind: ProductKind): string {
  return t(`product.kind.${kind}`);
}

// --- Strategies -----------------------------------------------------------------

/**
 * One line describing a strategy, e.g. "+10% on current prices" or
 * "USD 4.99, converted per country". Amounts need a currency, which comes from
 * the product's price in the reference country when known.
 */
export function strategySummary(
  t: T,
  fmt: Formatter,
  config: StrategyConfig,
  currencyOf: (region: RegionCode) => string | undefined = () => undefined,
): string {
  const s = config.strategy;
  switch (s.kind) {
    case 'percentage':
      return t('strategy.summary.percentage', { delta: fmt.delta(s.percent / 100) });
    case 'multiplier':
      return t('strategy.summary.multiplier', { factor: fmt.number(s.factor) });
    case 'fixed': {
      const currency = currencyOf(s.baseRegion) ?? 'USD';
      const price = fmt.money(s.micros, currency);
      return s.convert
        ? t('strategy.summary.fixedConverted', { price })
        : t('strategy.summary.fixed', { price });
    }
    case 'copy': {
      const country = fmt.region(s.fromRegion);
      return s.convert
        ? t('strategy.summary.copyConverted', { country })
        : t('strategy.summary.copy', { country });
    }
    case 'tiers':
      return t('strategy.summary.tiers', {
        count: Object.keys(s.tiers).length,
        country: fmt.region(s.baseRegion),
      });
    case 'formula':
      return t('strategy.summary.formula', { expression: s.expression });
    default:
      return '';
  }
}

/** What an operation did, for history and the result screen. */
export function operationSummary(t: T, fmt: Formatter, record: OperationRecord): string {
  if (record.revertOf) return t('strategy.summary.revert');
  if (record.config) {
    const currency = new Map(record.snapshot.map((p) => [p.regionCode, p.currency]));
    return strategySummary(t, fmt, record.config, (region) => currency.get(region));
  }
  // Records written before 1.1 carry only an English label.
  return record.strategyLabel ? t('strategy.summary.legacy', { label: record.strategyLabel }) : '';
}

// --- Issues -------------------------------------------------------------------

export function issueText(t: T, fmt: Formatter, issue: ChangeIssue): string {
  const params = issue.params ?? {};
  switch (issue.code) {
    case 'large-increase':
    case 'large-decrease':
      return t(`issue.${issue.code}`, { threshold: fmt.share(Number(params.threshold ?? 0.5)) });
    case 'clamped-increase':
    case 'clamped-decrease':
      return t(`issue.${issue.code}`, { limit: fmt.share(Number(params.limit ?? 0)) });
    case 'formula-error': {
      const reason =
        maybe(t, `formula.${String(params.reason)}`, params) ?? t('formula.invalid');
      return t('issue.formula-error', { reason });
    }
    case 'granularity-minor':
      return t('issue.granularity-minor', {
        currency: String(params.currency ?? ''),
        decimals: Number(params.decimals ?? 2),
        count: Number(params.decimals ?? 2),
      });
    default:
      return maybe(t, `issue.${issue.code}`, params) ?? issue.code;
  }
}

export function formulaErrorText(
  t: T,
  error: { code: string; params?: Record<string, string | number> },
): string {
  return maybe(t, `formula.${error.code}`, error.params) ?? t('formula.invalid');
}

// --- Errors -------------------------------------------------------------------

export interface ErrorText {
  title: string;
  hint: string;
}

/**
 * The headline and next step for an error code. Unknown codes fall back to a
 * generic message — the code and Google's own words stay available as
 * technical details, so nothing is hidden, only kept out of the headline.
 */
export function errorText(
  t: T,
  fmt: Formatter,
  error: Pick<PintoErrorPayload, 'code' | 'params'>,
): ErrorText {
  const base = `error.${error.code.replace('/', '.')}`;
  const params = withRegionNames(fmt, error.params);
  const title = maybe(t, `${base}.title`, params);
  const hint = maybe(t, `${base}.hint`, params);
  return title
    ? { title, hint: hint ?? '' }
    : { title: t('error.generic.title'), hint: t('error.generic.hint') };
}

export function failureText(t: T, fmt: Formatter, failure: OperationFailure): ErrorText {
  if (failure.code) return errorText(t, fmt, { code: failure.code, params: failure.params });
  // A record from before 1.1 carries Google's sentence and nothing else.
  return { title: failure.reason ?? t('error.generic.title'), hint: '' };
}

/** `region` params are codes; in a sentence they read as country names. */
function withRegionNames(
  fmt: Formatter,
  params: Record<string, string | number> | undefined,
): Record<string, string | number> | undefined {
  if (!params || typeof params.region !== 'string') return params;
  return { ...params, region: fmt.region(params.region) };
}
