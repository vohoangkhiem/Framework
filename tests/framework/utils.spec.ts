import { TAGS, tags } from '@config/test-tags';
import { CartBuilder } from '@data/builders/cart.builder';
import { OrderBuilder } from '@data/builders/order.builder';
import { PRODUCT_CATALOG } from '@data/static/products.catalog';
import { expect, test } from '@fixtures';
import { DateUtils } from '@utils/date-utils';
import { NumberUtils } from '@utils/number-utils';
import { RandomUtils } from '@utils/random-utils';
import { StringUtils } from '@utils/string-utils';

/** Luhn checksum implemented independently of the generator under test. */
function isLuhnValid(cardNumber: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    let digit = Number(cardNumber.charAt(index));
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

test.describe('RandomUtils', tags(TAGS.framework), () => {
  test('generates Luhn-valid card numbers with the requested prefix and length', () => {
    const numbers = Array.from({ length: 50 }, () => RandomUtils.creditCardNumber('4111', 16));

    for (const number of numbers) {
      expect(number).toHaveLength(16);
      expect(number).toMatch(/^4111\d{12}$/);
      expect(isLuhnValid(number)).toBe(true);
    }
  });

  test('produces unique ids across many rapid calls', () => {
    const ids = new Set(Array.from({ length: 2_000 }, () => RandomUtils.uniqueId('qa_')));

    expect(ids.size).toBe(2_000);
  });

  test('builds passwords containing every required character class', () => {
    const password = RandomUtils.password(12);

    expect(password).toHaveLength(12);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?]/);
  });
});

test.describe('DateUtils', tags(TAGS.framework), () => {
  test('mirrors the zero-based month the application renders in order confirmations', () => {
    expect(DateUtils.formatDemoblazeOrderDate(new Date(2026, 8, 15))).toBe('15/8/2026');
  });

  test('formats card expiry as a zero-padded month and a four-digit year', () => {
    expect(DateUtils.futureCardExpiry(3, new Date(2026, 10, 20))).toStrictEqual({
      month: '02',
      year: '2027',
    });
  });

  test('humanises durations', () => {
    expect(DateUtils.humanizeDuration(850)).toBe('850ms');
    expect(DateUtils.humanizeDuration(95_000)).toBe('1m 35s');
    expect(DateUtils.humanizeDuration(3_725_000)).toBe('1h 2m 5s');
  });
});

test.describe('NumberUtils', tags(TAGS.framework), () => {
  test('parses prices out of decorated text', () => {
    expect(NumberUtils.parsePrice('$1,100 *includes tax')).toBe(1100);
    expect(NumberUtils.tryParsePrice('no price here')).toBeUndefined();
    expect(() => NumberUtils.parsePrice('n/a')).toThrow(TypeError);
  });

  test('computes percentiles on unsorted samples', () => {
    expect(NumberUtils.percentile([300, 100, 200, 400, 500], 50)).toBe(300);
    expect(NumberUtils.percentile([300, 100, 200, 400, 500], 95)).toBe(500);
    expect(NumberUtils.percentile([], 95)).toBe(0);
  });
});

test.describe('StringUtils', tags(TAGS.framework), () => {
  test('builds anchored, escaped patterns for exact locator text matches', () => {
    const pattern = StringUtils.exactMatch('Dell i7 8gb (2017)');

    expect('Dell i7 8gb (2017)').toMatch(pattern);
    expect('Dell i7 8gb (2017) refurbished').not.toMatch(pattern);
    expect('Dell i7 8gb x2017y').not.toMatch(pattern);
  });

  test('sanitises arbitrary text into safe file names', () => {
    expect(StringUtils.sanitizeFileName('Login > logs in: "Zoë" / 100%')).toBe(
      'login-logs-in-zoe-100'
    );
  });
});

test.describe('Builders', tags(TAGS.framework), () => {
  test('computes cart totals from the catalog so data cannot drift from prices', () => {
    const scenario = CartBuilder.aCart().withProducts('samsungGalaxyS6', 'macbookAir').build();

    expect(scenario.products).toHaveLength(2);
    expect(scenario.expectedTotal).toBe(
      PRODUCT_CATALOG.samsungGalaxyS6.price + PRODUCT_CATALOG.macbookAir.price
    );
  });

  test('refuses to build a confirmed order without the mandatory fields', () => {
    expect(() => OrderBuilder.anOrder().withoutCreditCard().buildConfirmed()).toThrow(
      'requires both name and creditCard'
    );
    expect(OrderBuilder.anOrder().withoutName().build().name).toBeUndefined();
  });
});
