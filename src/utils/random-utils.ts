import { randomInt as cryptoRandomInt, randomUUID } from 'node:crypto';

export const CHARSETS = {
  alphaLower: 'abcdefghijklmnopqrstuvwxyz',
  alphaUpper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numeric: '0123456789',
  alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  special: '!@#$%^&*()-_=+[]{};:,.?',
  hex: '0123456789abcdef',
} as const;

/**
 * Random data generators backed by `node:crypto` so that values are unpredictable and
 * collision-resistant even when many workers generate data simultaneously.
 */
export const RandomUtils = {
  /** Inclusive integer in [min, max]. */
  int(min: number, max: number): number {
    if (max < min) {
      throw new RangeError(`max (${max}) must be >= min (${min})`);
    }
    return cryptoRandomInt(min, max + 1);
  },

  float(min: number, max: number, decimals = 2): number {
    const value = min + (cryptoRandomInt(0, 1_000_000) / 1_000_000) * (max - min);
    return Number(value.toFixed(decimals));
  },

  boolean(probabilityOfTrue = 0.5): boolean {
    return cryptoRandomInt(0, 1_000_000) / 1_000_000 < probabilityOfTrue;
  },

  string(length: number, charset: string = CHARSETS.alphanumeric): string {
    if (charset.length === 0) {
      throw new RangeError('charset must not be empty');
    }
    let result = '';
    for (let index = 0; index < length; index += 1) {
      result += charset.charAt(cryptoRandomInt(0, charset.length));
    }
    return result;
  },

  alphanumeric(length: number): string {
    return RandomUtils.string(length, CHARSETS.alphanumeric);
  },

  letters(length: number): string {
    return RandomUtils.string(length, CHARSETS.alpha);
  },

  digits(length: number): string {
    return RandomUtils.string(length, CHARSETS.numeric);
  },

  /** Password containing at least one lower, upper, digit and special character. */
  password(length = 12): string {
    const required = [
      RandomUtils.string(1, CHARSETS.alphaLower),
      RandomUtils.string(1, CHARSETS.alphaUpper),
      RandomUtils.string(1, CHARSETS.numeric),
      RandomUtils.string(1, CHARSETS.special),
    ];
    const filler = RandomUtils.string(
      Math.max(0, length - required.length),
      CHARSETS.alphanumeric + CHARSETS.special
    );
    return RandomUtils.shuffle([...required, ...filler.split('')]).join('');
  },

  uuid(): string {
    return randomUUID();
  },

  /**
   * Time-ordered unique identifier: base-36 timestamp + random suffix. Ideal for usernames
   * that must be unique across parallel workers and repeated CI runs.
   */
  uniqueId(prefix = '', randomLength = 6): string {
    return `${prefix}${Date.now().toString(36)}${RandomUtils.string(randomLength, CHARSETS.alphaLower + CHARSETS.numeric)}`;
  },

  email(domain = 'example.com'): string {
    return `${RandomUtils.uniqueId('qa.', 4)}@${domain}`;
  },

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('Cannot pick from an empty array');
    }
    const item = items[cryptoRandomInt(0, items.length)];
    if (item === undefined) {
      throw new RangeError('Cannot pick from an empty array');
    }
    return item;
  },

  pickMany<T>(items: readonly T[], count: number): T[] {
    if (count > items.length) {
      throw new RangeError(`Cannot pick ${count} items from an array of ${items.length}`);
    }
    return RandomUtils.shuffle(items).slice(0, count);
  },

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = cryptoRandomInt(0, index + 1);
      const current = copy[index];
      const swap = copy[swapIndex];
      if (current !== undefined && swap !== undefined) {
        copy[index] = swap;
        copy[swapIndex] = current;
      }
    }
    return copy;
  },

  /** Luhn-valid card number (defaults to a 16-digit Visa-style number). */
  creditCardNumber(prefix = '4', length = 16): string {
    const bodyLength = length - prefix.length - 1;
    const body = `${prefix}${RandomUtils.digits(bodyLength)}`;
    return `${body}${luhnCheckDigit(body)}`;
  },
} as const;

function luhnCheckDigit(partial: string): number {
  let sum = 0;
  let shouldDouble = true;
  for (let index = partial.length - 1; index >= 0; index -= 1) {
    let digit = Number(partial.charAt(index));
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return (10 - (sum % 10)) % 10;
}
