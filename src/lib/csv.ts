import type { ChangeSet, OperationRecord } from '@/types';
import { microsToUnits } from '@/domain/money/money';

function escape(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}

export function exportChangeSetCsv(changeSet: ChangeSet): string {
  const rows: (string | number | null)[][] = [
    ['region', 'country', 'currency', 'current', 'new', 'change_percent', 'status', 'issues'],
  ];
  for (const change of changeSet.changes) {
    if (change.status === 'skipped') continue;
    rows.push([
      change.regionCode,
      change.countryName,
      change.currency,
      change.currentMicros == null ? null : microsToUnits(change.currentMicros),
      change.newMicros == null ? null : microsToUnits(change.newMicros),
      change.delta == null ? null : Math.round(change.delta * 1000) / 10,
      change.status,
      change.issues.map((issue) => issue.code).join(' '),
    ]);
  }
  return toCsv(rows);
}

export function exportFailuresCsv(operation: OperationRecord): string {
  const rows: (string | number | null)[][] = [['region', 'reason']];
  for (const failure of operation.failures) rows.push([failure.regionCode, failure.reason]);
  return toCsv(rows);
}

/**
 * The panel runs inside an iframe on play.google.com, where a download from a
 * blob URL is the only path that does not require a host page cooperating.
 */
export function download(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
