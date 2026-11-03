import { cx } from '@/lib/cx';

/**
 * A small, closed icon set drawn on a 16-unit grid with a 1.5 stroke, so every
 * icon has the same weight. Unicode glyphs (⌕ ✕ ▾ ⚠) render differently on
 * every OS and are read aloud by screen readers; these are decorative and
 * hidden from assistive technology — the control around them carries the label.
 */
const PATHS = {
  search: '<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.5 13.5"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  check: '<path d="M3.5 8.5l3 3 6-7"/>',
  chevronDown: '<path d="M4 6l4 4 4-4"/>',
  chevronRight: '<path d="M6 4l4 4-4 4"/>',
  chevronLeft: '<path d="M10 4L6 8l4 4"/>',
  arrowRight: '<path d="M3 8h10M9 4l4 4-4 4"/>',
  arrowLeft: '<path d="M13 8H3M7 4L3 8l4 4"/>',
  history: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9L2.5 5.7"/><path d="M2.5 2.5v3.2h3.2"/><path d="M8 5v3.2l2 1.3"/>',
  settings:
    '<path d="M6.9 1.75h2.2l.35 1.7c.45.17.87.41 1.24.72l1.65-.55 1.1 1.9-1.3 1.15a4.6 4.6 0 0 1 0 1.46l1.3 1.15-1.1 1.9-1.65-.55c-.37.31-.79.55-1.24.72l-.35 1.7H6.9l-.35-1.7a4.4 4.4 0 0 1-1.24-.72l-1.65.55-1.1-1.9 1.3-1.15a4.6 4.6 0 0 1 0-1.46l-1.3-1.15 1.1-1.9 1.65.55c.37-.31.79-.55 1.24-.72l.35-1.7Z"/><circle cx="8" cy="8" r="1.9"/>',
  help: '<circle cx="8" cy="8" r="6.25"/><path d="M6.25 6.25a1.75 1.75 0 1 1 2.6 1.53c-.5.28-.85.7-.85 1.27v.2"/><path d="M8 11.5v.01"/>',
  info: '<circle cx="8" cy="8" r="6.25"/><path d="M8 7.25v4M8 4.75v.01"/>',
  warning: '<path d="M8 2.25 14.25 13H1.75L8 2.25Z"/><path d="M8 6.5v3M8 11.25v.01"/>',
  error: '<circle cx="8" cy="8" r="6.25"/><path d="M8 4.75v3.75M8 11v.01"/>',
  success: '<circle cx="8" cy="8" r="6.25"/><path d="M5.5 8.25l1.75 1.75 3.25-4"/>',
  external: '<path d="M9 2.75h4.25V7M13 3 7.5 8.5"/><path d="M11.5 9.5v3.25h-8.75V4h3.25"/>',
  copy: '<rect x="5.25" y="5.25" width="8" height="8" rx="1.5"/><path d="M10.75 5.25V3.5a.75.75 0 0 0-.75-.75H3.5a.75.75 0 0 0-.75.75V10c0 .41.34.75.75.75h1.75"/>',
  download: '<path d="M8 2.5v8M4.75 7.5 8 10.75l3.25-3.25M2.75 13.25h10.5"/>',
  upload: '<path d="M8 10.75v-8M4.75 5.75 8 2.5l3.25 3.25M2.75 13.25h10.5"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  trash: '<path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4.25 4.25l.6 8.5c.03.42.38.75.8.75h4.7c.42 0 .77-.33.8-.75l.6-8.5"/>',
  undo: '<path d="M5.5 6.5H10a3 3 0 0 1 0 6H6.5"/><path d="M7.5 4 5 6.5 7.5 9"/>',
  refresh: '<path d="M13.25 8A5.25 5.25 0 1 1 11.6 4.2"/><path d="M13.25 2.5v3h-3"/>',
  globe: '<circle cx="8" cy="8" r="6.25"/><path d="M1.75 8h12.5M8 1.75c1.75 1.9 2.5 3.9 2.5 6.25S9.75 12.35 8 14.25C6.25 12.35 5.5 10.35 5.5 8S6.25 3.65 8 1.75Z"/>',
  layers: '<path d="M8 2.25 14 5.5 8 8.75 2 5.5 8 2.25Z"/><path d="M2 8.25 8 11.5l6-3.25M2 11 8 14.25 14 11"/>',
  tag: '<path d="M2.25 2.25h5.5l6 6-5.5 5.5-6-6v-5.5Z"/><circle cx="5.25" cy="5.25" r=".75"/>',
  lock: '<rect x="3.25" y="7" width="9.5" height="6.75" rx="1.25"/><path d="M5.25 7V5a2.75 2.75 0 0 1 5.5 0v2"/>',
  key: '<circle cx="5.25" cy="10.75" r="2.75"/><path d="M7.25 8.75 13.5 2.5M11 5l1.75 1.75M9.5 6.5l1.25 1.25"/>',
  play: '<path d="M4.75 3.25v9.5L12.5 8 4.75 3.25Z"/>',
  flask: '<path d="M6.25 2.25h3.5M6.75 2.25v4L3.1 12.4a.9.9 0 0 0 .78 1.35h8.24a.9.9 0 0 0 .78-1.35L9.25 6.25v-4"/><path d="M4.5 10h7"/>',
  sparkle: '<path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.75 1.75M10.25 10.25 12 12M12 4l-1.75 1.75M5.75 10.25 4 12"/>',
  filter: '<path d="M2.25 3.25h11.5L9.25 8.5v4.25l-2.5 1v-5.25L2.25 3.25Z"/>',
  dot: '<circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none"/>',
  minus: '<path d="M3 8h10"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  size = 16,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx('shrink-0', className)}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
