export type ClassValue = string | number | bigint | false | null | undefined;

/** Minimal class joiner. A full clsx/tailwind-merge pair is not worth 8 KB here. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
