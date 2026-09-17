// Unicode combining diacritical marks block (U+0300..U+036F), built from code points so the
// source file stays free of invisible characters.
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g'
);

/**
 * Pure string helpers. All functions are side-effect free and null-safe where sensible.
 */
export const StringUtils = {
  isBlank(value: string | null | undefined): boolean {
    return value === null || value === undefined || value.trim().length === 0;
  },

  capitalize(value: string): string {
    return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
  },

  toKebabCase(value: string): string {
    return splitWords(value)
      .map(word => word.toLowerCase())
      .join('-');
  },

  toSnakeCase(value: string): string {
    return splitWords(value)
      .map(word => word.toLowerCase())
      .join('_');
  },

  toCamelCase(value: string): string {
    return splitWords(value)
      .map((word, index) =>
        index === 0 ? word.toLowerCase() : StringUtils.capitalize(word.toLowerCase())
      )
      .join('');
  },

  /** Collapses consecutive whitespace (including newlines) into single spaces and trims. */
  normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  },

  truncate(value: string, maxLength: number, suffix = '...'): string {
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
  },

  /** Produces a safe, lowercase file name fragment from arbitrary text (test titles, URLs...). */
  sanitizeFileName(value: string, replacement = '-', maxLength = 120): string {
    const escapedReplacement = escapeRegExp(replacement);
    const sanitized = StringUtils.removeAccents(value)
      .replace(/[^a-zA-Z0-9._-]+/g, replacement)
      .replace(new RegExp(`${escapedReplacement}{2,}`, 'g'), replacement)
      .replace(new RegExp(`^${escapedReplacement}|${escapedReplacement}$`, 'g'), '')
      .toLowerCase();
    return sanitized.slice(0, maxLength) || 'untitled';
  },

  /** Masks a value for logs, keeping the first `visible` characters. */
  mask(value: string, visible = 2, maskChar = '*'): string {
    if (value.length <= visible) {
      return maskChar.repeat(value.length);
    }
    return `${value.slice(0, visible)}${maskChar.repeat(Math.min(value.length - visible, 8))}`;
  },

  /** Extracts the first number from text such as "$1,100 *includes tax" -> 1100. */
  extractNumber(value: string): number | undefined {
    const match = /-?\d+(\.\d+)?/.exec(value.replace(/,/g, ''));
    return match ? Number(match[0]) : undefined;
  },

  /** Returns every match of `pattern` (global flag is added automatically). */
  extractAll(value: string, pattern: RegExp): string[] {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    return Array.from(value.matchAll(new RegExp(pattern.source, flags)), match => match[0]);
  },

  /** Replaces `{{key}}` placeholders. Unknown keys are left untouched to make mistakes visible. */
  template(text: string, variables: Record<string, string | number | boolean>): string {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, key: string) => {
      const value = variables[key];
      return value === undefined ? placeholder : String(value);
    });
  },

  removeAccents(value: string): string {
    return value.normalize('NFKD').replace(COMBINING_MARKS, '');
  },

  equalsIgnoreCase(left: string, right: string): boolean {
    return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
  },

  containsIgnoreCase(haystack: string, needle: string): boolean {
    return haystack.toLowerCase().includes(needle.toLowerCase());
  },

  countOccurrences(text: string, search: string): number {
    if (search.length === 0) {
      return 0;
    }
    return text.split(search).length - 1;
  },

  toBase64(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64');
  },

  fromBase64(value: string): string {
    return Buffer.from(value, 'base64').toString('utf8');
  },

  /** Builds a regex that matches `value` exactly (anchored), for strict locator text filters. */
  exactMatch(value: string, flags = ''): RegExp {
    return new RegExp(`^${escapeRegExp(value)}$`, flags);
  },

  escapeRegExp,
} as const;

function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
