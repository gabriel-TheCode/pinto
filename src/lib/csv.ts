/**
 * CSV writing and the browser download. Callers build the rows — with headers
 * in the user's language — and numbers stay machine-readable (dot decimals,
 * no grouping) so a spreadsheet or script can read the file back.
 */
export type CsvCell = string | number | null | undefined;

function escape(value: CsvCell): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}

/**
 * The panel runs inside an iframe on play.google.com, where a download from a
 * blob URL is the only path that does not require a host page cooperating.
 * The byte-order mark makes Excel read accented headers as UTF-8.
 */
export function download(filename: string, contents: string, type = 'text/csv'): void {
  const body = type === 'text/csv' ? `﻿${contents}` : contents;
  const blob = new Blob([body], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
