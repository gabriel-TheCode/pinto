import type { ChangeSet, OperationRecord, PriceChange } from '@/types';
import type { Formatter, T } from '@/i18n';
import { failureText, issueText } from '@/i18n/describe';
import { writableChanges } from '@/domain/pricing/computeChangeSet';
import { microsToUnits } from '@/domain/money/money';
import { toCsv } from '@/lib/csv';

/** A write to this many countries or more asks for the count to be typed. */
export const TYPED_CONFIRM_AT = 25;

export type Filter = 'changing' | 'check' | 'blocked' | 'unchanged';
export const FILTERS: readonly Filter[] = ['changing', 'check', 'blocked', 'unchanged'];

/**
 * The review's rows by filter. "Changing" is exactly what will be written;
 * "To check" is the part of it with a warning. Unselected rows are not shown.
 */
export function bucketsOf(changeSet: ChangeSet): Record<Filter, PriceChange[]> {
  const changing = writableChanges(changeSet);
  return {
    changing,
    check: changing.filter((change) => change.issues.some((issue) => issue.level === 'warning')),
    blocked: changeSet.changes.filter((change) => change.status === 'invalid'),
    unchanged: changeSet.changes.filter((change) => change.status === 'unchanged'),
  };
}

/** Smallest and largest relative change among `rows`, or null when none is comparable. */
export function deltaRange(rows: PriceChange[]): { min: number; max: number } | null {
  const deltas = rows.map((row) => row.delta).filter((delta): delta is number => delta != null);
  return deltas.length ? { min: Math.min(...deltas), max: Math.max(...deltas) } : null;
}

// --- CSV ---------------------------------------------------------------------
// Headers and words in the user's language; numbers machine-readable (dot
// decimals, no grouping) so a spreadsheet or a script can read them back.

const units = (micros: number | null | undefined) => (micros == null ? '' : microsToUnits(micros));
const percent = (delta: number | null) => (delta == null ? '' : Math.round(delta * 10_000) / 100);

export function changesCsv(t: T, fmt: Formatter, changeSet: ChangeSet): string {
  return toCsv([
    [
      t('review.csv.code'),
      t('review.csv.country'),
      t('review.csv.currency'),
      t('review.csv.current'),
      t('review.csv.new'),
      t('review.csv.change'),
      t('review.csv.status'),
      t('review.csv.notes'),
    ],
    ...changeSet.changes
      .filter((change) => change.status !== 'skipped')
      .map((change) => [
        change.regionCode,
        fmt.region(change.regionCode),
        change.currency,
        units(change.currentMicros),
        units(change.newMicros),
        percent(change.delta),
        t(`review.status.${change.status}`),
        change.issues.map((issue) => issueText(t, fmt, issue)).join(' | '),
      ]),
  ]);
}

export function failuresCsv(t: T, fmt: Formatter, record: OperationRecord): string {
  return toCsv([
    [
      t('review.csv.code'),
      t('review.csv.country'),
      t('review.csv.reason'),
      t('review.csv.hint'),
      t('review.csv.detail'),
    ],
    ...record.failures.map((failure) => {
      const text = failureText(t, fmt, failure);
      return [failure.regionCode, fmt.region(failure.regionCode), text.title, text.hint, failure.detail];
    }),
  ]);
}

/** `pinto-premium-2026-11-03.csv`, dated in local time. */
export function csvFilename(parts: string[], now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${['pinto', ...parts, day].join('-')}.csv`;
}
