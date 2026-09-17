export type DateInput = Date | string | number;

const MS_PER_DAY = 86_400_000;

/**
 * Dependency-free date helpers covering the needs of most test suites: formatting for
 * file names and assertions, relative dates for test data, and duration reporting.
 */
export const DateUtils = {
  now(): Date {
    return new Date();
  },

  toDate(input: DateInput): Date {
    const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError(`Invalid date input: ${String(input)}`);
    }
    return date;
  },

  /**
   * Formats using tokens: YYYY, YY, MM, M, DD, D, HH, H, mm, m, ss, s, SSS.
   * Example: format(date, 'YYYY-MM-DD HH:mm:ss').
   */
  format(input: DateInput, pattern: string): string {
    const date = DateUtils.toDate(input);
    const tokens: Record<string, string> = {
      YYYY: String(date.getFullYear()),
      YY: String(date.getFullYear()).slice(-2),
      MM: pad(date.getMonth() + 1),
      M: String(date.getMonth() + 1),
      DD: pad(date.getDate()),
      D: String(date.getDate()),
      HH: pad(date.getHours()),
      H: String(date.getHours()),
      mm: pad(date.getMinutes()),
      m: String(date.getMinutes()),
      ss: pad(date.getSeconds()),
      s: String(date.getSeconds()),
      SSS: String(date.getMilliseconds()).padStart(3, '0'),
    };
    return pattern.replace(
      /YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s|SSS/g,
      token => tokens[token] ?? token
    );
  },

  toIsoDate(input: DateInput = new Date()): string {
    return DateUtils.format(input, 'YYYY-MM-DD');
  },

  toIsoDateTime(input: DateInput = new Date()): string {
    return DateUtils.toDate(input).toISOString();
  },

  /** Sortable, file-system-safe timestamp, e.g. 20260915-143012. */
  timestampForFileName(input: DateInput = new Date()): string {
    return DateUtils.format(input, 'YYYYMMDD-HHmmss');
  },

  addMilliseconds(input: DateInput, amount: number): Date {
    return new Date(DateUtils.toDate(input).getTime() + amount);
  },

  addMinutes(input: DateInput, amount: number): Date {
    return DateUtils.addMilliseconds(input, amount * 60_000);
  },

  addHours(input: DateInput, amount: number): Date {
    return DateUtils.addMilliseconds(input, amount * 3_600_000);
  },

  addDays(input: DateInput, amount: number): Date {
    const date = DateUtils.toDate(input);
    date.setDate(date.getDate() + amount);
    return date;
  },

  addMonths(input: DateInput, amount: number): Date {
    const date = DateUtils.toDate(input);
    date.setMonth(date.getMonth() + amount);
    return date;
  },

  addYears(input: DateInput, amount: number): Date {
    const date = DateUtils.toDate(input);
    date.setFullYear(date.getFullYear() + amount);
    return date;
  },

  startOfDay(input: DateInput): Date {
    const date = DateUtils.toDate(input);
    date.setHours(0, 0, 0, 0);
    return date;
  },

  endOfDay(input: DateInput): Date {
    const date = DateUtils.toDate(input);
    date.setHours(23, 59, 59, 999);
    return date;
  },

  diffInMilliseconds(later: DateInput, earlier: DateInput): number {
    return DateUtils.toDate(later).getTime() - DateUtils.toDate(earlier).getTime();
  },

  /** Whole calendar days between two dates (ignores time of day). */
  diffInDays(later: DateInput, earlier: DateInput): number {
    const start = DateUtils.startOfDay(earlier).getTime();
    const end = DateUtils.startOfDay(later).getTime();
    return Math.round((end - start) / MS_PER_DAY);
  },

  isBefore(left: DateInput, right: DateInput): boolean {
    return DateUtils.toDate(left).getTime() < DateUtils.toDate(right).getTime();
  },

  isAfter(left: DateInput, right: DateInput): boolean {
    return DateUtils.toDate(left).getTime() > DateUtils.toDate(right).getTime();
  },

  isSameDay(left: DateInput, right: DateInput): boolean {
    return DateUtils.toIsoDate(left) === DateUtils.toIsoDate(right);
  },

  isWeekend(input: DateInput): boolean {
    const day = DateUtils.toDate(input).getDay();
    return day === 0 || day === 6;
  },

  /** Card expiry safely in the future, as the zero-padded month and 4-digit year. */
  futureCardExpiry(
    monthsAhead = 12,
    from: DateInput = new Date()
  ): { month: string; year: string } {
    const expiry = DateUtils.addMonths(from, monthsAhead);
    return { month: pad(expiry.getMonth() + 1), year: String(expiry.getFullYear()) };
  },

  /**
   * Reproduces the date rendered in the Demoblaze purchase confirmation:
   * `getDate()/getMonth()/getFullYear()`. Note the application uses the ZERO-BASED month
   * (a known defect of the demo site); this helper intentionally mirrors that behaviour
   * so assertions describe what the product actually does.
   */
  formatDemoblazeOrderDate(input: DateInput = new Date()): string {
    const date = DateUtils.toDate(input);
    return `${date.getDate()}/${date.getMonth()}/${date.getFullYear()}`;
  },

  elapsedSince(startedAtMs: number): number {
    return Date.now() - startedAtMs;
  },

  /** 95_000 -> "1m 35s"; 850 -> "850ms". */
  humanizeDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    parts.push(`${seconds}s`);
    return parts.join(' ');
  },
} as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
