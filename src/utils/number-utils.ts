export const NumberUtils = {
  /** "$1,100 *includes tax" -> 1100. Throws when no number is present. */
  parsePrice(text: string): number {
    const value = NumberUtils.tryParsePrice(text);
    if (value === undefined) {
      throw new TypeError(`Unable to parse a price from "${text}"`);
    }
    return value;
  },

  tryParsePrice(text: string): number | undefined {
    const match = /-?\d+(\.\d+)?/.exec(text.replace(/,/g, ''));
    return match ? Number(match[0]) : undefined;
  },

  /** Strict integer parsing: rejects "12abc", "", NaN. */
  parseIntStrict(text: string): number {
    const trimmed = text.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new TypeError(`"${text}" is not a valid integer`);
    }
    return Number(trimmed);
  },

  sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0);
  },

  average(values: readonly number[]): number {
    return values.length === 0 ? 0 : NumberUtils.sum(values) / values.length;
  },

  roundTo(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  },

  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  },

  isWithin(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  },

  percentage(part: number, total: number, decimals = 1): number {
    return total === 0 ? 0 : NumberUtils.roundTo((part / total) * 100, decimals);
  },

  formatCurrency(value: number, currency = 'USD', locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  },

  /** Percentile (0-100) of a sample; handy for response-time SLAs. */
  percentile(values: readonly number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
    );
    return sorted[index] ?? 0;
  },
} as const;
