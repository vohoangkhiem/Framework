import type { ConfirmedOrderData, OrderFormData } from '../../models/order.model';
import { DateUtils } from '../../utils/date-utils';
import { RandomUtils } from '../../utils/random-utils';

/**
 * Fluent builder for the "Place order" form. Starts from a complete, valid order and lets
 * tests remove or override individual fields to express validation scenarios explicitly.
 */
export class OrderBuilder {
  private data: OrderFormData;

  private constructor(initial: OrderFormData) {
    this.data = { ...initial };
  }

  static anOrder(): OrderBuilder {
    const expiry = DateUtils.futureCardExpiry(12);
    return new OrderBuilder({
      name: 'John Doe',
      country: 'USA',
      city: 'New York',
      creditCard: RandomUtils.creditCardNumber('4111', 16),
      month: expiry.month,
      year: expiry.year,
    });
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withCountry(country: string): this {
    this.data.country = country;
    return this;
  }

  withCity(city: string): this {
    this.data.city = city;
    return this;
  }

  withCreditCard(creditCard: string): this {
    this.data.creditCard = creditCard;
    return this;
  }

  withExpiry(month: string, year: string): this {
    this.data.month = month;
    this.data.year = year;
    return this;
  }

  /** Keeps only the fields the application validates (name + credit card). */
  withMandatoryFieldsOnly(): this {
    this.data = { name: this.data.name, creditCard: this.data.creditCard };
    return this;
  }

  withoutName(): this {
    delete this.data.name;
    return this;
  }

  withoutCreditCard(): this {
    delete this.data.creditCard;
    return this;
  }

  empty(): this {
    this.data = {};
    return this;
  }

  build(): OrderFormData {
    return { ...this.data };
  }

  /** Builds an order guaranteed to pass form validation; throws if a mandatory field was removed. */
  buildConfirmed(): ConfirmedOrderData {
    const { name, creditCard, ...optional } = this.data;
    if (!name || !creditCard) {
      throw new Error('A confirmed order requires both name and creditCard');
    }
    return { name, creditCard, ...optional };
  }
}
