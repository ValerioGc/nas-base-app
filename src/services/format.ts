const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** A size as a person reads it: `1,5 GB` in Italian, `1.5 GB` in English. */
export function formatBytes(bytes: number, locale: string): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${UNITS[unit]}`;
}

/** The share of a whole, in percent, never past 100. */
export function share(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, (part / whole) * 100) : 0;
}
